/**
 * Transcript parser - parses Claude Code transcript.jsonl files
 * @handbook 4.5-transcript-incremental-parsing
 * @handbook 9.5-pane-views
 * @tested scripts/__tests__/transcript-parser.test.ts
 * @tested scripts/__tests__/transcript-views.test.ts
 * @tested scripts/__tests__/widgets.test.ts
 * Uses incremental parsing: remembers last byte offset and only parses new content.
 * The status line is a fresh process per render, so the parse state is also persisted
 * to the file cache; otherwise every render would re-parse the whole transcript.
 * Running tools, agents, tasks, and todos are tracked incrementally in processEntries()
 * so extract functions read O(1) instead of scanning the full transcript.
 */

import { open, readFile, stat } from 'fs/promises';
import { basename } from 'path';
import type {
  TranscriptEntry,
  ParsedTranscript,
  TodoProgressData,
  WidgetContext,
  SlashCommandData,
  AgentStatusData,
  TurnRecord,
} from '../types.js';
import { truncate } from './formatters.js';
import { fileCachePath, saveFileCache } from './file-cache.js';
import { hashToken } from './hash.js';
import { VERSION } from '../version.js';

/**
 * Incremental parse state for one transcript file.
 */
interface TranscriptState {
  path: string;
  /** Byte offset parsed so far — always just past a complete line */
  size: number;
  /**
   * Hash of the first min(size, HEAD_BYTES) bytes. Transcript files are append-only,
   * so a changed head means the path now holds a different file and the state must
   * be rebuilt. Hashed over the parsed range, not the current file, so growth alone
   * never looks like a replacement.
   */
  head: string;
  data: ParsedTranscript;
}

/** In-process tier: reused while one process renders repeatedly (tests, check-usage). */
let cachedTranscript: TranscriptState | null = null;

/** Bytes hashed to fingerprint a transcript file (its first line carries the session id). */
const HEAD_BYTES = 1024;

/**
 * Create a fresh ParsedTranscript with all incremental tracking fields initialized.
 */
function createParsedTranscript(): ParsedTranscript {
  return {
    toolUses: new Map(),
    completedToolCount: 0,
    runningToolIds: new Set(),
    lastTodoWriteInput: null,
    activeAgentIds: new Set(),
    completedAgentCount: 0,
    tasks: new Map(),
    nextTaskId: 1,
    pendingTaskCreates: new Map(),
    pendingTaskUpdates: new Map(),
    activeSlashCommand: null,
    sessionOutputTokens: 0,
    sessionRequestMs: 0,
    sessionConsumedTokens: 0,
    lastRequestOutput: 0,
    lastRequestInput: 0,
    turns: [],
    turnCount: 0,
    touchedFiles: new Map(),
    toolErrors: [],
    backgroundTasks: new Map(),
  };
}

// Caps keep the persisted parse state small: it is rewritten on every render with new lines.
export const MAX_TURNS = 50;
export const MAX_TOUCHED_FILES = 200;
export const MAX_TOOL_ERRORS = 30;
export const MAX_BACKGROUND_TASKS = 30;
const PROMPT_MAX_CHARS = 120;
const ERROR_MAX_CHARS = 120;

/** Tools whose successful result means a file was written; value is the path field. */
const FILE_WRITE_TOOLS: Record<string, string> = {
  Edit: 'file_path',
  Write: 'file_path',
  MultiEdit: 'file_path',
  NotebookEdit: 'notebook_path',
};

const COMMAND_ARGS_RE = /<command-args>([^<]*)<\/command-args>/;
const BASH_INPUT_RE = /^<bash-input>([\s\S]*?)<\/bash-input>/;
const SYSTEM_REMINDER_RE = /<system-reminder>[\s\S]*?<\/system-reminder>/g;
const BACKGROUND_ID_RE = /running in background with ID: ([\w-]+)/;
const ASYNC_AGENT_ID_RE = /launched[\s\S]*?agentId: ([\w-]+)/i;

function oneLine(text: string, max: number): string {
  return truncate(text.replace(/\s+/g, ' ').trim(), max);
}

type ContentBlocks = NonNullable<NonNullable<TranscriptEntry['message']>['content']>;

/** Text of a user entry's prompt blocks; tool_result entries are not prompts. */
function promptText(content: ContentBlocks): string | null {
  if (typeof content === 'string') return content;
  if (content.some((b) => b.type === 'tool_result')) return null;
  return content
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n');
}

