#!/usr/bin/env node
/**
 * Calibrate per-model token prices against a gateway that reports each
 * request's cost in a response header, then print (or write) the Claude Code
 * `modelPricing` managed setting so /cost and the status line cost widgets use
 * those rates.
 *
 * Every probe is a real, billed request. The default set costs a few cents per
 * model at list-like prices; --large adds >200K-token prompts (roughly $1-$10
 * per model) to check that cost stays linear at long context.
 * @tested scripts/__tests__/pricing-fit.test.ts
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { deflateSync } from 'zlib';
import { getClaudeConfigDir } from './utils/config-dir.js';
import {
  fitPrices,
  mergeModelPricing,
  parseCostHeader,
  toModelPricingRow,
  usageVector,
  PRICE_KINDS,
  type ApiUsage,
  type CostSample,
  type ModelPricingRow,
} from './utils/pricing-fit.js';

const MANAGED_SETTINGS = '/etc/claude-code/managed-settings.json';
const MAX_REL_ERROR = 1e-3;

interface Options {
  models: string[];
  costHeader: string;
  baseUrl: string;
  large: boolean;
  out: string | null;
  mergeFrom: string | null;
  force: boolean;
}

const USAGE = `Usage: calibrate-pricing --models <id,id,...> --cost-header <name> [options]

  --models <list>       Comma-separated model names as the gateway accepts them
  --cost-header <name>  Response header carrying the request cost in USD
  --base-url <url>      API base URL (default: ANTHROPIC_BASE_URL, then api.anthropic.com)
  --large               Also probe >200K-token prompts (more expensive)
  --out <file>          Write merged managed settings JSON here instead of printing it
  --merge-from <file>   Existing managed settings to merge into (default: ${MANAGED_SETTINGS} if present)
  --force               Emit pricing even when the fit residual exceeds ${MAX_REL_ERROR}

Auth comes from ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / ANTHROPIC_CUSTOM_HEADERS,
read from the environment or, when unset there, from the "env" block of settings.json.`;

function parseArgs(argv: string[]): Options {
  const get = (flag: string): string | null => {
    const i = argv.indexOf(flag);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
  };
  const models = (get('--models') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const costHeader = get('--cost-header');
  if (models.length === 0 || !costHeader || argv.includes('--help')) {
    console.error(USAGE);
    process.exit(1);
  }
  const env = settingsEnv();
  return {
    models,
    costHeader: costHeader.toLowerCase(),
    baseUrl: (get('--base-url') ?? env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com').replace(/\/+$/, ''),
    large: argv.includes('--large'),
    out: get('--out'),
    mergeFrom: get('--merge-from') ?? (existsSync(MANAGED_SETTINGS) ? MANAGED_SETTINGS : null),
    force: argv.includes('--force'),
  };
}

/** Process env layered over the "env" block of the user's settings.json. */
function settingsEnv(): Record<string, string | undefined> {
  let fromSettings: Record<string, string> = {};
  try {
    const s = JSON.parse(readFileSync(join(getClaudeConfigDir(), 'settings.json'), 'utf-8'));
    if (s && typeof s.env === 'object') fromSettings = s.env;
  } catch {
    // no settings.json: environment only
  }
  return { ...fromSettings, ...process.env };
}

function authHeaders(): Record<string, string> {
  const env = settingsEnv();
  const headers: Record<string, string> = { 'anthropic-version': '2023-06-01', 'content-type': 'application/json' };
  if (env.ANTHROPIC_API_KEY) headers['x-api-key'] = env.ANTHROPIC_API_KEY;
  else if (env.ANTHROPIC_AUTH_TOKEN) headers.authorization = `Bearer ${env.ANTHROPIC_AUTH_TOKEN}`;
  for (const line of (env.ANTHROPIC_CUSTOM_HEADERS ?? '').split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) headers[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return headers;
}

const WORDS = 'alpha beta gamma delta kernel tensor matrix vector router cache token prefill decode shard rank expert lattice orbit quartz meadow river copper falcon'.split(' ');

/** Deterministic, cache-unfriendly filler text (~4 tokens per word). */
function filler(words: number, seed: string): string {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const out: string[] = [];
  for (let i = 0; i < words; i++) {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    out.push(`${WORDS[h % WORDS.length]}${h % 10000}`);
  }
  return out.join(' ');
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A small RGB gradient PNG, to confirm image tokens bill at the input rate. */
function testPng(size = 256): string {
  const chunk = (type: string, data: Buffer): Buffer => {
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size * 3; x++) raw[y * (size * 3 + 1) + 1 + x] = (x * 7 + y * 3) & 0xff;
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return png.toString('base64');
}

interface Probe {
  label: string;
  body: Record<string, unknown>;
}

const ask = (text: string) => [{ role: 'user', content: text }];

/**
 * Probes chosen so every price kind appears alone at least once (separable)
 * and once mixed with others (cross-check): plain input at two sizes, output,
 * a reasoning prompt (thinking tokens), 5m and 1h cache write + read, a mixed
 * read/write/uncached request, an image, and optionally long prompts.
 */
function probes(nonce: string, large: boolean): Probe[] {
  const small = { max_tokens: 32 };
  const sys5m = [{ type: 'text', text: filler(4000, `${nonce}c5`), cache_control: { type: 'ephemeral' } }];
  const sys1h = [{ type: 'text', text: filler(4000, `${nonce}c1`), cache_control: { type: 'ephemeral', ttl: '1h' } }];
  const list: Probe[] = [
    { label: 'tiny', body: { ...small, messages: ask('hi') } },
    { label: 'input ~16K', body: { ...small, messages: ask(`${filler(3000, `${nonce}i1`)}\nReply OK.`) } },
    { label: 'input ~47K', body: { ...small, messages: ask(`${filler(9000, `${nonce}i2`)}\nReply OK.`) } },
    { label: 'output', body: { max_tokens: 3000, messages: ask('Write a 500-word story about a lighthouse.') } },
    {
      label: 'thinking',
      body: {
        max_tokens: 8000,
        messages: ask('How many integers 1..10000 are divisible by 3 or 7 but not 21? Answer with the number.'),
      },
    },
    { label: 'cache write 5m', body: { ...small, system: sys5m, messages: ask('Reply OK.') } },
    { label: 'cache read 5m', body: { ...small, system: sys5m, messages: ask('Reply OK.') } },
    { label: 'cache write 1h', body: { ...small, system: sys1h, messages: ask('Reply OK.') } },
    { label: 'cache read 1h', body: { ...small, system: sys1h, messages: ask('Reply OK.') } },
    {
      label: 'mixed',
      body: {
        ...small,
        system: [...sys1h, { type: 'text', text: filler(3000, `${nonce}c5b`), cache_control: { type: 'ephemeral' } }],
        messages: ask(`${filler(500, `${nonce}t`)}\nReply OK.`),
      },
    },
    {
      label: 'image',
      body: {
        ...small,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: testPng() } },
              { type: 'text', text: 'Reply OK.' },
            ],
          },
        ],
      },
    },
  ];
  if (large) {
    const big = [{ type: 'text', text: filler(60000, `${nonce}big`), cache_control: { type: 'ephemeral', ttl: '1h' } }];
    list.push(
      { label: 'input ~210K', body: { ...small, messages: ask(`${filler(40000, `${nonce}l1`)}\nReply OK.`) } },
      { label: 'input ~390K', body: { ...small, messages: ask(`${filler(75000, `${nonce}l2`)}\nReply OK.`) } },
      { label: 'cache write 1h ~315K', body: { ...small, system: big, messages: ask('Reply OK.') } },
      { label: 'cache read 1h ~315K', body: { ...small, system: big, messages: ask('Reply OK.') } }
    );
  }
  return list;
}

