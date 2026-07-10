# Antigravity CLI Usage Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `antigravityUsage` status-line widget (and check-usage CLI section) that reports Antigravity CLI (`agy`) weekly quota per model group.

**Architecture:** A standalone `antigravity-client.ts` mirrors the proven `gemini-client.ts` pattern (credential read, self-refresh, `loadCodeAssist` project id, quota fetch, 3-tier + negative cache, dedup) without touching Gemini code. A new `antigravity-usage.ts` widget renders per-group weekly usage. The client is reused by `check-usage.ts`.

**Tech Stack:** Node.js 18+, TypeScript strict ESM, esbuild. No external runtime dependencies (Node built-ins + existing `scripts/utils/*` only).

**Spec:** `docs/superpowers/specs/2026-07-10-antigravity-usage-design.md`

## Global Constraints

- Node.js 18+; TypeScript strict mode; ESM (`import`/`export`, `.js` import specifiers).
- No external runtime dependencies — Node built-ins and existing `scripts/utils/*` only.
- All user-facing strings via `locales/*.json` (i18n); no hardcoded UI copy.
- Graceful degradation: API/parse failure → widget shows `⚠️` if installed, returns `null` if not installed. Never crash.
- `dist/index.js` and `dist/check-usage.js` are committed (plugin users don't build).
- Emoji literals only via `scripts/utils/emoji.ts` (`ICON.*`), each VS-16 (`️`) suffixed.
- Reuse `hashToken` (`utils/hash.ts`), file-cache (`utils/file-cache.ts`), `debugLog` (`utils/debug.ts`), `NEGATIVE_CACHE_SECONDS` / `STALE_CACHE_TTL_SECONDS`.
- Commits: English `type: subject` title. No Claude metadata lines.
- Credential file `~/.gemini/antigravity-cli/antigravity-oauth-token` is written **only** via atomic temp-write + `rename`, preserving unknown fields, in Antigravity's nested shape.

## Locked interfaces (referenced by all tasks)

```typescript
// scripts/types.ts (added in Task 1)
export interface AntigravityGroupUsage {
  label: string;              // "Gemini" | "Claude+GPT" | raw display name
  usedPercent: number | null; // round((1 - remainingFraction) * 100)
  resetAt: string | null;     // RFC3339 weekly reset
}
export interface AntigravityUsageLimits {
  groups: AntigravityGroupUsage[];
}
export interface AntigravityUsageData {
  groups: AntigravityGroupUsage[];
  isError?: boolean;
}
```

```typescript
// internal to scripts/utils/antigravity-client.ts
interface AntigravityCredentials { accessToken: string; refreshToken?: string; expiry?: string; } // expiry = RFC3339
interface AntigravityTokenFile { token?: { access_token?: string; token_type?: string; refresh_token?: string; expiry?: string; }; auth_method?: string; }
interface QuotaSummaryBucket { remainingFraction?: number; remainingAmount?: string; resetTime?: string; }
interface QuotaSummaryGroup { displayName?: string; models?: string[]; buckets?: QuotaSummaryBucket[]; }
interface RetrieveUserQuotaSummaryResponse { groups?: QuotaSummaryGroup[]; }
```

Exported client surface (final):
`isAntigravityInstalled(): Promise<boolean>`, `fetchAntigravityUsage(ttlSeconds?: number): Promise<AntigravityUsageLimits | null>`, `clearAntigravityCache(): void`, `parseQuotaSummary(resp: unknown): AntigravityUsageLimits`.

---

### Task 0: Lock the live wire contract (verification)

> User has authorized the live calls this task makes (they mirror what `agy` already does). This task **replaces guesses with observed values** and produces a committed fixture that all parser tests use. No product code ships here.

**Files:**
- Create: `scripts/__tests__/fixtures/antigravity-quota-summary.json` (sanitized sample response)
- Create (scratch, not committed): `/tmp/agy-probe.mjs`

**Interfaces:**
- Produces: the confirmed field names for `QuotaSummaryGroup` (`displayName`/`models`/`buckets` candidates), the correct OAuth client_id/secret pair, whether the request needs a project id, and the host channel. Record all four as a checklist at the top of the fixture file's sibling `README` comment block (or in the plan's Task-0 notes).

- [ ] **Step 1: Read current token (no contents printed) and its expiry**

```bash
node --input-type=module -e '
import {readFile} from "fs/promises"; import os from "os"; import path from "path";
const p=path.join(os.homedir(),".gemini/antigravity-cli/antigravity-oauth-token");
const d=JSON.parse(await readFile(p,"utf-8"));
console.log("expiry:",d.token?.expiry,"auth_method:",d.auth_method,"hasRefresh:",!!d.token?.refresh_token);
'
```
Expected: prints an RFC3339 `expiry`, `auth_method: consumer`, `hasRefresh: true`.

- [ ] **Step 2: Resolve project id via loadCodeAssist**

