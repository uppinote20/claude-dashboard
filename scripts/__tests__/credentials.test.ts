/**
 * @handbook 8.1-test-structure
 * @covers scripts/utils/credentials.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm, utimes } from 'fs/promises';
import path from 'path';
import os from 'os';

const TEST_DIR = path.join(os.tmpdir(), 'claude-dashboard-cred-test-' + process.pid);
const CRED_DIR = path.join(TEST_DIR, '.claude');
const CRED_FILE = path.join(CRED_DIR, '.credentials.json');

// Second account's config dir, as relocated via CLAUDE_CONFIG_DIR
const ALT_CONFIG_DIR = path.join(TEST_DIR, '.claude-max');
const ALT_CRED_FILE = path.join(ALT_CONFIG_DIR, '.credentials.json');

// Mock homedir to use test directory
vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return { ...actual, homedir: () => TEST_DIR };
});

// Mock child_process to prevent actual keychain access.
// execFile callback: (error, stdout, stderr)
vi.mock('child_process', () => ({
  execFile: (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
    cb(new Error('keychain not available'), '', '');
  },
}));

describe('credentials', () => {
  const originalConfigDir = process.env.CLAUDE_CONFIG_DIR;

  beforeEach(async () => {
    vi.resetModules();
    // Keep a contributor's own CLAUDE_CONFIG_DIR from leaking into these tests
    delete process.env.CLAUDE_CONFIG_DIR;
    await mkdir(CRED_DIR, { recursive: true });
  });

  afterEach(async () => {
    if (originalConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = originalConfigDir;
    try {
      await rm(TEST_DIR, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  describe('getCredentials', () => {
    it('should return null when credentials file does not exist', async () => {
      try { await rm(CRED_FILE); } catch { /* already gone */ }

      const { getCredentials } = await import('../utils/credentials.js');
      const token = await getCredentials();
      expect(token).toBeNull();
    });

    it('should return token from valid credentials file', async () => {
      await writeFile(CRED_FILE, JSON.stringify({
        claudeAiOauth: { accessToken: 'test-token-123' },
      }));

      const { getCredentials } = await import('../utils/credentials.js');
      const token = await getCredentials();
      expect(token).toBe('test-token-123');
    });

    it('should return null for invalid JSON', async () => {
      await writeFile(CRED_FILE, 'not valid json');

      const { getCredentials } = await import('../utils/credentials.js');
      const token = await getCredentials();
      expect(token).toBeNull();
    });

    it('should return null when accessToken is missing', async () => {
      await writeFile(CRED_FILE, JSON.stringify({ claudeAiOauth: {} }));

      const { getCredentials } = await import('../utils/credentials.js');
      const token = await getCredentials();
      expect(token).toBeNull();
    });

    it('should cache credentials by mtime', async () => {
      await writeFile(CRED_FILE, JSON.stringify({
        claudeAiOauth: { accessToken: 'token-1' },
      }));

      const { getCredentials } = await import('../utils/credentials.js');

      const first = await getCredentials();
      expect(first).toBe('token-1');

      const second = await getCredentials();
      expect(second).toBe('token-1');
    });
  });

  // Issue #81: two accounts side by side — the default ~/.claude holds one
  // account while CLAUDE_CONFIG_DIR points the running session at the other.
  describe('CLAUDE_CONFIG_DIR (multi-account)', () => {
    beforeEach(async () => {
      await mkdir(ALT_CONFIG_DIR, { recursive: true });
      await writeFile(CRED_FILE, JSON.stringify({
        claudeAiOauth: { accessToken: 'default-account-token' },
      }));
      await writeFile(ALT_CRED_FILE, JSON.stringify({
        claudeAiOauth: { accessToken: 'relocated-account-token' },
      }));
    });

    it('should read the relocated account token when CLAUDE_CONFIG_DIR is set', async () => {
      process.env.CLAUDE_CONFIG_DIR = ALT_CONFIG_DIR;

      const { getCredentials } = await import('../utils/credentials.js');

      expect(await getCredentials()).toBe('relocated-account-token');
    });

    it('should read the default account token when CLAUDE_CONFIG_DIR is unset', async () => {
      const { getCredentials } = await import('../utils/credentials.js');

      expect(await getCredentials()).toBe('default-account-token');
    });

    it('should not serve one account\'s cached token for the other when mtimes collide', async () => {
      // Force identical mtimes so mtime alone cannot distinguish the two files
      const sharedMtime = new Date('2024-01-01T00:00:00Z');
      await utimes(CRED_FILE, sharedMtime, sharedMtime);
      await utimes(ALT_CRED_FILE, sharedMtime, sharedMtime);

      process.env.CLAUDE_CONFIG_DIR = ALT_CONFIG_DIR;
      const { getCredentials } = await import('../utils/credentials.js');
      expect(await getCredentials()).toBe('relocated-account-token');

      // Same process, back to the default account: the relocated token
      // must not leak through the mtime-keyed cache
      delete process.env.CLAUDE_CONFIG_DIR;
      expect(await getCredentials()).toBe('default-account-token');
    });
  });
});
