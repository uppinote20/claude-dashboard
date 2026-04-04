/**
 * Vim mode widget - displays current vim mode (NORMAL/INSERT)
 * Only visible when vim mode is enabled in Claude Code.
 * @handbook 3.1-widget-interface
 * @handbook 3.3-widget-data-sources
 * @tested scripts/__tests__/widgets.test.ts
 */

import type { Widget } from './base.js';
import type { WidgetContext, VimModeData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';

export const vimModeWidget: Widget<VimModeData> = {
  id: 'vimMode',
  name: 'Vim Mode',

  async getData(ctx: WidgetContext): Promise<VimModeData | null> {
    const mode = ctx.stdin.vim?.mode;
    if (!mode) return null;
    return { mode };
  },

  render(data: VimModeData, _ctx: WidgetContext): string {
    const theme = getTheme();
    const color = data.mode === 'INSERT' ? theme.safe : theme.dim;
    return colorize(data.mode, color);
  },
};
