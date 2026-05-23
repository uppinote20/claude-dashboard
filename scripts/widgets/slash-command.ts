/**
 * Slash command activity widget - displays the slash command that started
 * the current turn (e.g. `/superpowers:brainstorming`). Cleared when the
 * user sends a new plain-text message.
 * @handbook 3.3-widget-data-sources
 * @tested scripts/__tests__/widgets.test.ts
 */

import type { Widget } from './base.js';
import type { WidgetContext, SlashCommandData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';
import { getTranscript, getActiveSlashCommand } from '../utils/transcript-parser.js';

export const slashCommandWidget: Widget<SlashCommandData> = {
  id: 'slashCommand',
  name: 'Slash Command',

  async getData(ctx: WidgetContext): Promise<SlashCommandData | null> {
    const transcript = await getTranscript(ctx);
    if (!transcript) return null;
    return getActiveSlashCommand(transcript);
  },

  render(data: SlashCommandData, _ctx: WidgetContext): string {
    return `${colorize('🎯', getTheme().warning)} ${data.name}`;
  },
};
