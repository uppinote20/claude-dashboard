/**
 * Gemini CLI API client
 * Fetches usage limits from Google Code Assist API
 * @handbook 7.1-common-api-pattern
 * @handbook 4.2-request-deduplication
 * @handbook 4.4-credentials-caching
 */

import { readFile, writeFile, stat } from 'fs/promises';
import { execFileSync } from 'child_process';
import os from 'os';
import path from 'path';
import type { GeminiUsageLimits, CacheEntry } from '../types.js';
import { hashToken } from './hash.js';
import { VERSION } from '../version.js';
import { debugLog } from './debug.js';

const API_TIMEOUT_MS = 5000;
const GEMINI_DIR = '.gemini';
const OAUTH_CREDS_FILE = 'oauth_creds.json';
const SETTINGS_FILE = 'settings.json';
const KEYCHAIN_SERVICE_NAME = 'gemini-cli-oauth';
const MAIN_ACCOUNT_KEY = 'main-account';

const CODE_ASSIST_ENDPOINT = 'https://cloudcode-pa.googleapis.com';
const CODE_ASSIST_API_VERSION = 'v1internal';

// Google OAuth endpoints and credentials (from Gemini CLI source)
// Note: Client secret is safe to embed per Google's installed app guidelines
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const OAUTH_CLIENT_ID = '681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com';
const OAUTH_CLIENT_SECRET = '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';

// Token refresh buffer (refresh 5 minutes before expiry)
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

/**
 * In-memory cache for Gemini usage
 */
const geminiCacheMap: Map<string, CacheEntry<GeminiUsageLimits>> = new Map();

/**
 * Pending API requests to prevent duplicates
 */
const pendingRequests: Map<string, Promise<GeminiUsageLimits | null>> = new Map();

/**
 * Pending token refresh requests to prevent duplicates (per token hash)
 */
const pendingRefreshRequests: Map<string, Promise<GeminiCredentials | null>> = new Map();

/**
 * Cached OAuth credentials with mtime tracking
 */
let cachedCredentials: { data: GeminiCredentials; mtime: number } | null = null;

/**
 * Cached settings with mtime tracking
 */
let cachedSettings: { data: GeminiSettings; mtime: number } | null = null;

interface GeminiCredentials {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
}

interface GeminiSettings {
  cloudaicompanionProject?: string;
  selectedModel?: string;
  auth?: {
    type?: string;
  };
}

interface LoadCodeAssistResponse {
  currentTier?: {
    id: string;
    name?: string;
  } | null;
  cloudaicompanionProject?: string | null;
}

interface BucketInfo {
  remainingAmount?: string;
  remainingFraction?: number;
  resetTime?: string;
  tokenType?: string;
  modelId?: string;
}

interface RetrieveUserQuotaResponse {
  buckets?: BucketInfo[];
}

/**
 * Get Gemini directory path
 */
function getGeminiDir(): string {
  return path.join(os.homedir(), GEMINI_DIR);
}

/**
 * Check if Gemini CLI is installed (has credentials)
 */
