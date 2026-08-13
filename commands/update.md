---
description: Repair or verify the statusLine shim (usually automatic)
allowed-tools: Read, Bash(node:*), Bash(mkdir:*), Bash(cp:*), Bash(ls:*), Bash(sort:*), Bash(tail:*), Bash(grep:*)
---

# Claude Dashboard Update

Ensure `statusLine` points at the version-agnostic shim. Normally unnecessary — a
`SessionStart` hook does this automatically. Use it when hooks are disabled, or to
diagnose a status line that is not updating.

## Task

1. Before making any changes, read the current `statusLine.command` value from
   `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json` (if the file exists), so step 4 can
   report an actual before/after instead of guessing.

2. Install or refresh the shim, then point settings.json at it:
```bash
CFGDIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"; SRC="$(ls -d "$CFGDIR"/plugins/cache/claude-dashboard/claude-dashboard/*/scripts/statusline-shim.mjs 2>/dev/null | sort -V | tail -1)"; DATADIR="$CFGDIR/plugins/data/claude-dashboard-claude-dashboard"; mkdir -p "$DATADIR" && cp "$SRC" "$DATADIR/statusline.mjs" && SLPATH="$DATADIR/statusline.mjs" CFGDIR="$CFGDIR" node -e 'const fs=require("fs"),p=process.env.CFGDIR+"/settings.json";const s=fs.existsSync(p)?JSON.parse(fs.readFileSync(p,"utf8")):{};const q=process.env.SLPATH.includes(" ")?`"${process.env.SLPATH}"`:process.env.SLPATH;const sl=(s.statusLine&&typeof s.statusLine==="object")?s.statusLine:{};sl.type="command";sl.command="node "+q;s.statusLine=sl;fs.writeFileSync(p,JSON.stringify(s,null,2));'
```

3. Report which build the shim resolves to:
```bash
ls -d "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/plugins/cache/claude-dashboard/claude-dashboard/*/dist/index.js 2>/dev/null | grep -E '/[0-9]+\.[0-9]+\.[0-9]+/dist/index\.js$' | sort -V | tail -1
```

4. Tell the user:
   - Whether `statusLine.command` changed from the value read in step 1, or was already correct
   - Which build the shim currently resolves to
   - That no restart is needed — settings.json changes take effect at the next interaction

## Example Output

```
statusLine already points at the shim — no change needed.
Shim: ~/.claude/plugins/data/claude-dashboard-claude-dashboard/statusline.mjs
Resolves to: 1.31.1

Future plugin updates apply automatically.
```
