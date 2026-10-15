---
description: Configure claude-dashboard status line settings
argument-hint: "[displayMode] [language] [plan] | custom \"widgets\""
allowed-tools: Read, Write, Bash(node:*), AskUserQuestion
---

# Claude Dashboard Setup

Configure the claude-dashboard status line plugin with widget system support.

## Arguments

- **No arguments**: Interactive mode (asks questions)
- **With arguments**: Direct configuration mode

### Direct Mode Arguments

- `$1`: Display mode
  - `compact` (default): 1 line (model, context, cost, rateLimit5h, rateLimit7d, rateLimit7dSonnet, zaiUsage)
  - `normal`: 2 lines (+ projectInfo, sessionId, sessionDuration, burnRate, todoProgress)
  - `detailed`: 6 lines (+ sessionName, tokenSpeed, depletionTime, configCounts, toolActivity, agentStatus, cacheHit, promptCache, performance, tokenBreakdown, forecast, budget, todayCost, codexUsage, geminiUsage, antigravityUsage, linesChanged, outputStyle, version, peakHours, lastPrompt, vimMode, apiDuration, tagStatus)
  - `custom`: Custom widget configuration (requires `$4`)

- `$2`: Language preference
  - `auto` (default): Detect from system language
  - `en`: English
  - `ko`: Korean

- `$3`: Subscription plan
  - `max` (default): Shows 5h + 7d rate limits
  - `pro`: Shows 5h only

- `$4`: Custom lines (only for `custom` mode)
  - Format: `"widget1,widget2|widget3,widget4"`
  - `|` separates lines
  - Example: `"model,context,cost|projectInfo,todoProgress"`

### Available Widgets

| Widget | Description |
|--------|-------------|
| `model` | Model name and version with emoji (e.g. `Opus 5.5`), effort level (Opus/Sonnet/Fable), fast mode (Opus) |
| `context` | Progress bar, percentage, tokens |
| `contextBar` | Progress bar only (sub-widget of `context`) |
| `contextPercentage` | Percentage only (sub-widget of `context`) |
| `contextUsage` | Token count only, e.g. `42K/200K` (sub-widget of `context`) |
| `cost` | Session cost in USD |
| `rateLimit5h` | 5-hour rate limit |
| `rateLimit7d` | 7-day rate limit (Pro/Max) |
| `rateLimit7dSonnet` | 7-day Sonnet limit (Max) — deprecated ~2026-06, merged into the unified weekly bucket at Sonnet 5 launch; stays hidden while the API returns null |
| `rateLimit7dFable` | 7-day Fable limit (Max) |
| `projectInfo` | Directory name + git branch + ahead/behind (↑↓), subpath from project_dir, worktree indicator |
| `configCounts` | CLAUDE.md, AGENTS.md, rules, MCPs, hooks, +Dirs counts |
| `sessionId` | Session ID (short 8 chars) |
| `sessionIdFull` | Session ID (full UUID) |
| `sessionDuration` | Session duration |
| `toolActivity` | Running/completed tools with targets (e.g., `Read(app.ts)`) |
| `agentStatus` | Subagent progress |
| `todoProgress` | Todo completion rate |
| `burnRate` | Token consumption per minute, session average (input + cache write + output) |
| `cacheHit` | Cache hit rate percentage (last request) |
| `promptCache` | Session prompt-cache health: ♨️ warm with time left before it goes cold / ❄️ cold, hit ratio, miss count (Claude Code ≥ 2.1.251) |
| `promptCacheState` | Warm/cold icon + time left only (sub-widget of `promptCache`) |
| `promptCacheHit` | Session cache hit ratio only (sub-widget of `promptCache`) |
| `promptCacheMisses` | Miss count only (sub-widget of `promptCache`) |
| `depletionTime` | Estimated time to rate limit |
| `codexUsage` | OpenAI Codex CLI usage (auto-hide if not installed) |
| `geminiUsage` | Google Gemini CLI usage - current model (auto-hide if not installed) |
| `geminiUsageAll` | Google Gemini CLI usage - all models (auto-hide if not installed) |
| `antigravityUsage` | Google Antigravity CLI - weekly quota by model family (auto-hide if not installed) |
| `antigravityUsageAll` | Google Antigravity CLI - per-model quota (auto-hide if not installed) |
| `zaiUsage` | z.ai/ZHIPU usage (auto-hide if not using z.ai) |
| `tokenBreakdown` | Input/output/cache write/read token breakdown |
| `performance` | Composite efficiency badge (cache hit + output ratio) |
| `forecast` | Estimated hourly cost based on session rate |
| `budget` | Daily spending vs configured budget limit (requires `dailyBudget` in config) |
| `tokenSpeed` | Output token generation speed, session average (e.g., `67 tok/s`) |
| `tokenSpeedLast` | Output token generation speed of the most recent response (e.g., `last 150 tok/s`) |
| `sessionName` | Session name from /rename command |
| `todayCost` | Total spending across all sessions today |
| `linesChanged` | Uncommitted lines added/removed, including untracked files (+N -N) |
| `outputStyle` | Current output style (hidden when "default") |
| `version` | Claude Code version display |
| `vimMode` | Vim mode (NORMAL/INSERT), auto-hides when vim disabled |
| `apiDuration` | API time as % of total session time |
| `peakHours` | Peak hours indicator with countdown (weekdays 5-11 AM PT) |
| `tagStatus` | Commits ahead of matched git tags (uses `tagPatterns` config, default `["v*"]`) |
| `slashCommand` | Active slash command for the current turn (🎯); cleared by next plain-text message |
| `agentMode` | Session agent identity: 👤 custom agent (via `/agent <name>`) or 🤖 subagent type |

