/**
 * Version widget - displays Claude Code version
 * @handbook 3.3-widget-data-sources
 * @tested scripts/__tests__/widgets.test.ts
 */

import type { Widget } from './base.js';
import type { WidgetContext, VersionData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';

export const versionWidget: Widget<VersionData> = {
  id: 'version',
  name: 'Version',

  async getData(ctx: WidgetContext): Promise<VersionData | null> {
    const version = ctx.stdin.version;
    if (!version) return null;
    return { version };
  },

  render(data: VersionData, _ctx: WidgetContext): string {
    return colorize(`v${data.version}`, getTheme().dim);
  },
};
