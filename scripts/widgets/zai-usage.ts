/**
 * z.ai/ZHIPU usage widget - displays z.ai quota limits
 * Shows model, 5-hour token usage, and monthly MCP usage
 */

import type { Widget } from './base.js';
import type { WidgetContext, ZaiUsageData, Translations } from '../types.js';
import { getColorForPercent, colorize, getTheme } from '../utils/colors.js';
import { isZaiInstalled, fetchZaiUsage } from '../utils/zai-api-client.js';
import { debugLog } from '../utils/debug.js';

/**
 * Format usage percentage with color
 */
function formatPercent(percent: number): string {
  const color = getColorForPercent(percent);
  return colorize(`${Math.round(percent)}%`, color);
}

/**
 * Format reset time as remaining duration
 */
function formatResetTime(resetAtMs: number, t: Translations): string {
  const now = Date.now();
  const diffMs = resetAtMs - now;

  if (diffMs <= 0) return `0${t.time.minutes}`;

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}${t.time.days}${hours}${t.time.hours}`;
  }
  if (hours > 0) {
    return `${hours}${t.time.hours}${minutes}${t.time.minutes}`;
  }
  return `${minutes}${t.time.minutes}`;
}

export const zaiUsageWidget: Widget<ZaiUsageData> = {
  id: 'zaiUsage',
  name: 'Z.ai Usage',

  async getData(ctx: WidgetContext): Promise<ZaiUsageData | null> {
    const installed = isZaiInstalled();
    debugLog('zai', 'isZaiInstalled:', installed);
    if (!installed) {
      return null;
    }

    const limits = await fetchZaiUsage(ctx.config.cache.ttlSeconds);
    debugLog('zai', 'fetchZaiUsage result:', limits);
    // Get model name from stdin (prefer display_name, fallback to 'GLM')
    const modelName = ctx.stdin.model?.display_name || 'GLM';

    if (!limits) {
      // Return error state instead of null to show warning indicator
      return {
        model: modelName,
        tokensPercent: null,
        tokensResetAt: null,
        mcpPercent: null,
        mcpResetAt: null,
        isError: true,
      };
    }

    return {
      model: modelName,
      tokensPercent: limits.tokensPercent,
      tokensResetAt: limits.tokensResetAt,
      mcpPercent: limits.mcpPercent,
      mcpResetAt: limits.mcpResetAt,
    };
  },

  render(data: ZaiUsageData, ctx: WidgetContext): string {
    const { translations: t } = ctx;
    const parts: string[] = [];

    // Orange circle + model name
    parts.push(`🟠 ${data.model}`);

    // Show error indicator or usage percentages
    const theme = getTheme();

    if (data.isError) {
      parts.push(colorize('⚠️', theme.warning));
    } else {
      // 5-hour token usage
      if (data.tokensPercent !== null) {
        let tokenPart = `${t.labels['5h']}: ${formatPercent(data.tokensPercent)}`;
        if (data.tokensResetAt) {
          tokenPart += ` (${formatResetTime(data.tokensResetAt, t)})`;
        }
        parts.push(tokenPart);
      }

      // Monthly MCP usage (1m = 1 month)
      if (data.mcpPercent !== null) {
        let mcpPart = `${t.labels['1m']}: ${formatPercent(data.mcpPercent)}`;
        if (data.mcpResetAt) {
          mcpPart += ` (${formatResetTime(data.mcpResetAt, t)})`;
        }
        parts.push(mcpPart);
      }
    }

    return parts.join(` ${colorize('│', theme.dim)} `);
  },
};
