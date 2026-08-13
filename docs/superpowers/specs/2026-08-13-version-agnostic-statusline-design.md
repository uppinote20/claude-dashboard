# Version-agnostic statusLine path — Design

- **Date**: 2026-08-13
- **Status**: Approved design (pre-implementation)
- **Branch**: `feat/version-agnostic-statusline`

## 1. Motivation

`settings.json` stores an absolute, **version-pinned** path:

```json
{ "statusLine": { "command": "node ~/.claude/plugins/cache/claude-dashboard/claude-dashboard/1.31.0/dist/index.js" } }
```

`/plugin update claude-dashboard` adds a new version directory but cannot touch
`settings.json`, so the user keeps executing the **old** `dist/index.js` until they run
`/claude-dashboard:update` and restart. Three consequences, in increasing severity:

1. **Fixes silently do not land.** Observed on 2026-08-13: after updating to 1.31.1 — which
   contains the Codex window-label fix (`38fcaa5`, PR #86) — the status line still rendered
   `5h: 0% (6d23h)` for a Pro account whose only window is weekly. The 1.31.0 binary was
   still running and had written a cache entry with no `windowSeconds` key; because the
   default cache TTL is 300s (`scripts/types.ts:296`), the stale-format entry survived even
   a fresh 1.31.1 invocation until it expired.
2. **The old build actively re-poisons shared state.** While the pinned old binary runs, it
   keeps rewriting `~/.cache/claude-dashboard/*.json` in the old shape, so even a correctly
   invoked new build reads degraded data for up to one TTL window.
3. **The pinned path can become dangling.** Claude Code documents old version directories as
   ephemeral: *"The previous version's directory remains on disk for a grace period after an
   update, but treat it as ephemeral."* Once swept, the pinned path resolves to nothing and
   the status line disappears entirely.

Goal: after a one-time migration, `settings.json` never needs to change again, and no user
action is required to pick up a new plugin version.

## 2. Grounded facts

Facts confirmed from the official docs (`code.claude.com/docs/en/statusline`,
`code.claude.com/docs/en/plugins-reference`) and from the local install on 2026-08-13.

| Aspect | Finding |
|---|---|
| Plugin-declared statusLine | **Not possible.** A plugin may ship its own `settings.json`, but *"Only the `agent` and `subagentStatusLine` keys are supported"*. The main `statusLine` must live in user settings. |
| How `command` runs | *"The `command` field runs in a shell, so you can also use inline commands instead of a script file."* |
| `${CLAUDE_PLUGIN_ROOT}` in user `settings.json` | **Not expanded.** The substitution table lists only skill/agent content, hook and monitor commands, MCP servers, and LSP servers. User `settings.json` is not a plugin component. The variable is also version-pinned by definition, so it would not solve the problem even if expanded. |
| `${CLAUDE_PLUGIN_DATA}` | *"Persistent directory that survives plugin updates, created on first reference"*, resolving to `~/.claude/plugins/data/{id}/` where `{id}` is the plugin identifier with characters outside `a-zA-Z0-9_-` replaced by `-`. For `claude-dashboard@claude-dashboard` → `~/.claude/plugins/data/claude-dashboard-claude-dashboard/`. Naming convention verified locally against existing entries (`fablize-fablize`, `hookify-claude-plugins-official`). |
| Old version directories | Kept for *"a grace period"* after an update, then swept. |
| Uninstall | *"uninstalling from the last remaining scope also deletes the plugin's `${CLAUDE_PLUGIN_DATA}` directory"* (unless `--keep-data`). |
| Windows execution | Status line commands run through **Git Bash when installed, or PowerShell when absent**. |

### Consequence of the Windows fact

An inline self-resolving command such as
`node "$(ls -d …/*/dist/index.js | sort -V | tail -1)"` was considered and **rejected**: it
is bash-only and breaks for PowerShell users. The command string must stay in the portable
`node <path>` shape.

## 3. Approach

**A stable shim in `${CLAUDE_PLUGIN_DATA}`, installed and migrated to by a `SessionStart`
hook.**

`settings.json` points at a path that never changes:

```
node ~/.claude/plugins/data/claude-dashboard-claude-dashboard/statusline.mjs
```

The shim resolves the newest `dist/index.js` at render time. Knowledge of "which version"
moves from user-owned config (which the plugin cannot edit) down to plugin-owned state
(which it can refresh automatically) — that inversion is the whole design.

The shim must live in `PLUGIN_DATA`, not `PLUGIN_ROOT`: `PLUGIN_ROOT` *is* the version
directory, so anchoring a stable path there would be self-defeating.

### Rejected alternatives

- **Inline shell resolution in `settings.json`** — bash-only (§2), and leaves an opaque
  string in the user's config.
- **Hook re-pins `settings.json` every session** — no new file and zero runtime cost, but
  writes user config on every version change, always reflects one session late, and leaves
  the dangling-path window of §1.3 open.

## 4. Architecture & files

**New**

- `scripts/statusline-shim.mjs` — shim template, bundled in the plugin. Copied to
  `PLUGIN_DATA` by the hook; not executed from its bundled location.
- `hooks/hooks.json` — registers the `SessionStart` hook (standard plugin layout,
  auto-discovered).
- `hooks/ensure-statusline.mjs` — shim sync + settings migration.
- `scripts/__tests__/statusline-shim.test.ts` — version resolution.
- `scripts/__tests__/ensure-statusline.test.ts` — migration branches.

**Modified**

- `commands/setup.md` — copy `scripts/statusline-shim.mjs` from the newest cache directory
  into `PLUGIN_DATA` (creating it if absent), then write the shim path instead of the
  versioned path. Setup must not depend on the hook having run.
- `commands/update.md` — redefined (§7).
- Docs: `README.md`, `CLAUDE.md`, `website/src/content/docs/` (EN + KO: `troubleshooting`,
  `reference/commands`).

`dist/` is unchanged by this work: the shim and hook are plain `.mjs` shipped as-is, not
bundled through esbuild. The shim is deliberately dependency-free so it cannot break when
the bundle changes.

## 5. Shim resolution contract

```
~/.claude/plugins/
├── data/claude-dashboard-claude-dashboard/statusline.mjs   ← shim lives here (stable)
└── cache/claude-dashboard/claude-dashboard/<version>/dist/index.js  ← resolved at runtime
```

The shim derives the cache root **from its own location** via `import.meta.url`
(`…/plugins/data/{id}/` → `…/plugins/cache/claude-dashboard/claude-dashboard/`). No path is
baked in and no environment variable is read, so a non-default `CLAUDE_CONFIG_DIR` or a
multi-account layout resolves correctly without configuration. Baking the path in at write
time was rejected: it would silently point at the wrong tree after a config-dir change.

Resolution steps:

1. `readdir` the plugin's cache directory.
2. Keep entries matching `^\d+\.\d+\.\d+$` that contain `dist/index.js`.
3. Sort by **semver** (numeric per component — `1.9.0 < 1.31.1`; lexicographic sorting is
   wrong here and the repo already relies on `sort -V` for this reason).
4. `await import()` the newest one, so the status line runs in the same process with no
   extra spawn.
5. Nothing found → **exit 0 silently** (§8).

## 6. `SessionStart` hook behavior

Two idempotent jobs; if neither applies, no file is written.

**① Shim sync** — if `PLUGIN_DATA/statusline.mjs` is missing or differs from
`PLUGIN_ROOT/scripts/statusline-shim.mjs`, copy it. This makes the shim itself upgradable by
future plugin versions, so the indirection layer does not become its own frozen artifact.

**② Settings migration** — rewrite `statusLine.command` **only** when it matches this
plugin's version-pinned shape:

```
^\s*node\s+(?:"[^"]*[/\\]plugins[/\\]cache[/\\]claude-dashboard[/\\]claude-dashboard[/\\]\d+\.\d+\.\d+[/\\]dist[/\\]index\.js"|'[^']*[/\\]plugins[/\\]cache[/\\]claude-dashboard[/\\]claude-dashboard[/\\]\d+\.\d+\.\d+[/\\]dist[/\\]index\.js'|(?!["'])\S*[/\\]plugins[/\\]cache[/\\]claude-dashboard[/\\]claude-dashboard[/\\]\d+\.\d+\.\d+[/\\]dist[/\\]index\.js)\s*$
```

Three branches prevent the pattern from swallowing flags (`--inspect`) or wrapper arguments (`my-wrapper.js`): double-quoted paths (can contain spaces, typical Windows), single-quoted paths, and unquoted paths (non-whitespace only, rejected if starting with a quote). Anything else — extra arguments, flags, wrappers — is left untouched. The written replacement is an **absolute** path, matching what `setup` writes today — `~` is documented
to work but absolute keeps the two writers producing identical strings.

### Safety rules (this code edits a file it does not own)

- Anything not matching the pattern is left untouched: user-authored status lines, other
  tools, and an already-migrated shim path.
- On the first migration only, copy `settings.json` to `settings.json.bak` before writing.
  Never overwrite an existing `.bak`.
- If `settings.json` fails to parse, **do nothing**. No partial writes; write via temp file
  + `rename()`.
- The hook exits 0 on every failure path so it can never block session start.

## 7. `/claude-dashboard:update` — redefined, not removed

Hooks can be disabled (`disableAllHooks`, or an untrusted plugin), and those users would
never migrate. The command therefore stays as a manual escape hatch, with a new job:

- Ensure the shim exists in `PLUGIN_DATA`, then point `settings.json` at it.
- Report the resolved target version and whether migration was needed.

It is no longer "re-pin to the newest version" — after migration, re-running it is a no-op.

## 8. Failure modes

| Situation | Behavior |
|---|---|
| No `dist/index.js` in any cache directory | Shim exits 0 with no output (silent). A per-render warning would spam the status line; silence is recoverable via `/claude-dashboard:update`, which reports the real state. |
| `PLUGIN_DATA` shim deleted while `settings.json` still points at it (uninstall) | Status line breaks. **Not a regression** — uninstall leaves an equally dead pinned path today. |
| Hook disabled | No auto-migration; `/claude-dashboard:update` covers it (§7). |
| Corrupt `settings.json` | Hook no-ops; user's file untouched. |

## 9. Migration sequence (stated honestly)

For an existing user, with zero commands run:

```
/plugin update  →  restart  →  hook migrates settings.json  →  restart  →  shim renders
```

Because a `statusLine` change requires a restart to take effect, migration costs **one
additional restart**. The claim is "no command to run", not "instant". After this, version
bumps need neither a command nor a restart — the shim resolves the newest build on the next
render.

**To confirm during implementation**: whether Claude Code re-reads `statusLine.command`
mid-session. The current `commands/update.md` tells users to restart, so the design assumes
a restart is required; if it is re-read live, the second restart disappears and only the
docs need adjusting.

## 10. Testing

- **Shim** (`statusline-shim.test.ts`): fixture cache trees → picks newest; semver ordering
  (`1.9.0` vs `1.31.1`, the case plain string sort gets wrong); ignores non-semver and
  `dist`-less directories; empty tree → exit 0, no output; path derivation under a
  non-default config dir.
- **Hook** (`ensure-statusline.test.ts`): pinned path → rewritten; user-authored command →
  unchanged; already-shim → no write at all; malformed JSON → unchanged; `.bak` written once
  and never overwritten; missing shim → copied; identical shim → not rewritten.
- **Manual** (per `CLAUDE.md` checklist): fresh install via `setup`; upgrade path from a
  pinned 1.31.x; `CLAUDE_CONFIG_DIR` set; hooks disabled.

## 11. Out of scope

- Caching the resolved path (readdir of a 1–3 entry directory per render; premature).
- Cleaning up old version directories — Claude Code owns that sweep.
- Any change to widget behavior, data sources, or the cache schema. (A `schemaVersion` for
  `~/.cache/claude-dashboard/*.json`, which would have prevented the §1.2 poisoning
  independently, is a separate follow-up.)
- Repairing `settings.json` after plugin uninstall.

## 12. Rollout

Single PR against `main`. New users get the shim path from `setup`; existing users are
migrated by the hook on next session start. Version bump per the release workflow; docs
updated in the same PR so `/claude-dashboard:update`'s described behavior matches §7.
