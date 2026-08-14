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
import { readdirSync, existsSync, realpathSync } from 'fs';
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
    candidates.push({
      version: [Number(match[1]), Number(match[2]), Number(match[3])],
      name: entry.name,
    });
  }

  candidates.sort(
    (a, b) =>
      b.version[0] - a.version[0] ||
      b.version[1] - a.version[1] ||
      b.version[2] - a.version[2]
  );

  // Sort first, then probe newest-first and stop at the first hit. Sorting is in-memory
  // while existsSync is a syscall, and this runs on every render — filtering before
  // sorting would stat every version dir, and Claude Code never prunes old ones, so that
  // cost would grow with each release installed rather than staying at one.
  for (const { name } of candidates) {
    const dist = path.join(cacheRoot, name, 'dist', 'index.js');
    if (existsSync(dist)) return dist;
  }
  return null;
}

/**
 * True when this file was invoked directly as the process entry point (not merely
 * imported by a test). Guarded against symlinks: settings.json can hold a path that
 * traverses a symlinked config dir (`~/.claude` -> dotfiles repo), which Node's ESM
 * loader resolves via realpath while argv keeps the literal path — compare realpaths on
 * both sides rather than the literal one. Never throws: a missing or unreadable argv
 * path must not crash a script whose whole contract is to fail silently.
 */
function isInvokedDirectly() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(path.resolve(process.argv[1])) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isInvokedDirectly()) {
  const target = resolveLatestDist(deriveCacheRoot(import.meta.url));
  // Silent exit: a warning here would print on every single render.
  if (target) {
    try {
      await import(pathToFileURL(target).href);
    } catch {
      // Module evaluation failed or threw. Silent exit to prevent render spam.
    }
  }
}
