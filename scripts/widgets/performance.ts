/**
 * Performance badge widget - composite score from cache hit rate + burn rate
 * @handbook 3.3-widget-data-sources
 * @tested scripts/__tests__/widgets.test.ts
 */

import type { Widget } from './base.js';
import type { WidgetContext, PerformanceData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';
import { getSessionElapsedMinutes } from '../utils/session.js';

/**
 * Score thresholds for badge colors
 * Score is 0-100 where higher is better efficiency
 */
const GOOD_THRESHOLD = 70;
const OK_THRESHOLD = 40;

export const performanceWidget: Widget<PerformanceData> = {
  id: 'performance',
  name: 'Performance',

  async getData(ctx: WidgetContext): Promise<PerformanceData | null> {
    const usage = ctx.stdin.context_window?.current_usage;
    if (!usage) return null;

    const totalTokens = usage.input_tokens + usage.output_tokens
      + usage.cache_creation_input_tokens + usage.cache_read_input_tokens;
    if (totalTokens === 0) return null;

    const elapsedMinutes = await getSessionElapsedMinutes(ctx, 0);
    if (elapsedMinutes === null || elapsedMinutes === 0) return null;

    // Cache hit rate (0-100, higher = more cache reuse)
    const totalInput = usage.input_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens;
    const cacheHitRate = totalInput > 0 ? (usage.cache_read_input_tokens / totalInput) * 100 : 0;

    // Output ratio (0-100, higher = more productive output per token)
    const outputRatio = (usage.output_tokens / totalTokens) * 100;

    // Composite score: 60% cache hit + 40% output ratio
    const score = Math.min(100, Math.max(0, Math.round(cacheHitRate * 0.6 + outputRatio * 0.4)));

    return {
      score,
      cacheHitRate: Math.round(cacheHitRate),
      outputRatio: Math.round(outputRatio),
    };
  },

  render(data: PerformanceData, _ctx: WidgetContext): string {
    const theme = getTheme();
    let badge: string;
    let color: string;

    if (data.score >= GOOD_THRESHOLD) {
      badge = '🟢';
      color = theme.safe;
    } else if (data.score >= OK_THRESHOLD) {
      badge = '🟡';
      color = theme.warning;
    } else {
      badge = '🔴';
      color = theme.danger;
    }

    return `${badge} ${colorize(`${data.score}%`, color)}`;
  },
};
