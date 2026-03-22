/**
 * Session name widget - displays custom session label from /rename
 * @handbook 3.3-widget-data-sources
 * @tested scripts/__tests__/widgets.test.ts
 */

import type { Widget } from './base.js';
import type { WidgetContext, SessionNameData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';
import { getTranscript } from '../utils/transcript-parser.js';
import { truncate } from '../utils/formatters.js';

export const sessionNameWidget: Widget<SessionNameData> = {
  id: 'sessionName',
  name: 'Session Name',

  async getData(ctx: WidgetContext): Promise<SessionNameData | null> {
    const transcript = await getTranscript(ctx);
    if (!transcript?.sessionName) return null;

    return { name: transcript.sessionName };
  },

  render(data: SessionNameData, _ctx: WidgetContext): string {
    return colorize(`» ${truncate(data.name, 20)}`, getTheme().secondary);
  },
};
