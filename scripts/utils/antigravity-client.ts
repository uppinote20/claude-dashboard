/**
 * Antigravity CLI API client
 * Fetches usage limits from the Google Code Assist API. Quota comes from the
 * per-model `quotaInfo` in fetchAvailableModels — the first-party
 * retrieveUserQuotaSummary RPC rejects third-party callers with 403 (#78).
 * @handbook 7.1-common-api-pattern
 * @handbook 4.2-request-deduplication
 * @handbook 4.4-credential-caching
 * @handbook 4.7-cross-process-file-cache
 * @tested scripts/__tests__/antigravity-client.test.ts
 */

import { readFile, stat } from 'fs/promises';
import os from 'os';
import path from 'path';
import { NEGATIVE_CACHE_SECONDS, type AntigravityUsageLimits, type CacheEntry } from '../types.js';
import { hashToken } from './hash.js';
import {
  loadFileCache,
  saveFileCache,
  fileCachePath,
  STALE_CACHE_TTL_SECONDS,
} from './file-cache.js';
import { clampPercent } from './formatters.js';
import { debugLog } from './debug.js';

const API_TIMEOUT_MS = 5000;
const ANTIGRAVITY_DIR = path.join('.gemini', 'antigravity-cli');
const OAUTH_TOKEN_FILE = 'antigravity-oauth-token';
const SETTINGS_FILE = 'settings.json';

const CODE_ASSIST_ENDPOINT = 'https://cloudcode-pa.googleapis.com';
const CODE_ASSIST_API_VERSION = 'v1internal';
/** Metadata agy itself sends; the API routes tier/quota lookups by ideType */
const CODE_ASSIST_METADATA = {
  ideType: 'ANTIGRAVITY',
  platform: 'PLATFORM_UNSPECIFIED',
  pluginType: 'GEMINI',
};
const USER_AGENT = 'antigravity';

// Google OAuth endpoint and Antigravity's OAuth client credentials
// Note: Client secret is safe to embed per Google's installed app guidelines
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const OAUTH_CLIENT_ID = '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com';
const OAUTH_CLIENT_SECRET = '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'; // gitleaks:allow

// Token refresh buffer (refresh 5 minutes before expiry)
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

/**
 * In-memory cache for Antigravity usage
 */
const antigravityCacheMap: Map<string, CacheEntry<AntigravityUsageLimits>> = new Map();

/**
 * In-flight usage fetch shared by concurrent widgets in the same process.
 * Dedups the whole flow (credential read + cache probes + network), not just
 * the network call — both antigravity widgets consume the same limits object.
 */
let inFlightFetch: Promise<AntigravityUsageLimits | null> | null = null;

/**
 * Pending token refresh requests, keyed by refresh-token hash
 */
const pendingRefreshRequests: Map<string, Promise<AntigravityCredentials | null>> = new Map();

/**
 * Memoized install check — the token file cannot appear mid-render
 */
let installedCheck: Promise<boolean> | null = null;

/**
 * Cached token-file credentials with mtime tracking
 */
let cachedCredentials: { data: AntigravityCredentials; mtime: number } | null = null;

/**
 * Cached settings with mtime tracking
 */
let cachedSettings: { data: AntigravitySettings; mtime: number } | null = null;

interface AntigravityCredentials {
  accessToken: string;
  refreshToken?: string;
  /** Epoch ms */
  expiryDate?: number;
}

interface AntigravitySettings {
  model?: string;
}

interface LoadCodeAssistResponse {
  cloudaicompanionProject?: string | { id?: string } | null;
  planInfo?: {
    planType?: string;
  };
}

interface QuotaInfo {
  remainingFraction?: number;
  resetTime?: string;
  isExhausted?: boolean;
}

interface ModelInfo {
  displayName?: string;
  quotaInfo?: QuotaInfo;
}

interface FetchAvailableModelsResponse {
  models?: Record<string, ModelInfo>;
}

/**
 * Get Antigravity token file path
 */
function getTokenPath(): string {
  return path.join(os.homedir(), ANTIGRAVITY_DIR, OAUTH_TOKEN_FILE);
}

