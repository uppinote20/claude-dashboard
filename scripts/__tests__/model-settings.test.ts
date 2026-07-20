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
});
