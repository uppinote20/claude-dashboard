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