/**
 * The prompt a user entry carries, or null when Claude Code wrote it: tool results,
 * task notifications, command stdout, caveats. A slash command shows as `/name args`,
 * shell input as `!cmd`. `isMeta` entries (skill bodies, image refs) are filtered by the caller.
 */
export function classifyPrompt(content: ContentBlocks): string | null {
  const raw = promptText(content);
  if (raw === null) return null;
  const text = raw.replace(SYSTEM_REMINDER_RE, '').trim();
  if (!text) return null;

  const cmd = text.match(SLASH_COMMAND_TAG_RE);
  if (cmd) {
    const name = cmd[1].trim();
    if (!name.startsWith('/')) return null;
    const args = text.match(COMMAND_ARGS_RE)?.[1] ?? '';
    return oneLine(`${name} ${args}`, PROMPT_MAX_CHARS);
  }
  const bash = text.match(BASH_INPUT_RE);
  if (bash) return oneLine(`!${bash[1]}`, PROMPT_MAX_CHARS);
  if (text.startsWith('<')) return null;
  return oneLine(text, PROMPT_MAX_CHARS);
}

/** A tool_result's text, whether sent as a string or as text blocks. */
function toolResultText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((b) => (b && typeof b === 'object' && typeof (b as { text?: unknown }).text === 'string' ? (b as { text: string }).text : ''))
    .join('\n');
}

function errorMessage(text: string): string {
  const cleaned = text.replace(/<\/?tool_use_error>/g, '').trim();
  return oneLine(cleaned.split('\n')[0] ?? '', ERROR_MAX_CHARS);
}

/** Map insertion order is age order: drop the oldest keys past `max`. */
function capMap<V>(map: Map<string, V>, max: number): void {
  for (const key of map.keys()) {
    if (map.size <= max) break;
    map.delete(key);
  }
}

function pushCapped<T>(list: T[], item: T, max: number): void {
  list.push(item);
  if (list.length > max) list.splice(0, list.length - max);
}

function xmlTag(text: string, tag: string): string | undefined {
  return text.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1]?.trim();
}

/** Apply a `<task-notification>` (background job or async agent came to rest). */
function applyTaskNotification(existing: ParsedTranscript, text: string, at: number): void {
  const id = xmlTag(text, 'task-id');
  if (!id) return;
  const task = existing.backgroundTasks.get(id);
  if (!task) return;
  task.status = xmlTag(text, 'status') ?? 'completed';
  const summary = xmlTag(text, 'summary');
  if (summary) task.summary = oneLine(summary, PROMPT_MAX_CHARS);
  task.endedAt = at;
}

/**
 * Matches `<command-name>/xxx</command-name>` tags injected by Claude Code
 * when a user types a slash command. Captures the full name including the
 * leading slash (e.g. '/superpowers:brainstorming').
 */
const SLASH_COMMAND_TAG_RE = /<command-name>([^<]+)<\/command-name>/;

/**
 * Parse JSONL content into transcript entries, skipping malformed lines
 */
function parseJsonlContent(content: string): TranscriptEntry[] {
  const entries: TranscriptEntry[] = [];
  for (const line of content.split('\n')) {
    if (!line) continue;
    try {
      entries.push(JSON.parse(line) as TranscriptEntry);
    } catch {
      // Skip malformed lines
    }
  }
  return entries;
}

/**
 * Process entries and merge into existing parsed transcript data.
 * Incrementally updates running tools, agents, tasks, and last TodoWrite.
 */
