# claude-dashboard

![License](https://img.shields.io/github/license/uppinote20/claude-dashboard)
![Stars](https://img.shields.io/github/stars/uppinote20/claude-dashboard)

Comprehensive status line plugin for Claude Code with context usage, API rate limits, cost tracking, and modular widget system.

## Demo

![Demo](demo.gif)

## Installation

**Requirements:** Claude Code v1.0.80+ / Node.js 18+

### From Plugin Marketplace

```
/plugin marketplace add uppinote20/claude-dashboard
/plugin install claude-dashboard
/claude-dashboard:setup
```

### Manual Installation

```bash
git clone https://github.com/uppinote20/claude-dashboard.git ~/.claude/plugins/claude-dashboard
/claude-dashboard:setup
```

## Display Modes

**Compact (1 line) - Default:**

![Compact](images/compact.png)

> Model, context progress bar, cost, rate limits (5h/7d/7d-Sonnet) or z.ai usage (mutually exclusive by provider)

**Normal (2 lines):**

![Normal](images/normal.png)

> Adds project info, session ID, session duration, burn rate, todo progress

**Detailed (6 lines):**

![Detailed](images/detailed.png)

> Adds depletion time, config counts, tool/agent status, cache hit, performance badge, token breakdown, forecast, budget, Codex/Gemini usage

Multi-provider support: z.ai/ZHIPU, Codex, Gemini auto-detected when installed.


## Widgets

| Category | Widget | Description |
|----------|--------|-------------|
| **Core** | `model` | Model name with emoji, effort level for Opus/Sonnet (X/H/M/L), fast mode for Opus (↯) |
| | `context` | Progress bar, percentage, tokens (🟢 0-50% / 🟡 51-80% / 🔴 81-100%) |
| | `contextBar` | Progress bar only (sub-widget of `context`) |
| | `contextPercentage` | Percentage only (sub-widget of `context`) |
| | `contextUsage` | Token count only, e.g. `42K/200K` (sub-widget of `context`) |
| | `cost` | Session cost in USD |
| | `projectInfo` | Directory + git branch (clickable OSC8 link) + ahead/behind (↑↓), subpath from project_dir, worktree indicator (🌳) |
| **Rate Limits** | `rateLimit5h` | 5-hour rate limit with reset countdown |
| | `rateLimit7d` | 7-day rate limit (Pro and Max) |
| | `rateLimit7dSonnet` | 7-day Sonnet limit (Max only) |
| **Session** | `sessionId` | Session ID (short 8-char) |
| | `sessionIdFull` | Session ID (full UUID) |
| | `sessionName` | Session name from /rename command |
| | `sessionDuration` | Session duration |
| | `lastPrompt` | Last user prompt with timestamp |
| | `configCounts` | CLAUDE.md, AGENTS.md, rules, MCPs, hooks, +Dirs |
| **Activity** | `toolActivity` | Running/completed tools with targets (e.g., `Read(app.ts)`) |
| | `agentStatus` | Subagent progress |
| | `todoProgress` | Todo completion rate |
| **Analytics** | `burnRate` | Token consumption per minute |
| | `cacheHit` | Cache hit rate percentage |
| | `depletionTime` | Estimated time to rate limit (approx)¹ |
| **Multi-CLI** | `codexUsage` | OpenAI Codex CLI usage (auto-hide if not installed)² |
| | `geminiUsage` | Google Gemini CLI - current model (auto-hide if not installed)³ |
| | `geminiUsageAll` | Google Gemini CLI - all models (auto-hide if not installed)³ |
| | `zaiUsage` | z.ai/ZHIPU usage (auto-hide if not using z.ai)⁴ |
| **Insights** | `tokenBreakdown` | Input/output/cache write/read token breakdown |
| | `performance` | Composite efficiency badge (cache hit + output ratio) |
| | `forecast` | Estimated hourly cost based on session rate |
| | `budget` | Daily spending vs configured budget limit⁵ |
| | `tokenSpeed` | Output token generation speed (tok/s) |
| | `todayCost` | Total spending across all sessions today |
| **Status** | `peakHours` | Peak hours indicator with countdown ([based on PeakClaude](https://github.com/pforret/PeakClaude))⁶ |
| | `tagStatus` | Commits ahead of matched git tags (default pattern `v*`, customize via `tagPatterns`)⁷ |
| **Info** | `linesChanged` | Uncommitted lines added/removed, including untracked files (+N -N) |
| | `outputStyle` | Current output style (hidden when "default") |
| | `version` | Claude Code version display |
| | `vimMode` | Vim mode (NORMAL/INSERT), auto-hides when vim disabled |
| | `apiDuration` | API time as % of total session time |

> ¹ Assumes all utilization came from this session; improves as session runs longer.
> ² Auto-hides if `~/.codex/auth.json` not found. ³ Auto-hides if `~/.gemini/oauth_creds.json` not found. ⁴ Auto-hides if not detected via `ANTHROPIC_BASE_URL`. ⁵ Requires `"dailyBudget"` in config. ⁶ Peak = weekdays 5-11 AM PT; shows countdown to next transition. ⁷ Uses `tagPatterns` config (default `["v*"]`); auto-hides when no pattern matches a reachable tag.

i18n: English and Korean supported (auto-detect or set via setup).

## Configuration

```bash
# Preset modes
/claude-dashboard:setup compact             # 1 line (default)
/claude-dashboard:setup normal en pro       # 2 lines, English, Pro plan
/claude-dashboard:setup detailed ko max     # 6 lines, Korean, Max plan

# Custom mode: control widget order and line composition
# Format: "widget1,widget2,...|widget3,widget4,..." (| separates lines)
/claude-dashboard:setup custom auto max "model,context,cost|projectInfo,todoProgress"
```

**Plan differences:**

| Feature | Max | Pro |
|---------|-----|-----|
| 5h rate limit + countdown | ✅ | ✅ |
| 7d all models | ✅ | ❌ |

<details>
<summary><strong>Advanced Configuration</strong></summary>

**Interactive Mode:** Run `/claude-dashboard:setup` without arguments. Best for preset selection; for full widget control, use Direct Mode or edit the JSON file directly.

**Display Mode Presets** (`zaiUsage` and `rateLimit*` are mutually exclusive based on provider):

| Mode | Lines | Widgets |
|------|-------|---------|
| `compact` | 1 | model, context, cost, rateLimit5h/7d/7dSonnet, zaiUsage |
| `normal` | 2 | + projectInfo, sessionId, sessionDuration, burnRate, todoProgress |
| `detailed` | 6 | + depletionTime, configCounts, toolActivity, agentStatus, cacheHit, performance, tokenBreakdown, forecast, budget, codexUsage, geminiUsage, linesChanged, outputStyle, version, peakHours, lastPrompt |

**Configuration file** (`~/.claude/claude-dashboard.local.json`):

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
  "cache": { "ttlSeconds": 60 }
}
```

Or use preset shorthand for quick configuration:
```json
{
  "preset": "MC$R|BDO",
  "theme": "tokyoNight",
  "separator": "dot"
}
```

**Themes:** `default` (pastel) / `minimal` (monochrome) / `catppuccin` / `catppuccinLatte` (light-mode) / `dracula` / `gruvbox` / `nord` / `tokyoNight` / `solarized`

**Separators:** `pipe` (│, default) / `space` / `dot` (·) / `arrow` (›)

**Preset Shortcuts:** Quick layout with single characters — `"preset": "MC$R|BDO"` (M=model, C=context, $=cost, R=rateLimit5h, etc.)

**Budget Tracking:** Set `"dailyBudget": 15` to track daily spending. Shows ⚠️ at 80% and 🚨 at 95%.

**Tag Status:** Customize `tagStatus` patterns via `"tagPatterns": ["v*", "release-*"]`. Default is `["v*"]`. The widget auto-hides when no pattern matches a reachable tag.

**Widget Toggle:** Add widget IDs to `disabledWidgets` to hide them from any display mode.

**Color Legend:** 🟢 0-50% Safe / 🟡 51-80% Warning / 🔴 81-100% Critical

</details>

## Commands

### `/claude-dashboard:setup`

Configure the status line display mode, language, and plan. See [Configuration](#configuration).

### `/claude-dashboard:check-usage`

Check usage limits for all AI CLIs (Claude, Codex, Gemini, z.ai) at once and get a recommendation for which CLI has the most available capacity.

```bash
/claude-dashboard:check-usage              # Interactive output with colors
/claude-dashboard:check-usage --json       # JSON output for scripting
/claude-dashboard:check-usage --lang ko    # Specify language
```

![check-usage](images/check-usage.png)

### `/claude-dashboard:setup-alias`

Add a `check-ai` shell alias to quickly check all AI CLI usage from your terminal. Supports macOS/Linux (zsh/bash) and Windows (PowerShell).

```bash
/claude-dashboard:setup-alias
```

After setup:
```bash
check-ai          # Pretty output
check-ai --json   # JSON output for scripting
```

### `/claude-dashboard:update`

Update the plugin and refresh the statusLine path in settings. Run after updating via git pull or marketplace.

```bash
/claude-dashboard:update
```

## Troubleshooting

<details>
<summary><strong>Status line not showing</strong></summary>

1. Check if plugin is installed: `/plugin list`
2. Verify settings.json has statusLine config
3. Restart Claude Code

</details>

<details>
<summary><strong>Rate limits showing ⚠️</strong></summary>

- API token may be expired - re-login to Claude Code
- Network issue - check internet connection
- API rate limited - wait 60 seconds for cache refresh

</details>

<details>
<summary><strong>Wrong language</strong></summary>

Run setup with explicit language:

```
/claude-dashboard:setup normal ko  # Korean
/claude-dashboard:setup normal en  # English
```

</details>

<details>
<summary><strong>Cache issues</strong></summary>

API response cache is stored in `~/.cache/claude-dashboard/`. To clear:

```bash
rm -rf ~/.cache/claude-dashboard/
```

Cache files are automatically cleaned up after 1 hour.

</details>

## Development

```bash
npm install && npm run build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=uppinote20/claude-dashboard&type=Date)](https://star-history.com/#uppinote20/claude-dashboard&Date)

## License

MIT
