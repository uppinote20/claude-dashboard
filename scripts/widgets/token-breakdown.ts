/**
 * Token breakdown widget - displays input/cache_write/cache_read token breakdown
 * @handbook 3.3-widget-data-sources
 * @tested scripts/__tests__/widgets.test.ts
 */

import type { Widget } from './base.js';
import type { WidgetContext, TokenBreakdownData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';
import { formatTokens } from '../utils/formatters.js';

export const tokenBreakdownWidget: Widget<TokenBreakdownData> = {
  id: 'tokenBreakdown',
  name: 'Token Breakdown',

  async getData(ctx: WidgetContext): Promise<TokenBreakdownData | null> {
    const usage = ctx.stdin.context_window?.current_usage;
    if (!usage) return null;

    const { input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens } = usage;
    const total = input_tokens + output_tokens + cache_creation_input_tokens + cache_read_input_tokens;

    // Hide if no tokens yet
    if (total === 0) return null;

    return {
      inputTokens: input_tokens,
      outputTokens: output_tokens,
      cacheWriteTokens: cache_creation_input_tokens,
      cacheReadTokens: cache_read_input_tokens,
    };
  },

  render(data: TokenBreakdownData, _ctx: WidgetContext): string {
    const theme = getTheme();

    const parts: string[] = [];
    if (data.inputTokens > 0) parts.push(`${colorize('In', theme.info)} ${formatTokens(data.inputTokens)}`);
    if (data.outputTokens > 0) parts.push(`${colorize('Out', theme.accent)} ${formatTokens(data.outputTokens)}`);
    if (data.cacheWriteTokens > 0) parts.push(`${colorize('W', theme.warning)} ${formatTokens(data.cacheWriteTokens)}`);
    if (data.cacheReadTokens > 0) parts.push(`${colorize('R', theme.safe)} ${formatTokens(data.cacheReadTokens)}`);
    return `📊 ${parts.join(colorize(' · ', theme.secondary))}`;
  },
};