Write `/tmp/agy-probe.mjs`:
```javascript
import { readFile } from 'fs/promises'; import os from 'os'; import path from 'path';
const P = path.join(os.homedir(), '.gemini/antigravity-cli/antigravity-oauth-token');
const tok = JSON.parse(await readFile(P, 'utf-8')).token.access_token;
const HOSTS = ['https://cloudcode-pa.googleapis.com', 'https://daily-cloudcode-pa.googleapis.com'];
for (const host of HOSTS) {
  try {
    const r = await fetch(`${host}/v1internal:loadCodeAssist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tok}` },
      body: JSON.stringify({ metadata: { ideType: 'IDE_UNSPECIFIED', platform: 'PLATFORM_UNSPECIFIED', pluginType: 'ANTIGRAVITY' } }),
    });
    console.log(host, 'loadCodeAssist', r.status);
    if (r.ok) { const j = await r.json(); console.log('project:', j.cloudaicompanionProject, 'tier:', j.currentTier?.id); }
  } catch (e) { console.log(host, 'ERR', e.message); }
}
```
Run: `node /tmp/agy-probe.mjs`
Expected: one host returns `200` and a project id (or a usable tier). **Record which host works** → that is the prod-vs-daily answer.

- [ ] **Step 3: Capture the quota summary response**

Append to `/tmp/agy-probe.mjs` a call to `:retrieveUserQuotaSummary` on the working host, with body `{}` first, then (if it 400s) `{ project: '<projectId from step 2>' }`. Print `JSON.stringify(await r.json(), null, 2)`.
Run: `node /tmp/agy-probe.mjs`
Expected: a JSON body containing an array of groups, each with a display name, a models list, and one or more buckets with `remainingFraction` and `resetTime`. **Record whether the request needed `project`.**

- [ ] **Step 4: Identify the correct OAuth client pair**

For each candidate pair, POST to `https://oauth2.googleapis.com/token` with `grant_type=refresh_token`, the file's `refresh_token`, and that pair's `client_id`/`client_secret`. Candidates from the `agy` binary:
- `1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com` / `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`
- `884354919052-36trc1jjb3tguiac32ov6cod268c5blh.apps.googleusercontent.com` / `GOCSPX-9YQWpF7RWDC0QTdj-YxKMwR0Zts`

Expected: exactly one pair returns `200` with an `access_token`. **Record the winner.** (Do not persist the refreshed token here — this is identification only.)

- [ ] **Step 5: Write the sanitized fixture**

Save the Step 3 response to `scripts/__tests__/fixtures/antigravity-quota-summary.json`, replacing any account-identifying values (project ids, emails) with placeholders but **preserving all field names and the group/bucket structure verbatim**. This file is the source of truth for parser tests.

- [ ] **Step 6: Reconcile the locked interfaces**

If Step 3's real field names differ from the `QuotaSummaryGroup`/`QuotaSummaryBucket`/`RetrieveUserQuotaSummaryResponse` names in "Locked interfaces" above, update those interface definitions in this plan (and thus Tasks 3/6) to match the fixture. Confirmed constants to carry forward: working host, `needsProject` boolean, winning client pair.

- [ ] **Step 7: Commit the fixture**

```bash
git add scripts/__tests__/fixtures/antigravity-quota-summary.json
git commit -m "test: add Antigravity quota summary fixture from live response"
```

---

### Task 1: Types + credential read with RFC3339 expiry

**Files:**
- Modify: `scripts/types.ts` (add the three `Antigravity*` interfaces from "Locked interfaces"; add `'antigravityUsage'` to the `WidgetId` union)
- Create: `scripts/utils/antigravity-client.ts`
- Test: `scripts/__tests__/antigravity-client.test.ts`

**Interfaces:**
- Consumes: `AntigravityCredentials`, `AntigravityTokenFile` (internal).
- Produces: `getAntigravityCredentials(): Promise<AntigravityCredentials | null>`, `tokenNeedsRefresh(c: AntigravityCredentials): boolean`, `getAntigravityTokenPath(): string`.

- [ ] **Step 1: Add types**

In `scripts/types.ts`, add the `AntigravityGroupUsage`, `AntigravityUsageLimits`, `AntigravityUsageData` interfaces (verbatim from "Locked interfaces"), and add `| 'antigravityUsage'` to the `WidgetId` union (next to `'geminiUsage'`).

- [ ] **Step 2: Write the failing test**

```typescript
// scripts/__tests__/antigravity-client.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { readFile } from 'fs/promises';
import { __test } from '../utils/antigravity-client.js';

describe('antigravity credentials', () => {
  it('parses nested token file into flat credentials', () => {
    const file = { token: { access_token: 'AT', refresh_token: 'RT', expiry: '2999-01-01T00:00:00Z', token_type: 'Bearer' }, auth_method: 'consumer' };
    const creds = __test.credentialsFromFile(file);
    expect(creds).toEqual({ accessToken: 'AT', refreshToken: 'RT', expiry: '2999-01-01T00:00:00Z' });
  });

  it('tokenNeedsRefresh true when RFC3339 expiry within 5-min buffer', () => {
    const soon = new Date(Date.now() + 60_000).toISOString();
    expect(__test.tokenNeedsRefresh({ accessToken: 'x', expiry: soon })).toBe(true);
  });

  it('tokenNeedsRefresh false when expiry far in future', () => {
    expect(__test.tokenNeedsRefresh({ accessToken: 'x', expiry: '2999-01-01T00:00:00Z' })).toBe(false);
  });

  it('tokenNeedsRefresh false when expiry missing or unparseable', () => {
    expect(__test.tokenNeedsRefresh({ accessToken: 'x' })).toBe(false);
    expect(__test.tokenNeedsRefresh({ accessToken: 'x', expiry: 'not-a-date' })).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run scripts/__tests__/antigravity-client.test.ts`