/**
 * Check if Antigravity CLI is installed (has a credential file)
 */
export function isAntigravityInstalled(): Promise<boolean> {
  installedCheck ??= stat(getTokenPath()).then(
    () => true,
    () => false
  );
  return installedCheck;
}

/**
 * Parse agy's RFC3339 expiry (Go time.Time, nanosecond precision) to epoch ms
 */
function parseExpiry(expiry: unknown): number | undefined {
  if (typeof expiry !== 'string') {
    return undefined;
  }
  let ms = Date.parse(expiry);
  if (Number.isNaN(ms)) {
    // Fractional seconds beyond milliseconds can trip stricter parsers
    ms = Date.parse(expiry.replace(/\.(\d{3})\d+/, '.$1'));
  }
  return Number.isNaN(ms) ? undefined : ms;
}

/**
 * Read agy's OAuth token file (nested Go oauth2.Token shape)
 */
async function getCredentialsFromFile(): Promise<AntigravityCredentials | null> {
  try {
    const tokenPath = getTokenPath();
    const fileStat = await stat(tokenPath);

    // Use cached credentials if file hasn't changed
    if (cachedCredentials && cachedCredentials.mtime === fileStat.mtimeMs) {
      return cachedCredentials.data;
    }

    const raw = await readFile(tokenPath, 'utf-8');
    const json = JSON.parse(raw);

    const accessToken = json?.token?.access_token;
    if (!accessToken) {
      return null;
    }

    const data: AntigravityCredentials = {
      accessToken,
      refreshToken: json?.token?.refresh_token,
      expiryDate: parseExpiry(json?.token?.expiry),
    };

    cachedCredentials = { data, mtime: fileStat.mtimeMs };
    return data;
  } catch {
    return null;
  }
}

/**
 * Check if token needs refresh (expired or expiring soon)
 */
function tokenNeedsRefresh(credentials: AntigravityCredentials): boolean {
  if (!credentials.expiryDate) {
    return false; // No expiry info, assume valid
  }
  return credentials.expiryDate < (Date.now() + TOKEN_REFRESH_BUFFER_MS);
}

/**
 * Stable per-account cache key. Access tokens rotate on every refresh, so
 * keying caches by them would miss on each rotation and leave orphaned files;
 * the refresh token stays put for the life of the grant.
 */
function accountKeyFor(credentials: AntigravityCredentials): string {
  return hashToken(credentials.refreshToken ?? credentials.accessToken);
}

/**
 * Cross-process cache path for refreshed access tokens
 */
function refreshedTokenCachePath(accountKey: string): string {
  return fileCachePath(`antigravity-token-${accountKey}.json`);
}

interface RefreshedTokenCache {
  accessToken?: string;
  expiryDate?: number;
  /** Set when the last refresh attempt failed — cross-process retry backoff */
  refreshFailedAt?: number;
}

/**
 * Reuse a previously refreshed access token from the cross-process file cache.
 * Statusline renders spawn a fresh process each time, so refresh backoff must
 * live in the file cache — returns 'backoff' while it is active.
 */
async function getCachedRefreshedCredentials(
  refreshTokenValue: string,
  accountKey: string
): Promise<AntigravityCredentials | 'backoff' | null> {
  const fromFile = await loadFileCache<RefreshedTokenCache>(
    refreshedTokenCachePath(accountKey),
    STALE_CACHE_TTL_SECONDS
  );
  if (!fromFile?.data) {
    return null;
  }
  if (
    fromFile.data.refreshFailedAt !== undefined &&
    (Date.now() - fromFile.data.refreshFailedAt) / 1000 < NEGATIVE_CACHE_SECONDS
  ) {
    debugLog('antigravity', 'refresh backoff active, skipping refresh attempt');
    return 'backoff';
  }
  if (!fromFile.data.accessToken) {
    return null;
  }

  const creds: AntigravityCredentials = {
    accessToken: fromFile.data.accessToken,
    refreshToken: refreshTokenValue,
    expiryDate: fromFile.data.expiryDate,
  };
  return tokenNeedsRefresh(creds) ? null : creds;
}

/**
 * Persist a refresh failure marker for cross-process backoff
 */