## Tasks

### 1. Determine configuration

**If no arguments provided (interactive mode):**

Use AskUserQuestion to ask the user. Batch independent questions into a single AskUserQuestion call (max 4 per call) to minimize back-and-forth.

**Turn 1** — Ask all 4 questions in a single AskUserQuestion call:
1. Display mode — MUST include `markdown` field on each option for visual preview:
   - compact (recommended), markdown:
     ```
     ◆ Opus 5.5(X) │ ██░░ 80% │ $1.25 │ 5h: 42% │ 7d: 69%
     ```
   - normal, markdown:
     ```
     ◆ Opus 5.5(X) │ ██░░ 80% │ $1.25 │ 5h: 42% │ 7d: 69%
     📁 project (main ↑3) │ 🔑 abc123 │ ⏱ 45m │ 🔥 5K/m │ ✓ 3/5
     ```
   - detailed, markdown:
     ```
     ◆ Opus 5.5(X) │ ██░░ 80% │ $1.25 │ 5h: 42% │ 7d: 69%
     📁 project (main ↑3) │ 🔑 abc123 │ ⏱ 45m │ 🔥 5K/m │ ⏳ 2h │ ✓ 3/5
     CLAUDE.md: 2 │ ⚙️ 12 done │ 🤖 Agent: 1 │ 📦 85% │ 🟢 72%
     📊 In 30K · Out 8K │ 📈 ~$8/h │ 💵 $5/$15 │ 🔷 codex │ 💎 gemini │ 🪐 antigravity
     ```
   - custom, markdown:
     ```
     Choose exactly which widgets appear on each line.
     Full control over layout and ordering.
     ```
2. Language: auto (recommended), en, ko
3. Plan: max (recommended), pro
4. Theme: default (recommended), minimal, "catppuccin (mocha / latte — light)", "dracula / gruvbox / nord / tokyoNight / solarized"
   - All themes are dark except `catppuccinLatte`, which is designed for light-mode terminals
   - If multi-option selected: ask in next turn which one
   - For catppuccin, map `mocha` → config value `catppuccin`, `latte` → `catppuccinLatte`

**Turn 2** — If display mode = "custom", build the layout one line at a time using category-based multi-select.

For each line `N` (starting at 1), repeat the following sub-flow until the user declines to add another line:

