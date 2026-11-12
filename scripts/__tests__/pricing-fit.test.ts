/**
 * @handbook 8.1-test-structure
 * @covers scripts/utils/pricing-fit.ts
 */
import { describe, it, expect } from 'vitest';
import {
  fitPrices,
  mergeModelPricing,
  overrideKeys,
  toModelPricingRow,
  usageVector,
  type ApiUsage,
  type CostSample,
} from '../utils/pricing-fit.js';

// $/1M: input, output, 5m write, 1h write, read
const CARD = [3, 15, 3.75, 6, 0.3];

function sample(label: string, usage: ApiUsage, card = CARD): CostSample {
  const v = usageVector(usage);
  return { label, usage, costUsd: v.reduce((acc, t, i) => acc + t * card[i], 0) / 1e6 };
}

const cc = (w5m: number, w1h: number) => ({
  cache_creation_input_tokens: w5m + w1h,
  cache_creation: { ephemeral_5m_input_tokens: w5m, ephemeral_1h_input_tokens: w1h },
});

const SAMPLES: CostSample[] = [
  sample('tiny', { input_tokens: 10, output_tokens: 14 }),
  sample('input', { input_tokens: 15686, output_tokens: 5 }),
  sample('output', { input_tokens: 25, output_tokens: 1108 }),
  sample('w5m', { input_tokens: 12, output_tokens: 5, ...cc(20988, 0) }),
  sample('r5m', { input_tokens: 12, output_tokens: 5, cache_read_input_tokens: 20988 }),
  sample('w1h', { input_tokens: 12, output_tokens: 5, ...cc(0, 21061) }),
  sample('mixed', { input_tokens: 2623, output_tokens: 5, cache_read_input_tokens: 21061, ...cc(15779, 0) }),
];

describe('usageVector', () => {
  it('splits cache writes by TTL', () => {
    expect(usageVector({ input_tokens: 1, output_tokens: 2, cache_read_input_tokens: 5, ...cc(3, 4) })).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it('counts cache writes without a TTL breakdown as 5m', () => {
    expect(usageVector({ cache_creation_input_tokens: 7 })).toEqual([0, 0, 7, 0, 0]);
  });

  it('treats missing and invalid fields as zero', () => {
    expect(usageVector({ input_tokens: -1, output_tokens: Number.NaN })).toEqual([0, 0, 0, 0, 0]);
  });
});

describe('fitPrices', () => {
  it('recovers every exercised price exactly', () => {
    const fit = fitPrices(SAMPLES)!;
    expect(fit.prices).toEqual({ input: 3, output: 15, cacheWrite5m: 3.75, cacheWrite1h: 6, cacheRead: 0.3 });
    expect(fit.maxRelError).toBeLessThan(1e-9);
  });

  it('returns null for kinds no sample exercised', () => {
    const fit = fitPrices(SAMPLES.filter((s) => s.label !== 'w1h'))!;
    expect(fit.prices.cacheWrite1h).toBeNull();
    expect(fit.prices.input).toBe(3);
  });

  it('flags billing the linear model cannot explain', () => {
    const surcharged = SAMPLES.map((s) => (s.label === 'input' ? { ...s, costUsd: s.costUsd * 2 } : s));
    expect(fitPrices(surcharged)!.maxRelError).toBeGreaterThan(1e-3);
  });

  it('returns null when kinds are not separable', () => {
    const same = [sample('a', { input_tokens: 10, output_tokens: 10 }), sample('b', { input_tokens: 20, output_tokens: 20 })];
    expect(fitPrices(same)).toBeNull();
    expect(fitPrices([])).toBeNull();
  });
});

describe('toModelPricingRow', () => {
  it('uses the 5m write price for cacheWrite', () => {
    expect(toModelPricingRow(fitPrices(SAMPLES)!.prices)).toEqual({ input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 });
  });

  it('falls back to the 1h write price', () => {
    const prices = { input: 1, output: 2, cacheWrite5m: null, cacheWrite1h: 4, cacheRead: 0.1 };
    expect(toModelPricingRow(prices)?.cacheWrite).toBe(4);
  });

  it('returns null when a required kind is missing', () => {
    expect(toModelPricingRow({ input: 1, output: 2, cacheWrite5m: 3, cacheWrite1h: null, cacheRead: null })).toBeNull();
  });
});

describe('overrideKeys', () => {
  it('lists the API ID, the dotted spelling and its [1m] variant', () => {
    expect(overrideKeys('claude-opus-5-5')).toEqual(['claude-opus-5-5', 'claude-opus-5.5', 'claude-opus-5.5[1m]']);
  });

  it('handles IDs without a minor version', () => {
    expect(overrideKeys('claude-sonnet-5')).toEqual(['claude-sonnet-5', 'claude-sonnet-5[1m]']);
  });
});

describe('mergeModelPricing', () => {
  it('adds rows and preserves unrelated settings and overrides', () => {
    const row = { input: 1, output: 2, cacheRead: 0.1, cacheWrite: 1.25 };
    const merged = mergeModelPricing(
      { permissions: { deny: ['x'] }, modelPricing: { multiplier: 1, overrides: { other: row } } },
      { 'claude-sonnet-5': row }
    );
    expect(merged.permissions).toEqual({ deny: ['x'] });
    expect(merged.modelPricing).toEqual({
      multiplier: 1,
      overrides: { other: row, 'claude-sonnet-5': row, 'claude-sonnet-5[1m]': row },
    });
  });
});
