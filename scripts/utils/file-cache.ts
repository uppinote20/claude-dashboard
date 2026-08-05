/**
 * Shared file-based cache for cross-process cache hits without locks.
 *
 * Pattern: a process that successfully fetches writes the result to a shared
 * file. Subsequent processes (or the same process after restart) read from the
 * file before issuing their own API call. No locking — the first writer wins,
 * concurrent writes are idempotent (last write wins on the same key).
 *
 * This narrows the stampede window from "every cache-miss" to "first cache-miss
 * per TTL window across all processes." Multi-session users no longer pay N×
 * API cost on every restart.
 *
 * @handbook 4.7-cross-process-file-cache
 * @tested scripts/__tests__/file-cache.test.ts
 */
import { readFile, writeFile, mkdir, readdir, stat, unlink } from 'fs/promises';
import os from 'os';
import path from 'path';
import { debugLog } from './debug.js';

export const FILE_CACHE_DIR = path.join(os.homedir(), '.cache', 'claude-dashboard');

/**
 * Default TTL for "stale-as-last-resort" reads when fresh fetch fails.
 * Callers use this when negative-caching an API failure but still want to
 * show *something* from the last successful run within this window.
 */
export const STALE_CACHE_TTL_SECONDS = 3600;

/**
 * Cleanup of cache files older than this is eligible for sweep.
 */
const CACHE_CLEANUP_AGE_SECONDS = 3600;

/**
 * Cleanup sweeps at most once per this interval (in-process throttle).
 */
const CLEANUP_INTERVAL_MS = 3_600_000;

/**
 * Allowed filename prefixes for cleanup sweep. New client-specific cache
 * categories must be added here (one entry per `{client}-usage-` family)
 * so accumulation does not silently outlast the TTL window.
 *
 * Files that don't match any prefix (e.g., `codex-model-cache.json`) are
 * left alone — they have their own invalidation rules.
 */
const CLEANABLE_PREFIXES = [
  'cache-',
  'codex-usage-',
  'gemini-usage-',
  'antigravity-usage-',
  'antigravity-token-',
  'zai-usage-',
];

let lastCleanupTime = 0;

interface FileCacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Resolve a cache file path relative to FILE_CACHE_DIR.
 *
 * Expects a plain filename (no path separators). Internal helper — does not
 * sanitize against traversal sequences like `../`; callers should use
 * predictable template strings (e.g., `${client}-usage-${tokenHash}.json`).
 */
export function fileCachePath(name: string): string {
  return path.join(FILE_CACHE_DIR, name);
}

/**
 * Read cached data from disk. Returns null when the file is missing,
 * malformed, lacks a timestamp or data field, or is older than `ttlSeconds`.
 */
export async function loadFileCache<T>(
  cacheFile: string,
  ttlSeconds: number
): Promise<{ data: T; timestamp: number } | null> {
  try {
    const raw = await readFile(cacheFile, 'utf-8');
    const entry = JSON.parse(raw) as FileCacheEntry<T>;
    if (typeof entry.timestamp !== 'number') return null;
    if (!('data' in entry)) return null;
    const ageSeconds = (Date.now() - entry.timestamp) / 1000;
    if (ageSeconds < ttlSeconds) return entry;
    return null;
  } catch {
    return null;
  }
}

/**
 * Write cached data to disk. Best-effort: errors are swallowed and debug-logged
 * so a misconfigured filesystem never breaks the caller. The parent directory
 * is created with 0o700 and the file with 0o600 by default. Triggers a
 * fire-and-forget cleanup sweep (in-process throttled to hourly).
 */
export async function saveFileCache<T>(
  cacheFile: string,
  data: T,
  mode: number = 0o600
): Promise<void> {
  try {
    await mkdir(path.dirname(cacheFile), { recursive: true, mode: 0o700 });
    await writeFile(
      cacheFile,
      JSON.stringify({ data, timestamp: Date.now() }),
      { mode }
    );
  } catch (err) {
    debugLog('file-cache', `save failed for ${cacheFile}`, err);
  }
  cleanupExpiredCache().catch(() => {});
}

/**
 * Remove expired cache files for all known cleanable prefixes.
 * Throttled to once per `CLEANUP_INTERVAL_MS` per process to avoid
 * repeated readdir syscalls. Safe to call concurrently — first call wins.
 *
 * `cacheDir` defaults to `FILE_CACHE_DIR`; the parameter is provided for tests
 * that want to sweep an isolated temp directory.
 */
export async function cleanupExpiredCache(cacheDir: string = FILE_CACHE_DIR): Promise<void> {
  const now = Date.now();
  if (now - lastCleanupTime < CLEANUP_INTERVAL_MS) return;
  lastCleanupTime = now;

  try {
    const files = await readdir(cacheDir);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      if (!CLEANABLE_PREFIXES.some((p) => file.startsWith(p))) continue;

      const filePath = path.join(cacheDir, file);
      try {
        const fileStat = await stat(filePath);
        const ageSeconds = (now - fileStat.mtimeMs) / 1000;
        if (ageSeconds > CACHE_CLEANUP_AGE_SECONDS) {
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

/**
 * Test helper: reset the cleanup throttle so the next call runs immediately.
 * Production code does not need this.
 */
export function resetCleanupThrottle(): void {
  lastCleanupTime = 0;
}
