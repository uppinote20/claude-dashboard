/**
 * @handbook 8.1-test-structure
 * @covers scripts/views/index.ts
 * @covers scripts/views/turns.ts
 * @covers scripts/views/agents.ts
 * @covers scripts/views/files.ts
 * @covers scripts/views/todos.ts
 * @covers scripts/views/errors.ts
 * @covers scripts/views/background.ts
 * @covers scripts/views/shared.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import path from 'path';
import os from 'os';
import { MOCK_CONFIG, MOCK_STDIN, MOCK_TRANSLATIONS } from './fixtures.js';
import type { WidgetContext } from '../types.js';

const TEST_DIR = path.join(os.tmpdir(), 'claude-dashboard-pane-views-test');
const SESSION = path.join(TEST_DIR, 'session.jsonl');
const SUB_DIR = path.join(TEST_DIR, 'session', 'subagents');
const PROJECT = path.join(TEST_DIR, 'project');
const NOW = Date.UTC(2026, 0, 1, 1, 0, 0);
const ts = (s: number) => new Date(NOW - 600_000 + s * 1000).toISOString();

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

function ctx(): WidgetContext {
  return {
    stdin: { ...MOCK_STDIN, transcript_path: SESSION, workspace: { current_dir: PROJECT, project_dir: PROJECT } },
    config: MOCK_CONFIG,
    translations: MOCK_TRANSLATIONS,
    rateLimits: null,
  };
}

async function writeJsonl(file: string, records: object[]) {
  await writeFile(file, records.map((r) => JSON.stringify(r)).join('\n') + '\n');
}

const MAIN = [
  { type: 'user', timestamp: ts(0), message: { content: 'first prompt' } },
  {
    type: 'assistant',
    timestamp: ts(1),
    message: {
      id: 'm1',
      usage: { input_tokens: 1000, output_tokens: 200 },
      content: [
        { type: 'tool_use', id: 'e1', name: 'Edit', input: { file_path: path.join(PROJECT, 'src/a.ts') } },
        { type: 'tool_use', id: 'b1', name: 'Bash', input: { command: 'npm test' } },
        { type: 'tool_use', id: 'bg1', name: 'Bash', input: { command: 'watch', description: 'Watch CI' } },
        { type: 'tool_use', id: 'w1', name: 'TodoWrite', input: { todos: [{ content: 'plan', status: 'completed' }, { content: 'build', status: 'in_progress' }, { content: 'ship', status: 'pending' }] } },
      ],
    },
  },
  {
    type: 'user',
    timestamp: ts(2),
    message: {
      content: [
        { type: 'tool_result', tool_use_id: 'e1', content: 'ok' },
        { type: 'tool_result', tool_use_id: 'b1', content: 'Exit code 1\nFAIL', is_error: true },
        { type: 'tool_result', tool_use_id: 'bg1', content: 'Command running in background with ID: bx1.' },
        { type: 'tool_result', tool_use_id: 'w1', content: 'ok' },
      ],
    },
  },
  { type: 'assistant', timestamp: ts(10), message: { stop_reason: 'end_turn', content: [{ type: 'text', text: 'done' }] } },
  { type: 'user', timestamp: ts(20), message: { content: '<command-name>/ship</command-name>' } },
];

describe('renderPaneView', () => {
  beforeEach(async () => {
    vi.resetModules();
    await mkdir(SUB_DIR, { recursive: true });
    vi.spyOn(os, 'homedir').mockReturnValue(TEST_DIR);
    await writeJsonl(SESSION, MAIN);
    await writeFile(path.join(SUB_DIR, 'agent-s1.meta.json'), JSON.stringify({ agentType: 'fast-worker', description: 'write tests' }));
    await writeJsonl(path.join(SUB_DIR, 'agent-s1.jsonl'), [
      { isSidechain: true, type: 'user', timestamp: ts(3), message: { content: 'go' } },
      { isSidechain: true, type: 'assistant', timestamp: ts(4), message: { model: 'claude-sonnet-5-5', content: [{ type: 'tool_use', id: 'x1', name: 'Write', input: { file_path: path.join(PROJECT, 'src/a.ts') } }] } },
      { isSidechain: true, type: 'user', timestamp: ts(5), message: { content: [{ type: 'tool_result', tool_use_id: 'x1', content: 'ok' }] } },
    ]);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  async function render(view: Parameters<typeof import('../views/index.js')['renderPaneView']>[0], now = NOW) {
    const { renderPaneView } = await import('../views/index.js');
    return renderPaneView(view, ctx(), now);
  }

  it('turns: newest first with a sparkline header and per-turn cost', async () => {
    const lines = strip(await render('turns')).split('\n');
    expect(lines[0]).toMatch(/Turns · 2 · [▁▂▃▄▅▆▇█]{2}$/);
    expect(lines[1]).toMatch(/^▶ #2 .*\/ship/);
    expect(lines[2]).toMatch(/#1 .*first prompt {2}10s {2}↑1\.0K ↓200 {2}🔧️4/);
  });

  it('turns: the newest turn stops counting and loses its marker once the session goes quiet', async () => {
    const lines = strip(await render('turns', NOW + 60 * 60_000)).split('\n');
    expect(lines[1]).toMatch(/^ {2}#2 .*\/ship {2}0s/);
  });

  it('agents: running subagent with model and tool', async () => {
    const out = strip(await render('agents', Date.parse(ts(6))));
    expect(out).toContain('Agents · 1 running · 1');
    expect(out).toMatch(/▶ fast-worker {2}Sonnet 5\.5 {2}"write tests"/);
  });

  it('agents: an agent the user stopped shows its end status, not a success mark', async () => {
    await writeJsonl(SESSION, [
      ...MAIN,
      { type: 'assistant', timestamp: ts(21), message: { content: [{ type: 'tool_use', id: 'ag1', name: 'Agent', input: { description: 'write tests' } }] } },
      { type: 'user', timestamp: ts(22), message: { content: [{ type: 'tool_result', tool_use_id: 'ag1', content: 'Async agent launched successfully.\nagentId: s1' }] } },
      { type: 'user', timestamp: ts(23), message: { content: '<task-notification><task-id>s1</task-id><status>killed</status></task-notification>' } },
    ]);
    const out = strip(await render('agents', Date.parse(ts(30))));
    expect(out).toContain('Agents · 0 running · 1');
    expect(out).toMatch(/✗ killed fast-worker/);
    // The agent call is counted under 🤖 only, not also under 🔧.
    expect(strip(await render('turns', Date.parse(ts(30))))).toMatch(/#2 .*\/ship .*🤖️1$/m);
  });

  it('files: merges main and subagent writes, relative to the project', async () => {
    const out = strip(await render('files'));
    expect(out).toContain('Files · 1');
    expect(out).toMatch(/✎2 +src\/a\.ts {2}main \+1 agents/);
  });

  it('files: caps the list and says how many more there are', async () => {
    const edits = Array.from({ length: 33 }, (_, i) => i);
    await writeJsonl(SESSION, [
      { type: 'assistant', timestamp: ts(1), message: { content: edits.map((i) => ({ type: 'tool_use', id: `w${i}`, name: 'Write', input: { file_path: path.join(PROJECT, `f${i}.ts`) } })) } },
      { type: 'user', timestamp: ts(2), message: { content: edits.map((i) => ({ type: 'tool_result', tool_use_id: `w${i}`, content: 'ok' })) } },
    ]);
    const lines = strip(await render('files')).split('\n');
    // 33 main writes plus the fixture subagent's src/a.ts.
    expect(lines[0]).toContain('Files · 34');
    expect(lines).toHaveLength(1 + 30 + 1);
    expect(lines.at(-1)).toBe('  +4');
  });

  it('todos: every item with its state', async () => {
    expect(strip(await render('todos')).split('\n')).toEqual(['📋️ Todos · 1/3', '✓ plan', '▶ build', '○ ship']);
  });

  it('errors: tool, target and first line', async () => {
    expect(strip(await render('errors'))).toMatch(/✗ \d\d:\d\d {2}Bash\(npm test\) {2}Exit code 1$/m);
  });

  it('bg: a running job, then stale once the session is quiet', async () => {
    expect(strip(await render('bg', Date.parse(ts(30))))).toContain('▶ bash  "Watch CI"  28s');
    const quiet = strip(await render('bg', NOW + 60 * 60_000));
    expect(quiet).toContain('0 running');
    expect(quiet).toContain('? stale bash');
  });

  it('shows empty states and a missing transcript without throwing', async () => {
    await writeJsonl(SESSION, []);
    expect(strip(await render('errors'))).toContain('No failed tools');
    const { renderPaneView } = await import('../views/index.js');
    const noPath = { ...ctx(), stdin: { ...ctx().stdin, transcript_path: undefined } };
    expect(strip(await renderPaneView('turns', noPath, NOW))).toBe('Transcript not available yet');
  });

  it('emits no control characters besides SGR color codes', async () => {
    for (const view of ['turns', 'agents', 'files', 'todos', 'errors', 'bg'] as const) {
      const out = strip(await render(view));
      expect(out, view).not.toMatch(/[\x00-\x09\x0b-\x1f\x7f]/);
    }
  });
});