Expected: FAIL — cannot import `__test` from `antigravity-client.js` (module not created).

- [ ] **Step 4: Write minimal implementation**

```typescript
// scripts/utils/antigravity-client.ts
import { readFile, writeFile, rename, stat } from 'fs/promises';
import os from 'os';
import path from 'path';
import { debugLog } from './debug.js';

const ANTIGRAVITY_TOKEN_PATH = ['.gemini', 'antigravity-cli', 'antigravity-oauth-token'];
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

interface AntigravityCredentials { accessToken: string; refreshToken?: string; expiry?: string; }
interface AntigravityTokenFile { token?: { access_token?: string; token_type?: string; refresh_token?: string; expiry?: string }; auth_method?: string; }

export function getAntigravityTokenPath(): string {
  return path.join(os.homedir(), ...ANTIGRAVITY_TOKEN_PATH);
}

function credentialsFromFile(file: AntigravityTokenFile): AntigravityCredentials | null {
  const at = file.token?.access_token;
  if (!at) return null;
  return { accessToken: at, refreshToken: file.token?.refresh_token, expiry: file.token?.expiry };
}

function tokenNeedsRefresh(c: AntigravityCredentials): boolean {
  if (!c.expiry) return false;
  const t = Date.parse(c.expiry);
  if (Number.isNaN(t)) return false;
  return t < Date.now() + TOKEN_REFRESH_BUFFER_MS;
}

let cachedCreds: { data: AntigravityCredentials; mtime: number } | null = null;

export async function getAntigravityCredentials(): Promise<AntigravityCredentials | null> {
  try {
    const p = getAntigravityTokenPath();
    const s = await stat(p);
    if (cachedCreds && cachedCreds.mtime === s.mtimeMs) return cachedCreds.data;
    const file = JSON.parse(await readFile(p, 'utf-8')) as AntigravityTokenFile;
    const creds = credentialsFromFile(file);
    if (creds) cachedCreds = { data: creds, mtime: s.mtimeMs };
    return creds;
  } catch { return null; }
}

export const __test = { credentialsFromFile, tokenNeedsRefresh };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run scripts/__tests__/antigravity-client.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add scripts/types.ts scripts/utils/antigravity-client.ts scripts/__tests__/antigravity-client.test.ts
git commit -m "feat: add Antigravity credential read with RFC3339 expiry"
```

---

### Task 2: Self-refresh + atomic write-back (nested shape)

**Files:**
- Modify: `scripts/utils/antigravity-client.ts`
- Test: `scripts/__tests__/antigravity-client.test.ts`

**Interfaces:**
- Consumes: `AntigravityCredentials`, `getAntigravityTokenPath`.
- Produces: `saveCredentialsToFile(c: AntigravityCredentials): Promise<void>` (via `__test`), plus refresh constants. Uses the winning client pair + `needsProject` recorded in Task 0.

- [ ] **Step 1: Write the failing test** (write-back preserves shape + unknown fields, atomically)

```typescript
import { mkdtemp, readFile as rf, writeFile as wf, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

it('saveCredentialsToFile preserves nested shape, auth_method, and unknown fields', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'agy-'));
  const p = path.join(dir, 'antigravity-oauth-token');
  await wf(p, JSON.stringify({ token: { access_token: 'OLD', token_type: 'Bearer', refresh_token: 'RT', expiry: '2020-01-01T00:00:00Z' }, auth_method: 'consumer', extra: 'keep-me' }));
  __test.setTokenPathForTest(p);
  await __test.saveCredentialsToFile({ accessToken: 'NEW', refreshToken: 'RT2', expiry: '2999-01-01T00:00:00Z' });
  const out = JSON.parse(await rf(p, 'utf-8'));
  expect(out.token.access_token).toBe('NEW');
  expect(out.token.refresh_token).toBe('RT2');
  expect(out.token.expiry).toBe('2999-01-01T00:00:00Z');
  expect(out.token.token_type).toBe('Bearer');
  expect(out.auth_method).toBe('consumer');
  expect(out.extra).toBe('keep-me');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/__tests__/antigravity-client.test.ts -t saveCredentialsToFile`
Expected: FAIL — `__test.saveCredentialsToFile` / `setTokenPathForTest` undefined.

- [ ] **Step 3: Write minimal implementation**

