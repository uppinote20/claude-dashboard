/**
 * @handbook 8.1-test-structure
 * @covers scripts/utils/antigravity-client.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const FUTURE_EXPIRY = new Date(Date.now() + 3_600_000).toISOString();
const NANO_FUTURE_EXPIRY = '2099-01-01T00:00:00.185088052+09:00';
const NANO_PAST_EXPIRY = '2020-01-01T00:00:00.185088052+09:00';

const MODELS_RESPONSE = {
  models: {
    'gemini-3-6-flash': {
      displayName: 'Gemini 3.6 Flash',
      quotaInfo: { remainingFraction: 0.73, resetTime: '2026-08-11T00:00:00Z' },
    },
    'gemini-3-pro': {
      displayName: 'Gemini 3 Pro',
      quotaInfo: { remainingFraction: 0.85, resetTime: '2026-08-11T00:00:00Z' },
    },
    'claude-opus': {
      displayName: 'Claude Opus',
      quotaInfo: { remainingFraction: 0.61, resetTime: '2026-08-10T21:00:00Z' },
    },
    'gpt-oss': {
      displayName: 'GPT-OSS',
      quotaInfo: { remainingFraction: 0.61, resetTime: '2026-08-10T21:00:00Z' },
    },
    // Exclusion is delimiter-anchored, so a user-facing id merely starting
    // with "rev" must survive
    'revision-gemini-pro': {
      displayName: 'Revision Gemini Pro',
      quotaInfo: { remainingFraction: 0.9, resetTime: '2026-08-11T00:00:00Z' },
    },
    // All of the following must be filtered out of quota display
    'chat_internal': { displayName: 'Chat', quotaInfo: { remainingFraction: 0.5 } },
    'tab_autocomplete': { quotaInfo: { remainingFraction: 0.5 } },
    'rev_internal': { quotaInfo: { remainingFraction: 0.5 } },
    'gemini-image-gen': { displayName: 'Image', quotaInfo: { remainingFraction: 0.5 } },
    'some-lite-model': { quotaInfo: { remainingFraction: 0.5 } },
    'no-quota-model': { displayName: 'NoQuota' },
  },
};

function tokenJson(expiry: string): string {
  return JSON.stringify({
    token: {
      access_token: 'ag-access',
      token_type: 'Bearer',
      refresh_token: 'ag-refresh',
      expiry,
    },
    auth_method: 'consumer',
  });
}

/**
 * Mock fs/promises: token file + agy settings.json resolve, everything else ENOENT.
 * Returns the writeFile spy so tests can assert agy's token file is never written.
 */
function mockFs(expiry: string) {
  const writeFileSpy = vi.fn();
  vi.doMock('fs/promises', async (importOriginal) => {
    const actual = await importOriginal<typeof import('fs/promises')>();
    return {
      ...actual,
      stat: vi.fn().mockResolvedValue({ mtimeMs: 12345 }),
      writeFile: writeFileSpy,
      readFile: vi.fn().mockImplementation((p: unknown) => {
        if (typeof p === 'string' && p.includes('antigravity-oauth-token')) {
          return Promise.resolve(tokenJson(expiry));
        }
        if (typeof p === 'string' && p.includes('antigravity-cli') && p.endsWith('settings.json')) {
          return Promise.resolve(JSON.stringify({ model: 'Gemini 3.6 Flash (Low)' }));
        }
        return Promise.reject(new Error('ENOENT'));
      }),
    };
  });
  return writeFileSpy;
}

function mockFileCache(overrides: Record<string, unknown> = {}) {
  const saveFileCache = vi.fn().mockResolvedValue(undefined);
  vi.doMock('../utils/file-cache.js', () => ({
    loadFileCache: vi.fn().mockResolvedValue(null),
    saveFileCache,
    fileCachePath: (name: string) => `/tmp/${name}`,
    STALE_CACHE_TTL_SECONDS: 3600,
    ...overrides,
  }));
  return saveFileCache;
}

/**
 * loadFileCache override serving only the refreshed-token cache file
 */
function tokenCacheOnly(data: unknown) {
  return {
    loadFileCache: vi.fn().mockImplementation((cacheFile: string) =>
      Promise.resolve(
        cacheFile.includes('antigravity-token-') ? { data, timestamp: Date.now() } : null
      )
    ),
  };
}

/**
 * Route fetch by URL: OAuth token endpoint + Code Assist RPCs.
 */
