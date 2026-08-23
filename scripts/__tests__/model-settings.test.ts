/**
 * @handbook 8.1-test-structure
 * @covers scripts/widgets/model.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm, utimes } from 'fs/promises';
import path from 'path';
import os from 'os';
import type { WidgetContext } from '../types.js';

const TEST_DIR = path.join(os.tmpdir(), 'claude-dashboard-model-test-' + process.pid);
const SETTINGS_FILE = path.join(TEST_DIR, '.claude', 'settings.json');

// Second account's config dir, as relocated via CLAUDE_CONFIG_DIR
const ALT_CONFIG_DIR = path.join(TEST_DIR, '.claude-max');
const ALT_SETTINGS_FILE = path.join(ALT_CONFIG_DIR, 'settings.json');

// Mock homedir to use test directory
vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return { ...actual, homedir: () => TEST_DIR };
});

const ctx = { stdin: { model: { id: 'claude-fable-5' } } } as unknown as WidgetContext;

describe('model settings (getData)', () => {
  const originalConfigDir = process.env.CLAUDE_CONFIG_DIR;
  const originalEnvEffort = process.env.CLAUDE_CODE_EFFORT_LEVEL;

  beforeEach(async () => {
    vi.resetModules();
    // Keep a contributor's own env from leaking into these tests
    delete process.env.CLAUDE_CONFIG_DIR;
    delete process.env.CLAUDE_CODE_EFFORT_LEVEL;
    await mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
    await mkdir(ALT_CONFIG_DIR, { recursive: true });
  });

  afterEach(async () => {
    if (originalConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = originalConfigDir;
    if (originalEnvEffort === undefined) delete process.env.CLAUDE_CODE_EFFORT_LEVEL;
    else process.env.CLAUDE_CODE_EFFORT_LEVEL = originalEnvEffort;
    try {
      await rm(TEST_DIR, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  it('should read effortLevel from the config dir settings.json', async () => {
    await writeFile(SETTINGS_FILE, JSON.stringify({ effortLevel: 'low' }));

    const { modelWidget } = await import('../widgets/model.js');
    const data = await modelWidget.getData(ctx);

    expect(data?.effortLevel).toBe('low');
  });

  it('should not serve one account\'s cached effort for the other when mtimes collide', async () => {
    await writeFile(SETTINGS_FILE, JSON.stringify({ effortLevel: 'low' }));
    await writeFile(ALT_SETTINGS_FILE, JSON.stringify({ effortLevel: 'max' }));
    // Force identical mtimes so mtime alone cannot distinguish the two files
    const sharedMtime = new Date('2024-01-01T00:00:00Z');
    await utimes(SETTINGS_FILE, sharedMtime, sharedMtime);
    await utimes(ALT_SETTINGS_FILE, sharedMtime, sharedMtime);

    const { modelWidget } = await import('../widgets/model.js');

    expect((await modelWidget.getData(ctx))?.effortLevel).toBe('low');

    // Same process, config dir switches to the relocated account
    process.env.CLAUDE_CONFIG_DIR = ALT_CONFIG_DIR;
    expect((await modelWidget.getData(ctx))?.effortLevel).toBe('max');
  });

  it('should prefer the per-model effortLevel in modelSettings over the top-level key', async () => {
    // `/effort` writes per-model settings; the legacy top-level key may hold a stale value
    await writeFile(SETTINGS_FILE, JSON.stringify({
      effortLevel: 'high',
      modelSettings: {
        'claude-opus-4-8': { effortLevel: 'high' },
        'claude-fable-5': { effortLevel: 'medium' },
      },
    }));

    const { modelWidget } = await import('../widgets/model.js');
    const data = await modelWidget.getData(ctx);

    expect(data?.effortLevel).toBe('medium');
  });

  it('should fall back to the top-level effortLevel when modelSettings has no entry for the model', async () => {
    await writeFile(SETTINGS_FILE, JSON.stringify({
      effortLevel: 'low',
      modelSettings: { 'claude-opus-4-8': { effortLevel: 'max' } },
    }));

    const { modelWidget } = await import('../widgets/model.js');
    const data = await modelWidget.getData(ctx);

    expect(data?.effortLevel).toBe('low');
  });

  it('should resolve per-model effort for a different model id without a stale cache hit', async () => {
    await writeFile(SETTINGS_FILE, JSON.stringify({
      modelSettings: {
        'claude-opus-4-8': { effortLevel: 'max' },
        'claude-fable-5': { effortLevel: 'medium' },
      },
    }));

    const { modelWidget } = await import('../widgets/model.js');
    expect((await modelWidget.getData(ctx))?.effortLevel).toBe('medium');

    const opusCtx = { stdin: { model: { id: 'claude-opus-4-8' } } } as unknown as WidgetContext;
    expect((await modelWidget.getData(opusCtx))?.effortLevel).toBe('max');
  });

  it('should match the per-model entry when stdin carries the [1m] context suffix', async () => {
    // `/effort` strips `[1m]` before keying modelSettings, but the status line's
    // `model.id` keeps it for 1M-context sessions
    await writeFile(SETTINGS_FILE, JSON.stringify({
      effortLevel: 'high',
      modelSettings: { 'claude-fable-5': { effortLevel: 'medium' } },
    }));

    const { modelWidget } = await import('../widgets/model.js');
    const oneMCtx = { stdin: { model: { id: 'claude-fable-5[1m]' } } } as unknown as WidgetContext;

    expect((await modelWidget.getData(oneMCtx))?.effortLevel).toBe('medium');
  });

  it('should prefer an exact modelSettings key over a suffix-normalized match', async () => {
    await writeFile(SETTINGS_FILE, JSON.stringify({
      modelSettings: {
        'claude-fable-5': { effortLevel: 'medium' },
        'claude-fable-5[1m]': { effortLevel: 'low' },
      },
    }));

    const { modelWidget } = await import('../widgets/model.js');
    const oneMCtx = { stdin: { model: { id: 'claude-fable-5[1m]' } } } as unknown as WidgetContext;

    expect((await modelWidget.getData(oneMCtx))?.effortLevel).toBe('low');
    expect((await modelWidget.getData(ctx))?.effortLevel).toBe('medium');
  });

  it('should let CLAUDE_CODE_EFFORT_LEVEL override settings.json like Claude Code does', async () => {
    await writeFile(SETTINGS_FILE, JSON.stringify({
      effortLevel: 'high',
      modelSettings: { 'claude-fable-5': { effortLevel: 'medium' } },
    }));
    process.env.CLAUDE_CODE_EFFORT_LEVEL = 'low';

    const { modelWidget } = await import('../widgets/model.js');

    expect((await modelWidget.getData(ctx))?.effortLevel).toBe('low');
  });

  it('should ignore an invalid CLAUDE_CODE_EFFORT_LEVEL and fall through to settings.json', async () => {
    await writeFile(SETTINGS_FILE, JSON.stringify({ effortLevel: 'high' }));
    process.env.CLAUDE_CODE_EFFORT_LEVEL = 'turbo';

    const { modelWidget } = await import('../widgets/model.js');

    expect((await modelWidget.getData(ctx))?.effortLevel).toBe('high');
  });

  it('should apply CLAUDE_CODE_EFFORT_LEVEL on a settings cache hit too', async () => {
    await writeFile(SETTINGS_FILE, JSON.stringify({ effortLevel: 'high' }));

    const { modelWidget } = await import('../widgets/model.js');
    expect((await modelWidget.getData(ctx))?.effortLevel).toBe('high'); // fills the cache

    process.env.CLAUDE_CODE_EFFORT_LEVEL = 'low';
    expect((await modelWidget.getData(ctx))?.effortLevel).toBe('low'); // same mtime → cache hit
  });
});
