/**
 * Background view: run_in_background jobs and async agents, running first.
 * @handbook 9.5-pane-views
 */

import { colorize } from '../utils/colors.js';
import { ICON } from '../utils/emoji.js';
import { formatElapsed, truncate } from '../utils/formatters.js';
import { dim, emptyLine, header, isSessionIdle, type ViewContext } from './shared.js';

const DESCRIPTION_CHARS = 40;
const SUMMARY_CHARS = 48;

export function renderBackground(v: ViewContext): string[] {
  const { t, theme, now } = v;
  const tasks = [...v.transcript.backgroundTasks.values()];
  if (tasks.length === 0) return [header(v, ICON.hourglass, t.background), emptyLine(v, t.emptyBackground)];

  const isRunning = (s: string) => s === 'running';
  tasks.sort((a, b) => Number(isRunning(b.status)) - Number(isRunning(a.status)) || b.startedAt - a.startedAt);
  const idle = isSessionIdle(v);
  const running = idle ? 0 : tasks.filter((x) => isRunning(x.status)).length;
  const lines = [header(v, ICON.hourglass, t.background, `${running} ${t.running}`, String(tasks.length))];

  for (const task of tasks) {
    const description = task.description ? `"${truncate(task.description, DESCRIPTION_CHARS)}"` : '';
    const elapsed = formatElapsed((task.endedAt ?? now) - task.startedAt);
    if (isRunning(task.status)) {
      // No notification arrived and the session went quiet: the job may have died with it.
      const marker = idle ? colorize(`? ${t.stale}`, theme.warning) : colorize('▶', theme.safe);
      const shown = idle ? '' : `  ${colorize(elapsed, theme.secondary)}`;
      lines.push(`${marker} ${colorize(task.kind, theme.model)}  ${description}${shown}`);
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
