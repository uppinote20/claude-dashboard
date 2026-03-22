/**
 * Lines Changed widget - displays lines added/removed
 * Prefers stdin data (total_lines_added/removed) when available,
 * falls back to git diff --shortstat.
 * @handbook 3.3-widget-data-sources
 * @tested scripts/__tests__/widgets.test.ts
 */

import type { Widget } from './base.js';
import type { WidgetContext, LinesChangedData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';
import { execGit } from '../utils/git.js';

/**
 * Cache TTL for git diff stats (10 seconds)
 * File changes are infrequent during AI output
 */
const DIFF_CACHE_TTL_MS = 10_000;

let diffCache: {
  cwd: string;
  data: LinesChangedData | null;
  timestamp: number;
} | null = null;

export const linesChangedWidget: Widget<LinesChangedData> = {
  id: 'linesChanged',
  name: 'Lines Changed',

  async getData(ctx: WidgetContext): Promise<LinesChangedData | null> {
    // Prefer stdin data when available (avoids git subprocess)
    const stdinAdded = ctx.stdin.cost?.total_lines_added;
    const stdinRemoved = ctx.stdin.cost?.total_lines_removed;

    if (stdinAdded !== undefined || stdinRemoved !== undefined) {
      const added = stdinAdded ?? 0;
      const removed = stdinRemoved ?? 0;
      return (added === 0 && removed === 0) ? null : { added, removed };
    }

    // Fallback to git diff
    const cwd = ctx.stdin.workspace?.current_dir;
    if (!cwd) return null;

    // Check TTL-based cache
    if (
      diffCache?.cwd === cwd &&
      Date.now() - diffCache.timestamp < DIFF_CACHE_TTL_MS
    ) {
      return diffCache.data;
    }

    try {
      const output = await execGit(['diff', 'HEAD', '--shortstat'], cwd, 1000);
      if (!output.trim()) {
        diffCache = { cwd, data: null, timestamp: Date.now() };
        return null;
      }

      const insertMatch = output.match(/(\d+) insertion/);
      const deleteMatch = output.match(/(\d+) deletion/);
      const added = insertMatch ? parseInt(insertMatch[1], 10) : 0;
      const removed = deleteMatch ? parseInt(deleteMatch[1], 10) : 0;

      const data = (added === 0 && removed === 0) ? null : { added, removed };
      diffCache = { cwd, data, timestamp: Date.now() };
      return data;
    } catch {
      diffCache = { cwd, data: null, timestamp: Date.now() };
      return null;
    }
  },

  render(data: LinesChangedData, _ctx: WidgetContext): string {
    const theme = getTheme();
    const parts: string[] = [];
    if (data.added > 0) parts.push(colorize(`+${data.added}`, theme.safe));
    if (data.removed > 0) parts.push(colorize(`-${data.removed}`, theme.danger));
    return parts.join(' ');
  },
};
