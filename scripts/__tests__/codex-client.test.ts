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
  });
});
