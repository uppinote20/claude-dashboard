/**
 * Verifies the executable snippets shipped inside the slash-command docs
 * (commands/setup.md, update.md, check-usage.md, setup-alias.md) and the
 * README manual-install line honor CLAUDE_CONFIG_DIR. Snippets are extracted
 * from the shipped markdown, so doc edits that break multi-account routing
 * fail here. Markdown files sit outside the @tested/@covers marker system;
 * this file references them by path instead.
 * @handbook 8.1-test-structure
 * @handbook 8.5-doc-snippet-tests
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, realpathSync, rmSync, existsSync } from 'fs';
import path from 'path';
import os from 'os';

const REPO = path.resolve(__dirname, '..', '..');
const read = (rel: string) => readFileSync(path.join(REPO, rel), 'utf-8');
const line = (rel: string, re: RegExp) => {
  const m = read(rel).match(re);
  if (!m) throw new Error(`snippet not found in ${rel}: ${re}`);
  return m[0];
};

// bash one-liners can't run on Windows runners
describe.skipIf(process.platform === 'win32')('commands/*.md CLAUDE_CONFIG_DIR snippets', () => {
  let SB: string;
  let HOME: string;
  let ALT: string;

  const run = (cmd: string, env: Record<string, string> = {}) =>
    execFileSync('bash', ['-c', cmd], {
      // Deliberately minimal env (à la `env -i`): CLAUDE_CONFIG_DIR only present when a test sets it
      env: { PATH: process.env.PATH ?? '', HOME, ...env },
      encoding: 'utf-8',
    });

  const settingsCommand = (dir: string) =>
    JSON.parse(readFileSync(path.join(dir, 'settings.json'), 'utf-8')).statusLine.command as string;

  beforeAll(() => {
    // realpath: node resolves /var -> /private/var on macOS; keep asserts canonical
    SB = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'claude-dashboard-cmd-test-')));
    HOME = path.join(SB, 'home');
    ALT = path.join(SB, 'alt');
    for (const [base, version] of [
      [path.join(HOME, '.claude'), '1.29.0'],
      [path.join(HOME, '.claude'), '1.30.0'],
      [ALT, '2.0.0'],
    ] as const) {
      const dist = path.join(base, 'plugins/cache/claude-dashboard/claude-dashboard', version, 'dist');
      mkdirSync(dist, { recursive: true });
      writeFileSync(path.join(dist, 'index.js'), 'console.log(__filename)\n');
      writeFileSync(path.join(dist, 'check-usage.js'), 'console.log(__filename)\n');
    }
  });

  afterAll(() => {
    rmSync(SB, { recursive: true, force: true });
  });

  const SETUP = () => line('commands/setup.md', /^CFGDIR=.*$/m);
  const UPDATE = () =>
    [
      line('commands/update.md', /^CFGDIR=.*$/m),
      line('commands/update.md', /^LATEST_VERSION=.*$/m),
      line('commands/update.md', /^NEWCMD=.*$/m),
    ].join('\n');

  it('setup writes the default config dir when CLAUDE_CONFIG_DIR is unset', () => {
    run(SETUP());
    expect(settingsCommand(path.join(HOME, '.claude'))).toContain('1.30.0/dist/index.js');
  });

  it('setup writes the relocated config dir without touching the default one', () => {
    run(SETUP(), { CLAUDE_CONFIG_DIR: ALT });
    expect(settingsCommand(ALT)).toContain('2.0.0/dist/index.js');
    expect(settingsCommand(path.join(HOME, '.claude'))).toContain('1.30.0/dist/index.js');
  });

  it('setup treats an empty CLAUDE_CONFIG_DIR as unset', () => {
    rmSync(path.join(HOME, '.claude', 'settings.json'));
    run(SETUP(), { CLAUDE_CONFIG_DIR: '' });
    expect(settingsCommand(path.join(HOME, '.claude'))).toContain('1.30.0/dist/index.js');
  });

  it('update rewrites the command in the config dir the env selects', () => {
    run(UPDATE(), { CLAUDE_CONFIG_DIR: ALT });
    expect(settingsCommand(ALT)).toBe(
      `node ${ALT}/plugins/cache/claude-dashboard/claude-dashboard/2.0.0/dist/index.js`
    );
    run(UPDATE());
    expect(settingsCommand(path.join(HOME, '.claude'))).toContain('1.30.0/dist/index.js');
  });

  it('check-usage resolves the script inside the selected config dir', () => {
    const cmd = line('commands/check-usage.md', /^node "\$\(ls -d.*$/m).replace(/ \$ARGUMENTS$/, '');
    expect(run(cmd).trim()).toBe(
      path.join(HOME, '.claude', 'plugins/cache/claude-dashboard/claude-dashboard/1.30.0/dist/check-usage.js')
    );
    expect(run(cmd, { CLAUDE_CONFIG_DIR: ALT }).trim()).toBe(
      path.join(ALT, 'plugins/cache/claude-dashboard/claude-dashboard/2.0.0/dist/check-usage.js')
    );
  });

  it('check-ai alias resolves per invocation, following env switches', () => {
    const fn = line('commands/setup-alias.md', /^check-ai\(\) \{\n[\s\S]*?^\}$/m);
    expect(run(`${fn}\ncheck-ai`).trim()).toContain('1.30.0/dist/check-usage.js');
    expect(run(`${fn}\ncheck-ai`, { CLAUDE_CONFIG_DIR: ALT }).trim()).toContain('2.0.0/dist/check-usage.js');
  });

  it('README manual-install clone lands in the selected config dir', () => {
    const bare = path.join(SB, 'fixture.git');
    run(`git init -q --bare "${bare}" && git clone -q "${bare}" "${SB}/seed" && cd "${SB}/seed" && git -c user.email=t@t -c user.name=t commit -q --allow-empty -m x && git push -q origin HEAD`);
    const clone = line('README.md', /^git clone https.*$/m).replace(
      'https://github.com/uppinote20/claude-dashboard.git',
      bare
    );
    run(clone);
    expect(existsSync(path.join(HOME, '.claude/plugins/claude-dashboard/.git'))).toBe(true);
    run(clone, { CLAUDE_CONFIG_DIR: ALT });
    expect(existsSync(path.join(ALT, 'plugins/claude-dashboard/.git'))).toBe(true);
  });
});