Add to `antigravity-client.ts`:
```typescript
// Winning pair + host confirmed in Task 0 — replace if Task 0 chose the other pair.
const OAUTH_CLIENT_ID = '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com';
const OAUTH_CLIENT_SECRET = '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';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const API_TIMEOUT_MS = 5000;

let tokenPathOverride: string | null = null;
function tokenPath(): string { return tokenPathOverride ?? getAntigravityTokenPath(); }

async function saveCredentialsToFile(c: AntigravityCredentials): Promise<void> {
  const p = tokenPath();
  let existing: AntigravityTokenFile & Record<string, unknown> = {};
  try { existing = JSON.parse(await readFile(p, 'utf-8')); } catch { /* new file */ }
  const token = { ...(existing.token ?? {}), access_token: c.accessToken, refresh_token: c.refreshToken, expiry: c.expiry, token_type: existing.token?.token_type ?? 'Bearer' };
  const data = { ...existing, token, auth_method: existing.auth_method ?? 'consumer' };
  const tmp = `${p}.tmp-${process.pid}`;
  await writeFile(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  await rename(tmp, p);
  cachedCreds = null;
}

async function refreshToken(c: AntigravityCredentials): Promise<AntigravityCredentials | null> {
  if (!c.refreshToken) return null;
  try {
    const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: c.refreshToken, client_id: OAUTH_CLIENT_ID, client_secret: OAUTH_CLIENT_SECRET }),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (!res.ok) { debugLog('antigravity', 'refresh failed', res.status); return null; }
    const j = await res.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!j.access_token) return null;
    const next: AntigravityCredentials = { accessToken: j.access_token, refreshToken: j.refresh_token ?? c.refreshToken, expiry: new Date(Date.now() + (j.expires_in ?? 3600) * 1000).toISOString() };
    await saveCredentialsToFile(next);
    return next;
  } catch (e) { debugLog('antigravity', 'refresh error', e); return null; }
}

async function getValidCredentials(): Promise<AntigravityCredentials | null> {
  const c = await getAntigravityCredentials();
  if (!c) return null;
  if (tokenNeedsRefresh(c)) return (await refreshToken(c)) ?? c; // fall back to existing token read-only
  return c;
}
```
Extend `__test`: `{ credentialsFromFile, tokenNeedsRefresh, saveCredentialsToFile, setTokenPathForTest: (p: string) => { tokenPathOverride = p; } }`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/__tests__/antigravity-client.test.ts -t saveCredentialsToFile`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/utils/antigravity-client.ts scripts/__tests__/antigravity-client.test.ts
git commit -m "feat: add Antigravity self-refresh with atomic write-back"
```

---

### Task 3: Parse quota summary → per-group usage

**Files:**
- Modify: `scripts/utils/antigravity-client.ts`
- Test: `scripts/__tests__/antigravity-client.test.ts`

**Interfaces:**
- Consumes: `RetrieveUserQuotaSummaryResponse`, the Task-0 fixture.
- Produces: `parseQuotaSummary(resp: unknown): AntigravityUsageLimits` (exported), `groupLabel(g: QuotaSummaryGroup): string`.

- [ ] **Step 1: Write the failing test** (uses the committed fixture)

```typescript
import { readFileSync } from 'fs';
import { parseQuotaSummary } from '../utils/antigravity-client.js';

it('parses fixture into Gemini and Claude+GPT groups with used%', () => {
  const raw = JSON.parse(readFileSync(new URL('./fixtures/antigravity-quota-summary.json', import.meta.url), 'utf-8'));
  const limits = parseQuotaSummary(raw);
  const labels = limits.groups.map(g => g.label);
  expect(labels).toContain('Gemini');
  expect(labels).toContain('Claude+GPT');
  for (const g of limits.groups) {
    expect(g.usedPercent === null || (g.usedPercent >= 0 && g.usedPercent <= 100)).toBe(true);
  }
});

it('converts remainingFraction to usedPercent (1.0 remaining → 0% used)', () => {
  const limits = parseQuotaSummary({ groups: [{ displayName: 'GEMINI MODELS', buckets: [{ remainingFraction: 1.0, resetTime: '2026-07-17T00:00:00Z' }] }] });
  expect(limits.groups[0]).toEqual({ label: 'Gemini', usedPercent: 0, resetAt: '2026-07-17T00:00:00Z' });
});

it('handles missing buckets and unknown group names gracefully', () => {
  const limits = parseQuotaSummary({ groups: [{ displayName: 'MYSTERY GROUP' }] });
  expect(limits.groups[0]).toEqual({ label: 'MYSTERY GROUP', usedPercent: null, resetAt: null });
});

it('returns empty groups for malformed input', () => {
  expect(parseQuotaSummary(null).groups).toEqual([]);
  expect(parseQuotaSummary({}).groups).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/__tests__/antigravity-client.test.ts -t parses`
Expected: FAIL — `parseQuotaSummary` not exported.

- [ ] **Step 3: Write minimal implementation**

> Field names (`groups`, `displayName`, `buckets`, `remainingFraction`, `resetTime`) match the Task-0 fixture. If Task 0 recorded different names, adjust the reads below to match.