function processEntries(
  entries: TranscriptEntry[],
  existing: ParsedTranscript,
  sidechain = false
): void {
  for (const entry of entries) {
    // A subagent's own transcript marks every record isSidechain; there it is the main thread.
    const isMain = sidechain || !entry.isSidechain;
    const at = entry.timestamp ? Date.parse(entry.timestamp) : NaN;
    if (isMain) trackThread(existing, entry, at);

    // Track session start time from first entry
    if (!existing.sessionStartTime && entry.timestamp) {
      existing.sessionStartTime = new Date(entry.timestamp).getTime();
    }

    // Extract session name from /rename command
    if (entry.customTitle) {
      existing.sessionName = entry.customTitle;
    }

    // Extract tool_use blocks
    if (entry.type === 'assistant' && Array.isArray(entry.message?.content)) {
      for (const block of entry.message.content) {
        if (block.type === 'tool_use' && block.id && block.name) {
          existing.toolUses.set(block.id, {
            name: block.name,
            timestamp: entry.timestamp,
            target: extractToolTarget(block.name, block.input),
            input: retainToolInput(block.name, block.input),
          });
          existing.runningToolIds.add(block.id);

          const turn = isMain ? existing.turns.at(-1) : undefined;
          if (turn) {
            turn.tools++;
            if (block.name === 'Agent' || block.name === 'Task') turn.agents++;
          }

          // Track subagent dispatches. The tool is `Agent` in current Claude Code;
          // `Task` is the pre-rename name still found in older transcripts.
          if (block.name === 'Agent' || block.name === 'Task') {
            existing.activeAgentIds.add(block.id);
          }

          // Track pending TaskCreate/TaskUpdate for deferred application on result
          if (block.name === 'TaskCreate') {
            const input = block.input as { subject?: string; status?: string } | undefined;
            if (input?.subject) {
              const seqId = String(existing.nextTaskId);
              existing.nextTaskId++;
              existing.pendingTaskCreates.set(block.id, {
                subject: input.subject,
                status: normalizeTaskStatus(input.status || 'pending'),
                seqId,
              });
            }
          } else if (block.name === 'TaskUpdate') {
            const input = block.input as { taskId?: string; status?: string; subject?: string } | undefined;
            if (input?.taskId) {
              existing.pendingTaskUpdates.set(block.id, {
                taskId: input.taskId,
                status: input.status,
                subject: input.subject,
              });
            }
          }
        }
      }
    }

    // User entries are visited in two separate blocks (text vs tool_result) instead
    // of one merged loop: text drives slash-command tracking, tool_result drives
    // tool/task lifecycle. Splitting keeps each concern flat and avoids interleaving
    // two state machines.
    //
    // String-form content needs care: Claude Code injects system entries like
    // `<local-command-stdout>` and `<local-command-caveat>` right after a
    // `<command-name>` slash command. Treating those as plain user text would
    // clear the command within milliseconds of setting it. We classify a string
    // payload as (a) command-name capture, (b) genuine plain text, or (c) system
    // lifecycle tag (no state change).
    if (entry.type === 'user' && entry.message?.content !== undefined) {
      const content = entry.message.content;
      let matchedName: string | null = null;
      let hasText = false;

      if (typeof content === 'string') {
        const m = content.match(SLASH_COMMAND_TAG_RE);
        if (m) {
          const name = m[1].trim();
          if (name.startsWith('/')) {
            matchedName = name;
            hasText = true;
          }
        } else {
          const trimmed = content.trim();
          if (trimmed.length > 0 && !trimmed.startsWith('<')) {
            hasText = true;
          }
        }
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type !== 'text' || typeof block.text !== 'string') continue;
          hasText = true;
          const m = block.text.match(SLASH_COMMAND_TAG_RE);
          if (m) {
            const name = m[1].trim();
            if (name.startsWith('/')) matchedName = name;
            break;
          }
        }
      }

      if (hasText) {
        existing.activeSlashCommand = matchedName
          ? {
              name: matchedName,
              startTime: entry.timestamp ? new Date(entry.timestamp).getTime() : Date.now(),
            }
          : null;
      }
    }

    // Extract tool_result blocks (they come as user messages with tool_result content)
    if (entry.type === 'user' && Array.isArray(entry.message?.content)) {
      for (const block of entry.message.content) {
        if (block.type === 'tool_result' && block.tool_use_id) {
          existing.completedToolCount++;
          existing.runningToolIds.delete(block.tool_use_id);

          // Track agent (Task) completions
          if (existing.activeAgentIds.delete(block.tool_use_id)) {
            existing.completedAgentCount++;
          }

          // Track last completed TodoWrite
          const tool = existing.toolUses.get(block.tool_use_id);
          if (tool?.name === 'TodoWrite') {
            existing.lastTodoWriteInput = tool.input;
          }

          if (isMain) trackToolResult(existing, block, tool, Number.isFinite(at) ? at : Date.now());

          // Apply pending TaskCreate on result
          const pendingCreate = existing.pendingTaskCreates.get(block.tool_use_id);
          if (pendingCreate) {
            existing.tasks.set(pendingCreate.seqId, {
              subject: pendingCreate.subject,
              status: pendingCreate.status,
            });
            existing.pendingTaskCreates.delete(block.tool_use_id);
          }

          // Apply pending TaskUpdate on result
          const pendingUpdate = existing.pendingTaskUpdates.get(block.tool_use_id);
          if (pendingUpdate) {
            const task = existing.tasks.get(pendingUpdate.taskId);
            if (task) {
              if (pendingUpdate.status) task.status = normalizeTaskStatus(pendingUpdate.status);
              if (pendingUpdate.subject) task.subject = pendingUpdate.subject;
            }
            existing.pendingTaskUpdates.delete(block.tool_use_id);
          }

          // Prune completed tool from Map (no longer needed for display)
          existing.toolUses.delete(block.tool_use_id);
        }
      }
    }

    accountTokens(existing, entry, isMain);
  }
}

