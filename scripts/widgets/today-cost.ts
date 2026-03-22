/**
 * Today cost widget - displays total spending across all sessions today
 * Reuses budget.ts delta tracking to prevent double-counting.
 * @handbook 3.3-widget-data-sources
 * @tested scripts/__tests__/widgets.test.ts
 */

import type { Widget } from './base.js';
import type { WidgetContext, TodayCostData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';
import { formatCost } from '../utils/formatters.js';
import { recordCostAndGetDaily } from '../utils/budget.js';

export const todayCostWidget: Widget<TodayCostData> = {
  id: 'todayCost',
  name: 'Today Cost',

  async getData(ctx: WidgetContext): Promise<TodayCostData | null> {
    const sessionCost = ctx.stdin.cost?.total_cost_usd ?? 0;
    const sessionId = ctx.stdin.session_id || 'default';
    const dailyTotal = await recordCostAndGetDaily(sessionId, sessionCost);

    if (dailyTotal <= 0) return null;

    return { dailyTotal };
  },

  render(data: TodayCostData, ctx: WidgetContext): string {
    const { translations: t } = ctx;
    return colorize(`💰 ${t.widgets.todayCost}: ${formatCost(data.dailyTotal)}`, getTheme().secondary);
  },
};
