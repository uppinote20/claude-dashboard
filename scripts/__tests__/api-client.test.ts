/**
 * @handbook 8.1-test-structure
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, readFile, rm, readdir, stat, utimes, unlink } from 'fs/promises';
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
        five_hour: { used: 100, limit: 1000, remaining: 900, reset_at: '2024-01-01T00:00:00Z' },
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
        five_hour: { used: 10, limit: 100, remaining: 90, reset_at: '2024-01-01T00:00:00Z' },
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
        headers: new Map([['retry-after', '10']]),
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

      // Write a stale file cache (API failure falls back to any existing file cache)
      const staleLimits = {
        five_hour: { used: 30, limit: 100, remaining: 70, reset_at: '2024-01-01T00:00:00Z' },
        seven_day: null,
        seven_day_sonnet: null,
      };
      await mkdir(ACTUAL_CACHE_DIR, { recursive: true, mode: 0o700 });
      await writeFile(
        path.join(ACTUAL_CACHE_DIR, `cache-${tokenHash}.json`),
        JSON.stringify({
          data: staleLimits,
          timestamp: Date.now() - 600_000, // 10 minutes ago (stale for 300s TTL, valid for 3000s stale TTL)
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
      expect(result?.five_hour?.used).toBe(30);

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

  describe('file cache integration', () => {
    const TEST_TOKEN = 'integration-test-token-' + Date.now();

    it('should persist cache to disk and load on subsequent calls', async () => {
      const { getCredentials } = await import('../utils/credentials.js');
      vi.mocked(getCredentials).mockResolvedValue(TEST_TOKEN);

      const mockLimits = {
        five_hour: { used: 50, limit: 500, remaining: 450, reset_at: '2024-01-01T00:00:00Z' },
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
