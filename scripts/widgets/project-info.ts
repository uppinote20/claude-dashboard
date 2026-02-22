/**
 * Project info widget - displays directory name, git branch, and ahead/behind status
 */

import { execFile } from 'child_process';
import { basename } from 'path';
import type { Widget } from './base.js';
import type { WidgetContext, ProjectInfoData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';

/**
 * Run git command asynchronously with timeout
 */
function execGit(args: string[], cwd: string, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', ['--no-optional-locks', ...args], {
      cwd,
      encoding: 'utf-8',
      timeout,
    }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

/**
 * Get current git branch with timeout
 */
async function getGitBranch(cwd: string): Promise<string | undefined> {
  try {
    const result = await execGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd, 500);
    return result.trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Check if git working directory has uncommitted changes
 */
async function isGitDirty(cwd: string): Promise<boolean> {
  try {
    const result = await execGit(['status', '--porcelain'], cwd, 1000);
    return result.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Get ahead/behind counts relative to upstream
 * Returns { ahead, behind } or null if no upstream
 */
async function getAheadBehind(cwd: string): Promise<{ ahead: number; behind: number } | null> {
  try {
    const result = await execGit(['rev-list', '--left-right', '--count', '@{u}...HEAD'], cwd, 500);
    const parts = result.trim().split(/\s+/);
    if (parts.length === 2) {
      return {
        behind: parseInt(parts[0], 10) || 0,
        ahead: parseInt(parts[1], 10) || 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export const projectInfoWidget: Widget<ProjectInfoData> = {
  id: 'projectInfo',
  name: 'Project Info',

  async getData(ctx: WidgetContext): Promise<ProjectInfoData | null> {
    const currentDir = ctx.stdin.workspace?.current_dir;
    if (!currentDir) {
      return null;
    }

    const dirName = basename(currentDir);

    // Run all git calls in parallel to reduce latency (~2s → ~1s)
    const [branch, dirty, ab] = await Promise.all([
      getGitBranch(currentDir),
      isGitDirty(currentDir),
      getAheadBehind(currentDir),
    ]);

    let gitBranch: string | undefined;
    let ahead: number | undefined;
    let behind: number | undefined;

    if (branch) {
      gitBranch = dirty ? `${branch}*` : branch;

      if (ab) {
        ahead = ab.ahead;
        behind = ab.behind;
      }
    }

    return {
      dirName,
      gitBranch,
      ahead,
      behind,
    };
  },

  render(data: ProjectInfoData): string {
    const theme = getTheme();
    const parts: string[] = [];

    // Directory name with folder icon
    parts.push(colorize(`📁 ${data.dirName}`, theme.folder));

    // Git branch in parentheses with ahead/behind indicators
    if (data.gitBranch) {
      let branchStr = data.gitBranch;

      const aheadStr = (data.ahead ?? 0) > 0 ? `↑${data.ahead}` : '';
      const behindStr = (data.behind ?? 0) > 0 ? `↓${data.behind}` : '';
      const indicators = `${aheadStr}${behindStr}`;

      if (indicators) {
        branchStr += ` ${indicators}`;
      }

      parts.push(colorize(`(${branchStr})`, theme.branch));
    }

    return parts.join(' ');
  },
};
