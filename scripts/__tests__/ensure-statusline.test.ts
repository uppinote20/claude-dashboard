/**
 * @handbook 4.8-version-agnostic-statusline
 * @covers hooks/ensure-statusline.mjs
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  statSync,
  chmodSync,
  utimesSync,
  symlinkSync,
  copyFileSync,
} from 'fs';
import { execFileSync } from 'child_process';
import os from 'os';
import path from 'path';
// @ts-expect-error - dependency-free .mjs hook, no type declarations by design
import { syncShim, migrateStatusLine } from '../../hooks/ensure-statusline.mjs';

// The version-pinned command shape the migration exists to replace. Shared by the
// in-process migrateStatusLine tests and the CLI entry-point test.
const PINNED =
  'node /home/u/.claude/plugins/cache/claude-dashboard/claude-dashboard/1.31.0/dist/index.js';

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
    const pastSec = new Date(2000, 0, 1).getTime() / 1000;
    utimesSync(dest, pastSec, pastSec);
    const before = statSync(dest).mtimeMs;

    syncShim(pluginRoot, pluginData);

    expect(statSync(dest).mtimeMs).toBe(before);
  });

  it('rewrites the shim when content changes', () => {
    const dest = syncShim(pluginRoot, pluginData);
    const pastSec = new Date(2000, 0, 1).getTime() / 1000;
    utimesSync(dest, pastSec, pastSec);
    const before = statSync(dest).mtimeMs;

    writeFileSync(path.join(pluginRoot, 'scripts', 'statusline-shim.mjs'), 'export const v = 2;');
    syncShim(pluginRoot, pluginData);

    expect(statSync(dest).mtimeMs).toBeGreaterThan(before);
    expect(readFileSync(dest, 'utf8')).toBe('export const v = 2;');
  });

  it('returns null when the bundled template is missing', () => {
    rmSync(path.join(pluginRoot, 'scripts', 'statusline-shim.mjs'));

    expect(syncShim(pluginRoot, pluginData)).toBeNull();
    expect(existsSync(path.join(pluginData, 'statusline.mjs'))).toBe(false);
  });
});

describe('ensure-statusline / migrateStatusLine', () => {
  let tmpDir: string;
  let settingsPath: string;
  const SHIM = '/home/u/.claude/plugins/data/claude-dashboard-claude-dashboard/statusline.mjs';

  function writeSettings(value: unknown): void {
    writeFileSync(settingsPath, JSON.stringify(value, null, 2));
  }

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'migrate-test-'));
    settingsPath = path.join(tmpDir, 'settings.json');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('rewrites this plugin\'s version-pinned command', () => {
    writeSettings({ statusLine: { type: 'command', command: PINNED } });

    expect(migrateStatusLine(settingsPath, SHIM)).toBe('migrated');
    expect(JSON.parse(readFileSync(settingsPath, 'utf8')).statusLine.command).toBe(`node ${JSON.stringify(SHIM)}`);
  });

  it('rewrites a quoted pinned command', () => {
    writeSettings({
      statusLine: {
        type: 'command',
        command: 'node "C:/Users/A B/.claude/plugins/cache/claude-dashboard/claude-dashboard/1.31.0/dist/index.js"',
      },
    });

    expect(migrateStatusLine(settingsPath, SHIM)).toBe('migrated');
  });

  it('quotes the replacement when the shim path contains a space', () => {
    writeSettings({ statusLine: { type: 'command', command: PINNED } });
    const spaced = '/home/a b/.claude/plugins/data/claude-dashboard-claude-dashboard/statusline.mjs';

    migrateStatusLine(settingsPath, spaced);

    expect(JSON.parse(readFileSync(settingsPath, 'utf8')).statusLine.command).toBe(`node "${spaced}"`);
  });

  it('quotes the replacement when the shim path has a shell metacharacter but no space', () => {
    // Regression guard: a space-only quoting check misses this case entirely, and since
    // statusLine.command is shell-evaluated, an unquoted `(` is a syntax error to `sh`.
    writeSettings({ statusLine: { type: 'command', command: PINNED } });
    const meta = '/home/user(a)/.claude/plugins/data/claude-dashboard-claude-dashboard/statusline.mjs';

    migrateStatusLine(settingsPath, meta);

    expect(JSON.parse(readFileSync(settingsPath, 'utf8')).statusLine.command).toBe(`node ${JSON.stringify(meta)}`);
  });

  it('preserves unrelated settings keys', () => {
    writeSettings({ model: 'opus', statusLine: { type: 'command', command: PINNED } });

    migrateStatusLine(settingsPath, SHIM);

    expect(JSON.parse(readFileSync(settingsPath, 'utf8')).model).toBe('opus');
  });

  it('leaves a user-authored status line untouched', () => {
    writeSettings({ statusLine: { type: 'command', command: 'node ~/.claude/my-statusline.js' } });
    const before = readFileSync(settingsPath, 'utf8');

    expect(migrateStatusLine(settingsPath, SHIM)).toBe('skipped');
    expect(readFileSync(settingsPath, 'utf8')).toBe(before);
  });

  it('does not rewrite an already-migrated shim path', () => {
    writeSettings({ statusLine: { type: 'command', command: `node ${SHIM}` } });
    const pastSec = new Date(2000, 0, 1).getTime() / 1000;
    utimesSync(settingsPath, pastSec, pastSec);
    const before = statSync(settingsPath).mtimeMs;

    expect(migrateStatusLine(settingsPath, SHIM)).toBe('skipped');
    expect(statSync(settingsPath).mtimeMs).toBe(before);
  });

  it('does nothing when settings.json is malformed', () => {
    writeFileSync(settingsPath, '{ this is not json');

    expect(migrateStatusLine(settingsPath, SHIM)).toBe('unparsable');
    expect(readFileSync(settingsPath, 'utf8')).toBe('{ this is not json');
  });

  it('skips when statusLine is a string instead of an object', () => {
    writeSettings({ statusLine: 'node ~/.claude/my-statusline.js' });
    const before = readFileSync(settingsPath, 'utf8');

    expect(migrateStatusLine(settingsPath, SHIM)).toBe('skipped');
    expect(readFileSync(settingsPath, 'utf8')).toBe(before);
  });

  it('skips when statusLine is null', () => {
    writeSettings({ statusLine: null });
    const before = readFileSync(settingsPath, 'utf8');

    expect(migrateStatusLine(settingsPath, SHIM)).toBe('skipped');
    expect(readFileSync(settingsPath, 'utf8')).toBe(before);
  });

  it('skips when the whole settings file is null', () => {
    writeSettings(null);
    const before = readFileSync(settingsPath, 'utf8');

    expect(migrateStatusLine(settingsPath, SHIM)).toBe('skipped');
    expect(readFileSync(settingsPath, 'utf8')).toBe(before);
  });

  it('reports missing settings without creating one', () => {
    expect(migrateStatusLine(settingsPath, SHIM)).toBe('no-settings');
    expect(existsSync(settingsPath)).toBe(false);
  });

  it('backs up settings.json once and never overwrites the backup', () => {
    writeSettings({ statusLine: { type: 'command', command: PINNED } });
    const original = readFileSync(settingsPath, 'utf8');

    migrateStatusLine(settingsPath, SHIM);
    expect(readFileSync(`${settingsPath}.bak`, 'utf8')).toBe(original);

    // A second pinned value must not clobber the first backup.
    writeSettings({ statusLine: { type: 'command', command: PINNED } });
    migrateStatusLine(settingsPath, SHIM);

    expect(readFileSync(`${settingsPath}.bak`, 'utf8')).toBe(original);
  });

  // Windows has no POSIX permission bits; chmod there only toggles the read-only flag.
  it.skipIf(process.platform === 'win32')(
    'keeps a restricted settings.json restricted, backup included',
    () => {
      // settings.json can hold `env` secrets or an apiKeyHelper, so a user who chmod'd it
      // to 0600 must not have it widened by a migration they never asked for — and the
      // .bak must not leak the same content at a looser mode.
      writeSettings({ statusLine: { type: 'command', command: PINNED } });
      chmodSync(settingsPath, 0o600);

      expect(migrateStatusLine(settingsPath, SHIM)).toBe('migrated');

      // Mask off the file-type bits; only the permission bits are under test.
      expect(statSync(settingsPath).mode & 0o777).toBe(0o600);
      expect(statSync(`${settingsPath}.bak`).mode & 0o777).toBe(0o600);
    }
  );

  it('rethrows a failed write, leaving the original and its backup intact', () => {
    writeSettings({ statusLine: { type: 'command', command: PINNED } });
    const original = readFileSync(settingsPath, 'utf8');
    // Squat on the exact temp path the settings rewrite will use. A directory there makes
    // writeFileSync fail with EISDIR, so the failure branch runs against the real fs
    // rather than a mock. The backup is written first, so it still lands.
    mkdirSync(`${settingsPath}.${process.pid}.tmp`);

    expect(() => migrateStatusLine(settingsPath, SHIM)).toThrow();

    // The point of writing through a temp file: a failed migration is a no-op on the real
    // file, not a truncation. And the error surfaces instead of being swallowed by the
    // best-effort cleanup — which here cannot unlink a directory and must stay silent.
    expect(readFileSync(settingsPath, 'utf8')).toBe(original);
    expect(readFileSync(`${settingsPath}.bak`, 'utf8')).toBe(original);
  });

  it('skips commands with flags (e.g. --inspect)', () => {
    writeSettings({ statusLine: { type: 'command', command: 'node --inspect /home/u/.claude/plugins/cache/claude-dashboard/claude-dashboard/1.31.0/dist/index.js' } });
    const before = readFileSync(settingsPath, 'utf8');

    expect(migrateStatusLine(settingsPath, SHIM)).toBe('skipped');
    expect(readFileSync(settingsPath, 'utf8')).toBe(before);
  });

  it('skips commands with wrapper scripts', () => {
    writeSettings({ statusLine: { type: 'command', command: 'node /home/u/my-wrapper.js /home/u/.claude/plugins/cache/claude-dashboard/claude-dashboard/1.31.0/dist/index.js' } });
    const before = readFileSync(settingsPath, 'utf8');

    expect(migrateStatusLine(settingsPath, SHIM)).toBe('skipped');
    expect(readFileSync(settingsPath, 'utf8')).toBe(before);
  });

  it('skips mismatched-quote commands', () => {
    writeSettings({ statusLine: { type: 'command', command: 'node "/home/u/.claude/plugins/cache/claude-dashboard/claude-dashboard/1.31.0/dist/index.js' } });
    const before = readFileSync(settingsPath, 'utf8');

    expect(migrateStatusLine(settingsPath, SHIM)).toBe('skipped');
    expect(readFileSync(settingsPath, 'utf8')).toBe(before);
  });

  it('rewrites Windows backslash paths', () => {
    writeSettings({ statusLine: { type: 'command', command: 'node C:\\Users\\u\\.claude\\plugins\\cache\\claude-dashboard\\claude-dashboard\\1.31.0\\dist\\index.js' } });

    expect(migrateStatusLine(settingsPath, SHIM)).toBe('migrated');
    expect(JSON.parse(readFileSync(settingsPath, 'utf8')).statusLine.command).toBe(`node ${JSON.stringify(SHIM)}`);
  });
});

describe('ensure-statusline / CLI entry point', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'ensure-sl-cli-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('migrates the pinned statusLine command when invoked through a symlinked config root', () => {
    // Mirrors `ln -s ~/dotfiles/claude ~/.claude`: the hook's real file lives under
    // <real>/hooks/..., and a symlink stands in for the config root that is actually on
    // the invoking path. Before the realpath fix, this silently no-op'd the migration.
    const realRoot = path.join(tmpDir, 'dotfiles-claude');
    const realHookPath = path.join(realRoot, 'hooks', 'ensure-statusline.mjs');
    mkdirSync(path.dirname(realHookPath), { recursive: true });
    copyFileSync('hooks/ensure-statusline.mjs', realHookPath);

    const linkedRoot = path.join(tmpDir, 'claude-config');
    symlinkSync(realRoot, linkedRoot, 'dir');
    const linkedHookPath = path.join(linkedRoot, 'hooks', 'ensure-statusline.mjs');

    const pluginRoot = path.join(tmpDir, 'plugin-root');
    mkdirSync(path.join(pluginRoot, 'scripts'), { recursive: true });
    writeFileSync(path.join(pluginRoot, 'scripts', 'statusline-shim.mjs'), 'export const v = 1;');
    const pluginData = path.join(tmpDir, 'plugin-data');

    const configDir = path.join(tmpDir, 'settings-dir');
    mkdirSync(configDir, { recursive: true });
    const settingsPath = path.join(configDir, 'settings.json');
    writeFileSync(settingsPath, JSON.stringify({ statusLine: { type: 'command', command: PINNED } }, null, 2));

    const result = execFileSync('node', [linkedHookPath], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CLAUDE_PLUGIN_ROOT: pluginRoot,
        CLAUDE_PLUGIN_DATA: pluginData,
        CLAUDE_CONFIG_DIR: configDir,
      },
    });

    expect(result).toBe('');
    const expectedShim = path.join(pluginData, 'statusline.mjs');
    expect(JSON.parse(readFileSync(settingsPath, 'utf8')).statusLine.command).toBe(`node ${JSON.stringify(expectedShim)}`);
    expect(existsSync(expectedShim)).toBe(true);
  });
});
