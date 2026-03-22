/**
 * Cost forecast widget - estimates hourly cost based on current session rate
 * @handbook 3.3-widget-data-sources
 * @tested scripts/__tests__/widgets.test.ts
 */

import type { Widget } from './base.js';
import type { WidgetContext, ForecastData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';
import { formatCost } from '../utils/formatters.js';
import { getSessionElapsedMinutes } from '../utils/session.js';

export const forecastWidget: Widget<ForecastData> = {
  id: 'forecast',
  name: 'Cost Forecast',

  async getData(ctx: WidgetContext): Promise<ForecastData | null> {
    const totalCost = ctx.stdin.cost?.total_cost_usd ?? 0;
    if (totalCost <= 0) return null;

    const elapsedMinutes = await getSessionElapsedMinutes(ctx, 1);
    if (elapsedMinutes === null || elapsedMinutes === 0) return null;

    const costPerMinute = totalCost / elapsedMinutes;
    const hourlyCost = costPerMinute * 60;

    if (!Number.isFinite(hourlyCost) || hourlyCost < 0) return null;

    return {
      currentCost: totalCost,
      hourlyCost,
    };
  },

  render(data: ForecastData, _ctx: WidgetContext): string {
    const theme = getTheme();

    let hourlyColor: string;
    if (data.hourlyCost > 10) {
      hourlyColor = theme.danger;
    } else if (data.hourlyCost > 5) {
      hourlyColor = theme.warning;
    } else {
      hourlyColor = theme.safe;
    }

    return `📈 ${colorize(formatCost(data.currentCost), theme.accent)} → ${colorize(`~${formatCost(data.hourlyCost)}/h`, hourlyColor)}`;
  },
};
