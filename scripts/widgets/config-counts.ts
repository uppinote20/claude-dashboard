/**
 * Config counts widget - displays counts of CLAUDE.md, rules, MCPs, hooks
 */

import { readdir, access } from 'fs/promises';
import { join } from 'path';
import { constants } from 'fs';
import type { Widget } from './base.js';
import type { WidgetContext, ConfigCountsData } from '../types.js';
import { COLORS, colorize } from '../utils/colors.js';

/**
 * Check if a path exists
 */
async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

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
 * Count CLAUDE.md files (project root and .claude/)
 */
async function countClaudeMd(projectDir: string): Promise<number> {
  let count = 0;

  // Check root CLAUDE.md
  if (await pathExists(join(projectDir, 'CLAUDE.md'))) {
    count++;
  }

  // Check .claude/CLAUDE.md
  if (await pathExists(join(projectDir, '.claude', 'CLAUDE.md'))) {
    count++;
  }

  return count;
}

/**
 * Count MCP server configurations from project and global configs
 */
async function countMcps(projectDir: string): Promise<number> {
  const { readFile } = await import('fs/promises');
  const homeDir = process.env.HOME || '';

  // Check multiple MCP config locations
  const mcpPaths = [
    { path: join(projectDir, '.claude', 'mcp.json'), key: 'mcpServers' },
    { path: join(homeDir, '.claude.json'), key: 'mcpServers' },
    { path: join(homeDir, '.config', 'claude-code', 'mcp.json'), key: 'mcpServers' },
  ];

  let totalCount = 0;

  for (const { path, key } of mcpPaths) {
    if (await pathExists(path)) {
      try {
        const content = await readFile(path, 'utf-8');
        const config = JSON.parse(content);
        totalCount += Object.keys(config[key] || {}).length;
      } catch {
        // Parsing failed, skip this file
      }
    }
  }

  return totalCount;
}

export const configCountsWidget: Widget<ConfigCountsData> = {
  id: 'configCounts',
  name: 'Config Counts',

  async getData(ctx: WidgetContext): Promise<ConfigCountsData | null> {
    const currentDir = ctx.stdin.workspace?.current_dir;
    if (!currentDir) {
      return null;
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
    if (claudeMd === 0 && rules === 0 && mcps === 0 && hooks === 0) {
      return null;
    }

    return { claudeMd, rules, mcps, hooks };
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

    return colorize(parts.join(', '), COLORS.dim);
  },
};
