---
title: Themes
description: 8 color themes and separator styles
sidebar:
  order: 3
---

claude-dashboard supports 8 color themes and 4 separator styles to customize the visual appearance of your status line.

## Color Themes

Set the theme in your configuration file (`~/.claude/claude-dashboard.local.json`):

```json
{
  "theme": "catppuccin"
}
```

### Available Themes

| Theme | Style |
|-------|-------|
| `default` | Pastel colors (cyan, yellow, pink, green) |
| `minimal` | Monochrome (white + gray) |
| `catppuccin` | Catppuccin Mocha palette |
| `dracula` | Dracula palette |
| `gruvbox` | Gruvbox palette |
| `nord` | Nord polar night/frost palette |
| `tokyoNight` | Tokyo Night blue/purple palette |
| `solarized` | Solarized dark palette |

Each theme provides semantic color roles used across all widgets, ensuring a consistent look regardless of which widgets you have enabled.

## Separator Styles

The separator controls the character used between widgets on the same line.

```json
{
  "separator": "dot"
}
```

### Available Separators

| Style | Character | Example |
|-------|-----------|---------|
| `pipe` (default) | `\|` | `Model \| Context \| Cost` |
| `space` | ` ` | `Model  Context  Cost` |
| `dot` | `·` | `Model · Context · Cost` |
| `arrow` | `>` | `Model > Context > Cost` |

## Combined Example

Here is a configuration using the Tokyo Night theme with dot separators:

```json
{
  "language": "en",
  "plan": "max",
  "displayMode": "normal",
  "theme": "tokyoNight",
  "separator": "dot",
  "cache": {
    "ttlSeconds": 60
  }
}
```
