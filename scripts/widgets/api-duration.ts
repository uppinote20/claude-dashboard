/**
 * API Duration widget - shows percentage of session time spent waiting for API
 * @handbook 3.1-widget-interface
 * @handbook 3.3-widget-data-sources
 * @tested scripts/__tests__/widgets.test.ts
 */

import type { Widget } from './base.js';
import type { WidgetContext, ApiDurationData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';

export const apiDurationWidget: Widget<ApiDurationData> = {
  id: 'apiDuration',
  name: 'API Duration',

  async getData(ctx: WidgetContext): Promise<ApiDurationData | null> {
    const totalMs = ctx.stdin.cost?.total_duration_ms;
    const apiMs = ctx.stdin.cost?.total_api_duration_ms;
    if (!totalMs || !apiMs || totalMs <= 0) return null;

    const percentage = Math.round((apiMs / totalMs) * 100);
    return { percentage: Math.min(percentage, 100) };
  },

  render(data: ApiDurationData, ctx: WidgetContext): string {
    const theme = getTheme();
    const color = data.percentage > 70 ? theme.warning : theme.dim;
    return colorize(`${ctx.translations.widgets.apiDuration} ${data.percentage}%`, color);
  },
};
