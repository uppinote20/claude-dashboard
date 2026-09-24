/**
 * Prompt cache widget - main-conversation prompt cache health from stdin.prompt_cache
 *
 * Complements `cacheHit` (which is per-request, from the last API call) with the
 * session-wide view Claude Code shows on the `/cost` "Prompt cache (main)" line:
 * whether the cached prefix is still warm, the session hit ratio, and how many
 * requests missed the cache.
 *
 *   ♨️ 91%        warm, 91% of input tokens served from cache
 *   ❄️ 91% ✗2     cold (TTL expired), 2 misses so far
 *
 * Hidden until the first API response (field absent) and when the provider or
 * gateway reports no cache tokens at all (`caching_observed: false`).
 * Requires Claude Code v2.1.251+; older versions never send the field.
 * @handbook 3.3-widget-data-sources
 * @tested scripts/__tests__/widgets.test.ts
 */

import type { Widget } from './base.js';
import type { WidgetContext, PromptCacheData } from '../types.js';
import { colorize, getColorForPercent, getTheme } from '../utils/colors.js';
import { ICON } from '../utils/emoji.js';

export const promptCacheWidget: Widget<PromptCacheData> = {
  id: 'promptCache',
  name: 'Prompt Cache',

  async getData(ctx: WidgetContext): Promise<PromptCacheData | null> {
    const cache = ctx.stdin.prompt_cache;
    if (!cache || cache.caching_observed === false) return null;

    const ratio = cache.hit_ratio;
    const hitPercentage =
      typeof ratio === 'number' && Number.isFinite(ratio)
        ? Math.min(100, Math.max(0, Math.round(ratio * 100)))
        : undefined;

    const misses = typeof cache.misses === 'number' && cache.misses > 0 ? cache.misses : 0;

    return { warm: cache.warm === true, hitPercentage, misses };
  },

  render(data: PromptCacheData): string {
    const theme = getTheme();
    const icon = data.warm ? ICON.hotSprings : ICON.snowflake;

    const parts: string[] = [icon];
    if (data.hitPercentage !== undefined) {
      // Higher hit ratio is better: invert so 100% renders green, 0% red
      const color = getColorForPercent(100 - data.hitPercentage);
      parts.push(colorize(`${data.hitPercentage}%`, color));
    }
    if (data.misses > 0) {
      parts.push(colorize(`✗${data.misses}`, theme.warning));
    }

    return parts.join(' ');
  },
};
