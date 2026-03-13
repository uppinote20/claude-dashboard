/**
 * Token speed widget - displays output token generation speed
 * Uses total_output_tokens / total_api_duration_ms from stdin.
 * @handbook 3.3-widget-data-sources
 */

import type { Widget } from './base.js';
import type { WidgetContext, TokenSpeedData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';

export const tokenSpeedWidget: Widget<TokenSpeedData> = {
  id: 'tokenSpeed',
  name: 'Token Speed',

  async getData(ctx: WidgetContext): Promise<TokenSpeedData | null> {
    const outputTokens = ctx.stdin.context_window?.total_output_tokens;
    const apiDurationMs = ctx.stdin.cost?.total_api_duration_ms;

    if (!outputTokens || !apiDurationMs || apiDurationMs <= 0) return null;

    const tokensPerSecond = outputTokens / (apiDurationMs / 1000);

    if (!Number.isFinite(tokensPerSecond) || tokensPerSecond <= 0) return null;

    return { tokensPerSecond };
  },

  render(data: TokenSpeedData, _ctx: WidgetContext): string {
    return colorize(`⚡ ${Math.round(data.tokensPerSecond)} tok/s`, getTheme().accent);
  },
};
