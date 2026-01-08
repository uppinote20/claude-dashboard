import { readFile, writeFile, mkdir, readdir, stat, unlink } from 'fs/promises';
import os from 'os';
import path from 'path';
import type { UsageLimits, CacheEntry } from '../types.js';
import { getCredentials } from './credentials.js';
import { hashToken } from './hash.js';
import { VERSION } from '../version.js';

const API_TIMEOUT_MS = 5000;
const CACHE_DIR = path.join(os.homedir(), '.cache', 'claude-dashboard');
const CACHE_MAX_AGE_SECONDS = 3600; // 1 hour - cleanup files older than this
const CLEANUP_INTERVAL_MS = 3600000; // 1 hour - minimum interval between cleanups

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
 * Last cleanup timestamp for time-based throttling
 */
let lastCleanupTime = 0;

/**
 * Ensure cache directory exists with secure permissions
 */
async function ensureCacheDir(): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true, mode: 0o700 });
  } catch {
    // Directory may already exist or creation failed
  }
}

/**
 * Get cache file path for a specific token hash
 */
function getCacheFilePath(tokenHash: string): string {
  return path.join(CACHE_DIR, `cache-${tokenHash}.json`);
}

/**
 * Check if cache is still valid for given token
 */
function isCacheValid(tokenHash: string, ttlSeconds: number): boolean {
  const cache = usageCacheMap.get(tokenHash);
  if (!cache) return false;
  const ageSeconds = (Date.now() - cache.timestamp) / 1000;
  return ageSeconds < ttlSeconds;
}

/**
 * Fetch usage limits from Anthropic API
 *
 * @param ttlSeconds - Cache TTL in seconds (default: 60)
 * @returns Usage limits or null if failed
 */
export async function fetchUsageLimits(ttlSeconds: number = 60): Promise<UsageLimits | null> {
  // Get token first to determine cache key
  const token = await getCredentials();

  // Credential lookup failed - try to return cached data with last known token
  if (!token) {
    if (lastTokenHash) {
      const cached = usageCacheMap.get(lastTokenHash);
      if (cached) return cached.data;

      const fileCache = await loadFileCache(lastTokenHash, ttlSeconds * 10); // Extended TTL for fallback
      if (fileCache) return fileCache;
    }
    return null;
  }

  const tokenHash = hashToken(token);
  lastTokenHash = tokenHash;

  // Check memory cache first
  if (isCacheValid(tokenHash, ttlSeconds)) {
    const cached = usageCacheMap.get(tokenHash);
    if (cached) return cached.data;
  }

  // Try to load from file cache (for persistence across calls)
  const fileCache = await loadFileCache(tokenHash, ttlSeconds);
  if (fileCache) {
    usageCacheMap.set(tokenHash, { data: fileCache, timestamp: Date.now() });
    return fileCache;
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
    return await requestPromise;
  } finally {
    pendingRequests.delete(tokenHash);
  }
}

/**
 * Internal function to fetch from API
 */
async function fetchFromApi(token: string, tokenHash: string): Promise<UsageLimits | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    const response = await fetch('https://api.anthropic.com/api/oauth/usage', {
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

    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    const limits: UsageLimits = {
      five_hour: data.five_hour ?? null,
      seven_day: data.seven_day ?? null,
      seven_day_sonnet: data.seven_day_sonnet ?? null,
    };

    // Update caches
    usageCacheMap.set(tokenHash, { data: limits, timestamp: Date.now() });
    await saveFileCache(tokenHash, limits);

    return limits;
  } catch {
    return null;
  }
}

/**
 * Load cache from file for specific token
 */
async function loadFileCache(tokenHash: string, ttlSeconds: number): Promise<UsageLimits | null> {
  try {
    const cacheFile = getCacheFilePath(tokenHash);
    const raw = await readFile(cacheFile, 'utf-8');
    const content = JSON.parse(raw);
    const ageSeconds = (Date.now() - content.timestamp) / 1000;

    if (ageSeconds < ttlSeconds) {
      return content.data as UsageLimits;
    }
    return null;
  } catch {
    // File doesn't exist or parse failed
    return null;
  }
}

/**
 * Save cache to file for specific token
 */
async function saveFileCache(tokenHash: string, data: UsageLimits): Promise<void> {
  try {
    await ensureCacheDir();
    const cacheFile = getCacheFilePath(tokenHash);
    await writeFile(
      cacheFile,
      JSON.stringify({
        data,
        timestamp: Date.now(),
      }),
      { mode: 0o600 }
    );

    // Probabilistically clean up old cache files (fire-and-forget)
    cleanupExpiredCache().catch(() => {});
  } catch {
    // Ignore cache write errors
  }
}

/**
 * Clear in-memory cache (useful for testing)
 */
export function clearCache(): void {
  usageCacheMap.clear();
}

/**
 * Clean up expired cache files from disk
 * Runs at most once per hour (time-based throttling)
 */
async function cleanupExpiredCache(): Promise<void> {
  const now = Date.now();

  // Skip if last cleanup was less than 1 hour ago
  if (now - lastCleanupTime < CLEANUP_INTERVAL_MS) {
    return;
  }
  lastCleanupTime = now;

  try {
    const files = await readdir(CACHE_DIR);

    for (const file of files) {
      if (!file.startsWith('cache-') || !file.endsWith('.json')) {
        continue;
      }

      const filePath = path.join(CACHE_DIR, file);

      try {
        const fileStat = await stat(filePath);
        const ageSeconds = (now - fileStat.mtimeMs) / 1000;

        if (ageSeconds > CACHE_MAX_AGE_SECONDS) {
          await unlink(filePath);
        }
      } catch {
        // Ignore individual file errors
      }
    }
  } catch {
    // Ignore cleanup errors (directory might not exist yet)
  }
}
