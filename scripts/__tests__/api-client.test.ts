/**
 * @handbook 8.1-test-structure
 * @covers scripts/utils/api-client.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm, readdir, utimes, unlink } from 'fs/promises';
import path from 'path';
import os from 'os';
import { hashToken } from '../utils/hash.js';

const ACTUAL_CACHE_DIR = path.join(os.homedir(), '.cache', 'claude-dashboard');

/**
 * Helper to delete file cache for a specific token
 */
async function deleteFileCacheForToken(token: string): Promise<void> {
  try {
    const tokenHash = hashToken(token);
    await unlink(path.join(ACTUAL_CACHE_DIR, `cache-${tokenHash}.json`));
  } catch {
    // File may not exist
  }
}

// Mock credentials module
vi.mock('../utils/credentials.js', () => ({
  getCredentials: vi.fn(),
}));

// Mock version module
vi.mock('../version.js', () => ({
  VERSION: '1.0.0-test',
}));

describe('api-client', () => {
  const TEST_CACHE_DIR = path.join(os.tmpdir(), 'claude-dashboard-test-cache');

  beforeEach(async () => {
    vi.resetModules();
    // Clean up test cache directory
    try {
      await rm(TEST_CACHE_DIR, { recursive: true, force: true });
    } catch {
      // Directory may not exist
    }
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    // Clean up test cache directory
    try {
      await rm(TEST_CACHE_DIR, { recursive: true, force: true });
    } catch {
      // Directory may not exist
    }
  });

  describe('clearCache', () => {
    it('should clear in-memory cache', async () => {
      const { clearCache } = await import('../utils/api-client.js');

      // clearCache should not throw
      expect(() => clearCache()).not.toThrow();
    });
  });

  describe('fetchUsageLimits', () => {
    it('should return null when credentials are unavailable', async () => {
      const { getCredentials } = await import('../utils/credentials.js');
      vi.mocked(getCredentials).mockResolvedValue(null);

      const { fetchUsageLimits, clearCache } = await import('../utils/api-client.js');
      clearCache();

      const result = await fetchUsageLimits();

      expect(result).toBeNull();
    });

    it('should use cached data when available', async () => {
      const testToken = 'cache-test-token';

      const { getCredentials } = await import('../utils/credentials.js');
      vi.mocked(getCredentials).mockResolvedValue(testToken);

      // Delete any existing file cache for this token
      await deleteFileCacheForToken(testToken);

      // Mock fetch
      const mockLimits = {
        five_hour: { utilization: 0.1, resets_at: '2024-01-01T00:00:00Z' },
        seven_day: null,
        seven_day_sonnet: null,
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockLimits),
      });
      global.fetch = fetchMock;

      const { fetchUsageLimits, clearCache } = await import('../utils/api-client.js');
      clearCache();

      // First call - should fetch from API
      const result1 = await fetchUsageLimits();
      expect(result1).not.toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await fetchUsageLimits();
      expect(result2).not.toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it('should handle API errors gracefully', async () => {
      const { getCredentials } = await import('../utils/credentials.js');
      // Use a different token to avoid cache hit from previous tests
      vi.mocked(getCredentials).mockResolvedValue('error-test-token');

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const { fetchUsageLimits, clearCache } = await import('../utils/api-client.js');
      clearCache();

      const result = await fetchUsageLimits();

      expect(result).toBeNull();
    });

    it('should handle network errors gracefully', async () => {
      const { getCredentials } = await import('../utils/credentials.js');
      // Use a different token to avoid cache hit from previous tests
      vi.mocked(getCredentials).mockResolvedValue('network-error-test-token');

      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const { fetchUsageLimits, clearCache } = await import('../utils/api-client.js');
      clearCache();

      const result = await fetchUsageLimits();

      expect(result).toBeNull();
    });
  });

  describe('429 retry', () => {
    it('should retry once when retry-after is within limit', async () => {
      const { getCredentials } = await import('../utils/credentials.js');
      vi.mocked(getCredentials).mockResolvedValue('retry-test-token');
      await deleteFileCacheForToken('retry-test-token');

      const mockLimits = {
        five_hour: { utilization: 0.1, resets_at: '2024-01-01T00:00:00Z' },
        seven_day: null,
        seven_day_sonnet: null,
      };

      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Map([['retry-after', '0']]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockLimits),
        });
      global.fetch = fetchMock;

      const { fetchUsageLimits, clearCache } = await import('../utils/api-client.js');
      clearCache();

      const result = await fetchUsageLimits();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result).not.toBeNull();
      expect(result?.five_hour).not.toBeNull();
    });

    it('should not retry when retry-after exceeds limit', async () => {
      const { getCredentials } = await import('../utils/credentials.js');
      vi.mocked(getCredentials).mockResolvedValue('retry-skip-token');
      await deleteFileCacheForToken('retry-skip-token');

      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Map([['retry-after', '11']]),
      });
      global.fetch = fetchMock;

      const { fetchUsageLimits, clearCache } = await import('../utils/api-client.js');
      clearCache();

      const result = await fetchUsageLimits();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });

    it('should not retry when retry-after header is missing', async () => {
      const { getCredentials } = await import('../utils/credentials.js');
      vi.mocked(getCredentials).mockResolvedValue('retry-noheader-token');
      await deleteFileCacheForToken('retry-noheader-token');

      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Map(),
      });
      global.fetch = fetchMock;

      const { fetchUsageLimits, clearCache } = await import('../utils/api-client.js');
      clearCache();

      const result = await fetchUsageLimits();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });
  });

  describe('stale cache fallback', () => {
    it('should return stale file cache when API fails', async () => {
      const testToken = 'stale-fallback-token';
      const tokenHash = hashToken(testToken);

      const { getCredentials } = await import('../utils/credentials.js');
      vi.mocked(getCredentials).mockResolvedValue(testToken);

      // Write a stale file cache matching UsageLimits type format
      const staleLimits = {
        five_hour: { utilization: 0.3, resets_at: '2024-01-01T00:00:00Z' },
        seven_day: null,
        seven_day_sonnet: null,
      };
      await mkdir(ACTUAL_CACHE_DIR, { recursive: true, mode: 0o700 });
      await writeFile(
        path.join(ACTUAL_CACHE_DIR, `cache-${tokenHash}.json`),
        JSON.stringify({
          data: staleLimits,
          timestamp: Date.now() - 600_000, // 10 minutes ago (stale for 300s TTL, valid for 3600s stale TTL)
        }),
        { mode: 0o600 }
      );

      // API returns 500
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const { fetchUsageLimits, clearCache } = await import('../utils/api-client.js');
      clearCache();

      const result = await fetchUsageLimits();

      expect(result).not.toBeNull();
      expect(result?.five_hour?.utilization).toBe(0.3);

      // Cleanup
      await deleteFileCacheForToken(testToken);
    });

    it('should return null when API fails and no stale cache exists', async () => {
      const { getCredentials } = await import('../utils/credentials.js');
      vi.mocked(getCredentials).mockResolvedValue('no-cache-fallback-token');
      await deleteFileCacheForToken('no-cache-fallback-token');

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const { fetchUsageLimits, clearCache } = await import('../utils/api-client.js');
      clearCache();

      const result = await fetchUsageLimits();

      expect(result).toBeNull();
    });
  });

  describe('negative caching', () => {
    it('should suppress API calls within negative cache TTL', async () => {
      const testToken = 'negative-cache-test-token';
      const { getCredentials } = await import('../utils/credentials.js');
      vi.mocked(getCredentials).mockResolvedValue(testToken);
      await deleteFileCacheForToken(testToken);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });
      global.fetch = fetchMock;

      const { fetchUsageLimits, clearCache } = await import('../utils/api-client.js');
      clearCache();

      // First call - hits API, fails, sets negative cache
      const result1 = await fetchUsageLimits();
      expect(result1).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Second call within 30s - should NOT hit API (negative cache hit)
      const result2 = await fetchUsageLimits();
      expect(result2).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should retry API after negative cache expires', async () => {
      const testToken = 'negative-expire-test-token';
      const { getCredentials } = await import('../utils/credentials.js');
      vi.mocked(getCredentials).mockResolvedValue(testToken);
      await deleteFileCacheForToken(testToken);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });
      global.fetch = fetchMock;

      const { fetchUsageLimits } = await import('../utils/api-client.js');

      // Use fake timers so Date.now() advances with vi.advanceTimersByTime
      vi.useFakeTimers();

      try {
        // First call - fails, sets negative cache
        await fetchUsageLimits();
        expect(fetchMock).toHaveBeenCalledTimes(1);

        // Advance time past NEGATIVE_CACHE_SECONDS (30s)
        vi.advanceTimersByTime(31_000);

        // Negative cache should be expired — API should be called again
        await fetchUsageLimits();
        expect(fetchMock).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it('should return stale file cache on negative cache hit when available', async () => {
      const testToken = 'negative-stale-fallback-token';
      const tokenHash = hashToken(testToken);

      const { getCredentials } = await import('../utils/credentials.js');
      vi.mocked(getCredentials).mockResolvedValue(testToken);

      // Write a stale file cache (valid for STALE_FALLBACK_SECONDS=3600)
      const staleLimits = {
        five_hour: { utilization: 0.42, resets_at: '2024-06-01T00:00:00Z' },
        seven_day: null,
        seven_day_sonnet: null,
      };
      await mkdir(ACTUAL_CACHE_DIR, { recursive: true, mode: 0o700 });
      await writeFile(
        path.join(ACTUAL_CACHE_DIR, `cache-${tokenHash}.json`),
        JSON.stringify({
          data: staleLimits,
          timestamp: Date.now() - 600_000, // 10 min ago (stale for TTL, valid for stale fallback)
        }),
        { mode: 0o600 }
      );

      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });
      global.fetch = fetchMock;

      const { fetchUsageLimits, clearCache } = await import('../utils/api-client.js');
      clearCache();

      // First call - API fails, should return stale file cache data
      const result1 = await fetchUsageLimits();
      expect(result1).not.toBeNull();
      expect(result1?.five_hour?.utilization).toBe(0.42);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Second call - negative cache hit, should return stale file cache again
      const result2 = await fetchUsageLimits();
      expect(result2).not.toBeNull();
      expect(result2?.five_hour?.utilization).toBe(0.42);
      expect(fetchMock).toHaveBeenCalledTimes(1); // Still 1

      // Cleanup
      await deleteFileCacheForToken(testToken);
    });
  });

  describe('file cache integration', () => {
    const TEST_TOKEN = 'integration-test-token-' + Date.now();

    it('should persist cache to disk and load on subsequent calls', async () => {
      const { getCredentials } = await import('../utils/credentials.js');
      vi.mocked(getCredentials).mockResolvedValue(TEST_TOKEN);

      const mockLimits = {
        five_hour: { utilization: 0.1, resets_at: '2024-01-01T00:00:00Z' },
        seven_day: null,
        seven_day_sonnet: null,
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockLimits),
      });
      global.fetch = fetchMock;

      const { fetchUsageLimits, clearCache } = await import('../utils/api-client.js');
      clearCache();

      // First call - fetches from API and writes to disk
      const result1 = await fetchUsageLimits();
      expect(result1).not.toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Verify file was created
      const files = await readdir(ACTUAL_CACHE_DIR);
      const cacheFiles = files.filter((f) => f.startsWith('cache-') && f.endsWith('.json'));
      expect(cacheFiles.length).toBeGreaterThan(0);

      // Clear in-memory cache to force file cache read
      clearCache();

      // Second call - should load from file cache, not API
      const result2 = await fetchUsageLimits();
      expect(result2).toEqual(result1);
      expect(fetchMock).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should cleanup expired cache files', async () => {
      // Create an old cache file manually
      await mkdir(ACTUAL_CACHE_DIR, { recursive: true, mode: 0o700 });
      const oldCacheFile = path.join(ACTUAL_CACHE_DIR, 'cache-cleanup-test-old.json');
      await writeFile(
        oldCacheFile,
        JSON.stringify({ data: { five_hour: null, seven_day: null, seven_day_sonnet: null }, timestamp: Date.now() })
      );

      // Set file mtime to 2 hours ago (older than CACHE_CLEANUP_AGE_SECONDS = 3600)
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      await utimes(oldCacheFile, twoHoursAgo, twoHoursAgo);

      // Verify old file exists
      const filesBefore = await readdir(ACTUAL_CACHE_DIR);
      expect(filesBefore).toContain('cache-cleanup-test-old.json');

      // Trigger cleanup (time-based: first call always runs cleanup)
      const { getCredentials } = await import('../utils/credentials.js');
      vi.mocked(getCredentials).mockResolvedValue('cleanup-trigger-token-' + Date.now());

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ five_hour: null, seven_day: null, seven_day_sonnet: null }),
      });

      const { fetchUsageLimits, clearCache } = await import('../utils/api-client.js');
      clearCache();

      // Single call triggers cleanup (first call after module load)
      await fetchUsageLimits();

      // Give async cleanup time to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check if old file was cleaned up
      const filesAfter = await readdir(ACTUAL_CACHE_DIR);
      expect(filesAfter).not.toContain('cache-cleanup-test-old.json');
    });
  });
});
