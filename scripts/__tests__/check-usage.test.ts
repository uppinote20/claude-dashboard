/**
 * @handbook 8.1-test-structure
 * @covers scripts/check-usage.ts
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeToISO,
  parseClaudeUsage,
  parseCodexUsage,
  parseGeminiUsage,
  parseAntigravityUsage,
  parseZaiUsage,
  calculateRecommendation,
} from '../check-usage.js';
import type {
  UsageLimits,
  CodexUsageLimits,
  GeminiUsageLimits,
  AntigravityUsageLimits,
  CLIUsageInfo,
} from '../types.js';
import type { ZaiUsageLimits } from '../utils/zai-api-client.js';
import { MOCK_TRANSLATIONS } from './fixtures.js';

describe('normalizeToISO', () => {
  it('should return null for null input', () => {
    expect(normalizeToISO(null)).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(normalizeToISO('')).toBeNull();
  });

  it('should convert valid date string to ISO format', () => {
    const result = normalizeToISO('2025-01-15T10:30:00Z');
    expect(result).toBe('2025-01-15T10:30:00.000Z');
  });

  it('should handle date strings without time', () => {
    const result = normalizeToISO('2025-01-15');
    expect(result).toMatch(/^2025-01-15T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
  });

  it('should return null for invalid date string', () => {
    expect(normalizeToISO('invalid-date')).toBeNull();
    expect(normalizeToISO('not-a-date')).toBeNull();
    expect(normalizeToISO('2025-13-45')).toBeNull(); // Invalid month/day
  });
});

describe('parseClaudeUsage', () => {
  it('should return error result for null limits', () => {
    const result = parseClaudeUsage(null);
    expect(result.name).toBe('Claude');
    expect(result.available).toBe(true);
    expect(result.error).toBe(true);
    expect(result.fiveHourPercent).toBeNull();
    expect(result.sevenDayPercent).toBeNull();
  });

  it('should parse valid usage limits', () => {
    const limits: UsageLimits = {
      five_hour: {
        utilization: 45.6,
        resets_at: '2025-01-15T10:00:00Z',
      },
      seven_day: {
        utilization: 23.4,
        resets_at: '2025-01-20T00:00:00Z',
      },
      seven_day_sonnet: null,
    };

    const result = parseClaudeUsage(limits);
    expect(result.name).toBe('Claude');
    expect(result.available).toBe(true);
    expect(result.error).toBe(false);
    expect(result.fiveHourPercent).toBe(46); // Rounded
    expect(result.sevenDayPercent).toBe(23); // Rounded
    expect(result.fiveHourReset).toBe('2025-01-15T10:00:00.000Z');
    expect(result.sevenDayReset).toBe('2025-01-20T00:00:00.000Z');
  });

  it('should handle partial data (missing five_hour)', () => {
    const limits: UsageLimits = {
      five_hour: null,
      seven_day: {
        utilization: 50,
        resets_at: '2025-01-20T00:00:00Z',
      },
      seven_day_sonnet: null,
    };

    const result = parseClaudeUsage(limits);
    expect(result.fiveHourPercent).toBeNull();
    expect(result.fiveHourReset).toBeNull();
    expect(result.sevenDayPercent).toBe(50);
  });
});

describe('parseCodexUsage', () => {
  it('should return not-installed result when not installed', () => {
    const result = parseCodexUsage(null, false);
    expect(result.name).toBe('Codex');
    expect(result.available).toBe(false);
    expect(result.error).toBe(false);
  });

  it('should return error result when installed but limits null', () => {
    const result = parseCodexUsage(null, true);
    expect(result.name).toBe('Codex');
    expect(result.available).toBe(true);
    expect(result.error).toBe(true);
  });

  it('should parse valid Codex limits', () => {
    const limits: CodexUsageLimits = {
      model: 'gpt-4o',
      planType: 'pro',
      primary: {
        usedPercent: 30.5,
        resetAt: 1705312800, // Unix timestamp
      },
      secondary: {
        usedPercent: 15.2,
        resetAt: 1705917600,
      },
    };

    const result = parseCodexUsage(limits, true);
    expect(result.name).toBe('Codex');
    expect(result.available).toBe(true);
    expect(result.error).toBe(false);
    expect(result.fiveHourPercent).toBe(31); // Rounded
    expect(result.sevenDayPercent).toBe(15); // Rounded
    expect(result.model).toBe('gpt-4o');
    expect(result.plan).toBe('pro');
    // Check that reset times are converted to ISO strings
    expect(result.fiveHourReset).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    expect(result.sevenDayReset).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
  });

  it('should handle missing primary/secondary windows', () => {
    const limits: CodexUsageLimits = {
      model: 'gpt-4o',
      planType: 'plus',
      primary: null,
      secondary: null,
    };

    const result = parseCodexUsage(limits, true);
    expect(result.fiveHourPercent).toBeNull();
    expect(result.sevenDayPercent).toBeNull();
    expect(result.fiveHourReset).toBeNull();
    expect(result.sevenDayReset).toBeNull();
  });
});

describe('parseGeminiUsage', () => {
  it('should return not-installed result when not installed', () => {
    const result = parseGeminiUsage(null, false);
    expect(result.name).toBe('Gemini');
    expect(result.available).toBe(false);
    expect(result.error).toBe(false);
  });

  it('should return error result when installed but limits null', () => {
    const result = parseGeminiUsage(null, true);
    expect(result.name).toBe('Gemini');
    expect(result.available).toBe(true);
    expect(result.error).toBe(true);
  });

  it('should parse valid Gemini limits with buckets', () => {
    const limits: GeminiUsageLimits = {
      model: 'gemini-2.0-flash',
      usedPercent: 40,
      resetAt: '2025-01-15T10:00:00Z',
      buckets: [
        { modelId: 'gemini-2.0-flash', usedPercent: 40, resetAt: '2025-01-15T10:00:00Z' },
        { modelId: 'gemini-2.5-pro', usedPercent: 25, resetAt: '2025-01-15T12:00:00Z' },
      ],
    };

    const result = parseGeminiUsage(limits, true);
    expect(result.name).toBe('Gemini');
    expect(result.available).toBe(true);
    expect(result.error).toBe(false);
    expect(result.fiveHourPercent).toBe(40);
    expect(result.model).toBe('gemini-2.0-flash');
    expect(result.buckets).toHaveLength(2);
    expect(result.buckets?.[0].modelId).toBe('gemini-2.0-flash');
    expect(result.buckets?.[1].usedPercent).toBe(25);
  });

  it('should normalize bucket reset times to ISO', () => {
    const limits: GeminiUsageLimits = {
      model: 'gemini-2.0-flash',
      usedPercent: 50,
      resetAt: '2025-01-15T10:00:00Z',
      buckets: [
        { modelId: 'gemini-2.0-flash', usedPercent: 50, resetAt: '2025-01-15T10:00:00' },
      ],
    };

    const result = parseGeminiUsage(limits, true);
    expect(result.buckets?.[0].resetAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
  });
});

describe('parseAntigravityUsage', () => {
  it('should return not-installed result when not installed', () => {
    const result = parseAntigravityUsage(null, false);
    expect(result.name).toBe('Antigravity');
    expect(result.available).toBe(false);
    expect(result.error).toBe(false);
  });

  it('should return error result when installed but limits null', () => {
    const result = parseAntigravityUsage(null, true);
    expect(result.name).toBe('Antigravity');
    expect(result.available).toBe(true);
    expect(result.error).toBe(true);
  });

  it('should expose the tightest family group as the primary/7d metric', () => {
    const limits: AntigravityUsageLimits = {
      model: 'Gemini 3.6 Flash (Low)',
      planType: 'free',
      groups: [
        { label: 'Gemini', usedPercent: 27, resetAt: '2026-08-11T00:00:00Z' },
        { label: 'Claude+GPT', usedPercent: 39, resetAt: '2026-08-10T21:00:00Z' },
      ],
      buckets: [
        { modelId: 'gemini-3-6-flash', label: 'Gemini 3.6 Flash', usedPercent: 27, resetAt: '2026-08-11T00:00:00Z' },
      ],
    };

    const result = parseAntigravityUsage(limits, true);
    expect(result.name).toBe('Antigravity');
    expect(result.available).toBe(true);
    expect(result.error).toBe(false);
    expect(result.primaryPercent).toBe(39);
    expect(result.fiveHourPercent).toBeNull();
    expect(result.sevenDayPercent).toBe(39);
    expect(result.sevenDayReset).toBe('2026-08-10T21:00:00.000Z');
    expect(result.model).toBe('Gemini 3.6 Flash (Low)');
    expect(result.plan).toBe('free');
    expect(result.groups).toHaveLength(2);
    expect(result.groups?.[1].label).toBe('Claude+GPT');
    expect(result.groups?.[1].resetAt).toBe('2026-08-10T21:00:00.000Z');
    expect(result.buckets).toHaveLength(1);
    expect(result.buckets?.[0].modelId).toBe('gemini-3-6-flash');
    expect(result.buckets?.[0].label).toBe('Gemini 3.6 Flash');
  });

  it('should handle groups without percentages', () => {
    const limits: AntigravityUsageLimits = {
      groups: [{ label: 'Gemini', usedPercent: null, resetAt: null }],
      buckets: [],
    };

    const result = parseAntigravityUsage(limits, true);
    expect(result.primaryPercent).toBeNull();
    expect(result.sevenDayPercent).toBeNull();
    expect(result.sevenDayReset).toBeNull();
    expect(result.groups).toHaveLength(1);
    expect(result.buckets).toHaveLength(0);
  });
});

describe('parseZaiUsage', () => {
  it('should return not-installed result when not installed', () => {
    const result = parseZaiUsage(null, false);
    expect(result.name).toBe('z.ai');
    expect(result.available).toBe(false);
    expect(result.error).toBe(false);
  });

  it('should return error result when installed but limits null', () => {
    const result = parseZaiUsage(null, true);
    expect(result.name).toBe('z.ai');
    expect(result.available).toBe(true);
    expect(result.error).toBe(true);
  });

  it('should parse valid z.ai limits', () => {
    const limits: ZaiUsageLimits = {
      model: 'GLM-4',
      tokensPercent: 35,
      tokensResetAt: 1705312800000, // ms timestamp
      mcpPercent: 20,
      mcpResetAt: 1705917600000,
    };

    const result = parseZaiUsage(limits, true);
    expect(result.name).toBe('z.ai');
    expect(result.available).toBe(true);
    expect(result.error).toBe(false);
    expect(result.fiveHourPercent).toBe(35); // tokensPercent maps to fiveHourPercent
    expect(result.sevenDayPercent).toBe(20); // mcpPercent maps to sevenDayPercent
    expect(result.model).toBe('GLM-4');
    // Check that reset times are converted to ISO strings
    expect(result.fiveHourReset).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    expect(result.sevenDayReset).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
  });

  it('should handle null percentages', () => {
    const limits: ZaiUsageLimits = {
      model: 'GLM-4',
      tokensPercent: null,
      tokensResetAt: null,
      mcpPercent: null,
      mcpResetAt: null,
    };

    const result = parseZaiUsage(limits, true);
    expect(result.fiveHourPercent).toBeNull();
    expect(result.sevenDayPercent).toBeNull();
    expect(result.fiveHourReset).toBeNull();
    expect(result.sevenDayReset).toBeNull();
  });
});

describe('calculateRecommendation', () => {
  const createUsage = (overrides: Partial<CLIUsageInfo>): CLIUsageInfo => ({
    name: 'Test',
    available: true,
    error: false,
    primaryPercent: null,
    fiveHourPercent: null,
    sevenDayPercent: null,
    fiveHourReset: null,
    sevenDayReset: null,
    ...overrides,
  });

  it('should return noData when no CLIs have valid data', () => {
    const claude = createUsage({ name: 'Claude', error: true });
    const result = calculateRecommendation([claude, null, null], MOCK_TRANSLATIONS);
    expect(result.name).toBeNull();
    expect(result.reason).toBe('No usage data available');
  });

  it('should recommend CLI with lowest primary usage', () => {
    const claude = createUsage({ name: 'Claude', primaryPercent: 50 });
    const codex = createUsage({ name: 'Codex', primaryPercent: 30 });
    const gemini = createUsage({ name: 'Gemini', primaryPercent: 40 });

    const result = calculateRecommendation([claude, codex, gemini], MOCK_TRANSLATIONS);
    expect(result.name).toBe('codex');
    expect(result.reason).toContain('30%');
  });

  it('should skip CLIs that are not available', () => {
    const claude = createUsage({ name: 'Claude', primaryPercent: 50 });
    const codex = createUsage({ name: 'Codex', available: false, primaryPercent: 10 });

    const result = calculateRecommendation([claude, codex], MOCK_TRANSLATIONS);
    expect(result.name).toBe('claude');
  });

  it('should skip CLIs with errors', () => {
    const claude = createUsage({ name: 'Claude', primaryPercent: 50 });
    const codex = createUsage({ name: 'Codex', error: true, primaryPercent: 10 });

    const result = calculateRecommendation([claude, codex], MOCK_TRANSLATIONS);
    expect(result.name).toBe('claude');
  });

  it('should skip CLIs with null primaryPercent', () => {
    const claude = createUsage({ name: 'Claude', primaryPercent: 50 });
    const codex = createUsage({ name: 'Codex', primaryPercent: null });

    const result = calculateRecommendation([claude, codex], MOCK_TRANSLATIONS);
    expect(result.name).toBe('claude');
  });

  it('should consider z.ai in recommendation', () => {
    const claude = createUsage({ name: 'Claude', primaryPercent: 50 });
    const zai = createUsage({ name: 'z.ai', primaryPercent: 5 });

    const result = calculateRecommendation([claude, zai], MOCK_TRANSLATIONS);
    expect(result.name).toBe('z.ai');
    expect(result.reason).toContain('5%');
  });

  it('should consider antigravity via its weekly primary metric', () => {
    const claude = createUsage({ name: 'Claude', primaryPercent: 50 });
    const antigravity = createUsage({ name: 'Antigravity', primaryPercent: 7 });

    const result = calculateRecommendation([claude, antigravity], MOCK_TRANSLATIONS);
    expect(result.name).toBe('antigravity');
    expect(result.reason).toContain('7%');
  });

  it('should handle all CLIs with equal usage', () => {
    const claude = createUsage({ name: 'Claude', primaryPercent: 25 });
    const codex = createUsage({ name: 'Codex', primaryPercent: 25 });
    const gemini = createUsage({ name: 'Gemini', primaryPercent: 25 });
    const zai = createUsage({ name: 'z.ai', primaryPercent: 25 });

    const result = calculateRecommendation([claude, codex, gemini, zai], MOCK_TRANSLATIONS);
    // Should pick first one alphabetically after sort (all have same score)
    expect(result.name).not.toBeNull();
    expect(result.reason).toContain('25%');
  });
});
