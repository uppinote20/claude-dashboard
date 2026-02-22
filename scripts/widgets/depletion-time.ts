/**
 * Depletion time widget - estimates time until rate limit is reached
 */

import type { Widget } from './base.js';
import type { WidgetContext, DepletionTimeData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';
import { formatDuration } from '../utils/formatters.js';
import { getSessionElapsedMinutes } from '../utils/session.js';

/**
 * Maximum time to display depletion estimate (24 hours in minutes).
 * Beyond this, estimates become unreliable due to rate limit window resets.
 */
const MAX_DISPLAY_MINUTES = 24 * 60;

/**
 * Minimum utilization rate threshold (0.01% per minute).
 * Below this rate, estimated depletion time becomes extremely long (>160 hours)
 * and is not useful to display.
 */
const MIN_UTILIZATION_RATE = 0.01;

export const depletionTimeWidget: Widget<DepletionTimeData> = {
  id: 'depletionTime',
  name: 'Depletion Time',

  async getData(ctx: WidgetContext): Promise<DepletionTimeData | null> {
    const utilization = ctx.rateLimits?.five_hour?.utilization;
    if (!utilization || utilization < 1) return null;

    const elapsedMinutes = await getSessionElapsedMinutes(ctx, 0);
    if (elapsedMinutes === null || elapsedMinutes === 0) return null;

    // APPROXIMATION: Assumes all current utilization came from this session.
    // This may be inaccurate if:
    // - Session started with pre-existing usage from previous 5 hours
    // - Multiple concurrent sessions are running
    // The estimate improves as session runs longer.
    const utilizationPerMinute = utilization / elapsedMinutes;
    if (utilizationPerMinute < MIN_UTILIZATION_RATE) return null;

    const minutesToLimit = (100 - utilization) / utilizationPerMinute;

    // Guard against invalid values
    if (!Number.isFinite(minutesToLimit) || minutesToLimit < 0) return null;
    if (minutesToLimit > MAX_DISPLAY_MINUTES) return null;

    return {
      minutesToLimit: Math.round(minutesToLimit),
      limitType: '5h',
    };
  },

  render(data: DepletionTimeData, ctx: WidgetContext): string {
    const duration = formatDuration(data.minutesToLimit * 60 * 1000, ctx.translations.time);
    return colorize(`⏳ ~${duration} to ${data.limitType}`, getTheme().warning);
  },
};
