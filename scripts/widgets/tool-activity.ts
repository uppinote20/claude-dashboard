/**
 * Tool activity widget - displays running and completed tools
 * @handbook 3.3-widget-data-sources
 * @tested scripts/__tests__/widgets.test.ts
 */

import type { Widget } from './base.js';
import type { WidgetContext, ToolActivityData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';
import {
  getTranscript,
  getRunningTools,
  getCompletedToolCount,
} from '../utils/transcript-parser.js';

export const toolActivityWidget: Widget<ToolActivityData> = {
  id: 'toolActivity',
  name: 'Tool Activity',

  async getData(ctx: WidgetContext): Promise<ToolActivityData | null> {
    const transcript = await getTranscript(ctx);
    if (!transcript) return null;

    const running = getRunningTools(transcript);
    const completed = getCompletedToolCount(transcript);

    return { running, completed };
  },

  render(data: ToolActivityData, ctx: WidgetContext): string {
    const { translations: t } = ctx;
    const theme = getTheme();

    if (data.running.length === 0) {
      return colorize(
        `${t.widgets.tools}: ${data.completed} ${t.widgets.done}`,
        theme.secondary
      );
    }

    const runningNames = data.running
      .slice(0, 2)
      .map((r) => r.target ? `${r.name}(${r.target})` : r.name)
      .join(', ');
    const more = data.running.length > 2 ? ` +${data.running.length - 2}` : '';

    return `${colorize('⚙️', theme.warning)} ${runningNames}${more} (${data.completed} ${t.widgets.done})`;
  },
};
