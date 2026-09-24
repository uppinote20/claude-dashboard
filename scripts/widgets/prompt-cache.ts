/**
 * Prompt cache widgets - main-conversation prompt cache health from stdin.prompt_cache,
 * as one combined widget plus state/hit/misses sub-widgets
 *
 * Complements `cacheHit` (which is per-request, from the last API call) with the
 * session-wide view Claude Code shows on the `/cost` "Prompt cache (main)" line:
 * whether the cached prefix is still warm and for how long, the session hit ratio,
 * and how many requests missed the cache.
 *
 *   ♨️ 4m 91% miss 2   warm for another 4 minutes, 91% served from cache, 2 misses
 *   ❄️ 91% miss 2      cold (TTL expired) — the next request re-caches the prefix
 *
 * Hidden until the first API response (field absent) and when the provider or
 * gateway reports no cache tokens at all (`caching_observed: false`).
 * Requires Claude Code v2.1.251+; older versions never send the field.
 * @handbook 3.3-widget-data-sources
 * @handbook 3.6-derived-widgets
 * @tested scripts/__tests__/widgets.test.ts
 */

import type { Widget } from './base.js';
import type { WidgetContext, PromptCacheData, Translations } from '../types.js';
import { colorize, getColorForPercent, getTheme } from '../utils/colors.js';
import { ICON } from '../utils/emoji.js';
import { clampPercent, formatTimeRemaining } from '../utils/formatters.js';

async function getPromptCacheData(ctx: WidgetContext): Promise<PromptCacheData | null> {
  const cache = ctx.stdin.prompt_cache;
  if (!cache || cache.caching_observed === false) return null;

  const ratio = cache.hit_ratio;
  const hitPercentage =
    typeof ratio === 'number' && Number.isFinite(ratio) ? clampPercent(ratio * 100) : undefined;

  const misses = typeof cache.misses === 'number' && cache.misses > 0 ? cache.misses : 0;

  const expiresAt =
    typeof cache.expires_at === 'number' && Number.isFinite(cache.expires_at)
      ? cache.expires_at * 1000
      : undefined;

  return { warm: cache.warm === true, hitPercentage, misses, expiresAt };
}

/**
 * Time left before the cache goes cold, or '' when cold / unknown / already past.
 * The countdown only advances when the status line re-renders.
 */
function formatWarmTimeLeft(data: PromptCacheData, t: Translations): string {
  if (!data.warm || data.expiresAt === undefined) return '';
  const leftMs = data.expiresAt - Date.now();
  if (leftMs <= 0) return '';
  // formatTimeRemaining floors to minutes, which would read "0m" while still warm
  if (leftMs < 60_000) return `${Math.ceil(leftMs / 1000)}${t.time.seconds}`;
  return formatTimeRemaining(new Date(data.expiresAt), t);
}

function renderState(data: PromptCacheData, ctx: WidgetContext): string {
  const icon = data.warm ? ICON.hotSprings : ICON.snowflake;
  const timeLeft = formatWarmTimeLeft(data, ctx.translations);
  return timeLeft ? `${icon} ${colorize(timeLeft, getTheme().secondary)}` : icon;
}

function renderHit(data: PromptCacheData): string {
  if (data.hitPercentage === undefined) return '';
  // Higher hit ratio is better: invert so 100% renders green, 0% red
  return colorize(`${data.hitPercentage}%`, getColorForPercent(100 - data.hitPercentage));
}

function renderMisses(data: PromptCacheData, ctx: WidgetContext): string {
  if (data.misses === 0) return '';
  return colorize(`${ctx.translations.widgets.cacheMiss} ${data.misses}`, getTheme().warning);
}

export const promptCacheWidget: Widget<PromptCacheData> = {
  id: 'promptCache',
  name: 'Prompt Cache',
  getData: getPromptCacheData,

  render(data: PromptCacheData, ctx: WidgetContext): string {
    return [renderState(data, ctx), renderHit(data), renderMisses(data, ctx)]
      .filter(Boolean)
      .join(' ');
  },
};

export const promptCacheStateWidget: Widget<PromptCacheData> = {
  id: 'promptCacheState',
  name: 'Prompt Cache (State)',
  getData: getPromptCacheData,
  render: renderState,
};

export const promptCacheHitWidget: Widget<PromptCacheData> = {
  id: 'promptCacheHit',
  name: 'Prompt Cache (Hit)',
  getData: getPromptCacheData,
  render: renderHit,
};

export const promptCacheMissesWidget: Widget<PromptCacheData> = {
  id: 'promptCacheMisses',
  name: 'Prompt Cache (Misses)',
  getData: getPromptCacheData,
  render: renderMisses,
};
