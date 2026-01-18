/**
 * Cache hit rate widget - displays percentage of tokens from cache
 */

import type { Widget } from './base.js';
import type { WidgetContext, CacheHitData } from '../types.js';
import { getColorForPercent, colorize } from '../utils/colors.js';

export const cacheHitWidget: Widget<CacheHitData> = {
  id: 'cacheHit',
  name: 'Cache Hit Rate',

  async getData(ctx: WidgetContext): Promise<CacheHitData | null> {
    const usage = ctx.stdin.context_window?.current_usage;

    // Show 0% at session start or when no usage data
    if (!usage) {
      return { hitPercentage: 0 };
    }

    const cacheRead = usage.cache_read_input_tokens;
    const freshInput = usage.input_tokens;
    const cacheCreation = usage.cache_creation_input_tokens;
    const total = cacheRead + freshInput + cacheCreation;

    // Show 0% if no input tokens yet
    if (total === 0) {
      return { hitPercentage: 0 };
    }

    const hitPercentage = Math.round((cacheRead / total) * 100);

    return { hitPercentage };
  },

  render(data: CacheHitData): string {
    // Higher cache hit rate is better (green), lower is worse (yellow/red)
    // Invert the color logic: 100% = green, 0% = red
    const color = getColorForPercent(100 - data.hitPercentage);
    return `📦 ${colorize(`${data.hitPercentage}%`, color)}`;
  },
};
