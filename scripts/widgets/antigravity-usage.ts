/**
 * Antigravity usage widgets - displays Google Antigravity CLI quota
 * - antigravityUsageWidget: model-family groups in one line (agy's own grouping)
 * - antigravityUsageAllWidget: every model bucket (detailed)
 * @handbook 3.3-widget-data-sources
 * @tested scripts/__tests__/widgets.test.ts
 */

import type { Widget } from './base.js';
import type {
  WidgetContext,
  AntigravityUsageData,
  AntigravityUsageAllData,
  AntigravityUsageLimits,
} from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';
import { ICON } from '../utils/emoji.js';
import { isAntigravityInstalled, fetchAntigravityUsage } from '../utils/antigravity-client.js';
import { formatUsageWithReset } from './usage-format.js';
import { debugLog } from '../utils/debug.js';

/**
 * Shared install check + fetch for both widgets
 */
async function getLimits(ctx: WidgetContext): Promise<AntigravityUsageLimits | null | 'uninstalled'> {
  const installed = await isAntigravityInstalled();
  debugLog('antigravity', 'isAntigravityInstalled:', installed);
  if (!installed) {
    return 'uninstalled';
  }

  const limits = await fetchAntigravityUsage(ctx.config.cache.ttlSeconds);
  debugLog('antigravity', 'fetchAntigravityUsage result:', limits);
  return limits;
}

export const antigravityUsageWidget: Widget<AntigravityUsageData> = {
  id: 'antigravityUsage',
  name: 'Antigravity Usage',

  async getData(ctx: WidgetContext): Promise<AntigravityUsageData | null> {
    const limits = await getLimits(ctx);
    if (limits === 'uninstalled') {
      return null;
    }
    if (!limits) {
      // Return error state instead of null to show warning indicator
      return { groups: [], isError: true };
    }

    return { groups: limits.groups };
  },

  render(data: AntigravityUsageData, ctx: WidgetContext): string {
    const theme = getTheme();
    const icon = colorize(ICON.antigravity, theme.info);

    if (data.isError) {
      return `${icon} Antigravity ${colorize(ICON.warning, theme.warning)}`;
    }

    if (data.groups.length === 0) {
      return `${icon} Antigravity ${colorize('--', theme.secondary)}`;
    }

    const parts = data.groups.map((group) => {
      const label = colorize(group.label, theme.secondary);
      if (group.usedPercent !== null) {
        return `${label} ${formatUsageWithReset(group.usedPercent, group.resetAt, ctx.translations)}`;
      }
      return `${label} ${colorize('--', theme.secondary)}`;
    });

    return `${icon} ${parts.join(` ${colorize('│', theme.dim)} `)}`;
  },
};

/**
 * Antigravity usage all widget - displays every model bucket
 */
export const antigravityUsageAllWidget: Widget<AntigravityUsageAllData> = {
  id: 'antigravityUsageAll',
  name: 'Antigravity Usage All',

  async getData(ctx: WidgetContext): Promise<AntigravityUsageAllData | null> {
    const limits = await getLimits(ctx);
    if (limits === 'uninstalled') {
      return null;
    }
    if (!limits) {
      return { buckets: [], isError: true };
    }

    return { buckets: limits.buckets };
  },

  render(data: AntigravityUsageAllData, ctx: WidgetContext): string {
    const theme = getTheme();
    const icon = colorize(ICON.antigravity, theme.info);

    if (data.isError) {
      return `${icon} Antigravity ${colorize(ICON.warning, theme.warning)}`;
    }

    if (data.buckets.length === 0) {
      return `${icon} Antigravity ${colorize('--', theme.secondary)}`;
    }

    const parts = data.buckets.map((bucket) => {
      if (bucket.usedPercent !== null) {
        return `${colorize(bucket.label, theme.secondary)}: ${formatUsageWithReset(bucket.usedPercent, bucket.resetAt, ctx.translations)}`;
      }
      return `${colorize(bucket.label, theme.secondary)}: ${colorize('--', theme.secondary)}`;
    });

    return `${icon} ${parts.join(` ${colorize('│', theme.dim)} `)}`;
  },
};
