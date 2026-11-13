/**
 * Fit per-token-kind prices from observed request costs, and turn the fit into
 * Claude Code's `modelPricing` managed setting.
 *
 * Model: cost = sum(tokens_kind * price_kind) / 1e6, one price per kind:
 * input, output, 5m cache write, 1h cache write, cache read. Thinking tokens are
 * part of output_tokens and image tokens part of input_tokens, so neither needs
 * its own term; a non-zero residual means the gateway bills something the model
 * does not have (a tier, a surcharge) and the fit should not be trusted.
 * @tested scripts/__tests__/pricing-fit.test.ts
 */

export const PRICE_KINDS = ['input', 'output', 'cacheWrite5m', 'cacheWrite1h', 'cacheRead'] as const;
export type PriceKind = (typeof PRICE_KINDS)[number];

/** Messages API `usage` block (the fields this module reads). */
export interface ApiUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation?: {
    ephemeral_5m_input_tokens?: number;
    ephemeral_1h_input_tokens?: number;
  } | null;
}

export interface CostSample {
  label: string;
  usage: ApiUsage;
  /** Cost the gateway reported for this request, USD. */
  costUsd: number;
}

/** USD per million tokens; null when the probes never exercised that kind. */
export type FittedPrices = Record<PriceKind, number | null>;

export interface SampleResidual {
  label: string;
  costUsd: number;
  predictedUsd: number;
  relError: number;
}

export interface PriceFit {
  prices: FittedPrices;
  residuals: SampleResidual[];
  maxRelError: number;
}

/** One row of Claude Code's `modelPricing.overrides` (USD per million tokens). */
export interface ModelPricingRow {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

/**
 * Parse a response's cost header. Returns null when the header is absent,
 * blank or not a non-negative number, so a missing or misnamed header is
 * never read as a free request (`Number(null)` and `Number('')` are 0).
 */
export function parseCostHeader(raw: string | null): number | null {
  if (raw === null || !/^\s*(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?\s*$/.test(raw)) return null;
  const v = Number(raw);
  return Number.isFinite(v) ? v : null;
}

/**
 * Token counts per price kind. Cache writes without a TTL breakdown are counted
 * as 5m writes, the API default.
 */
export function usageVector(u: ApiUsage): number[] {
  const write = num(u.cache_creation_input_tokens);
  const w1h = num(u.cache_creation?.ephemeral_1h_input_tokens);
  const w5m = u.cache_creation ? num(u.cache_creation.ephemeral_5m_input_tokens) : write;
  return [num(u.input_tokens), num(u.output_tokens), w5m, w1h, num(u.cache_read_input_tokens)];
}

/** Solve A x = b for a small square system (Gaussian elimination, partial pivoting). */
function solve(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    if (Math.abs(m[p][c]) < 1e-12) return null;
    [m[c], m[p]] = [m[p], m[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = m[r][c] / m[c][c];
      for (let k = c; k <= n; k++) m[r][k] -= f * m[c][k];
    }
  }
  return m.map((row, i) => row[n] / row[i]);
}

/**
 * Least-squares fit of prices to samples. Kinds no sample exercised come back
 * null. Returns null when the exercised kinds are not separable (e.g. every
 * sample has the same input/output ratio) — add more varied probes.
 */
export function fitPrices(samples: CostSample[]): PriceFit | null {
  if (samples.length === 0) return null;
  const rows = samples.map((s) => usageVector(s.usage));
  const used = PRICE_KINDS.map((_, k) => rows.some((r) => r[k] > 0));
  const cols = used.flatMap((u, k) => (u ? [k] : []));
  if (samples.length < cols.length) return null;

  // Scale tokens to millions so the normal equations stay well conditioned.
  const x = rows.map((r) => cols.map((k) => r[k] / 1e6));
  const y = samples.map((s) => s.costUsd);
  const ata = cols.map((_, i) => cols.map((_, j) => x.reduce((acc, r) => acc + r[i] * r[j], 0)));
  const aty = cols.map((_, i) => x.reduce((acc, r, s) => acc + r[i] * y[s], 0));
  const sol = solve(ata, aty);
  if (!sol) return null;

  const prices = Object.fromEntries(PRICE_KINDS.map((k) => [k, null])) as FittedPrices;
  cols.forEach((k, i) => {
    prices[PRICE_KINDS[k]] = roundPrice(sol[i]);
  });

  const residuals = samples.map((s, i) => {
    const predictedUsd = predictCost(rows[i], prices);
    return {
      label: s.label,
      costUsd: s.costUsd,
      predictedUsd,
      relError: s.costUsd > 0 ? Math.abs(predictedUsd - s.costUsd) / s.costUsd : Math.abs(predictedUsd),
    };
  });
  return { prices, residuals, maxRelError: Math.max(...residuals.map((r) => r.relError)) };
}

/** Rate cards are quoted to a few decimals; strip float noise from the fit. */
function roundPrice(v: number): number {
  return Math.round(v * 1e6) / 1e6;
}

function predictCost(vector: number[], prices: FittedPrices): number {
  return PRICE_KINDS.reduce((acc, k, i) => acc + vector[i] * (prices[k] ?? 0), 0) / 1e6;
}

/**
 * Claude Code's override row has a single cacheWrite rate; it bills 1h writes
 * at that rate too. Use the 5m price, falling back to the 1h price.
 */
export function toModelPricingRow(prices: FittedPrices): ModelPricingRow | null {
  const cacheWrite = prices.cacheWrite5m ?? prices.cacheWrite1h;
  if (prices.input === null || prices.output === null || prices.cacheRead === null || cacheWrite === null) {
    return null;
  }
  return { input: prices.input, output: prices.output, cacheRead: prices.cacheRead, cacheWrite };
}

/**
 * Override keys to write for a model ID returned by the API. Claude Code
 * matches overrides by the model string the session uses, which behind a
 * gateway may be a deployment name like `Claude-Opus-5.5[1m]` rather than the
 * API ID `claude-opus-5-5`; also list the dotted and `[1m]` spellings.
 */
export function overrideKeys(modelId: string): string[] {
  const id = modelId.toLowerCase();
  const dotted = id.replace(/-(\d+)-(\d+)$/, '-$1.$2');
  return [...new Set([id, dotted, `${dotted}[1m]`])];
}

/** Merge rows into an existing managed-settings object without touching other keys. */
export function mergeModelPricing(
  settings: Record<string, unknown>,
  rows: Record<string, ModelPricingRow>
): Record<string, unknown> {
  const current = (settings.modelPricing ?? {}) as { overrides?: Record<string, ModelPricingRow> };
  const overrides = { ...(current.overrides ?? {}) };
  for (const [model, row] of Object.entries(rows)) {
    for (const key of overrideKeys(model)) overrides[key] = row;
  }
  return { ...settings, modelPricing: { ...current, overrides } };
}
