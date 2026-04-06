/**
 * Lines Changed widget - displays uncommitted lines added/removed via git diff
 * Includes untracked (new) files in the added count
 * @handbook 3.3-widget-data-sources
 * @tested scripts/__tests__/widgets.test.ts
 */

import type { Widget } from './base.js';
import type { WidgetContext, LinesChangedData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';
import { execGit, countUntrackedLines } from '../utils/git.js';

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
      const [diffOutput, untracked] = await Promise.all([
        execGit(['diff', 'HEAD', '--shortstat'], cwd, 1000),
        countUntrackedLines(cwd, 1000),
      ]);

      const insertMatch = diffOutput.match(/(\d+) insertion/);
      const deleteMatch = diffOutput.match(/(\d+) deletion/);
      const tracked = insertMatch ? parseInt(insertMatch[1], 10) : 0;
      const removed = deleteMatch ? parseInt(deleteMatch[1], 10) : 0;
      const added = tracked + untracked;

      const data = (added === 0 && removed === 0) ? null : { added, removed, untracked };
      diffCache = { cwd, data, timestamp: Date.now() };
      return data;
    } catch {
      // Also discards untracked lines (e.g., empty repo with no HEAD)
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
