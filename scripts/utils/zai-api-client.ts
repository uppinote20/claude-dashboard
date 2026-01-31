/**
 * z.ai/ZHIPU API client
 * Fetches usage quota from z.ai or ZHIPU API
 */

import type { CacheEntry } from '../types.js';
import { isZaiProvider, getZaiApiBaseUrl } from './provider.js';
import { debugLog } from './debug.js';
import { hashToken } from './hash.js';

const API_TIMEOUT_MS = 5000;

/**
 * Convert value to safe percentage (0-100 range)
 */
function toSafePercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value * 100)));
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

  // Check memory cache
  const cached = zaiCacheMap.get(cacheKey);
  if (cached) {
    const ageSeconds = (Date.now() - cached.timestamp) / 1000;
    if (ageSeconds < ttlSeconds) {
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
    }
    return result;
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
      if (limit.type === 'TOKENS_LIMIT') {
        // Token usage: currentValue is used amount (0-1 fraction)
        if (limit.currentValue !== undefined) {
          tokensPercent = toSafePercent(limit.currentValue);
        }
        if (limit.nextResetTime !== undefined) {
          tokensResetAt = limit.nextResetTime;
        }
      } else if (limit.type === 'TIME_LIMIT') {
        // MCP usage: usage or currentValue field contains fraction (0-1)
        if (limit.usage !== undefined) {
          mcpPercent = toSafePercent(limit.usage);
        } else if (limit.currentValue !== undefined) {
          mcpPercent = toSafePercent(limit.currentValue);
        }
        if (limit.nextResetTime !== undefined) {
          mcpResetAt = limit.nextResetTime;
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