export async function isGeminiInstalled(): Promise<boolean> {
  try {
    // Check for keychain first
    const keychainToken = await getTokenFromKeychain();
    if (keychainToken) {
      return true;
    }

    // Fallback to file
    const oauthPath = path.join(getGeminiDir(), OAUTH_CREDS_FILE);
    await stat(oauthPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get OAuth token from macOS Keychain using security command
 * Uses execFileSync to prevent shell injection vulnerabilities
 */
async function getTokenFromKeychain(): Promise<GeminiCredentials | null> {
  if (os.platform() !== 'darwin') {
    return null;
  }

  try {
    // Use security command to get password from keychain
    // execFileSync is used instead of execSync for security
    const result = execFileSync(
      'security',
      ['find-generic-password', '-s', KEYCHAIN_SERVICE_NAME, '-a', MAIN_ACCOUNT_KEY, '-w'],
      { encoding: 'utf-8', timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();

    if (!result) {
      return null;
    }

    // Parse the stored JSON
    const stored = JSON.parse(result);
    if (!stored.token?.accessToken) {
      return null;
    }

    return {
      accessToken: stored.token.accessToken,
      refreshToken: stored.token.refreshToken,
      expiryDate: stored.token.expiresAt,
    };
  } catch {
    return null;
  }
}

/**
 * Get OAuth credentials from file fallback
 */
async function getCredentialsFromFile(): Promise<GeminiCredentials | null> {
  try {
    const oauthPath = path.join(getGeminiDir(), OAUTH_CREDS_FILE);
    const fileStat = await stat(oauthPath);

    // Use cached credentials if file hasn't changed
    if (cachedCredentials && cachedCredentials.mtime === fileStat.mtimeMs) {
      return cachedCredentials.data;
    }

    const raw = await readFile(oauthPath, 'utf-8');
    const json = JSON.parse(raw);

    const accessToken = json?.access_token;
    if (!accessToken) {
      return null;
    }

    const data: GeminiCredentials = {
      accessToken,
      refreshToken: json?.refresh_token,
      expiryDate: json?.expiry_date,
    };

    cachedCredentials = { data, mtime: fileStat.mtimeMs };
    return data;
  } catch {
    return null;
  }
}

/**
 * Get Gemini OAuth credentials (Keychain first, then file fallback)
 */
async function getGeminiCredentials(): Promise<GeminiCredentials | null> {
  // Try keychain first
  const keychainCreds = await getTokenFromKeychain();
  if (keychainCreds) {
    return keychainCreds;
  }

  // Fallback to file
  return getCredentialsFromFile();
}

/**
 * Check if token needs refresh (expired or expiring soon)
 */
function tokenNeedsRefresh(credentials: GeminiCredentials): boolean {
  if (!credentials.expiryDate) {
    return false; // No expiry info, assume valid
  }
  return credentials.expiryDate < (Date.now() + TOKEN_REFRESH_BUFFER_MS);
}

/**
 * Internal refresh token implementation
 */
async function refreshTokenInternal(credentials: GeminiCredentials): Promise<GeminiCredentials | null> {
  try {
    debugLog('gemini', 'refreshTokenInternal: attempting refresh...');

    const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: credentials.refreshToken!,
        client_id: OAUTH_CLIENT_ID,
        client_secret: OAUTH_CLIENT_SECRET,
      }),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });

    if (!response.ok) {
      debugLog('gemini', 'refreshTokenInternal: failed', response.status);
      return null;
    }

    const data = await response.json();

    if (!data.access_token) {
      debugLog('gemini', 'refreshTokenInternal: no access_token in response');
      return null;
    }

    const newCredentials: GeminiCredentials = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || credentials.refreshToken,
      expiryDate: Date.now() + (data.expires_in * 1000),
    };

    // Save to file
    await saveCredentialsToFile(newCredentials, data);

    // Clear cached credentials to force reload
    cachedCredentials = null;

    debugLog('gemini', 'refreshTokenInternal: success, new expiry', new Date(newCredentials.expiryDate!).toISOString());

    return newCredentials;
  } catch (err) {
    debugLog('gemini', 'refreshTokenInternal: error', err);
    return null;
  }
}

/**
 * Refresh OAuth token using refresh_token with deduplication
 * Returns new credentials or null if refresh fails
 */
async function refreshToken(credentials: GeminiCredentials): Promise<GeminiCredentials | null> {
  if (!credentials.refreshToken) {
    debugLog('gemini', 'refreshToken: no refresh token available');
    return null;
  }

  const tokenHash = hashToken(credentials.accessToken);

  // Return pending request if one exists for this token
  const pending = pendingRefreshRequests.get(tokenHash);
  if (pending) {
    debugLog('gemini', 'refreshToken: using pending refresh request');
    return pending;
  }

  // Create and track new refresh request
  const refreshPromise = refreshTokenInternal(credentials).finally(() => {
    pendingRefreshRequests.delete(tokenHash);
  });
  pendingRefreshRequests.set(tokenHash, refreshPromise);

  return refreshPromise;
}

/**
 * Save refreshed credentials to file
 */
async function saveCredentialsToFile(credentials: GeminiCredentials, rawResponse: Record<string, unknown>): Promise<void> {
  try {
    const oauthPath = path.join(getGeminiDir(), OAUTH_CREDS_FILE);

    // Read existing file to preserve other fields
    let existingData: Record<string, unknown> = {};
    try {
      const raw = await readFile(oauthPath, 'utf-8');
      existingData = JSON.parse(raw);
    } catch {
      // File doesn't exist or invalid JSON
    }

    // Update with new token data
    const newData = {
      ...existingData,
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
      expiry_date: credentials.expiryDate,
      token_type: rawResponse.token_type || 'Bearer',
      scope: rawResponse.scope || existingData.scope,
    };

    await writeFile(oauthPath, JSON.stringify(newData, null, 2), { mode: 0o600 });
    debugLog('gemini', 'saveCredentialsToFile: saved');
  } catch (err) {
    debugLog('gemini', 'saveCredentialsToFile: error', err);
  }
}

