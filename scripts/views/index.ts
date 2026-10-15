/**
 * Pane views: session history and activity drawn in the mod pane instead of the widget
 * dashboard (`/claude-dashboard-pane turns|agents|files|todos|errors|bg`). Each view reads
 * the incremental transcript parse; agents and files also scan subagent transcripts.
 * @handbook 9.5-pane-views
 * @tested scripts/__tests__/pane-views.test.ts
 */

import type { WidgetContext } from '../types.js';
import type { SessionView } from '../mod/toggle.js';
import { colorize, getTheme } from '../utils/colors.js';
import { getTranscript } from '../utils/transcript-parser.js';
import { listSubagents } from '../utils/subagents.js';
import { makeViewContext } from './shared.js';
import { renderTurns } from './turns.js';
import { renderAgents } from './agents.js';
import { renderFiles } from './files.js';
import { renderTodos } from './todos.js';
import { renderErrors } from './errors.js';
import { renderBackground } from './background.js';

// Files a subagent wrote stay relevant after it finishes, so look further back than the agents view.
const MAX_FILE_AGENTS = 100;

export async function renderPaneView(view: SessionView, ctx: WidgetContext, now = Date.now()): Promise<string> {
  const transcript = await getTranscript(ctx);
  if (!transcript) return colorize(ctx.translations.paneViews.noTranscript, getTheme().secondary);

  const v = makeViewContext(ctx, transcript, now);
  const transcriptPath = ctx.stdin.transcript_path!;
  let lines: string[];
  switch (view) {
    case 'turns':
      lines = renderTurns(v);
      break;
    case 'agents':
      lines = renderAgents(v, await listSubagents(transcriptPath, now, undefined, transcript.backgroundTasks));
      break;
    case 'files':
      lines = renderFiles(v, await listSubagents(transcriptPath, now, MAX_FILE_AGENTS, transcript.backgroundTasks));
      break;
    case 'todos':
      lines = renderTodos(v);
      break;
    case 'errors':
      lines = renderErrors(v);
      break;
    case 'bg':
      lines = renderBackground(v);
      break;
  }
  return lines.join('\n');
}