/**
 * Per-thread state for the pane views: turn boundaries, last activity, and whether the
 * thread came to rest. Main-thread entries only (see processEntries' `isMain`).
 */
function trackThread(existing: ParsedTranscript, entry: TranscriptEntry, at: number): void {
  if (Number.isFinite(at)) existing.lastEntryAt = at;

  if (entry.type === 'assistant') {
    const model = entry.message?.model;
    if (model && !model.startsWith('<')) existing.lastModel = model;
    existing.lastStopReason = entry.message?.stop_reason ?? undefined;
    const turn = existing.turns.at(-1);
    if (turn && Number.isFinite(at)) turn.lastAt = at;
    return;
  }

  if (entry.type !== 'user' || entry.message?.content === undefined) return;

  const content = entry.message.content;
  const text = typeof content === 'string' ? content : promptText(content);
  // A tool result, notification, or prompt sends the thread back to work. Local command
  // output (`/exit`, `!cmd` stdout) does not, so it must not clear a rest state.
  if (text === null) {
    existing.lastStopReason = undefined;
    return;
  }
  if (text.trimStart().startsWith('<task-notification>')) {
    existing.lastStopReason = undefined;
    applyTaskNotification(existing, text, Number.isFinite(at) ? at : Date.now());
    return;
  }

  if (entry.isMeta || !Number.isFinite(at)) return;
  const prompt = classifyPrompt(content);
  if (prompt === null) return;
  existing.lastStopReason = undefined;
  const turn: TurnRecord = { at, prompt, lastAt: at, tokensIn: 0, tokensOut: 0, tools: 0, agents: 0 };
  pushCapped(existing.turns, turn, MAX_TURNS);
  existing.turnCount++;
}

type ContentBlock = Extract<ContentBlocks, unknown[]>[number];

/** Files written, failures, and background jobs started — read from one tool_result. */
function trackToolResult(
  existing: ParsedTranscript,
  block: ContentBlock,
  tool: ParsedTranscript['toolUses'] extends Map<string, infer V> ? V | undefined : never,
  at: number
): void {
  const text = toolResultText(block.content);

  if (block.is_error) {
    pushCapped(
      existing.toolErrors,
      { at, tool: tool?.name ?? 'Tool', target: tool?.target, message: errorMessage(text) },
      MAX_TOOL_ERRORS
    );
    return;
  }
  if (!tool) return;

  const pathField = FILE_WRITE_TOOLS[tool.name];
  const filePath = pathField ? (tool.input as Record<string, unknown> | undefined)?.[pathField] : undefined;
  if (typeof filePath === 'string') {
    const prev = existing.touchedFiles.get(filePath);
    existing.touchedFiles.set(filePath, { edits: (prev?.edits ?? 0) + 1, lastAt: at });
    capMap(existing.touchedFiles, MAX_TOUCHED_FILES);
  }

  const isAgent = tool.name === 'Agent' || tool.name === 'Task';
  const id = (isAgent ? text.match(ASYNC_AGENT_ID_RE) : text.match(BACKGROUND_ID_RE))?.[1];
  if (id) {
    const description = (tool.input as { description?: unknown } | undefined)?.description;
    existing.backgroundTasks.set(id, {
      kind: isAgent ? 'agent' : tool.name === 'Bash' ? 'bash' : 'other',
      description: typeof description === 'string' ? oneLine(description, PROMPT_MAX_CHARS) : tool.target,
      startedAt: at,
      status: 'running',
    });
    capMap(existing.backgroundTasks, MAX_BACKGROUND_TASKS);
  }
}

/** A request counts toward session totals only once it has both output and a span. */
function isMeasured(outputTokens: number, durationMs?: number): boolean {
  return outputTokens > 0 && durationMs !== undefined && durationMs > 0;
}

