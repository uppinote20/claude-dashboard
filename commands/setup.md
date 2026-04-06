---
description: Configure claude-dashboard status line settings
argument-hint: "[displayMode] [language] [plan] | custom \"widgets\""
allowed-tools: Read, Write, Bash(jq:*), Bash(cat:*), Bash(mkdir:*), AskUserQuestion
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
  - `detailed`: 6 lines (+ sessionName, tokenSpeed, depletionTime, configCounts, toolActivity, agentStatus, cacheHit, performance, tokenBreakdown, forecast, budget, todayCost, codexUsage, geminiUsage, linesChanged, outputStyle, version, lastPrompt)
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
| `cost` | Session cost in USD |
| `rateLimit5h` | 5-hour rate limit |
| `rateLimit7d` | 7-day rate limit (Max only) |
| `rateLimit7dSonnet` | 7-day Sonnet limit (Max only) |
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

## Tasks

### 1. Determine configuration

**If no arguments provided (interactive mode):**

Use AskUserQuestion to ask the user. Batch independent questions into a single AskUserQuestion call (max 4 per call) to minimize back-and-forth.

**Turn 1** — Ask all 4 questions in a single AskUserQuestion call:
1. Display mode — MUST include `markdown` field on each option for visual preview:
   - compact (recommended), markdown:
     ```
     ◆ Opus(H) │ ██░░ 80% │ $1.25 │ 5h: 42% │ 7d: 69%
     ```
   - normal, markdown:
     ```
     ◆ Opus(H) │ ██░░ 80% │ $1.25 │ 5h: 42% │ 7d: 69%
     📁 project (main ↑3) │ 🔑 abc123 │ ⏱ 45m │ 🔥 5K/m │ ✓ 3/5
     ```
   - detailed, markdown:
     ```
     ◆ Opus(H) │ ██░░ 80% │ $1.25 │ 5h: 42% │ 7d: 69%
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
4. Theme: default (recommended), minimal, catppuccin, "dracula / gruvbox / nord / tokyoNight / solarized"
   - If multi-option selected: ask in next turn which one

**Turn 2** — If display mode = "custom", ask for each line's widgets:
- Show available widgets table for reference
- Line 1 widgets (comma-separated text input with suggested combinations)
- Ask if they want to add Line 2
- If yes, Line 2 widgets
- Continue until they say no (no line limit)

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

Preset characters: `M`=model, `C`=context, `$`=cost, `R`=rateLimit5h, `7`=rateLimit7d, `S`=7dSonnet, `P`=projectInfo, `I`=sessionId, `D`=sessionDuration, `T`=toolActivity, `A`=agentStatus, `O`=todoProgress, `B`=burnRate, `E`=depletionTime, `H`=cacheHit, `X`=codexUsage, `G`=geminiUsage, `Z`=zaiUsage, `K`=configCounts, `N`=tokenBreakdown, `F`=performance, `W`=forecast, `U`=budget, `L`=linesChanged, `Y`=outputStyle, `V`=version, `Q`=tokenSpeed, `J`=sessionName, `@`=todayCost. Use `|` to separate lines.

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

**Note**: Omit `"disabledWidgets"` field entirely if user chose not to hide any widgets. Omit `"dailyBudget"` if not using budget tracking. Omit `"separator"` if using default pipe style.

### 3. Update settings.json

Add or update the statusLine configuration in `~/.claude/settings.json`:

**Find the plugin path and update settings.json** (copy-paste one-liner):
```bash
jq --arg path "$(ls -d ~/.claude/plugins/cache/claude-dashboard/claude-dashboard/*/dist/index.js 2>/dev/null | sort -V | tail -1)" '.statusLine = {"type": "command", "command": ("node " + $path)}' ~/.claude/settings.json > ~/.claude/settings.json.tmp && mv ~/.claude/settings.json.tmp ~/.claude/settings.json
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
