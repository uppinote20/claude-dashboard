---
title: Widgets
description: Complete list of available widgets
sidebar:
  order: 2
---

claude-dashboard provides 25+ widgets organized by category. Each widget can be individually enabled, disabled, or rearranged in your layout.

## Core

| Widget | Description |
|--------|-------------|
| `model` | Model name with emoji, effort level for Opus/Sonnet (H/M/L), fast mode for Opus (↯) |
| `context` | Progress bar, percentage, tokens (green 0-50% / yellow 51-80% / red 81-100%) |
| `cost` | Session cost in USD |
| `projectInfo` | Directory + git branch + ahead/behind (up/down arrows) |

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
| `sessionDuration` | Session duration |
| `configCounts` | CLAUDE.md, rules, MCPs, hooks |

## Activity

| Widget | Description |
|--------|-------------|
| `toolActivity` | Running/completed tools |
| `agentStatus` | Subagent progress |
| `todoProgress` | Todo completion rate |

## Analytics

| Widget | Description |
|--------|-------------|
| `burnRate` | Token consumption per minute |
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

## Notes

1. **depletionTime** assumes all utilization came from the current session; accuracy improves as the session runs longer.
2. **codexUsage** auto-hides if `~/.codex/auth.json` is not found.
3. **geminiUsage** and **geminiUsageAll** auto-hide if `~/.gemini/oauth_creds.json` is not found.
4. **zaiUsage** auto-hides if not detected via `ANTHROPIC_BASE_URL`.
5. **budget** requires `"dailyBudget"` to be set in the configuration file.

## Language Support

All widget labels support English and Korean. The language is auto-detected from your system or can be set explicitly via the setup command.