```typescript
import type { AntigravityUsageLimits } from '../types.js';

interface QuotaSummaryBucket { remainingFraction?: number; remainingAmount?: string; resetTime?: string; }
interface QuotaSummaryGroup { displayName?: string; models?: string[]; buckets?: QuotaSummaryBucket[]; }
interface RetrieveUserQuotaSummaryResponse { groups?: QuotaSummaryGroup[]; }

function groupLabel(g: QuotaSummaryGroup): string {
  const dn = (g.displayName ?? '').toUpperCase();
  if (dn.includes('GEMINI')) return 'Gemini';
  if (dn.includes('CLAUDE') || dn.includes('GPT')) return 'Claude+GPT';
  return g.displayName ?? 'unknown';
}

export function parseQuotaSummary(resp: unknown): AntigravityUsageLimits {
  const groups = (resp as RetrieveUserQuotaSummaryResponse | null)?.groups;
  if (!Array.isArray(groups)) return { groups: [] };
  return {
    groups: groups.map((g) => {
      const bucket = g.buckets?.[0];
      const usedPercent = bucket && bucket.remainingFraction !== undefined
        ? Math.round((1 - bucket.remainingFraction) * 100) : null;
      return { label: groupLabel(g), usedPercent, resetAt: bucket?.resetTime ?? null };
    }),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/__tests__/antigravity-client.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/utils/antigravity-client.ts scripts/__tests__/antigravity-client.test.ts
git commit -m "feat: parse Antigravity quota summary into per-group usage"
```

---

### Task 4: Fetch orchestration — project id, caching, dedup, install check

**Files:**
- Modify: `scripts/utils/antigravity-client.ts`
- Test: `scripts/__tests__/antigravity-client.test.ts`

**Interfaces:**
- Consumes: `getValidCredentials`, `parseQuotaSummary`, `hashToken`, file-cache helpers, `NEGATIVE_CACHE_SECONDS`, `STALE_CACHE_TTL_SECONDS`.
- Produces: `isAntigravityInstalled()`, `fetchAntigravityUsage(ttlSeconds?)`, `clearAntigravityCache()`.

- [ ] **Step 1: Write the failing test** (install check + negative cache; network mocked)

```typescript
import { vi } from 'vitest';
import { isAntigravityInstalled, fetchAntigravityUsage, clearAntigravityCache } from '../utils/antigravity-client.js';

afterEach(() => { clearAntigravityCache(); vi.restoreAllMocks(); });

it('isAntigravityInstalled false when token file absent', async () => {
  __test.setTokenPathForTest('/nonexistent/agy-token');
  expect(await isAntigravityInstalled()).toBe(false);
});

it('fetchAntigravityUsage returns null (no crash) when no credentials', async () => {
  __test.setTokenPathForTest('/nonexistent/agy-token');
  expect(await fetchAntigravityUsage(60)).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/__tests__/antigravity-client.test.ts -t Antigravity`
Expected: FAIL — `isAntigravityInstalled`/`fetchAntigravityUsage` not exported.

- [ ] **Step 3: Write minimal implementation**

> Mirrors `gemini-client.ts` `fetchGeminiUsage`. Host + `needsProject` from Task 0. If `needsProject` is false, skip `getProjectId` and send `{}` as the request body.
>
> This task's code imports `VERSION` from `../version.js`, so the test file must mock it (as `gemini-client.test.ts` does). Add to the top of `antigravity-client.test.ts`: `vi.mock('../version.js', () => ({ VERSION: '1.0.0-test' }));`

```typescript
import { hashToken } from './hash.js';
import { loadFileCache, saveFileCache, fileCachePath, STALE_CACHE_TTL_SECONDS } from './file-cache.js';
import { NEGATIVE_CACHE_SECONDS, type CacheEntry, type AntigravityUsageLimits } from '../types.js';
import { VERSION } from '../version.js';

const HOST = 'https://cloudcode-pa.googleapis.com'; // Task 0: swap to daily- if that was the working host
const NEEDS_PROJECT = true;                          // Task 0: set from observed behavior

const cacheMap = new Map<string, CacheEntry<AntigravityUsageLimits>>();
const pending = new Map<string, Promise<AntigravityUsageLimits | null>>();
const projectIdCache = new Map<string, { data: string; ts: number }>();
const PROJECT_TTL_MS = 5 * 60 * 1000;

export async function isAntigravityInstalled(): Promise<boolean> {
  try { await stat(tokenPath()); return true; } catch { return false; }
}

async function getProjectId(c: AntigravityCredentials): Promise<string | null> {
  const env = process.env['GOOGLE_CLOUD_PROJECT'] || process.env['GOOGLE_CLOUD_PROJECT_ID'];
  if (env) return env;
  const h = hashToken(c.accessToken);
  const hit = projectIdCache.get(h);
  if (hit && Date.now() - hit.ts < PROJECT_TTL_MS) return hit.data;
  try {
    const r = await fetch(`${HOST}/v1internal:loadCodeAssist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': `claude-dashboard/${VERSION}`, 'Authorization': `Bearer ${c.accessToken}` },
      body: JSON.stringify({ metadata: { ideType: 'IDE_UNSPECIFIED', platform: 'PLATFORM_UNSPECIFIED', pluginType: 'ANTIGRAVITY' } }),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (!r.ok) return null;
    const j = await r.json() as { cloudaicompanionProject?: string };
    if (j.cloudaicompanionProject) { projectIdCache.set(h, { data: j.cloudaicompanionProject, ts: Date.now() }); return j.cloudaicompanionProject; }
  } catch (e) { debugLog('antigravity', 'loadCodeAssist error', e); }
  return null;
}

