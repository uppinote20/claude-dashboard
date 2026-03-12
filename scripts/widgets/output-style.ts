/**
 * Output Style widget - displays current output style when non-default
 * @handbook 3.3-widget-data-sources
 */

import type { Widget } from './base.js';
import type { WidgetContext, OutputStyleData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';

export const outputStyleWidget: Widget<OutputStyleData> = {
  id: 'outputStyle',
  name: 'Output Style',

  async getData(ctx: WidgetContext): Promise<OutputStyleData | null> {
    const name = ctx.stdin.output_style?.name;
    if (!name || name === 'default') return null;
    return { styleName: name };
  },

  render(data: OutputStyleData, _ctx: WidgetContext): string {
    return colorize(data.styleName, getTheme().dim);
  },
};