**Step A — Pick categories for line `N`:**
Single AskUserQuestion call with `multiSelect: true`, max 4 options. Ask: "Line `N`: which widget categories do you want to pull from?" The 4 category options are:

1. **Model & Context** — `model`, `context`, `contextBar`, `contextPercentage`, `contextUsage`
2. **Cost & Limits** — `cost`, `rateLimit5h`, `rateLimit7d`, `rateLimit7dSonnet`, `rateLimit7dFable`, `budget`, `forecast`, `todayCost`
3. **Project, Session & Activity** — `projectInfo`, `sessionId`, `sessionIdFull`, `sessionDuration`, `sessionName`, `configCounts`, `toolActivity`, `agentStatus`, `agentMode`, `todoProgress`, `outputStyle`, `vimMode`, `linesChanged`, `version`, `lastPrompt`, `slashCommand`
4. **Performance, Tokens & Other CLIs** — `burnRate`, `tokenSpeed`, `tokenSpeedLast`, `cacheHit`, `promptCache`, `promptCacheState`, `promptCacheHit`, `promptCacheMisses`, `performance`, `tokenBreakdown`, `depletionTime`, `apiDuration`, `peakHours`, `tagStatus`, `codexUsage`, `geminiUsage`, `geminiUsageAll`, `antigravityUsage`, `antigravityUsageAll`, `zaiUsage`

**Step B — Pick widgets from each selected category:**
For every category the user selected in Step A, send one AskUserQuestion call with `multiSelect: true` listing the widgets in that category. AskUserQuestion allows max 4 options per call, so if a category has more than 4 widgets, split into multiple consecutive calls (e.g. "Cost & Limits (1/2)", "Cost & Limits (2/2)") — the user can pick zero or more widgets from each page.

Each widget option's `description` should be a short version of the table at the top of this file (e.g. `cost` → "Session cost in USD").

Collect every selected widget into an ordered list for line `N`, preserving the order they were chosen.

**Step C — Add another line?**
Single AskUserQuestion call (not multi-select) asking: "Line `N` has `[widget1, widget2, ...]`. Add another line?" with options `No (finish)` and `Yes, add Line N+1`. If the user picks "No", end the loop. If "Yes", increment `N` and return to Step A. There is no hard line limit.

**Notes for the assistant running this flow:**
- If the user selects zero widgets for a line (no categories or no widgets within selected categories), warn them and re-ask Step A for that same line — empty lines are not allowed.
- Show the running layout in Step C's question text so the user always sees what they've built so far.
- Keep the multi-select widget questions free of preset/combination options — the whole point of custom mode is per-widget control.
- **Track already-placed widgets across lines.** Maintain a `placed` set of every widget chosen so far. Starting from line 2 onward:
  - In Step A, list each category's `description` using **only the widgets not yet in `placed`** (e.g. if `model` and `context` are already placed, the Model & Context description becomes "contextBar, contextPercentage, contextUsage"). Truncate with "etc." past ~6–8 names if needed.
  - If a category has zero remaining widgets, **omit the entire category option** from Step A's choices.
  - In Step B, exclude already-placed widgets from each category's multi-select options as well.
  - If every category becomes empty (all widgets placed), inform the user and end the loop after the current line — there is nothing left to add.

**Turn 3** — Ask: "Do you want to hide any widgets?"
- Options: No (recommended), Yes
- If "Yes": ask which widgets to hide (multi-select from available widgets)

**Turn 4** — Ask: "How do you want to use the mod dashboard?" (single select; the mod commands work in every case — this only sets defaults). Include a short `markdown` preview on each option:
- **Status line only (recommended)** — keep using the status line; `/claude-dashboard-pane` and `/claude-dashboard-band` stay available on demand. Removes `modBandDefault`.
- **Peek with pane** — keep the status line lean and open the full dashboard with `/claude-dashboard-pane` when needed (e.g. widgets left out of the status line). Writes `"modPane": "detailed"` if `modPane` is not set yet, removes `modBandDefault`.
- **Replace with band** — draw the dashboard above the prompt at session start and hide the status line for that session. Writes `"modBandDefault": true`.
- **Both** — band at session start, plus the full dashboard in the pane on demand. Writes `"modBandDefault": true`, and `"modPane": "detailed"` if `modPane` is not set yet.