/** Positive finite token count, or 0 for missing, invalid, or zero values. */
function tokenCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Token accounting for the tokenSpeed / tokenSpeedLast / burnRate widgets.
 *
 * Both halves of each rate come from the main transcript. stdin's
 * cost.total_api_duration_ms is not usable as a denominator: it accumulates every
 * API call in the process (subagents, compaction, side queries), while subagent
 * output lives in separate transcripts.
 *
 * A response arrives as several records sharing one message id; the usage block
 * repeats on each, mostly 0 with the real count on the last, so the newest value
 * per id wins. A request's span runs from the `user` entry (prompt or tool_result)
 * that triggered it to its latest record — the response's own first-to-last record
 * gap covers only the tail of the stream and would overstate the rate.
 *
 * burnRate's consumption counts input + cache write + output per request. Cache reads
 * are excluded: they are billed at a fraction of input and re-read the whole prefix on
 * every call, so including them made the figure track context size, not spend.
 */
function accountTokens(existing: ParsedTranscript, entry: TranscriptEntry, isMain: boolean): void {
  // Subagent records interleave with the main thread and would both move the
  // boundary and switch the tracked request id.
  if (!isMain) return;
  if (entry.type !== 'user' && entry.type !== 'assistant') return;

  const t = entry.timestamp ? Date.parse(entry.timestamp) : NaN;

  if (entry.type === 'user') {
    // Only user entries start a request. system/attachment/progress entries can land
    // between the trigger and the response and would shorten the span.
    if (Number.isFinite(t)) existing.lastBoundaryAt = t;
    return;
  }

  const msg = entry.message as
    | {
        id?: string;
        usage?: { input_tokens?: number; cache_creation_input_tokens?: number; output_tokens?: number };
      }
    | undefined;
  const msgId = msg?.id;
  if (!msgId) return;

  // O(1) state: main-thread records of one response are contiguous, so tracking the
  // newest id is enough to dedupe. This state survives incremental reads, so a
  // response split across two reads is still counted once.
  if (msgId !== existing.lastRequestId) {
    existing.lastRequestId = msgId;
    existing.lastRequestOutput = 0;
    existing.lastRequestInput = 0;
    existing.lastRequestDurationMs = undefined;
    // Pin the start now: with streaming tool execution a tool_result can be written
    // before this response's later records, and must not restart its span.
    existing.lastRequestStartAt = existing.lastBoundaryAt;
  }

  const prevOut = existing.lastRequestOutput;
  const prevIn = existing.lastRequestInput;
  const prevMs = existing.lastRequestDurationMs;

  // The usage block repeats on every record of a response; the newest max wins.
  const usage = msg?.usage;
  existing.lastRequestOutput = Math.max(prevOut, tokenCount(usage?.output_tokens));
  existing.lastRequestInput = Math.max(
    prevIn,
    tokenCount(usage?.input_tokens) + tokenCount(usage?.cache_creation_input_tokens)
  );
  existing.sessionConsumedTokens +=
    existing.lastRequestInput - prevIn + existing.lastRequestOutput - prevOut;
  const turn = existing.turns.at(-1);
  if (turn) {
    turn.tokensIn += existing.lastRequestInput - prevIn;
    turn.tokensOut += existing.lastRequestOutput - prevOut;
  }

  const start = existing.lastRequestStartAt;
  if (Number.isFinite(t) && start !== undefined && t > start) {
    existing.lastRequestDurationMs = t - start;
  }

  // Session totals hold only requests with both a count and a span, so the two
  // halves of the ratio always cover the same requests. Apply this request's delta.
  if (isMeasured(prevOut, prevMs)) {
    existing.sessionOutputTokens -= prevOut;
    existing.sessionRequestMs -= prevMs!;
  }
  if (isMeasured(existing.lastRequestOutput, existing.lastRequestDurationMs)) {
    existing.sessionOutputTokens += existing.lastRequestOutput;
    existing.sessionRequestMs += existing.lastRequestDurationMs!;
  }
}

/**
 * Persisted-state compatibility key. Any change to the plugin version or to
 * ParsedTranscript's initialized fields discards older state instead of resuming
 * from a shape the current code does not expect.
 */
const STATE_SIGNATURE = `${VERSION}:${Object.keys(createParsedTranscript()).sort().join(',')}`;

function stateCachePath(transcriptPath: string): string {
  return fileCachePath(`transcript-${hashToken(transcriptPath)}.json`);
}

// ParsedTranscript holds Maps and Sets, which JSON drops; tag them so they round-trip.
function stateReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Map) return { __map: [...value] };
  if (value instanceof Set) return { __set: [...value] };
  return value;
}

function stateReviver(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object') {
    const tagged = value as { __map?: unknown; __set?: unknown };
    if (Array.isArray(tagged.__map)) return new Map(tagged.__map as [unknown, unknown][]);
    if (Array.isArray(tagged.__set)) return new Set(tagged.__set);
  }
  return value;
}