interface ProbeResult {
  sample: CostSample;
  modelId: string;
}

async function runProbe(opts: Options, headers: Record<string, string>, model: string, p: Probe): Promise<ProbeResult | null> {
  const res = await fetch(`${opts.baseUrl}/v1/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, ...p.body }),
  });
  if (!res.ok) {
    console.error(`  ${p.label}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    return null;
  }
  const json = (await res.json()) as { model?: string; usage?: ApiUsage };
  const raw = res.headers.get(opts.costHeader);
  const cost = parseCostHeader(raw);
  if (!json.usage || cost === null) {
    const why = !json.usage ? 'no usage in the response' : raw === null ? `no "${opts.costHeader}" header` : `"${opts.costHeader}" is not a cost: ${JSON.stringify(raw)}`;
    console.error(`  ${p.label}: ${why}`);
    return null;
  }
  return { sample: { label: p.label, usage: json.usage, costUsd: cost }, modelId: json.model ?? model };
}

function fmt(n: number | null): string {
  return n === null ? '-' : String(n);
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const headers = authHeaders();
  const rows: Record<string, ModelPricingRow> = {};
  let ok = true;

  for (const model of opts.models) {
    console.error(`\n${model}: probing ${opts.baseUrl}`);
    const nonce = `${model}-${Date.now()}`;
    const results: ProbeResult[] = [];
    for (const p of probes(nonce, opts.large)) {
      const r = await runProbe(opts, headers, model, p);
      if (r) results.push(r);
    }
    const fit = fitPrices(results.map((r) => r.sample));
    if (!fit) {
      console.error(`  not enough successful probes to fit ${model}`);
      ok = false;
      continue;
    }
    const modelId = results[0].modelId;
    console.error(`  model id: ${modelId}`);
    console.error(`  $/1M tokens: ${PRICE_KINDS.map((k) => `${k}=${fmt(fit.prices[k])}`).join('  ')}`);
    for (const [i, r] of fit.residuals.entries()) {
      const v = usageVector(results[i].sample.usage);
      console.error(
        `    ${r.label.padEnd(22)} tokens[in,out,w5m,w1h,read]=${JSON.stringify(v)}  cost=${r.costUsd}  rel.err=${r.relError.toExponential(1)}`
      );
    }
    if (fit.maxRelError > MAX_REL_ERROR && !opts.force) {
      console.error(
        `  max relative error ${fit.maxRelError.toExponential(2)} > ${MAX_REL_ERROR}: cost is not linear in these token kinds; skipping (use --force to emit anyway)`
      );
      ok = false;
      continue;
    }
    const row = toModelPricingRow(fit.prices);
    if (!row) {
      console.error('  some price kinds were never exercised; skipping');
      ok = false;
      continue;
    }
    rows[modelId] = row;
  }

  if (Object.keys(rows).length > 0) {
    const base = opts.mergeFrom ? JSON.parse(readFileSync(opts.mergeFrom, 'utf-8')) : {};
    const merged = JSON.stringify(mergeModelPricing(base, rows), null, 2) + '\n';
    if (opts.out) {
      writeFileSync(opts.out, merged);
      console.error(`\nWrote ${opts.out}. Install it as ${MANAGED_SETTINGS} (needs root), then start a new session.`);
    } else {
      process.stdout.write(merged);
    }
  }
  process.exit(ok ? 0 : 2);
}

main().catch((err: unknown) => {
  console.error('Error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
