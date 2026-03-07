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

### Theme Previews

Each preview below uses the actual hex colors from the theme definition.

**default** — Pastel colors
<div style="background:#1e1e2e; padding:8px 12px; border-radius:6px; font-family:monospace; font-size:14px; margin-bottom:8px"><span style="color:#87d7ff">🤖 Opus(H)</span> <span style="color:#808080">│</span> <span style="color:#afd7af">██░░ 45%</span> <span style="color:#808080">│</span> <span style="color:#ffd787">$1.25</span> <span style="color:#808080">│</span> <span style="color:#afd7af">5h: 42%</span> <span style="color:#808080">│</span> <span style="color:#ffd787">7d: 69%</span></div>

**minimal** — Monochrome
<div style="background:#1e1e2e; padding:8px 12px; border-radius:6px; font-family:monospace; font-size:14px; margin-bottom:8px"><span style="color:#ffffff">🤖 Opus(H)</span> <span style="color:#808080">│</span> <span style="color:#808080">██░░ 45%</span> <span style="color:#808080">│</span> <span style="color:#ffffff">$1.25</span> <span style="color:#808080">│</span> <span style="color:#808080">5h: 42%</span> <span style="color:#808080">│</span> <span style="color:#ffffff">7d: 69%</span></div>

**catppuccin** — Catppuccin Mocha
<div style="background:#1e1e2e; padding:8px 12px; border-radius:6px; font-family:monospace; font-size:14px; margin-bottom:8px"><span style="color:#89b4fa">🤖 Opus(H)</span> <span style="color:#6c7086">│</span> <span style="color:#a6e3a1">██░░ 45%</span> <span style="color:#6c7086">│</span> <span style="color:#f9e2af">$1.25</span> <span style="color:#6c7086">│</span> <span style="color:#a6e3a1">5h: 42%</span> <span style="color:#6c7086">│</span> <span style="color:#fab387">7d: 69%</span></div>

**dracula** — Dracula
<div style="background:#1e1e2e; padding:8px 12px; border-radius:6px; font-family:monospace; font-size:14px; margin-bottom:8px"><span style="color:#bd93f9">🤖 Opus(H)</span> <span style="color:#6272a4">│</span> <span style="color:#50fa7b">██░░ 45%</span> <span style="color:#6272a4">│</span> <span style="color:#ffb86c">$1.25</span> <span style="color:#6272a4">│</span> <span style="color:#50fa7b">5h: 42%</span> <span style="color:#6272a4">│</span> <span style="color:#f1fa8c">7d: 69%</span></div>

**gruvbox** — Gruvbox
<div style="background:#1e1e2e; padding:8px 12px; border-radius:6px; font-family:monospace; font-size:14px; margin-bottom:8px"><span style="color:#d79921">🤖 Opus(H)</span> <span style="color:#928374">│</span> <span style="color:#b8bb26">██░░ 45%</span> <span style="color:#928374">│</span> <span style="color:#fabd2f">$1.25</span> <span style="color:#928374">│</span> <span style="color:#b8bb26">5h: 42%</span> <span style="color:#928374">│</span> <span style="color:#fabd2f">7d: 69%</span></div>

**nord** — Nord
<div style="background:#1e1e2e; padding:8px 12px; border-radius:6px; font-family:monospace; font-size:14px; margin-bottom:8px"><span style="color:#88c0d0">🤖 Opus(H)</span> <span style="color:#4c566a">│</span> <span style="color:#a3be8c">██░░ 45%</span> <span style="color:#4c566a">│</span> <span style="color:#ebcb8b">$1.25</span> <span style="color:#4c566a">│</span> <span style="color:#a3be8c">5h: 42%</span> <span style="color:#4c566a">│</span> <span style="color:#ebcb8b">7d: 69%</span></div>

**tokyoNight** — Tokyo Night
<div style="background:#1a1b26; padding:8px 12px; border-radius:6px; font-family:monospace; font-size:14px; margin-bottom:8px"><span style="color:#7aa2f7">🤖 Opus(H)</span> <span style="color:#565f89">│</span> <span style="color:#9ece6a">██░░ 45%</span> <span style="color:#565f89">│</span> <span style="color:#e0af68">$1.25</span> <span style="color:#565f89">│</span> <span style="color:#9ece6a">5h: 42%</span> <span style="color:#565f89">│</span> <span style="color:#e0af68">7d: 69%</span></div>

**solarized** — Solarized Dark
<div style="background:#1e1e2e; padding:8px 12px; border-radius:6px; font-family:monospace; font-size:14px; margin-bottom:8px"><span style="color:#268bd2">🤖 Opus(H)</span> <span style="color:#586e75">│</span> <span style="color:#859900">██░░ 45%</span> <span style="color:#586e75">│</span> <span style="color:#b58900">$1.25</span> <span style="color:#586e75">│</span> <span style="color:#859900">5h: 42%</span> <span style="color:#586e75">│</span> <span style="color:#b58900">7d: 69%</span></div>

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
| `pipe` (default) | `│` | `Model │ Context │ Cost` |
| `space` | ` ` | `Model  Context  Cost` |
| `dot` | `·` | `Model · Context · Cost` |
| `arrow` | `›` | `Model › Context › Cost` |

### Separator Previews

<div style="background:#1a1b26; padding:8px 12px; border-radius:6px; font-family:monospace; font-size:14px; margin-bottom:8px"><span style="color:#7aa2f7">🤖 Opus(H)</span> <span style="color:#565f89">│</span> <span style="color:#9ece6a">██░░ 45%</span> <span style="color:#565f89">│</span> <span style="color:#e0af68">$1.25</span> <span style="color:#565f89">│</span> <span style="color:#9ece6a">5h: 42%</span>  <span style="color:#565f89; font-size:12px">pipe (default)</span></div>

<div style="background:#1a1b26; padding:8px 12px; border-radius:6px; font-family:monospace; font-size:14px; margin-bottom:8px"><span style="color:#7aa2f7">🤖 Opus(H)</span>  <span style="color:#9ece6a">██░░ 45%</span>  <span style="color:#e0af68">$1.25</span>  <span style="color:#9ece6a">5h: 42%</span>  <span style="color:#565f89; font-size:12px">space</span></div>

<div style="background:#1a1b26; padding:8px 12px; border-radius:6px; font-family:monospace; font-size:14px; margin-bottom:8px"><span style="color:#7aa2f7">🤖 Opus(H)</span> <span style="color:#565f89">·</span> <span style="color:#9ece6a">██░░ 45%</span> <span style="color:#565f89">·</span> <span style="color:#e0af68">$1.25</span> <span style="color:#565f89">·</span> <span style="color:#9ece6a">5h: 42%</span>  <span style="color:#565f89; font-size:12px">dot</span></div>

<div style="background:#1a1b26; padding:8px 12px; border-radius:6px; font-family:monospace; font-size:14px; margin-bottom:8px"><span style="color:#7aa2f7">🤖 Opus(H)</span> <span style="color:#565f89">›</span> <span style="color:#9ece6a">██░░ 45%</span> <span style="color:#565f89">›</span> <span style="color:#e0af68">$1.25</span> <span style="color:#565f89">›</span> <span style="color:#9ece6a">5h: 42%</span>  <span style="color:#565f89; font-size:12px">arrow</span></div>

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
    "ttlSeconds": 300
  }
}
```
