/**
 * OAuth API client with three-tier caching
 * @handbook 4.1-three-tier-cache
 * @handbook 4.2-request-deduplication
 * @handbook 4.3-429-retry
 * @handbook 4.7-cross-process-file-cache
 * @handbook 7.1-common-api-pattern
 * @tested scripts/__tests__/api-client.test.ts
 */
import { execFile } from 'child_process';
import { NEGATIVE_CACHE_SECONDS, type UsageLimits, type CacheEntry } from '../types.js';
import { getCredentials } from './credentials.js';
import { hashToken } from './hash.js';
import { VERSION } from '../version.js';
import { debugLog } from './debug.js';
import {
  loadFileCache as loadFileCacheGeneric,
  saveFileCache as saveFileCacheGeneric,
  fileCachePath,
  STALE_CACHE_TTL_SECONDS,
} from './file-cache.js';

const API_URL = 'https://api.anthropic.com/api/oauth/usage';
const API_TIMEOUT_MS = 5000;
const MAX_RETRY_AFTER_MS = 10000;
const STALE_FALLBACK_SECONDS = STALE_CACHE_TTL_SECONDS;

/**
 * In-memory cache Map: tokenHash -> CacheEntry
 */
const usageCacheMap: Map<string, CacheEntry<UsageLimits>> = new Map();

/**
 * Pending API requests Map: tokenHash -> Promise
 * Prevents duplicate concurrent requests for the same token
 */
const pendingRequests: Map<string, Promise<UsageLimits | null>> = new Map();

/**
 * Last used token hash for fallback when credentials are unavailable
 */
let lastTokenHash: string | null = null;

/**
 * Get cache file path for a specific token hash.
 * Delegates path composition to the shared file-cache utility.
 */
function getCacheFilePath(tokenHash: string): string {
  return fileCachePath(`cache-${tokenHash}.json`);
}

/**
 * Check if cache is still valid for given token.
 * Error entries use a shorter TTL (NEGATIVE_CACHE_SECONDS) to allow
 * retries after a brief cooldown, while preventing rapid-fire API calls.
 */
function isCacheValid(tokenHash: string, ttlSeconds: number): boolean {
  const cache = usageCacheMap.get(tokenHash);
  if (!cache) return false;
  const ageSeconds = (Date.now() - cache.timestamp) / 1000;
  const effectiveTtl = cache.isError ? NEGATIVE_CACHE_SECONDS : ttlSeconds;
  return ageSeconds < effectiveTtl;
}

/**
 * Fetch usage limits from Anthropic API
 *
 * @param ttlSeconds - Cache TTL in seconds (default: 300)
 * @returns Usage limits or null if failed
 */
export async function fetchUsageLimits(ttlSeconds: number = 300): Promise<UsageLimits | null> {
  // Get token first to determine cache key
  const token = await getCredentials();

  // Credential lookup failed - try to return cached data with last known token
  if (!token) {
    if (lastTokenHash) {
      const cached = usageCacheMap.get(lastTokenHash);
      if (cached && !cached.isError) return cached.data;

      const fileCache = await loadFileCache(lastTokenHash, STALE_FALLBACK_SECONDS);
      if (fileCache) return fileCache;
    }
    return null;
  }

  const tokenHash = hashToken(token);
  lastTokenHash = tokenHash;

  // Check memory cache first (includes negative cache entries)
  if (isCacheValid(tokenHash, ttlSeconds)) {
    const cached = usageCacheMap.get(tokenHash);
    if (cached) {
      if (cached.isError) {
        debugLog('api', 'Negative cache hit, returning stale or null');
        return loadFileCache(tokenHash, STALE_FALLBACK_SECONDS);
      }
      return cached.data;
    }
  }

  // Try to load from file cache (for persistence across calls)
  const fileCacheRaw = await loadFileCacheRaw(tokenHash, ttlSeconds);
  if (fileCacheRaw) {
    usageCacheMap.set(tokenHash, { data: fileCacheRaw.data, timestamp: fileCacheRaw.timestamp });
    return fileCacheRaw.data;
  }

  // Check if there's already a pending request for this token
  const pending = pendingRequests.get(tokenHash);
  if (pending) {
    return pending;
  }

  // Create new API request
  const requestPromise = fetchFromApi(token, tokenHash);
  pendingRequests.set(tokenHash, requestPromise);

  try {
    const result = await requestPromise;
    if (result) return result;

    // Save stale reference before overwriting with negative cache
    const staleMemory = usageCacheMap.get(tokenHash);

    // API failed - set negative cache to prevent rapid retries
    debugLog('api', `Setting negative cache for ${NEGATIVE_CACHE_SECONDS}s`);
    usageCacheMap.set(tokenHash, {
      data: null,
      timestamp: Date.now(),
      isError: true,
    });

    // Fall back to stale cache
    if (staleMemory && !staleMemory.isError) return staleMemory.data;

    const staleFile = await loadFileCache(tokenHash, STALE_FALLBACK_SECONDS);
    if (staleFile) return staleFile;

    return null;
  } finally {
    pendingRequests.delete(tokenHash);
  }
}

