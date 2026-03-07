/**
 * Burn rate widget - displays tokens consumed per minute
 * @handbook 3.3-widget-data-sources
 */

import type { Widget } from './base.js';
import type { WidgetContext, BurnRateData } from '../types.js';
import { formatTokens } from '../utils/formatters.js';
import { getSessionElapsedMinutes } from '../utils/session.js';
import { debugLog } from '../utils/debug.js';

export const burnRateWidget: Widget<BurnRateData> = {
  id: 'burnRate',
  name: 'Burn Rate',

  async getData(ctx: WidgetContext): Promise<BurnRateData | null> {
    const usage = ctx.stdin.context_window?.current_usage;

    let elapsedMinutes: number | null;
    try {
      elapsedMinutes = await getSessionElapsedMinutes(ctx, 0);
    } catch (error) {
      debugLog('burnRate', 'Failed to get session elapsed time', error);
      return null;
    }
    if (elapsedMinutes === null) return null;

    // Show 0/min at session start or when no usage data
    if (!usage || elapsedMinutes === 0) {
      return { tokensPerMinute: 0 };
    }

    const totalTokens =
      usage.input_tokens +
      usage.output_tokens +
      usage.cache_creation_input_tokens +
      usage.cache_read_input_tokens;

    // Show 0/min if no tokens used yet
    if (totalTokens === 0) {
      return { tokensPerMinute: 0 };
    }

    const tokensPerMinute = totalTokens / elapsedMinutes;

    // Guard against invalid values
    if (!Number.isFinite(tokensPerMinute) || tokensPerMinute < 0) {
      return null;
    }

    return { tokensPerMinute };
  },

  render(data: BurnRateData, _ctx: WidgetContext): string {
    return `🔥 ${formatTokens(Math.round(data.tokensPerMinute))}/min`;
  },
};
