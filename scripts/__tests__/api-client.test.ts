import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, readFile, rm } from 'fs/promises';
import path from 'path';
import os from 'os';

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
      const { getCredentials } = await import('../utils/credentials.js');
      // Use unique token for this test
      vi.mocked(getCredentials).mockResolvedValue('cache-test-token');

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
});
