/**
 * Model widget - displays current Claude model name
 */

import type { Widget } from './base.js';
import type { WidgetContext, ModelData } from '../types.js';
import { COLORS, RESET } from '../utils/colors.js';
import { shortenModelName } from '../utils/formatters.js';
import { isZaiProvider } from '../utils/provider.js';

/**
 * Check if the model is Sonnet 5 with 1M context window
 */
function isSonnet5With1M(data: ModelData): boolean {
  const lower = data.displayName.toLowerCase();
  const isSonnet5 = /sonnet\s*5|5\s*sonnet/.test(lower);

  if (!isSonnet5) return false;

  return data.contextWindowSize === 1_000_000 || lower.includes('1m');
}

/**
 * Get display name for model, handling Sonnet 5 1M special case
 */
function getDisplayName(data: ModelData): string {
  if (isSonnet5With1M(data)) {
    return 'Sonnet5 1M';
  }
  return shortenModelName(data.displayName);
}

export const modelWidget: Widget<ModelData> = {
  id: 'model',
  name: 'Model',

  async getData(ctx: WidgetContext): Promise<ModelData | null> {
    const { model, context_window } = ctx.stdin;

    return {
      id: model?.id || '',
      displayName: model?.display_name || '-',
      contextWindowSize: context_window?.context_window_size,
    };
  },

  render(data: ModelData): string {
    const shortName = getDisplayName(data);
    // z.ai/ZHIPU uses orange circle, Anthropic uses robot emoji
    const icon = isZaiProvider() ? '🟠' : '🤖';
    return `${COLORS.pastelCyan}${icon} ${shortName}${RESET}`;
  },
};
