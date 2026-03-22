/**
 * z.ai/ZHIPU API client
 * Fetches usage quota from z.ai or ZHIPU API
 * @handbook 7.1-common-api-pattern
 * @handbook 4.2-request-deduplication
 * @tested scripts/__tests__/zai-api-client.test.ts
 */

import { NEGATIVE_CACHE_SECONDS, type CacheEntry } from '../types.js';
import { isZaiProvider, getZaiApiBaseUrl } from './provider.js';
import { debugLog } from './debug.js';
import { hashToken } from './hash.js';
import { clampPercent } from './formatters.js';

// Re-export for backward compatibility (used by tests)
export { clampPercent };

const API_TIMEOUT_MS = 5000;

/**
 * Calculate usage percentage from current value and remaining
 * Returns null if total is zero (to avoid division by zero)
 */
export function calculateUsagePercent(currentValue: number, remaining: number): number | null {
  const total = currentValue + remaining;
  if (total <= 0) {
    return null;
  }
  return clampPercent((currentValue / total) * 100);
}

/**
 * Parse usage percentage from a limit object
 * Priority: percentage > currentValue/remaining > currentValue/usage
 *
 * Note: `usage` field is the total limit (not percentage), per CodexBar reference impl:
 * - usage: total limit (한도)
 * - currentValue: current usage amount
 * - remaining: remaining amount
 * - percentage: API-returned percentage (0-100)
 */
export function parseUsagePercent(limit: {
  percentage?: number;
  usage?: number;  // usage = total limit, NOT percentage
  currentValue?: number;
  remaining?: number;
}): number | null {
  // 1. Prefer direct percentage field
  if (limit.percentage !== undefined) {
    return clampPercent(limit.percentage);
  }

  // 2. Calculate from currentValue and remaining
  if (limit.currentValue !== undefined && limit.remaining !== undefined) {
    return calculateUsagePercent(limit.currentValue, limit.remaining);
  }

  // 3. Calculate from currentValue and usage (usage = total limit)
  if (limit.currentValue !== undefined && limit.usage !== undefined && limit.usage > 0) {
    return clampPercent((limit.currentValue / limit.usage) * 100);
  }

  return null;
}

/**
 * z.ai usage limits data
 */
export interface ZaiUsageLimits {
  /** Current model name (extracted from display_name) */
  model: string;
  /** 5-hour token usage percentage (0-100) */
  tokensPercent: number | null;
  /** Token limit reset time (ms since epoch) */
  tokensResetAt: number | null;
  /** Monthly MCP usage percentage (0-100) */
  mcpPercent: number | null;
  /** MCP limit reset time (ms since epoch) */
  mcpResetAt: number | null;
}

/**
 * z.ai quota API response structure
 */
interface ZaiQuotaResponse {
  data?: {
    limits?: Array<{
      type: string;
      usage?: number;
      currentValue?: number;
      remaining?: number;
      percentage?: number;
      nextResetTime?: number;
    }>;
  };
}

/**
 * In-memory cache for z.ai usage
 */
const zaiCacheMap: Map<string, CacheEntry<ZaiUsageLimits>> = new Map();

/**
 * Pending API requests to prevent duplicates
 */
const pendingRequests: Map<string, Promise<ZaiUsageLimits | null>> = new Map();

/**
 * Check if z.ai API is available
 */
export function isZaiInstalled(): boolean {
  return isZaiProvider() && !!getZaiApiBaseUrl() && !!getZaiAuthToken();
}

/**
 * Get auth token from environment
 */
function getZaiAuthToken(): string | null {
  return process.env.ANTHROPIC_AUTH_TOKEN || null;
}

/**
 * Fetch z.ai usage limits
 */
