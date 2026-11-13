#!/usr/bin/env node

// scripts/calibrate-pricing.ts
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join as join2 } from "path";
import { deflateSync } from "zlib";

// scripts/utils/config-dir.ts
import { join } from "path";
import { homedir } from "os";
var DEFAULT_CONFIG_DIR = join(homedir(), ".claude");
var DEFAULT_CLAUDE_JSON_PATH = join(homedir(), ".claude.json");
function getClaudeConfigDir() {
  return process.env.CLAUDE_CONFIG_DIR || DEFAULT_CONFIG_DIR;
}

// scripts/utils/pricing-fit.ts
var PRICE_KINDS = ["input", "output", "cacheWrite5m", "cacheWrite1h", "cacheRead"];
var num = (v) => typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
function parseCostHeader(raw) {
  if (raw === null || !/^\s*(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?\s*$/.test(raw))
    return null;
  const v = Number(raw);
  return Number.isFinite(v) ? v : null;
}
function usageVector(u) {
  const write = num(u.cache_creation_input_tokens);
  const w1h = num(u.cache_creation?.ephemeral_1h_input_tokens);
  const w5m = u.cache_creation ? num(u.cache_creation.ephemeral_5m_input_tokens) : write;
  return [num(u.input_tokens), num(u.output_tokens), w5m, w1h, num(u.cache_read_input_tokens)];
}
function solve(a, b) {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++)
      if (Math.abs(m[r][c]) > Math.abs(m[p][c]))
        p = r;
    if (Math.abs(m[p][c]) < 1e-12)
      return null;
    [m[c], m[p]] = [m[p], m[c]];
    for (let r = 0; r < n; r++) {
      if (r === c)
        continue;
      const f = m[r][c] / m[c][c];
      for (let k = c; k <= n; k++)
        m[r][k] -= f * m[c][k];
    }
  }
  return m.map((row, i) => row[n] / row[i]);
}
function fitPrices(samples) {
  if (samples.length === 0)
    return null;
  const rows = samples.map((s) => usageVector(s.usage));
  const used = PRICE_KINDS.map((_, k) => rows.some((r) => r[k] > 0));
  const cols = used.flatMap((u, k) => u ? [k] : []);
  if (samples.length < cols.length)
    return null;
  const x = rows.map((r) => cols.map((k) => r[k] / 1e6));
  const y = samples.map((s) => s.costUsd);
  const ata = cols.map((_, i) => cols.map((_2, j) => x.reduce((acc, r) => acc + r[i] * r[j], 0)));
  const aty = cols.map((_, i) => x.reduce((acc, r, s) => acc + r[i] * y[s], 0));
  const sol = solve(ata, aty);
  if (!sol)
    return null;
  const prices = Object.fromEntries(PRICE_KINDS.map((k) => [k, null]));
  cols.forEach((k, i) => {
    prices[PRICE_KINDS[k]] = roundPrice(sol[i]);
  });
  const residuals = samples.map((s, i) => {
    const predictedUsd = predictCost(rows[i], prices);
    return {
      label: s.label,
      costUsd: s.costUsd,
      predictedUsd,
      relError: s.costUsd > 0 ? Math.abs(predictedUsd - s.costUsd) / s.costUsd : Math.abs(predictedUsd)
    };
  });
  return { prices, residuals, maxRelError: Math.max(...residuals.map((r) => r.relError)) };
}
function roundPrice(v) {
  return Math.round(v * 1e6) / 1e6;
}
function predictCost(vector, prices) {
  return PRICE_KINDS.reduce((acc, k, i) => acc + vector[i] * (prices[k] ?? 0), 0) / 1e6;
}
function toModelPricingRow(prices) {
  const cacheWrite = prices.cacheWrite5m ?? prices.cacheWrite1h;
  if (prices.input === null || prices.output === null || prices.cacheRead === null || cacheWrite === null) {
    return null;
  }
  return { input: prices.input, output: prices.output, cacheRead: prices.cacheRead, cacheWrite };
}
function overrideKeys(modelId) {
  const id = modelId.toLowerCase();
  const dotted = id.replace(/-(\d+)-(\d+)$/, "-$1.$2");
  return [.../* @__PURE__ */ new Set([id, dotted, `${dotted}[1m]`])];
}
function mergeModelPricing(settings, rows) {
  const current = settings.modelPricing ?? {};
  const overrides = { ...current.overrides ?? {} };
  for (const [model, row] of Object.entries(rows)) {
    for (const key of overrideKeys(model))
      overrides[key] = row;
  }
  return { ...settings, modelPricing: { ...current, overrides } };
}