async function recordRefreshFailure(accountKey: string): Promise<void> {
  await saveFileCache(refreshedTokenCachePath(accountKey), {
    refreshFailedAt: Date.now(),
  });
}

/**
 * Internal refresh implementation. The refreshed token is kept in our own
 * cache only — agy's credential file is never written back (a foreign writer
 * could corrupt what the closed-source CLI expects).
 */
async function refreshTokenInternal(
  refreshTokenValue: string,
  accountKey: string
): Promise<AntigravityCredentials | null> {
  try {
    debugLog('antigravity', 'refreshTokenInternal: attempting refresh...');

    const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshTokenValue,
        client_id: OAUTH_CLIENT_ID,
        client_secret: OAUTH_CLIENT_SECRET,
      }),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });

    if (!response.ok) {
      debugLog('antigravity', 'refreshTokenInternal: failed', response.status);
      return null;
    }

    const data = await response.json();

    if (!data.access_token) {
      debugLog('antigravity', 'refreshTokenInternal: no access_token in response');
      return null;
    }

    // Google always sends a numeric expires_in, but a missing/NaN value would
    // make tokenNeedsRefresh() treat the token as valid forever
    const expiresInMs = typeof data.expires_in === 'number' && Number.isFinite(data.expires_in)
      ? data.expires_in * 1000
      : 3_600_000;

    const newCredentials: AntigravityCredentials = {
      accessToken: data.access_token,
      refreshToken: refreshTokenValue,
      expiryDate: Date.now() + expiresInMs,
    };

    await saveFileCache(refreshedTokenCachePath(accountKey), {
      accessToken: newCredentials.accessToken,
      expiryDate: newCredentials.expiryDate,
    });

    debugLog('antigravity', 'refreshTokenInternal: success');
    return newCredentials;
  } catch (err) {
    debugLog('antigravity', 'refreshTokenInternal: error', err);
    return null;
  }
}

/**
 * Refresh OAuth token with deduplication (per refresh-token hash).
 * A failed attempt persists the cross-process backoff marker.
 */
function refreshToken(
  refreshTokenValue: string,
  accountKey: string
): Promise<AntigravityCredentials | null> {
  const pending = pendingRefreshRequests.get(accountKey);
  if (pending) {
    debugLog('antigravity', 'refreshToken: using pending refresh request');
    return pending;
  }

  const refreshPromise = (async () => {
    const refreshed = await refreshTokenInternal(refreshTokenValue, accountKey);
    if (!refreshed) {
      await recordRefreshFailure(accountKey);
    }
    return refreshed;
  })().finally(() => {
    pendingRefreshRequests.delete(accountKey);
  });
  pendingRefreshRequests.set(accountKey, refreshPromise);

  return refreshPromise;
}

/**
 * Get valid credentials: fresh file token first (agy keeps it current while
 * in use), then a previously refreshed token, then a new refresh.
 */
async function getValidCredentials(
  fileCreds: AntigravityCredentials,
  accountKey: string
): Promise<AntigravityCredentials | null> {
  if (!tokenNeedsRefresh(fileCreds)) {
    return fileCreds;
  }

  if (!fileCreds.refreshToken) {
    debugLog('antigravity', 'getValidCredentials: token expired, no refresh token');
    return null;
  }

  const reused = await getCachedRefreshedCredentials(fileCreds.refreshToken, accountKey);
  if (reused === 'backoff') {
    return null;
  }
  if (reused) {
    return reused;
  }

  debugLog('antigravity', 'getValidCredentials: token expired, attempting refresh');
  return refreshToken(fileCreds.refreshToken, accountKey);
}

/**
 * Get agy settings from ~/.gemini/antigravity-cli/settings.json
 */
async function getAntigravitySettings(): Promise<AntigravitySettings | null> {
  try {
    const settingsPath = path.join(os.homedir(), ANTIGRAVITY_DIR, SETTINGS_FILE);
    const fileStat = await stat(settingsPath);

    if (cachedSettings && cachedSettings.mtime === fileStat.mtimeMs) {
      return cachedSettings.data;
    }

    const raw = await readFile(settingsPath, 'utf-8');
    const json = JSON.parse(raw);

    const data: AntigravitySettings = {
      model: typeof json?.model === 'string' ? json.model : undefined,
    };

    cachedSettings = { data, mtime: fileStat.mtimeMs };
    return data;
  } catch {
    return null;
  }
}

