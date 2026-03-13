/**
 * Session name widget - displays custom session label from /rename
 * @handbook 3.3-widget-data-sources
 */

import type { Widget } from './base.js';
import type { WidgetContext, SessionNameData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';
import { parseTranscript } from '../utils/transcript-parser.js';
import { truncate } from '../utils/formatters.js';

export const sessionNameWidget: Widget<SessionNameData> = {
  id: 'sessionName',
  name: 'Session Name',

  async getData(ctx: WidgetContext): Promise<SessionNameData | null> {
    const transcriptPath = ctx.stdin.transcript_path;
    if (!transcriptPath) return null;

    const transcript = await parseTranscript(transcriptPath);
    if (!transcript?.sessionName) return null;

    return { name: transcript.sessionName };
  },

  render(data: SessionNameData, _ctx: WidgetContext): string {
    return colorize(`» ${truncate(data.name, 20)}`, getTheme().secondary);
  },
};
