---
title: Commands
description: All available command reference
sidebar:
  order: 1
---

claude-dashboard provides four commands for setup, usage checking, shell integration, and updating.

## /claude-dashboard:setup

Configure the status line display mode, language, plan, and theme.

### Usage

```bash
# Interactive mode (asks questions)
/claude-dashboard:setup

# Direct mode with arguments
/claude-dashboard:setup [displayMode] [language] [plan] ["customWidgets"]
```

### Arguments

| Argument | Options | Default | Description |
|----------|---------|---------|-------------|
| displayMode | `compact`, `normal`, `detailed`, `custom` | `compact` | Number of lines and widget selection |
| language | `auto`, `en`, `ko` | `auto` | UI language |
| plan | `max`, `pro` | `max` | Subscription plan (affects available rate limit widgets) |
| customWidgets | `"widget1,widget2\|widget3"` | -- | Custom layout (only for `custom` mode) |

### Examples

```bash
/claude-dashboard:setup                          # Interactive
/claude-dashboard:setup compact                  # 1 line, defaults
/claude-dashboard:setup normal en pro            # 2 lines, English, Pro
/claude-dashboard:setup detailed ko max          # 5 lines, Korean, Max
/claude-dashboard:setup custom auto max "model,context,cost|projectInfo,todoProgress"
```

### Notes

- The status line updates on the next message after setup
- Run this command again at any time to change settings
- Interactive mode is best for preset selection; for full widget control, use direct mode or edit the JSON file directly

## /claude-dashboard:check-usage

Check usage limits for all installed AI CLIs and get a recommendation for which one has the most available capacity.

### Usage

```bash
/claude-dashboard:check-usage              # Interactive output with colors
/claude-dashboard:check-usage --json       # JSON output for scripting
/claude-dashboard:check-usage --lang ko    # Specify language
/claude-dashboard:check-usage --lang en    # Specify language
```

### Output

Shows usage for each installed CLI:

- **Claude**: 5h and 7d rate limits with reset times
- **Codex**: 5h and 7d limits with plan info (if installed)
- **Gemini**: Usage percentage with model info (if installed)
- **z.ai**: Token and MCP usage with model info (if configured)

At the bottom, recommends the CLI with the lowest current usage.

## /claude-dashboard:setup-alias

Add a `check-ai` shell alias to quickly check all AI CLI usage from your terminal. Supports macOS/Linux (zsh/bash) and Windows (PowerShell).

### Usage

```bash
/claude-dashboard:setup-alias
```

### After Setup

Once the alias is installed, you can run it directly from your terminal (outside of Claude Code):

```bash
check-ai          # Pretty output
check-ai --json   # JSON output for scripting
```

### Platform Support

- **macOS / Linux**: Adds a shell function to `~/.zshrc` or `~/.bashrc`
- **Windows**: Adds a PowerShell function to your PowerShell profile

### Notes

- The function dynamically finds the latest plugin version, so it continues to work after updates
- Run this command again if you need to reinstall the alias
- The alias works independently of Claude Code

## /claude-dashboard:update

Update the statusLine path in settings.json to point to the latest cached plugin version.

### Usage

```bash
/claude-dashboard:update
```

### When to Use

Run this command after updating the plugin via `/plugin update claude-dashboard`. It ensures that the `statusLine` path in your settings points to the latest installed version.

### What It Does

1. Finds the latest version in the plugin cache directory
2. Updates the `statusLine.command` path in `~/.claude/settings.json`
3. Shows the previous and new version paths

After running this command, restart Claude Code for the changes to take effect.
