/**
 * @handbook 8.1-test-structure
 * @covers scripts/utils/credentials.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import path from 'path';
import os from 'os';

const TEST_DIR = path.join(os.tmpdir(), 'claude-dashboard-cred-test-' + process.pid);
const CRED_DIR = path.join(TEST_DIR, '.claude');
const CRED_FILE = path.join(CRED_DIR, '.credentials.json');

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
  beforeEach(async () => {
    vi.resetModules();
    await mkdir(CRED_DIR, { recursive: true });
  });

  afterEach(async () => {
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
});