/**
 * Make a single API request using Node.js fetch
 */
async function makeRequest(token: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    return await fetch(API_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': `claude-dashboard/${VERSION}`,
        Authorization: `Bearer ${token}`,
        'anthropic-beta': 'oauth-2025-04-20',
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fallback API request using curl subprocess.
 *
 * Some environments (e.g. Node.js 20+ on Linux) get HTTP 403 from
 * Anthropic's OAuth usage endpoint due to TLS fingerprint differences
 * between Node's built-in HTTP client (undici) and standard clients
 * like curl/wget/Python. This fallback uses curl as a subprocess to
 * work around the issue.
 */
async function makeRequestViaCurl(token: string): Promise<{ ok: boolean; status: number; data: unknown } | null> {
  return new Promise((resolve) => {
    const child = execFile(
      'curl',
      [
        '-s',
        '-w', '\n%{http_code}',
        API_URL,
        '-H', 'Accept: application/json',
        '-H', `User-Agent: claude-dashboard/${VERSION}`,
        '-H', `Authorization: Bearer ${token}`,
        '-H', 'anthropic-beta: oauth-2025-04-20',
      ],
      { encoding: 'utf-8', timeout: API_TIMEOUT_MS },
      (error, stdout) => {
        if (error) {
          debugLog('api', 'curl fallback failed', error);
          resolve(null);
          return;
        }
        try {
          const lines = stdout.trimEnd().split('\n');
          const statusCode = parseInt(lines[lines.length - 1], 10);
          const body = lines.slice(0, -1).join('\n');
          const data = JSON.parse(body);
          resolve({ ok: statusCode >= 200 && statusCode < 300, status: statusCode, data });
        } catch {
          debugLog('api', 'curl response parse failed');
          resolve(null);
        }
      }
    );

    // Ensure child process is cleaned up on timeout
    child.on('error', () => resolve(null));
  });
}

/**
 * Internal function to fetch from API with single retry on 429
 * and curl fallback on 403 (TLS fingerprint rejection)
 */
async function fetchFromApi(token: string, tokenHash: string): Promise<UsageLimits | null> {
  try {
    let response = await makeRequest(token);

    // Retry once on 429 if retry-after is short enough
    if (response.status === 429) {
      const retryAfterHeader = response.headers.get('retry-after');
      if (retryAfterHeader === null) {
        debugLog('api', '429 received, no retry-after header, skipping');
      } else {
        const retryAfter = parseInt(retryAfterHeader, 10);
        if (!isNaN(retryAfter) && retryAfter * 1000 <= MAX_RETRY_AFTER_MS) {
          debugLog('api', `429 received, retrying after ${retryAfter}s`);
          await new Promise((r) => setTimeout(r, retryAfter * 1000));
          response = await makeRequest(token);
        } else {
          debugLog('api', `429 received, retry-after ${retryAfter}s exceeds limit, skipping`);
        }
      }
    }

    // On 403, Node's TLS fingerprint may be rejected — fall back to curl
    if (response.status === 403) {
      debugLog('api', '403 from fetch, trying curl fallback');
      const curlResult = await makeRequestViaCurl(token);
      if (curlResult?.ok) {
        return parseAndCacheLimits(curlResult.data, tokenHash);
      }
      debugLog('api', `curl fallback ${curlResult ? `returned ${curlResult.status}` : 'failed'}`);
      return null;
    }

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return parseAndCacheLimits(data, tokenHash);
  } catch (error) {
    debugLog('api', 'Request failed', error);
    return null;
  }
}

/**
 * Validate a single rate limit window from API response.
 * Returns a valid window object or null.
 */
function validateLimitWindow(
  raw: unknown
): { utilization: number; resets_at: string | null } | null {
  if (!raw || typeof raw !== 'object') return null;
  const w = raw as Record<string, unknown>;
  if (typeof w.utilization !== 'number') return null;
  return {
    utilization: w.utilization,
    resets_at: typeof w.resets_at === 'string' ? w.resets_at : null,
  };
}

/**
 * Find a model-scoped weekly limit in the API's `limits[]` array.
 *
 * Newer models (e.g. Fable) don't get a dedicated flat field like
 * `seven_day_sonnet` — their weekly cap only appears as an entry in the
 * generic `limits[]` array, self-described via `scope.model.display_name`:
 * `{ kind: 'weekly_scoped', percent, resets_at, scope: { model: { display_name } } }`.
 */
function findWeeklyScopedLimit(
  limits: unknown,
  modelDisplayName: string
): { utilization: number; resets_at: string | null } | null {
  if (!Array.isArray(limits)) return null;

  const entry = limits.find((raw) => {
    if (!raw || typeof raw !== 'object') return false;
    const l = raw as { kind?: unknown; scope?: { model?: { display_name?: unknown } } };
    return l.kind === 'weekly_scoped' && l.scope?.model?.display_name === modelDisplayName;
  }) as { percent?: unknown; resets_at?: unknown } | undefined;

  if (!entry) return null;
  // Reuse validateLimitWindow for shape/normalization; the array's source key is `percent`.
  return validateLimitWindow({ utilization: entry.percent, resets_at: entry.resets_at });
}

/**
 * Parse API response and update caches
 */
async function parseAndCacheLimits(data: unknown, tokenHash: string): Promise<UsageLimits> {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const limits: UsageLimits = {
    five_hour: validateLimitWindow(d.five_hour),
    seven_day: validateLimitWindow(d.seven_day),
    seven_day_sonnet: validateLimitWindow(d.seven_day_sonnet),
    // New models expose their weekly cap only via limits[] (findWeeklyScopedLimit), not a flat field.
    seven_day_fable: findWeeklyScopedLimit(d.limits, 'Fable'),
  };

  usageCacheMap.set(tokenHash, { data: limits, timestamp: Date.now() });
  await saveFileCache(tokenHash, limits);

  return limits;
}

/**
 * Load raw cache content from file (includes timestamp)
 */
async function loadFileCacheRaw(
  tokenHash: string,
  ttlSeconds: number
): Promise<{ data: UsageLimits; timestamp: number } | null> {
  return loadFileCacheGeneric<UsageLimits>(getCacheFilePath(tokenHash), ttlSeconds);
}

/**
 * Load cache from file for specific token
 */
async function loadFileCache(tokenHash: string, ttlSeconds: number): Promise<UsageLimits | null> {
  const raw = await loadFileCacheRaw(tokenHash, ttlSeconds);
  return raw?.data ?? null;
}

/**
 * Save cache to file for specific token.
 * The shared utility handles cleanup of all known cache prefixes,
 * so callers don't need to schedule it separately.
 */
async function saveFileCache(tokenHash: string, data: UsageLimits): Promise<void> {
  await saveFileCacheGeneric(getCacheFilePath(tokenHash), data);
}

/**
 * Clear in-memory cache (useful for testing)
 */
export function clearCache(): void {
  usageCacheMap.clear();
}

