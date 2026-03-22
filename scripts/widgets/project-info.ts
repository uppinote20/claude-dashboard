/**
 * Project info widget - displays directory name, git branch, and ahead/behind status
 * @handbook 3.3-widget-data-sources
 * @tested scripts/__tests__/widgets.test.ts
 */

import { basename, relative } from 'path';
import type { Widget } from './base.js';
import type { WidgetContext, ProjectInfoData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';
import { osc8Link } from '../utils/formatters.js';
import { execGit } from '../utils/git.js';

/**
 * TTL-based cache for git data (5 seconds).
 * Branch/remote rarely change; dirty status is the most volatile.
 */
const GIT_CACHE_TTL_MS = 5_000;

let gitCache: {
  cwd: string;
  data: { branch?: string; dirty: boolean; ab: { ahead: number; behind: number } | null; remoteUrl?: string };
  timestamp: number;
} | null = null;

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

/**
 * Get git remote origin URL
 */
async function getGitRemoteUrl(cwd: string): Promise<string | undefined> {
  try {
    const result = await execGit(['remote', 'get-url', 'origin'], cwd, 500);
    return normalizeGitUrl(result.trim()) || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Normalize git remote URL to HTTPS web URL.
 * - git@github.com:user/repo.git   → https://github.com/user/repo
 * - ssh://git@github.com/user/repo → https://github.com/user/repo
 * - https://github.com/user/repo.git → https://github.com/user/repo
 */
function normalizeGitUrl(url: string): string | null {
  // SSH: git@host:path or ssh://git@host/path
  const sshMatch = url.match(/^(?:ssh:\/\/)?git@([^:/]+)[:/](.+?)(?:\.git)?$/);
  if (sshMatch) return `https://${sshMatch[1]}/${sshMatch[2]}`;

  // HTTPS: strip .git suffix and userinfo (user:token@)
  const httpsMatch = url.match(/^https?:\/\/(?:[^@/]+@)?(.+?)(?:\.git)?$/);
  if (httpsMatch) return `https://${httpsMatch[1]}`;

  return null;
}

/**
 * Get all git data with TTL cache to avoid spawning 4 subprocesses per render.
 */
async function getGitData(cwd: string) {
  if (gitCache && gitCache.cwd === cwd && Date.now() - gitCache.timestamp < GIT_CACHE_TTL_MS) {
    return gitCache.data;
  }

  const [branch, dirty, ab, remoteUrl] = await Promise.all([
    getGitBranch(cwd),
    isGitDirty(cwd),
    getAheadBehind(cwd),
    getGitRemoteUrl(cwd),
  ]);

  const data = { branch, dirty, ab, remoteUrl };
  gitCache = { cwd, data, timestamp: Date.now() };
  return data;
}

export const projectInfoWidget: Widget<ProjectInfoData> = {
  id: 'projectInfo',
  name: 'Project Info',

  async getData(ctx: WidgetContext): Promise<ProjectInfoData | null> {
    const currentDir = ctx.stdin.workspace?.current_dir;
    if (!currentDir) {
      return null;
    }

    const projectDir = ctx.stdin.workspace?.project_dir;

    // Use project_dir for display name when available
    const dirName = basename(projectDir || currentDir);

    // Compute relative subpath when CWD differs from project root
    const subPath = (projectDir && currentDir !== projectDir && currentDir.startsWith(projectDir + '/'))
      ? relative(projectDir, currentDir)
      : undefined;

    // Worktree name (only present in --worktree sessions)
    const worktreeName = ctx.stdin.worktree?.name || undefined;

    const { branch, dirty, ab, remoteUrl } = await getGitData(currentDir);

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
      subPath,
      worktreeName,
      remoteUrl: remoteUrl && branch
        ? `${remoteUrl}/tree/${branch.split('/').map(encodeURIComponent).join('/')}`
        : undefined,
    };
  },

  render(data: ProjectInfoData, _ctx: WidgetContext): string {
    const theme = getTheme();
    const parts: string[] = [];

    // Directory name with folder icon, and subpath when CWD differs from project root
    const dirDisplay = data.subPath
      ? `📁 ${data.dirName} (${data.subPath})`
      : `📁 ${data.dirName}`;
    parts.push(colorize(dirDisplay, theme.folder));

    // Git branch in parentheses with ahead/behind indicators
    if (data.gitBranch) {
      let branchStr = data.gitBranch;

      const aheadStr = (data.ahead ?? 0) > 0 ? `↑${data.ahead}` : '';
      const behindStr = (data.behind ?? 0) > 0 ? `↓${data.behind}` : '';
      const indicators = `${aheadStr}${behindStr}`;

      if (indicators) {
        branchStr += ` ${indicators}`;
      }

      // Apply OSC8 hyperlink when remote URL is available
      const branchDisplay = data.remoteUrl
        ? `(${osc8Link(data.remoteUrl, branchStr)})`
        : `(${branchStr})`;
      parts.push(colorize(branchDisplay, theme.branch));
    }

    // Worktree indicator (only in --worktree sessions)
    if (data.worktreeName) {
      parts.push(colorize(`🌳 wt:${data.worktreeName}`, theme.info));
    }

    return parts.join(' ');
  },
};
