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
/**
 * Extract a snippet by anchor regex. All matches in the file must be
 * byte-identical: docs may legitimately repeat a snippet (setup-alias.md keeps
 * a preview block plus a heredoc copy), but divergent matches mean the anchor
 * grabbed the wrong line or the copies drifted — fail loudly instead of
 * silently testing whichever came first.
 */
const line = (rel: string, re: RegExp) => {
  const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
  const matches = [...read(rel).matchAll(new RegExp(re.source, flags))].map((m) => m[0]);
  if (matches.length === 0) throw new Error(`snippet not found in ${rel}: ${re}`);
  if (new Set(matches).size > 1) {
    throw new Error(`ambiguous snippet anchor in ${rel}: ${re} matched ${matches.length} divergent copies`);
  }
  return matches[0];
};

/**
 * Extract a fenced code block given the literal text its first line starts
 * with. Matches lazily up to the next closing fence, so it only works for
 * blocks that are the last thing in their fence (see `checkAiFn` below for a
 * block that shares its fence with trailing content).
 */
const block = (rel: string, startLiteral: string) => {
  const escaped = startLiteral.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  return line(rel, new RegExp(`^${escaped}[\\s\\S]*?(?=\\n\`\`\`)`, 'm'));
};

/**
 * Extract the check-ai() function body from setup-alias.md's two copies (a bare
 * preview block and a heredoc-wrapped copy appended to the shell rc file) and
 * assert they're byte-identical. Can't reuse `block()`'s fence-lookahead here:
 * the function body itself now contains a standalone "}" line (closing its
 * `if (versions.length === 0) { ... }`), so a lone-brace-line regex would stop
 * too early, and the heredoc copy has a trailing `EOF` line inside the same
 * fence that a fence-lookahead would wrongly include.
 */