/**
 * Cached loadCodeAssist result (per account key for multi-account support).
 * Project id / plan type barely change, so the cross-process copy lives a day.
 * Its cache file is deliberately NOT in CLEANABLE_PREFIXES — the hourly sweep
 * would defeat the long TTL. One small file accumulates per account; users who
 * cycle through many accounts can clear ~/.cache/claude-dashboard by hand.
 */
interface ProjectMeta {
  projectId: string | null;
  planType?: string;
  /** Set when loadCodeAssist failed — suppresses retries for NEGATIVE_CACHE_SECONDS */
  failedAt?: number;
}
const projectMetaCacheMap: Map<string, { data: ProjectMeta; timestamp: number }> = new Map();
const PROJECT_META_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes (in-process)
const PROJECT_META_FILE_TTL_SECONDS = 86_400; // 1 day (cross-process)

/**
 * POST to a Code Assist v1internal RPC
 */
async function postCodeAssist(rpc: string, accessToken: string, body: unknown): Promise<Response> {
  return fetch(`${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}:${rpc}`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
}

/**
 * Resolve project id + plan type via loadCodeAssist.
 * cloudaicompanionProject may be a string or an { id } object.
 */
async function getProjectMeta(
  credentials: AntigravityCredentials,
  accountKey: string
): Promise<ProjectMeta> {
  const cacheFile = fileCachePath(`antigravity-project-${accountKey}.json`);

  // A failure entry is only honored for the short negative window
  const isUsable = (meta: ProjectMeta, timestamp: number): boolean =>
    meta.failedAt === undefined || (Date.now() - timestamp) / 1000 < NEGATIVE_CACHE_SECONDS;

  const cached = projectMetaCacheMap.get(accountKey);
  if (cached && (Date.now() - cached.timestamp) < PROJECT_META_CACHE_TTL_MS && isUsable(cached.data, cached.timestamp)) {
    return cached.data;
  }

  const fromFile = await loadFileCache<ProjectMeta>(cacheFile, PROJECT_META_FILE_TTL_SECONDS);
  if (fromFile && isUsable(fromFile.data, fromFile.timestamp)) {
    projectMetaCacheMap.set(accountKey, { data: fromFile.data, timestamp: fromFile.timestamp });
    return fromFile.data;
  }

  // Every failure path persists a marker so the next fresh process doesn't
  // immediately re-issue the RPC (renders spawn a new process each time)
  const failed = async (): Promise<ProjectMeta> => {
    const meta: ProjectMeta = { projectId: null, failedAt: Date.now() };
    projectMetaCacheMap.set(accountKey, { data: meta, timestamp: Date.now() });
    await saveFileCache(cacheFile, meta);
    return meta;
  };

  try {
    const response = await postCodeAssist('loadCodeAssist', credentials.accessToken, {
      metadata: CODE_ASSIST_METADATA,
    });

    if (!response.ok) {
      debugLog('antigravity', 'loadCodeAssist: response not ok', response.status);
      return failed();
    }

    const data = await response.json() as LoadCodeAssistResponse;
    const rawProject = data?.cloudaicompanionProject;
    const projectId = typeof rawProject === 'string' ? rawProject : rawProject?.id ?? null;

    const meta: ProjectMeta = { projectId, planType: data?.planInfo?.planType };
    projectMetaCacheMap.set(accountKey, { data: meta, timestamp: Date.now() });
    await saveFileCache(cacheFile, meta);
    return meta;
  } catch (err) {
    debugLog('antigravity', 'loadCodeAssist error:', err);
    return failed();
  }
}

/**
 * Internal/feature-specific model ids excluded from quota display
 */
function isExcludedModelId(modelId: string): boolean {
  // Delimiter-anchored so a future user-facing id like `revision-pro` survives
  if (modelId.startsWith('chat_') || modelId.startsWith('tab_') || modelId.startsWith('rev_')) {
    return true;
  }
  return modelId.includes('image') || modelId.includes('mquery') || modelId.includes('lite');
}

/**
 * remainingFraction is nominally a 0-1 fraction; defend against 0-100
 * percent-remaining responses by treating values > 1 as percentages.
 */
function usedPercentFrom(quota: QuotaInfo): number | null {
  const remaining = quota.remainingFraction;
  if (remaining === undefined) {
    return quota.isExhausted ? 100 : null;
  }
  const used = remaining <= 1 ? (1 - remaining) * 100 : 100 - remaining;
  return clampPercent(used);
}

/**
 * Family label matching agy's own quota grouping (weekly limit per family)
 */
function familyLabel(modelId: string, label: string): string {
  const haystack = `${modelId} ${label}`.toLowerCase();
  if (haystack.includes('gemini')) {
    return 'Gemini';
  }
  if (haystack.includes('claude') || haystack.includes('gpt')) {
    return 'Claude+GPT';
  }
  return label;
}

/**
 * Fetch Antigravity usage limits.
 * Concurrent same-process callers share one in-flight flow.
 */
export function fetchAntigravityUsage(ttlSeconds: number = 60): Promise<AntigravityUsageLimits | null> {
  inFlightFetch ??= fetchAntigravityUsageInternal(ttlSeconds).finally(() => {
    inFlightFetch = null;
  });
  return inFlightFetch;
}

async function fetchAntigravityUsageInternal(ttlSeconds: number): Promise<AntigravityUsageLimits | null> {
  // Caches are probed before credentials are validated: a failed refresh must
  // still be able to serve the usage fetched moments earlier
  const fileCreds = await getCredentialsFromFile();
  if (!fileCreds) {
    debugLog('antigravity', 'fetchAntigravityUsage: no credentials file');
    return null;
  }

  const accountKey = accountKeyFor(fileCreds);
  const cacheFile = fileCachePath(`antigravity-usage-${accountKey}.json`);
  const errCacheFile = fileCachePath(`antigravity-usage-err-${accountKey}.json`);

  // Check memory cache (includes negative cache entries)
  const cached = antigravityCacheMap.get(accountKey);
  if (cached) {
    const ageSeconds = (Date.now() - cached.timestamp) / 1000;
    const effectiveTtl = cached.isError ? NEGATIVE_CACHE_SECONDS : ttlSeconds;
    if (ageSeconds < effectiveTtl) {
      if (cached.isError) {
        debugLog('antigravity', 'Negative cache hit, skipping API call');
        return null;
      }
      debugLog('antigravity', 'fetchAntigravityUsage: returning cached data');
      return cached.data;
    }
  }

  // Single file-cache read serves both the fresh check and the stale fallback
  const fileEntry = await loadFileCache<AntigravityUsageLimits>(cacheFile, STALE_CACHE_TTL_SECONDS);
  if (fileEntry && (Date.now() - fileEntry.timestamp) / 1000 < ttlSeconds) {
    debugLog('antigravity', 'file cache hit');
    antigravityCacheMap.set(accountKey, { data: fileEntry.data, timestamp: fileEntry.timestamp });
    return fileEntry.data;
  }

  /** Best available stale data when a fresh fetch is impossible */
  const staleFallback = (): AntigravityUsageLimits | null => {
    if (cached && !cached.isError) {
      debugLog('antigravity', 'Returning stale cache data');
      return cached.data;
    }
    if (fileEntry) {
      debugLog('antigravity', 'stale file cache fallback');
      return fileEntry.data;
    }
    return null;
  };

  // Cross-process failure backoff — every render is a fresh process, so a
  // memory-only negative cache would retry the API on each render during an outage
  const errEntry = await loadFileCache<{ failedAt: number }>(errCacheFile, NEGATIVE_CACHE_SECONDS);
  if (errEntry) {
    debugLog('antigravity', 'cross-process negative cache hit, skipping API call');
    return staleFallback();
  }

  const credentials = await getValidCredentials(fileCreds, accountKey);
  if (!credentials) {
    debugLog('antigravity', 'fetchAntigravityUsage: no valid credentials, serving stale');
    return staleFallback();
  }

  const result = await fetchFromAntigravityApi(credentials, accountKey);
  if (result) {
    await saveFileCache(cacheFile, result);
    return result;
  }

  // API failed - set negative caches to prevent rapid retries
  debugLog('antigravity', `Setting negative cache for ${NEGATIVE_CACHE_SECONDS}s`);
  antigravityCacheMap.set(accountKey, {
    data: null,
    timestamp: Date.now(),
    isError: true,
  });
  await saveFileCache(errCacheFile, { failedAt: Date.now() });

  return staleFallback();
}

/**
 * Internal API fetch: quota from fetchAvailableModels per-model quotaInfo
 */
async function fetchFromAntigravityApi(
  credentials: AntigravityCredentials,
  accountKey: string
): Promise<AntigravityUsageLimits | null> {
  try {
    debugLog('antigravity', 'fetchFromAntigravityApi: starting...');

    // Settings read is local I/O — overlap it with the loadCodeAssist RTT
    const [meta, settings] = await Promise.all([
      getProjectMeta(credentials, accountKey),
      getAntigravitySettings(),
    ]);

    const response = await postCodeAssist(
      'fetchAvailableModels',
      credentials.accessToken,
      meta.projectId ? { project: meta.projectId } : {}
    );

    debugLog('antigravity', 'fetchAvailableModels: response status', response.status);

    if (!response.ok) {
      return null;
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      debugLog('antigravity', 'fetchAvailableModels: invalid JSON response');
      return null;
    }

    if (!data || typeof data !== 'object') {
      debugLog('antigravity', 'fetchAvailableModels: invalid response - not an object');
      return null;
    }

    const models = (data as FetchAvailableModelsResponse).models ?? {};

    const buckets: AntigravityUsageLimits['buckets'] = [];
    for (const [modelId, info] of Object.entries(models)) {
      if (!info.quotaInfo || isExcludedModelId(modelId)) {
        continue;
      }
      buckets.push({
        modelId,
        label: info.displayName || modelId,
        usedPercent: usedPercentFrom(info.quotaInfo),
        resetAt: info.quotaInfo.resetTime ?? null,
      });
    }

    // Collapse per-model buckets into family groups (worst member wins)
    const groupMap = new Map<string, AntigravityUsageLimits['groups'][number]>();
    for (const bucket of buckets) {
      const label = familyLabel(bucket.modelId, bucket.label);
      let group = groupMap.get(label);
      if (!group) {
        group = { label, usedPercent: null, resetAt: null };
        groupMap.set(label, group);
      }
      if (bucket.usedPercent !== null && (group.usedPercent === null || bucket.usedPercent > group.usedPercent)) {
        group.usedPercent = bucket.usedPercent;
      }
      // Earliest reset wins — deterministic regardless of API response order
      if (bucket.resetAt && (!group.resetAt || Date.parse(bucket.resetAt) < Date.parse(group.resetAt))) {
        group.resetAt = bucket.resetAt;
      }
    }

    // API response key order varies between calls — sort for a stable display
    buckets.sort((a, b) => a.label.localeCompare(b.label));

    const limits: AntigravityUsageLimits = {
      model: settings?.model,
      planType: meta.planType,
      groups: Array.from(groupMap.values()).sort((a, b) => a.label.localeCompare(b.label)),
      buckets,
    };

    // Update cache
    antigravityCacheMap.set(accountKey, { data: limits, timestamp: Date.now() });
    debugLog('antigravity', `fetchFromAntigravityApi: success, ${buckets.length} models / ${limits.groups.length} groups`);

    return limits;
  } catch (err) {
    debugLog('antigravity', 'fetchFromAntigravityApi: error', err);
    return null;
  }
}

/**
 * Clear cache (for testing)
 */
export function clearAntigravityCache(): void {
  antigravityCacheMap.clear();
  projectMetaCacheMap.clear();
  pendingRefreshRequests.clear();
  inFlightFetch = null;
  installedCheck = null;
  cachedCredentials = null;
  cachedSettings = null;
}
