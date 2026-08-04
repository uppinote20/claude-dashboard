# Antigravity CLI usage support — Design

- **Issue**: [#78 — Add support for antigravity cli?](https://github.com/uppinote20/claude-dashboard/issues/78)
- **Date**: 2026-07-10
- **Status**: Approved design (pre-implementation)
- **Branch**: `feat/antigravity-usage`

## 1. Motivation

Google deprecated **Gemini CLI** on 2026-06-18 and moved personal (free / AI Pro / Ultra)
users to the new **Antigravity CLI** (`agy`). The dashboard's `geminiUsage` widget reads
Gemini CLI's OAuth credentials (`~/.gemini/oauth_creds.json`) and the Code Assist
`retrieveUserQuota` API, which stops serving those personal accounts — so the widget goes
dark for migrated users.

This design adds first-class Antigravity usage tracking without disturbing the still-live
Gemini path (some users have not migrated; the two credential stores coexist).

## 2. Grounded facts

All facts below were confirmed on a machine with `agy` v1.1.0 installed, via the credential
store and static analysis of the `agy` binary (no network calls, no token contents read).

| Aspect | Finding |
|---|---|
| Credentials | `~/.gemini/antigravity-cli/antigravity-oauth-token`, mode `0600`. Shape: `{ "token": { "access_token", "token_type", "refresh_token", "expiry" }, "auth_method": "consumer" }`. |
| Expiry format | `expiry` is an **RFC3339 string** (e.g. `2026-07-10T09:02:06Z`), **not** Gemini's numeric `expiry_date` epoch. |
| Quota API | `POST {host}/v1internal:retrieveUserQuotaSummary` → `RetrieveUserQuotaSummaryResponse { QuotaSummaryGroup[] → QuotaSummaryBucket[] }`. Distinct from Gemini's `retrieveUserQuota`. |
| Bucket fields | `remainingFraction`, `remainingAmount`, `resetTime` — **the same field names Gemini's bucket parser already uses**. |
| Project id | `POST {host}/v1internal:loadCodeAssist` — the same call `gemini-client.ts` already makes. |
| Host | `cloudcode-pa.googleapis.com` (prod). The test machine runs a `daily-cloudcode-pa.googleapis.com` dev build → build-channel detection needed (see §9). |
| Refresh | Token endpoint `https://oauth2.googleapis.com/token` (same as Gemini). Binary embeds **two** client_id/secret pairs — the correct pair for `auth_method:"consumer"` is confirmed at implementation time (see §9). |
| Quota semantics | `agy` prints **"Quota available"** (remaining). Groups are model families sharing a **weekly** limit. |

### Observed `agy` quota output (source of the display model)

```
GEMINI MODELS
  Models within this group: Gemini Flash, Gemini Pro
  Weekly Limit  [██████████████████████████████████████████████████] 100.00%  Quota available

CLAUDE AND GPT MODELS
  Models within this group: Claude Opus, Claude Sonnet, GPT-OSS
  Weekly Limit  [██████████████████████████████████████████████████] 100.00%  Quota available
```

→ Two groups, each a model family with a shared **weekly** limit; the percentage is
**remaining**. To match the dashboard's used%-based coloring (`getColorForPercent`), we
convert `usedPercent = round((1 − remainingFraction) × 100)`, exactly as
`gemini-client.ts` already does.

## 3. Approach

**Standalone client + widget, mirroring the Gemini pattern.** A new
`antigravity-client.ts` reuses the shared `hash`, `file-cache`, and `debug` utilities and
the same three-tier + negative-cache + request-dedup idioms, but does **not** modify the
working (deprecated-but-live) Gemini code. A shared `code-assist` base class was considered
and rejected for now: it would refactor live Gemini code for DRY benefit that is better
captured once both clients are stable.

## 4. Architecture & files

**New**
- `scripts/utils/antigravity-client.ts` — credential read, self-refresh + write-back,
  project-id resolution, quota fetch, caching, dedup. Exports `isAntigravityInstalled()`,
  `fetchAntigravityUsage(ttlSeconds)`, `clearAntigravityCache()`.
- `scripts/widgets/antigravity-usage.ts` — `antigravityUsage` widget.
- `scripts/__tests__/antigravity-client.test.ts` — mirrors `gemini-client.test.ts`.

**Modified**
- `scripts/types.ts` — `AntigravityUsageLimits`, `AntigravityUsageData`; add
  `'antigravityUsage'` to `WidgetId`; `'^': 'antigravityUsage'` in `PRESET_CHAR_MAP`;
  add `antigravityUsage` to the `detailed` `DISPLAY_PRESETS` line.
- `scripts/utils/emoji.ts` — add `antigravity: '🪐️'` (ringed planet, VS-16 suffixed).
- `scripts/__tests__/emoji.test.ts` — registry invariant covers the new key.
- `scripts/widgets/index.ts` — register the widget.
- `scripts/check-usage.ts` — `renderAntigravitySection` alongside `renderGeminiSection`;
  include Antigravity in the "most available capacity" recommendation.
- `scripts/__tests__/widgets.test.ts` — widget render coverage.
- `locales/en.json`, `locales/ko.json` — widget label + error string.
- Docs: `CLAUDE.md` (widget/preset/char tables), `README.md`, `commands/setup.md`,
  `commands/check-usage.md` (provider list in description + body). The
  `claude-dashboard:check-usage` skill description string also lists providers → update it.

## 5. Data model & parsing contract

```typescript
interface AntigravityUsageLimits {
  groups: Array<{
    label: string;              // display label, e.g. "Gemini" / "Claude+GPT"
    usedPercent: number | null; // round((1 - remainingFraction) * 100)
    resetAt: string | null;     // RFC3339 weekly reset (from bucket.resetTime)
  }>;
}

// Widget-facing (adds error flag)
interface AntigravityUsageData {
  groups: AntigravityUsageLimits['groups'];
  isError?: boolean;
}
```

**Parsing contract** (bucket level is confirmed; group-level keys locked in Phase 0, §9):
1. Response → `groups[]`. For each group, take its **weekly** bucket (single bucket per
   group per observed output; if multiple, pick the weekly one, else the first).
2. `usedPercent = bucket.remainingFraction !== undefined ? round((1 − remainingFraction)×100) : null`.
3. `resetAt = bucket.resetTime ?? null`.
4. `label` — derived from the group's display name / model list via a short mapping
   (`GEMINI MODELS → "Gemini"`, `CLAUDE AND GPT MODELS → "Claude+GPT"`); unmapped groups
   fall back to a truncated display name.

## 6. Data flow

```
antigravityUsage.getData(ctx)
  └─ isAntigravityInstalled()                 // token file exists?
  └─ fetchAntigravityUsage(ttl)
       ├─ getValidCredentials()               // read token → refresh if expired (§7)
       ├─ getProjectId(creds)                 // loadCodeAssist (cached per token hash)
       ├─ memory cache → file cache → dedup    // same tiers as gemini-client
       └─ fetchFromAntigravityApi()           // retrieveUserQuotaSummary → parse (§5)
```

## 7. Error handling — layered degradation

Honors the self-refresh choice while containing its fragility. Every layer falls through to
the next; the final state is a hidden widget, never a crash:

1. Token valid → use it.
2. Token expired (RFC3339 `expiry` in the past, minus a 5-min buffer) → refresh with the
   correct client pair → **atomic write-back** to `antigravity-oauth-token`.
3. Refresh fails (wrong pair / rotation / network) → try the existing token read-only.
4. API 401 / network error → set negative cache (`NEGATIVE_CACHE_SECONDS`), fall back to
   in-memory stale cache, then stale file cache.
5. Nothing usable → `getData` returns `{ isError: true }` if installed (shows ⚠️) or `null`
   if not installed (hides).

### Self-refresh write-back safety (mitigates the corruption risk of the chosen approach)

- **Read-merge-write**: read the existing file, update only `token.access_token`,
  `token.refresh_token`, `token.expiry`; preserve `auth_method` and any unknown fields.
- **Exact nested shape**: write `{ token: { … }, auth_method }` with `expiry` as an RFC3339
  string — never Gemini's flat/epoch shape.
- **Atomic**: write to a temp file (mode `0600`) then `rename()` over the target, so a
  crashed write can't leave `agy` with a truncated credential file.

## 8. Display / render

Widget renders per-group weekly usage on one line:

```
🪐 Gemini 12% · Claude+GPT 3% (6d)
```

- Icon `ICON.antigravity` colorized with `theme.info`.
- Per group: `label` + `usedPercent%` colored by `getColorForPercent`, joined by ` │ `
  (Gemini-widget convention). Reset time via `formatTimeRemaining`, shown once (nearest
  reset) since groups share a weekly window; per-group reset if they diverge.
- `isError` → trailing `⚠️`. Empty groups → `--`.

## 9. Verification items resolved during implementation

These are honest, bounded reverse-engineering confirmations (not open design questions).
User has authorized the required live calls (they mirror what `agy` itself does).

- **Phase 0 — lock the wire format**: capture one live `retrieveUserQuotaSummary` response
  and confirm the exact group-level JSON keys (candidates: `groups` / `displayName` /
  `models` / `buckets`). Bucket keys already confirmed (`remainingFraction`, `resetTime`).
- **Client pair**: identify which of the two embedded client_id/secret pairs refreshes a
  `consumer` token (test a refresh with each; hardcode the winner).
- **Project id**: confirm whether `retrieveUserQuotaSummary` requires a project id in the
  request body (reuse `loadCodeAssist` if so).
- **Host / build channel**: default to prod `cloudcode-pa.googleapis.com`; detect the
  `daily-` dev channel (via `agy` settings/env) and use it when present.

## 10. Testing

- `antigravity-client.test.ts`: RFC3339 expiry parse & refresh trigger; nested write-back
  shape + atomicity; group→bucket parsing (`usedPercent`, `resetAt`); negative-cache and
  stale-cache fallbacks; multi-account hash isolation. Network mocked (no live calls in CI).
- `widgets.test.ts`: render for normal / error / empty-groups states.
- `emoji.test.ts`: registry invariant includes `antigravity`.
- Manual checklist (per `CLAUDE.md` testing checklist): all display modes, Korean/English,
  API-error ⚠️, missing-data hide, theme switching, `disabledWidgets`.

## 11. macOS keychain (noted, not in MVP)

Gemini CLI on macOS stores tokens in the keychain (`gemini-cli-oauth`). Whether `agy` uses
a keychain — and under what service name — is unknown. MVP is **file-based**; macOS keychain
support is a follow-up once the service name is confirmed.

## 12. Out of scope

- Shared `code-assist` base-class refactor of the Gemini client (defer until both stable).
- Historical / trend tracking of Antigravity usage.
- Any change to the Gemini widgets' behavior.

## 13. Rollout

Single PR against `main` (no `develop` branch): client + widget + types + emoji +
registration + check-usage + tests + docs. `dist/` rebuilt and committed (plugin users
don't build). Version bump per release workflow.

## 14. Revision — 2026-08-04 (implemented)

Implementation confirmed a working quota path that supersedes parts of §2/§5/§7/§9:

- **Quota RPC**: `retrieveUserQuotaSummary` is first-party-gated (403 for third-party
  callers — see the issue #78 investigation). Quota instead comes from
  `v1internal:fetchAvailableModels`, whose per-model `quotaInfo`
  (`remainingFraction` / `resetTime` / `isExhausted`) carries the same bucket fields.
  The §5 family groups are reconstructed client-side from per-model entries
  (`gemini*` → "Gemini", `claude|gpt` → "Claude+GPT", worst member wins).
- **Write-back dropped**: §7's atomic write-back to `antigravity-oauth-token` was
  replaced by a strict never-write policy — a foreign writer could corrupt what the
  closed-source CLI expects. Refreshed tokens live only in our own cache
  (`~/.cache/claude-dashboard/antigravity-token-{hash}.json`, mode 0600).
- **OAuth client**: the `consumer` refresh pair is the community-known public
  installed-app client (`1071006060591-….apps.googleusercontent.com`).
- **Host**: prod `cloudcode-pa.googleapis.com` works even when agy itself runs on the
  `daily-` channel; §9's channel detection is unnecessary.
- **Additions beyond this design**: `antigravityUsageAll` widget (per-model buckets),
  preset char `^`, `ICON.antigravity` 🪐️, check-usage section + recommendation
  scoring via the 7d metric.
- **Live verification (2026-08-04)**: `fetchAvailableModels` → 200 with a real token;
  17 models parsed into 2 groups (`Gemini 27% (6d22h)`, `Claude+GPT 39% (6d19h)`).
