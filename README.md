# claude-dashboard

Comprehensive status line plugin for Claude Code with context usage, API rate limits, cost tracking, and modular widget system.

## Features

- 🤖 **Model Display**: Shows current model (Opus, Sonnet, Haiku)
- 📊 **Progress Bar**: Color-coded context usage (green → yellow → red)
- 📈 **Token Count**: Current/total tokens in K/M format
- 💰 **Cost Tracking**: Cumulative session cost in USD
- ⏱️ **Rate Limits**: 5h session limit with reset countdown, 7d usage
- 📁 **Project Info**: Directory name with git branch
- 🔧 **Config Counts**: CLAUDE.md, rules, MCPs, hooks counts
- ⚙️ **Tool Activity**: Running/completed tools tracking
- ⏱️ **Session Duration**: Session time tracking
- 🤖 **Agent Status**: Subagent progress tracking
- ✓ **Todo Progress**: Task completion rate
- 🌐 **i18n**: English and Korean support (auto-detect)
- 📐 **Multi-line**: Compact (1), Normal (2), Detailed (3) line modes

## Output Examples

**Compact (1 line) - Default:**
```
🤖 Opus │ ████████░░ 80% │ 160K/200K │ $1.25 │ 5h: 42% (2h30m) │ 7d: 69% │ 7d-S: 2%
```

**Normal (2 lines):**
```
🤖 Opus │ ████████░░ 80% │ 160K/200K │ $1.25 │ 5h: 42% (2h30m) │ 7d: 69% │ 7d-S: 2%
📁 project (main) │ ⏱ 45m │ ✓ 3/5
```

**Detailed (3 lines):**
```
🤖 Opus │ ████████░░ 80% │ 160K/200K │ $1.25 │ 5h: 42% (2h30m) │ 7d: 69% │ 7d-S: 2%
📁 project (main) │ ⏱ 45m │ ✓ 3/5
CLAUDE.md: 2 │ ⚙️ 12 done │ 🤖 Agent: 1
```

**Korean:**
```
🤖 Opus │ ████████░░ 80% │ 160K/200K │ $1.25 │ 5시간: 42% (2시간30분) │ 7일: 69% │ 7일-S: 2%
📁 project (main) │ ⏱ 45분 │ 할일: 3/5
```

## Installation

### From Plugin Marketplace

```
/plugin marketplace add uppinote20/claude-dashboard
/plugin install claude-dashboard
/claude-dashboard:setup
```

### Manual Installation

1. Clone the repository:
```bash
git clone https://github.com/uppinote20/claude-dashboard.git ~/.claude/plugins/claude-dashboard
```

2. Run setup:
```
/claude-dashboard:setup
```

## Configuration

### Interactive Mode

Run `/claude-dashboard:setup` without arguments to use interactive mode:

```
/claude-dashboard:setup
→ Display mode? [compact/normal/detailed/custom]
→ (For custom: select widgets for each line)
```

> **Note**: Interactive mode is best for preset selection (compact/normal/detailed).
> For custom mode, widget order follows the option list order, and only 4 widgets
> can be shown per question. For full control, use **Direct Mode** or edit the JSON file.

### Direct Mode

```bash
# Preset modes
/claude-dashboard:setup compact             # 1 line (default)
/claude-dashboard:setup normal en pro       # 2 lines, English, Pro plan
/claude-dashboard:setup detailed ko max     # 3 lines, Korean, Max plan

# Custom mode: full control over widget order and line composition
# Format: "widget1,widget2,...|widget3,widget4,..." (| separates lines)
/claude-dashboard:setup custom auto max "model,context,cost|projectInfo,todoProgress"
/claude-dashboard:setup custom auto max "model,projectInfo,cost,rateLimit5h"  # 1 line, custom order
/claude-dashboard:setup custom auto max "context,model|todoProgress,sessionDuration|configCounts"  # 3 lines
```

### Available Widgets

| Widget | Description |
|--------|-------------|
| `model` | Model name with emoji |
| `context` | Progress bar, percentage, tokens |
| `cost` | Session cost in USD |
| `rateLimit5h` | 5-hour rate limit |
| `rateLimit7d` | 7-day rate limit (Max only) |
| `rateLimit7dSonnet` | 7-day Sonnet limit (Max only) |
| `projectInfo` | Directory name + git branch |
| `configCounts` | CLAUDE.md, rules, MCPs, hooks |
| `sessionDuration` | Session duration |
| `toolActivity` | Running/completed tools |
| `agentStatus` | Subagent progress |
| `todoProgress` | Todo completion rate |

### Display Mode Presets

| Mode | Lines | Line 1 | Line 2 | Line 3 |
|------|-------|--------|--------|--------|
| `compact` | 1 | model, context, cost, rateLimit5h, rateLimit7d, rateLimit7dSonnet | - | - |
| `normal` | 2 | (same as compact) | projectInfo, sessionDuration, todoProgress | - |
| `detailed` | 3 | (same as compact) | (same as normal) | configCounts, toolActivity, agentStatus |

### Configuration File

Settings are stored in `~/.claude/claude-dashboard.local.json`:

```json
{
  "language": "auto",
  "plan": "max",
  "displayMode": "compact",
  "cache": {
    "ttlSeconds": 60
  }
}
```

**Custom configuration:**
```json
{
  "language": "auto",
  "plan": "max",
  "displayMode": "custom",
  "lines": [
    ["model", "context", "cost", "rateLimit5h"],
    ["projectInfo", "todoProgress"]
  ],
  "cache": {
    "ttlSeconds": 60
  }
}
```

## Requirements

- **Claude Code** v1.0.80+
- **Node.js** 18+

## Color Legend

| Color | Usage % | Meaning |
|-------|---------|---------|
| 🟢 Green | 0-50% | Safe |
| 🟡 Yellow | 51-80% | Warning |
| 🔴 Red | 81-100% | Critical |

## Plan Differences

| Feature | Max | Pro |
|---------|-----|-----|
| 5h rate limit | ✅ | ✅ |
| Reset countdown | ✅ | ✅ |
| 7d all models | ✅ | ❌ |

## Troubleshooting

### Status line not showing

1. Check if plugin is installed: `/plugin list`
2. Verify settings.json has statusLine config
3. Restart Claude Code

### Rate limits showing ⚠️

- API token may be expired - re-login to Claude Code
- Network issue - check internet connection
- API rate limited - wait 60 seconds for cache refresh

### Wrong language

Run setup with explicit language:
```
/claude-dashboard:setup normal ko  # Korean
/claude-dashboard:setup normal en  # English
```

### Cache Issues

API response cache is stored in `~/.cache/claude-dashboard/`. To clear:

```bash
rm -rf ~/.cache/claude-dashboard/
```

Cache files are automatically cleaned up after 1 hour.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Test locally
echo '{"model":{"display_name":"Opus"},"workspace":{"current_dir":"/tmp"},"context_window":{"context_window_size":200000,"current_usage":{"input_tokens":50000,"output_tokens":0,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}},"cost":{"total_cost_usd":0.5}}' | node dist/index.js
```

## License

MIT