async function loadPersistedState(transcriptPath: string): Promise<TranscriptState | null> {
  try {
    const raw = await readFile(stateCachePath(transcriptPath), 'utf-8');
    const entry = JSON.parse(raw, stateReviver) as {
      data?: { signature?: string; state?: TranscriptState };
    };
    const persisted = entry.data;
    if (persisted?.signature !== STATE_SIGNATURE || !persisted.state) return null;
    // Guards the (practically impossible) hash collision between two transcript paths.
    if (persisted.state.path !== transcriptPath) return null;
    return persisted.state;
  } catch {
    return null;
  }
}

/**
 * Written only when new lines were parsed, so the 1-hour cleanup sweep removes the
 * state of a transcript idle for over an hour; the next render then re-parses once.
 * Accepted: correct either way, and cheaper than touching the file on every render.
 */
async function persistState(state: TranscriptState): Promise<void> {
  // saveFileCache stringifies without a replacer, so pre-serialize the Maps and Sets.
  const payload = JSON.parse(JSON.stringify({ signature: STATE_SIGNATURE, state }, stateReplacer));
  await saveFileCache(stateCachePath(state.path), payload);
}

/**
 * Read bytes [offset, end) from a file
 */
async function readBytes(filePath: string, offset: number, end: number): Promise<Buffer> {
  const length = end - offset;
  if (length <= 0) return Buffer.alloc(0);

  const fd = await open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await fd.read(buffer, 0, length, offset);
    return buffer.subarray(0, bytesRead);
  } finally {
    await fd.close();
  }
}

/**
 * Read complete lines from `offset` to `fileSize`. A half-written trailing line is
 * left for the next read instead of being consumed and lost; a trailing line that
 * already parses as JSON is complete and is consumed (a cut-off object never parses).
 */
async function readCompleteLines(
  filePath: string,
  offset: number,
  fileSize: number
): Promise<{ content: string; nextOffset: number }> {
  const buffer = await readBytes(filePath, offset, fileSize);
  const end = buffer.lastIndexOf(0x0a) + 1;
  const tail = buffer.subarray(end).toString('utf-8');
  if (tail.trim() && isCompleteJson(tail)) {
    return { content: buffer.toString('utf-8'), nextOffset: offset + buffer.length };
  }
  return { content: buffer.subarray(0, end).toString('utf-8'), nextOffset: offset + end };
}

function isCompleteJson(line: string): boolean {
  try {
    JSON.parse(line);
    return true;
  } catch {
    return false;
  }
}

async function readHead(filePath: string, parsedSize: number): Promise<string> {
  return hashToken((await readBytes(filePath, 0, Math.min(parsedSize, HEAD_BYTES))).toString('utf-8'));
}

/** Whether `state` still describes the file: not truncated, same leading bytes. */
async function isResumable(state: TranscriptState, fileSize: number): Promise<boolean> {
  if (state.size > fileSize) return false;
  // Nothing parsed yet, or nothing new to read: skip the head read. A same-size
  // replacement is not worth an extra read on every render.
  if (state.size === 0 || state.size === fileSize) return true;
  return state.head === (await readHead(state.path, state.size));
}

/**
 * Parse transcript JSONL file
 * Uses incremental parsing: only reads new bytes since last parse. State comes from
 * this process first, then from the persisted file cache, else a full parse.
 */
export async function parseTranscript(
  transcriptPath: string,
  options: { sidechain?: boolean } = {}
): Promise<ParsedTranscript | null> {
  try {
    const fileSize = (await stat(transcriptPath)).size;

    let state: TranscriptState | null =
      cachedTranscript?.path === transcriptPath ? cachedTranscript : await loadPersistedState(transcriptPath);
    // Truncated or replaced file: rebuild from scratch.
    if (state && !(await isResumable(state, fileSize))) state = null;
    if (!state) state = { path: transcriptPath, size: 0, head: hashToken(''), data: createParsedTranscript() };

    if (state.size < fileSize) {
      const { content, nextOffset } = await readCompleteLines(transcriptPath, state.size, fileSize);
      if (nextOffset > state.size) {
        processEntries(parseJsonlContent(content), state.data, options.sidechain);
        // The fingerprint only widens until HEAD_BYTES; past that it is fixed.
        if (state.size < HEAD_BYTES) state.head = await readHead(transcriptPath, nextOffset);
        state.size = nextOffset;
        await persistState(state);
      }
    }

    cachedTranscript = state;
    return state.data;
  } catch {
    return null;
  }
}