export async function fetchZaiUsage(ttlSeconds: number = 60): Promise<ZaiUsageLimits | null> {
  if (!isZaiProvider()) {
    debugLog('zai', 'fetchZaiUsage: not a z.ai provider');
    return null;
  }

  const baseUrl = getZaiApiBaseUrl();
  const authToken = getZaiAuthToken();

  if (!baseUrl || !authToken) {
    debugLog('zai', 'fetchZaiUsage: missing base URL or auth token');
    return null;
  }

  // Use base URL + token hash as cache key (supports multi-account)
  const tokenHash = hashToken(authToken);
  const cacheKey = `${baseUrl}:${tokenHash}`;

  // Check memory cache (includes negative cache entries)
  const cached = zaiCacheMap.get(cacheKey);
  if (cached) {
    const ageSeconds = (Date.now() - cached.timestamp) / 1000;
    const effectiveTtl = cached.isError ? NEGATIVE_CACHE_SECONDS : ttlSeconds;
    if (ageSeconds < effectiveTtl) {
      if (cached.isError) {
        debugLog('zai', 'Negative cache hit, skipping API call');
        return null;
      }
      debugLog('zai', 'fetchZaiUsage: returning cached data');
      return cached.data;
    }
  }

  // Check pending request
  const pending = pendingRequests.get(cacheKey);
  if (pending) {
    return pending;
  }

  // Create new request
  const requestPromise = fetchFromZaiApi(baseUrl, authToken);
  pendingRequests.set(cacheKey, requestPromise);

  try {
    const result = await requestPromise;
    if (result) {
      zaiCacheMap.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    }

    // API failed - set negative cache to prevent rapid retries
    debugLog('zai', `Setting negative cache for ${NEGATIVE_CACHE_SECONDS}s`);
    zaiCacheMap.set(cacheKey, {
      data: null,
      timestamp: Date.now(),
      isError: true,
    });

    // Fall back to stale cache
    if (cached && !cached.isError) {
      debugLog('zai', 'Returning stale cache data');
      return cached.data;
    }

    // No file cache available for z.ai — return null
    return null;
  } finally {
    pendingRequests.delete(cacheKey);
  }
}

/**
 * Internal API fetch
 */
async function fetchFromZaiApi(
  baseUrl: string,
  authToken: string
): Promise<ZaiUsageLimits | null> {
  try {
    debugLog('zai', 'fetchFromZaiApi: starting...');

    const url = `${baseUrl}/api/monitor/usage/quota/limit`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });

    debugLog('zai', 'fetchFromZaiApi: response status', response.status);

    if (!response.ok) {
      debugLog('zai', 'fetchFromZaiApi: response not ok');
      return null;
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      debugLog('zai', 'fetchFromZaiApi: invalid JSON response');
      return null;
    }

    // Validate response structure
    if (!data || typeof data !== 'object') {
      debugLog('zai', 'fetchFromZaiApi: invalid response - not an object');
      return null;
    }

    const typedData = data as ZaiQuotaResponse;
    const limits = typedData.data?.limits;

    if (!limits || !Array.isArray(limits)) {
      debugLog('zai', 'fetchFromZaiApi: no limits array');
      return null;
    }

    debugLog('zai', `fetchFromZaiApi: got ${limits.length} limits`);

    // Parse limits
    let tokensPercent: number | null = null;
    let tokensResetAt: number | null = null;
    let mcpPercent: number | null = null;
    let mcpResetAt: number | null = null;

    for (const limit of limits) {
      const resetTime = limit.nextResetTime;

      if (limit.type === 'TOKENS_LIMIT') {
        tokensPercent = parseUsagePercent(limit);
        if (resetTime !== undefined) {
          tokensResetAt = resetTime;
        }
      } else if (limit.type === 'TIME_LIMIT') {
        mcpPercent = parseUsagePercent(limit);
        if (resetTime !== undefined) {
          mcpResetAt = resetTime;
        }
      }
    }

    const result: ZaiUsageLimits = {
      model: 'GLM',
      tokensPercent,
      tokensResetAt,
      mcpPercent,
      mcpResetAt,
    };

    debugLog('zai', 'fetchFromZaiApi: success', result);
    return result;
  } catch (err) {
    debugLog('zai', 'fetchFromZaiApi: error', err);
    return null;
  }
}

/**
 * Clear cache (for testing)
 */
export function clearZaiCache(): void {
  zaiCacheMap.clear();
  pendingRequests.clear();
}
