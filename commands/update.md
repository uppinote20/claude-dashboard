---
description: Repair or verify the statusLine shim (usually automatic)
allowed-tools: Read, Bash(node:*), Bash(mkdir:*), Bash(cp:*), Bash(ls:*), Bash(sort:*), Bash(tail:*)
---

# Claude Dashboard Update

Ensure `statusLine` points at the version-agnostic shim. Normally unnecessary — a
`SessionStart` hook does this automatically. Use it when hooks are disabled, or to
diagnose a status line that is not updating.

## Task

1. Install or refresh the shim, then point settings.json at it:
```bash
CFGDIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"; SRC="$(ls -d "$CFGDIR"/plugins/cache/claude-dashboard/claude-dashboard/*/scripts/statusline-shim.mjs 2>/dev/null | sort -V | tail -1)"; DATADIR="$CFGDIR/plugins/data/claude-dashboard-claude-dashboard"; mkdir -p "$DATADIR" && cp "$SRC" "$DATADIR/statusline.mjs" && SLPATH="$DATADIR/statusline.mjs" CFGDIR="$CFGDIR" node -e 'const fs=require("fs"),p=process.env.CFGDIR+"/settings.json";const s=fs.existsSync(p)?JSON.parse(fs.readFileSync(p,"utf8")):{};const q=process.env.SLPATH.includes(" ")?`"${process.env.SLPATH}"`:process.env.SLPATH;s.statusLine={type:"command",command:"node "+q};fs.writeFileSync(p,JSON.stringify(s,null,2));'
```

2. Report which build the shim resolves to:
```bash
ls -d "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/plugins/cache/claude-dashboard/claude-dashboard/*/dist/index.js 2>/dev/null | sort -V | tail -1
```

3. Tell the user:
   - Whether settings.json changed or was already correct
   - Which build the shim currently resolves to
   - That no restart is needed — settings.json changes take effect at the next interaction

## Example Output

```
statusLine already points at the shim — no change needed.
Shim: ~/.claude/plugins/data/claude-dashboard-claude-dashboard/statusline.mjs
Resolves to: 1.31.1

Future plugin updates apply automatically.
```