const checkAiFn = (rel: string) => {
  const text = read(rel);
  const extractOne = (from: number) => {
    const start = text.indexOf('check-ai() {', from);
    if (start === -1) throw new Error(`check-ai() { not found in ${rel} after offset ${from}`);
    const fenceEnd = text.indexOf('\n```', start);
    const eofMarker = text.indexOf('\nEOF', start);
    const boundary = eofMarker !== -1 && eofMarker < fenceEnd ? eofMarker : fenceEnd;
    const closeBrace = text.lastIndexOf('\n}', boundary);
    if (closeBrace === -1 || closeBrace < start) {
      throw new Error(`closing brace not found for check-ai() in ${rel}`);
    }
    return { snippet: text.slice(start, closeBrace + 2), next: closeBrace + 2 };
  };
  const first = extractOne(0);
  const second = extractOne(first.next);
  if (first.snippet !== second.snippet) {
    throw new Error(`check-ai() copies diverged in ${rel}`);
  }
  return first.snippet;
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

  // Both setup and update now write a fixed shim path (not a version-pinned dist path).
  // Always quoted (FIX A): a space-only quoting check missed shell metacharacters.
  const shimPath = (dir: string) => path.join(dir, 'plugins/data/claude-dashboard-claude-dashboard/statusline.mjs');
  const shimCommand = (dir: string) => `node ${JSON.stringify(shimPath(dir))}`;
  const shimContent = (dir: string) => readFileSync(shimPath(dir), 'utf-8');

  beforeAll(() => {
    // realpath: node resolves /var -> /private/var on macOS; keep asserts canonical
    SB = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'claude-dashboard-cmd-test-')));
    HOME = path.join(SB, 'home');
    ALT = path.join(SB, 'alt');
    // 1.9.0 sorts *after* 1.31.1 under plain string comparison ("1.9" > "1.3"), so this
    // pair actually exercises numeric-per-component ordering rather than coincidentally
    // agreeing with it.
    for (const [base, version] of [
      [path.join(HOME, '.claude'), '1.9.0'],
      [path.join(HOME, '.claude'), '1.31.1'],
      [ALT, '2.0.0'],
    ] as const) {
      const versionDir = path.join(base, 'plugins/cache/claude-dashboard/claude-dashboard', version);
      const dist = path.join(versionDir, 'dist');
      const scripts = path.join(versionDir, 'scripts');
      mkdirSync(dist, { recursive: true });
      mkdirSync(scripts, { recursive: true });
      writeFileSync(path.join(dist, 'index.js'), 'console.log(__filename)\n');
      writeFileSync(path.join(dist, 'check-usage.js'), 'console.log(__filename)\n');
      // Recognizable per-version content: proves setup/update copied the newest one.
      writeFileSync(path.join(scripts, 'statusline-shim.mjs'), `// shim template ${version}\n`);
    }
  });

  afterAll(() => {
    rmSync(SB, { recursive: true, force: true });
  });

  const INSTALL_START = `CFGDIR="\${CLAUDE_CONFIG_DIR:-$HOME/.claude}"; CFGDIR="$CFGDIR" node -e '`;
  const SETUP = () => block('commands/setup.md', INSTALL_START);
  // update.md's step 2 (install/refresh the shim + point settings.json at it) is the
  // same block, byte-for-byte, as setup's; step 3 only reports a version and writes nothing.
  const UPDATE = () => block('commands/update.md', INSTALL_START);
  const UPDATE_REPORT = () =>
    block('commands/update.md', `CFGDIR="\${CLAUDE_CONFIG_DIR:-$HOME/.claude}" node -e '`);
  const CHECK_USAGE = () =>
    block(
      'commands/check-usage.md',
      `CFGDIR="\${CLAUDE_CONFIG_DIR:-$HOME/.claude}"; SCRIPT="$(CFGDIR="$CFGDIR" node -e '`
    ).replace(/ \$ARGUMENTS$/, '');

  it('setup and update step 2 stay byte-identical', () => {
    // Markdown has no include, so the block is necessarily re-embedded rather than shared.
    // Assert the invariant the duplication rests on instead of only asserting it in a
    // comment: a fix applied to one file and not the other is caught here.
    expect(UPDATE()).toBe(SETUP());
  });

  it('setup writes the default config dir when CLAUDE_CONFIG_DIR is unset', () => {
    run(SETUP());
    const cfgDir = path.join(HOME, '.claude');
    expect(settingsCommand(cfgDir)).toBe(shimCommand(cfgDir));
    expect(shimContent(cfgDir)).toBe('// shim template 1.31.1\n');
  });

  it('setup writes the relocated config dir without touching the default one', () => {
    run(SETUP(), { CLAUDE_CONFIG_DIR: ALT });
    expect(settingsCommand(ALT)).toBe(shimCommand(ALT));
    expect(shimContent(ALT)).toBe('// shim template 2.0.0\n');
    const cfgDir = path.join(HOME, '.claude');
    expect(settingsCommand(cfgDir)).toBe(shimCommand(cfgDir));
  });

  it('setup treats an empty CLAUDE_CONFIG_DIR as unset', () => {
    const cfgDir = path.join(HOME, '.claude');
    rmSync(path.join(cfgDir, 'settings.json'));
    run(SETUP(), { CLAUDE_CONFIG_DIR: '' });
    expect(settingsCommand(cfgDir)).toBe(shimCommand(cfgDir));
  });

  it('update rewrites the command in the config dir the env selects', () => {
    run(UPDATE(), { CLAUDE_CONFIG_DIR: ALT });
    expect(settingsCommand(ALT)).toBe(shimCommand(ALT));
    run(UPDATE());
    const cfgDir = path.join(HOME, '.claude');
    expect(settingsCommand(cfgDir)).toBe(shimCommand(cfgDir));
  });

  it('setup then update leaves settings.json byte-identical', () => {
    // Two separate writers (this doc snippet and the SessionStart hook) both produce
    // statusLine.command; pin that running setup then update is a true no-op.
    const cfgDir = path.join(HOME, '.claude');
    run(SETUP());
    const afterSetup = readFileSync(path.join(cfgDir, 'settings.json'), 'utf-8');
    run(UPDATE());
    const afterUpdate = readFileSync(path.join(cfgDir, 'settings.json'), 'utf-8');
    expect(afterUpdate).toBe(afterSetup);
  });

  it('update reports the resolved build path for the selected config dir', () => {
    expect(run(UPDATE_REPORT()).trim()).toBe(
      path.join(HOME, '.claude', 'plugins/cache/claude-dashboard/claude-dashboard/1.31.1/dist/index.js')
    );
    expect(run(UPDATE_REPORT(), { CLAUDE_CONFIG_DIR: ALT }).trim()).toBe(
      path.join(ALT, 'plugins/cache/claude-dashboard/claude-dashboard/2.0.0/dist/index.js')
    );
  });

  it('check-usage resolves the script inside the selected config dir', () => {
    const cmd = CHECK_USAGE();
    expect(run(cmd).trim()).toBe(
      path.join(HOME, '.claude', 'plugins/cache/claude-dashboard/claude-dashboard/1.31.1/dist/check-usage.js')
    );
    expect(run(cmd, { CLAUDE_CONFIG_DIR: ALT }).trim()).toBe(
      path.join(ALT, 'plugins/cache/claude-dashboard/claude-dashboard/2.0.0/dist/check-usage.js')
    );
  });

  it('check-ai alias resolves per invocation, following env switches', () => {
    const fn = checkAiFn('commands/setup-alias.md');
    expect(run(`${fn}\ncheck-ai`).trim()).toContain('1.31.1/dist/check-usage.js');
    expect(run(`${fn}\ncheck-ai`, { CLAUDE_CONFIG_DIR: ALT }).trim()).toContain('2.0.0/dist/check-usage.js');
  });

  it('setup, update, check-usage, and check-ai fail loudly when nothing is installed', () => {
    const empty = path.join(SB, 'nothing-installed', '.claude');
    for (const cmd of [SETUP(), UPDATE(), UPDATE_REPORT(), CHECK_USAGE()]) {
      expect(() => run(cmd, { CLAUDE_CONFIG_DIR: empty })).toThrowError(
        /claude-dashboard is not installed in/
      );
    }
    const fn = checkAiFn('commands/setup-alias.md');
    expect(() => run(`${fn}\ncheck-ai`, { CLAUDE_CONFIG_DIR: empty })).toThrowError(
      /claude-dashboard is not installed in/
    );
  });

  it('quotes a shim path containing a shell metacharacter but no space (FIX A regression guard)', () => {
    // A config dir with a `(` in it — no space, so a space-only quoting check would
    // write it unquoted, and `sh` would then choke on the unquoted `(` as a syntax error.
    const metaCfgDir = path.join(SB, 'user(a)', '.claude');
    const versionDir = path.join(metaCfgDir, 'plugins/cache/claude-dashboard/claude-dashboard', '1.0.0');
    mkdirSync(path.join(versionDir, 'scripts'), { recursive: true });
    writeFileSync(path.join(versionDir, 'scripts', 'statusline-shim.mjs'), '// shim\n');

    run(SETUP(), { CLAUDE_CONFIG_DIR: metaCfgDir });

    expect(settingsCommand(metaCfgDir)).toBe(shimCommand(metaCfgDir));
    // The actual regression: `sh` must be able to parse the written command at all.
    expect(() => run(settingsCommand(metaCfgDir))).not.toThrow();
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
