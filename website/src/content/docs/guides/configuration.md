---
title: Configuration
description: Detailed configuration guide
sidebar:
  order: 4
---

claude-dashboard is configured through a JSON file and the `/claude-dashboard:setup` command.

## Setup Command

The fastest way to configure is via the setup command:

```bash
# Preset modes
/claude-dashboard:setup compact             # 1 line (default)
/claude-dashboard:setup normal en pro       # 2 lines, English, Pro plan
/claude-dashboard:setup detailed ko max     # 6 lines, Korean, Max plan

# Custom mode: control widget order and line composition
# Format: "widget1,widget2,...|widget3,widget4,..." (| separates lines)
/claude-dashboard:setup custom auto max "model,context,cost|projectInfo,todoProgress"
```

Running `/claude-dashboard:setup` without arguments launches interactive mode, which guides you through each option.

## Plan Differences

| Feature | Max | Pro |
|---------|-----|-----|
| 5h rate limit + countdown | Yes | Yes |
| 7d all models | Yes | Yes |

Pro plan users will not see the 7-day Sonnet rate limit widget (`rateLimit7dSonnet`), as Sonnet-specific quota buckets only apply to the Max plan. The `rateLimit7d` widget is available for both Pro and Max plans.

## Configuration File

The configuration is stored at `~/.claude/claude-dashboard.local.json`. You can edit this file directly or use the setup command.

### Full Example

```json
{
  "language": "auto",
  "plan": "max",
  "displayMode": "custom",
  "lines": [
    ["model", "context", "cost", "rateLimit5h"],
    ["projectInfo", "todoProgress"]
  ],
  "theme": "default",
  "separator": "pipe",
  "dailyBudget": 15,
  "disabledWidgets": [],
  "cache": {
    "ttlSeconds": 300
  }
}
```

### Preset Shorthand

For quick configuration, you can use a preset string instead of specifying lines manually:

```json
{
  "preset": "MC$R|BDO",
  "theme": "tokyoNight",
  "separator": "dot"
}
```

When `preset` is set, it overrides `displayMode` with `custom` and generates the line layout from the shorthand string. See [Preset Shortcuts](/guides/presets/) for the character mapping.

## Budget Tracking

Set a daily budget limit in USD to track your spending:

```json
{
  "dailyBudget": 15
}
```

The `budget` widget shows daily spending versus your configured limit. Warning indicators appear at 80% usage and critical alerts at 95%.

## Tag Status Patterns

The `tagStatus` widget shows commits ahead of each matched git tag. Configure which tags to track via `tagPatterns`:

```json
{
  "tagPatterns": ["v*", "release-*"]
}
```

Each glob pattern resolves to at most one tag — the most recent one reachable from `HEAD`. The default is `["v*"]`. The widget auto-hides when no pattern matches a reachable tag.

## Widget Toggle

Add widget IDs to `disabledWidgets` to hide specific widgets from any display mode (including presets and custom layouts):

```json
{
  "disabledWidgets": ["codexUsage", "geminiUsage"]
}
```

Empty lines that result from disabling widgets are automatically removed.

## Color Legend

Widgets that show utilization percentages use a consistent color scheme:

- **Green (0-50%):** Safe range
- **Yellow (51-80%):** Warning range
- **Red (81-100%):** Critical range

This applies to context usage, rate limits, cache hit rate, budget utilization, and similar percentage-based widgets.
