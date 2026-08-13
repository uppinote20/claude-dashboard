/**
 * @handbook 8.1-test-structure
 * @covers scripts/statusline-shim.mjs
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, copyFileSync, symlinkSync } from 'fs';
import { execFileSync } from 'child_process';
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

  describe('CLI entry point', () => {
    let shimPath: string;

    beforeEach(() => {
      shimPath = path.join(
        tmpDir, 'plugins', 'data', 'claude-dashboard-claude-dashboard', 'statusline.mjs'
      );
      mkdirSync(path.dirname(shimPath), { recursive: true });
      copyFileSync('scripts/statusline-shim.mjs', shimPath);
    });

    it('exits 0 with no output when cache directory does not exist', () => {
      const result = execFileSync('node', [shimPath], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      expect(result).toBe('');
    });

    it('exits 0 silently when resolved dist/index.js throws on evaluation', () => {
      makeVersion(cacheRoot, '1.0.0');
      const distPath = path.join(cacheRoot, '1.0.0', 'dist', 'index.js');
      writeFileSync(distPath, "throw new Error('boom');");

      const result = execFileSync('node', [shimPath], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      expect(result).toBe('');
    });

    it('runs and outputs when resolved dist/index.js is valid', () => {
      makeVersion(cacheRoot, '1.0.0');
      const distPath = path.join(cacheRoot, '1.0.0', 'dist', 'index.js');
      writeFileSync(distPath, "console.log('valid');");

      const result = execFileSync('node', [shimPath], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      expect(result).toBe('valid\n');
    });

    it('runs and outputs when invoked through a symlinked config root (dotfiles layout)', () => {
      // Mirrors `ln -s ~/dotfiles/claude ~/.claude`: the shim's real files live under
      // <real>/plugins/..., and a symlink stands in for the config root that is actually
      // on the invoking path. Node's ESM loader resolves import.meta.url to the realpath,
      // while process.argv[1] keeps the literal (symlinked) path the shim was invoked with.
      const realRoot = path.join(tmpDir, 'dotfiles-claude');
      const realShimPath = path.join(
        realRoot, 'plugins', 'data', 'claude-dashboard-claude-dashboard', 'statusline.mjs'
      );
      mkdirSync(path.dirname(realShimPath), { recursive: true });
      copyFileSync('scripts/statusline-shim.mjs', realShimPath);

      const realCacheRoot = path.join(realRoot, 'plugins', 'cache', 'claude-dashboard', 'claude-dashboard');
      makeVersion(realCacheRoot, '1.0.0');
      writeFileSync(path.join(realCacheRoot, '1.0.0', 'dist', 'index.js'), "console.log('via-symlink');");

      const linkedRoot = path.join(tmpDir, 'claude-config');
      symlinkSync(realRoot, linkedRoot, 'dir');
      const linkedShimPath = path.join(
        linkedRoot, 'plugins', 'data', 'claude-dashboard-claude-dashboard', 'statusline.mjs'
      );

      const result = execFileSync('node', [linkedShimPath], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      expect(result).toBe('via-symlink\n');
    });

    // No test for the realpathSync-throws branch inside isInvokedDirectly() (the
    // try/catch at scripts/statusline-shim.mjs:80-84): it is defensive-only and
    // unreachable through a real CLI invocation. `node <path>` cannot start running this
    // file unless that path already exists on disk, so argv[1] existing is guaranteed by
    // construction in production. Reproducing the throw required a runner script to
    // forge process.argv[1] after the process started, which nothing real does; that
    // approach was tried and dropped for being flaky under full-suite file parallelism
    // (intermittent ENOENT escaping uncaught despite the try/catch being present and
    // correct — see symlink-tests-report.md). Do not re-add it.
  });
});
