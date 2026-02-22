/**
 * Cost widget - displays session cost in USD
 */

import type { Widget } from './base.js';
import type { WidgetContext, CostData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';
import { formatCost } from '../utils/formatters.js';

export const costWidget: Widget<CostData> = {
  id: 'cost',
  name: 'Cost',

  async getData(ctx: WidgetContext): Promise<CostData | null> {
    const { cost } = ctx.stdin;

    return {
      totalCostUsd: cost?.total_cost_usd ?? 0,
    };
  },

  render(data: CostData): string {
    return colorize(formatCost(data.totalCostUsd), getTheme().accent);
  },
};
