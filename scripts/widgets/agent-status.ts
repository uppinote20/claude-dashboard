/**
 * Agent status widget - displays running subagents
 */

import type { Widget } from './base.js';
import type { WidgetContext, AgentStatusData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';
import { parseTranscript, extractAgentStatus } from '../utils/transcript-parser.js';

export const agentStatusWidget: Widget<AgentStatusData> = {
  id: 'agentStatus',
  name: 'Agent Status',

  async getData(ctx: WidgetContext): Promise<AgentStatusData | null> {
    const transcriptPath = ctx.stdin.transcript_path;
    if (!transcriptPath) {
      return null;
    }

    const transcript = await parseTranscript(transcriptPath);
    if (!transcript) {
      return null;
    }

    const status = extractAgentStatus(transcript);

    // Only show if there are active agents or completed agents
    if (status.active.length === 0 && status.completed === 0) {
      return null;
    }

    return status;
  },

  render(data: AgentStatusData, ctx: WidgetContext): string {
    const { translations: t } = ctx;

    const theme = getTheme();

    if (data.active.length === 0) {
      // No active agents, show completed count
      return colorize(
        `${t.widgets.agent}: ${data.completed} ${t.widgets.done}`,
        theme.secondary
      );
    }

    // Show active agent(s)
    const activeAgent = data.active[0];
    const agentText = activeAgent.description
      ? `${activeAgent.name}: ${activeAgent.description.slice(0, 20)}${activeAgent.description.length > 20 ? '...' : ''}`
      : activeAgent.name;

    const more = data.active.length > 1 ? ` +${data.active.length - 1}` : '';

    return `${colorize('🤖', theme.info)} ${t.widgets.agent}: ${agentText}${more}`;
  },
};
