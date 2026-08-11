/**
 * @handbook 8.1-test-structure
 * @covers scripts/utils/codex-client.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('codex-client', () => {
  describe('fetchCodexUsage file cache integration', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.doUnmock('../utils/file-cache.js');
      vi.doUnmock('fs/promises');
      vi.doUnmock('child_process');
    });

    it('returns file cache hit and skips network fetch', async () => {
      const sample = {
        model: 'gpt-5',
        planType: 'plus',
        primary: { usedPercent: 42, resetAt: Date.now() + 3_600_000 },
        secondary: null,
      };

      const authJson = JSON.stringify({
        tokens: { access_token: 'codex-token', account_id: 'acct-1' },
      });

      vi.doMock('fs/promises', async (importOriginal) => {
        const actual = await importOriginal<typeof import('fs/promises')>();
        return {
          ...actual,
          stat: vi.fn().mockResolvedValue({ mtimeMs: 12345 }),
          readFile: vi.fn().mockResolvedValue(authJson),
        };
      });

      vi.doMock('../utils/file-cache.js', () => ({
        loadFileCache: vi.fn().mockResolvedValue({ data: sample, timestamp: Date.now() }),
        saveFileCache: vi.fn(),
        fileCachePath: (name: string) => `/tmp/${name}`,
        FILE_CACHE_DIR: '/tmp',
        STALE_CACHE_TTL_SECONDS: 3600,
      }));

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('{}', { status: 200 })
      );

      const { fetchCodexUsage, clearCodexCache } = await import('../utils/codex-client.js');
      clearCodexCache();

      const result = await fetchCodexUsage();

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(result).toEqual(sample);
    });

    it('writes to file cache after successful API fetch', async () => {
      const saveSpy = vi.fn().mockResolvedValue(undefined);

      const authJson = JSON.stringify({
        tokens: { access_token: 'codex-token', account_id: 'acct-1' },
      });

      vi.doMock('fs/promises', async (importOriginal) => {
        const actual = await importOriginal<typeof import('fs/promises')>();
        return {
          ...actual,
          stat: vi.fn().mockResolvedValue({ mtimeMs: 12345 }),
          readFile: vi.fn().mockImplementation((path: unknown) => {
            if (typeof path === 'string' && path.includes('auth.json')) {
              return Promise.resolve(authJson);
            }
            return Promise.reject(new Error('ENOENT'));
          }),
        };
      });

      // Mock child_process so detectModelFromCodexExec fails fast
      // instead of spawning a real codex CLI subprocess.
      vi.doMock('child_process', async (importOriginal) => {
        const actual = await importOriginal<typeof import('child_process')>();
        return {
          ...actual,
          execFile: vi.fn((_cmd: string, _args: unknown, opts: unknown, cb: unknown) => {
            const callback = typeof opts === 'function' ? opts : cb;
            if (typeof callback === 'function') {
              callback(new Error('mock: codex CLI unavailable'), '', '');
            }
            return { on: () => {} };
          }),
        };
      });

      vi.doMock('../utils/file-cache.js', () => ({
        loadFileCache: vi.fn().mockResolvedValue(null),
        saveFileCache: saveSpy,
        fileCachePath: (name: string) => `/tmp/${name}`,
        FILE_CACHE_DIR: '/tmp',
        STALE_CACHE_TTL_SECONDS: 3600,
      }));

      const apiResponse = {
        plan_type: 'plus',
        rate_limit: {
          primary_window: { used_percent: 42, reset_at: Date.now() + 3_600_000 },
          secondary_window: null,
        },
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(apiResponse), { status: 200 })
      );

      const { fetchCodexUsage, clearCodexCache } = await import('../utils/codex-client.js');
      clearCodexCache();

      const result = await fetchCodexUsage();

      expect(saveSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).toHaveBeenCalledWith(
        expect.stringContaining('codex-usage-'),
        expect.objectContaining({ planType: 'plus' })
      );
      expect(result).toMatchObject({ planType: 'plus' });
      // API omitted limit_window_seconds, so consumers fall back to positional labels
      expect(result?.primary?.windowSeconds).toBeNull();
    });

    it('carries limit_window_seconds through as windowSeconds', async () => {
      // Duration-based window labels hang off this one mapping. Widget and
      // check-usage tests mock fetchCodexUsage, so they stay green even if it
      // is dropped — this is the only test that reads the raw API field.
      const authJson = JSON.stringify({
        tokens: { access_token: 'codex-token', account_id: 'acct-1' },
      });

      vi.doMock('fs/promises', async (importOriginal) => {
        const actual = await importOriginal<typeof import('fs/promises')>();
        return {
          ...actual,
          stat: vi.fn().mockResolvedValue({ mtimeMs: 12345 }),
          readFile: vi.fn().mockImplementation((path: unknown) => {
            if (typeof path === 'string' && path.includes('auth.json')) {
              return Promise.resolve(authJson);
            }
            return Promise.reject(new Error('ENOENT'));
          }),
        };
      });

      vi.doMock('child_process', async (importOriginal) => {
        const actual = await importOriginal<typeof import('child_process')>();
        return {
          ...actual,
          execFile: vi.fn((_cmd: string, _args: unknown, opts: unknown, cb: unknown) => {
            const callback = typeof opts === 'function' ? opts : cb;
            if (typeof callback === 'function') {
              callback(new Error('mock: codex CLI unavailable'), '', '');
            }
            return { on: () => {} };
          }),
        };
      });

      vi.doMock('../utils/file-cache.js', () => ({
        loadFileCache: vi.fn().mockResolvedValue(null),
        saveFileCache: vi.fn().mockResolvedValue(undefined),
        fileCachePath: (name: string) => `/tmp/${name}`,
        FILE_CACHE_DIR: '/tmp',
        STALE_CACHE_TTL_SECONDS: 3600,
      }));

      // Codex Pro: a single weekly window in primary_window, no secondary
      const apiResponse = {
        plan_type: 'pro',
        rate_limit: {
          primary_window: {
            used_percent: 3,
            reset_at: 1786843831,
            limit_window_seconds: 604800,
          },
          secondary_window: null,
        },
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(apiResponse), { status: 200 })
      );

      const { fetchCodexUsage, clearCodexCache } = await import('../utils/codex-client.js');
      clearCodexCache();

      const result = await fetchCodexUsage();

      expect(result?.primary?.windowSeconds).toBe(604800);
      expect(result?.secondary).toBeNull();
    });
  });
});
