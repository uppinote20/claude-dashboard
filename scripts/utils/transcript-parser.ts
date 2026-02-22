/**
 * Transcript parser - parses Claude Code transcript.jsonl files
 * Uses incremental parsing: remembers last byte offset and only parses new content
 */

import { open, stat } from 'fs/promises';
import type { TranscriptEntry, ParsedTranscript } from '../types.js';

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
 * Process entries and merge into existing parsed transcript data
 */
function processEntries(
  entries: TranscriptEntry[],
  existing: ParsedTranscript
): void {
  for (const entry of entries) {
    existing.entries.push(entry);

    // Track session start time from first entry
    if (!existing.sessionStartTime && entry.timestamp) {
      existing.sessionStartTime = new Date(entry.timestamp).getTime();
    }

    // Extract tool_use blocks
    if (entry.type === 'assistant' && entry.message?.content) {
      for (const block of entry.message.content) {
        if (block.type === 'tool_use' && block.id && block.name) {
          existing.toolUses.set(block.id, {
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
          existing.toolResults.add(block.tool_use_id);
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
    const data: ParsedTranscript = {
      entries: [],
      toolUses: new Map(),
      toolResults: new Set(),
    };

    processEntries(parseJsonlContent(content), data);

    cachedTranscript = { path: transcriptPath, size: fileSize, data };

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
