/**
 * Lines Changed widget - displays lines added/removed as coding productivity metric
 * @handbook 3.3-widget-data-sources
 */

import type { Widget } from './base.js';
import type { WidgetContext, LinesChangedData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';

export const linesChangedWidget: Widget<LinesChangedData> = {
  id: 'linesChanged',
  name: 'Lines Changed',

  async getData(ctx: WidgetContext): Promise<LinesChangedData | null> {
    const added = ctx.stdin.cost?.total_lines_added;
    const removed = ctx.stdin.cost?.total_lines_removed;
    if ((added == null && removed == null) || (added === 0 && removed === 0)) return null;
    return { added: added ?? 0, removed: removed ?? 0 };
  },

  render(data: LinesChangedData, _ctx: WidgetContext): string {
    const theme = getTheme();
    const parts: string[] = [];
    if (data.added > 0) parts.push(colorize(`+${data.added}`, theme.safe));
    if (data.removed > 0) parts.push(colorize(`-${data.removed}`, theme.danger));
    return parts.join(' ');
  },
};