function mockCloudFetch(
  options: { refreshStatus?: number; modelsStatus?: number; models?: Record<string, unknown> } = {}
) {
  const fetchMock = vi.fn().mockImplementation((url: unknown) => {
    const u = String(url);
    if (u.includes('oauth2.googleapis.com')) {
      if (options.refreshStatus && options.refreshStatus >= 400) {
        return Promise.resolve(new Response('{"error":"invalid_grant"}', { status: options.refreshStatus }));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ access_token: 'refreshed-token', expires_in: 3600 }), { status: 200 })
      );
    }
    if (u.includes(':loadCodeAssist')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({ cloudaicompanionProject: 'proj-1', planInfo: { planType: 'free' } }),
          { status: 200 }
        )
      );
    }
    if (u.includes(':fetchAvailableModels')) {
      if (options.modelsStatus && options.modelsStatus >= 400) {
        return Promise.resolve(new Response('{}', { status: options.modelsStatus }));
      }
      const payload = options.models ? { models: options.models } : MODELS_RESPONSE;
      return Promise.resolve(new Response(JSON.stringify(payload), { status: 200 }));
    }
    return Promise.reject(new Error(`unexpected url: ${u}`));
  });
  vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock as typeof fetch);
  return fetchMock;
}

async function importClient() {
  const client = await import('../utils/antigravity-client.js');
  client.clearAntigravityCache();
  return client;
}

