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

  // Temp file + rename: a status line render firing in another session at this instant
  // must never load a truncated shim mid-write.
  const tmp = `${dest}.${process.pid}.tmp`;
  try {
    writeFileSync(tmp, content);
    renameSync(tmp, dest);
  } catch (err) {
    try {
      unlinkSync(tmp);
    } catch {
      // Best-effort cleanup; the original error is what matters.
    }
    throw err;
  }
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
  const target = existsSync(settingsPath) ? realpathSync(settingsPath) : settingsPath;
  // The mode is preserved explicitly so a deliberately-restricted settings.json (env
  // secrets, apiKeyHelper) doesn't widen on migration, and the .bak copy stays exactly as
  // private as the source it was copied from. writeFileSync's `mode` option is
  // umask-filtered, so it only approximates the source mode — chmodSync afterward makes it
  // exact. Best-effort: a chmod failure must not abort the migration.
  const mode = statSync(target).mode;

  const backup = `${target}.bak`;
  if (!existsSync(backup)) {
    writeFileSync(backup, raw, { mode });
    try {
      chmodSync(backup, mode);
    } catch {
      // Best-effort; see comment above.
    }
  }

  const quoted = shimPath.includes(' ') ? `"${shimPath}"` : shimPath;
  settings.statusLine.command = `node ${quoted}`;

  // Temp file + rename: a crashed write must not leave a truncated settings.json. A
  // per-process temp name keeps concurrent SessionStart hooks (several sessions launching
  // at once, e.g. after a restart) from interleaving writes to a shared temp file.
  const tmp = `${target}.${process.pid}.tmp`;
  try {
    writeFileSync(tmp, `${JSON.stringify(settings, null, 2)}\n`, { mode });
    try {
      chmodSync(tmp, mode);
    } catch {
      // Best-effort; see comment above.
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

const invokedDirectly = isInvokedDirectly();

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
