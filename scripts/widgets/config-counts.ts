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

/** Filesystem-only counts (addedDirs excluded — comes from stdin) */
type FsCountsData = Omit<ConfigCountsData, 'addedDirs'>;

const EMPTY_FS_COUNTS: FsCountsData = { claudeMd: 0, agentsMd: 0, rules: 0, mcps: 0, hooks: 0 };

let configCountsCache: {
  projectDir: string;
  data: FsCountsData | null;
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
 * Count AGENTS.md files (project root and .claude/agents/)
 */
async function countAgentsMd(projectDir: string): Promise<number> {
  const [root, agentFiles] = await Promise.all([
    fileExists(join(projectDir, 'AGENTS.md')),
    countFiles(join(projectDir, '.claude', 'agents'), /\.md$/),
  ]);
  return (root ? 1 : 0) + agentFiles;
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

    // addedDirs comes from stdin (always fresh), not filesystem
    const addedDirs = ctx.stdin.workspace?.added_dirs?.length ?? 0;

    // Check TTL-based cache for filesystem counts
    if (
      configCountsCache?.projectDir === currentDir &&
      Date.now() - configCountsCache.timestamp < CONFIG_CACHE_TTL_MS
    ) {
      if (!configCountsCache.data && addedDirs === 0) return null;
      const fsData = configCountsCache.data ?? EMPTY_FS_COUNTS;
      return { ...fsData, addedDirs };
    }

    const claudeDir = join(currentDir, '.claude');

    // Count all filesystem configs in parallel
    const [claudeMd, agentsMd, rules, mcps, hooks] = await Promise.all([
      countClaudeMd(currentDir),
      countAgentsMd(currentDir),
      countFiles(join(claudeDir, 'rules')),
      countMcps(currentDir),
      countFiles(join(claudeDir, 'hooks')),
    ]);

    // Cache filesystem counts only (addedDirs is always live from stdin)
    const fsData =
      claudeMd === 0 && agentsMd === 0 && rules === 0 && mcps === 0 && hooks === 0
        ? null
        : { claudeMd, agentsMd, rules, mcps, hooks };

    configCountsCache = { projectDir: currentDir, data: fsData, timestamp: Date.now() };

    if (!fsData && addedDirs === 0) return null;
    return { ...(fsData ?? EMPTY_FS_COUNTS), addedDirs };
  },

  render(data: ConfigCountsData, ctx: WidgetContext): string {
    const { translations: t } = ctx;
    const parts: string[] = [];

    if (data.claudeMd > 0) {
      parts.push(`${t.widgets.claudeMd}: ${data.claudeMd}`);
    }
    if (data.agentsMd > 0) {
      parts.push(`${t.widgets.agentsMd}: ${data.agentsMd}`);
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
    if (data.addedDirs > 0) {
      parts.push(`${t.widgets.addedDirs}: ${data.addedDirs}`);
    }

    return colorize(parts.join(', '), getTheme().secondary);
  },
};
