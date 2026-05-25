/**
 * @handbook 8.1-test-structure
 * @covers scripts/utils/file-lock.ts
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync, utimesSync } from 'fs';
import os from 'os';
import path from 'path';
import {
  acquireFileLock,
  releaseFileLock,
  waitForLock,
  LOCK_STALE_SECONDS,
} from '../utils/file-lock.js';

describe('file-lock', () => {
  let tmpDir: string;
  let lockPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'file-lock-test-'));
    lockPath = path.join(tmpDir, 'test.lock');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('acquireFileLock', () => {
    it('creates the lock file when none exists', async () => {
      const acquired = await acquireFileLock(lockPath);
      expect(acquired).toBe(true);
      expect(existsSync(lockPath)).toBe(true);
    });

    it('returns false when lock is already held by another process', async () => {
      const first = await acquireFileLock(lockPath);
      const second = await acquireFileLock(lockPath);
      expect(first).toBe(true);
      expect(second).toBe(false);
    });

    it('reclaims a stale lock older than staleSeconds', async () => {
      writeFileSync(lockPath, '99999');
      const past = (Date.now() - (LOCK_STALE_SECONDS + 5) * 1000) / 1000;
      utimesSync(lockPath, past, past);

      const acquired = await acquireFileLock(lockPath);
      expect(acquired).toBe(true);
    });

    it('does not reclaim a fresh lock', async () => {
      writeFileSync(lockPath, '99999');
      const acquired = await acquireFileLock(lockPath);
      expect(acquired).toBe(false);
    });

    it('returns false when lockPath points to an unwritable directory', async () => {
      const acquired = await acquireFileLock('/this/path/should/not/exist/test.lock');
      expect(acquired).toBe(false);
    });
  });

  describe('releaseFileLock', () => {
    it('removes the lock file', async () => {
      await acquireFileLock(lockPath);
      expect(existsSync(lockPath)).toBe(true);
      await releaseFileLock(lockPath);
      expect(existsSync(lockPath)).toBe(false);
    });

    it('is safe when lock is already gone', async () => {
      await expect(releaseFileLock(lockPath)).resolves.toBeUndefined();
    });
  });

  describe('waitForLock', () => {
    it('returns immediately if lock does not exist', async () => {
      const start = Date.now();
      await waitForLock(lockPath, 1000, 50);
      expect(Date.now() - start).toBeLessThan(200);
    });

    it('returns when lock is released during wait', async () => {
      await acquireFileLock(lockPath);
      const wait = waitForLock(lockPath, 1000, 30);
      setTimeout(() => releaseFileLock(lockPath), 100);
      const start = Date.now();
      await wait;
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(80);
      expect(elapsed).toBeLessThan(800);
    });

    it('returns after timeout if lock persists', async () => {
      await acquireFileLock(lockPath);
      const start = Date.now();
      await waitForLock(lockPath, 200, 50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(180);
      expect(elapsed).toBeLessThan(400);
    });
  });
});
