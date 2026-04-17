---
title: Config Schema
description: Configuration file JSON schema reference
sidebar:
  order: 3
---

The configuration file is located at `~/.claude/claude-dashboard.local.json`. This page documents every field in the `Config` interface.

## Config Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `language` | `"en" \| "ko" \| "auto"` | `"auto"` | UI language. `"auto"` detects from system locale. |
| `plan` | `"pro" \| "max"` | `"max"` | Subscription plan. Affects which rate limit widgets are available. |
| `displayMode` | `DisplayMode` | `"compact"` | Display preset or `"custom"` for manual layout. |
| `lines` | `WidgetId[][]` | -- | Custom line configuration. Only used when `displayMode` is `"custom"`. Each inner array represents one line of widgets. |
| `disabledWidgets` | `WidgetId[]` | `[]` | Widget IDs to hide from any display mode. Empty lines after filtering are automatically removed. |
| `theme` | `ThemeId` | `"default"` | Color theme for the status line. |
| `separator` | `SeparatorStyle` | `"pipe"` | Character used between widgets on the same line. |
| `preset` | `string` | -- | Preset shorthand string for quick layout. When set, overrides `displayMode` with `"custom"` and generates `lines` from the string. |
| `dailyBudget` | `number` | -- | Daily budget limit in USD. Enables the `budget` widget. |
| `tagPatterns` | `string[]` | `["v*"]` | Glob patterns for the `tagStatus` widget. Each pattern resolves to at most one tag (the most recent reachable from HEAD). Widget hides when no pattern matches a tag. |
| `cache` | `{ ttlSeconds: number }` | `{ ttlSeconds: 300 }` | Cache settings. `ttlSeconds` controls how long API responses are cached. |

## DisplayMode

```typescript
type DisplayMode = 'compact' | 'normal' | 'detailed' | 'custom';
```

| Value | Lines | Description |
|-------|-------|-------------|
| `compact` | 1 | Essential metrics only |
| `normal` | 2 | Adds project/session info |
| `detailed` | 6 | All widgets |
| `custom` | variable | User-defined layout via `lines` or `preset` |

## ThemeId

```typescript
type ThemeId = 'default' | 'minimal' | 'catppuccin' | 'catppuccinLatte'
             | 'dracula' | 'gruvbox' | 'nord' | 'tokyoNight' | 'solarized';
```

| Value | Style |
|-------|-------|
| `default` | Pastel colors (cyan, yellow, pink, green) |
| `minimal` | Monochrome (white + gray) |
| `catppuccin` | Catppuccin Mocha palette |
| `catppuccinLatte` | Catppuccin Latte palette (light-mode terminals) |
| `dracula` | Dracula palette |
| `gruvbox` | Gruvbox palette |
| `nord` | Nord polar night/frost palette |
| `tokyoNight` | Tokyo Night blue/purple palette |
| `solarized` | Solarized dark palette |

## SeparatorStyle

```typescript
type SeparatorStyle = 'pipe' | 'space' | 'dot' | 'arrow';
```

| Value | Character | Example |
|-------|-----------|---------|
| `pipe` | `\|` | `Model \| Context \| Cost` |
| `space` | ` ` | `Model  Context  Cost` |
| `dot` | `·` | `Model · Context · Cost` |
| `arrow` | `›` | `Model › Context › Cost` |

## WidgetId

```typescript
type WidgetId =
  | 'model' | 'context' | 'contextBar' | 'contextPercentage' | 'contextUsage' | 'cost'
  | 'rateLimit5h' | 'rateLimit7d' | 'rateLimit7dSonnet'
  | 'projectInfo' | 'configCounts'
  | 'sessionDuration' | 'sessionId' | 'sessionIdFull' | 'sessionName'
  | 'toolActivity' | 'agentStatus' | 'todoProgress'
  | 'burnRate' | 'tokenSpeed' | 'depletionTime' | 'cacheHit'
  | 'codexUsage' | 'geminiUsage' | 'geminiUsageAll' | 'zaiUsage'
  | 'tokenBreakdown' | 'performance' | 'forecast' | 'budget' | 'todayCost'
  | 'version'
  | 'linesChanged'
  | 'outputStyle'
  | 'lastPrompt'
  | 'vimMode'
  | 'apiDuration'
  | 'peakHours'
  | 'tagStatus';
```

See the [Widget Reference](/reference/widget-reference/) for detailed information about each widget.

## Default Configuration

When no configuration file exists, the following defaults are used:

```json
{
  "language": "auto",
  "plan": "max",
  "displayMode": "compact",
  "cache": {
    "ttlSeconds": 300
  }
}
```

## Full Example

```json
{
  "language": "auto",
  "plan": "max",
  "displayMode": "custom",
  "lines": [
    ["model", "context", "cost", "rateLimit5h"],
    ["projectInfo", "todoProgress"]
  ],
  "theme": "catppuccin",
  "separator": "dot",
  "dailyBudget": 15,
  "disabledWidgets": ["codexUsage"],
  "cache": {
    "ttlSeconds": 300
  }
}
```
