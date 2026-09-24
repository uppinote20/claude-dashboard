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

      expect(result?.completedToolCount).toBe(1);
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

    it('should track the renamed `Agent` tool and pass through its model parameter', async () => {
      await writeTranscript([
        {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'tool_use',
                id: 'agent-1',
                name: 'Agent',
                input: { subagent_type: 'Explore', description: 'Searching', model: 'sonnet' },
              },
              {
                type: 'tool_use',
                id: 'agent-2',
                name: 'Agent',
                input: { subagent_type: 'Plan', description: 'Planning' },
              },
            ],
          },
        },
        {
          type: 'user',
          message: { content: [{ type: 'tool_result', tool_use_id: 'agent-2' }] },
        },
      ]);

      const { parseTranscript, extractAgentStatus } = await import('../utils/transcript-parser.js');
      const transcript = await parseTranscript(TEST_FILE);
      const status = extractAgentStatus(transcript!);

      expect(status.completed).toBe(1);
      expect(status.active).toEqual([
        { name: 'Explore', description: 'Searching', model: 'sonnet' },
      ]);
    });
  });

  describe('resolveSubagentModel', () => {
    const noEnv = {} as NodeJS.ProcessEnv;

    it('should use the per-invocation model when given', async () => {
      const { resolveSubagentModel } = await import('../utils/transcript-parser.js');
      expect(resolveSubagentModel('Explore', 'sonnet', noEnv)).toBe('sonnet');
      expect(resolveSubagentModel('code-reviewer', 'claude-opus-5', noEnv)).toBe('claude-opus-5');
    });

    it('should return undefined when nothing pins the model (inherits main model)', async () => {
      const { resolveSubagentModel } = await import('../utils/transcript-parser.js');
      expect(resolveSubagentModel('Explore', undefined, noEnv)).toBeUndefined();
      expect(resolveSubagentModel('general-purpose', undefined, noEnv)).toBeUndefined();
      expect(resolveSubagentModel(undefined, undefined, noEnv)).toBeUndefined();
    });

    it('should apply CLAUDE_CODE_SUBAGENT_MODEL only to built-in types without frontmatter', async () => {
      const { resolveSubagentModel } = await import('../utils/transcript-parser.js');
      const env = { CLAUDE_CODE_SUBAGENT_MODEL: 'opus' } as NodeJS.ProcessEnv;

      expect(resolveSubagentModel('general-purpose', undefined, env)).toBe('opus');
      expect(resolveSubagentModel('claude', undefined, env)).toBe('opus');
      // Explore/Plan inherit; custom agents may carry their own frontmatter model
      expect(resolveSubagentModel('Explore', undefined, env)).toBeUndefined();
      expect(resolveSubagentModel('Plan', undefined, env)).toBeUndefined();
      expect(resolveSubagentModel('code-reviewer', undefined, env)).toBeUndefined();
      // Per-invocation parameter still beats the env default
      expect(resolveSubagentModel('general-purpose', 'haiku', env)).toBe('haiku');
    });

    it('should let CLAUDE_CODE_SUBAGENT_MODEL_FORCE override everything except fork and Explore', async () => {
      const { resolveSubagentModel } = await import('../utils/transcript-parser.js');
      const env = {
        CLAUDE_CODE_SUBAGENT_MODEL: 'haiku',
        CLAUDE_CODE_SUBAGENT_MODEL_FORCE: '1',
      } as NodeJS.ProcessEnv;

      expect(resolveSubagentModel('code-reviewer', 'opus', env)).toBe('haiku');
      expect(resolveSubagentModel('general-purpose', undefined, env)).toBe('haiku');
      expect(resolveSubagentModel('Explore', undefined, env)).toBeUndefined();
      expect(resolveSubagentModel('fork', 'opus', env)).toBeUndefined();
    });

    it('should treat fork as always inheriting the parent model', async () => {
      const { resolveSubagentModel } = await import('../utils/transcript-parser.js');
      const env = { CLAUDE_CODE_SUBAGENT_MODEL: 'opus' } as NodeJS.ProcessEnv;
      expect(resolveSubagentModel('fork', undefined, env)).toBeUndefined();
      expect(resolveSubagentModel('fork', 'sonnet', noEnv)).toBeUndefined();
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

  describe('getActiveSlashCommand', () => {
    it('should return null when no user messages exist', async () => {
      await writeTranscript([
        { type: 'assistant', timestamp: '2024-01-01T00:00:00Z', message: { content: [] } },
      ]);

      const { parseTranscript, getActiveSlashCommand } = await import('../utils/transcript-parser.js');
      const transcript = await parseTranscript(TEST_FILE);

      expect(getActiveSlashCommand(transcript!)).toBeNull();
    });

    it('should capture slash command from <command-name> tag', async () => {
      await writeTranscript([
        {
          type: 'user',
          timestamp: '2024-01-01T00:00:00Z',
          message: {
            content: [
              { type: 'text', text: '<command-name>/superpowers:brainstorming</command-name>\nhelp me think' },
            ],
          },
        },
      ]);

      const { parseTranscript, getActiveSlashCommand } = await import('../utils/transcript-parser.js');
      const transcript = await parseTranscript(TEST_FILE);
      const active = getActiveSlashCommand(transcript!);

      expect(active).not.toBeNull();
      expect(active?.name).toBe('/superpowers:brainstorming');
      expect(active?.startTime).toBe(new Date('2024-01-01T00:00:00Z').getTime());
    });

    it('should clear active command when a plain user message arrives', async () => {
      await writeTranscript([
        {
          type: 'user',
          timestamp: '2024-01-01T00:00:00Z',
          message: { content: [{ type: 'text', text: '<command-name>/foo</command-name>' }] },
        },
        {
          type: 'user',
          timestamp: '2024-01-01T00:00:05Z',
          message: { content: [{ type: 'text', text: 'just a regular message' }] },
        },
      ]);

      const { parseTranscript, getActiveSlashCommand } = await import('../utils/transcript-parser.js');
      const transcript = await parseTranscript(TEST_FILE);

      expect(getActiveSlashCommand(transcript!)).toBeNull();
    });

    it('should not clear active command on intervening tool_result-only entries', async () => {
      await writeTranscript([
        {
          type: 'user',
          timestamp: '2024-01-01T00:00:00Z',
          message: { content: [{ type: 'text', text: '<command-name>/bar</command-name>' }] },
        },
        {
          type: 'user',
          timestamp: '2024-01-01T00:00:01Z',
          message: { content: [{ type: 'tool_result', tool_use_id: 'tool-x' }] },
        },
      ]);

      const { parseTranscript, getActiveSlashCommand } = await import('../utils/transcript-parser.js');
      const transcript = await parseTranscript(TEST_FILE);
      const active = getActiveSlashCommand(transcript!);

      expect(active?.name).toBe('/bar');
    });

    it('should capture a namespace-less command like /foo', async () => {
      await writeTranscript([
        {
          type: 'user',
          timestamp: '2024-01-01T00:00:00Z',
          message: { content: [{ type: 'text', text: '<command-name>/foo</command-name>' }] },
        },
      ]);

      const { parseTranscript, getActiveSlashCommand } = await import('../utils/transcript-parser.js');
      const transcript = await parseTranscript(TEST_FILE);

      expect(getActiveSlashCommand(transcript!)?.name).toBe('/foo');
    });

    it('should trim surrounding whitespace inside the command-name tag', async () => {
      await writeTranscript([
        {
          type: 'user',
          timestamp: '2024-01-01T00:00:00Z',
          message: { content: [{ type: 'text', text: '<command-name>  /foo:bar  </command-name>' }] },
        },
      ]);

      const { parseTranscript, getActiveSlashCommand } = await import('../utils/transcript-parser.js');
      const transcript = await parseTranscript(TEST_FILE);

      expect(getActiveSlashCommand(transcript!)?.name).toBe('/foo:bar');
    });

    it('should clear active command when a string-form plain user message arrives', async () => {
      // String-form content (vs array-form) must not be iterated as characters.
      // The active slash command should still be cleared.
      await writeTranscript([
        {
          type: 'user',
          timestamp: '2024-01-01T00:00:00Z',
          message: { content: [{ type: 'text', text: '<command-name>/foo</command-name>' }] },
        },
        {
          type: 'user',
          timestamp: '2024-01-01T00:00:05Z',
          message: { content: 'just a regular message' },
        },
      ]);

      const { parseTranscript, getActiveSlashCommand } = await import('../utils/transcript-parser.js');
      const transcript = await parseTranscript(TEST_FILE);

      expect(getActiveSlashCommand(transcript!)).toBeNull();
    });

    it('should capture slash command from string-form <command-name> tag', async () => {
      await writeTranscript([
        {
          type: 'user',
          timestamp: '2024-01-01T00:00:00Z',
          message: { content: '<command-name>/baz</command-name>  <command-args>x</command-args>' },
        },
      ]);

      const { parseTranscript, getActiveSlashCommand } = await import('../utils/transcript-parser.js');
      const transcript = await parseTranscript(TEST_FILE);

      expect(getActiveSlashCommand(transcript!)?.name).toBe('/baz');
    });

    it('should preserve active command across system lifecycle string entries', async () => {
      // Production Claude Code transcripts emit <local-command-stdout>,
      // <local-command-caveat>, <command-message> etc. as string-form user
      // entries immediately after <command-name>. These are system-injected
      // and must not clear the active slash command.
      await writeTranscript([
        {
          type: 'user',
          timestamp: '2024-01-01T00:00:00Z',
          message: { content: '<command-name>/effort</command-name>' },
        },
        {
          type: 'user',
          timestamp: '2024-01-01T00:00:01Z',
          message: { content: '<local-command-stdout>Set effort level to max</local-command-stdout>' },
        },
        {
          type: 'user',
          timestamp: '2024-01-01T00:00:02Z',
          message: { content: '<local-command-caveat>Caveat: ...</local-command-caveat>' },
        },
      ]);

      const { parseTranscript, getActiveSlashCommand } = await import('../utils/transcript-parser.js');
      const transcript = await parseTranscript(TEST_FILE);

      expect(getActiveSlashCommand(transcript!)?.name).toBe('/effort');
    });

    it('should preserve active command when content is an empty string', async () => {
      await writeTranscript([
        {
          type: 'user',
          timestamp: '2024-01-01T00:00:00Z',
          message: { content: [{ type: 'text', text: '<command-name>/foo</command-name>' }] },
        },
        {
          type: 'user',
          timestamp: '2024-01-01T00:00:01Z',
          message: { content: '' },
        },
      ]);

      const { parseTranscript, getActiveSlashCommand } = await import('../utils/transcript-parser.js');
      const transcript = await parseTranscript(TEST_FILE);

      expect(getActiveSlashCommand(transcript!)?.name).toBe('/foo');
    });

    it('should preserve active command when <command-name> tag is whitespace-only', async () => {
      await writeTranscript([
        {
          type: 'user',
          timestamp: '2024-01-01T00:00:00Z',
          message: { content: [{ type: 'text', text: '<command-name>/foo</command-name>' }] },
        },
        {
          type: 'user',
          timestamp: '2024-01-01T00:00:01Z',
          message: { content: '<command-name>   </command-name>' },
        },
      ]);

      const { parseTranscript, getActiveSlashCommand } = await import('../utils/transcript-parser.js');
      const transcript = await parseTranscript(TEST_FILE);

      expect(getActiveSlashCommand(transcript!)?.name).toBe('/foo');
    });

    it('should not set activeSlashCommand when tag content lacks a leading slash', async () => {
      // <command-name>just text</command-name> — no leading '/', so it's not a
      // valid slash command. It is also not "plain user text" (the entry opens
      // with a tag), so the active command should stay null.
      await writeTranscript([
        {
          type: 'user',
          timestamp: '2024-01-01T00:00:00Z',
          message: { content: '<command-name>just text</command-name>' },
        },
      ]);

      const { parseTranscript, getActiveSlashCommand } = await import('../utils/transcript-parser.js');
      const transcript = await parseTranscript(TEST_FILE);

      expect(getActiveSlashCommand(transcript!)).toBeNull();
    });
  });
});