async function fetchFromApi(c: AntigravityCredentials, projectId: string | null): Promise<AntigravityUsageLimits | null> {
  try {
    const r = await fetch(`${HOST}/v1internal:retrieveUserQuotaSummary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': `claude-dashboard/${VERSION}`, 'Authorization': `Bearer ${c.accessToken}` },
      body: JSON.stringify(NEEDS_PROJECT && projectId ? { project: projectId } : {}),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (!r.ok) { debugLog('antigravity', 'quota not ok', r.status); return null; }
    return parseQuotaSummary(await r.json());
  } catch (e) { debugLog('antigravity', 'quota error', e); return null; }
}

export async function fetchAntigravityUsage(ttlSeconds = 60): Promise<AntigravityUsageLimits | null> {
  const c = await getValidCredentials();
  if (!c) return null;
  const h = hashToken(c.accessToken);
  const cacheFile = fileCachePath(`antigravity-usage-${h}.json`);

  const cached = cacheMap.get(h);
  if (cached) {
    const age = (Date.now() - cached.timestamp) / 1000;
    const ttl = cached.isError ? NEGATIVE_CACHE_SECONDS : ttlSeconds;
    if (age < ttl) return cached.isError ? null : cached.data;
  }
  const fromFile = await loadFileCache<AntigravityUsageLimits>(cacheFile, ttlSeconds);
  if (fromFile) { cacheMap.set(h, { data: fromFile.data, timestamp: fromFile.timestamp }); return fromFile.data; }

  const inflight = pending.get(h);
  if (inflight) return inflight;

  const projectId = NEEDS_PROJECT ? await getProjectId(c) : null;
  const p = fetchFromApi(c, projectId);
  pending.set(h, p);
  try {
    const result = await p;
    if (result) { cacheMap.set(h, { data: result, timestamp: Date.now() }); await saveFileCache(cacheFile, result); return result; }
    cacheMap.set(h, { data: null, timestamp: Date.now(), isError: true });
    if (cached && !cached.isError) return cached.data;
    const stale = await loadFileCache<AntigravityUsageLimits>(cacheFile, STALE_CACHE_TTL_SECONDS);
    return stale ? stale.data : null;
  } finally { pending.delete(h); }
}

export function clearAntigravityCache(): void {
  cacheMap.clear(); pending.clear(); projectIdCache.clear(); cachedCreds = null; tokenPathOverride = null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/__tests__/antigravity-client.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add scripts/utils/antigravity-client.ts scripts/__tests__/antigravity-client.test.ts
git commit -m "feat: add Antigravity fetch orchestration with caching and dedup"
```

---

### Task 5: Emoji icon

**Files:**
- Modify: `scripts/utils/emoji.ts`
- Test: `scripts/__tests__/emoji.test.ts` (verify existing invariant still passes with the new key)

**Interfaces:**
- Produces: `ICON.antigravity`.

- [ ] **Step 1: Add the icon**

In `scripts/utils/emoji.ts`, add to the `ICON` object: `antigravity: '🪐️',` (ringed planet U+1FA90 + VS-16).

- [ ] **Step 2: Run the emoji registry test**

Run: `npx vitest run scripts/__tests__/emoji.test.ts`
Expected: PASS — every value ends with U+FE0F; new key included.

- [ ] **Step 3: Commit**

```bash
git add scripts/utils/emoji.ts
git commit -m "feat: add antigravity emoji icon"
```

---

### Task 6: antigravityUsage widget

**Files:**
- Create: `scripts/widgets/antigravity-usage.ts`
- Test: `scripts/__tests__/widgets.test.ts` (add cases)

**Interfaces:**
- Consumes: `AntigravityUsageData`, `fetchAntigravityUsage`, `isAntigravityInstalled`, `getColorForPercent`, `colorize`, `getTheme`, `ICON`, `formatTimeRemaining`.
- Produces: `antigravityUsageWidget: Widget<AntigravityUsageData>`.

- [ ] **Step 1: Write the failing test**

```typescript
import { antigravityUsageWidget } from '../widgets/antigravity-usage.js';

it('antigravityUsage renders group labels and used%', () => {
  const data = { groups: [ { label: 'Gemini', usedPercent: 12, resetAt: null }, { label: 'Claude+GPT', usedPercent: 3, resetAt: null } ] };
  const out = antigravityUsageWidget.render(data as any, ctx); // ctx = existing shared test context
  expect(out).toContain('Gemini');
  expect(out).toContain('Claude+GPT');
  expect(out).toContain('12%');
  expect(out).toContain('3%');
});

it('antigravityUsage renders warning on error', () => {
  const out = antigravityUsageWidget.render({ groups: [], isError: true } as any, ctx);
  expect(out).toContain('⚠');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/__tests__/widgets.test.ts -t antigravityUsage`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// scripts/widgets/antigravity-usage.ts
import type { Widget } from './base.js';
import type { WidgetContext, AntigravityUsageData } from '../types.js';
import { getColorForPercent, colorize, getTheme } from '../utils/colors.js';
import { ICON } from '../utils/emoji.js';
import { isAntigravityInstalled, fetchAntigravityUsage } from '../utils/antigravity-client.js';
import { formatTimeRemaining } from '../utils/formatters.js';

export const antigravityUsageWidget: Widget<AntigravityUsageData> = {
  id: 'antigravityUsage',
  name: 'Antigravity Usage',

  async getData(ctx: WidgetContext): Promise<AntigravityUsageData | null> {
    if (!(await isAntigravityInstalled())) return null;
    const limits = await fetchAntigravityUsage(ctx.config.cache.ttlSeconds);
    if (!limits) return { groups: [], isError: true };
    return { groups: limits.groups };
  },

  render(data: AntigravityUsageData, ctx: WidgetContext): string {
    const theme = getTheme();
    const icon = colorize(ICON.antigravity, theme.info);
    if (data.isError) return `${icon} ${colorize(ICON.warning, theme.warning)}`;
    if (data.groups.length === 0) return `${icon} ${colorize('--', theme.secondary)}`;
    const parts = data.groups.map((g) => {
      if (g.usedPercent === null) return `${colorize(g.label, theme.secondary)}: ${colorize('--', theme.secondary)}`;
      let s = `${colorize(g.label, theme.secondary)} ${colorize(`${g.usedPercent}%`, getColorForPercent(g.usedPercent))}`;
      if (g.resetAt) { const r = formatTimeRemaining(new Date(g.resetAt), ctx.translations); if (r) s += ` (${r})`; }
      return s;
    });
    return `${icon} ${parts.join(` ${colorize('│', theme.dim)} `)}`;
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/__tests__/widgets.test.ts -t antigravityUsage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/widgets/antigravity-usage.ts scripts/__tests__/widgets.test.ts
git commit -m "feat: add antigravityUsage widget"
```

---

### Task 7: Register widget + preset char + display preset

**Files:**
- Modify: `scripts/widgets/index.ts` (import + register in the widget registry)
- Modify: `scripts/types.ts` (`PRESET_CHAR_MAP` `'^': 'antigravityUsage'`; add `'antigravityUsage'` to the `detailed` `DISPLAY_PRESETS` line, after `geminiUsage`)
- Test: `scripts/__tests__/widgets.test.ts`

**Interfaces:**
- Consumes: `antigravityUsageWidget`, `parsePreset`.
- Produces: registry entry reachable by id `'antigravityUsage'`.

- [ ] **Step 1: Write the failing test**

```typescript
import { parsePreset } from '../types.js';
import { getWidget } from '../widgets/index.js';

it('registry resolves antigravityUsage', () => {
  expect(getWidget('antigravityUsage')?.id).toBe('antigravityUsage');
});
it('preset char ^ maps to antigravityUsage', () => {
  expect(parsePreset('^')).toEqual([['antigravityUsage']]);
});
```
> Confirmed: `scripts/widgets/index.ts` exports `getWidget(id)` backed by a `widgetRegistry` Map with entries like `['geminiUsage', geminiUsageWidget]`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/__tests__/widgets.test.ts -t antigravityUsage`
Expected: FAIL — unregistered / char unmapped.

- [ ] **Step 3: Wire it up**

In `scripts/widgets/index.ts`: add `import { antigravityUsageWidget } from './antigravity-usage.js';` and a `['antigravityUsage', antigravityUsageWidget],` entry in the `widgetRegistry` Map (next to the `['geminiUsage', geminiUsageWidget],` line). In `scripts/types.ts`: add `'^': 'antigravityUsage',` to `PRESET_CHAR_MAP`, and append `'antigravityUsage'` to the `detailed` preset's `codexUsage`/`geminiUsage` line in `DISPLAY_PRESETS`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/__tests__/widgets.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/widgets/index.ts scripts/types.ts scripts/__tests__/widgets.test.ts
git commit -m "feat: register antigravityUsage widget and preset char"
```

---

### Task 8: check-usage CLI section

**Files:**
- Modify: `scripts/check-usage.ts`
- Test: `scripts/__tests__/check-usage.test.ts` if present; else rely on the manual run in Step 4.

**Interfaces:**
- Consumes: `fetchAntigravityUsage`, `isAntigravityInstalled`, `renderSection` (existing envelope), `AntigravityUsageLimits`.
- Produces: `renderAntigravitySection(...)`, included in the aggregate output + recommendation.

- [ ] **Step 1: Add the import and section renderer**

Mirror `renderGeminiSection`. Add near it:
```typescript
import { fetchAntigravityUsage, isAntigravityInstalled } from './utils/antigravity-client.js';
import type { AntigravityUsageLimits } from './types.js';

function renderAntigravitySection(usage: number, data: AntigravityUsageLimits | null, t: Translations): string {
  if (!data || data.groups.length === 0) return renderSection('Antigravity', usage, t, () => {}, false);
  return renderSection('Antigravity', usage, t, (lines) => {
    for (const g of data.groups) {
      const pct = g.usedPercent ?? 0;
      lines.push(formatUsageRow(g.label, pct, g.resetAt ? formatTimeRemaining(new Date(g.resetAt), t) : ''));
    }
  });
}
```
> Match the exact `renderSection`/`formatUsageRow` signatures in this file — copy the shape from `renderGeminiSection` verbatim, substituting Antigravity.

- [ ] **Step 2: Wire into the aggregate flow**

Where Gemini is fetched and pushed into the sections list (and into the "most available capacity" comparison), add the Antigravity equivalent: guard with `await isAntigravityInstalled()`, fetch via `fetchAntigravityUsage`, compute its availability as `100 - max(usedPercent across groups)` for the recommendation. Update the file header comment and any provider list string to include Antigravity.

- [ ] **Step 3: Build and run the CLI**

Run: `npm run build && node dist/check-usage.js --lang en`
Expected: an `Antigravity` section appears (populated if installed, "not installed" otherwise); no crash; recommendation still prints.

- [ ] **Step 4: Commit**

```bash
git add scripts/check-usage.ts
git commit -m "feat: add Antigravity section to check-usage CLI"
```

---

### Task 9: Locales

**Files:**
- Modify: `locales/en.json`, `locales/ko.json`

**Interfaces:**
- Produces: any label/error keys the widget or check-usage section reference (only if they use `ctx.translations`; the widget above uses `formatTimeRemaining` which already consumes translations — add a key only if a new literal is introduced).

- [ ] **Step 1: Add keys if needed**

If Task 6/8 introduced a user-facing literal beyond the group labels (which are provider-supplied), add matching keys to both `en.json` and `ko.json`, following the `gemini`-related keys' structure. If no new literal was introduced, record that here and skip to commit-less completion (note it in the task log).

- [ ] **Step 2: Verify JSON validity**

Run: `node -e "JSON.parse(require('fs').readFileSync('locales/en.json')); JSON.parse(require('fs').readFileSync('locales/ko.json')); console.log('ok')"`
Expected: `ok`.

- [ ] **Step 3: Commit** (only if files changed)

```bash
git add locales/en.json locales/ko.json
git commit -m "chore: add Antigravity locale strings"
```

---

### Task 10: Documentation

**Files:**
- Modify: `CLAUDE.md` (Available Widgets table, Preset Shortcuts table `^`, widget count if stated), `README.md`, `commands/setup.md`, `commands/check-usage.md`

**Interfaces:** none (docs only).

- [ ] **Step 1: Update CLAUDE.md**

Add an `antigravityUsage` row to the Available Widgets table (Data Source: `Antigravity API`; Description: `Antigravity CLI usage (weekly, per model group: Gemini / Claude+GPT)`). Add `` `^` `` → `antigravityUsage` to the Preset Shortcuts char table. Update any hardcoded widget count.

- [ ] **Step 2: Update README.md + setup.md + check-usage.md**

Add the widget to the README widget list and `commands/setup.md` examples where Gemini is listed. In `commands/check-usage.md`, add Antigravity to the provider list in the description and body.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md README.md commands/setup.md commands/check-usage.md
git commit -m "docs: document antigravityUsage widget and check-usage section"
```

---

### Task 11: Build, full test, manual verification, version bump

**Files:**
- Modify: `dist/index.js`, `dist/check-usage.js` (built), `package.json` + `.claude-plugin/plugin.json` (version), `.claude-plugin/marketplace.json` if it carries a version.

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all pass, including the new Antigravity tests.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: `dist/index.js` and `dist/check-usage.js` regenerate with no errors.

- [ ] **Step 3: Manual status-line smoke test**

Run: `echo '{"model":{"display_name":"Opus"},"workspace":{"current_dir":"'"$PWD"'"}}' | node dist/index.js`
Expected: renders without crashing. With `agy` installed, a detailed-mode config shows `🪐 …`; without it, the widget is absent (no error).

- [ ] **Step 4: Manual checklist (from spec §10 / CLAUDE.md)**

Confirm: compact/normal/detailed modes, Korean/English, API-error `⚠️`, missing-data hide, theme switching, `disabledWidgets` filters `antigravityUsage`.

- [ ] **Step 5: Version bump + commit**

Bump the patch/minor version in `package.json` and `.claude-plugin/plugin.json` (match the repo's release convention), then:
```bash
git add dist/index.js dist/check-usage.js package.json .claude-plugin/plugin.json
git commit -m "chore: build dist and bump version for Antigravity support"
```

---

## Post-implementation

- Open a PR against `main` (no `develop` branch exists): `feat: add Antigravity CLI usage widget`, body with Summary / Changes / Usage / Test plan, `Closes #78`.
- Reply on issue #78 summarizing what shipped (English) and noting the macOS-keychain follow-up (spec §11).
```
