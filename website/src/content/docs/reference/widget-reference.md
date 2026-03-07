---
title: Widget Reference
description: Detailed data and behavior for each widget
sidebar:
  order: 2
---

This page provides detailed information about each widget, including its data source, what it displays, and example output.

## Core Widgets

### model

| Property | Value |
|----------|-------|
| **Widget ID** | `model` |
| **Data Source** | stdin (model info) + settings (effort/fast mode) |
| **Description** | Displays the current model name with emoji. Shows effort level for Opus/Sonnet (H/M/L) and fast mode indicator for Opus (↯). |

**Example output:**
```
Opus(H)
Sonnet(M)
Opus(H↯)
```

### context

| Property | Value |
|----------|-------|
| **Widget ID** | `context` |
| **Data Source** | stdin (context_window) |
| **Description** | Shows a progress bar, percentage, and token count for context window usage. Color changes by utilization: green 0-50%, yellow 51-80%, red 81-100%. |

**Example output:**
```
-------- 45% 90K
████---- 80% 160K
```

### cost

| Property | Value |
|----------|-------|
| **Widget ID** | `cost` |
| **Data Source** | stdin (cost) |
| **Description** | Shows the total session cost in USD. |

**Example output:**
```
$1.25
$0.03
```

### projectInfo

| Property | Value |
|----------|-------|
| **Widget ID** | `projectInfo` |
| **Data Source** | stdin (workspace) + git |
| **Description** | Shows the current directory name, git branch, and commits ahead/behind upstream. |

**Example output:**
```
📁 my-project (main)
📁 my-project (feature ↑3)
📁 my-project (main ↑2↓1)
```

## Rate Limit Widgets

### rateLimit5h

| Property | Value |
|----------|-------|
| **Widget ID** | `rateLimit5h` |
| **Data Source** | API (oauth/usage) |
| **Description** | Shows the 5-hour rate limit utilization percentage with reset countdown timer. Available on both Pro and Max plans. |

**Example output:**
```
5h: 42%
5h: 85% (1h23m)
```

### rateLimit7d

| Property | Value |
|----------|-------|
| **Widget ID** | `rateLimit7d` |
| **Data Source** | API (oauth/usage) |
| **Description** | Shows the 7-day rate limit utilization. Max plan only. |

**Example output:**
```
7d: 69%
```

### rateLimit7dSonnet

| Property | Value |
|----------|-------|
| **Widget ID** | `rateLimit7dSonnet` |
| **Data Source** | API (oauth/usage) |
| **Description** | Shows the 7-day Sonnet-specific rate limit utilization. Max plan only. |

**Example output:**
```
7dS: 23%
```

## Session Widgets

### sessionId

| Property | Value |
|----------|-------|
| **Widget ID** | `sessionId` |
| **Data Source** | stdin (session_id) |
| **Description** | Shows a short 8-character session identifier. |

**Example output:**
```
abc12345
```

### sessionIdFull

| Property | Value |
|----------|-------|
| **Widget ID** | `sessionIdFull` |
| **Data Source** | stdin (session_id) |
| **Description** | Shows the full UUID session identifier. |

**Example output:**
```
abc12345-6789-0def-ghij-klmnopqrstuv
```

### sessionDuration

| Property | Value |
|----------|-------|
| **Widget ID** | `sessionDuration` |
| **Data Source** | file (session tracking) |
| **Description** | Shows how long the current session has been running. |

**Example output:**
```
45m
1h23m
2h05m
```

### configCounts

| Property | Value |
|----------|-------|
| **Widget ID** | `configCounts` |
| **Data Source** | filesystem |
| **Description** | Counts and displays the number of CLAUDE.md files, rules, MCP servers, and hooks configured in the project. |

**Example output:**
```
CLAUDE.md: 2 | rules: 3 | MCPs: 1 | hooks: 0
```

## Activity Widgets

### toolActivity

| Property | Value |
|----------|-------|
| **Widget ID** | `toolActivity` |
| **Data Source** | transcript (JSONL) |
| **Description** | Shows the number of running and completed tool calls in the current session. |

**Example output:**
```
12 done
1 running, 8 done
```

### agentStatus

| Property | Value |
|----------|-------|
| **Widget ID** | `agentStatus` |
| **Data Source** | transcript (JSONL) |
| **Description** | Shows the number of active and completed subagents. |

