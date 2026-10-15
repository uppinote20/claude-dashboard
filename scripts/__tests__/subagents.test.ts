/**
 * @handbook 8.1-test-structure
 * @covers scripts/utils/subagents.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm, utimes } from 'fs/promises';
import path from 'path';
import os from 'os';

const TEST_DIR = path.join(os.tmpdir(), 'claude-dashboard-subagents-test');
const SESSION = path.join(TEST_DIR, 'session.jsonl');
const SUB_DIR = path.join(TEST_DIR, 'session', 'subagents');
const NOW = Date.UTC(2026, 0, 1, 1, 0, 0);
const ts = (s: number) => new Date(NOW - 3600_000 + s * 1000).toISOString();

async function writeAgent(id: string, meta: object | string, records: object[], mtime = NOW) {
  await writeFile(path.join(SUB_DIR, `agent-${id}.meta.json`), typeof meta === 'string' ? meta : JSON.stringify(meta));
  const file = path.join(SUB_DIR, `agent-${id}.jsonl`);
  await writeFile(file, records.map((r) => JSON.stringify({ isSidechain: true, ...r })).join('\n') + '\n');
  await utimes(file, mtime / 1000, mtime / 1000);
}

const prompt = { type: 'user', timestamp: ts(0), message: { content: 'do it' } };
const working = (s: number) => ({
  type: 'assistant',
  timestamp: ts(s),
  message: { model: 'claude-sonnet-5-5', stop_reason: 'tool_use', content: [{ type: 'tool_use', id: `t${s}`, name: 'Bash', input: { command: 'npm test' } }] },
});
const finished = (s: number) => ({
  type: 'assistant',
  timestamp: ts(s),
  message: { model: 'claude-haiku-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: 'done' }] },
});

describe('listSubagents', () => {
  beforeEach(async () => {
    vi.resetModules();
    await mkdir(SUB_DIR, { recursive: true });
    vi.spyOn(os, 'homedir').mockReturnValue(TEST_DIR);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it('returns [] when the session has no subagents directory', async () => {
    const { listSubagents } = await import('../utils/subagents.js');
    expect(await listSubagents(path.join(TEST_DIR, 'other.jsonl'), NOW)).toEqual([]);
  });

  it('reads type, model, status, tools and running tool; running first', async () => {
    await writeAgent('done1', { agentType: 'Explore', description: 'scan' }, [
      prompt,
      { type: 'assistant', timestamp: ts(1), message: { content: [{ type: 'tool_use', id: 'r1', name: 'Read', input: { file_path: '/p/a.ts' } }] } },
      { type: 'user', timestamp: ts(2), message: { content: [{ type: 'tool_result', tool_use_id: 'r1', content: 'x' }] } },
      finished(3),
    ]);
    await writeAgent('run1', { agentType: 'fast-worker', description: 'tests' }, [prompt, working(5)]);

    const { listSubagents } = await import('../utils/subagents.js');
    const agents = await listSubagents(SESSION, NOW);
    expect(agents.map((a) => [a.id, a.type, a.status])).toEqual([
      ['run1', 'fast-worker', 'running'],
      ['done1', 'Explore', 'done'],
    ]);
    expect(agents[0]).toMatchObject({ model: 'claude-sonnet-5-5', runningTool: 'Bash(npm test)', description: 'tests' });
    expect(agents[1]).toMatchObject({ model: 'claude-haiku-5-5', tools: 1, startedAt: Date.parse(ts(0)), lastAt: Date.parse(ts(3)) });
  });

  it('marks a running agent stale when its transcript stopped changing', async () => {
    const { listSubagents, STALE_AFTER_MS } = await import('../utils/subagents.js');
    await writeAgent('old', { agentType: 'scout' }, [prompt, working(1)], NOW - STALE_AFTER_MS - 1000);
    expect((await listSubagents(SESSION, NOW))[0].status).toBe('stale');
  });

  it('collects files the subagent wrote', async () => {
    await writeAgent('w', { agentType: 'fast-worker' }, [
      prompt,
      { type: 'assistant', timestamp: ts(1), message: { content: [{ type: 'tool_use', id: 'e1', name: 'Edit', input: { file_path: '/p/a.ts' } }] } },
      { type: 'user', timestamp: ts(2), message: { content: [{ type: 'tool_result', tool_use_id: 'e1', content: 'ok' }] } },
    ]);
    const { listSubagents } = await import('../utils/subagents.js');
    expect([...(await listSubagents(SESSION, NOW))[0].touchedFiles.keys()]).toEqual(['/p/a.ts']);
  });

  it('skips an agent with broken meta and keeps the rest', async () => {
    await writeAgent('bad', '{not json', [prompt]);
    await writeAgent('ok', { agentType: 'scout' }, [prompt, finished(1)]);
    const { listSubagents } = await import('../utils/subagents.js');
    expect((await listSubagents(SESSION, NOW)).map((a) => a.id)).toEqual(['ok']);
  });

  it('parses only the `limit` most recently written transcripts', async () => {
    await writeAgent('older', { agentType: 'a' }, [prompt, finished(1)], NOW - 5000);
    await writeAgent('newer', { agentType: 'b' }, [prompt, finished(1)], NOW - 1000);
    const { listSubagents } = await import('../utils/subagents.js');
    expect((await listSubagents(SESSION, NOW, 1)).map((a) => a.id)).toEqual(['newer']);
  });
});
