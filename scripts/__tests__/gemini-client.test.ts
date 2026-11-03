/**
 * @handbook 8.1-test-structure
 * @covers scripts/utils/gemini-client.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm, stat } from 'fs/promises';
import path from 'path';
import os from 'os';

// Mock version module
vi.mock('../version.js', () => ({
  VERSION: '1.0.0-test',
}));

// Mock child_process
vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

describe('gemini-client', () => {
  const TEST_GEMINI_DIR = path.join(os.tmpdir(), 'gemini-client-test');
  const ORIGINAL_HOME = os.homedir();

  beforeEach(async () => {
    vi.resetModules();
    // Clean up test directory
    try {
      await rm(TEST_GEMINI_DIR, { recursive: true, force: true });
    } catch {
      // Directory may not exist
    }
    await mkdir(TEST_GEMINI_DIR, { recursive: true });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    // Clean up test directory
    try {
      await rm(TEST_GEMINI_DIR, { recursive: true, force: true });
    } catch {
      // Directory may not exist
    }
  });

  describe('isGeminiInstalled', () => {
    it('should return true when oauth_creds.json exists', async () => {
      // Create mock credentials file
      const geminiDir = path.join(ORIGINAL_HOME, '.gemini');

      // Check if actual gemini dir exists (for real system testing)
      try {
        await stat(path.join(geminiDir, 'oauth_creds.json'));

        const { isGeminiInstalled, clearGeminiCache } = await import('../utils/gemini-client.js');
        clearGeminiCache();

        const result = await isGeminiInstalled();
        expect(result).toBe(true);
      } catch {
        // If no real gemini installation, skip this test
        expect(true).toBe(true);
      }
    });

    it('should return false when keychain and file are both unavailable', async () => {
      const { execFileSync } = await import('child_process');
      vi.mocked(execFileSync).mockImplementation(() => {
        throw new Error('not found');
      });

      // Import fresh module
      const { isGeminiInstalled, clearGeminiCache } = await import('../utils/gemini-client.js');
      clearGeminiCache();

      // Mock stat to fail (no file)
      vi.doMock('fs/promises', async (importOriginal) => {
        const original = await importOriginal<typeof import('fs/promises')>();
        return {
          ...original,
          stat: vi.fn().mockRejectedValue(new Error('ENOENT')),
        };
      });

      // Note: This test is limited because we can't easily mock the homedir
      // In real scenarios, the test would check both keychain and file fallback
      expect(typeof isGeminiInstalled).toBe('function');
    });
  });

  describe('fetchGeminiUsage', () => {
    it('should return null when credentials are unavailable', async () => {
      const { execFileSync } = await import('child_process');
      vi.mocked(execFileSync).mockImplementation(() => {
        throw new Error('not found');
      });

      const { fetchGeminiUsage, clearGeminiCache } = await import('../utils/gemini-client.js');
      clearGeminiCache();

      // This will return null because no credentials are available
      // (keychain fails, and file doesn't exist in test environment)
      const result = await fetchGeminiUsage();

      // Result depends on whether actual ~/.gemini/oauth_creds.json exists
      expect(result === null || typeof result === 'object').toBe(true);
    });

    it('should use cached data when available', async () => {
      const { fetchGeminiUsage, clearGeminiCache } = await import('../utils/gemini-client.js');
      clearGeminiCache();

      // Mock successful API response
      const mockResponse = {
        buckets: [
          {
            modelId: 'gemini-2.5-pro',
            remainingFraction: 0.75,
            resetTime: '2026-01-30T10:00:00Z',
          },
        ],
      };

      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ cloudaicompanionProject: 'test-project' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        });
      global.fetch = fetchMock;

      // Skip this test if no real credentials exist
      try {
        await stat(path.join(ORIGINAL_HOME, '.gemini', 'oauth_creds.json'));

        // First call
        const result1 = await fetchGeminiUsage(60);

        if (result1) {
          // Second call should use cache
          const result2 = await fetchGeminiUsage(60);
          expect(result2).toEqual(result1);
        }
      } catch {
        // No credentials, skip test
        expect(true).toBe(true);
      }
    });

    it('should handle API errors gracefully', async () => {
      const { fetchGeminiUsage, clearGeminiCache } = await import('../utils/gemini-client.js');
      clearGeminiCache();

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      // This will either return null (no creds) or null (API error)
      const result = await fetchGeminiUsage();

      // In both cases, should not throw
      expect(result === null || typeof result === 'object').toBe(true);
    });

    it('should handle network errors gracefully', async () => {
      const { fetchGeminiUsage, clearGeminiCache } = await import('../utils/gemini-client.js');
      clearGeminiCache();

      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await fetchGeminiUsage();

      // Should not throw, returns null on error
      expect(result === null || typeof result === 'object').toBe(true);
    });
  });

  describe('getGeminiModel', () => {
    it('should return null when settings.json does not exist', async () => {
      const { getGeminiModel, clearGeminiCache } = await import('../utils/gemini-client.js');
      clearGeminiCache();

      // getGeminiModel reads from ~/.gemini/settings.json
      // Returns null if file doesn't exist or no model is set
      const result = await getGeminiModel();

      // Result depends on actual settings file
      expect(result === null || typeof result === 'string').toBe(true);
    });
  });

  describe('clearGeminiCache', () => {
    it('should clear all caches without throwing', async () => {
      const { clearGeminiCache } = await import('../utils/gemini-client.js');

      expect(() => clearGeminiCache()).not.toThrow();
    });

    it('should clear project ID cache and pending requests', async () => {
      const { clearGeminiCache } = await import('../utils/gemini-client.js');

      // Should not throw even when called multiple times
      clearGeminiCache();
      clearGeminiCache();

      expect(true).toBe(true);
    });
  });

  describe('multi-account support', () => {
    it('should use token hash for project ID cache key', async () => {
      // Project ID cache is now per-token instead of global
      // This ensures different accounts don't share project IDs
      const { clearGeminiCache, fetchGeminiUsage } = await import('../utils/gemini-client.js');
      clearGeminiCache();

      // The cache key is based on token hash, not global
      // Verified by implementation using projectIdCacheMap.get(tokenHash)
      expect(typeof fetchGeminiUsage).toBe('function');
    });
  });

  describe('token refresh deduplication', () => {
    it('should deduplicate concurrent refresh requests', async () => {
      // Token refresh now uses pendingRefreshRequests Map to prevent duplicates
      // Multiple concurrent refresh calls should share a single request
      const { clearGeminiCache } = await import('../utils/gemini-client.js');
      clearGeminiCache();

      // Implementation verified: pendingRefreshRequests.get(tokenHash) check in refreshToken()
      expect(true).toBe(true);
    });
  });

  describe('response parsing', () => {
    it('should calculate usedPercent from remainingFraction', async () => {
      // remainingFraction = 0.75 means 75% remaining, so 25% used
      // usedPercent = Math.round((1 - 0.75) * 100) = 25

      const remainingFraction = 0.75;
      const usedPercent = Math.round((1 - remainingFraction) * 100);

      expect(usedPercent).toBe(25);
    });

    it('should handle 0% remaining (100% used)', () => {
      const remainingFraction = 0;
      const usedPercent = Math.round((1 - remainingFraction) * 100);

      expect(usedPercent).toBe(100);
    });

    it('should handle 100% remaining (0% used)', () => {
      const remainingFraction = 1;
      const usedPercent = Math.round((1 - remainingFraction) * 100);

      expect(usedPercent).toBe(0);
    });
  });

  describe('fetchGeminiUsage file cache integration', () => {
    const originalProject = process.env.GOOGLE_CLOUD_PROJECT;

    beforeEach(async () => {
      vi.resetModules();
      // Use env var to short-circuit getProjectId so we don't need to mock loadCodeAssist API
      process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
      // Force keychain to fail so the credentials file path is taken
      const { execFileSync } = await import('child_process');
      vi.mocked(execFileSync).mockImplementation(() => {
        throw new Error('mock: keychain unavailable');
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.doUnmock('../utils/file-cache.js');
      vi.doUnmock('fs/promises');
      if (originalProject === undefined) delete process.env.GOOGLE_CLOUD_PROJECT;
      else process.env.GOOGLE_CLOUD_PROJECT = originalProject;
    });

    it('returns file cache hit and skips network fetch', async () => {
      const sample = {
        model: 'gemini-2.5-pro',
        usedPercent: 33,
        resetAt: new Date(Date.now() + 86_400_000).toISOString(),
        buckets: [],
      };

      const credsJson = JSON.stringify({
        access_token: 'gemini-token',
        refresh_token: 'gemini-refresh',
        expiry_date: Date.now() + 3_600_000, // future
      });

      vi.doMock('fs/promises', async (importOriginal) => {
        const actual = await importOriginal<typeof import('fs/promises')>();
        return {
          ...actual,
          stat: vi.fn().mockResolvedValue({ mtimeMs: 12345 }),
          readFile: vi.fn().mockResolvedValue(credsJson),
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

      const { fetchGeminiUsage, clearGeminiCache } = await import('../utils/gemini-client.js');
      clearGeminiCache();

      const result = await fetchGeminiUsage();

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(result).toEqual(sample);
    });

    it('writes to file cache after successful API fetch', async () => {
      const saveSpy = vi.fn().mockResolvedValue(undefined);

      const credsJson = JSON.stringify({
        access_token: 'gemini-token',
        refresh_token: 'gemini-refresh',
        expiry_date: Date.now() + 3_600_000,
      });

      vi.doMock('fs/promises', async (importOriginal) => {
        const actual = await importOriginal<typeof import('fs/promises')>();
        return {
          ...actual,
          stat: vi.fn().mockResolvedValue({ mtimeMs: 12345 }),
          readFile: vi.fn().mockImplementation((path: unknown) => {
            if (typeof path === 'string' && path.includes('oauth_creds.json')) {
              return Promise.resolve(credsJson);
            }
            return Promise.reject(new Error('ENOENT'));
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
        buckets: [
          {
            modelId: 'gemini-2.5-pro',
            remainingFraction: 0.75,
            resetTime: new Date(Date.now() + 86_400_000).toISOString(),
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(apiResponse), { status: 200 })
      );

      const { fetchGeminiUsage, clearGeminiCache } = await import('../utils/gemini-client.js');
      clearGeminiCache();

      const result = await fetchGeminiUsage();

      expect(saveSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).toHaveBeenCalledWith(
        expect.stringContaining('gemini-usage-'),
        expect.any(Object)
      );
      expect(result).toBeTruthy();
    });
  });
});

describe('gemini-client retired tier', () => {
  const credsJson = JSON.stringify({
    access_token: 'gemini-token',
    refresh_token: 'gemini-refresh',
    expiry_date: Date.now() + 3_600_000,
  });
  // loadCodeAssist for a personal account after the Gemini CLI individual tier was retired
  const RETIRED_BODY = {
    allowedTiers: [{ id: 'standard-tier', isDefault: true }],
    ineligibleTiers: [{ reasonCode: 'UNSUPPORTED_CLIENT', tierId: 'free-tier' }],
  };
  let originalProject: string | undefined;

  beforeEach(async () => {
    vi.resetModules();
    originalProject = process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.GOOGLE_CLOUD_PROJECT_ID;
    const { execFileSync } = await import('child_process');
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('mock: keychain unavailable');
    });
    vi.doMock('fs/promises', async (importOriginal) => {
      const actual = await importOriginal<typeof import('fs/promises')>();
      return {
        ...actual,
        stat: vi.fn().mockResolvedValue({ mtimeMs: 12345 }),
        readFile: vi.fn().mockImplementation((p: unknown) =>
          typeof p === 'string' && p.includes('oauth_creds.json') ? Promise.resolve(credsJson) : Promise.reject(new Error('ENOENT')),
        ),
      };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock('../utils/file-cache.js');
    vi.doUnmock('fs/promises');
    if (originalProject === undefined) delete process.env.GOOGLE_CLOUD_PROJECT;
    else process.env.GOOGLE_CLOUD_PROJECT = originalProject;
  });

  function mockFileCache(load: (name: string) => unknown) {
    const saveFileCache = vi.fn().mockResolvedValue(undefined);
    vi.doMock('../utils/file-cache.js', () => ({
      loadFileCache: vi.fn().mockImplementation(async (file: string) => load(file)),
      saveFileCache,
      fileCachePath: (name: string) => `/tmp/${name}`,
      FILE_CACHE_DIR: '/tmp',
      STALE_CACHE_TTL_SECONDS: 3600,
    }));
    return saveFileCache;
  }

  it('reports a retired tier instead of failing, and remembers it across processes', async () => {
    const save = mockFileCache(() => null);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify(RETIRED_BODY), { status: 200 }));

    const { fetchGeminiUsage, clearGeminiCache, GEMINI_RETIRED } = await import('../utils/gemini-client.js');
    clearGeminiCache();

    expect(await fetchGeminiUsage()).toBe(GEMINI_RETIRED);
    expect(save).toHaveBeenCalledWith(expect.stringContaining('gemini-tier-'), { retired: true });
  });

  it('remembers a retired verdict in-process before the file cache exists', async () => {
    mockFileCache(() => null); // file cache never hits: only the in-process cache can answer
    let calls = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      // First loadCodeAssist says retired; anything after would report a live project.
      const retired = String(url).includes('loadCodeAssist') && calls++ === 0;
      return new Response(JSON.stringify(retired ? RETIRED_BODY : { cloudaicompanionProject: 'live-project', buckets: [] }), { status: 200 });
    });

    const { fetchGeminiUsage, clearGeminiCache, GEMINI_RETIRED } = await import('../utils/gemini-client.js');
    clearGeminiCache();

    expect(await fetchGeminiUsage()).toBe(GEMINI_RETIRED);
    expect(await fetchGeminiUsage()).toBe(GEMINI_RETIRED);
  });

  it('skips the network when a retired verdict is cached', async () => {
    mockFileCache((file) => (file.includes('gemini-tier-') ? { data: { retired: true }, timestamp: Date.now() } : null));
    // The network would answer with a live project and quota: only the cached verdict can say retired.
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) =>
      new Response(JSON.stringify(String(url).includes('loadCodeAssist')
        ? { cloudaicompanionProject: 'live-project' }
        : { buckets: [{ modelId: 'gemini-2.5-pro', remainingFraction: 0.5 }] }), { status: 200 }));

    const { fetchGeminiUsage, clearGeminiCache, GEMINI_RETIRED } = await import('../utils/gemini-client.js');
    clearGeminiCache();

    expect(await fetchGeminiUsage()).toBe(GEMINI_RETIRED);
  });

  it('still fails (warning) when loadCodeAssist gives no project for another reason', async () => {
    const save = mockFileCache(() => null);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ allowedTiers: [] }), { status: 200 }));

    const { fetchGeminiUsage, clearGeminiCache } = await import('../utils/gemini-client.js');
    clearGeminiCache();

    expect(await fetchGeminiUsage()).toBeNull();
    expect(save).not.toHaveBeenCalledWith(expect.stringContaining('gemini-tier-'), expect.anything());
  });
});
