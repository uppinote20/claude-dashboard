/**
 * Gemini usage widgets - displays Google Gemini CLI usage limits
 * - geminiUsageWidget: Shows current model usage in a single line (compact)
 * - geminiUsageAllWidget: Shows all model buckets (detailed)
 * @handbook 3.3-widget-data-sources
 * @tested scripts/__tests__/widgets.test.ts
 */

import type { Widget } from './base.js';
import type { WidgetContext, GeminiUsageData, GeminiUsageAllData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';
import { ICON } from '../utils/emoji.js';
import { isGeminiInstalled, fetchGeminiUsage } from '../utils/gemini-client.js';
import { formatUsageWithReset } from './usage-format.js';
import { debugLog } from '../utils/debug.js';

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
      // Return error state instead of null to show warning indicator
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
    const theme = getTheme();
    const parts: string[] = [];

    parts.push(`${colorize(ICON.gem, theme.info)} ${data.model}`);

    if (data.isError) {
      parts.push(colorize(ICON.warning, theme.warning));
    } else if (data.usedPercent !== null) {
      parts.push(formatUsageWithReset(data.usedPercent, data.resetAt, ctx.translations));
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
    const theme = getTheme();

    if (data.isError) {
      return `${colorize(ICON.gem, theme.info)} Gemini ${colorize(ICON.warning, theme.warning)}`;
    }

    if (data.buckets.length === 0) {
      return `${colorize(ICON.gem, theme.info)} Gemini ${colorize('--', theme.secondary)}`;
    }

    const parts = data.buckets.map((bucket) => {
      const modelShort = bucket.modelId.replace('gemini-', '');
      if (bucket.usedPercent !== null) {
        return `${colorize(modelShort, theme.secondary)}: ${formatUsageWithReset(bucket.usedPercent, bucket.resetAt, ctx.translations)}`;
      }
      return `${colorize(modelShort, theme.secondary)}: ${colorize('--', theme.secondary)}`;
    });

    return `${colorize(ICON.gem, theme.info)} ${parts.join(` ${colorize('│', theme.dim)} `)}`;
  },
};
