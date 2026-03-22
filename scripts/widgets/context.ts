/**
 * Context widget - displays progress bar, percentage, and token count
 * @handbook 3.3-widget-data-sources
 * @tested scripts/__tests__/widgets.test.ts
 */

import type { Widget } from './base.js';
import type { WidgetContext, ContextData } from '../types.js';
import { getColorForPercent, colorize, getSeparator } from '../utils/colors.js';
import { formatTokens, calculatePercent } from '../utils/formatters.js';
import { renderProgressBar, DEFAULT_PROGRESS_BAR_CONFIG } from '../utils/progress-bar.js';

export const contextWidget: Widget<ContextData> = {
  id: 'context',
  name: 'Context',

  async getData(ctx: WidgetContext): Promise<ContextData | null> {
    const { context_window } = ctx.stdin;
    const usage = context_window?.current_usage;
    const contextSize = context_window?.context_window_size || 200000;
    const officialPercent = context_window?.used_percentage;

    if (!usage) {
      return {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        contextSize,
        percentage: typeof officialPercent === 'number' ? Math.round(officialPercent) : 0,
      };
    }

    const inputTokens =
      usage.input_tokens +
      usage.cache_creation_input_tokens +
      usage.cache_read_input_tokens;
    const outputTokens = usage.output_tokens;
    const totalTokens = inputTokens + outputTokens;
    const percentage = typeof officialPercent === 'number'
      ? Math.round(officialPercent)
      : calculatePercent(inputTokens, contextSize);

    return {
      inputTokens,
      outputTokens,
      totalTokens,
      contextSize,
      percentage,
    };
  },

  render(data: ContextData, _ctx: WidgetContext): string {
    const parts: string[] = [];

    // Progress bar
    parts.push(renderProgressBar(data.percentage));

    // Percentage with color
    const percentColor = getColorForPercent(data.percentage);
    parts.push(colorize(`${data.percentage}%`, percentColor));

    // Token count
    parts.push(
      `${formatTokens(data.inputTokens)}/${formatTokens(data.contextSize)}`
    );

    return parts.join(getSeparator());
  },
};
