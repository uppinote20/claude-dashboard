---
title: Mods (pane & band)
description: Show the dashboard in a pane or above the prompt with Claude Code mods
sidebar:
  order: 6
---

claude-dashboard also ships as a Claude Code **mod** (function-hook plugin, early access, tested on Claude Code 2.1.289). It is bundled in the same plugin through `hooks/hooks.json` (`"modules": ["../dist/mod.js"]`), so there is nothing extra to install.

Mods are drawn only in the terminal and the desktop Code tab. They do not appear in the VS Code panel or with `claude -p`.

## Commands

| Command | What it does |
|---------|--------------|
| `/claude-dashboard-pane [on\|off\|dashboard\|turns\|agents\|files\|todos\|errors\|bg]` | Open or close a pane beside the transcript (no argument flips it, keeping the last view). A view name opens the pane on that view, or switches an open pane in place. Default view `dashboard` uses the `modPane` layout (default `detailed`). |
| `/claude-dashboard-band [on\|off]` | Draw the dashboard above the prompt and hide the status line for **this session only**. Layout from `modBand` (default: your status line layout). |

`/claude-dashboard-band` never touches `settings.json` and applies to the current session only.

### Pane views

| View | Shows |
|------|-------|
| `dashboard` | The widget layout from `modPane` (default view; refreshes every 60s) |
| `turns` | One line per user prompt, newest first (last 20): `#N HH:MM prompt elapsed ↑in ↓out 🔧tools 🤖agents`, with a per-turn token sparkline in the header. Slash commands show as `/name args`, shell input as `!cmd`; skill bodies, task notifications and command output are excluded. Tokens only, no $ |
| `agents` | Subagents of this session (20 most recently active): type, real model, description, elapsed, tool count, current running tool. Running first, `✓` done, `? stale` = running but no transcript write for 10 min |
| `files` | Files written by Edit/Write/MultiEdit/NotebookEdit this session (successful results only, main thread + subagents): project-relative path, count, source (`main`, `+N agents`). Up to 30 |
| `todos` | Full TodoWrite / Tasks list with ✓ / ▶ / ○ |
| `errors` | Failed tool calls, newest first (15): time, `tool(target)`, first error line; 🚫 for permission denials and blocks |
| `bg` | `run_in_background` Bash jobs and async agents, from launch to completion notice; running first, `? stale` when the session has been idle 10 min with no completion notice |

The selected view is kept for the session only (a new session starts on `dashboard`). Non-dashboard views refresh every 10s and on each session measure. Not included: agent teams/teammates, the desktop app plan tool, per-turn $ cost, click-to-jump.

## Configuration

```json
{
  "modPane": "detailed",
  "modBand": "MC$R|BDO",
  "modBandDefault": true
}
```

- `modPane` and `modBand` accept a display mode name (`compact`, `normal`, `detailed`), a preset string such as `"MC$R|BDO"`, or custom widget lines such as `[["model", "context"], ["sessionIdFull"]]` — the same form as the status line's `lines`, so widgets without a preset character work too. Unknown widget ids are dropped; if nothing is left, the default is used.
- `"modBandDefault": true` turns the band on at session start.
- Interactive `/claude-dashboard:setup` asks how you want to use the mod dashboard (status line only, peek with pane, replace with band, or both) and writes these keys for you; rerunning setup keeps keys it does not ask about.
- Theme, language, and `disabledWidgets` follow your normal configuration.
- `cacheHit`, `tokenBreakdown`, and `performance` are hidden in the pane and band, because the mod API has no per-request cache usage.

## How hiding works

While the band is on, it writes a per-session heartbeat marker at `~/.cache/claude-dashboard/band-<sessionId>`. The marker is refreshed on every render (at most every 60 seconds) and ignored after 180 seconds. It is deleted on `/claude-dashboard-band off` and when the session ends. If the mod stops for any reason, the status line returns by itself within 3 minutes.

## Where the data comes from

The pane and band use the mod API (context, rate limits, and cost pushed by Claude Code) together with the unchanged renderer `dist/index.js`, which runs as a subprocess.
