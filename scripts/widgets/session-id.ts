/**
 * Session ID widgets - display session identifier (short or full)
 */

import type { Widget } from './base.js';
import type { WidgetContext, SessionIdData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';

async function getSessionIdData(ctx: WidgetContext): Promise<SessionIdData | null> {
  const sessionId = ctx.stdin.session_id;
  if (!sessionId) return null;

  return {
    sessionId,
    shortId: sessionId.slice(0, 8),
  };
}

export const sessionIdWidget: Widget<SessionIdData> = {
  id: 'sessionId',
  name: 'Session ID (Short)',
  getData: getSessionIdData,

  render(data: SessionIdData): string {
    return colorize(`\u{1F511} ${data.shortId}`, getTheme().secondary);
  },
};

export const sessionIdFullWidget: Widget<SessionIdData> = {
  id: 'sessionIdFull',
  name: 'Session ID (Full)',
  getData: getSessionIdData,

  render(data: SessionIdData): string {
    return colorize(`\u{1F511} ${data.sessionId}`, getTheme().secondary);
  },
};