describe('antigravity-client', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock('fs/promises');
    vi.doUnmock('../utils/file-cache.js');
  });

  describe('isAntigravityInstalled', () => {
    it('should return false when the token file is missing', async () => {
      vi.doMock('fs/promises', async (importOriginal) => {
        const actual = await importOriginal<typeof import('fs/promises')>();
        return { ...actual, stat: vi.fn().mockRejectedValue(new Error('ENOENT')) };
      });

      const { isAntigravityInstalled } = await importClient();
      expect(await isAntigravityInstalled()).toBe(false);
    });

    it('should return true when the token file exists', async () => {
      mockFs(FUTURE_EXPIRY);

      const { isAntigravityInstalled } = await importClient();
      expect(await isAntigravityInstalled()).toBe(true);
    });
  });

  describe('fetchAntigravityUsage', () => {
    it('should parse models into family groups and buckets', async () => {
      mockFs(FUTURE_EXPIRY);
      const saveSpy = mockFileCache();
      mockCloudFetch();

      const { fetchAntigravityUsage } = await importClient();
      const result = await fetchAntigravityUsage();

      expect(result).not.toBeNull();
      expect(result?.model).toBe('Gemini 3.6 Flash (Low)');
      expect(result?.planType).toBe('free');

      // Caches are keyed by the stable refresh token, not the rotating access token
      const usageSave = saveSpy.mock.calls.find(([f]) => String(f).includes('antigravity-usage-'));
      const projectSave = saveSpy.mock.calls.find(([f]) => String(f).includes('antigravity-project-'));
      const keyOf = (f: string) => f.replace(/^.*antigravity-(usage|project)-/, '').replace('.json', '');
      expect(keyOf(String(projectSave?.[0]))).toBe(keyOf(String(usageSave?.[0])));

      // 5 quota models survive (chat_/tab_/rev_/image/lite/no-quota excluded)
      const ids = result?.buckets.map((b) => b.modelId) ?? [];
      expect(result?.buckets).toHaveLength(5);
      expect(ids).not.toContain('chat_internal');
      expect(ids).not.toContain('gemini-image-gen');
      expect(ids).not.toContain('rev_internal');
      expect(ids).toContain('revision-gemini-pro');

      // Two family groups, each taking the worst member usage
      expect(result?.groups).toHaveLength(2);
      const gemini = result?.groups.find((g) => g.label === 'Gemini');
      const claudeGpt = result?.groups.find((g) => g.label === 'Claude+GPT');
      expect(gemini?.usedPercent).toBe(27); // worst of 27 / 15
      expect(gemini?.resetAt).toBe('2026-08-11T00:00:00Z');
      expect(claudeGpt?.usedPercent).toBe(39);

      expect(saveSpy).toHaveBeenCalledWith(
        expect.stringContaining('antigravity-usage-'),
        expect.any(Object)
      );
    });

    it('should accept nanosecond-precision RFC3339 expiry without refreshing', async () => {
      mockFs(NANO_FUTURE_EXPIRY);
      mockFileCache();
      const fetchMock = mockCloudFetch();

      const { fetchAntigravityUsage } = await importClient();
      const result = await fetchAntigravityUsage();

      expect(result).not.toBeNull();
      const oauthCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes('oauth2.googleapis.com'));
      expect(oauthCalls).toHaveLength(0);
    });

    it('should treat remainingFraction > 1 as percent remaining', async () => {
      mockFs(FUTURE_EXPIRY);
      mockFileCache();
      mockCloudFetch({
        models: { 'claude-x': { displayName: 'Claude X', quotaInfo: { remainingFraction: 61 } } },
      });

      const { fetchAntigravityUsage } = await importClient();
      const result = await fetchAntigravityUsage();

      expect(result?.buckets[0]?.usedPercent).toBe(39); // 100 - 61
    });

    it('should persist a project-meta failure marker when loadCodeAssist fails', async () => {
      mockFs(FUTURE_EXPIRY);
      const saveSpy = mockFileCache();
      vi.spyOn(globalThis, 'fetch').mockImplementation(((url: unknown) =>
        String(url).includes(':loadCodeAssist')
          ? Promise.resolve(new Response('{}', { status: 500 }))
          : Promise.resolve(new Response(JSON.stringify(MODELS_RESPONSE), { status: 200 }))) as typeof fetch);

      const { fetchAntigravityUsage } = await importClient();
      const result = await fetchAntigravityUsage();

      // Project id is optional for fetchAvailableModels, so quota still resolves
      expect(result).not.toBeNull();
      expect(saveSpy).toHaveBeenCalledWith(
        expect.stringContaining('antigravity-project-'),
        expect.objectContaining({ projectId: null, failedAt: expect.any(Number) })
      );
    });

    it('should honor a fresh project-meta failure marker without retrying', async () => {
      mockFs(FUTURE_EXPIRY);
      mockFileCache({
        loadFileCache: vi.fn().mockImplementation((cacheFile: string) =>
          Promise.resolve(
            cacheFile.includes('antigravity-project-')
              ? { data: { projectId: null, failedAt: Date.now() - 1_000 }, timestamp: Date.now() - 1_000 }
              : null
          )
        ),
      });
      const fetchMock = mockCloudFetch();

      const { fetchAntigravityUsage } = await importClient();
      const result = await fetchAntigravityUsage();

      expect(result).not.toBeNull();
      const loadCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes(':loadCodeAssist'));
      expect(loadCalls).toHaveLength(0);
      const modelsCall = fetchMock.mock.calls.find(([u]) => String(u).includes(':fetchAvailableModels'));
      expect((modelsCall?.[1] as RequestInit | undefined)?.body).toBe('{}');
    });

    it('should reuse cached project meta and skip loadCodeAssist', async () => {
      mockFs(FUTURE_EXPIRY);
      mockFileCache({
        loadFileCache: vi.fn().mockImplementation((cacheFile: string) =>
          Promise.resolve(
            cacheFile.includes('antigravity-project-')
              ? { data: { projectId: 'cached-proj', planType: 'pro' }, timestamp: Date.now() }
              : null
          )
        ),
      });
      const fetchMock = mockCloudFetch();

      const { fetchAntigravityUsage } = await importClient();
      const result = await fetchAntigravityUsage();

      expect(result?.planType).toBe('pro');
      const loadCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes(':loadCodeAssist'));
      expect(loadCalls).toHaveLength(0);
      const modelsCall = fetchMock.mock.calls.find(([u]) => String(u).includes(':fetchAvailableModels'));
      expect((modelsCall?.[1] as RequestInit | undefined)?.body).toBe(JSON.stringify({ project: 'cached-proj' }));
    });

    it('should skip the API while a cross-process failure marker is fresh', async () => {
      mockFs(FUTURE_EXPIRY);
      mockFileCache({
        loadFileCache: vi.fn().mockImplementation((cacheFile: string) =>
          Promise.resolve(
            cacheFile.includes('antigravity-usage-err-')
              ? { data: { failedAt: Date.now() - 1_000 }, timestamp: Date.now() }
              : null
          )
        ),
      });
      const fetchMock = mockCloudFetch();

      const { fetchAntigravityUsage } = await importClient();
      const result = await fetchAntigravityUsage();

      expect(result).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should return null when the token file is missing', async () => {
      vi.doMock('fs/promises', async (importOriginal) => {
        const actual = await importOriginal<typeof import('fs/promises')>();
        return {
          ...actual,
          stat: vi.fn().mockRejectedValue(new Error('ENOENT')),
          readFile: vi.fn().mockRejectedValue(new Error('ENOENT')),
        };
      });
      mockFileCache();
      const fetchMock = mockCloudFetch();

      const { fetchAntigravityUsage } = await importClient();
      const result = await fetchAntigravityUsage();

      expect(result).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully and persist a failure marker', async () => {
      mockFs(FUTURE_EXPIRY);
      const saveSpy = mockFileCache();
      mockCloudFetch({ modelsStatus: 403 });

      const { fetchAntigravityUsage } = await importClient();
      const result = await fetchAntigravityUsage();

      expect(result).toBeNull();
      expect(saveSpy).toHaveBeenCalledWith(
        expect.stringContaining('antigravity-usage-err-'),
        expect.objectContaining({ failedAt: expect.any(Number) })
      );
    });

    it('should handle network errors gracefully', async () => {
      mockFs(FUTURE_EXPIRY);
      mockFileCache();
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

      const { fetchAntigravityUsage } = await importClient();
      const result = await fetchAntigravityUsage();

      expect(result).toBeNull();
    });

    it('should return file cache hit and skip network fetch', async () => {
      mockFs(FUTURE_EXPIRY);
      const sample = {
        model: 'Gemini 3.6 Flash (Low)',
        groups: [{ label: 'Gemini', usedPercent: 33, resetAt: null }],
        buckets: [],
      };
      mockFileCache({
        loadFileCache: vi.fn().mockResolvedValue({ data: sample, timestamp: Date.now() }),
      });
      const fetchMock = mockCloudFetch();

      const { fetchAntigravityUsage } = await importClient();
      const result = await fetchAntigravityUsage();

      expect(fetchMock).not.toHaveBeenCalled();
      expect(result).toEqual(sample);
    });
  });

  describe('token refresh', () => {
    it('should refresh an expired token and never write agy token file', async () => {
      const writeSpy = mockFs(NANO_PAST_EXPIRY);
      const saveSpy = mockFileCache();
      const fetchMock = mockCloudFetch();

      const { fetchAntigravityUsage } = await importClient();
      const result = await fetchAntigravityUsage();

      expect(result).not.toBeNull();

      const oauthCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes('oauth2.googleapis.com'));
      expect(oauthCalls).toHaveLength(1);

      // Subsequent API calls must use the refreshed access token
      const loadCall = fetchMock.mock.calls.find(([u]) => String(u).includes(':loadCodeAssist'));
      const headers = (loadCall?.[1] as RequestInit | undefined)?.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer refreshed-token');

      // Refreshed token persisted only to our own cache, agy's file untouched
      expect(saveSpy).toHaveBeenCalledWith(
        expect.stringContaining('antigravity-token-'),
        expect.objectContaining({ accessToken: 'refreshed-token' })
      );
      expect(writeSpy).not.toHaveBeenCalled();
    });

    it('should return null and persist a backoff marker when refresh fails', async () => {
      mockFs(NANO_PAST_EXPIRY);
      const saveSpy = mockFileCache();
      const fetchMock = mockCloudFetch({ refreshStatus: 400 });

      const { fetchAntigravityUsage } = await importClient();
      const result = await fetchAntigravityUsage();

      expect(result).toBeNull();
      const cloudCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes('cloudcode-pa'));
      expect(cloudCalls).toHaveLength(0);
      expect(saveSpy).toHaveBeenCalledWith(
        expect.stringContaining('antigravity-token-'),
        expect.objectContaining({ refreshFailedAt: expect.any(Number) })
      );
    });

    it('should back off refresh retries after a recent failure', async () => {
      mockFs(NANO_PAST_EXPIRY);
      mockFileCache(tokenCacheOnly({ refreshFailedAt: Date.now() - 1_000 }));
      const fetchMock = mockCloudFetch();

      const { fetchAntigravityUsage } = await importClient();
      const result = await fetchAntigravityUsage();

      expect(result).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should serve stale usage when the token expired and refresh fails', async () => {
      const stale = {
        model: 'Gemini 3.6 Flash (Low)',
        groups: [{ label: 'Gemini', usedPercent: 12, resetAt: null }],
        buckets: [],
      };
      mockFs(NANO_PAST_EXPIRY);
      mockFileCache({
        // Usage cache holds data older than the fresh TTL but within the stale window
        loadFileCache: vi.fn().mockImplementation((cacheFile: string, ttlSeconds: number) =>
          Promise.resolve(
            cacheFile.includes('antigravity-usage-') && !cacheFile.includes('-err-') && ttlSeconds > 60
              ? { data: stale, timestamp: Date.now() - 120_000 }
              : null
          )
        ),
      });
      mockCloudFetch({ refreshStatus: 400 });

      const { fetchAntigravityUsage } = await importClient();
      const result = await fetchAntigravityUsage();

      // Widget keeps showing the last known quota instead of a warning
      expect(result).toEqual(stale);
    });

    it('should reuse a previously refreshed token from the file cache', async () => {
      mockFs(NANO_PAST_EXPIRY);
      mockFileCache(
        tokenCacheOnly({ accessToken: 'cached-refresh-access', expiryDate: Date.now() + 3_600_000 })
      );
      const fetchMock = mockCloudFetch();

      const { fetchAntigravityUsage } = await importClient();
      const result = await fetchAntigravityUsage();

      expect(result).not.toBeNull();
      const oauthCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes('oauth2.googleapis.com'));
      expect(oauthCalls).toHaveLength(0);

      const loadCall = fetchMock.mock.calls.find(([u]) => String(u).includes(':loadCodeAssist'));
      const headers = (loadCall?.[1] as RequestInit | undefined)?.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer cached-refresh-access');
    });
  });

});
