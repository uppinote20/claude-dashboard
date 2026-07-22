/**
 * @handbook 8.1-test-structure
 * @covers scripts/widgets/config-counts.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import path from 'path';
import os from 'os';
import type { WidgetContext } from '../types.js';

const TEST_DIR = path.join(os.tmpdir(), 'claude-dashboard-configcounts-test-' + process.pid);
const PROJECT_DIR = path.join(TEST_DIR, 'proj');
const DEFAULT_CLAUDE_JSON = path.join(TEST_DIR, '.claude.json');

// Second account's config dir — .claude.json moves *inside* it
const ALT_CONFIG_DIR = path.join(TEST_DIR, '.claude-max');
const ALT_CLAUDE_JSON = path.join(ALT_CONFIG_DIR, '.claude.json');

vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return { ...actual, homedir: () => TEST_DIR };
});

const ctx = { stdin: { workspace: { current_dir: PROJECT_DIR } } } as unknown as WidgetContext;

describe('configCounts (getData)', () => {
  const originalConfigDir = process.env.CLAUDE_CONFIG_DIR;
  const originalHome = process.env.HOME;

  beforeEach(async () => {
    vi.resetModules();
    delete process.env.CLAUDE_CONFIG_DIR;
    // countMcps' XDG path derives from HOME; pin it to the sandbox
    process.env.HOME = TEST_DIR;
    await mkdir(PROJECT_DIR, { recursive: true });
    await mkdir(ALT_CONFIG_DIR, { recursive: true });
    await writeFile(DEFAULT_CLAUDE_JSON, JSON.stringify({ mcpServers: { a: {}, b: {} } }));
    await writeFile(ALT_CLAUDE_JSON, JSON.stringify({ mcpServers: { x: {} } }));
  });

  afterEach(async () => {
    if (originalConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = originalConfigDir;
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    try {
      await rm(TEST_DIR, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  it('should count global MCP servers from the default .claude.json', async () => {
    const { configCountsWidget } = await import('../widgets/config-counts.js');

    expect((await configCountsWidget.getData(ctx))?.mcps).toBe(2);
  });

  it('should not serve one account\'s cached MCP count for the other within the TTL', async () => {
    const { configCountsWidget } = await import('../widgets/config-counts.js');

    expect((await configCountsWidget.getData(ctx))?.mcps).toBe(2);

    // Same process, same projectDir, still inside the 30s TTL — only the config dir switches
    process.env.CLAUDE_CONFIG_DIR = ALT_CONFIG_DIR;
    expect((await configCountsWidget.getData(ctx))?.mcps).toBe(1);
  });
});
