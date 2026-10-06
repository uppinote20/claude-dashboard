# surface-probe

A diagnostic mod (not shipped with the dashboard) that answers "why don't
`/claude-dashboard-pane` / `/claude-dashboard-band` show up on this client?".

A client draws a mod only after it joins the session's roster of surfaces
(`session.attach`) and sends `ui.render` asks. `/surface-probe` reports:

- `surfaces(now)` / `surfaces(at load)`: the roster (`terminal`, `desktop`, `mobile`, `vscode`)
- `renders`: the `ui.render` asks seen since load, as `<Component>@<surface>×<count>`
  (`Pane@…` for the pane, `AbovePrompt@…` for the band)
- `events`: attach/detach timeline (UTC)

It also fires a toast, a status entry and a log line (`TOAST` / `STATUS` / `LOG test`);
note which ones the client shows.

## Run it

Terminal:

```bash
claude --plugin-dir ./tools/surface-probe --plugin-dir .
```

Desktop app local session (no flag possible): add the absolute path to the `env`
block of `~/.claude/settings.json`, then start a new session:

```json
{ "env": { "CLAUDE_CODE_PLUGIN_DIRS": "/abs/path/claude-dashboard/tools/surface-probe" } }
```

Then open the dashboard (`/claude-dashboard-pane`, `/claude-dashboard-band on`),
look at the session from the client under test (e.g. the mobile app), and run
`/surface-probe`.

## Reading the result

| Result | Meaning |
|--------|---------|
| `surfaces=[]`, `renders=[]` | Nothing draws for this session (e.g. a cloud session opened from the desktop app). No plugin change can help. |
| `mobile` in surfaces, no `…@mobile` renders | The client attached but has no slot for the pane/band. |
| `AbovePrompt@mobile` renders | The client asks for the band; the dashboard skips it because `BAND_SURFACES` (`scripts/mod/register.tsx`) lists only `terminal`/`desktop`. |
| `Pane@mobile` renders but nothing visible | The pane is asked for and drawn; check the client side. |
