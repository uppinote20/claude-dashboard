---
description: Add check-ai shell alias for quick CLI usage check
argument-hint: ""
allowed-tools: Bash(echo:*), Bash(cat:*), Bash(grep:*), Bash(uname:*), Bash(powershell*), Read
---

# Setup Shell Alias

Add a `check-ai` command to quickly check all AI CLI usage from your terminal.

## What it does

After setup, you can run:
```bash
check-ai          # Pretty output
check-ai --json   # JSON output for scripting
```

## Tasks

### 1. Detect OS and shell

```bash
uname -s
```

- `Darwin` → macOS
- `Linux` → Linux
- `MINGW*` or `MSYS*` → Windows Git Bash
- Otherwise check if PowerShell is available for Windows

### 2. Based on OS, add the appropriate function

#### macOS / Linux (bash/zsh)

**Check current shell and config file:**
```bash
echo $SHELL
```

- If contains `zsh` → use `~/.zshrc`
- If contains `bash` → use `~/.bashrc`

**Check if already exists:**
```bash
grep -q "^check-ai()" ~/.zshrc 2>/dev/null && echo "exists" || echo "not found"
```

**Function to add** (resolves the newest installed version in `node` rather than shelling
out to `sort -V`, which is a GNU/BSD extension, not POSIX; re-reads `CLAUDE_CONFIG_DIR` on
every call, so it follows account switches instead of freezing the path at definition time):
```bash
# Claude Dashboard - check-ai alias
check-ai() {
  local cfgdir="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
  local script
  script="$(CFGDIR="$cfgdir" node -e '
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
')" || return 1
  node "$script" "$@"
}
```

**Add to config file (example for zsh):**
```bash
cat >> ~/.zshrc << 'EOF'

# Claude Dashboard - check-ai alias
check-ai() {
  local cfgdir="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
  local script
  script="$(CFGDIR="$cfgdir" node -e '
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
')" || return 1
  node "$script" "$@"
}
EOF
```

#### Windows (PowerShell)

**Check if PowerShell profile exists:**
```powershell
powershell -Command "Test-Path $PROFILE"
```

**Check if already exists:**
```powershell
powershell -Command "if (Test-Path $PROFILE) { Select-String -Path $PROFILE -Pattern 'function check-ai' -Quiet } else { $false }"
```

**Function to add:**
```powershell
# Claude Dashboard - check-ai alias
function check-ai {
  $base = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { "$env:USERPROFILE\.claude" }
  $script = (Get-ChildItem "$base\plugins\cache\claude-dashboard\claude-dashboard\*\dist\check-usage.js" | Sort-Object { [version]$_.Directory.Parent.Name } | Select-Object -Last 1).FullName
  node $script $args
}
```

**Add to PowerShell profile:**
```powershell
powershell -Command "Add-Content -Path $PROFILE -Value @'

# Claude Dashboard - check-ai alias
function check-ai {
  `$base = if (`$env:CLAUDE_CONFIG_DIR) { `$env:CLAUDE_CONFIG_DIR } else { \"`$env:USERPROFILE\.claude\" }
  `$script = (Get-ChildItem \"`$base\plugins\cache\claude-dashboard\claude-dashboard\*\dist\check-usage.js\" | Sort-Object { [version]`$_.Directory.Parent.Name } | Select-Object -Last 1).FullName
  node `$script `$args
}
'@"
```

### 3. Show result and next steps

**If already exists:**
```
✓ check-ai is already configured in [config file].

Usage:
  check-ai          # Pretty output
  check-ai --json   # JSON output for scripting
```

**If newly added:**
```
✓ Added check-ai to [config file].

To activate now, run:
  source ~/.zshrc   (or restart your terminal)

Usage:
  check-ai          # Pretty output
  check-ai --json   # JSON output for scripting
```

**For Windows:**
```
✓ Added check-ai to PowerShell profile.

To activate now:
  Restart PowerShell or run: . $PROFILE

Usage:
  check-ai          # Pretty output
  check-ai --json   # JSON output for scripting
```

## Notes

- The function dynamically finds the latest plugin version, so it works after updates
- Run this command again if you need to reinstall the alias
- The alias works independently of Claude Code
