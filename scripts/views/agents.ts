/**
 * Agents view: this session's subagents, running first.
 * @handbook 9.5-pane-views
 */

import { colorize } from '../utils/colors.js';
import { ICON } from '../utils/emoji.js';
import { formatElapsed, truncate } from '../utils/formatters.js';
import type { SubagentInfo } from '../utils/subagents.js';
import { dim, emptyLine, header, modelLabel, type ViewContext } from './shared.js';

const DESCRIPTION_CHARS = 32;

export function renderAgents(v: ViewContext, agents: SubagentInfo[]): string[] {
  const { t, theme, now } = v;
  if (agents.length === 0) return [header(v, ICON.robot, t.agents), emptyLine(v, t.emptyAgents)];

  // An async agent's task-notification in the main transcript is authoritative: an agent
  // stopped by the user never writes a final end_turn record of its own.
  agents = agents.map((a) => {
    const notified = v.transcript.backgroundTasks.get(a.id);
    return a.status !== 'done' && notified && notified.status !== 'running' ? { ...a, status: 'done' } : a;
  });
  const running = agents.filter((a) => a.status === 'running').length;
  const lines = [header(v, ICON.robot, t.agents, `${running} ${t.running}`, `${agents.length}`)];

  for (const a of agents) {
    const end = a.status === 'running' ? now : (a.lastAt ?? now);
    const elapsed = a.startedAt ? formatElapsed(end - a.startedAt) : '';
    const parts = [
      a.type,
      a.model ? modelLabel(a.model) : '',
      a.description ? `"${truncate(a.description, DESCRIPTION_CHARS)}"` : '',
      elapsed,
      `${ICON.wrench}${a.tools}`,
    ].filter(Boolean);

    if (a.status === 'done') {
      lines.push(dim(v, `✓ ${parts.join('  ')}`));
      continue;
    }
    const marker = a.status === 'stale' ? colorize(`? ${t.stale}`, theme.warning) : colorize('▶', theme.safe);
    const [type, ...rest] = parts;
    const tool = a.runningTool ? `  ${colorize(a.runningTool, theme.info)}` : '';
    lines.push(`${marker} ${colorize(type, theme.model)}  ${colorize(rest.join('  '), theme.secondary)}${tool}`);
  }
  return lines;
}