// scripts/calibrate-pricing.ts
var MANAGED_SETTINGS = "/etc/claude-code/managed-settings.json";
var MAX_REL_ERROR = 1e-3;
var USAGE = `Usage: calibrate-pricing --models <id,id,...> --cost-header <name> [options]

  --models <list>       Comma-separated model names as the gateway accepts them
  --cost-header <name>  Response header carrying the request cost in USD
  --base-url <url>      API base URL (default: ANTHROPIC_BASE_URL, then api.anthropic.com)
  --large               Also probe >200K-token prompts (more expensive)
  --out <file>          Write merged managed settings JSON here instead of printing it
  --merge-from <file>   Existing managed settings to merge into (default: ${MANAGED_SETTINGS} if present)
  --force               Emit pricing even when the fit residual exceeds ${MAX_REL_ERROR}

Auth comes from ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / ANTHROPIC_CUSTOM_HEADERS,
read from the environment or, when unset there, from the "env" block of settings.json.`;
function parseArgs(argv) {
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
  };
  const models = (get("--models") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const costHeader = get("--cost-header");
  if (models.length === 0 || !costHeader || argv.includes("--help")) {
    console.error(USAGE);
    process.exit(1);
  }
  const env = settingsEnv();
  return {
    models,
    costHeader: costHeader.toLowerCase(),
    baseUrl: (get("--base-url") ?? env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com").replace(/\/+$/, ""),
    large: argv.includes("--large"),
    out: get("--out"),
    mergeFrom: get("--merge-from") ?? (existsSync(MANAGED_SETTINGS) ? MANAGED_SETTINGS : null),
    force: argv.includes("--force")
  };
}
function settingsEnv() {
  let fromSettings = {};
  try {
    const s = JSON.parse(readFileSync(join2(getClaudeConfigDir(), "settings.json"), "utf-8"));
    if (s && typeof s.env === "object")
      fromSettings = s.env;
  } catch {
  }
  return { ...fromSettings, ...process.env };
}
function authHeaders() {
  const env = settingsEnv();
  const headers = { "anthropic-version": "2023-06-01", "content-type": "application/json" };
  if (env.ANTHROPIC_API_KEY)
    headers["x-api-key"] = env.ANTHROPIC_API_KEY;
  else if (env.ANTHROPIC_AUTH_TOKEN)
    headers.authorization = `Bearer ${env.ANTHROPIC_AUTH_TOKEN}`;
  for (const line of (env.ANTHROPIC_CUSTOM_HEADERS ?? "").split("\n")) {
    const i = line.indexOf(":");
    if (i > 0)
      headers[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return headers;
}
var WORDS = "alpha beta gamma delta kernel tensor matrix vector router cache token prefill decode shard rank expert lattice orbit quartz meadow river copper falcon".split(" ");
function filler(words, seed) {
  let h = 2166136261;
  for (const c of seed)
    h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const out = [];
  for (let i = 0; i < words; i++) {
    h = Math.imul(h ^ h >>> 13, 1540483477) >>> 0;
    out.push(`${WORDS[h % WORDS.length]}${h % 1e4}`);
  }
  return out.join(" ");
}
var CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++)
    c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 4294967295;
  for (const b of buf)
    c = CRC_TABLE[(c ^ b) & 255] ^ c >>> 8;
  return (c ^ 4294967295) >>> 0;
}
function testPng(size = 256) {
  const chunk = (type, data) => {
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
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
    for (let x = 0; x < size * 3; x++)
      raw[y * (size * 3 + 1) + 1 + x] = x * 7 + y * 3 & 255;
  }
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
  return png.toString("base64");
}
var ask = (text) => [{ role: "user", content: text }];
function probes(nonce, large) {
  const small = { max_tokens: 32 };
  const sys5m = [{ type: "text", text: filler(4e3, `${nonce}c5`), cache_control: { type: "ephemeral" } }];
  const sys1h = [{ type: "text", text: filler(4e3, `${nonce}c1`), cache_control: { type: "ephemeral", ttl: "1h" } }];
  const list = [
    { label: "tiny", body: { ...small, messages: ask("hi") } },
    { label: "input ~16K", body: { ...small, messages: ask(`${filler(3e3, `${nonce}i1`)}
Reply OK.`) } },
    { label: "input ~47K", body: { ...small, messages: ask(`${filler(9e3, `${nonce}i2`)}
Reply OK.`) } },
    { label: "output", body: { max_tokens: 3e3, messages: ask("Write a 500-word story about a lighthouse.") } },
    {
      label: "thinking",
      body: {
        max_tokens: 8e3,
        messages: ask("How many integers 1..10000 are divisible by 3 or 7 but not 21? Answer with the number.")
      }
    },
    { label: "cache write 5m", body: { ...small, system: sys5m, messages: ask("Reply OK.") } },
    { label: "cache read 5m", body: { ...small, system: sys5m, messages: ask("Reply OK.") } },
    { label: "cache write 1h", body: { ...small, system: sys1h, messages: ask("Reply OK.") } },
    { label: "cache read 1h", body: { ...small, system: sys1h, messages: ask("Reply OK.") } },
    {
      label: "mixed",
      body: {
        ...small,
        system: [...sys1h, { type: "text", text: filler(3e3, `${nonce}c5b`), cache_control: { type: "ephemeral" } }],
        messages: ask(`${filler(500, `${nonce}t`)}
Reply OK.`)
      }
    },
    {
      label: "image",
      body: {
        ...small,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/png", data: testPng() } },
              { type: "text", text: "Reply OK." }
            ]
          }
        ]
      }
    }
  ];
  if (large) {
    const big = [{ type: "text", text: filler(6e4, `${nonce}big`), cache_control: { type: "ephemeral", ttl: "1h" } }];
    list.push(
      { label: "input ~210K", body: { ...small, messages: ask(`${filler(4e4, `${nonce}l1`)}
Reply OK.`) } },
      { label: "input ~390K", body: { ...small, messages: ask(`${filler(75e3, `${nonce}l2`)}
Reply OK.`) } },
      { label: "cache write 1h ~315K", body: { ...small, system: big, messages: ask("Reply OK.") } },
      { label: "cache read 1h ~315K", body: { ...small, system: big, messages: ask("Reply OK.") } }
    );
  }
  return list;
}
async function runProbe(opts, headers, model, p) {
  const res = await fetch(`${opts.baseUrl}/v1/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model, ...p.body })
  });
  if (!res.ok) {
    console.error(`  ${p.label}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    return null;
  }
  const json = await res.json();
  const raw = res.headers.get(opts.costHeader);
  const cost = parseCostHeader(raw);
  if (!json.usage || cost === null) {
    const why = !json.usage ? "no usage in the response" : raw === null ? `no "${opts.costHeader}" header` : `"${opts.costHeader}" is not a cost: ${JSON.stringify(raw)}`;
    console.error(`  ${p.label}: ${why}`);
    return null;
  }
  return { sample: { label: p.label, usage: json.usage, costUsd: cost }, modelId: json.model ?? model };
}
function fmt(n) {
  return n === null ? "-" : String(n);
}
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const headers = authHeaders();
  const rows = {};
  let ok = true;
  for (const model of opts.models) {
    console.error(`
${model}: probing ${opts.baseUrl}`);
    const nonce = `${model}-${Date.now()}`;
    const results = [];
    for (const p of probes(nonce, opts.large)) {
      const r = await runProbe(opts, headers, model, p);
      if (r)
        results.push(r);
    }
    const fit = fitPrices(results.map((r) => r.sample));
    if (!fit) {
      console.error(`  not enough successful probes to fit ${model}`);
      ok = false;
      continue;
    }
    const modelId = results[0].modelId;
    console.error(`  model id: ${modelId}`);
    console.error(`  $/1M tokens: ${PRICE_KINDS.map((k) => `${k}=${fmt(fit.prices[k])}`).join("  ")}`);
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
      console.error("  some price kinds were never exercised; skipping");
      ok = false;
      continue;
    }
    rows[modelId] = row;
  }
  if (Object.keys(rows).length > 0) {
    const base = opts.mergeFrom ? JSON.parse(readFileSync(opts.mergeFrom, "utf-8")) : {};
    const merged = JSON.stringify(mergeModelPricing(base, rows), null, 2) + "\n";
    if (opts.out) {
      writeFileSync(opts.out, merged);
      console.error(`
Wrote ${opts.out}. Install it as ${MANAGED_SETTINGS} (needs root), then start a new session.`);
    } else {
      process.stdout.write(merged);
    }
  }
  process.exit(ok ? 0 : 2);
}
main().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
