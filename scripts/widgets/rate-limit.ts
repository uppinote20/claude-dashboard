/**
 * Rate limit widgets - displays 5h and 7d usage limits
 * Note: These widgets return null when using z.ai provider,
 * allowing zaiUsage widget to display instead.
 */

import type { Widget } from './base.js';
import type { WidgetContext, RateLimitData, UsageLimits } from '../types.js';
import { getColorForPercent, colorize, getTheme } from '../utils/colors.js';
import { formatTimeRemaining } from '../utils/formatters.js';
import { isZaiProvider } from '../utils/provider.js';

type LabelKey = '5h' | '7d_all' | '7d_sonnet';
type LimitKey = keyof UsageLimits;

function renderRateLimit(data: RateLimitData, ctx: WidgetContext, labelKey: LabelKey): string {
  if (data.isError) {
    return colorize('⚠️', getTheme().warning);
  }

  const { translations: t } = ctx;
  const color = getColorForPercent(data.utilization);
  const label = `${t.labels[labelKey]}: ${colorize(`${data.utilization}%`, color)}`;

  if (!data.resetsAt) return label;
  return `${label} (${formatTimeRemaining(data.resetsAt, t)})`;
}

function getLimitData(limits: UsageLimits | null | undefined, key: LimitKey): RateLimitData | null {
  const limit = limits?.[key];
  if (!limit) return null;

  return {
    utilization: Math.round(limit.utilization),
    resetsAt: limit.resets_at,
  };
}

/**
 * Check if Anthropic rate limits should be hidden (z.ai uses different quota system)
 */
function shouldHideAnthropicLimits(): boolean {
  return isZaiProvider();
}

/**
 * 5-hour rate limit widget
 */
export const rateLimit5hWidget: Widget<RateLimitData> = {
  id: 'rateLimit5h',
  name: '5h Rate Limit',

  async getData(ctx: WidgetContext): Promise<RateLimitData | null> {
    if (shouldHideAnthropicLimits()) return null;
    const data = getLimitData(ctx.rateLimits, 'five_hour');
    // Show warning if API failed (only in this widget to avoid duplicates)
    return data ?? { utilization: 0, resetsAt: null, isError: true };
  },

  render(data: RateLimitData, ctx: WidgetContext): string {
    return renderRateLimit(data, ctx, '5h');
  },
};

/**
 * 7-day rate limit widget (Max plan only)
 */
export const rateLimit7dWidget: Widget<RateLimitData> = {
  id: 'rateLimit7d',
  name: '7d Rate Limit',

  async getData(ctx: WidgetContext): Promise<RateLimitData | null> {
    if (shouldHideAnthropicLimits()) return null;
    if (ctx.config.plan !== 'max') return null;
    return getLimitData(ctx.rateLimits, 'seven_day');
  },

  render(data: RateLimitData, ctx: WidgetContext): string {
    return renderRateLimit(data, ctx, '7d_all');
  },
};

/**
 * 7-day Sonnet-only rate limit widget (Max plan only)
 */
export const rateLimit7dSonnetWidget: Widget<RateLimitData> = {
  id: 'rateLimit7dSonnet',
  name: '7d Sonnet Rate Limit',

  async getData(ctx: WidgetContext): Promise<RateLimitData | null> {
    if (shouldHideAnthropicLimits()) return null;
    if (ctx.config.plan !== 'max') return null;
    return getLimitData(ctx.rateLimits, 'seven_day_sonnet');
  },

  render(data: RateLimitData, ctx: WidgetContext): string {
    return renderRateLimit(data, ctx, '7d_sonnet');
  },
};
