/**
 * Files view: what Edit/Write changed this session, across the main thread and subagents.
 * @handbook 9.5-pane-views
 * @tested scripts/__tests__/pane-views.test.ts
 */

import type { TouchedFile } from '../types.js';
import { colorize } from '../utils/colors.js';
import { ICON } from '../utils/emoji.js';
import type { SubagentInfo } from '../utils/subagents.js';
import { displayPath, emptyView, header, type ViewContext } from './shared.js';

const MAX_FILE_LINES = 30;

interface FileRow {
  path: string;
  mainEdits: number;
  agentEdits: number;
  /** Distinct subagents that wrote the file (agentEdits counts their edits) */
  agentCount: number;
  lastAt: number;
}

function collectFiles(main: Map<string, TouchedFile>, agents: SubagentInfo[]): FileRow[] {
  const rows = new Map<string, FileRow>();
  const row = (path: string) => {
    let r = rows.get(path);
    if (!r) rows.set(path, (r = { path, mainEdits: 0, agentEdits: 0, agentCount: 0, lastAt: 0 }));
    return r;
  };
  for (const [path, f] of main) {
    const r = row(path);
    r.mainEdits += f.edits;
    r.lastAt = Math.max(r.lastAt, f.lastAt);
  }
  for (const a of agents) {
    for (const [path, f] of a.touchedFiles) {
      const r = row(path);
      r.agentEdits += f.edits;
      r.agentCount++;
      r.lastAt = Math.max(r.lastAt, f.lastAt);
    }
  }
  return [...rows.values()].sort(
    (a, b) => b.mainEdits + b.agentEdits - (a.mainEdits + a.agentEdits) || b.lastAt - a.lastAt
  );
}

export function renderFiles(v: ViewContext, agents: SubagentInfo[]): string[] {
  const { t, theme, ctx } = v;
  const rows = collectFiles(v.transcript.touchedFiles, agents);
  if (rows.length === 0) return emptyView(v, ICON.pencil, t.files, t.emptyFiles);

  const base = ctx.stdin.workspace?.project_dir ?? ctx.stdin.workspace?.current_dir;
  const lines = [header(v, ICON.pencil, t.files, String(rows.length))];
  for (const r of rows.slice(0, MAX_FILE_LINES)) {
    const source = [
      r.mainEdits > 0 ? t.main : '',
      r.agentCount > 0 ? `${r.mainEdits > 0 ? '+' : ''}${r.agentCount} ${t.agentsSuffix}` : '',
    ].filter(Boolean).join(' ');
    const count = colorize(`✎${r.mainEdits + r.agentEdits}`.padEnd(4), theme.accent);
    lines.push(`${count} ${colorize(displayPath(r.path, base), theme.folder)}  ${colorize(source, theme.secondary)}`);
  }
  if (rows.length > MAX_FILE_LINES) lines.push(colorize(`  +${rows.length - MAX_FILE_LINES}`, theme.secondary));
  return lines;
}
