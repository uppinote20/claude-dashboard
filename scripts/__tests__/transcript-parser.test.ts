/**
 * @handbook 8.1-test-structure
 * @covers scripts/utils/transcript-parser.ts
 */
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
      expect(result?.toolUses.size).toBe(0);
    });

    it('should parse transcript entries', async () => {
      await writeTranscript([
        { type: 'user', timestamp: '2024-01-01T00:00:00Z', message: { content: 'hello' } },
        { type: 'assistant', timestamp: '2024-01-01T00:00:01Z', message: { content: [] } },
      ]);

      const { parseTranscript } = await import('../utils/transcript-parser.js');
      const result = await parseTranscript(TEST_FILE);

      expect(result).not.toBeNull();
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

      // Should parse valid entries and skip invalid ones
      expect(result).not.toBeNull();
    });

    it('should extract sessionName from customTitle field', async () => {
      await writeTranscript([
        { type: 'user', timestamp: '2024-01-01T00:00:00Z', message: { content: 'hello' }, customTitle: 'my-session' },
      ]);

      const { parseTranscript } = await import('../utils/transcript-parser.js');
      const result = await parseTranscript(TEST_FILE);

      expect(result).not.toBeNull();
      expect(result?.sessionName).toBe('my-session');
    });

    it('should overwrite sessionName with later customTitle', async () => {
      await writeTranscript([
        { type: 'user', timestamp: '2024-01-01T00:00:00Z', message: { content: 'hello' }, customTitle: 'first-name' },
        { type: 'user', timestamp: '2024-01-01T00:01:00Z', message: { content: 'world' }, customTitle: 'second-name' },
      ]);

      const { parseTranscript } = await import('../utils/transcript-parser.js');
      const result = await parseTranscript(TEST_FILE);

      expect(result).not.toBeNull();
      expect(result?.sessionName).toBe('second-name');
    });

    it('should not set sessionName when no customTitle present', async () => {
      await writeTranscript([
        { type: 'user', timestamp: '2024-01-01T00:00:00Z', message: { content: 'hello' } },
      ]);

      const { parseTranscript } = await import('../utils/transcript-parser.js');
      const result = await parseTranscript(TEST_FILE);

      expect(result).not.toBeNull();
      expect(result?.sessionName).toBeUndefined();
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

  describe('normalizeTaskStatus', () => {
    it('should normalize status variants', async () => {
      const { normalizeTaskStatus } = await import('../utils/transcript-parser.js');

      expect(normalizeTaskStatus('not_started')).toBe('pending');
      expect(normalizeTaskStatus('running')).toBe('in_progress');
      expect(normalizeTaskStatus('complete')).toBe('completed');
      expect(normalizeTaskStatus('done')).toBe('completed');
      expect(normalizeTaskStatus('pending')).toBe('pending');
      expect(normalizeTaskStatus('in_progress')).toBe('in_progress');
      expect(normalizeTaskStatus('completed')).toBe('completed');
    });

    it('should pass through unknown statuses', async () => {
      const { normalizeTaskStatus } = await import('../utils/transcript-parser.js');

      expect(normalizeTaskStatus('cancelled')).toBe('cancelled');
      expect(normalizeTaskStatus('unknown')).toBe('unknown');
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

    it('should normalize variant statuses in TodoWrite', async () => {
      await writeTranscript([
        {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'tool_use',
                id: 'todo-2',
                name: 'TodoWrite',
                input: {
                  todos: [
                    { content: 'Task A', status: 'done' },
                    { content: 'Task B', status: 'complete' },
                    { content: 'Task C', status: 'running' },
                    { content: 'Task D', status: 'not_started' },
                  ],
                },
              },
            ],
          },
        },
        {
          type: 'user',
          message: { content: [{ type: 'tool_result', tool_use_id: 'todo-2' }] },
        },
      ]);

      const { parseTranscript, extractTodoProgress } = await import('../utils/transcript-parser.js');
      const transcript = await parseTranscript(TEST_FILE);
      const progress = extractTodoProgress(transcript!);

      expect(progress).not.toBeNull();
      expect(progress?.completed).toBe(2); // done + complete → completed
      expect(progress?.total).toBe(4);
      expect(progress?.current?.content).toBe('Task C');
      expect(progress?.current?.status).toBe('in_progress'); // running → in_progress
    });
  });

  describe('extractTaskProgress', () => {
    it('should return null when no TaskCreate calls', async () => {
      await writeTranscript([
        { type: 'user', message: { content: 'hello' } },
      ]);

      const { parseTranscript, extractTaskProgress } = await import('../utils/transcript-parser.js');
      const transcript = await parseTranscript(TEST_FILE);

      expect(extractTaskProgress(transcript!)).toBeNull();
    });

    it('should extract progress from TaskCreate calls', async () => {
      await writeTranscript([
        {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'tool_use',
                id: 'tc-1',
                name: 'TaskCreate',
                input: { subject: 'Implement parser', status: 'completed' },
              },
              {
                type: 'tool_use',
                id: 'tc-2',
                name: 'TaskCreate',
                input: { subject: 'Write tests' },
              },
              {
                type: 'tool_use',
                id: 'tc-3',
                name: 'TaskCreate',
                input: { subject: 'Update docs', status: 'pending' },
              },
            ],
          },
        },
        {
          type: 'user',
          message: {
            content: [
              { type: 'tool_result', tool_use_id: 'tc-1' },
              { type: 'tool_result', tool_use_id: 'tc-2' },
              { type: 'tool_result', tool_use_id: 'tc-3' },
            ],
          },
        },
      ]);

      const { parseTranscript, extractTaskProgress } = await import('../utils/transcript-parser.js');
      const transcript = await parseTranscript(TEST_FILE);
      const progress = extractTaskProgress(transcript!);

      expect(progress).not.toBeNull();
      expect(progress?.completed).toBe(1);
      expect(progress?.total).toBe(3);
      // 'Write tests' has no explicit status, defaults to 'pending'
      expect(progress?.current?.content).toBe('Write tests');
      expect(progress?.current?.status).toBe('pending');
    });

    it('should apply TaskUpdate status changes', async () => {
      await writeTranscript([
        {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'tool_use',
                id: 'tc-1',
                name: 'TaskCreate',
                input: { subject: 'Task A', status: 'pending' },
              },
              {
                type: 'tool_use',
                id: 'tc-2',
                name: 'TaskCreate',
                input: { subject: 'Task B', status: 'pending' },
              },
            ],
          },
        },
        {
          type: 'user',
          message: {
            content: [
              { type: 'tool_result', tool_use_id: 'tc-1' },
              { type: 'tool_result', tool_use_id: 'tc-2' },
            ],
          },
        },
        {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'tool_use',
                id: 'tu-1',
                name: 'TaskUpdate',
                input: { taskId: '1', status: 'completed' },
              },
              {
                type: 'tool_use',
                id: 'tu-2',
                name: 'TaskUpdate',
                input: { taskId: '2', status: 'in_progress' },
              },
            ],
          },
        },
        {
          type: 'user',
          message: {
            content: [
              { type: 'tool_result', tool_use_id: 'tu-1' },
              { type: 'tool_result', tool_use_id: 'tu-2' },
            ],
          },
        },
      ]);

      const { parseTranscript, extractTaskProgress } = await import('../utils/transcript-parser.js');
      const transcript = await parseTranscript(TEST_FILE);
      const progress = extractTaskProgress(transcript!);

      expect(progress).not.toBeNull();
      expect(progress?.completed).toBe(1);
      expect(progress?.total).toBe(2);
      expect(progress?.current?.content).toBe('Task B');
      expect(progress?.current?.status).toBe('in_progress');
    });

    it('should normalize variant statuses in TaskCreate/TaskUpdate', async () => {
      await writeTranscript([
        {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'tool_use',
                id: 'tc-1',
                name: 'TaskCreate',
                input: { subject: 'Task A', status: 'not_started' },
              },
              {
                type: 'tool_use',
                id: 'tc-2',
                name: 'TaskCreate',
                input: { subject: 'Task B', status: 'running' },
              },
              {
                type: 'tool_use',
                id: 'tc-3',
                name: 'TaskCreate',
                input: { subject: 'Task C', status: 'done' },
              },
            ],
          },
        },
        {
          type: 'user',
          message: {
            content: [
              { type: 'tool_result', tool_use_id: 'tc-1' },
              { type: 'tool_result', tool_use_id: 'tc-2' },
              { type: 'tool_result', tool_use_id: 'tc-3' },
            ],
          },
        },
        {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'tool_use',
                id: 'tu-1',
                name: 'TaskUpdate',
                input: { taskId: '1', status: 'complete' },
              },
            ],
          },
        },
        {
          type: 'user',
          message: { content: [{ type: 'tool_result', tool_use_id: 'tu-1' }] },
        },
      ]);

      const { parseTranscript, extractTaskProgress } = await import('../utils/transcript-parser.js');
      const transcript = await parseTranscript(TEST_FILE);
      const progress = extractTaskProgress(transcript!);

      expect(progress).not.toBeNull();
      // Task A: not_started→pending, then updated to complete→completed
      // Task B: running→in_progress
      // Task C: done→completed
      expect(progress?.completed).toBe(2); // Task A (updated) + Task C
      expect(progress?.total).toBe(3);
      expect(progress?.current?.content).toBe('Task B');
      expect(progress?.current?.status).toBe('in_progress');
    });

    it('should ignore incomplete TaskCreate calls', async () => {
      await writeTranscript([
        {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'tool_use',
                id: 'tc-1',
                name: 'TaskCreate',
                input: { subject: 'Completed task' },
              },
              {
                type: 'tool_use',
                id: 'tc-2',
                name: 'TaskCreate',
                input: { subject: 'Pending tool result' },
              },
            ],
          },
        },
        {
          type: 'user',
          message: {
            content: [
              { type: 'tool_result', tool_use_id: 'tc-1' },
              // tc-2 has no tool_result → still in-flight
            ],
          },
        },
      ]);

      const { parseTranscript, extractTaskProgress } = await import('../utils/transcript-parser.js');
      const transcript = await parseTranscript(TEST_FILE);
      const progress = extractTaskProgress(transcript!);

      expect(progress).not.toBeNull();
      expect(progress?.total).toBe(1);
    });
  });

  describe('extractTodoOrTaskProgress', () => {
    it('should prefer Tasks API over TodoWrite', async () => {
      await writeTranscript([
        // TodoWrite call
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
                    { content: 'Old task', status: 'pending' },
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
        // TaskCreate call
        {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'tool_use',
                id: 'tc-1',
                name: 'TaskCreate',
                input: { subject: 'New task', status: 'in_progress' },
              },
            ],
          },
        },
        {
          type: 'user',
          message: { content: [{ type: 'tool_result', tool_use_id: 'tc-1' }] },
        },
      ]);

      const { parseTranscript, extractTodoOrTaskProgress } = await import('../utils/transcript-parser.js');
      const transcript = await parseTranscript(TEST_FILE);
      const progress = extractTodoOrTaskProgress(transcript!);

      expect(progress).not.toBeNull();
      // Should use TaskCreate data, not TodoWrite
      expect(progress?.current?.content).toBe('New task');
      expect(progress?.total).toBe(1);
    });

    it('should fall back to TodoWrite when no TaskCreate calls', async () => {
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
                    { content: 'Legacy task', status: 'completed' },
                    { content: 'Another task', status: 'pending' },
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

      const { parseTranscript, extractTodoOrTaskProgress } = await import('../utils/transcript-parser.js');
      const transcript = await parseTranscript(TEST_FILE);
      const progress = extractTodoOrTaskProgress(transcript!);

      expect(progress).not.toBeNull();
      expect(progress?.completed).toBe(1);
      expect(progress?.total).toBe(2);
      expect(progress?.current?.content).toBe('Another task');
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

  describe('extractToolTarget', () => {
    it('should extract file basename for Read', async () => {
      const { extractToolTarget } = await import('../utils/transcript-parser.js');
      expect(extractToolTarget('Read', { file_path: '/project/src/app.ts' })).toBe('app.ts');
    });

    it('should extract file basename for Write', async () => {
      const { extractToolTarget } = await import('../utils/transcript-parser.js');
      expect(extractToolTarget('Write', { file_path: '/project/index.html' })).toBe('index.html');
    });

    it('should extract file basename for Edit', async () => {
      const { extractToolTarget } = await import('../utils/transcript-parser.js');
      expect(extractToolTarget('Edit', { file_path: '/a/b/c.ts' })).toBe('c.ts');
    });

    it('should extract pattern for Grep', async () => {
      const { extractToolTarget } = await import('../utils/transcript-parser.js');
      expect(extractToolTarget('Grep', { pattern: 'TODO' })).toBe('TODO');
    });

    it('should truncate long pattern for Glob', async () => {
      const { extractToolTarget } = await import('../utils/transcript-parser.js');
      const result = extractToolTarget('Glob', { pattern: 'this-is-a-very-long-pattern-string' });
      expect(result).toHaveLength(21); // 20 chars + '…'
      expect(result).toContain('…');
    });

    it('should extract and truncate Bash command', async () => {
      const { extractToolTarget } = await import('../utils/transcript-parser.js');
      expect(extractToolTarget('Bash', { command: 'npm test' })).toBe('npm test');
      const long = extractToolTarget('Bash', { command: 'this is a very long bash command that exceeds limit' });
      expect(long).toHaveLength(26); // 25 chars + '…'
    });

    it('should return undefined for unknown tools', async () => {
      const { extractToolTarget } = await import('../utils/transcript-parser.js');
      expect(extractToolTarget('Agent', { description: 'do stuff' })).toBeUndefined();
    });

    it('should return undefined for null/undefined input', async () => {
      const { extractToolTarget } = await import('../utils/transcript-parser.js');
      expect(extractToolTarget('Read', null)).toBeUndefined();
      expect(extractToolTarget('Read', undefined)).toBeUndefined();
    });

    it('should return undefined when expected field is missing', async () => {
      const { extractToolTarget } = await import('../utils/transcript-parser.js');
      expect(extractToolTarget('Read', { pattern: 'foo' })).toBeUndefined();
      expect(extractToolTarget('Bash', { file_path: '/x' })).toBeUndefined();
    });
  });

  describe('getRunningTools with targets', () => {
    it('should include targets in running tools', async () => {
      await writeTranscript([
        {
          type: 'assistant',
          timestamp: '2026-01-01T00:00:00Z',
          message: {
            content: [
              { type: 'tool_use', id: 'r1', name: 'Read', input: { file_path: '/project/src/app.ts' } },
              { type: 'tool_use', id: 'b1', name: 'Bash', input: { command: 'npm test' } },
            ],
          },
        },
      ]);

      const { parseTranscript, getRunningTools } = await import('../utils/transcript-parser.js');
      const transcript = await parseTranscript(TEST_FILE);
      const running = getRunningTools(transcript!);

      expect(running).toHaveLength(2);
      expect(running[0].target).toBe('app.ts');
      expect(running[1].target).toBe('npm test');
    });

    it('should have undefined target for tools without extractable input', async () => {
      await writeTranscript([
        {
          type: 'assistant',
          timestamp: '2026-01-01T00:00:00Z',
          message: {
            content: [
              { type: 'tool_use', id: 'a1', name: 'Agent', input: { description: 'do stuff' } },
            ],
          },
        },
      ]);

      const { parseTranscript, getRunningTools } = await import('../utils/transcript-parser.js');
      const transcript = await parseTranscript(TEST_FILE);
      const running = getRunningTools(transcript!);

      expect(running).toHaveLength(1);
      expect(running[0].target).toBeUndefined();
    });
  });
});
