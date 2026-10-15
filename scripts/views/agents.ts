/**
 * Agents view: this session's subagents, running first.
 * @handbook 9.5-pane-views
 * @tested scripts/__tests__/pane-views.test.ts
 */

import { colorize } from '../utils/colors.js';
import { ICON } from '../utils/emoji.js';
import { formatElapsed, truncate } from '../utils/formatters.js';
import type { SubagentInfo } from '../utils/subagents.js';
import { dim, emptyView, header, modelLabel, runningMarker, type ViewContext } from './shared.js';

const DESCRIPTION_CHARS = 32;

export function renderAgents(v: ViewContext, agents: SubagentInfo[]): string[] {
  const { t, theme, now } = v;
  if (agents.length === 0) return emptyView(v, ICON.robot, t.agents, t.emptyAgents);

  const running = agents.filter((a) => a.status === 'running').length;
  const lines = [header(v, ICON.robot, t.agents, `${running} ${t.running}`, `${agents.length}`)];

  for (const a of agents) {
    const end = a.status === 'running' ? now : (a.lastAt ?? now);
    const elapsed = a.startedAt ? formatElapsed(end - a.startedAt) : '';
    const details = [
      a.model ? modelLabel(a.model) : '',
      a.description ? `"${truncate(a.description, DESCRIPTION_CHARS)}"` : '',
      elapsed,
      `${ICON.wrench}${a.tools}`,
    ].filter(Boolean).join('  ');

    if (a.status === 'done') {
      lines.push(dim(v, `✓ ${a.type}  ${details}`));
      continue;
    }
    if (a.status === 'failed') {
      lines.push(`${colorize(`✗ ${a.endStatus}`, theme.danger)} ${a.type}  ${colorize(details, theme.secondary)}`);
      continue;
    }
    const tool = a.runningTool ? `  ${colorize(a.runningTool, theme.info)}` : '';
    lines.push(`${runningMarker(v, a.status === 'stale')} ${colorize(a.type, theme.model)}  ${colorize(details, theme.secondary)}${tool}`);
  }
  return lines;
}
