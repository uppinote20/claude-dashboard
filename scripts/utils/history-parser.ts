/**
 * History parser - reads ~/.claude/history.jsonl for user prompt data
 * Unlike transcript.jsonl, history.jsonl only contains actual user input
 * via the `display` field, excluding skill/command expansions.
 *
 * Uses size-based caching: only re-reads when file has grown.
 * @tested scripts/__tests__/history-parser.test.ts
 */

import { open, stat } from 'fs/promises';
import { homedir } from 'os';
import type { LastPromptData } from '../types.js';

const HISTORY_PATH = `${homedir()}/.claude/history.jsonl`;
const CHUNK = 16 * 1024;

/**
 * Cached last prompt per session, invalidated by file size change.
 */
let historyCache: {
  fileSize: number;
  /** Cached results keyed by sessionId */
  results: Map<string, LastPromptData | null>;
} | null = null;

/**
 * Get the last user prompt from ~/.claude/history.jsonl.
 * Tail-reads the last 16KB and reverse-scans for the current session's
 * most recent entry. Results are cached until file size changes.
 */
export async function getLastUserPrompt(
  sessionId: string
): Promise<LastPromptData | null> {
  try {
    const fileStat = await stat(HISTORY_PATH);

    // Return cached result if file hasn't grown
    if (historyCache && historyCache.fileSize === fileStat.size) {
      const cached = historyCache.results.get(sessionId);
      if (cached !== undefined) return cached;
    }

    // File changed — invalidate all cached results
    if (!historyCache || historyCache.fileSize !== fileStat.size) {
      historyCache = { fileSize: fileStat.size, results: new Map() };
    }

    const size = Math.min(CHUNK, fileStat.size);
    const fd = await open(HISTORY_PATH, 'r');
    try {
      const buffer = Buffer.alloc(size);
      await fd.read(buffer, 0, size, fileStat.size - size);
      const lines = buffer.toString('utf-8').split('\n');

      for (let i = lines.length - 1; i >= 0; i--) {
        if (!lines[i]) continue;
        try {
          const entry = JSON.parse(lines[i]) as {
            sessionId?: string;
            display?: string;
            timestamp?: string;
          };
          if (entry.sessionId === sessionId && entry.display?.trim() && entry.timestamp) {
            const result: LastPromptData = {
              text: entry.display.replace(/\s+/g, ' ').trim(),
              timestamp: entry.timestamp,
            };
            historyCache.results.set(sessionId, result);
            return result;
          }
        } catch { /* skip malformed lines */ }
      }
    } finally {
      await fd.close();
    }

    // Not found for this session
    historyCache.results.set(sessionId, null);
  } catch { /* file not found or read error */ }

  return null;
}
