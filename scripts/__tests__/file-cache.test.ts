/**
 * @handbook 8.1-test-structure
 * @covers scripts/utils/file-cache.ts
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, statSync, writeFileSync, existsSync, utimesSync } from 'fs';
import { writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  loadFileCache,
  saveFileCache,
  fileCachePath,
  FILE_CACHE_DIR,
  cleanupExpiredCache,
  resetCleanupThrottle,
} from '../utils/file-cache.js';

describe('file-cache', () => {
  let tmpDir: string;
  let cachePath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'file-cache-test-'));
    cachePath = path.join(tmpDir, 'test-cache.json');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('fileCachePath', () => {
    it('resolves names against FILE_CACHE_DIR', () => {
      expect(fileCachePath('foo.json')).toBe(path.join(FILE_CACHE_DIR, 'foo.json'));
    });
  });

  describe('loadFileCache', () => {
    it('returns null when file does not exist', async () => {
      const result = await loadFileCache(cachePath, 60);
      expect(result).toBeNull();
    });

    it('returns null for malformed JSON', async () => {
      await writeFile(cachePath, 'not json {');
      const result = await loadFileCache(cachePath, 60);
      expect(result).toBeNull();
    });

    it('returns null when timestamp is missing', async () => {
      await writeFile(cachePath, JSON.stringify({ data: 'x' }));
      const result = await loadFileCache(cachePath, 60);
      expect(result).toBeNull();
    });

    it('returns data when within TTL', async () => {
      await saveFileCache(cachePath, { hello: 'world' });
      const result = await loadFileCache<{ hello: string }>(cachePath, 60);
      expect(result?.data).toEqual({ hello: 'world' });
      expect(typeof result?.timestamp).toBe('number');
    });

    it('returns null when entry is older than TTL', async () => {
      const past = Date.now() - 120 * 1000;
      await writeFile(cachePath, JSON.stringify({ data: 'x', timestamp: past }));
      const result = await loadFileCache(cachePath, 60);
      expect(result).toBeNull();
    });
  });

  describe('saveFileCache', () => {
    it('creates parent directory if missing', async () => {
      const nested = path.join(tmpDir, 'a', 'b', 'c', 'cache.json');
      await saveFileCache(nested, { x: 1 });
      const result = await loadFileCache<{ x: number }>(nested, 60);
      expect(result?.data).toEqual({ x: 1 });
    });

    it('writes with 0o600 permissions by default', async () => {
      await saveFileCache(cachePath, { x: 1 });
      const mode = statSync(cachePath).mode & 0o777;
      expect(mode).toBe(0o600);
    });

    it('last write wins on the same key', async () => {
      await saveFileCache(cachePath, { v: 1 });
      await saveFileCache(cachePath, { v: 2 });
      const result = await loadFileCache<{ v: number }>(cachePath, 60);
      expect(result?.data).toEqual({ v: 2 });
    });

    it('silently swallows errors on unwritable paths', async () => {
      await expect(
        saveFileCache('/this/dir/cannot/exist/test.json', { x: 1 })
      ).resolves.toBeUndefined();
    });
  });

  describe('cleanupExpiredCache', () => {
    const twoHoursAgoSec = (Date.now() - 7200 * 1000) / 1000;

    beforeEach(() => {
      resetCleanupThrottle();
    });

    it('removes expired files for every cleanable prefix', async () => {
      const targets = [
        'cache-old.json',
        'codex-usage-old.json',
        'gemini-usage-old.json',
        'antigravity-usage-old.json',
        'antigravity-token-old.json',
        'antigravity-wincred-miss.json',
        'zai-usage-old.json',
      ];
      for (const name of targets) {
        const p = path.join(tmpDir, name);
        writeFileSync(p, '{}');
        utimesSync(p, twoHoursAgoSec, twoHoursAgoSec);
      }

      await cleanupExpiredCache(tmpDir);

      for (const name of targets) {
        expect(existsSync(path.join(tmpDir, name))).toBe(false);
      }
    });

    it('preserves non-matching files (e.g., codex-model-cache.json)', async () => {
      const protectedFile = path.join(tmpDir, 'codex-model-cache.json');
      writeFileSync(protectedFile, '{}');
      utimesSync(protectedFile, twoHoursAgoSec, twoHoursAgoSec);

      await cleanupExpiredCache(tmpDir);

      expect(existsSync(protectedFile)).toBe(true);
    });

    it('preserves fresh files even when prefix matches', async () => {
      const freshFile = path.join(tmpDir, 'cache-fresh.json');
      writeFileSync(freshFile, '{}');

      await cleanupExpiredCache(tmpDir);

      expect(existsSync(freshFile)).toBe(true);
    });

    it('throttles repeat calls within the cleanup interval', async () => {
      const f1 = path.join(tmpDir, 'cache-throttle.json');
      writeFileSync(f1, '{}');
      utimesSync(f1, twoHoursAgoSec, twoHoursAgoSec);

      await cleanupExpiredCache(tmpDir);
      expect(existsSync(f1)).toBe(false);

      // Recreate the same expired file; throttle should prevent re-sweep.
      writeFileSync(f1, '{}');
      utimesSync(f1, twoHoursAgoSec, twoHoursAgoSec);

      await cleanupExpiredCache(tmpDir);
      expect(existsSync(f1)).toBe(true);
    });
  });
});
