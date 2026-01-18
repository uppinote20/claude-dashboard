/**
 * Session utilities - shared session time management
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import type { WidgetContext } from '../types.js';
import { debugLog } from './debug.js';

const SESSION_DIR = join(homedir(), '.cache', 'claude-dashboard', 'sessions');

// In-memory cache to avoid repeated file I/O during a single process lifecycle
const sessionCache = new Map<string, number>();

/**
 * Get or create session start time
 */
export async function getSessionStartTime(sessionId: string): Promise<number> {
  // Check memory cache first
  if (sessionCache.has(sessionId)) {
    return sessionCache.get(sessionId)!;
  }

  const sessionFile = join(SESSION_DIR, `${sessionId}.json`);

  try {
    const content = await readFile(sessionFile, 'utf-8');
    const data = JSON.parse(content);

    if (typeof data.startTime !== 'number') {
      debugLog('session', `Invalid session file format for ${sessionId}`);
      throw new Error('Invalid session file format');
    }

    // Cache result before returning
    sessionCache.set(sessionId, data.startTime);
    return data.startTime;
  } catch (error: unknown) {
    // Check if file simply doesn't exist (expected case)
    const isNotFound =
      error instanceof Error &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'ENOENT';

    if (!isNotFound) {
      // Unexpected error - log for debugging
      debugLog('session', `Failed to read session ${sessionId}`, error);
    }

    // Create new session
    const startTime = Date.now();

    try {
      await mkdir(SESSION_DIR, { recursive: true });
      await writeFile(sessionFile, JSON.stringify({ startTime }), 'utf-8');
    } catch (writeError) {
      debugLog('session', `Failed to persist session ${sessionId}`, writeError);
      // Continue with in-memory start time - widget will still work for current process
    }

    // Cache result before returning
    sessionCache.set(sessionId, startTime);
    return startTime;
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
