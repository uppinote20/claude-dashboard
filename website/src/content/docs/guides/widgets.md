---
title: Widgets
description: Complete list of available widgets
sidebar:
  order: 2
---

claude-dashboard provides 32 widgets organized by category. Each widget can be individually enabled, disabled, or rearranged in your layout.

## Core

| Widget | Description |
|--------|-------------|
| `model` | Model name with emoji, effort level for Opus/Sonnet (H/M/L), fast mode for Opus (↯) |
| `context` | Progress bar, percentage, tokens (green 0-50% / yellow 51-80% / red 81-100%) |
| `cost` | Session cost in USD |
| `projectInfo` | Directory + git branch (clickable OSC8 link) + ahead/behind (↑↓), subpath when CWD differs from project root, worktree indicator (🌳) |

## Rate Limits

| Widget | Description |
|--------|-------------|
| `rateLimit5h` | 5-hour rate limit with reset countdown |
| `rateLimit7d` | 7-day rate limit (Max plan only) |
| `rateLimit7dSonnet` | 7-day Sonnet limit (Max plan only) |

## Session

| Widget | Description |
|--------|-------------|
| `sessionId` | Session ID (short 8-char) |
| `sessionIdFull` | Session ID (full UUID) |
| `sessionName` | Session name from /rename command |
| `sessionDuration` | Session duration |
| `lastPrompt` | Last user prompt with timestamp |
| `configCounts` | CLAUDE.md, AGENTS.md, rules, MCPs, hooks, +Dirs |

## Activity

| Widget | Description |
|--------|-------------|
| `toolActivity` | Running/completed tools with target display (e.g., `Read(app.ts)`, `Bash(npm test)`) |
| `agentStatus` | Subagent progress |
| `todoProgress` | Todo completion rate |

## Analytics

| Widget | Description |
|--------|-------------|
| `burnRate` | Token consumption per minute |
| `tokenSpeed` | Output token generation speed (e.g., `67 tok/s`) |
| `cacheHit` | Cache hit rate percentage |
| `depletionTime` | Estimated time to rate limit (approx) [1] |

## Multi-CLI

| Widget | Description |
|--------|-------------|
| `codexUsage` | OpenAI Codex CLI usage (auto-hide if not installed) [2] |
| `geminiUsage` | Google Gemini CLI - current model (auto-hide if not installed) [3] |
| `geminiUsageAll` | Google Gemini CLI - all models (auto-hide if not installed) [3] |
| `zaiUsage` | z.ai/ZHIPU usage (auto-hide if not using z.ai) [4] |

## Insights

| Widget | Description |
|--------|-------------|
| `tokenBreakdown` | Input/output/cache write/read token breakdown |
| `performance` | Composite efficiency badge (cache hit + output ratio) |
| `forecast` | Estimated hourly cost based on session rate |
| `budget` | Daily spending vs configured budget limit [5] |
| `todayCost` | Total spending across all sessions today |

## Info

| Widget | Description |
|--------|-------------|
| `version` | Claude Code version display |
| `linesChanged` | Lines added/removed count, including untracked files (e.g., `+156 -23`) |
| `outputStyle` | Current output style (hidden when default) |
| `vimMode` | Vim mode (NORMAL/INSERT), auto-hides when vim disabled |
| `apiDuration` | API time as % of total session time |

## Status

| Widget | Description |
|--------|-------------|
| `peakHours` | Peak hours indicator with countdown ([based on PeakClaude](https://github.com/pforret/PeakClaude))[6] |

## Notes

1. **depletionTime** assumes all utilization came from the current session; accuracy improves as the session runs longer.
2. **codexUsage** auto-hides if `~/.codex/auth.json` is not found.
3. **geminiUsage** and **geminiUsageAll** auto-hide if `~/.gemini/oauth_creds.json` is not found.
4. **zaiUsage** auto-hides if not detected via `ANTHROPIC_BASE_URL`.
5. **budget** requires `"dailyBudget"` to be set in the configuration file.
6. **peakHours** peak = weekdays 5-11 AM PT; shows countdown to next transition.

## Language Support

All widget labels support English and Korean. The language is auto-detected from your system or can be set explicitly via the setup command.
