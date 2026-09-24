/**
 * Agent status widget - displays running subagents
 *
 * Shows the subagent type, its model when resolvable (per-invocation `model`
 * parameter or `CLAUDE_CODE_SUBAGENT_MODEL`), and the task description:
 * `🤖 Agent: Explore(Opus): Searching codebase +1`
 * @handbook 3.3-widget-data-sources
 * @tested scripts/__tests__/widgets.test.ts
 */

import type { Widget } from './base.js';
import type { WidgetContext, AgentStatusData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';
import { ICON } from '../utils/emoji.js';
import { getTranscript, extractAgentStatus } from '../utils/transcript-parser.js';
import { shortenModelName, truncate } from '../utils/formatters.js';

export const agentStatusWidget: Widget<AgentStatusData> = {
  id: 'agentStatus',
  name: 'Agent Status',

  async getData(ctx: WidgetContext): Promise<AgentStatusData | null> {
    const transcript = await getTranscript(ctx);
    if (!transcript) return null;

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
      return colorize(
        `${t.widgets.agent}: ${data.completed} ${t.widgets.done}`,
        theme.secondary
      );
    }

    const activeAgent = data.active[0];
    // `opus` / `claude-opus-5` → `Opus`; unknown ids fall through unchanged
    const modelSuffix = activeAgent.model ? `(${shortenModelName(activeAgent.model)})` : '';
    const label = `${activeAgent.name}${modelSuffix}`;
    const agentText = activeAgent.description
      ? `${label}: ${truncate(activeAgent.description, 20)}`
      : label;
    const more = data.active.length > 1 ? ` +${data.active.length - 1}` : '';

    return `${colorize(ICON.robot, theme.info)} ${t.widgets.agent}: ${agentText}${more}`;
  },
};
