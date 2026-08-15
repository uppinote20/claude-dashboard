---
description: Repair or verify the statusLine shim (usually automatic)
allowed-tools: Read, Bash(node:*)
---

# Claude Dashboard Update

Ensure `statusLine` points at the version-agnostic shim. Normally unnecessary — a
`SessionStart` hook does this automatically. Use it when hooks are disabled, or to
diagnose a status line that is not updating.

## Task

1. Before making any changes, read the current `statusLine.command` value from
   `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json` (if the file exists), so step 4 can
   report an actual before/after instead of guessing.

2. Install or refresh the shim, then point settings.json at it. Resolves the newest
   installed version in `node` rather than shelling out to `sort -V`, which is a GNU/BSD
   extension, not POSIX:
```bash
CFGDIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"; CFGDIR="$CFGDIR" node -e '
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
  .filter((v) => fs.existsSync(path.join(cacheRoot, v, "scripts/statusline-shim.mjs")))
  .sort((a, b) => {
    const pa = a.split(".").map(Number);
    const pb = b.split(".").map(Number);
    return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2];
  });
if (versions.length === 0) {
  console.error("claude-dashboard is not installed in " + cfgDir);
  process.exit(1);
}
const src = path.join(cacheRoot, versions[versions.length - 1], "scripts/statusline-shim.mjs");
const dataDir = path.join(cfgDir, "plugins/data/claude-dashboard-claude-dashboard");
fs.mkdirSync(dataDir, { recursive: true });
const dest = path.join(dataDir, "statusline.mjs");
fs.copyFileSync(src, dest);
const settingsPath = path.join(cfgDir, "settings.json");
const settings = fs.existsSync(settingsPath) ? JSON.parse(fs.readFileSync(settingsPath, "utf8")) : {};
const statusLine = settings.statusLine && typeof settings.statusLine === "object" ? settings.statusLine : {};
statusLine.type = "command";
statusLine.command = "node " + JSON.stringify(dest);
settings.statusLine = statusLine;
fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
'
```

3. Report which build the shim resolves to. The filter here is `dist/index.js`, not step 2's
   `scripts/statusline-shim.mjs`, and the divergence is deliberate: step 2 picks a version to
   copy the shim *from*, while this step mirrors what the shim resolves *to* at render time —
   and `resolveLatestDist` skips any version without a `dist/index.js`. A half-installed
   version rightly shows up in one and not the other:
```bash
CFGDIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}" node -e '
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
  .filter((v) => fs.existsSync(path.join(cacheRoot, v, "dist/index.js")))
  .sort((a, b) => {
    const pa = a.split(".").map(Number);
    const pb = b.split(".").map(Number);
    return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2];
  });
if (versions.length === 0) {
  console.error("claude-dashboard is not installed in " + cfgDir);
  process.exit(1);
}
console.log(path.join(cacheRoot, versions[versions.length - 1], "dist/index.js"));
'
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
