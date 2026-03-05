---
title: Troubleshooting
description: Common issues and solutions
sidebar:
  label: Troubleshooting
---

## Status line not showing

1. Check if the plugin is installed by running `/plugin list` in Claude Code.
2. Verify that `~/.claude/settings.json` contains a `statusLine` configuration entry.
3. Restart Claude Code.

If the status line still does not appear after restarting, try running `/claude-dashboard:setup` again to regenerate the configuration.

## Rate limits showing warning

If rate limit widgets display a warning icon instead of percentages:

- **Expired token**: Your API token may have expired. Re-login to Claude Code to refresh it.
- **Network issue**: Check your internet connection.
- **API rate limited**: The dashboard caches API responses for 60 seconds. Wait for the cache to refresh and try again.

## Wrong language

If the status line is showing the wrong language, run the setup command with an explicit language argument:

```
/claude-dashboard:setup normal en    # Set to English
/claude-dashboard:setup normal ko    # Set to Korean
```

You can also edit the configuration file directly at `~/.claude/claude-dashboard.local.json` and change the `"language"` field to `"en"`, `"ko"`, or `"auto"`.

## Cache issues

API response cache is stored in `~/.cache/claude-dashboard/`. If you are experiencing stale data or unexpected behavior, clear the cache:

```bash
rm -rf ~/.cache/claude-dashboard/
```

Cache files are automatically cleaned up after 1 hour, so this is typically only needed when debugging issues.

## Plugin not found after update

If the status line stops working after a plugin update, the path in settings.json may be pointing to an old version. Run:

```bash
/claude-dashboard:update
```

This updates the `statusLine` path to the latest cached version. Restart Claude Code afterward.

## Multi-CLI widgets not appearing

The multi-CLI widgets (`codexUsage`, `geminiUsage`, `zaiUsage`) auto-hide when their respective CLIs are not detected:

- **codexUsage**: Requires `~/.codex/auth.json` to exist
- **geminiUsage / geminiUsageAll**: Requires `~/.gemini/oauth_creds.json` to exist
- **zaiUsage**: Requires detection via `ANTHROPIC_BASE_URL` environment variable

Make sure the corresponding CLI is installed and authenticated before expecting these widgets to appear.
