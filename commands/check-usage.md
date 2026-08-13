---
description: Check all AI CLI (Claude, Codex, Gemini, Antigravity, z.ai) usage limits and get recommendations
allowed-tools: Bash
---

# Check CLI Usage

Display usage limits for all AI CLIs (Claude, Codex, Gemini, Antigravity, z.ai) and recommend the one with the most available capacity.

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
- **Codex**: Rate limits with plan info, if installed — each window is labeled by its actual duration (5h + 7d on Plus, a single 7d on Pro)
- **Gemini**: Usage percentage with model info (if installed)
- **Antigravity**: Weekly quota per model family — Gemini vs Claude+GPT (if installed)
- **z.ai**: Token and MCP usage with model info (if configured)

At the bottom, recommends the CLI with the lowest current usage.

## Tasks

### 1. Find plugin path and run check-usage script

Resolves the newest installed version in `node` rather than shelling out to `sort -V`,
which is a GNU/BSD extension, not POSIX:
```bash
CFGDIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"; SCRIPT="$(CFGDIR="$CFGDIR" node -e '
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
  .filter((v) => fs.existsSync(path.join(cacheRoot, v, "dist/check-usage.js")))
  .sort((a, b) => {
    const pa = a.split(".").map(Number);
    const pb = b.split(".").map(Number);
    return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2];
  });
if (versions.length === 0) {
  console.error("claude-dashboard is not installed in " + cfgDir);
  process.exit(1);
}
console.log(path.join(cacheRoot, versions[versions.length - 1], "dist/check-usage.js"));
')" && node "$SCRIPT" $ARGUMENTS
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
- Note that Codex/Gemini/Antigravity sections only appear if those CLIs are installed
