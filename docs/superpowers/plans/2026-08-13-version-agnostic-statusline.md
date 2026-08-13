# Version-agnostic statusLine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `settings.json` point at a permanent path so a plugin update takes effect without the user running any command.

**Architecture:** A dependency-free shim lives in `${CLAUDE_PLUGIN_DATA}` (a directory documented to survive plugin updates) and resolves the newest `dist/index.js` at render time. A `SessionStart` hook keeps that shim in sync with the bundled template and rewrites `statusLine.command` — but only when it matches this plugin's own version-pinned shape.

**Tech Stack:** Node 18+ built-ins only, ESM (`"type": "module"`), vitest, esbuild (unchanged — the new `.mjs` files ship as-is and are never bundled).

**Spec:** `docs/superpowers/specs/2026-08-13-version-agnostic-statusline-design.md`

## Global Constraints

- **No external runtime dependencies.** Node built-ins only (existing project rule, `CLAUDE.md` → Code Style).
- **The shim must be standalone.** It is copied out of the plugin directory and runs from `${CLAUDE_PLUGIN_DATA}`; it may not import anything from the plugin, including `dist/`.
- **Command shape stays `node <path>`.** Windows runs status line commands through Git Bash *or* PowerShell, so no bash-only syntax in `settings.json`.
- **Absolute paths only** when writing `statusLine.command`; wrap in double quotes if the path contains a space.
- **Never touch a non-matching `statusLine`.** Only this exact pattern is rewritten:
  `^\s*node\s+(?:"[^"]*[/\\]plugins[/\\]cache[/\\]claude-dashboard[/\\]claude-dashboard[/\\]\d+\.\d+\.\d+[/\\]dist[/\\]index\.js"|'[^']*[/\\]plugins[/\\]cache[/\\]claude-dashboard[/\\]claude-dashboard[/\\]\d+\.\d+\.\d+[/\\]dist[/\\]index\.js'|(?!["'])\S*[/\\]plugins[/\\]cache[/\\]claude-dashboard[/\\]claude-dashboard[/\\]\d+\.\d+\.\d+[/\\]dist[/\\]index\.js)\s*$`
  Three branches prevent swallowing flags or wrapper arguments: double-quoted paths (spaces allowed), single-quoted paths, and unquoted paths (non-whitespace only, rejected if starting with a quote).
- **Every failure path exits 0.** The hook must never block session start; the shim must never spam the status line.
- **Semver ordering is numeric per component.** `1.9.0 < 1.31.1`. String sort is wrong.
- **Tests** go in `scripts/__tests__/**/*.test.ts` (the only path vitest includes) and carry `@handbook` / `@covers` markers like existing tests.
- `dist/` is **not** rebuilt by this work. Do not run `npm run build` as part of these tasks.

---

### Task 1: Shim — resolve the newest build

**Files:**
- Create: `scripts/statusline-shim.mjs`
- Test: `scripts/__tests__/statusline-shim.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `deriveCacheRoot(shimUrl: string): string` and `resolveLatestDist(cacheRoot: string): string | null`, both named exports of `scripts/statusline-shim.mjs`. Task 2 copies this file verbatim; Task 4 relies on its silent-exit behavior.

- [ ] **Step 1: Write the failing test**

Create `scripts/__tests__/statusline-shim.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/__tests__/statusline-shim.test.ts`
Expected: FAIL — cannot resolve `../statusline-shim.mjs`.

- [ ] **Step 3: Write minimal implementation**

Create `scripts/statusline-shim.mjs`:

```javascript
#!/usr/bin/env node
/**
 * Stable entry point for the claude-dashboard status line.
 *
 * Copied to ${CLAUDE_PLUGIN_DATA}/statusline.mjs by hooks/ensure-statusline.mjs and
 * referenced from settings.json by an absolute path that never changes. Resolves the
 * newest installed build at render time, so a plugin update needs no settings edit.
 *
 * Runs from outside the plugin directory: Node built-ins only, no plugin imports.
 *
 * @handbook 4.8-version-agnostic-statusline
 * @tested scripts/__tests__/statusline-shim.test.ts
 */
import { readdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

/**
 * Derive the plugin's cache root from the shim's own location.
 *
 * <config>/plugins/data/<id>/statusline.mjs
 *   -> <config>/plugins/cache/claude-dashboard/claude-dashboard
 *
 * Deriving beats baking the path in at write time: a changed CLAUDE_CONFIG_DIR or a
 * different account would otherwise leave the shim silently pointing at the wrong tree.
 */
export function deriveCacheRoot(shimUrl) {
  const pluginsDir = path.resolve(path.dirname(fileURLToPath(shimUrl)), '..', '..');
  return path.join(pluginsDir, 'cache', 'claude-dashboard', 'claude-dashboard');
}

/**
 * Newest <cacheRoot>/<semver>/dist/index.js, or null when nothing is installed.
 * Ordering is numeric per component — string sort would rank 1.9.0 above 1.31.1.
 */
export function resolveLatestDist(cacheRoot) {
  let entries;
  try {
    entries = readdirSync(cacheRoot, { withFileTypes: true });
  } catch {
    return null;
  }

  const candidates = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const match = SEMVER.exec(entry.name);
    if (!match) continue;
    const dist = path.join(cacheRoot, entry.name, 'dist', 'index.js');
    if (!existsSync(dist)) continue;
    candidates.push({
      version: [Number(match[1]), Number(match[2]), Number(match[3])],
      dist,
    });
  }

  if (candidates.length === 0) return null;

  candidates.sort(
    (a, b) =>
      b.version[0] - a.version[0] ||
      b.version[1] - a.version[1] ||
      b.version[2] - a.version[2]
  );
  return candidates[0].dist;
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const target = resolveLatestDist(deriveCacheRoot(import.meta.url));
  // Silent exit: a warning here would print on every single render.
  if (target) await import(pathToFileURL(target).href);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/__tests__/statusline-shim.test.ts`
Expected: PASS (6 tests).

If the `.mjs` import fails to resolve under TypeScript, keep the `@ts-expect-error`; vitest transpiles with esbuild and does not typecheck, so no config change is needed.

- [ ] **Step 5: Verify the shim runs standalone**

Run:
```bash
mkdir -p /tmp/shimcheck/plugins/data/claude-dashboard-claude-dashboard
cp scripts/statusline-shim.mjs /tmp/shimcheck/plugins/data/claude-dashboard-claude-dashboard/statusline.mjs
echo '{}' | node /tmp/shimcheck/plugins/data/claude-dashboard-claude-dashboard/statusline.mjs; echo "exit=$?"
```
Expected: no output, `exit=0` (no cache tree exists, so the silent path is exercised).

- [ ] **Step 6: Commit**

```bash
git add scripts/statusline-shim.mjs scripts/__tests__/statusline-shim.test.ts
git commit -m "feat: add version-resolving statusline shim"
```

---

### Task 2: Hook — keep the installed shim in sync

**Files:**
- Create: `hooks/ensure-statusline.mjs`
- Test: `scripts/__tests__/ensure-statusline.test.ts`

**Interfaces:**
- Consumes: `scripts/statusline-shim.mjs` from Task 1 (read as a file, not imported).
- Produces: `syncShim(pluginRoot: string, pluginData: string): string | null` — returns the absolute path of the installed shim, or `null` if the template is missing. Task 3 adds `migrateStatusLine` to the same file; Task 4 wires both.

- [ ] **Step 1: Write the failing test**

Create `scripts/__tests__/ensure-statusline.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/__tests__/ensure-statusline.test.ts`
Expected: FAIL — cannot resolve `../../hooks/ensure-statusline.mjs`.

- [ ] **Step 3: Write minimal implementation**

Create `hooks/ensure-statusline.mjs`:

```javascript
#!/usr/bin/env node
/**
 * SessionStart hook: install/refresh the status line shim and migrate settings.json
 * off this plugin's version-pinned path.
 *
 * @handbook 4.8-version-agnostic-statusline
 * @tested scripts/__tests__/ensure-statusline.test.ts
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

export const SHIM_FILENAME = 'statusline.mjs';

/**
 * Copy the bundled shim template into the plugin's persistent data directory.
 * Writing only on difference keeps the hook a no-op in the common case, and lets a
 * future plugin version upgrade the shim itself.
 */
export function syncShim(pluginRoot, pluginData) {
  const source = path.join(pluginRoot, 'scripts', 'statusline-shim.mjs');
  if (!existsSync(source)) return null;

  const dest = path.join(pluginData, SHIM_FILENAME);
  const content = readFileSync(source, 'utf8');
  if (existsSync(dest) && readFileSync(dest, 'utf8') === content) return dest;

  mkdirSync(pluginData, { recursive: true });
  writeFileSync(dest, content);
  return dest;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/__tests__/ensure-statusline.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add hooks/ensure-statusline.mjs scripts/__tests__/ensure-statusline.test.ts
git commit -m "feat: install and refresh the statusline shim from a hook"
```

---

### Task 3: Hook — migrate settings.json safely

**Files:**
- Modify: `hooks/ensure-statusline.mjs` (append)
- Test: `scripts/__tests__/ensure-statusline.test.ts` (append a describe block)

**Interfaces:**
- Consumes: `syncShim` from Task 2 (same file).
- Produces: `migrateStatusLine(settingsPath: string, shimPath: string): 'migrated' | 'skipped' | 'unparsable' | 'no-settings'`. Task 4 calls it with the return value used only for logging.

This task edits a file the plugin does not own. Every branch below is a safety requirement from spec §6, not a nicety.

- [ ] **Step 1: Write the failing test**

Append to `scripts/__tests__/ensure-statusline.test.ts` (add `migrateStatusLine` to the existing import):

```typescript
describe('ensure-statusline / migrateStatusLine', () => {
  let tmpDir: string;
  let settingsPath: string;
  const SHIM = '/home/u/.claude/plugins/data/claude-dashboard-claude-dashboard/statusline.mjs';

  const PINNED =
    'node /home/u/.claude/plugins/cache/claude-dashboard/claude-dashboard/1.31.0/dist/index.js';

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
    expect(JSON.parse(readFileSync(settingsPath, 'utf8')).statusLine.command).toBe(`node ${SHIM}`);
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
    const before = statSync(settingsPath).mtimeMs;

    expect(migrateStatusLine(settingsPath, SHIM)).toBe('skipped');
    expect(statSync(settingsPath).mtimeMs).toBe(before);
  });

  it('does nothing when settings.json is malformed', () => {
    writeFileSync(settingsPath, '{ this is not json');

    expect(migrateStatusLine(settingsPath, SHIM)).toBe('unparsable');
    expect(readFileSync(settingsPath, 'utf8')).toBe('{ this is not json');
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/__tests__/ensure-statusline.test.ts`
Expected: FAIL — `migrateStatusLine is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `hooks/ensure-statusline.mjs` (and add `renameSync` to the `fs` import — nothing else is needed):

```javascript
/**
 * Matches only this plugin's version-pinned command. Quotes are optional because a path
 * containing a space (a Windows user profile, say) is written quoted — an unquoted-only
 * pattern would skip exactly those users.
 */
const PINNED_COMMAND =
  /^\s*node\s+["']?.*[/\\]plugins[/\\]cache[/\\]claude-dashboard[/\\]claude-dashboard[/\\]\d+\.\d+\.\d+[/\\]dist[/\\]index\.js["']?\s*$/;

/**
 * Point statusLine.command at the stable shim, but only when it currently holds this
 * plugin's pinned path. Anything else — a user-authored line, another tool, an
 * already-migrated path — is left alone.
 */
export function migrateStatusLine(settingsPath, shimPath) {
  if (!existsSync(settingsPath)) return 'no-settings';

  let raw;
  let settings;
  try {
    raw = readFileSync(settingsPath, 'utf8');
    settings = JSON.parse(raw);
  } catch {
    return 'unparsable';
  }

  const current = settings?.statusLine?.command;
  if (typeof current !== 'string' || !PINNED_COMMAND.test(current)) return 'skipped';

  const backup = `${settingsPath}.bak`;
  if (!existsSync(backup)) writeFileSync(backup, raw);

  const quoted = shimPath.includes(' ') ? `"${shimPath}"` : shimPath;
  settings.statusLine.command = `node ${quoted}`;

  // Temp file + rename: a crashed write must not leave a truncated settings.json.
  const tmp = `${settingsPath}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(settings, null, 2)}\n`);
  renameSync(tmp, settingsPath);
  return 'migrated';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/__tests__/ensure-statusline.test.ts`
Expected: PASS (13 tests — 4 from Task 2, 9 here).

- [ ] **Step 5: Run the full suite for regressions**

Run: `npm test`
Expected: PASS, no previously-passing test broken.

- [ ] **Step 6: Commit**

```bash
git add hooks/ensure-statusline.mjs scripts/__tests__/ensure-statusline.test.ts
git commit -m "feat: migrate pinned statusLine paths to the shim"
```

---

### Task 4: Wire the hook into the plugin

**Files:**
- Create: `hooks/hooks.json`
- Modify: `hooks/ensure-statusline.mjs` (append entry point)

**Interfaces:**
- Consumes: `syncShim` (Task 2), `migrateStatusLine` (Task 3).
- Produces: nothing importable — this is the executable boundary.

- [ ] **Step 1: Add the entry point**

Append to `hooks/ensure-statusline.mjs` (add `fileURLToPath` from `url` to the imports):

```javascript
// Guarded so the test suite can import the functions without running the hook.
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  try {
    const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
    const pluginData = process.env.CLAUDE_PLUGIN_DATA;
    if (pluginRoot && pluginData) {
      const shim = syncShim(pluginRoot, pluginData);
      if (shim) {
        const configDir =
          process.env.CLAUDE_CONFIG_DIR || path.join(homedir(), '.claude');
        migrateStatusLine(path.join(configDir, 'settings.json'), shim);
      }
    }
  } catch {
    // Never block session start.
  }
  process.exit(0);
}
```

Add `import { homedir } from 'os';` to the top of the file.

- [ ] **Step 2: Register the hook**

Create `hooks/hooks.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/ensure-statusline.mjs\""
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 3: Verify the entry point end-to-end against a fake install**

Run:
```bash
rm -rf /tmp/hookcheck && mkdir -p /tmp/hookcheck/cfg /tmp/hookcheck/data
cat > /tmp/hookcheck/cfg/settings.json <<'JSON'
{
  "model": "opus",
  "statusLine": {
    "type": "command",
    "command": "node /home/u/.claude/plugins/cache/claude-dashboard/claude-dashboard/1.31.0/dist/index.js"
  }
}
JSON
CLAUDE_PLUGIN_ROOT="$PWD" \
CLAUDE_PLUGIN_DATA=/tmp/hookcheck/data \
CLAUDE_CONFIG_DIR=/tmp/hookcheck/cfg \
  node hooks/ensure-statusline.mjs; echo "exit=$?"
cat /tmp/hookcheck/cfg/settings.json
ls /tmp/hookcheck/data /tmp/hookcheck/cfg
```
Expected: `exit=0`; `statusLine.command` now `node /tmp/hookcheck/data/statusline.mjs`; `model` still `"opus"`; `statusline.mjs` present in the data dir; `settings.json.bak` present in the config dir.

- [ ] **Step 4: Verify the no-op path**

Run the same command block again (without recreating `settings.json`).
Expected: `exit=0`, `settings.json` unchanged, `.bak` still holding the *original* pinned version.

- [ ] **Step 5: Confirm the open question from spec §9**

Determine whether Claude Code re-reads `statusLine.command` mid-session or requires a restart. Check the statusline docs (`code.claude.com/docs/en/statusline`) for a settings-reload statement, and if the docs are silent, edit `statusLine.command` in a live session and observe whether the rendered line changes without restarting.

Record the answer in the spec's §9 and adjust the migration wording in Task 6 docs accordingly. Do not assert a behavior that was not observed.

- [ ] **Step 6: Commit**

```bash
git add hooks/hooks.json hooks/ensure-statusline.mjs
git commit -m "feat: register SessionStart hook for statusline migration"
```

---

### Task 5: Update the setup and update commands

**Files:**
- Modify: `commands/setup.md:237-248`
- Modify: `commands/update.md` (whole body)

**Interfaces:**
- Consumes: the shim contract from Task 1 and `${CLAUDE_PLUGIN_DATA}` layout from Task 2.
- Produces: nothing importable.

Setup must not depend on the hook having run — a user may run `/claude-dashboard:setup` in the same session the plugin was installed.

- [ ] **Step 1: Replace the setup one-liner**

In `commands/setup.md`, replace the `### 3. Update settings.json` bash block with:

```bash
CFGDIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"; SRC="$(ls -d "$CFGDIR"/plugins/cache/claude-dashboard/claude-dashboard/*/scripts/statusline-shim.mjs 2>/dev/null | sort -V | tail -1)"; DATADIR="$CFGDIR/plugins/data/claude-dashboard-claude-dashboard"; mkdir -p "$DATADIR" && cp "$SRC" "$DATADIR/statusline.mjs" && SLPATH="$DATADIR/statusline.mjs" CFGDIR="$CFGDIR" node -e 'const fs=require("fs"),p=process.env.CFGDIR+"/settings.json";const s=fs.existsSync(p)?JSON.parse(fs.readFileSync(p,"utf8")):{};const q=process.env.SLPATH.includes(" ")?`"${process.env.SLPATH}"`:process.env.SLPATH;s.statusLine={type:"command",command:"node "+q};fs.writeFileSync(p,JSON.stringify(s,null,2));'
```

Replace the numbered explanation under it with:

```
This command:
1. Copies the status line shim into the plugin's persistent data directory
   (`plugins/data/claude-dashboard-claude-dashboard/`), which survives plugin updates
2. Points `statusLine` at that fixed path — it resolves the newest installed build on
   every render, so plugin updates need no further settings change
```

Replace the trailing `**IMPORTANT**` line with:

```
**Note**: After `/plugin update claude-dashboard`, the status line picks up the new version
automatically — no follow-up command is needed. Run `/claude-dashboard:update` only if you
have hooks disabled or the status line is not updating.
```

- [ ] **Step 2: Rewrite the update command**

Replace the body of `commands/update.md` below the frontmatter with:

```markdown
# Claude Dashboard Update

Ensure `statusLine` points at the version-agnostic shim. Normally unnecessary — a
`SessionStart` hook does this automatically. Use it when hooks are disabled, or to
diagnose a status line that is not updating.

## Task

1. Install or refresh the shim, then point settings.json at it:
```bash
CFGDIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"; SRC="$(ls -d "$CFGDIR"/plugins/cache/claude-dashboard/claude-dashboard/*/scripts/statusline-shim.mjs 2>/dev/null | sort -V | tail -1)"; DATADIR="$CFGDIR/plugins/data/claude-dashboard-claude-dashboard"; mkdir -p "$DATADIR" && cp "$SRC" "$DATADIR/statusline.mjs" && SLPATH="$DATADIR/statusline.mjs" CFGDIR="$CFGDIR" node -e 'const fs=require("fs"),p=process.env.CFGDIR+"/settings.json";const s=fs.existsSync(p)?JSON.parse(fs.readFileSync(p,"utf8")):{};const q=process.env.SLPATH.includes(" ")?`"${process.env.SLPATH}"`:process.env.SLPATH;s.statusLine={type:"command",command:"node "+q};fs.writeFileSync(p,JSON.stringify(s,null,2));'
```

2. Report which build the shim resolves to:
```bash
ls -d "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/plugins/cache/claude-dashboard/claude-dashboard/*/dist/index.js 2>/dev/null | sort -V | tail -1
```

3. Tell the user:
   - Whether settings.json changed or was already correct
   - Which build the shim currently resolves to
   - That a restart is needed only if settings.json changed

## Example Output

```
statusLine already points at the shim — no change needed.
Shim: ~/.claude/plugins/data/claude-dashboard-claude-dashboard/statusline.mjs
Resolves to: 1.31.1

Future plugin updates apply automatically.
```
```

Also update the frontmatter `description` to: `Repair or verify the statusLine shim (usually automatic)`.

- [ ] **Step 3: Verify the setup one-liner actually works**

Run the Step 1 bash block with `CLAUDE_CONFIG_DIR` pointed at a throwaway tree that contains a fake `.../<version>/scripts/statusline-shim.mjs`, and confirm `settings.json` ends up with the shim path and the data dir contains the copy.

- [ ] **Step 4: Commit**

```bash
git add commands/setup.md commands/update.md
git commit -m "docs: point setup and update commands at the statusline shim"
```

---

### Task 6: Documentation

**Files:**
- Modify: `README.md:219-231`
- Modify: `CLAUDE.md` (project structure tree + a note on the hook)
- Modify: `website/src/content/docs/troubleshooting.md`
- Modify: `website/src/content/docs/reference/commands.md`
- Modify: `website/src/content/docs/ko/troubleshooting.md`
- Modify: `website/src/content/docs/ko/reference/commands.md`

**Interfaces:**
- Consumes: the behavior established in Tasks 1–5.
- Produces: nothing importable.

- [ ] **Step 1: Update README**

At `README.md:219`, replace the `/claude-dashboard:update` description line with:

```markdown
Repair or verify the statusLine shim. Usually unnecessary — after `/plugin update`, the
status line picks up the new version on its own. Use this if you have hooks disabled or the
status line stops updating.
```

At `README.md:231`, replace step 2 with:

```markdown
2. Verify `settings.json` has a `statusLine` entry pointing at
   `plugins/data/claude-dashboard-claude-dashboard/statusline.mjs`
```

- [ ] **Step 2: Update CLAUDE.md**

Add to the project structure tree:

```
├── hooks/
│   ├── hooks.json           # SessionStart hook registration
│   └── ensure-statusline.mjs # Shim sync + settings migration
├── scripts/
│   ├── statusline-shim.mjs  # Version-agnostic entry point (copied to PLUGIN_DATA)
```

Add a row to the "패턴 / 참고 파일" table:

```
| 버전 무관 statusLine 진입점 | `scripts/statusline-shim.mjs`, `hooks/ensure-statusline.mjs` |
```

- [ ] **Step 3: Update the website docs (EN + KO)**

In both `troubleshooting.md` files: the "status line not updating" remedy is no longer "run
update then restart" but "restart once; if it persists, run `/claude-dashboard:update`".
State the expected `settings.json` value as the shim path.

In both `reference/commands.md` files: update the `/claude-dashboard:update` entry to match
the new description from Task 5, Step 2.

Keep the KO files in Korean and the EN files in English; do not translate one into the other.

- [ ] **Step 4: Verify the docs build**

Run: `npm test`
Expected: PASS (docs changes must not break the suite).

- [ ] **Step 5: Commit**

```bash
git add README.md CLAUDE.md website/
git commit -m "docs: describe automatic statusLine version pickup"
```

---

## Final verification

- [ ] `npm test` passes.
- [ ] `git log --oneline` shows six focused commits on `feat/version-agnostic-statusline`.
- [ ] Spec §9's open question is answered and the spec updated.
- [ ] Manual: fresh-install path (`/claude-dashboard:setup`) and upgrade path (pinned 1.31.x → hook migration) both produce a working status line.
