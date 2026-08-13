#!/usr/bin/env node
/**
 * SessionStart hook: install/refresh the status line shim and migrate settings.json
 * off this plugin's version-pinned path.
 *
 * @handbook 4.8-version-agnostic-statusline
 * @tested scripts/__tests__/ensure-statusline.test.ts
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs';
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
  writeFileSync(dest, content);
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
