/**
 * @handbook 8.1-test-structure
 * @covers scripts/statusline-shim.mjs
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
// @ts-expect-error - dependency-free .mjs shim, no type declarations by design
import { deriveCacheRoot, resolveLatestDist } from '../statusline-shim.mjs';

/** Create <cacheRoot>/<version>/dist/index.js */
function makeVersion(cacheRoot: string, version: string, withDist = true): void {
  const dir = withDist ? path.join(cacheRoot, version, 'dist') : path.join(cacheRoot, version);
  mkdirSync(dir, { recursive: true });
  if (withDist) writeFileSync(path.join(dir, 'index.js'), 'export {};');
}

describe('statusline-shim', () => {
  let tmpDir: string;
  let cacheRoot: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'shim-test-'));
    cacheRoot = path.join(tmpDir, 'plugins', 'cache', 'claude-dashboard', 'claude-dashboard');
    mkdirSync(cacheRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('resolveLatestDist', () => {
    it('picks the newest version by numeric semver, not string order', () => {
      makeVersion(cacheRoot, '1.9.0');
      makeVersion(cacheRoot, '1.31.1');
      makeVersion(cacheRoot, '1.29.0');

      expect(resolveLatestDist(cacheRoot)).toBe(
        path.join(cacheRoot, '1.31.1', 'dist', 'index.js')
      );
    });

    it('ignores directories without dist/index.js', () => {
      makeVersion(cacheRoot, '1.31.1');
      makeVersion(cacheRoot, '1.32.0', false);

      expect(resolveLatestDist(cacheRoot)).toBe(
        path.join(cacheRoot, '1.31.1', 'dist', 'index.js')
      );
    });

    it('ignores non-semver directory names', () => {
      makeVersion(cacheRoot, '1.31.1');
      makeVersion(cacheRoot, 'unknown');
      makeVersion(cacheRoot, '2.0');

      expect(resolveLatestDist(cacheRoot)).toBe(
        path.join(cacheRoot, '1.31.1', 'dist', 'index.js')
      );
    });

    it('returns null when no version has a build', () => {
      expect(resolveLatestDist(cacheRoot)).toBeNull();
    });

    it('returns null when the cache directory does not exist', () => {
      expect(resolveLatestDist(path.join(tmpDir, 'nope'))).toBeNull();
    });
  });

  describe('deriveCacheRoot', () => {
    it('derives the cache root from the shim location, not from env', () => {
      const shim = path.join(
        tmpDir, 'plugins', 'data', 'claude-dashboard-claude-dashboard', 'statusline.mjs'
      );

      expect(deriveCacheRoot(pathToFileURL(shim).href)).toBe(cacheRoot);
    });
  });
});
