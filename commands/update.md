---
description: Update statusLine path to latest plugin version
allowed-tools: Read, Bash(node:*), Bash(ls:*), Bash(grep:*), Bash(sort:*), Bash(tail:*), Bash(xargs:*), Bash(basename:*)
---

# Claude Dashboard Update

Update the statusLine path in settings.json to point to the latest cached plugin version.

Run this command after updating the plugin via `/plugin update claude-dashboard`.

## Task

1. Find the latest version in the plugin cache:
```bash
ls -d ~/.claude/plugins/cache/claude-dashboard/claude-dashboard/*/ 2>/dev/null | grep -E '/[0-9]+\.[0-9]+\.[0-9]+/$' | sort -V | tail -1
```

2. Update settings.json with the latest version path. Uses an inline Node.js script — Node is always available because the plugin itself runs on Node, so no extra dependency (like `jq`) is required:
```bash
LATEST_VERSION=$(ls -d ~/.claude/plugins/cache/claude-dashboard/claude-dashboard/*/ 2>/dev/null | grep -E '/[0-9]+\.[0-9]+\.[0-9]+/$' | sort -V | tail -1 | xargs basename)
NEWCMD="node ~/.claude/plugins/cache/claude-dashboard/claude-dashboard/${LATEST_VERSION}/dist/index.js" node -e 'const fs=require("fs"),os=require("os"),p=os.homedir()+"/.claude/settings.json";const s=JSON.parse(fs.readFileSync(p,"utf8"));s.statusLine=s.statusLine||{type:"command"};s.statusLine.command=process.env.NEWCMD;fs.writeFileSync(p,JSON.stringify(s,null,2));'
```

3. Show the user what was updated:
   - Previous version (if changed)
   - New version path
   - Remind them to restart Claude Code for changes to take effect

## Example Output

```
Updated statusLine to version 1.7.0
Path: ~/.claude/plugins/cache/claude-dashboard/claude-dashboard/1.7.0/dist/index.js

Restart Claude Code for changes to take effect.
```
