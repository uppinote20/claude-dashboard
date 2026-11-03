/**
 * Background view: run_in_background jobs and async agents, running first.
 * @handbook 9.5-pane-views
 * @tested scripts/__tests__/pane-views.test.ts
 */

import { colorize } from '../utils/colors.js';
import { ICON } from '../utils/emoji.js';
import { formatElapsed, truncate } from '../utils/formatters.js';
import { dim, emptyView, header, isSessionIdle, runningMarker, type ViewContext } from './shared.js';

const DESCRIPTION_CHARS = 40;
const SUMMARY_CHARS = 48;

export function renderBackground(v: ViewContext): string[] {
  const { t, theme, now } = v;
  const tasks = [...v.transcript.backgroundTasks.values()];
  if (tasks.length === 0) return emptyView(v, ICON.hourglass, t.background, t.emptyBackground);

  tasks.sort((a, b) => Number(b.status === 'running') - Number(a.status === 'running') || b.startedAt - a.startedAt);
  // No notification arrived and the session went quiet: a running job may have died with it.
  const idle = isSessionIdle(v);
  const running = idle ? 0 : tasks.filter((x) => x.status === 'running').length;
  const lines = [header(v, ICON.hourglass, t.background, `${running} ${t.running}`, String(tasks.length))];

  for (const task of tasks) {
    const description = task.description ? `"${truncate(task.description, DESCRIPTION_CHARS)}"` : '';
    const elapsed = formatElapsed((task.endedAt ?? now) - task.startedAt);
    if (task.status === 'running') {
      const shown = idle ? '' : `  ${colorize(elapsed, theme.secondary)}`;
      lines.push(`${runningMarker(v, idle)} ${colorize(task.kind, theme.model)}  ${description}${shown}`);
      continue;
    }
    const summary = task.summary ? `  ${truncate(task.summary, SUMMARY_CHARS)}` : '';
    if (task.status === 'completed') {
      lines.push(dim(v, `✓ ${task.kind}  ${description}  ${elapsed}${summary}`));
    } else {
      lines.push(`${colorize(`✗ ${task.status}`, theme.danger)} ${task.kind}  ${description}  ${colorize(elapsed + summary, theme.secondary)}`);
    }
  }
  return lines;
}
