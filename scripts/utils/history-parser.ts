/**
 * History parser - reads ~/.claude/history.jsonl for user prompt data
 * Unlike transcript.jsonl, history.jsonl only contains actual user input
 * via the `display` field, excluding skill/command expansions.
 */

import { open, stat } from 'fs/promises';
import { homedir } from 'os';
import type { LastPromptData } from '../types.js';

/**
 * Get the last user prompt from ~/.claude/history.jsonl.
 * Tail-reads the last 16KB and reverse-scans for the current session's
 * most recent entry.
 */
export async function getLastUserPrompt(
  sessionId: string
): Promise<LastPromptData | null> {
  const historyPath = `${homedir()}/.claude/history.jsonl`;
  const CHUNK = 16 * 1024;

  try {
    const fileStat = await stat(historyPath);
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
            timestamp?: string;
          };
          if (entry.sessionId === sessionId && entry.display?.trim() && entry.timestamp) {
            return {
              text: entry.display.replace(/\s+/g, ' ').trim(),
              timestamp: entry.timestamp,
            };
          }
        } catch { /* skip malformed lines */ }
      }
    } finally {
      await fd.close();
    }
  } catch { /* file not found or read error */ }

  return null;
}
