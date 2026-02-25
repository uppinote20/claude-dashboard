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

**Function to add:**
```bash
# Claude Dashboard - check-ai alias
check-ai() {
  node "$(ls -d ~/.claude/plugins/cache/claude-dashboard/claude-dashboard/*/dist/check-usage.js 2>/dev/null | sort -V | tail -1)" "$@"
}
```

**Add to config file (example for zsh):**
```bash
cat >> ~/.zshrc << 'EOF'

# Claude Dashboard - check-ai alias
check-ai() {
  node "$(ls -d ~/.claude/plugins/cache/claude-dashboard/claude-dashboard/*/dist/check-usage.js 2>/dev/null | sort -V | tail -1)" "$@"
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
  $script = (Get-ChildItem "$env:USERPROFILE\.claude\plugins\cache\claude-dashboard\claude-dashboard\*\dist\check-usage.js" | Sort-Object { [version]$_.Directory.Parent.Name } | Select-Object -Last 1).FullName
  node $script $args
}
```

**Add to PowerShell profile:**
```powershell
powershell -Command "Add-Content -Path $PROFILE -Value @'

# Claude Dashboard - check-ai alias
function check-ai {
  `$script = (Get-ChildItem \"`$env:USERPROFILE\.claude\plugins\cache\claude-dashboard\claude-dashboard\*\dist\check-usage.js\" | Sort-Object { [version]`$_.Directory.Parent.Name } | Select-Object -Last 1).FullName
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