Turn 4 owns `modBandDefault`: always write or remove it as the chosen option says, so a rerun that switches back to "Status line only" or "Peek with pane" actually stops the band at session start instead of the merge rule below keeping an old `"modBandDefault": true`. Never remove or overwrite an existing `modPane` (the user may have set a custom pane layout; it only applies when the pane is opened) or `modBand`.

If the user picks band or both, tell them: the band draws in the terminal and the desktop Code tab only (VS Code and `claude -p` keep the status line), and `/claude-dashboard-band off` brings the status line back for the current session.

**If arguments provided (direct mode):**

Use the provided arguments directly.

### 2. Create configuration file

Write `~/.claude/claude-dashboard.local.json`. **If the file already exists, read it first and keep every key this command does not set** (e.g. `tagPatterns`, `dailyBudget`, `modBand`; `modBandDefault` only in direct mode, where Turn 4 is not asked) — only overwrite the keys chosen in this run. A user who reruns setup to change the theme must not lose the rest of their config.

> This file intentionally stays in `~/.claude` even when `CLAUDE_CONFIG_DIR` is set — it is the dashboard's own display config, shared by every account, and the statusline always reads it from there.

**For preset modes (compact/normal/detailed):**
```json
{
  "language": "$2 or auto",
  "plan": "$3 or max",
  "displayMode": "$1 or normal",
  "theme": "selected theme or default",
  "separator": "pipe (default) | space | dot | arrow",
  "disabledWidgets": ["selected widgets to hide, omit if empty"],
  "cache": {
    "ttlSeconds": 300
  }
}
```

**For preset shorthand (quick layout):**
```json
{
  "language": "auto",
  "plan": "max",
  "preset": "MC$R|BDO",
  "theme": "default",
  "cache": {
    "ttlSeconds": 300
  }
}
```

Preset characters: `M`=model, `C`=context, `b`=contextBar, `%`=contextPercentage, `#`=contextUsage, `$`=cost, `R`=rateLimit5h, `7`=rateLimit7d, `S`=7dSonnet, `f`=7dFable, `P`=projectInfo, `I`=sessionId, `D`=sessionDuration, `T`=toolActivity, `A`=agentStatus, `g`=agentMode, `O`=todoProgress, `B`=burnRate, `E`=depletionTime, `H`=cacheHit, `c`=promptCache, `w`=promptCacheState, `h`=promptCacheHit, `x`=promptCacheMisses, `X`=codexUsage, `G`=geminiUsage, `^`=antigravityUsage, `Z`=zaiUsage, `K`=configCounts, `N`=tokenBreakdown, `F`=performance, `W`=forecast, `U`=budget, `L`=linesChanged, `Y`=outputStyle, `V`=version, `Q`=tokenSpeed, `q`=tokenSpeedLast, `J`=sessionName, `@`=todayCost, `?`=lastPrompt, `/`=slashCommand, `m`=vimMode, `a`=apiDuration, `p`=peakHours, `t`=tagStatus. Use `|` to separate lines.

**For custom mode:**
```json
{
  "language": "$2 or auto",
  "plan": "$3 or max",
  "displayMode": "custom",
  "lines": [
    ["widget1", "widget2"],
    ["widget3", "widget4"]
  ],
  "theme": "selected theme or default",
  "separator": "pipe",
  "disabledWidgets": ["selected widgets to hide, omit if empty"],
  "cache": {
    "ttlSeconds": 300
  }
}
```

**For budget tracking** (add to any config):
```json
{
  "dailyBudget": 15
}
```

**For tagStatus patterns** (add to any config, default is `["v*"]`):
```json
{
  "tagPatterns": ["v*", "release-*"]
}
```

