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
  - `detailed`: 4 lines (+ depletionTime, configCounts, toolActivity, agentStatus, cacheHit, codexUsage, geminiUsage)
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
| `projectInfo` | Directory name + git branch + ahead/behind (↑↓) |
| `configCounts` | CLAUDE.md, rules, MCPs, hooks counts |
| `sessionId` | Session ID (short 8 chars) |
| `sessionIdFull` | Session ID (full UUID) |
| `sessionDuration` | Session duration |
| `toolActivity` | Running/completed tools |
| `agentStatus` | Subagent progress |
| `todoProgress` | Todo completion rate |
| `burnRate` | Token consumption per minute |
| `cacheHit` | Cache hit rate percentage |
| `depletionTime` | Estimated time to rate limit |
| `codexUsage` | OpenAI Codex CLI usage (auto-hide if not installed) |
| `geminiUsage` | Google Gemini CLI usage - current model (auto-hide if not installed) |
| `geminiUsageAll` | Google Gemini CLI usage - all models (auto-hide if not installed) |
| `zaiUsage` | z.ai/ZHIPU usage (auto-hide if not using z.ai) |

## Tasks

### 1. Determine configuration

**If no arguments provided (interactive mode):**

Use AskUserQuestion to ask the user:

1. First question: Display mode selection
   - Options: compact (recommended), normal, detailed, custom

2. If "custom" selected, ask for each line:
   - Line 1 widgets (multi-select from available widgets)
   - Ask if they want to add Line 2
   - If yes, Line 2 widgets (multi-select)
   - Ask if they want to add Line 3
   - Continue until they say no (no line limit)

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
  "theme": "default",
  "cache": {
    "ttlSeconds": 60
  }
}
```

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
  "theme": "default",
  "cache": {
    "ttlSeconds": 60
  }
}
```

### Optional Config Fields

- `"theme"`: Color theme — `"default"` | `"minimal"` | `"catppuccin"` | `"dracula"` | `"gruvbox"`
- `"disabledWidgets"`: Array of widget IDs to hide — e.g. `["codexUsage", "cacheHit"]`

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

### 4. Show example output

Display what the status line will look like based on their configuration:

**Compact (1 line) - Default:**
```
🤖 Opus(H) │ ████████░░ 80% │ 160K/200K │ $1.25 │ 5h: 42% (2h30m) │ 7d: 69% │ 7d-S: 2%
```

**Normal (2 lines):**
```
🤖 Opus(H) ↯ │ ████████░░ 80% │ 160K/200K │ $1.25 │ 5h: 42% (2h30m) │ 7d: 69% │ 7d-S: 2%
📁 project (main ↑3) │ 🔑 abc12345 │ ⏱ 45m │ 🔥 5K/m │ ✓ 3/5
```

**Detailed (4 lines):**
```
🤖 Opus(H) ↯ │ ████████░░ 80% │ 160K/200K │ $1.25 │ 5h: 42% (2h30m) │ 7d: 69% │ 7d-S: 2%
📁 project (main ↑3↓1) │ 🔑 abc12345 │ ⏱ 45m │ 🔥 5K/m │ ⏳ 2h15m │ ✓ 3/5
CLAUDE.md: 2 │ ⚙️ 12 done │ 🤖 Agent: 1 │ 📦 85%
🔷 gpt-5.2-codex │ 5h: 15% │ 7d: 5% │ 💎 gemini-2.0-flash │ 0% (23h59m) │ 🟠 GLM │ 5h: 23% │ 1m: 45%
```

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