**Example output:**
```
Agent: 1 active, 2 done
Agent: 3 done
```

### todoProgress

| Property | Value |
|----------|-------|
| **Widget ID** | `todoProgress` |
| **Data Source** | transcript (JSONL) |
| **Description** | Shows the completion rate of todo items tracked in the session. |

**Example output:**
```
3/5
5/5
```

## Analytics Widgets

### burnRate

| Property | Value |
|----------|-------|
| **Widget ID** | `burnRate` |
| **Data Source** | stdin (tokens) + session duration |
| **Description** | Calculates and displays the token consumption rate per minute based on session average. |

**Example output:**
```
5K/m
12K/m
```

### cacheHit

| Property | Value |
|----------|-------|
| **Widget ID** | `cacheHit` |
| **Data Source** | stdin (context_window.current_usage) |
| **Description** | Shows the percentage of input tokens served from cache. Higher values indicate better cache utilization. |

**Example output:**
```
85%
42%
```

### depletionTime

| Property | Value |
|----------|-------|
| **Widget ID** | `depletionTime` |
| **Data Source** | API (rate limits) + session duration |
| **Description** | Estimates the time remaining until a rate limit is reached, based on the current session consumption rate. The calculation assumes all current utilization came from this session, so accuracy improves as the session runs longer. |

**Example output:**
```
~2h (5h)
~45m (7d)
```

## Multi-CLI Widgets

### codexUsage

| Property | Value |
|----------|-------|
| **Widget ID** | `codexUsage` |
| **Data Source** | Codex API (ChatGPT backend) |
| **Description** | Shows OpenAI Codex CLI usage including model name and rate limit percentages. Auto-hides if `~/.codex/auth.json` is not found. |

**Example output:**
```
codex o4-mini 5h:30% 7d:45%
```

### geminiUsage

| Property | Value |
|----------|-------|
| **Widget ID** | `geminiUsage` |
| **Data Source** | Gemini API (Code Assist) |
| **Description** | Shows Google Gemini CLI usage for the current model only. Auto-hides if `~/.gemini/oauth_creds.json` is not found. |

**Example output:**
```
gemini 2.5-pro 60%
```

### geminiUsageAll

| Property | Value |
|----------|-------|
| **Widget ID** | `geminiUsageAll` |
| **Data Source** | Gemini API (Code Assist) |
| **Description** | Shows Google Gemini CLI usage across all model buckets. Auto-hides if `~/.gemini/oauth_creds.json` is not found. |

**Example output:**
```
gemini pro:60% flash:20%
```

### zaiUsage

| Property | Value |
|----------|-------|
| **Widget ID** | `zaiUsage` |
| **Data Source** | z.ai API |
| **Description** | Shows z.ai/ZHIPU GLM usage including 5-hour token usage and monthly MCP usage. Auto-hides if not detected via `ANTHROPIC_BASE_URL`. |

**Example output:**
```
GLM 5h:42% MCP:15%
```

## Insight Widgets

### tokenBreakdown

| Property | Value |
|----------|-------|
| **Widget ID** | `tokenBreakdown` |
| **Data Source** | stdin (context_window.current_usage) |
| **Description** | Shows a breakdown of token usage by type: input tokens, output tokens, cache write tokens, and cache read tokens. |

**Example output:**
```
In 30K · Out 8K · CW 5K · CR 20K
```

### performance

| Property | Value |
|----------|-------|
| **Widget ID** | `performance` |
| **Data Source** | stdin (tokens) + session duration |
| **Description** | Shows a composite efficiency score (0-100) based on cache hit rate and output token ratio. Higher scores indicate better efficiency. |

**Example output:**
```
72%
95%
```

### forecast

| Property | Value |
|----------|-------|
| **Widget ID** | `forecast` |
| **Data Source** | stdin (cost) + session duration |
| **Description** | Estimates the hourly cost based on the current session spending rate. |

**Example output:**
```
~$8/h
~$2/h
```

### budget

| Property | Value |
|----------|-------|
| **Widget ID** | `budget` |
| **Data Source** | stdin (cost) + file (budget config) |
| **Description** | Shows daily spending versus the configured budget limit. Requires `"dailyBudget"` in the config file. Shows a warning at 80% and critical alert at 95%. |

**Example output:**
```
$5/$15
$14/$15 !!
```
