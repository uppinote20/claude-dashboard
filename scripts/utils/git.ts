/**
 * Git utilities - shared async git command execution
 * @handbook 3.3-widget-data-sources
 */

import { execFile } from 'child_process';

/**
 * Run git command asynchronously with timeout
 */
export function execGit(args: string[], cwd: string, timeout: number): Promise<string> {
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
 * Count total lines in untracked (new) files.
 * Pipes all content through a single `wc -l` to avoid xargs batching undercounts
 * (batched `xargs wc -l | tail -1` only captures the last batch's total).
 */
export function countUntrackedLines(cwd: string, timeout: number): Promise<number> {
  return new Promise((resolve) => {
    execFile(
      'sh',
      ['-c', "git --no-optional-locks ls-files --others --exclude-standard -z | xargs -0 cat 2>/dev/null | wc -l"],
      { cwd, encoding: 'utf-8', timeout },
      (_error, stdout) => {
        const match = stdout?.match(/(\d+)/);
        resolve(match ? parseInt(match[1], 10) : 0);
      },
    );
  });
}
