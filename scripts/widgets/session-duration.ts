/**
 * Session duration widget - displays how long the session has been running
 */

import type { Widget } from './base.js';
import type { WidgetContext, SessionDurationData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';
import { formatDuration } from '../utils/formatters.js';
import { getSessionElapsedMs } from '../utils/session.js';

export const sessionDurationWidget: Widget<SessionDurationData> = {
  id: 'sessionDuration',
  name: 'Session Duration',

  async getData(ctx: WidgetContext): Promise<SessionDurationData | null> {
    // Use session_id if available, otherwise use a default
    const sessionId = ctx.stdin.session_id || 'default';
    const elapsedMs = await getSessionElapsedMs(sessionId);

    return { elapsedMs };
  },

  render(data: SessionDurationData, ctx: WidgetContext): string {
    const { translations: t } = ctx;
    const duration = formatDuration(data.elapsedMs, t.time);
    return colorize(`⏱ ${duration}`, getTheme().secondary);
  },
};
