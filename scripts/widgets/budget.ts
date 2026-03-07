/**
 * Budget tracking widget - displays daily spending vs budget limit
 * @handbook 3.3-widget-data-sources
 */

import type { Widget } from './base.js';
import type { WidgetContext, BudgetData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';
import { formatCost } from '../utils/formatters.js';
import { recordCostAndGetDaily } from '../utils/budget.js';

const WARNING_THRESHOLD = 0.80;
const DANGER_THRESHOLD = 0.95;

export const budgetWidget: Widget<BudgetData> = {
  id: 'budget',
  name: 'Budget',

  async getData(ctx: WidgetContext): Promise<BudgetData | null> {
    const { dailyBudget } = ctx.config;
    if (!dailyBudget || dailyBudget <= 0) return null;

    const sessionCost = ctx.stdin.cost?.total_cost_usd ?? 0;
    const sessionId = ctx.stdin.session_id || 'default';
    const dailyTotal = await recordCostAndGetDaily(sessionId, sessionCost);

    return {
      dailyTotal,
      dailyBudget,
      utilization: Math.min(1, dailyTotal / dailyBudget),
    };
  },

  render(data: BudgetData, _ctx: WidgetContext): string {
    const theme = getTheme();
    const percent = Math.round(data.utilization * 100);

    let color: string;
    let icon: string;

    if (data.utilization >= DANGER_THRESHOLD) {
      color = theme.danger;
      icon = '🚨';
    } else if (data.utilization >= WARNING_THRESHOLD) {
      color = theme.warning;
      icon = '⚠️';
    } else {
      color = theme.safe;
      icon = '💵';
    }

    return `${icon} ${colorize(`${formatCost(data.dailyTotal)}`, color)} / ${colorize(formatCost(data.dailyBudget), theme.secondary)} ${colorize(`(${percent}%)`, color)}`;
  },
};