**Mod keys**: `"modPane"` (layout of the `/claude-dashboard-pane` pane: display mode name, preset string, or custom widget lines like `[["model","context"],["sessionIdFull"]]`; default `detailed`) and `"modBandDefault"` (`true` turns the band on at session start) are set from Turn 4. `"modBand"` (layout of the `/claude-dashboard-band` band, same format, default = status line layout) is not asked — write it only if the user requests a band layout different from the status line.

**Note**: Omit `"disabledWidgets"` field entirely if user chose not to hide any widgets. Omit `"dailyBudget"` if not using budget tracking. Omit `"tagPatterns"` to use the default `["v*"]`. Omit `"separator"` if using default pipe style.

### 3. Update settings.json

Add or update the statusLine configuration in the session's Claude config dir — `$CLAUDE_CONFIG_DIR` if set, `~/.claude` otherwise. Multi-account setups run this once per account:

**Find the plugin path and update settings.json** (copy-paste block — resolves the newest
installed version in `node` rather than shelling out to `sort -V`, which is a GNU/BSD
extension, not POSIX):
```bash
CFGDIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"; CFGDIR="$CFGDIR" node -e '
const fs = require("fs");
const path = require("path");
const cfgDir = process.env.CFGDIR;
const cacheRoot = path.join(cfgDir, "plugins/cache/claude-dashboard/claude-dashboard");
let entries = [];
try {
  entries = fs.readdirSync(cacheRoot, { withFileTypes: true });
} catch {}
const versions = entries
  .filter((e) => e.isDirectory() && /^\d+\.\d+\.\d+$/.test(e.name))
  .map((e) => e.name)
  .filter((v) => fs.existsSync(path.join(cacheRoot, v, "scripts/statusline-shim.mjs")))
  .sort((a, b) => {
    const pa = a.split(".").map(Number);
    const pb = b.split(".").map(Number);
    return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2];
  });
if (versions.length === 0) {
  console.error("claude-dashboard is not installed in " + cfgDir);
  process.exit(1);
}
const src = path.join(cacheRoot, versions[versions.length - 1], "scripts/statusline-shim.mjs");
const dataDir = path.join(cfgDir, "plugins/data/claude-dashboard-claude-dashboard");
fs.mkdirSync(dataDir, { recursive: true });
const dest = path.join(dataDir, "statusline.mjs");
fs.copyFileSync(src, dest);
const settingsPath = path.join(cfgDir, "settings.json");
const settings = fs.existsSync(settingsPath) ? JSON.parse(fs.readFileSync(settingsPath, "utf8")) : {};
const statusLine = settings.statusLine && typeof settings.statusLine === "object" ? settings.statusLine : {};
statusLine.type = "command";
statusLine.command = "node " + JSON.stringify(dest);
settings.statusLine = statusLine;
fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
'
```

This command:
1. Copies the status line shim into the plugin's persistent data directory
   (`plugins/data/claude-dashboard-claude-dashboard/`), which survives plugin updates
2. Points `statusLine` at that fixed path — it resolves the newest installed build on
   every render, so plugin updates need no further settings change
3. Prints `claude-dashboard is not installed in <configdir>` and exits non-zero if no
   version is installed there yet

**Note**: After `/plugin update claude-dashboard`, the status line picks up the new version
automatically — no follow-up command is needed. Run `/claude-dashboard:update` only if you
have hooks disabled or the status line is not updating.

## Examples

```bash
# Interactive mode
/claude-dashboard:setup

# Preset modes
/claude-dashboard:setup normal
/claude-dashboard:setup compact en pro
/claude-dashboard:setup detailed ko max

# Custom mode
/claude-dashboard:setup custom auto max "model,context,cost|projectInfo,todoProgress"
```

## Notes

- The status line will update on the next message
- To change settings later, run this command again
- Custom mode allows full control over which widgets appear on each line
- Mods (tested on Claude Code 2.1.289): `/claude-dashboard-pane [on|off|dashboard|turns|agents|files|todos|errors|bg]` opens or closes a pane beside the transcript (a view name opens it on that view); `/claude-dashboard-band [on|off]` draws the dashboard above the prompt and hides the status line for the current session only. Both take no argument to toggle. Mention both commands in the final summary, whichever Turn 4 option was chosen
