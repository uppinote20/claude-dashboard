/**
 * Claude Code configuration directory resolution
 * @handbook 3.3-widget-data-sources
 * @tested scripts/__tests__/config-dir.test.ts
 */
import { join } from 'path';
import { homedir } from 'os';

/**
 * Resolve Claude Code's configuration directory.
 *
 * When CLAUDE_CONFIG_DIR is set, Claude Code reads `.credentials.json`,
 * `settings.json`, and `history.jsonl` from there and does not fall back to
 * ~/.claude. Mirror that so the statusline reports the account rendering it
 * rather than whichever account happens to own ~/.claude.
 *
 * `||` rather than `??`: an empty CLAUDE_CONFIG_DIR must not resolve to a
 * CWD-relative path.
 */
export function getClaudeConfigDir(): string {
  return process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
}

/**
 * Resolve the global `.claude.json` (holds top-level MCP servers).
 *
 * Its default lives beside ~/.claude at `$HOME/.claude.json`, but with
 * CLAUDE_CONFIG_DIR set it moves *inside* that directory — so it can't reuse
 * getClaudeConfigDir(), which would otherwise point at ~/.claude/.claude.json.
 */
export function getClaudeJsonPath(): string {
  const configDir = process.env.CLAUDE_CONFIG_DIR;
  return configDir ? join(configDir, '.claude.json') : join(homedir(), '.claude.json');
}
