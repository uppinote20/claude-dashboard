/**
 * Context widgets - full display plus bar/percentage/usage sub-widgets
 * @handbook 3.3-widget-data-sources
 * @handbook 3.6-derived-widgets
 * @tested scripts/__tests__/widgets.test.ts
 */

import type { Widget } from './base.js';
import type { WidgetContext, ContextData } from '../types.js';
import { getColorForPercent, colorize, getSeparator } from '../utils/colors.js';
import { formatTokens, calculatePercent } from '../utils/formatters.js';
import { renderProgressBar } from '../utils/progress-bar.js';

async function getContextData(ctx: WidgetContext): Promise<ContextData | null> {
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
}

function renderBar(data: ContextData): string {
  return renderProgressBar(data.percentage);
}

function renderPercentage(data: ContextData): string {
  return colorize(`${data.percentage}%`, getColorForPercent(data.percentage));
}

function renderUsage(data: ContextData): string {
  return `${formatTokens(data.inputTokens)}/${formatTokens(data.contextSize)}`;
}

export const contextWidget: Widget<ContextData> = {
  id: 'context',
  name: 'Context',
  getData: getContextData,

  render(data: ContextData): string {
    return [renderBar(data), renderPercentage(data), renderUsage(data)].join(getSeparator());
  },
};

export const contextBarWidget: Widget<ContextData> = {
  id: 'contextBar',
  name: 'Context (Bar)',
  getData: getContextData,
  render: renderBar,
};

export const contextPercentageWidget: Widget<ContextData> = {
  id: 'contextPercentage',
  name: 'Context (Percentage)',
  getData: getContextData,
  render: renderPercentage,
};

export const contextUsageWidget: Widget<ContextData> = {
  id: 'contextUsage',
  name: 'Context (Usage)',
  getData: getContextData,
  render: renderUsage,
};
