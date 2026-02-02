/**
 * Session utilities - shared session time management
 */

import { readFile, mkdir, open, readdir, unlink, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import type { WidgetContext } from '../types.js';
import { debugLog } from './debug.js';

const SESSION_DIR = join(homedir(), '.cache', 'claude-dashboard', 'sessions');
const SESSION_MAX_AGE_SECONDS = 86400; // 24 hours - cleanup files older than this
const CLEANUP_INTERVAL_MS = 3600000; // 1 hour - minimum interval between cleanups

/**
 * Type guard to check if an error is an ErrnoException with a specific code
 */
function isErrnoException(error: unknown, code: string): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === code
  );
}

/**
 * Last cleanup timestamp for time-based throttling
 */
let lastCleanupTime = 0;

// In-memory cache to avoid repeated file I/O during a single process lifecycle
const sessionCache = new Map<string, number>();

// Pending requests to prevent race conditions when multiple processes start simultaneously
const pendingRequests = new Map<string, Promise<number>>();

/**
 * Sanitize session ID to prevent path traversal attacks.
 * Only allows alphanumeric characters, hyphens, and underscores.
 */
function sanitizeSessionId(sessionId: string): string {
  return sessionId.replace(/[^a-zA-Z0-9-_]/g, '');
}

/**
 * Get or create session start time
 */
export async function getSessionStartTime(sessionId: string): Promise<number> {
  const safeSessionId = sanitizeSessionId(sessionId);

  // Check memory cache first
  if (sessionCache.has(safeSessionId)) {
    return sessionCache.get(safeSessionId)!;
  }

  // Check if there's already a pending request for this session
  const pending = pendingRequests.get(safeSessionId);
  if (pending) {
    return pending;
  }

  // Create and store the promise to deduplicate concurrent requests
  const promise = getOrCreateSessionStartTimeImpl(safeSessionId);
  pendingRequests.set(safeSessionId, promise);

  try {
    return await promise;
  } finally {
    pendingRequests.delete(safeSessionId);
  }
}

/**
 * Internal implementation for getting or creating session start time
 */
async function getOrCreateSessionStartTimeImpl(safeSessionId: string): Promise<number> {
  const sessionFile = join(SESSION_DIR, `${safeSessionId}.json`);

  try {
    const content = await readFile(sessionFile, 'utf-8');
    const data = JSON.parse(content);

    if (typeof data.startTime !== 'number') {
      debugLog('session', `Invalid session file format for ${safeSessionId}`);
      throw new Error('Invalid session file format');
    }

    // Cache result before returning
    sessionCache.set(safeSessionId, data.startTime);
    return data.startTime;
  } catch (error: unknown) {
    // Check if file simply doesn't exist (expected case)
    if (!isErrnoException(error, 'ENOENT')) {
      // Unexpected error - log for debugging
      debugLog('session', `Failed to read session ${safeSessionId}`, error);
    }

    // Create new session with atomic file creation
    const startTime = Date.now();

    try {
      await mkdir(SESSION_DIR, { recursive: true });

      // Use O_EXCL flag for atomic creation - fails if file already exists
      // This prevents race conditions where multiple processes create different start times
      const fileHandle = await open(sessionFile, 'wx');
      try {
        await fileHandle.writeFile(JSON.stringify({ startTime }), 'utf-8');
      } finally {
        await fileHandle.close();
      }

      // Cache result before returning
      sessionCache.set(safeSessionId, startTime);

      // Probabilistically clean up old session files (fire-and-forget)
      cleanupExpiredSessions().catch(() => {});

      return startTime;
    } catch (writeError: unknown) {
      // If file was created by another process (EEXIST), read it instead
      if (isErrnoException(writeError, 'EEXIST')) {
        try {
          const content = await readFile(sessionFile, 'utf-8');
          const data = JSON.parse(content);
          if (typeof data.startTime === 'number') {
            sessionCache.set(safeSessionId, data.startTime);
            return data.startTime;
          }
        } catch {
          debugLog('session', `Failed to read existing session ${safeSessionId} after EEXIST`);
        }
      }

      // Log non-EEXIST write errors
      if (!isErrnoException(writeError, 'EEXIST')) {
        debugLog('session', `Failed to persist session ${safeSessionId}`, writeError);
      }

      // Fallback: Continue with in-memory start time - widget will still work for current process
      sessionCache.set(safeSessionId, startTime);
      return startTime;
    }
  }
}

/**
 * Get session elapsed time in milliseconds
 */
export async function getSessionElapsedMs(sessionId: string): Promise<number> {
  const startTime = await getSessionStartTime(sessionId);
  return Date.now() - startTime;
}

/**
 * Get session elapsed minutes from context
 * Returns null if session is less than minMinutes old
 */
export async function getSessionElapsedMinutes(
  ctx: WidgetContext,
  minMinutes = 1
): Promise<number | null> {
  const sessionId = ctx.stdin.session_id || 'default';
  const elapsedMs = await getSessionElapsedMs(sessionId);
  const elapsedMinutes = elapsedMs / (1000 * 60);

  if (elapsedMinutes < minMinutes) return null;
  return elapsedMinutes;
}

/**
 * Clean up expired session files from disk
 * Runs at most once per hour (time-based throttling)
 */
async function cleanupExpiredSessions(): Promise<void> {
  const now = Date.now();

  // Skip if last cleanup was less than 1 hour ago
  if (now - lastCleanupTime < CLEANUP_INTERVAL_MS) {
    return;
  }
  lastCleanupTime = now;

  try {
    const files = await readdir(SESSION_DIR);
    const cutoffTime = now - SESSION_MAX_AGE_SECONDS * 1000;

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const filePath = join(SESSION_DIR, file);
        const fileStat = await stat(filePath);

        if (fileStat.mtimeMs < cutoffTime) {
          await unlink(filePath);
          debugLog('session', `Cleaned up expired session: ${file}`);
        }
      } catch {
        // Ignore individual file errors
      }
    }
  } catch {
    // Ignore cleanup errors (directory might not exist yet)
  }
}
