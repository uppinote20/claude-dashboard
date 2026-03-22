/**
 * Transcript parser - parses Claude Code transcript.jsonl files
 * @handbook 4.5-transcript-incremental-parsing
 * @tested scripts/__tests__/transcript-parser.test.ts
 * @tested scripts/__tests__/widgets.test.ts
 * Uses incremental parsing: remembers last byte offset and only parses new content.
 * Running tools, agents, tasks, and todos are tracked incrementally in processEntries()
 * so extract functions read O(1) instead of scanning the full transcript.
 */

import { open, stat } from 'fs/promises';
import { basename } from 'path';
import type { TranscriptEntry, ParsedTranscript, TodoProgressData, WidgetContext } from '../types.js';
import { truncate } from './formatters.js';

/**
 * Cached transcript data with incremental parsing state
 */
let cachedTranscript: {
  path: string;
  /** File size at last parse (used as byte offset for next read) */
  size: number;
  data: ParsedTranscript;
} | null = null;

/**
 * Create a fresh ParsedTranscript with all incremental tracking fields initialized.
 */
function createParsedTranscript(): ParsedTranscript {
  return {
    toolUses: new Map(),
    toolResults: new Set(),
    runningToolIds: new Set(),
    lastTodoWriteInput: null,
    activeAgentIds: new Set(),
    completedAgentCount: 0,
    tasks: new Map(),
    nextTaskId: 1,
    pendingTaskCreates: new Map(),
    pendingTaskUpdates: new Map(),
  };
}

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
  existing: ParsedTranscript
): void {
  for (const entry of entries) {
    // Track session start time from first entry
    if (!existing.sessionStartTime && entry.timestamp) {
      existing.sessionStartTime = new Date(entry.timestamp).getTime();
    }

    // Extract session name from /rename command
    if (entry.customTitle) {
      existing.sessionName = entry.customTitle;
    }

    // Extract tool_use blocks
    if (entry.type === 'assistant' && entry.message?.content) {
      for (const block of entry.message.content) {
        if (block.type === 'tool_use' && block.id && block.name) {
          existing.toolUses.set(block.id, {
            name: block.name,
            timestamp: entry.timestamp,
            input: block.input,
          });
          existing.runningToolIds.add(block.id);

          // Track agent (Task) dispatches
          if (block.name === 'Task') {
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

    // Extract tool_result blocks (they come as user messages with tool_result content)
    if (entry.type === 'user' && entry.message?.content) {
      for (const block of entry.message.content) {
        if (block.type === 'tool_result' && block.tool_use_id) {
          existing.toolResults.add(block.tool_use_id);
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
        }
      }
    }
  }
}

/**
 * Read bytes from file starting at offset
 */
async function readFromOffset(
  filePath: string,
  offset: number,
  fileSize: number
): Promise<string> {
  const bytesToRead = fileSize - offset;
  if (bytesToRead <= 0) return '';

  const fd = await open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(bytesToRead);
    await fd.read(buffer, 0, bytesToRead, offset);
    return buffer.toString('utf-8');
  } finally {
    await fd.close();
  }
}

/**
 * Parse transcript JSONL file
 * Uses incremental parsing: only reads new bytes since last parse
 */
export async function parseTranscript(
  transcriptPath: string
): Promise<ParsedTranscript | null> {
  try {
    const fileStat = await stat(transcriptPath);
    const fileSize = fileStat.size;

    // Incremental parse: reuse existing data if file only grew
    if (cachedTranscript?.path === transcriptPath && cachedTranscript.size <= fileSize) {
      if (cachedTranscript.size === fileSize) {
        return cachedTranscript.data;
      }

      const newContent = await readFromOffset(transcriptPath, cachedTranscript.size, fileSize);
      processEntries(parseJsonlContent(newContent), cachedTranscript.data);
      cachedTranscript.size = fileSize;

      return cachedTranscript.data;
    }

    // Full parse (first time or different/truncated file)
    const content = await readFromOffset(transcriptPath, 0, fileSize);
    const data = createParsedTranscript();

    processEntries(parseJsonlContent(content), data);

    cachedTranscript = { path: transcriptPath, size: fileSize, data };

    return data;
  } catch {
    return null;
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
      return typeof inp.file_path === 'string' ? basename(inp.file_path) : undefined;
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
      target: extractToolTarget(tool.name, tool.input),
    });
  }

  return running;
}

/**
 * Get completed tool count
 */
export function getCompletedToolCount(transcript: ParsedTranscript): number {
  return transcript.toolResults.size;
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
): {
  active: Array<{ name: string; description?: string }>;
  completed: number;
} {
  const active: Array<{ name: string; description?: string }> = [];

  for (const id of transcript.activeAgentIds) {
    const tool = transcript.toolUses.get(id);
    if (!tool) continue;
    const input = tool.input as {
      description?: string;
      subagent_type?: string;
    } | undefined;
    active.push({
      name: input?.subagent_type || 'Agent',
      description: input?.description,
    });
  }

  return { active, completed: transcript.completedAgentCount };
}
