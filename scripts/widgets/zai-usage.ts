/**
 * z.ai/ZHIPU usage widget - displays z.ai quota limits
 * Shows model, 5-hour token usage, and monthly MCP usage
 * @handbook 3.3-widget-data-sources
 */

import type { Widget } from './base.js';
import type { WidgetContext, ZaiUsageData } from '../types.js';
import { getColorForPercent, colorize, getTheme } from '../utils/colors.js';
import { formatTimeRemaining } from '../utils/formatters.js';
import { isZaiInstalled, fetchZaiUsage } from '../utils/zai-api-client.js';
import { debugLog } from '../utils/debug.js';

/**
 * Format usage percentage with color
 */
function formatPercent(percent: number): string {
  const color = getColorForPercent(percent);
  return colorize(`${Math.round(percent)}%`, color);
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
    const theme = getTheme();
    const parts: string[] = [];

    parts.push(`🟠 ${data.model}`);

    if (data.isError) {
      parts.push(colorize('⚠️', theme.warning));
    } else {
      // 5-hour token usage
      if (data.tokensPercent !== null) {
        let tokenPart = `${t.labels['5h']}: ${formatPercent(data.tokensPercent)}`;
        if (data.tokensResetAt) {
          tokenPart += ` (${formatTimeRemaining(new Date(data.tokensResetAt), t)})`;
        }
        parts.push(tokenPart);
      }

      // Monthly MCP usage (1m = 1 month)
      if (data.mcpPercent !== null) {
        let mcpPart = `${t.labels['1m']}: ${formatPercent(data.mcpPercent)}`;
        if (data.mcpResetAt) {
          mcpPart += ` (${formatTimeRemaining(new Date(data.mcpResetAt), t)})`;
        }
        parts.push(mcpPart);
      }
    }

    return parts.join(` ${colorize('│', theme.dim)} `);
  },
};
