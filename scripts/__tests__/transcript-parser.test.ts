import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import path from 'path';
import os from 'os';

describe('transcript-parser', () => {
  const TEST_DIR = path.join(os.tmpdir(), 'claude-dashboard-transcript-test');
  const TEST_FILE = path.join(TEST_DIR, 'transcript.jsonl');

  beforeEach(async () => {
    vi.resetModules();
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(TEST_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  async function writeTranscript(entries: object[]): Promise<void> {
    const content = entries.map((e) => JSON.stringify(e)).join('\n');
    await writeFile(TEST_FILE, content, 'utf-8');
  }

  describe('parseTranscript', () => {
    it('should return null for non-existent file', async () => {
      const { parseTranscript } = await import('../utils/transcript-parser.js');
      const result = await parseTranscript('/non/existent/file.jsonl');
      expect(result).toBeNull();
    });

    it('should parse empty transcript', async () => {
      await writeFile(TEST_FILE, '', 'utf-8');
      const { parseTranscript } = await import('../utils/transcript-parser.js');
      const result = await parseTranscript(TEST_FILE);
      expect(result).not.toBeNull();
      expect(result?.entries).toHaveLength(0);
    });

    it('should parse transcript entries', async () => {
      await writeTranscript([
        { type: 'user', timestamp: '2024-01-01T00:00:00Z', message: { content: 'hello' } },
        { type: 'assistant', timestamp: '2024-01-01T00:00:01Z', message: { content: [] } },
      ]);

      const { parseTranscript } = await import('../utils/transcript-parser.js');
      const result = await parseTranscript(TEST_FILE);

      expect(result).not.toBeNull();
      expect(result?.entries).toHaveLength(2);
      expect(result?.sessionStartTime).toBeDefined();
    });

    it('should extract tool uses', async () => {
      await writeTranscript([
        {
          type: 'assistant',
          timestamp: '2024-01-01T00:00:00Z',
          message: {
            content: [
              { type: 'tool_use', id: 'tool-1', name: 'Bash', input: { command: 'ls' } },
              { type: 'tool_use', id: 'tool-2', name: 'Read', input: { path: '/test' } },
            ],
          },
        },
      ]);

      const { parseTranscript } = await import('../utils/transcript-parser.js');
      const result = await parseTranscript(TEST_FILE);

      expect(result?.toolUses.size).toBe(2);
      expect(result?.toolUses.get('tool-1')?.name).toBe('Bash');
      expect(result?.toolUses.get('tool-2')?.name).toBe('Read');
    });

    it('should extract tool results', async () => {
      await writeTranscript([
        {
          type: 'user',
          message: {
            content: [
              { type: 'tool_result', tool_use_id: 'tool-1' },
            ],
          },
        },
      ]);

      const { parseTranscript } = await import('../utils/transcript-parser.js');
      const result = await parseTranscript(TEST_FILE);

      expect(result?.toolResults.has('tool-1')).toBe(true);
    });

    it('should skip malformed JSON lines', async () => {
      await writeFile(TEST_FILE, '{"valid": true}\n{invalid json\n{"also": "valid"}', 'utf-8');

      const { parseTranscript } = await import('../utils/transcript-parser.js');
      const result = await parseTranscript(TEST_FILE);

      // Should parse 2 valid entries, skip 1 invalid
      expect(result?.entries).toHaveLength(2);
    });
  });

  describe('getRunningTools', () => {
    it('should identify running tools (no result yet)', async () => {
      await writeTranscript([
        {
          type: 'assistant',
          timestamp: '2024-01-01T00:00:00Z',
          message: {
            content: [
              { type: 'tool_use', id: 'tool-1', name: 'Bash' },
              { type: 'tool_use', id: 'tool-2', name: 'Read' },
            ],
          },
        },
        {
          type: 'user',
          message: { content: [{ type: 'tool_result', tool_use_id: 'tool-1' }] },
        },
      ]);

      const { parseTranscript, getRunningTools } = await import('../utils/transcript-parser.js');
      const transcript = await parseTranscript(TEST_FILE);
      const running = getRunningTools(transcript!);

      expect(running).toHaveLength(1);
      expect(running[0].name).toBe('Read');
    });

    it('should return empty array when all tools completed', async () => {
      await writeTranscript([
        {
          type: 'assistant',
          message: { content: [{ type: 'tool_use', id: 'tool-1', name: 'Bash' }] },
        },
        {
          type: 'user',
          message: { content: [{ type: 'tool_result', tool_use_id: 'tool-1' }] },
        },
      ]);

      const { parseTranscript, getRunningTools } = await import('../utils/transcript-parser.js');
      const transcript = await parseTranscript(TEST_FILE);
      const running = getRunningTools(transcript!);

      expect(running).toHaveLength(0);
    });
  });

  describe('getCompletedToolCount', () => {
    it('should count completed tools', async () => {
      await writeTranscript([
        {
          type: 'assistant',
          message: {
            content: [
              { type: 'tool_use', id: 'tool-1', name: 'Bash' },
              { type: 'tool_use', id: 'tool-2', name: 'Read' },
            ],
          },
        },
        {
          type: 'user',
          message: { content: [{ type: 'tool_result', tool_use_id: 'tool-1' }] },
        },
        {
          type: 'user',
          message: { content: [{ type: 'tool_result', tool_use_id: 'tool-2' }] },
        },
      ]);

      const { parseTranscript, getCompletedToolCount } = await import('../utils/transcript-parser.js');
      const transcript = await parseTranscript(TEST_FILE);

      expect(getCompletedToolCount(transcript!)).toBe(2);
    });
  });

  describe('extractTodoProgress', () => {
    it('should return null when no TodoWrite calls', async () => {
      await writeTranscript([
        { type: 'user', message: { content: 'hello' } },
      ]);

      const { parseTranscript, extractTodoProgress } = await import('../utils/transcript-parser.js');
      const transcript = await parseTranscript(TEST_FILE);

      expect(extractTodoProgress(transcript!)).toBeNull();
    });

    it('should extract todo progress from TodoWrite', async () => {
      await writeTranscript([
        {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'tool_use',
                id: 'todo-1',
                name: 'TodoWrite',
                input: {
                  todos: [
                    { content: 'Task 1', status: 'completed' },
                    { content: 'Task 2', status: 'in_progress' },
                    { content: 'Task 3', status: 'pending' },
                  ],
                },
              },
            ],
          },
        },
        {
          type: 'user',
          message: { content: [{ type: 'tool_result', tool_use_id: 'todo-1' }] },
        },
      ]);

      const { parseTranscript, extractTodoProgress } = await import('../utils/transcript-parser.js');
      const transcript = await parseTranscript(TEST_FILE);
      const progress = extractTodoProgress(transcript!);

      expect(progress).not.toBeNull();
      expect(progress?.completed).toBe(1);
      expect(progress?.total).toBe(3);
      expect(progress?.current?.content).toBe('Task 2');
      expect(progress?.current?.status).toBe('in_progress');
    });
  });

  describe('extractAgentStatus', () => {
    it('should extract active and completed agents', async () => {
      await writeTranscript([
        {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'tool_use',
                id: 'agent-1',
                name: 'Task',
                input: { subagent_type: 'Explore', description: 'Exploring codebase' },
              },
              {
                type: 'tool_use',
                id: 'agent-2',
                name: 'Task',
                input: { subagent_type: 'Plan', description: 'Planning implementation' },
              },
            ],
          },
        },
        {
          type: 'user',
          message: { content: [{ type: 'tool_result', tool_use_id: 'agent-1' }] },
        },
      ]);

      const { parseTranscript, extractAgentStatus } = await import('../utils/transcript-parser.js');
      const transcript = await parseTranscript(TEST_FILE);
      const status = extractAgentStatus(transcript!);

      expect(status.completed).toBe(1);
      expect(status.active).toHaveLength(1);
      expect(status.active[0].name).toBe('Plan');
      expect(status.active[0].description).toBe('Planning implementation');
    });

    it('should return empty when no agents', async () => {
      await writeTranscript([
        { type: 'user', message: { content: 'hello' } },
      ]);

      const { parseTranscript, extractAgentStatus } = await import('../utils/transcript-parser.js');
      const transcript = await parseTranscript(TEST_FILE);
      const status = extractAgentStatus(transcript!);

      expect(status.completed).toBe(0);
      expect(status.active).toHaveLength(0);
    });
  });
});
