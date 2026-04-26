/**
 * Tag status widget - commits ahead of each matched git tag.
 * @handbook 3.3-widget-data-sources
 * @handbook 3.7-widget-module-cache
 * @handbook 8.4-test-cache-reset
 * @tested scripts/__tests__/widgets.test.ts
 */

import type { Widget } from './base.js';
import type { WidgetContext, TagStatusData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';
import { execGit } from '../utils/git.js';

const TAG_CACHE_TTL_MS = 30_000;

let tagCache: {
  cwd: string;
  key: string;
  data: TagStatusData | null;
  timestamp: number;
} | null = null;

async function resolveTag(
  pattern: string,
  cwd: string,
): Promise<{ name: string; count: number } | null> {
  try {
    const described = (
      await execGit(
        ['describe', '--tags', '--abbrev=0', '--match', pattern, 'HEAD'],
        cwd,
        500,
      )
    ).trim();
    if (!described) return null;
    const countStr = (
      await execGit(['rev-list', '--count', `${described}..HEAD`], cwd, 500)
    ).trim();
    const count = parseInt(countStr, 10);
    return { name: described, count: Number.isFinite(count) ? count : 0 };
  } catch {
    return null;
  }
}

export const tagStatusWidget: Widget<TagStatusData> = {
  id: 'tagStatus',
  name: 'Tag Status',

  async getData(ctx: WidgetContext): Promise<TagStatusData | null> {
    const cwd = ctx.stdin.workspace?.current_dir;
    if (!cwd) return null;

    const patterns = ctx.config.tagPatterns ?? ['v*'];
    if (patterns.length === 0) return null;

    const key = patterns.join('|');
    if (
      tagCache?.cwd === cwd &&
      tagCache.key === key &&
      Date.now() - tagCache.timestamp < TAG_CACHE_TTL_MS
    ) {
      return tagCache.data;
    }

    const resolved = await Promise.all(patterns.map((p) => resolveTag(p, cwd)));
    const tags = resolved.filter(
      (r): r is { name: string; count: number } => r !== null,
    );
    const data = tags.length > 0 ? { tags } : null;
    tagCache = { cwd, key, data, timestamp: Date.now() };
    return data;
  },

  render(data: TagStatusData, _ctx: WidgetContext): string {
    const theme = getTheme();
    const icon = colorize('🏷', theme.info);
    const parts = data.tags.map(({ name, count }) => {
      const nameColored = colorize(name, theme.branch);
      if (count === 0) return nameColored;
      return `${nameColored}${colorize(`+${count}`, theme.warning)}`;
    });
    return `${icon} ${parts.join(' ')}`;
  },
};

export function clearTagCacheForTest(): void {
  tagCache = null;
}
