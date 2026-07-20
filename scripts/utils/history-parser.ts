/**
 * History parser - reads the config dir's history.jsonl for user prompt data
 * Unlike transcript.jsonl, history.jsonl only contains actual user input
 * via the `display` field, excluding skill/command expansions.
 *
 * Uses size-based caching: only re-reads when file has grown.
 * @handbook 3.3-widget-data-sources
 * @tested scripts/__tests__/history-parser.test.ts
 */

import { open, stat } from 'fs/promises';
import { join } from 'path';
import { getClaudeConfigDir } from './config-dir.js';
import type { LastPromptData } from '../types.js';

const CHUNK = 16 * 1024;

/**
 * Replace [Pasted text #N ...] placeholders in display with actual content
 * from pastedContents. Falls back to original display if content unavailable.
 */
function resolvePastedText(
  display: string,
  pastedContents?: Record<string, { content?: string }>
): string {
  if (!pastedContents) return display;
  return display.replace(
    /\[Pasted text #(\d+)[^\]]*\]/g,
    (match, id: string) => pastedContents[id]?.content ?? match
  );
}

let historyCache: {
  /** Resolved history.jsonl path — CLAUDE_CONFIG_DIR can switch mid-process
   * and file size alone can collide across directories */
  path: string;
  fileSize: number;
  /** Cached results keyed by sessionId */
  results: Map<string, LastPromptData | null>;
} | null = null;

/**
 * Get the last user prompt from the config dir's history.jsonl.
 * Tail-reads the last 16KB and reverse-scans for the current session's
 * most recent entry. Results are cached until file size changes.
 */
export async function getLastUserPrompt(
  sessionId: string
): Promise<LastPromptData | null> {
  try {
    const historyPath = join(getClaudeConfigDir(), 'history.jsonl');
    const fileStat = await stat(historyPath);

    // Return cached result if it is the same file at the same size
    if (
      historyCache &&
      historyCache.path === historyPath &&
      historyCache.fileSize === fileStat.size
    ) {
      const cached = historyCache.results.get(sessionId);
      if (cached !== undefined) return cached;
    } else {
      // File changed or config dir switched — invalidate all cached results
      historyCache = { path: historyPath, fileSize: fileStat.size, results: new Map() };
    }

    const size = Math.min(CHUNK, fileStat.size);
    const fd = await open(historyPath, 'r');
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
            pastedContents?: Record<string, { content?: string }>;
            timestamp?: string;
          };
          if (entry.sessionId === sessionId && entry.display?.trim() && entry.timestamp) {
            const text = resolvePastedText(entry.display, entry.pastedContents);
            const result: LastPromptData = {
              text: text.replace(/\s+/g, ' ').trim(),
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
