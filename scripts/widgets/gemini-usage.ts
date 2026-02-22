/**
 * Gemini usage widgets - displays Google Gemini CLI usage limits
 * - geminiUsageWidget: Shows current model usage in a single line (compact)
 * - geminiUsageAllWidget: Shows all model buckets (detailed)
 */

import type { Widget } from './base.js';
import type { WidgetContext, GeminiUsageData, GeminiUsageAllData, Translations } from '../types.js';
import { getColorForPercent, colorize, getTheme } from '../utils/colors.js';
import { isGeminiInstalled, fetchGeminiUsage } from '../utils/gemini-client.js';
import { formatTimeRemaining } from '../utils/formatters.js';
import { debugLog } from '../utils/debug.js';

/**
 * Format usage with optional reset time
 */
function formatUsage(
  percent: number,
  resetAt: string | null,
  t: Translations
): string {
  const color = getColorForPercent(percent);
  let result = colorize(`${Math.round(percent)}%`, color);

  if (resetAt) {
    const resetTime = formatTimeRemaining(new Date(resetAt), t);
    if (resetTime) {
      result += ` (${resetTime})`;
    }
  }

  return result;
}

export const geminiUsageWidget: Widget<GeminiUsageData> = {
  id: 'geminiUsage',
  name: 'Gemini Usage',

  async getData(ctx: WidgetContext): Promise<GeminiUsageData | null> {
    const installed = await isGeminiInstalled();
    debugLog('gemini', 'isGeminiInstalled:', installed);
    if (!installed) {
      return null;
    }

    const limits = await fetchGeminiUsage(ctx.config.cache.ttlSeconds);
    debugLog('gemini', 'fetchGeminiUsage result:', limits);
    if (!limits) {
      // Return error state instead of null to show ⚠️ indicator
      return {
        model: 'gemini',
        usedPercent: null,
        resetAt: null,
        isError: true,
      };
    }

    return {
      model: limits.model,
      usedPercent: limits.usedPercent,
      resetAt: limits.resetAt,
    };
  },

  render(data: GeminiUsageData, ctx: WidgetContext): string {
    const { translations: t } = ctx;
    const parts: string[] = [];

    const theme = getTheme();

    // Gemini icon (diamond) + model name
    parts.push(`${colorize('💎', theme.info)} ${data.model}`);

    // Show error indicator or usage percentage
    if (data.isError) {
      parts.push(colorize('⚠️', theme.warning));
    } else if (data.usedPercent !== null) {
      parts.push(formatUsage(data.usedPercent, data.resetAt, t));
    }

    return parts.join(` ${colorize('│', theme.dim)} `);
  },
};

/**
 * Gemini usage all widget - displays all model buckets
 */
export const geminiUsageAllWidget: Widget<GeminiUsageAllData> = {
  id: 'geminiUsageAll',
  name: 'Gemini Usage All',

  async getData(ctx: WidgetContext): Promise<GeminiUsageAllData | null> {
    const installed = await isGeminiInstalled();
    debugLog('gemini', 'geminiUsageAll - isGeminiInstalled:', installed);
    if (!installed) {
      return null;
    }

    const limits = await fetchGeminiUsage(ctx.config.cache.ttlSeconds);
    debugLog('gemini', 'geminiUsageAll - fetchGeminiUsage result:', limits);
    if (!limits) {
      return {
        buckets: [],
        isError: true,
      };
    }

    return {
      buckets: limits.buckets.map(b => ({
        modelId: b.modelId || 'unknown',
        usedPercent: b.usedPercent,
        resetAt: b.resetAt,
      })),
    };
  },

  render(data: GeminiUsageAllData, ctx: WidgetContext): string {
    const { translations: t } = ctx;

    const theme = getTheme();

    if (data.isError) {
      return `${colorize('💎', theme.info)} Gemini ${colorize('⚠️', theme.warning)}`;
    }

    if (data.buckets.length === 0) {
      return `${colorize('💎', theme.info)} Gemini ${colorize('--', theme.secondary)}`;
    }

    // Render each bucket as "model: X% (reset)"
    const parts = data.buckets.map(bucket => {
      const modelShort = bucket.modelId.replace('gemini-', '');
      if (bucket.usedPercent !== null) {
        return `${colorize(modelShort, theme.secondary)}: ${formatUsage(bucket.usedPercent, bucket.resetAt, t)}`;
      }
      return `${colorize(modelShort, theme.secondary)}: ${colorize('--', theme.secondary)}`;
    });

    return `${colorize('💎', theme.info)} ${parts.join(' │ ')}`;
  },
};