/**
 * Get valid credentials, refreshing if necessary
 */
async function getValidCredentials(): Promise<GeminiCredentials | null> {
  let credentials = await getGeminiCredentials();

  if (!credentials) {
    return null;
  }

  // Check if token needs refresh
  if (tokenNeedsRefresh(credentials)) {
    debugLog('gemini', 'getValidCredentials: token expired or expiring, attempting refresh');
    const refreshedCreds = await refreshToken(credentials);
    if (refreshedCreds) {
      return refreshedCreds;
    }
    // Refresh failed, return null (token is invalid)
    debugLog('gemini', 'getValidCredentials: refresh failed');
    return null;
  }

  return credentials;
}

/**
 * Cached project ID from loadCodeAssist API (per token hash for multi-account support)
 */
const projectIdCacheMap: Map<string, { data: string; timestamp: number }> = new Map();
const PROJECT_ID_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get Gemini settings from ~/.gemini/settings.json
 */
async function getGeminiSettings(): Promise<GeminiSettings | null> {
  try {
    const settingsPath = path.join(getGeminiDir(), SETTINGS_FILE);
    const fileStat = await stat(settingsPath);

    // Use cached settings if file hasn't changed
    if (cachedSettings && cachedSettings.mtime === fileStat.mtimeMs) {
      return cachedSettings.data;
    }

    const raw = await readFile(settingsPath, 'utf-8');
    const json = JSON.parse(raw);

    const data: GeminiSettings = {
      cloudaicompanionProject: json?.cloudaicompanionProject,
      selectedModel: json?.selectedModel || json?.model?.name,
      auth: json?.auth,
    };

    cachedSettings = { data, mtime: fileStat.mtimeMs };
    return data;
  } catch {
    return null;
  }
}

/**
 * Get current Gemini model from settings
 */
export async function getGeminiModel(): Promise<string | null> {
  const settings = await getGeminiSettings();
  return settings?.selectedModel ?? null;
}

/**
 * Get project ID via loadCodeAssist API
 * Falls back to environment variable or settings
 */
async function getProjectId(credentials: GeminiCredentials): Promise<string | null> {
  // Check environment variable first
  const envProjectId = process.env['GOOGLE_CLOUD_PROJECT'] || process.env['GOOGLE_CLOUD_PROJECT_ID'];
  if (envProjectId) {
    return envProjectId;
  }

  // Check settings file
  const settings = await getGeminiSettings();
  if (settings?.cloudaicompanionProject) {
    return settings.cloudaicompanionProject;
  }

  // Use token hash for cache key (multi-account support)
  const tokenHash = hashToken(credentials.accessToken);

  // Check cache
  const cached = projectIdCacheMap.get(tokenHash);
  if (cached && (Date.now() - cached.timestamp) < PROJECT_ID_CACHE_TTL_MS) {
    return cached.data;
  }

  // Fetch from loadCodeAssist API
  try {
    const url = `${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}:loadCodeAssist`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': `claude-dashboard/${VERSION}`,
        'Authorization': `Bearer ${credentials.accessToken}`,
      },
      body: JSON.stringify({
        metadata: {
          ideType: 'GEMINI_CLI',
          platform: 'PLATFORM_UNSPECIFIED',
          pluginType: 'GEMINI',
        },
      }),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });

    if (!response.ok) {
      debugLog('gemini', 'loadCodeAssist: response not ok', response.status);
      return null;
    }

    const data = await response.json() as LoadCodeAssistResponse;
    const projectId = data?.cloudaicompanionProject;

    if (projectId) {
      projectIdCacheMap.set(tokenHash, { data: projectId, timestamp: Date.now() });
      return projectId;
    }
  } catch (err) {
    debugLog('gemini', 'loadCodeAssist error:', err);
  }

  return null;
}

/**
 * Fetch Gemini usage limits
 */
