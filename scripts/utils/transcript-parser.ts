/**
 * Transcript parser - parses Claude Code transcript.jsonl files
 */

import { readFile, stat } from 'fs/promises';
import type { TranscriptEntry, ParsedTranscript } from '../types.js';

/**
 * Cached transcript data to avoid re-parsing on every invocation
 */
let cachedTranscript: {
  path: string;
  mtime: number;
  data: ParsedTranscript;
} | null = null;

/**
 * Parse a single JSONL line
 */
function parseJsonlLine(line: string): TranscriptEntry | null {
  try {
    return JSON.parse(line) as TranscriptEntry;
  } catch {
    return null;
  }
}

/**
 * Parse transcript JSONL file
 * Uses caching based on file mtime to avoid re-parsing
 */
export async function parseTranscript(
  transcriptPath: string
): Promise<ParsedTranscript | null> {
  try {
    // Check file mtime for cache invalidation
    const fileStat = await stat(transcriptPath);
    const mtime = fileStat.mtimeMs;

    // Return cached if path and mtime match
    if (
      cachedTranscript?.path === transcriptPath &&
      cachedTranscript.mtime === mtime
    ) {
      return cachedTranscript.data;
    }

    // Parse JSONL (one JSON object per line)
    const content = await readFile(transcriptPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const entries: TranscriptEntry[] = [];

    for (const line of lines) {
      const entry = parseJsonlLine(line);
      if (entry) {
        entries.push(entry);
      }
    }

    // Extract tool uses and results
    const toolUses = new Map<string, { name: string; timestamp?: string }>();
    const toolResults = new Set<string>();
    let sessionStartTime: number | undefined;

    for (const entry of entries) {
      // Track session start time from first entry
      if (!sessionStartTime && entry.timestamp) {
        sessionStartTime = new Date(entry.timestamp).getTime();
      }

      // Extract tool_use blocks
      if (entry.type === 'assistant' && entry.message?.content) {
        for (const block of entry.message.content) {
          if (block.type === 'tool_use' && block.id && block.name) {
            toolUses.set(block.id, {
              name: block.name,
              timestamp: entry.timestamp,
            });
          }
        }
      }

      // Extract tool_result blocks (they come as user messages with tool_result content)
      if (entry.type === 'user' && entry.message?.content) {
        for (const block of entry.message.content) {
          if (block.type === 'tool_result' && block.tool_use_id) {
            toolResults.add(block.tool_use_id);
          }
        }
      }
    }

    const data: ParsedTranscript = {
      entries,
      toolUses,
      toolResults,
      sessionStartTime,
    };

    // Update cache
    cachedTranscript = { path: transcriptPath, mtime, data };

    return data;
  } catch {
    return null;
  }
}

/**
 * Get running tools (tools that have been called but not yet returned)
 */
export function getRunningTools(
  transcript: ParsedTranscript
): Array<{ name: string; startTime: number }> {
  const running: Array<{ name: string; startTime: number }> = [];

  for (const [id, tool] of transcript.toolUses) {
    if (!transcript.toolResults.has(id)) {
      running.push({
        name: tool.name,
        startTime: tool.timestamp
          ? new Date(tool.timestamp).getTime()
          : Date.now(),
      });
    }
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
 * Extract TodoWrite calls to get todo progress
 */
export function extractTodoProgress(
  transcript: ParsedTranscript
): {
  current?: { content: string; status: 'in_progress' | 'pending' };
  completed: number;
  total: number;
} | null {
  // Find the most recent TodoWrite call
  let lastTodoWrite: unknown = null;

  for (const [id, tool] of transcript.toolUses) {
    if (tool.name === 'TodoWrite' && transcript.toolResults.has(id)) {
      // Find the entry with this tool use to get the input
      for (const entry of transcript.entries) {
        if (entry.type === 'assistant' && entry.message?.content) {
          for (const block of entry.message.content) {
            if (block.type === 'tool_use' && block.id === id && block.input) {
              lastTodoWrite = block.input;
            }
          }
        }
      }
    }
  }

  if (!lastTodoWrite || typeof lastTodoWrite !== 'object') {
    return null;
  }

  const input = lastTodoWrite as { todos?: Array<{ content: string; status: string }> };
  if (!Array.isArray(input.todos)) {
    return null;
  }

  const todos = input.todos;
  const completed = todos.filter((t) => t.status === 'completed').length;
  const total = todos.length;
  const current = todos.find(
    (t) => t.status === 'in_progress' || t.status === 'pending'
  );

  return {
    current: current
      ? {
          content: current.content,
          status: current.status as 'in_progress' | 'pending',
        }
      : undefined,
    completed,
    total,
  };
}

/**
 * Extract Task (agent) calls to get agent status
 */
export function extractAgentStatus(
  transcript: ParsedTranscript
): {
  active: Array<{ name: string; description?: string }>;
  completed: number;
} {
  const active: Array<{ name: string; description?: string }> = [];
  let completed = 0;

  for (const [id, tool] of transcript.toolUses) {
    if (tool.name === 'Task') {
      if (transcript.toolResults.has(id)) {
        completed++;
      } else {
        // Find the description from input
        for (const entry of transcript.entries) {
          if (entry.type === 'assistant' && entry.message?.content) {
            for (const block of entry.message.content) {
              if (block.type === 'tool_use' && block.id === id && block.input) {
                const input = block.input as {
                  description?: string;
                  subagent_type?: string;
                };
                active.push({
                  name: input.subagent_type || 'Agent',
                  description: input.description,
                });
              }
            }
          }
        }
      }
    }
  }

  return { active, completed };
}