/**
 * The part of a tool's input that consumers read after the tool_use record: Agent/Task
 * metadata for agentStatus, the todo list for todoProgress. Everything else is dropped,
 * because toolUses is persisted with the parse state and a running (or never-answered)
 * Write/Edit/Agent call would otherwise carry its whole body or prompt into every save.
 */
function retainToolInput(name: string, input: unknown): unknown {
  if (!input || typeof input !== 'object') return undefined;
  const inp = input as Record<string, unknown>;
  switch (name) {
    case 'Agent':
    case 'Task':
      return { description: inp.description, subagent_type: inp.subagent_type, model: inp.model };
    case 'TodoWrite':
      return { todos: inp.todos };
    case 'Bash':
    case 'Monitor':
      return typeof inp.description === 'string' ? { description: inp.description } : undefined;
    case 'Edit':
    case 'Write':
    case 'MultiEdit':
      return { file_path: inp.file_path };
    case 'NotebookEdit':
      return { notebook_path: inp.notebook_path };
    default:
      return undefined;
  }
}

/**
 * Extract a human-readable target from a tool's input.
 * Returns the file basename for file tools, pattern for search tools,
 * or truncated command for Bash.
 */
export function extractToolTarget(name: string, input: unknown): string | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const inp = input as Record<string, unknown>;
  switch (name) {
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'MultiEdit':
      return typeof inp.file_path === 'string' ? basename(inp.file_path) : undefined;
    case 'NotebookEdit':
      return typeof inp.notebook_path === 'string' ? basename(inp.notebook_path) : undefined;
    case 'Glob':
    case 'Grep':
      return typeof inp.pattern === 'string' ? truncate(inp.pattern, 20) : undefined;
    case 'Bash':
      return typeof inp.command === 'string' ? truncate(inp.command, 25) : undefined;
    default:
      return undefined;
  }
}

/**
 * Get running tools from incrementally tracked runningToolIds.
 * O(k) where k = number of currently running tools (typically 0-3).
 */
export function getRunningTools(
  transcript: ParsedTranscript
): Array<{ name: string; startTime: number; target?: string }> {
  const running: Array<{ name: string; startTime: number; target?: string }> = [];

  for (const id of transcript.runningToolIds) {
    const tool = transcript.toolUses.get(id);
    if (!tool) continue;
    running.push({
      name: tool.name,
      startTime: tool.timestamp
        ? new Date(tool.timestamp).getTime()
        : Date.now(),
      target: tool.target,
    });
  }

  return running;
}

/**
 * Get completed tool count
 */
export function getCompletedToolCount(transcript: ParsedTranscript): number {
  return transcript.completedToolCount;
}

/**
 * Normalize task/todo status variants to canonical values.
 * Maps upstream API variants (not_started, running, done, complete)
 * to the canonical set used in TodoProgressData.
 */
export function normalizeTaskStatus(status: string): string {
  switch (status) {
    case 'not_started':
      return 'pending';
    case 'running':
      return 'in_progress';
    case 'complete':
    case 'done':
      return 'completed';
    default:
      return status;
  }
}

/**
 * Extract TodoWrite progress from incrementally tracked lastTodoWriteInput.
 * O(t) where t = number of todos in the last TodoWrite (typically <20).
 */
export function extractTodoProgress(
  transcript: ParsedTranscript
): {
  current?: { content: string; status: 'in_progress' | 'pending' };
  completed: number;
  total: number;
} | null {
  const lastTodoWrite = transcript.lastTodoWriteInput;
  if (!lastTodoWrite || typeof lastTodoWrite !== 'object') {
    return null;
  }

  const input = lastTodoWrite as { todos?: Array<{ content: string; status: string }> };
  if (!Array.isArray(input.todos)) {
    return null;
  }

  const todos = input.todos;
  const completed = todos.filter((t) => normalizeTaskStatus(t.status) === 'completed').length;
  const total = todos.length;
  const current = todos.find((t) => {
    const s = normalizeTaskStatus(t.status);
    return s === 'in_progress' || s === 'pending';
  });

  return {
    current: current
      ? {
          content: current.content,
          status: normalizeTaskStatus(current.status) as 'in_progress' | 'pending',
        }
      : undefined,
    completed,
    total,
  };
}

/**
 * Extract task progress from incrementally tracked tasks Map.
 * O(t) where t = number of tasks (typically <20).
 */
