/**
 * Agent mode widget - displays this session's agent identity.
 *
 * - `stdin.agent.name`   → custom agent activated via `/agent <name>`  → 👤
 * - `stdin.agent_type`   → this session was dispatched as a subagent   → 🤖
 *
 * Distinct from `agentStatus` (which tracks subagents spawned BY this
 * session). Returns null when neither field is present.
 *
 * @handbook 3.3-widget-data-sources
 * @tested scripts/__tests__/widgets.test.ts
 */

import type { Widget } from './base.js';
import type { WidgetContext, AgentModeData } from '../types.js';

export const agentModeWidget: Widget<AgentModeData> = {
  id: 'agentMode',
  name: 'Agent Mode',

  async getData(ctx: WidgetContext): Promise<AgentModeData | null> {
    const agentName = ctx.stdin.agent?.name?.trim();
    const agentType = ctx.stdin.agent_type?.trim();
    if (!agentName && !agentType) return null;
    return {
      agentName: agentName || undefined,
      agentType: agentType || undefined,
    };
  },

  render(data: AgentModeData): string {
    const parts: string[] = [];
    if (data.agentName) parts.push(`👤 ${data.agentName}`);
    if (data.agentType) parts.push(`🤖 ${data.agentType}`);
    return parts.join(' · ');
  },
};
