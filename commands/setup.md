---
description: Configure claude-dashboard status line settings
argument-hint: "[displayMode] [language] [plan] | custom \"widgets\""
allowed-tools: Read, Write, Bash(node:*), Bash(cat:*), Bash(mkdir:*), Bash(ls:*), Bash(sort:*), Bash(tail:*), AskUserQuestion
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
  - `detailed`: 6 lines (+ sessionName, tokenSpeed, depletionTime, configCounts, toolActivity, agentStatus, cacheHit, performance, tokenBreakdown, forecast, budget, todayCost, codexUsage, geminiUsage, linesChanged, outputStyle, version, peakHours, lastPrompt, vimMode, apiDuration, tagStatus)
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
| `model` | Model name with emoji, effort level (Opus/Sonnet), fast mode (Opus) |
| `context` | Progress bar, percentage, tokens |
| `contextBar` | Progress bar only (sub-widget of `context`) |
| `contextPercentage` | Percentage only (sub-widget of `context`) |
| `contextUsage` | Token count only, e.g. `42K/200K` (sub-widget of `context`) |
| `cost` | Session cost in USD |
| `rateLimit5h` | 5-hour rate limit |
| `rateLimit7d` | 7-day rate limit (Pro/Max) |
| `rateLimit7dSonnet` | 7-day Sonnet limit (Max) |
| `rateLimit7dFable` | 7-day Fable limit (Max) |
| `projectInfo` | Directory name + git branch + ahead/behind (↑↓), subpath from project_dir, worktree indicator |
| `configCounts` | CLAUDE.md, AGENTS.md, rules, MCPs, hooks, +Dirs counts |
| `sessionId` | Session ID (short 8 chars) |
| `sessionIdFull` | Session ID (full UUID) |
| `sessionDuration` | Session duration |
| `toolActivity` | Running/completed tools with targets (e.g., `Read(app.ts)`) |
| `agentStatus` | Subagent progress |
| `todoProgress` | Todo completion rate |
| `burnRate` | Token consumption per minute |
| `cacheHit` | Cache hit rate percentage |
| `depletionTime` | Estimated time to rate limit |
| `codexUsage` | OpenAI Codex CLI usage (auto-hide if not installed) |
| `geminiUsage` | Google Gemini CLI usage - current model (auto-hide if not installed) |
| `geminiUsageAll` | Google Gemini CLI usage - all models (auto-hide if not installed) |
| `zaiUsage` | z.ai/ZHIPU usage (auto-hide if not using z.ai) |
| `tokenBreakdown` | Input/output/cache write/read token breakdown |
| `performance` | Composite efficiency badge (cache hit + output ratio) |
| `forecast` | Estimated hourly cost based on session rate |
| `budget` | Daily spending vs configured budget limit (requires `dailyBudget` in config) |
| `tokenSpeed` | Output token generation speed (e.g., `67 tok/s`) |
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
     ◆ Opus(X) │ ██░░ 80% │ $1.25 │ 5h: 42% │ 7d: 69%
     ```
   - normal, markdown:
     ```
     ◆ Opus(X) │ ██░░ 80% │ $1.25 │ 5h: 42% │ 7d: 69%
     📁 project (main ↑3) │ 🔑 abc123 │ ⏱ 45m │ 🔥 5K/m │ ✓ 3/5
     ```
   - detailed, markdown:
     ```
     ◆ Opus(X) │ ██░░ 80% │ $1.25 │ 5h: 42% │ 7d: 69%
     📁 project (main ↑3) │ 🔑 abc123 │ ⏱ 45m │ 🔥 5K/m │ ⏳ 2h │ ✓ 3/5
     CLAUDE.md: 2 │ ⚙️ 12 done │ 🤖 Agent: 1 │ 📦 85% │ 🟢 72%
     📊 In 30K · Out 8K │ 📈 ~$8/h │ 💵 $5/$15 │ 🔷 codex │ 💎 gemini
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
4. **Performance, Tokens & Other CLIs** — `burnRate`, `tokenSpeed`, `cacheHit`, `performance`, `tokenBreakdown`, `depletionTime`, `apiDuration`, `peakHours`, `tagStatus`, `codexUsage`, `geminiUsage`, `geminiUsageAll`, `zaiUsage`

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

**If arguments provided (direct mode):**

Use the provided arguments directly.

### 2. Create configuration file

Create `~/.claude/claude-dashboard.local.json`:

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

Preset characters: `M`=model, `C`=context, `b`=contextBar, `%`=contextPercentage, `#`=contextUsage, `$`=cost, `R`=rateLimit5h, `7`=rateLimit7d, `S`=7dSonnet, `f`=7dFable, `P`=projectInfo, `I`=sessionId, `D`=sessionDuration, `T`=toolActivity, `A`=agentStatus, `g`=agentMode, `O`=todoProgress, `B`=burnRate, `E`=depletionTime, `H`=cacheHit, `X`=codexUsage, `G`=geminiUsage, `Z`=zaiUsage, `K`=configCounts, `N`=tokenBreakdown, `F`=performance, `W`=forecast, `U`=budget, `L`=linesChanged, `Y`=outputStyle, `V`=version, `Q`=tokenSpeed, `J`=sessionName, `@`=todayCost, `?`=lastPrompt, `/`=slashCommand, `m`=vimMode, `a`=apiDuration, `p`=peakHours, `t`=tagStatus. Use `|` to separate lines.

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

**Note**: Omit `"disabledWidgets"` field entirely if user chose not to hide any widgets. Omit `"dailyBudget"` if not using budget tracking. Omit `"tagPatterns"` to use the default `["v*"]`. Omit `"separator"` if using default pipe style.

### 3. Update settings.json

Add or update the statusLine configuration in `~/.claude/settings.json`:

**Find the plugin path and update settings.json** (copy-paste one-liner):
```bash
SLPATH="$(ls -d ~/.claude/plugins/cache/claude-dashboard/claude-dashboard/*/dist/index.js 2>/dev/null | sort -V | tail -1)" node -e 'const fs=require("fs"),os=require("os"),p=os.homedir()+"/.claude/settings.json";const s=fs.existsSync(p)?JSON.parse(fs.readFileSync(p,"utf8")):{};s.statusLine={type:"command",command:"node "+process.env.SLPATH};fs.writeFileSync(p,JSON.stringify(s,null,2));'
```

This command:
1. Finds the latest plugin version dynamically
2. Updates `statusLine` in settings.json with the correct path

**IMPORTANT**: After updating the plugin via `/plugin update claude-dashboard`, run `/claude-dashboard:update` to update the statusLine path to the latest version.

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
