/**
 * @handbook 4.8-version-agnostic-statusline
 * @covers hooks/ensure-statusline.mjs
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from 'fs';
import os from 'os';
import path from 'path';
// @ts-expect-error - dependency-free .mjs hook, no type declarations by design
import { syncShim } from '../../hooks/ensure-statusline.mjs';

describe('ensure-statusline / syncShim', () => {
  let tmpDir: string;
  let pluginRoot: string;
  let pluginData: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'ensure-sl-test-'));
    pluginRoot = path.join(tmpDir, 'root');
    pluginData = path.join(tmpDir, 'data');
    mkdirSync(path.join(pluginRoot, 'scripts'), { recursive: true });
    writeFileSync(path.join(pluginRoot, 'scripts', 'statusline-shim.mjs'), 'export const v = 1;');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('installs the shim when it is absent, creating the data dir', () => {
    const dest = syncShim(pluginRoot, pluginData);

    expect(dest).toBe(path.join(pluginData, 'statusline.mjs'));
    expect(readFileSync(dest, 'utf8')).toBe('export const v = 1;');
  });

  it('overwrites an outdated shim so the indirection layer stays upgradable', () => {
    mkdirSync(pluginData, { recursive: true });
    writeFileSync(path.join(pluginData, 'statusline.mjs'), 'export const v = 0;');

    syncShim(pluginRoot, pluginData);

    expect(readFileSync(path.join(pluginData, 'statusline.mjs'), 'utf8')).toBe('export const v = 1;');
  });

  it('does not rewrite an identical shim', () => {
    const dest = syncShim(pluginRoot, pluginData);
    const before = statSync(dest).mtimeMs;

    syncShim(pluginRoot, pluginData);

    expect(statSync(dest).mtimeMs).toBe(before);
  });

  it('returns null when the bundled template is missing', () => {
    rmSync(path.join(pluginRoot, 'scripts', 'statusline-shim.mjs'));

    expect(syncShim(pluginRoot, pluginData)).toBeNull();
    expect(existsSync(path.join(pluginData, 'statusline.mjs'))).toBe(false);
  });
});
