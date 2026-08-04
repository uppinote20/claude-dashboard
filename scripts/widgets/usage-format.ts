/**
 * Shared presentation helpers for per-CLI usage widgets
 * @handbook 3.3-widget-data-sources
 * @tested scripts/__tests__/widgets.test.ts
 */

import type { Translations } from '../types.js';
import { getColorForPercent, colorize } from '../utils/colors.js';
import { formatTimeRemaining } from '../utils/formatters.js';

/**
 * Format a color-coded "NN%" with an optional "(reset countdown)" suffix.
 */
export function formatUsageWithReset(
  percent: number,
  resetAt: string | null,
  translations: Translations
): string {
  const result = colorize(`${Math.round(percent)}%`, getColorForPercent(percent));
  if (!resetAt) {
    return result;
  }
  const resetTime = formatTimeRemaining(new Date(resetAt), translations);
  return resetTime ? `${result} (${resetTime})` : result;
}
