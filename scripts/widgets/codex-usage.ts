/**
 * Codex usage widget - displays OpenAI Codex CLI usage limits
 * Shows model, 5h and 7d usage in a single line
 */

import type { Widget } from './base.js';
import type { WidgetContext, CodexUsageData, Translations } from '../types.js';
import { COLORS, getColorForPercent, colorize } from '../utils/colors.js';
import { isCodexInstalled, fetchCodexUsage } from '../utils/codex-client.js';
import { formatTimeRemaining } from '../utils/formatters.js';
import { debugLog } from '../utils/debug.js';

/**
 * Format rate limit with optional reset time
 */
function formatRateLimit(
  label: string,
  percent: number,
  resetAt: number | null,
  t: Translations
): string {
  const color = getColorForPercent(percent);
  let result = `${label}: ${colorize(`${Math.round(percent)}%`, color)}`;

  if (resetAt) {
    const resetTime = formatTimeRemaining(new Date(resetAt * 1000), t);
    if (resetTime) {
      result += ` (${resetTime})`;
    }
  }

  return result;
}

export const codexUsageWidget: Widget<CodexUsageData> = {
  id: 'codexUsage',
  name: 'Codex Usage',

  async getData(ctx: WidgetContext): Promise<CodexUsageData | null> {
    const installed = await isCodexInstalled();
    debugLog('codex', 'isCodexInstalled:', installed);
    if (!installed) {
      return null;
    }

    const limits = await fetchCodexUsage(ctx.config.cache.ttlSeconds);
    debugLog('codex', 'fetchCodexUsage result:', limits);
    if (!limits) {
      return null;
    }

    return {
      model: limits.model,
      planType: limits.planType,
      primaryPercent: limits.primary?.usedPercent ?? null,
      primaryResetAt: limits.primary?.resetAt ?? null,
      secondaryPercent: limits.secondary?.usedPercent ?? null,
      secondaryResetAt: limits.secondary?.resetAt ?? null,
    };
  },

  render(data: CodexUsageData, ctx: WidgetContext): string {
    const { translations: t } = ctx;
    const parts: string[] = [];

    parts.push(`${colorize('🔷', COLORS.blue)} ${data.model}`);

    if (data.primaryPercent !== null) {
      parts.push(formatRateLimit(t.labels['5h'], data.primaryPercent, data.primaryResetAt, t));
    }

    if (data.secondaryPercent !== null) {
      parts.push(formatRateLimit(t.labels['7d'], data.secondaryPercent, data.secondaryResetAt, t));
    }

    return parts.join(` ${colorize('│', COLORS.dim)} `);
  },
};
