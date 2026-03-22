/**
 * Config counts widget - displays counts of CLAUDE.md, rules, MCPs, hooks
 * @handbook 3.3-widget-data-sources
 * @tested scripts/__tests__/widgets.test.ts
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import type { Widget } from './base.js';
import type { WidgetContext, ConfigCountsData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';

/**
 * Cache TTL for config counts (30 seconds)
 * Config files rarely change during active development
 */
const CONFIG_CACHE_TTL_MS = 30_000;

/**
 * Cached config counts keyed by project directory
 */
let configCountsCache: {
  projectDir: string;
  data: ConfigCountsData | null;
  timestamp: number;
} | null = null;

/**
 * Count files in a directory matching a pattern
 */
async function countFiles(dir: string, pattern?: RegExp): Promise<number> {
  try {
    const files = await readdir(dir);
    if (pattern) {
      return files.filter((f) => pattern.test(f)).length;
    }
    return files.length;
  } catch {
    return 0;
  }
}

/**
 * Check if a file exists via stat (metadata-only syscall).
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Count CLAUDE.md files (project root and .claude/)
 */
async function countClaudeMd(projectDir: string): Promise<number> {
  const [root, nested] = await Promise.all([
    fileExists(join(projectDir, 'CLAUDE.md')),
    fileExists(join(projectDir, '.claude', 'CLAUDE.md')),
  ]);
  return (root ? 1 : 0) + (nested ? 1 : 0);
}

/**
 * Count MCP server configurations from project and global configs.
 * Reads files directly and catches ENOENT (no TOCTOU).
 */
async function countMcps(projectDir: string): Promise<number> {
  const homeDir = process.env.HOME || '';

  const mcpPaths = [
    { path: join(projectDir, '.claude', 'mcp.json'), key: 'mcpServers' },
    { path: join(homeDir, '.claude.json'), key: 'mcpServers' },
    { path: join(homeDir, '.config', 'claude-code', 'mcp.json'), key: 'mcpServers' },
  ];

  const counts = await Promise.all(
    mcpPaths.map(async ({ path, key }) => {
      try {
        const content = await readFile(path, 'utf-8');
        const config = JSON.parse(content);
        return Object.keys(config[key] || {}).length;
      } catch {
        return 0;
      }
    })
  );

  return counts.reduce((a, b) => a + b, 0);
}

export const configCountsWidget: Widget<ConfigCountsData> = {
  id: 'configCounts',
  name: 'Config Counts',

  async getData(ctx: WidgetContext): Promise<ConfigCountsData | null> {
    const currentDir = ctx.stdin.workspace?.current_dir;
    if (!currentDir) {
      return null;
    }

    // Check TTL-based cache
    if (
      configCountsCache?.projectDir === currentDir &&
      Date.now() - configCountsCache.timestamp < CONFIG_CACHE_TTL_MS
    ) {
      return configCountsCache.data;
    }

    const claudeDir = join(currentDir, '.claude');

    // Count all configs in parallel
    const [claudeMd, rules, mcps, hooks] = await Promise.all([
      countClaudeMd(currentDir),
      countFiles(join(claudeDir, 'rules')),
      countMcps(currentDir),
      countFiles(join(claudeDir, 'hooks')),
    ]);

    // Only show if there's something to display
    const data =
      claudeMd === 0 && rules === 0 && mcps === 0 && hooks === 0
        ? null
        : { claudeMd, rules, mcps, hooks };

    // Cache result
    configCountsCache = { projectDir: currentDir, data, timestamp: Date.now() };

    return data;
  },

  render(data: ConfigCountsData, ctx: WidgetContext): string {
    const { translations: t } = ctx;
    const parts: string[] = [];

    if (data.claudeMd > 0) {
      parts.push(`${t.widgets.claudeMd}: ${data.claudeMd}`);
    }
    if (data.rules > 0) {
      parts.push(`${t.widgets.rules}: ${data.rules}`);
    }
    if (data.mcps > 0) {
      parts.push(`${t.widgets.mcps}: ${data.mcps}`);
    }
    if (data.hooks > 0) {
      parts.push(`${t.widgets.hooks}: ${data.hooks}`);
    }

    return colorize(parts.join(', '), getTheme().secondary);
  },
};
