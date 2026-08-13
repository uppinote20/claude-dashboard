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
