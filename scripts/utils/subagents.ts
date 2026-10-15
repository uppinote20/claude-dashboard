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
import type { BackgroundTask, TouchedFile } from '../types.js';
import { getRunningTools, parseTranscript, toolLabel } from './transcript-parser.js';

type SubagentStatus = 'running' | 'done' | 'stale';

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
const MAX_SUBAGENTS = 20;

const META_SUFFIX = '.meta.json';

function subagentsDir(transcriptPath: string): string {
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

async function scanOne(dir: string, base: string, mtime: number, now: number): Promise<SubagentInfo | null> {
  const [meta, parsed] = await Promise.all([
    readMeta(join(dir, `${base}${META_SUFFIX}`)),
    parseTranscript(join(dir, `${base}.jsonl`)),
  ]);
  if (!meta || !parsed) return null;

  let status: SubagentStatus = parsed.lastStopReason === 'end_turn' ? 'done' : 'running';
  if (status === 'running' && now - mtime > STALE_AFTER_MS) status = 'stale';

  const running = getRunningTools(parsed).at(-1);
  return {
    id: base.replace(/^agent-/, ''),
    type: typeof meta.agentType === 'string' ? meta.agentType : 'agent',
    description: typeof meta.description === 'string' ? meta.description : undefined,
    model: parsed.lastModel,
    status,
    startedAt: parsed.sessionStartTime,
    lastAt: parsed.lastEntryAt ?? mtime,
    tools: parsed.completedToolCount,
    runningTool: running ? toolLabel(running.name, running.target) : undefined,
    touchedFiles: parsed.touchedFiles,
  };
}

/**
 * The main transcript's `<task-notification>` for an async agent (task id = agent id) is
 * authoritative: an agent the user stopped never writes a final end_turn record of its own.
 */
function applyNotification(agent: SubagentInfo, notified: BackgroundTask | undefined): SubagentInfo {
  return agent.status !== 'done' && notified && notified.status !== 'running' ? { ...agent, status: 'done' } : agent;
}

const STATUS_ORDER: Record<SubagentStatus, number> = { running: 0, stale: 1, done: 2 };

/**
 * The `limit` most recently written subagents of the session at `transcriptPath`:
 * running first, then newest start. `notifications` is the main transcript's backgroundTasks.
 * A missing directory (no subagents yet) or an unreadable entry is skipped, never thrown.
 */
export async function listSubagents(
  transcriptPath: string,
  now = Date.now(),
  limit = MAX_SUBAGENTS,
  notifications: Map<string, BackgroundTask> = new Map()
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
  const bases = files.filter((f) => f.endsWith(META_SUFFIX)).map((f) => f.slice(0, -META_SUFFIX.length));
  const withMtime = await Promise.all(
    bases.map(async (base) => ({ base, mtime: (await stat(join(dir, `${base}.jsonl`)).catch(() => null))?.mtimeMs }))
  );
  const recent = withMtime
    .filter((x): x is { base: string; mtime: number } => x.mtime !== undefined)
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit);

  // Each file has its own persisted parse state, so the parses are independent.
  const scanned = await Promise.all(recent.map(({ base, mtime }) => scanOne(dir, base, mtime, now)));
  return scanned
    .filter((a): a is SubagentInfo => a !== null)
    .map((a) => applyNotification(a, notifications.get(a.id)))
    .sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (b.startedAt ?? 0) - (a.startedAt ?? 0)
  );
}

