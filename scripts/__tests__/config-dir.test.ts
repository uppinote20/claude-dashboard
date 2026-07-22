/**
 * @handbook 8.1-test-structure
 * @covers scripts/utils/config-dir.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';

const TEST_HOME = path.join(os.tmpdir(), 'claude-dashboard-configdir-test-' + process.pid);

// Mock homedir so the default branch is assertable without touching the real home
vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return { ...actual, homedir: () => TEST_HOME };
});

describe('config-dir', () => {
  const originalEnv = process.env.CLAUDE_CONFIG_DIR;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.CLAUDE_CONFIG_DIR;
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = originalEnv;
  });

  describe('getClaudeConfigDir', () => {
    it('should default to ~/.claude when CLAUDE_CONFIG_DIR is unset', async () => {
      const { getClaudeConfigDir } = await import('../utils/config-dir.js');

      expect(getClaudeConfigDir()).toBe(path.join(TEST_HOME, '.claude'));
    });

    it('should use CLAUDE_CONFIG_DIR when set', async () => {
      // Strict replacement, not a search path: Claude Code itself reports
      // "not logged in" rather than falling back to ~/.claude.
      process.env.CLAUDE_CONFIG_DIR = '/custom/claude-max';

      const { getClaudeConfigDir } = await import('../utils/config-dir.js');

      expect(getClaudeConfigDir()).toBe('/custom/claude-max');
    });

    it('should read the env var at call time, not import time', async () => {
      const { getClaudeConfigDir } = await import('../utils/config-dir.js');
      expect(getClaudeConfigDir()).toBe(path.join(TEST_HOME, '.claude'));

      process.env.CLAUDE_CONFIG_DIR = '/switched-mid-process';

      expect(getClaudeConfigDir()).toBe('/switched-mid-process');
    });

    it('should ignore an empty CLAUDE_CONFIG_DIR instead of building a relative path', async () => {
      process.env.CLAUDE_CONFIG_DIR = '';

      const { getClaudeConfigDir } = await import('../utils/config-dir.js');

      expect(getClaudeConfigDir()).toBe(path.join(TEST_HOME, '.claude'));
      expect(path.isAbsolute(getClaudeConfigDir())).toBe(true);
    });
  });

  describe('getClaudeJsonPath', () => {
    it('should default to $HOME/.claude.json (beside ~/.claude, not inside it)', async () => {
      const { getClaudeJsonPath } = await import('../utils/config-dir.js');

      expect(getClaudeJsonPath()).toBe(path.join(TEST_HOME, '.claude.json'));
      // The asymmetry that makes this a separate helper: NOT ~/.claude/.claude.json
      expect(getClaudeJsonPath()).not.toBe(path.join(TEST_HOME, '.claude', '.claude.json'));
    });

    it('should move inside CLAUDE_CONFIG_DIR when set', async () => {
      process.env.CLAUDE_CONFIG_DIR = '/custom/claude-max';

      const { getClaudeJsonPath } = await import('../utils/config-dir.js');

      expect(getClaudeJsonPath()).toBe(path.join('/custom/claude-max', '.claude.json'));
    });
  });
});
