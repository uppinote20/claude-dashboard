/**
 * Parser state behind the pane views: turns, touched files, tool errors, background jobs.
 * @handbook 8.1-test-structure
 * @covers scripts/utils/transcript-parser.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, appendFile, rm } from 'fs/promises';
import path from 'path';
import os from 'os';

const TEST_DIR = path.join(os.tmpdir(), 'claude-dashboard-transcript-views-test');
const TEST_FILE = path.join(TEST_DIR, 'transcript.jsonl');

const ts = (s: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, s)).toISOString();
const user = (s: number, content: unknown, extra: object = {}) => ({ type: 'user', timestamp: ts(s), message: { content }, ...extra });
const assistant = (s: number, content: unknown[], message: object = {}) => ({
  type: 'assistant',
  timestamp: ts(s),
  message: { content, ...message },
});
const toolUse = (id: string, name: string, input: object = {}) => ({ type: 'tool_use', id, name, input });
const toolResult = (id: string, content: unknown, isError = false) => ({
  type: 'tool_result',
  tool_use_id: id,
  content,
  ...(isError ? { is_error: true } : {}),
});

async function parse(entries: object[], options?: { sidechain?: boolean }) {
  await writeFile(TEST_FILE, entries.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf-8');
  const { parseTranscript } = await import('../utils/transcript-parser.js');
  const result = await parseTranscript(TEST_FILE, options);
  if (!result) throw new Error('parse failed');
  return result;
}

describe('transcript views state', () => {
  beforeEach(async () => {
    vi.resetModules();
    await mkdir(TEST_DIR, { recursive: true });
    vi.spyOn(os, 'homedir').mockReturnValue(TEST_DIR);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('classifyPrompt', () => {
    it.each([
      ['plain text', 'fix the   bug\nplease', 'fix the bug please'],
      ['slash command with args', '<command-message>ship</command-message>\n<command-name>/ship</command-name>\n<command-args>now</command-args>', '/ship now'],
      ['slash command without args', '<command-name>/effort</command-name>', '/effort'],
      ['shell input', '<bash-input>git status</bash-input>', '!git status'],
      ['system reminder stripped', 'hello<system-reminder>ignore me</system-reminder>', 'hello'],
    ])('%s', async (_name, content, expected) => {
      const { classifyPrompt } = await import('../utils/transcript-parser.js');
      expect(classifyPrompt(content)).toBe(expected);
    });

    it.each([
      ['task notification', '<task-notification><task-id>x</task-id></task-notification>'],
      ['local command stdout', '<local-command-stdout>bye</local-command-stdout>'],
      ['empty', '   '],
    ])('rejects %s', async (_name, content) => {
      const { classifyPrompt } = await import('../utils/transcript-parser.js');
      expect(classifyPrompt(content)).toBeNull();
    });

    it('rejects tool_result entries and reads text blocks', async () => {
      const { classifyPrompt } = await import('../utils/transcript-parser.js');
      expect(classifyPrompt([toolResult('t1', 'ok')] as never)).toBeNull();
      expect(classifyPrompt([{ type: 'text', text: 'from blocks' }])).toBe('from blocks');
    });

    it('truncates long prompts to one line', async () => {
      const { classifyPrompt } = await import('../utils/transcript-parser.js');
      const prompt = classifyPrompt('x'.repeat(500))!;
      expect(prompt.length).toBeLessThanOrEqual(121);
      expect(prompt.endsWith('…')).toBe(true);
    });
  });

  describe('turns', () => {
    it('starts a turn per real prompt and attributes tools, agents and tokens', async () => {
      const r = await parse([
        user(0, 'first'),
        assistant(1, [toolUse('t1', 'Bash', { command: 'ls' }), toolUse('a1', 'Agent', { description: 'd' })], {
          id: 'm1',
          usage: { input_tokens: 100, cache_creation_input_tokens: 20, output_tokens: 30 },
        }),
        user(2, [toolResult('t1', 'ok'), toolResult('a1', 'done')]),
        assistant(5, [{ type: 'text', text: 'done' }], { id: 'm2', stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 5 } }),
        user(6, 'skill body', { isMeta: true }),
        user(7, '<local-command-stdout>x</local-command-stdout>'),
        user(8, '<command-name>/ship</command-name>'),
      ]);

      expect(r.turns.map((t) => t.prompt)).toEqual(['first', '/ship']);
      expect(r.turnCount).toBe(2);
      const [first] = r.turns;
      expect(first).toMatchObject({ tools: 2, agents: 1, tokensIn: 130, tokensOut: 35 });
      expect(first.lastAt - first.at).toBe(5000);
    });

    it('counts a streamed response once', async () => {
      const r = await parse([
        user(0, 'go'),
        assistant(1, [], { id: 'm1', usage: { input_tokens: 50, output_tokens: 0 } }),
        assistant(2, [], { id: 'm1', usage: { input_tokens: 50, output_tokens: 40 } }),
      ]);
      expect(r.turns[0]).toMatchObject({ tokensIn: 50, tokensOut: 40 });
    });

    it('keeps the last MAX_TURNS but numbers every turn', async () => {
      const { MAX_TURNS } = await import('../utils/transcript-parser.js');
      const entries = Array.from({ length: MAX_TURNS + 5 }, (_, i) => user(i, `p${i}`));
      const r = await parse(entries);
      expect(r.turns).toHaveLength(MAX_TURNS);
      expect(r.turns[0].prompt).toBe('p5');
      expect(r.turnCount).toBe(MAX_TURNS + 5);
    });

    it('accumulates across incremental reads', async () => {
      await parse([user(0, 'one')]);
      await appendFile(TEST_FILE, JSON.stringify(user(1, 'two')) + '\n');
      const { parseTranscript } = await import('../utils/transcript-parser.js');
      const r = await parseTranscript(TEST_FILE);
      expect(r?.turns.map((t) => t.prompt)).toEqual(['one', 'two']);
    });
  });

  describe('rest state', () => {
    it('is end_turn after a final answer and survives local command output', async () => {
      const r = await parse([
        user(0, 'go'),
        assistant(1, [{ type: 'text', text: 'ok' }], { stop_reason: 'end_turn', model: 'claude-opus-5-5' }),
        user(2, '<command-name>/exit</command-name>'),
        user(3, '<local-command-stdout>bye</local-command-stdout>'),
      ]);
      // /exit is a prompt, so the thread is working again; its stdout does not change that.
      expect(r.lastStopReason).toBeUndefined();
      expect(r.lastModel).toBe('claude-opus-5-5');
      expect(r.lastEntryAt).toBe(Date.parse(ts(3)));
    });

    it('stays at rest through local command output alone', async () => {
      const r = await parse([
        assistant(1, [{ type: 'text', text: 'ok' }], { stop_reason: 'end_turn' }),
        user(3, '<local-command-stdout>bye</local-command-stdout>'),
      ]);
      expect(r.lastStopReason).toBe('end_turn');
    });

    it('clears on a tool result', async () => {
      const r = await parse([
        assistant(1, [toolUse('t1', 'Bash')], { stop_reason: 'tool_use' }),
        user(2, [toolResult('t1', 'ok')]),
      ]);
      expect(r.lastStopReason).toBeUndefined();
    });

    it('ignores sidechain records unless parsing a subagent transcript', async () => {
      const entries = [
        { ...user(0, 'task'), isSidechain: true },
        { ...assistant(1, [{ type: 'text', text: 'ok' }], { stop_reason: 'end_turn', model: 'claude-haiku-5-5' }), isSidechain: true },
      ];
      const main = await parse(entries);
      expect(main.turns).toHaveLength(0);
      expect(main.lastStopReason).toBeUndefined();

      vi.resetModules();
      await rm(TEST_DIR, { recursive: true, force: true });
      await mkdir(TEST_DIR, { recursive: true });
      const sub = await parse(entries, { sidechain: true });
      expect(sub.turns.map((t) => t.prompt)).toEqual(['task']);
      expect(sub.lastStopReason).toBe('end_turn');
      expect(sub.lastModel).toBe('claude-haiku-5-5');
    });
  });

  describe('touched files', () => {
    it('counts successful writes per path and skips failed ones', async () => {
      const r = await parse([
        assistant(0, [
          toolUse('e1', 'Edit', { file_path: '/p/a.ts', old_string: 'x', new_string: 'y' }),
          toolUse('e2', 'Write', { file_path: '/p/a.ts', content: 'big' }),
          toolUse('e3', 'NotebookEdit', { notebook_path: '/p/n.ipynb' }),
          toolUse('e4', 'Edit', { file_path: '/p/b.ts' }),
          toolUse('r1', 'Read', { file_path: '/p/c.ts' }),
        ]),
        user(1, [toolResult('e1', 'ok'), toolResult('e2', 'ok'), toolResult('e3', 'ok'), toolResult('e4', 'no match', true), toolResult('r1', 'x')]),
      ]);
      expect([...r.touchedFiles.keys()].sort()).toEqual(['/p/a.ts', '/p/n.ipynb']);
      expect(r.touchedFiles.get('/p/a.ts')?.edits).toBe(2);
    });

    it('does not persist file bodies with a running write', async () => {
      const r = await parse([assistant(0, [toolUse('w1', 'Write', { file_path: '/p/a.ts', content: 'x'.repeat(1000) })])]);
      expect(r.toolUses.get('w1')?.input).toEqual({ file_path: '/p/a.ts' });
    });
  });

  describe('tool errors', () => {
    it('records failed tools with their target and first error line', async () => {
      const r = await parse([
        assistant(0, [toolUse('b1', 'Bash', { command: 'npm test' })]),
        user(1, [toolResult('b1', [{ type: 'text', text: '<tool_use_error>Exit code 1\nstack</tool_use_error>' }], true)]),
      ]);
      expect(r.toolErrors).toEqual([{ at: Date.parse(ts(1)), tool: 'Bash', target: 'npm test', message: 'Exit code 1' }]);
    });

    it('keeps only the last MAX_TOOL_ERRORS', async () => {
      const { MAX_TOOL_ERRORS } = await import('../utils/transcript-parser.js');
      const entries = Array.from({ length: MAX_TOOL_ERRORS + 3 }, (_, i) => [
        assistant(i * 2, [toolUse(`b${i}`, 'Bash', { command: `c${i}` })]),
        user(i * 2 + 1, [toolResult(`b${i}`, `err ${i}`, true)]),
      ]).flat();
      const r = await parse(entries);
      expect(r.toolErrors).toHaveLength(MAX_TOOL_ERRORS);
      expect(r.toolErrors[0].message).toBe('err 3');
    });
  });

  describe('background tasks', () => {
    it('tracks a background command from launch to notification', async () => {
      const r = await parse([
        assistant(0, [toolUse('b1', 'Bash', { command: 'gh run watch', description: 'Watch CI', run_in_background: true })]),
        user(1, [toolResult('b1', 'Command running in background with ID: bqk1. Output is being written to: /tmp/x')]),
        user(31, '<task-notification>\n<task-id>bqk1</task-id>\n<status>completed</status>\n<summary>Watch CI completed (exit code 0)</summary>\n</task-notification>'),
      ]);
      expect(r.backgroundTasks.get('bqk1')).toEqual({
        kind: 'bash',
        description: 'Watch CI',
        startedAt: Date.parse(ts(1)),
        status: 'completed',
        summary: 'Watch CI completed (exit code 0)',
        endedAt: Date.parse(ts(31)),
      });
      // A notification is not a prompt.
      expect(r.turns).toHaveLength(0);
    });

    it('tracks async agents and lets a later notification overwrite', async () => {
      const r = await parse([
        assistant(0, [toolUse('a1', 'Agent', { description: 'Review diff', subagent_type: 'Explore' })]),
        user(1, [toolResult('a1', [{ type: 'text', text: 'Async agent launched successfully.\nagentId: a746 (internal ID)' }])]),
        user(2, [{ type: 'text', text: '<task-notification><task-id>a746</task-id><status>completed</status></task-notification>' }]),
        user(3, '<task-notification><task-id>a746</task-id><status>failed</status></task-notification>'),
        user(4, '<task-notification><task-id>unknown</task-id><status>completed</status></task-notification>'),
      ]);
      expect(r.backgroundTasks.size).toBe(1);
      expect(r.backgroundTasks.get('a746')).toMatchObject({ kind: 'agent', description: 'Review diff', status: 'failed' });
    });

    it('ignores a synchronous agent result', async () => {
      const r = await parse([
        assistant(0, [toolUse('a1', 'Agent', { description: 'x' })]),
        user(1, [toolResult('a1', 'Here is the agentId: abc of nothing')]),
      ]);
      expect(r.backgroundTasks.size).toBe(0);
    });
  });

  describe('extractTodoList', () => {
    it('prefers Tasks API and falls back to TodoWrite', async () => {
      const { extractTodoList } = await import('../utils/transcript-parser.js');
      const fromTodo = await parse([
        assistant(0, [toolUse('w1', 'TodoWrite', { todos: [{ content: 'a', status: 'done' }, { content: 'b', status: 'pending' }] })]),
        user(1, [toolResult('w1', 'ok')]),
      ]);
      expect(extractTodoList(fromTodo)).toEqual([
        { content: 'a', status: 'completed' },
        { content: 'b', status: 'pending' },
      ]);
      fromTodo.tasks.set('1', { subject: 'task', status: 'in_progress' });
      expect(extractTodoList(fromTodo)).toEqual([{ content: 'task', status: 'in_progress' }]);
    });
  });
});
