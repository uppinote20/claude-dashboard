/**
 * Last Prompt widget - displays the most recent user prompt in the session
 * Data source: ~/.claude/history.jsonl (contains only actual user input)
 * @handbook 3.3-widget-data-sources
 */

import type { Widget } from './base.js';
import type { WidgetContext, LastPromptData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';
import { truncate } from '../utils/formatters.js';
import { getLastUserPrompt } from '../utils/history-parser.js';

export const lastPromptWidget: Widget<LastPromptData> = {
  id: 'lastPrompt',
  name: 'Last Prompt',

  async getData(ctx: WidgetContext): Promise<LastPromptData | null> {
    const sessionId = ctx.stdin.session_id;
    if (!sessionId) return null;

    return getLastUserPrompt(sessionId);
  },

  render(data: LastPromptData, _ctx: WidgetContext): string {
    const theme = getTheme();
    const timeStr = new Date(data.timestamp).toTimeString().slice(0, 5);
    return `💬 ${colorize(timeStr, theme.secondary)} ${truncate(data.text, 60)}`;
  },
};
