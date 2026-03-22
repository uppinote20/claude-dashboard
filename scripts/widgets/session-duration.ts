/**
 * Session duration widget - displays how long the session has been running
 * @handbook 3.3-widget-data-sources
 * @tested scripts/__tests__/widgets.test.ts
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
    // Prefer stdin total_duration_ms when available (direct from Claude Code)
    const stdinDuration = ctx.stdin.cost?.total_duration_ms;
    if (typeof stdinDuration === 'number' && stdinDuration > 0) {
      return { elapsedMs: stdinDuration };
    }

    // Fallback to file-based session tracking
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