export async function fetchGeminiUsage(ttlSeconds: number = 60): Promise<GeminiUsageLimits | null> {
  const credentials = await getValidCredentials();
  if (!credentials) {
    debugLog('gemini', 'fetchGeminiUsage: no valid credentials');
    return null;
  }

  const projectId = await getProjectId(credentials);
  if (!projectId) {
    debugLog('gemini', 'fetchGeminiUsage: no project ID found');
    return null;
  }

  const tokenHash = hashToken(credentials.accessToken);

  // Check memory cache
  const cached = geminiCacheMap.get(tokenHash);
  if (cached) {
    const ageSeconds = (Date.now() - cached.timestamp) / 1000;
    if (ageSeconds < ttlSeconds) {
      debugLog('gemini', 'fetchGeminiUsage: returning cached data');
      return cached.data;
    }
  }

  // Check pending request
  const pending = pendingRequests.get(tokenHash);
  if (pending) {
    return pending;
  }

  // Create new request
  const requestPromise = fetchFromGeminiApi(credentials, projectId);
  pendingRequests.set(tokenHash, requestPromise);

  try {
    return await requestPromise;
  } finally {
    pendingRequests.delete(tokenHash);
  }
}

/**
 * Internal API fetch
 */
async function fetchFromGeminiApi(
  credentials: GeminiCredentials,
  projectId: string
): Promise<GeminiUsageLimits | null> {
  try {
    debugLog('gemini', 'fetchFromGeminiApi: starting...');

    const url = `${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}:retrieveUserQuota`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': `claude-dashboard/${VERSION}`,
        'Authorization': `Bearer ${credentials.accessToken}`,
      },
      body: JSON.stringify({
        project: projectId,
      }),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });

    debugLog('gemini', 'fetchFromGeminiApi: response status', response.status);

    if (!response.ok) {
      debugLog('gemini', 'fetchFromGeminiApi: response not ok');
      return null;
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      debugLog('gemini', 'fetchFromGeminiApi: invalid JSON response');
      return null;
    }

    // Validate response structure
    if (!data || typeof data !== 'object') {
      debugLog('gemini', 'fetchFromGeminiApi: invalid response - not an object');
      return null;
    }

    const typedData = data as RetrieveUserQuotaResponse;
    debugLog('gemini', `fetchFromGeminiApi: got data ${typedData.buckets?.length || 0} buckets`);

    const model = await getGeminiModel();

    // Process buckets - find current model and aggregate
    let primaryBucket: BucketInfo | null = null;
    let currentModelBucket: BucketInfo | null = null;

    if (typedData.buckets && Array.isArray(typedData.buckets)) {
      for (const bucket of typedData.buckets) {
        // Find bucket for current model
        if (model && bucket.modelId && bucket.modelId.includes(model)) {
          currentModelBucket = bucket;
        }
        // Use first bucket as primary if no model match
        if (!primaryBucket) {
          primaryBucket = bucket;
        }
      }
    }

    // Use current model bucket if found, otherwise primary
    const activeBucket = currentModelBucket || primaryBucket;

    // Use settings model, or fall back to first bucket's model
    const displayModel = model ?? activeBucket?.modelId ?? 'unknown';

    const limits: GeminiUsageLimits = {
      model: displayModel,
      // remainingFraction is remaining, so usage = 1 - remaining
      usedPercent: activeBucket?.remainingFraction !== undefined
        ? Math.round((1 - activeBucket.remainingFraction) * 100)
        : null,
      resetAt: activeBucket?.resetTime ?? null,
      buckets: typedData.buckets?.map(b => ({
        modelId: b.modelId,
        usedPercent: b.remainingFraction !== undefined
          ? Math.round((1 - b.remainingFraction) * 100)
          : null,
        resetAt: b.resetTime ?? null,
      })) ?? [],
    };

    // Update cache
    const tokenHash = hashToken(credentials.accessToken);
    geminiCacheMap.set(tokenHash, { data: limits, timestamp: Date.now() });
    debugLog('gemini', 'fetchFromGeminiApi: success', limits);

    return limits;
  } catch (err) {
    debugLog('gemini', 'fetchFromGeminiApi: error', err);
    return null;
  }
}

/**
 * Clear cache (for testing)
 */
export function clearGeminiCache(): void {
  geminiCacheMap.clear();
  projectIdCacheMap.clear();
  pendingRefreshRequests.clear();
  cachedCredentials = null;
  cachedSettings = null;
}