export function extractTaskProgress(
  transcript: ParsedTranscript
): TodoProgressData | null {
  if (transcript.tasks.size === 0) return null;

  const all = [...transcript.tasks.values()];
  const completed = all.filter((t) => t.status === 'completed').length;
  const current = all.find(
    (t) => t.status === 'in_progress' || t.status === 'pending'
  );

  return {
    current: current
      ? { content: current.subject, status: current.status as 'in_progress' | 'pending' }
      : undefined,
    completed,
    total: all.length,
  };
}

/**
 * Unified progress extractor: Tasks API (TaskCreate/TaskUpdate) first,
 * falls back to TodoWrite for backward compatibility.
 */
export function extractTodoOrTaskProgress(
  transcript: ParsedTranscript
): TodoProgressData | null {
  return extractTaskProgress(transcript) ?? extractTodoProgress(transcript);
}

/**
 * Convenience helper: get parsed transcript from widget context.
 * Eliminates the repeated null-check boilerplate in widget getData methods.
 */
export async function getTranscript(ctx: WidgetContext): Promise<ParsedTranscript | null> {
  const transcriptPath = ctx.stdin.transcript_path;
  if (!transcriptPath) return null;
  return parseTranscript(transcriptPath);
}

/**
 * Extract agent status from incrementally tracked fields.
 * O(a) where a = number of active agents (typically 0-5).
 */
export function extractAgentStatus(
  transcript: ParsedTranscript
): AgentStatusData {
  const active: AgentStatusData['active'] = [];

  for (const id of transcript.activeAgentIds) {
    const tool = transcript.toolUses.get(id);
    if (!tool) continue;
    const input = tool.input as {
      description?: string;
      subagent_type?: string;
      /** Per-invocation model override passed to the Agent tool */
      model?: string;
    } | undefined;
    const subagentType = input?.subagent_type;
    active.push({
      name: subagentType || 'Agent',
      description: input?.description,
      model: resolveSubagentModel(subagentType, input?.model),
    });
  }

  return { active, completed: transcript.completedAgentCount };
}

/** Built-in subagent types whose model follows the standard resolution order. */
const ENV_DEFAULT_SUBAGENT_TYPES = new Set(['general-purpose', 'claude']);

/**
 * Best-effort resolution of the model a subagent runs on, following Claude Code's
 * order (per-invocation `model` → definition frontmatter → CLAUDE_CODE_SUBAGENT_MODEL
 * → main model). Frontmatter isn't visible from the transcript, so the env default
 * is only applied to built-in types known to have no frontmatter override
 * (general-purpose, claude). Returns undefined when the subagent inherits the
 * main conversation's model or the answer can't be known — never a guess.
 *
 * - `fork` always inherits the parent model (even under FORCE).
 * - `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` pins every non-fork subagent to
 *   CLAUDE_CODE_SUBAGENT_MODEL; Explore keeps its own cap so it is excluded.
 */
export function resolveSubagentModel(
  subagentType: string | undefined,
  explicitModel: string | undefined,
  env: NodeJS.ProcessEnv = process.env
): string | undefined {
  if (subagentType === 'fork') return undefined;

  const envModel = env.CLAUDE_CODE_SUBAGENT_MODEL?.trim() || undefined;
  const force = env.CLAUDE_CODE_SUBAGENT_MODEL_FORCE;
  const forced = force === '1' || force === 'true';

  if (forced && envModel && subagentType !== 'Explore') return envModel;
  if (explicitModel?.trim()) return explicitModel.trim();
  if (envModel && subagentType && ENV_DEFAULT_SUBAGENT_TYPES.has(subagentType)) {
    return envModel;
  }
  return undefined;
}

/**
 * Return the slash command active for the current turn, or null if the
 * user's last input was plain text. O(1) — value tracked in processEntries.
 */
export function getActiveSlashCommand(
  transcript: ParsedTranscript
): SlashCommandData | null {
  return transcript.activeSlashCommand;
}

export interface TodoItem {
  content: string;
  status: string;
}

/**
 * The whole todo list for the pane's todos view, in list order. Same precedence as
 * extractTodoOrTaskProgress: Tasks API first, TodoWrite as the fallback.
 */
export function extractTodoList(transcript: ParsedTranscript): TodoItem[] {
  if (transcript.tasks.size > 0) {
    return [...transcript.tasks.values()].map((t) => ({ content: t.subject, status: t.status }));
  }
  const input = transcript.lastTodoWriteInput as { todos?: Array<{ content?: unknown; status?: unknown }> } | null;
  if (!input || !Array.isArray(input.todos)) return [];
  return input.todos
    .filter((t) => typeof t.content === 'string')
    .map((t) => ({ content: t.content as string, status: normalizeTaskStatus(String(t.status ?? 'pending')) }));
}
