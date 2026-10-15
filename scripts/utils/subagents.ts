/**
 * Subagent scan for the pane's agents and files views.
 * Claude Code writes each subagent's transcript next to the session's own:
 * `<session>.jsonl` → `<session>/subagents/agent-<id>.jsonl`, with `agent-<id>.meta.json`
 * (`agentType`, `description`, `toolUseId`) beside it. Each transcript goes through
 * parseTranscript, so its parse state is persisted per path and a re-render reads only
 * the bytes appended since the last one.
 * @handbook 9.5-pane-views
 * @tested scripts/__tests__/subagents.test.ts
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import type { TouchedFile } from '../types.js';
import { getRunningTools, parseTranscript } from './transcript-parser.js';

export type SubagentStatus = 'running' | 'done' | 'stale';

export interface SubagentInfo {
  id: string;
  type: string;
  description?: string;
  model?: string;
  status: SubagentStatus;
  startedAt?: number;
  lastAt?: number;
  /** Completed tool calls */
  tools: number;
  /** Newest running tool, e.g. `Bash(npm test)` */
  runningTool?: string;
  touchedFiles: Map<string, TouchedFile>;
}

/** A running agent with no transcript write for this long is shown as stale. */
export const STALE_AFTER_MS = 10 * 60 * 1000;
export const MAX_SUBAGENTS = 20;

const META_SUFFIX = '.meta.json';

export function subagentsDir(transcriptPath: string): string {
  return join(transcriptPath.replace(/\.jsonl$/, ''), 'subagents');
}

async function readMeta(path: string): Promise<{ agentType?: string; description?: string } | null> {
  try {
    const meta = JSON.parse(await readFile(path, 'utf-8')) as unknown;
    return meta && typeof meta === 'object' ? (meta as { agentType?: string; description?: string }) : null;
  } catch {
    return null;
  }
}

async function scanOne(dir: string, metaFile: string, now: number): Promise<SubagentInfo | null> {
  const base = metaFile.slice(0, -META_SUFFIX.length);
  const jsonlPath = join(dir, `${base}.jsonl`);
  const [meta, parsed, fileStat] = await Promise.all([
    readMeta(join(dir, metaFile)),
    parseTranscript(jsonlPath, { sidechain: true }),
    stat(jsonlPath).catch(() => null),
  ]);
  if (!meta || !parsed) return null;

  const lastAt = parsed.lastEntryAt ?? fileStat?.mtimeMs;
  let status: SubagentStatus = parsed.lastStopReason === 'end_turn' ? 'done' : 'running';
  if (status === 'running' && fileStat && now - fileStat.mtimeMs > STALE_AFTER_MS) status = 'stale';

  const running = getRunningTools(parsed).at(-1);
  return {
    id: base.replace(/^agent-/, ''),
    type: typeof meta.agentType === 'string' ? meta.agentType : 'agent',
    description: typeof meta.description === 'string' ? meta.description : undefined,
    model: parsed.lastModel,
    status,
    startedAt: parsed.sessionStartTime,
    lastAt,
    tools: parsed.completedToolCount,
    runningTool: running ? (running.target ? `${running.name}(${running.target})` : running.name) : undefined,
    touchedFiles: parsed.touchedFiles,
  };
}

const STATUS_ORDER: Record<SubagentStatus, number> = { running: 0, stale: 1, done: 2 };

/**
 * The `limit` most recently written subagents of the session at `transcriptPath`:
 * running first, then newest start.
 * A missing directory (no subagents yet) or an unreadable entry is skipped, never thrown.
 */
export async function listSubagents(
  transcriptPath: string,
  now = Date.now(),
  limit = MAX_SUBAGENTS
): Promise<SubagentInfo[]> {
  const dir = subagentsDir(transcriptPath);
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }
  // Only the most recently written transcripts are parsed: a long session can hold
  // hundreds, and a running agent is always among the newest writes.
  const metas = files.filter((f) => f.endsWith(META_SUFFIX));
  const withMtime = await Promise.all(
    metas.map(async (f) => {
      const s = await stat(join(dir, `${f.slice(0, -META_SUFFIX.length)}.jsonl`)).catch(() => null);
      return { f, mtime: s?.mtimeMs ?? 0 };
    })
  );
  const recent = withMtime.sort((a, b) => b.mtime - a.mtime).slice(0, limit);

  // parseTranscript keeps one in-process state slot; run sequentially so each file
  // resumes from its persisted state rather than racing on that slot.
  const agents: SubagentInfo[] = [];
  for (const { f } of recent) {
    const info = await scanOne(dir, f, now);
    if (info) agents.push(info);
  }
  return agents.sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (b.startedAt ?? 0) - (a.startedAt ?? 0)
  );
}
