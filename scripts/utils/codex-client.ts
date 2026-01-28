/**
 * Codex CLI API client
 * Fetches usage limits from ChatGPT backend API
 */

import { readFile, stat } from 'fs/promises';
import os from 'os';
import path from 'path';
import type { CodexUsageLimits, CacheEntry } from '../types.js';
import { hashToken } from './hash.js';
import { VERSION } from '../version.js';
import { debugLog } from './debug.js';

const API_TIMEOUT_MS = 5000;
const CODEX_AUTH_PATH = path.join(os.homedir(), '.codex', 'auth.json');
const CODEX_CONFIG_PATH = path.join(os.homedir(), '.codex', 'config.toml');

/**
 * In-memory cache for Codex usage
 */
const codexCacheMap: Map<string, CacheEntry<CodexUsageLimits>> = new Map();

/**
 * Pending API requests to prevent duplicates
 */
const pendingRequests: Map<string, Promise<CodexUsageLimits | null>> = new Map();

/**
 * Cached auth data with mtime tracking
 */
let cachedAuth: { data: CodexAuthData; mtime: number } | null = null;

interface CodexAuthData {
  accessToken: string;
  accountId: string;
}

interface CodexApiResponse {
  plan_type: string;
  rate_limit: {
    allowed: boolean;
    limit_reached: boolean;
    primary_window: {
      used_percent: number;
      limit_window_seconds: number;
      reset_after_seconds: number;
      reset_at: number;
    } | null;
    secondary_window: {
      used_percent: number;
      limit_window_seconds: number;
      reset_after_seconds: number;
      reset_at: number;
    } | null;
  };
  credits: {
    has_credits: boolean;
    unlimited: boolean;
    balance: string;
  };
}

/**
 * Check if Codex CLI is installed
 */
export async function isCodexInstalled(): Promise<boolean> {
  try {
    await stat(CODEX_AUTH_PATH);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get Codex auth credentials from ~/.codex/auth.json
 */
async function getCodexAuth(): Promise<CodexAuthData | null> {
  try {
    const fileStat = await stat(CODEX_AUTH_PATH);

    // Use cached auth if file hasn't changed
    if (cachedAuth && cachedAuth.mtime === fileStat.mtimeMs) {
      return cachedAuth.data;
    }

    const raw = await readFile(CODEX_AUTH_PATH, 'utf-8');
    const json = JSON.parse(raw);

    const accessToken = json?.tokens?.access_token;
    const accountId = json?.tokens?.account_id;

    if (!accessToken || !accountId) {
      return null;
    }

    const data = { accessToken, accountId };
    cachedAuth = { data, mtime: fileStat.mtimeMs };
    return data;
  } catch {
    return null;
  }
}

/**
 * Get current Codex model from ~/.codex/config.toml
 */
export async function getCodexModel(): Promise<string | null> {
  try {
    const raw = await readFile(CODEX_CONFIG_PATH, 'utf-8');
    // Parse simple TOML: model = "value" or model = 'value'
    // Limitations: Only root-level keys supported, no sections [section], no escaped quotes
    // Falls back to null (displayed as "unknown") on parse failure
    const match = raw.match(/^model\s*=\s*["']([^"']+)["']\s*(?:#.*)?$/m);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Fetch Codex usage limits
 */
export async function fetchCodexUsage(ttlSeconds: number = 60): Promise<CodexUsageLimits | null> {
  const auth = await getCodexAuth();
  if (!auth) {
    return null;
  }

  const tokenHash = hashToken(auth.accessToken);

  // Check memory cache
  const cached = codexCacheMap.get(tokenHash);
  if (cached) {
    const ageSeconds = (Date.now() - cached.timestamp) / 1000;
    if (ageSeconds < ttlSeconds) {
      return cached.data;
    }
  }

  // Check pending request
  const pending = pendingRequests.get(tokenHash);
  if (pending) {
    return pending;
  }

  // Create new request
  const requestPromise = fetchFromCodexApi(auth);
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
async function fetchFromCodexApi(
  auth: CodexAuthData
): Promise<CodexUsageLimits | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    debugLog('codex', 'fetchFromCodexApi: starting...');

    const response = await fetch('https://chatgpt.com/backend-api/wham/usage', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': `claude-dashboard/${VERSION}`,
        'Authorization': `Bearer ${auth.accessToken}`,
        'ChatGPT-Account-Id': auth.accountId,
      },
      signal: controller.signal,
    });

    debugLog('codex', 'fetchFromCodexApi: response status', response.status);

    if (!response.ok) {
      debugLog('codex', 'fetchFromCodexApi: response not ok');
      return null;
    }

    const data: unknown = await response.json();

    // Validate API response structure
    if (!data || typeof data !== 'object') {
      debugLog('codex', 'fetchFromCodexApi: invalid response - not an object');
      return null;
    }
    if (!('rate_limit' in data) || !('plan_type' in data)) {
      debugLog('codex', 'fetchFromCodexApi: invalid response - missing required fields');
      return null;
    }
    if (typeof (data as any).rate_limit !== 'object' || (data as any).rate_limit === null) {
      debugLog('codex', 'fetchFromCodexApi: invalid response - rate_limit is not an object');
      return null;
    }

    const typedData = data as CodexApiResponse;
    debugLog('codex', 'fetchFromCodexApi: got data', typedData.plan_type);
    const model = await getCodexModel();

    const limits: CodexUsageLimits = {
      model: model ?? 'unknown',
      planType: typedData.plan_type,
      primary: typedData.rate_limit.primary_window
        ? {
            usedPercent: typedData.rate_limit.primary_window.used_percent,
            resetAt: typedData.rate_limit.primary_window.reset_at,
          }
        : null,
      secondary: typedData.rate_limit.secondary_window
        ? {
            usedPercent: typedData.rate_limit.secondary_window.used_percent,
            resetAt: typedData.rate_limit.secondary_window.reset_at,
          }
        : null,
    };

    // Update cache
    const tokenHash = hashToken(auth.accessToken);
    codexCacheMap.set(tokenHash, { data: limits, timestamp: Date.now() });
    debugLog('codex', 'fetchFromCodexApi: success', limits);

    return limits;
  } catch (err) {
    debugLog('codex', 'fetchFromCodexApi: error', err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Clear cache (for testing)
 */
export function clearCodexCache(): void {
  codexCacheMap.clear();
  cachedAuth = null;
}
