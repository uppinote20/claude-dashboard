---
description: Check all AI CLI (Claude, Codex, Gemini, z.ai) usage limits and get recommendations
allowed-tools: Bash
---

# Check CLI Usage

Display usage limits for all AI CLIs (Claude, Codex, Gemini, z.ai) and recommend the one with the most available capacity.

## Usage

```bash
# Interactive output with colors
/claude-dashboard:check-usage

# JSON output for scripting
/claude-dashboard:check-usage --json

# Specify language (en or ko)
/claude-dashboard:check-usage --lang ko
/claude-dashboard:check-usage --lang en
```

## Output

Shows usage for each installed CLI:
- **Claude**: 5h and 7d rate limits with reset times
- **Codex**: 5h and 7d limits with plan info (if installed)
- **Gemini**: Usage percentage with model info (if installed)
- **z.ai**: Token and MCP usage with model info (if configured)

At the bottom, recommends the CLI with the lowest current usage.

## Tasks

### 1. Find plugin path and run check-usage script

```bash
node "$(ls -d ~/.claude/plugins/cache/claude-dashboard/claude-dashboard/*/dist/check-usage.js 2>/dev/null | sort -V | tail -1)" $ARGUMENTS
```

This will:
1. Find the latest plugin version dynamically
2. Run the check-usage script
3. Display usage for all CLIs
4. Show recommendation

### 2. Interpret results

If the user wants more details or asks follow-up questions:
- Explain what each metric means
- Suggest when to switch CLIs based on usage
- Note that Codex/Gemini sections only appear if those CLIs are installed
