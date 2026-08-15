#!/usr/bin/env node
/**
 * SessionStart hook: install/refresh the status line shim and migrate settings.json
 * off this plugin's version-pinned path.
 *
 * @handbook 4.8-version-agnostic-statusline
 * @tested scripts/__tests__/ensure-statusline.test.ts
 */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  realpathSync,
  statSync,
  unlinkSync,
  chmodSync,
} from 'fs';
import path from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

// Deliberately not exported: the tests pin this filename as a literal instead, because it
// is a published contract — commands/setup.md writes the same string by hand and users'
// settings.json points at it. A test importing this constant would keep passing if the
// value changed while the doc snippet did not.
const SHIM_FILENAME = 'statusline.mjs';

/**
 * Write to a temp file and rename, so a reader never sees a half-written file: a status
 * line render in another session may load the shim at this instant, and a crashed write
 * must not truncate settings.json. The temp name carries the pid so concurrent
 * SessionStart hooks — several sessions launching at once, e.g. after a restart — don't
 * interleave writes to one shared temp path.
 *
 * When `mode` is given it is applied twice on purpose: writeFileSync's option is
 * umask-filtered and only approximates the requested mode, so chmodSync afterward makes
 * it exact. That chmod is best-effort — failing to restore permissions must not abort the
 * write it was decorating.
 */
function atomicWrite(target, content, mode) {
  const tmp = `${target}.${process.pid}.tmp`;
  try {
    writeFileSync(tmp, content, mode === undefined ? {} : { mode });
    if (mode !== undefined) {
      try {
        chmodSync(tmp, mode);
      } catch {
        // Best-effort; see above.
      }
    }
    renameSync(tmp, target);
  } catch (err) {
    try {
      unlinkSync(tmp);
    } catch {
      // Best-effort cleanup; the original error is what matters.
    }
    throw err;
  }
}

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
  atomicWrite(dest, content);
  return dest;
}

/**
 * Matches only this plugin's version-pinned command. Three branches, not a blanket wildcard,
 * to avoid swallowing flags (`--inspect`) or wrapper arguments (`my-wrapper.js`):
 * - Double-quoted path (can contain spaces, typical Windows)
 * - Single-quoted path (can contain spaces)
 * - Unquoted path (no spaces allowed, just non-whitespace before the pinned path tail)
 * Any other form — flags, arguments, wrappers — leaves the command alone.
 */
const PINNED_TAIL = String.raw`[/\\]plugins[/\\]cache[/\\]claude-dashboard[/\\]claude-dashboard[/\\]\d+\.\d+\.\d+[/\\]dist[/\\]index\.js`;
const PINNED_COMMAND = new RegExp(
  `^\\s*node\\s+(?:"[^"]*${PINNED_TAIL}"|'[^']*${PINNED_TAIL}'|(?!["'])\\S*${PINNED_TAIL})\\s*$`
);

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

  // Resolve the real file before writing: settingsPath may traverse a symlink (a
  // dotfiles-managed ~/.claude/settings.json), and the backup + rewrite must land on the
  // file the symlink actually points at, not replace the symlink with a plain copy.
  // (The existsSync check above already returned for a missing file, so settingsPath is
  // known to exist here.)
  const target = realpathSync(settingsPath);
  // The mode is preserved explicitly so a deliberately-restricted settings.json (env
  // secrets, apiKeyHelper) doesn't widen on migration, and the .bak copy stays exactly as
  // private as the source it was copied from. atomicWrite applies it; see there for why
  // that takes both a writeFileSync option and a follow-up chmod.
  const mode = statSync(target).mode;

  // Atomic here too, not just tidiness: the `!existsSync` guard means a backup truncated
  // by a crashed write would be mistaken for a good one and never rewritten, losing the
  // original for good.
  const backup = `${target}.bak`;
  if (!existsSync(backup)) atomicWrite(backup, raw, mode);

  // Quote unconditionally: a space-only check misses shell metacharacters (e.g. a config
  // dir at `/home/user(a)/.claude`), which `sh` then fails to parse since statusLine.command
  // is shell-evaluated. JSON.stringify always quotes and correctly escapes embedded quotes
  // and backslashes too.
  settings.statusLine.command = `node ${JSON.stringify(shimPath)}`;

  // JSON.stringify(settings, null, 2) reformats the whole file to 2-space indentation —
  // a hand-maintained settings.json with different spacing gets rewritten to match. This
  // is an accepted trade-off; the `.bak` above preserves the original exactly.
  atomicWrite(target, `${JSON.stringify(settings, null, 2)}\n`, mode);
  return 'migrated';
}

// Guarded so the test suite can import the functions without running the hook.
// Realpath comparison: settingsPath.command may traverse a symlinked config dir
// (`~/.claude` -> dotfiles repo), which Node's ESM loader resolves for import.meta.url
// while argv keeps the literal path. Never throws: a missing/unreadable argv path must
// not crash a hook that must never block session start.
function isInvokedDirectly() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(path.resolve(process.argv[1])) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isInvokedDirectly()) {
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
