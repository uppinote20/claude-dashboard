/**
 * Cross-process advisory file lock for stampede prevention.
 * @handbook 4.2-request-deduplication
 * @tested scripts/__tests__/file-lock.test.ts
 */
import { writeFile, stat, unlink } from 'fs/promises';
import { debugLog } from './debug.js';

export const LOCK_STALE_SECONDS = 10;
export const LOCK_WAIT_INTERVAL_MS = 100;
export const LOCK_WAIT_MAX_MS = 2000;

async function cleanStaleFileLock(lockPath: string, staleSeconds: number): Promise<void> {
  try {
    const lockStat = await stat(lockPath);
    const ageSeconds = (Date.now() - lockStat.mtimeMs) / 1000;
    if (ageSeconds >= staleSeconds) {
      await unlink(lockPath).catch(() => {});
    }
  } catch {
    // No lock file — nothing to clean
  }
}

/**
 * Try to create an exclusive lock file.
 * Returns true if acquired, false if another process holds it.
 * Stale locks (older than staleSeconds) are auto-cleaned before attempting.
 */
export async function acquireFileLock(
  lockPath: string,
  staleSeconds: number = LOCK_STALE_SECONDS
): Promise<boolean> {
  try {
    await cleanStaleFileLock(lockPath, staleSeconds);
    await writeFile(lockPath, String(process.pid), { flag: 'wx', mode: 0o600 });
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code !== 'EEXIST') {
      debugLog('lock', 'acquire failed', err);
    }
    return false;
  }
}

/**
 * Release a previously-acquired lock. Safe to call even if lock is already gone.
 */
export async function releaseFileLock(lockPath: string): Promise<void> {
  try {
    await unlink(lockPath);
  } catch {
    // Already gone — fine
  }
}

/**
 * Poll until lock file disappears or timeout elapses.
 * Used when another process holds the lock; caller should retry cache read after.
 */
export async function waitForLock(
  lockPath: string,
  maxWaitMs: number = LOCK_WAIT_MAX_MS,
  intervalMs: number = LOCK_WAIT_INTERVAL_MS
): Promise<void> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    try {
      await stat(lockPath);
    } catch {
      return; // Lock gone
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
