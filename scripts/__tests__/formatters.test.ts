/**
 * @handbook 8.1-test-structure
 * @covers scripts/utils/formatters.ts
 */
import { describe, it, expect } from 'vitest';
import {
  formatTokens,
  formatCost,
  formatTimeRemaining,
  shortenModelName,
  parseModelName,
  calculatePercent,
  formatDuration,
  formatWindowLabel, sparkline, formatElapsed } from '../utils/formatters.js';
import type { Translations } from '../types.js';
import { MOCK_TRANSLATIONS } from './fixtures.js';

describe('formatters', () => {
  describe('formatTokens', () => {
    it('should return raw number for small values', () => {
      expect(formatTokens(0)).toBe('0');
      expect(formatTokens(999)).toBe('999');
    });

    it('should format thousands as K', () => {
      expect(formatTokens(1000)).toBe('1.0K');
      expect(formatTokens(1500)).toBe('1.5K');
      expect(formatTokens(9999)).toBe('10.0K');
      expect(formatTokens(10000)).toBe('10K');
      expect(formatTokens(150000)).toBe('150K');
    });

    it('should format millions as M', () => {
      expect(formatTokens(1000000)).toBe('1.0M');
      expect(formatTokens(1500000)).toBe('1.5M');
      expect(formatTokens(10000000)).toBe('10M');
      expect(formatTokens(25000000)).toBe('25M');
    });
  });

  describe('formatCost', () => {
    it('should format cost with 2 decimal places', () => {
      expect(formatCost(0)).toBe('$0.00');
      expect(formatCost(0.5)).toBe('$0.50');
      expect(formatCost(1.234)).toBe('$1.23');
      expect(formatCost(10.999)).toBe('$11.00');
      expect(formatCost(100)).toBe('$100.00');
    });
  });

  describe('formatTimeRemaining', () => {
    it('should return 0m for past times', () => {
      const pastTime = new Date(Date.now() - 60000);
      expect(formatTimeRemaining(pastTime, MOCK_TRANSLATIONS)).toBe('0m');
    });

    it('should format minutes only', () => {
      const futureTime = new Date(Date.now() + 45 * 60 * 1000);
      const result = formatTimeRemaining(futureTime, MOCK_TRANSLATIONS);
      expect(result).toMatch(/^\d+m$/);
    });

    it('should format hours and minutes', () => {
      const futureTime = new Date(Date.now() + 2.5 * 60 * 60 * 1000);
      const result = formatTimeRemaining(futureTime, MOCK_TRANSLATIONS);
      expect(result).toMatch(/^\d+h\d+m$/);
    });

    it('should accept ISO string', () => {
      const futureTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const result = formatTimeRemaining(futureTime, MOCK_TRANSLATIONS);
      expect(result).toMatch(/^\d+m$/);
    });
  });

  describe('parseModelName', () => {
    it('reads the version from current display names', () => {
      expect(parseModelName('Opus 5.5')).toEqual({ family: 'Opus', version: '5.5' });
      expect(parseModelName('Fable 5.1')).toEqual({ family: 'Fable', version: '5.1' });
      expect(parseModelName('Claude Sonnet 5')).toEqual({ family: 'Sonnet', version: '5' });
      expect(parseModelName('Haiku 4.5')).toEqual({ family: 'Haiku', version: '4.5' });
    });

    it('ignores parentheticals such as the 1M context tag', () => {
      expect(parseModelName('Opus 5 (1M context)')).toEqual({ family: 'Opus', version: '5' });
      expect(parseModelName('Sonnet 4.6 (1M context)')).toEqual({ family: 'Sonnet', version: '4.6' });
    });

    it('reads a version placed before the family (legacy names)', () => {
      expect(parseModelName('Claude 3.5 Sonnet')).toEqual({ family: 'Sonnet', version: '3.5' });
    });

    it('reads model ids without mistaking date suffixes for versions', () => {
      expect(parseModelName('claude-opus-4-8[1m]')).toEqual({ family: 'Opus', version: '4.8' });
      expect(parseModelName('claude-fable-5')).toEqual({ family: 'Fable', version: '5' });
      expect(parseModelName('claude-sonnet-4-20250514')).toEqual({ family: 'Sonnet', version: '4' });
      expect(parseModelName('claude-3-5-sonnet-20241022')).toEqual({ family: 'Sonnet', version: '3.5' });
      expect(parseModelName('claude-3-opus-20240229')).toEqual({ family: 'Opus', version: '3' });
    });

    it('reads dotted versions in id-shaped names', () => {
      expect(parseModelName('claude-sonnet-3.5')).toEqual({ family: 'Sonnet', version: '3.5' });
      expect(parseModelName('claude-opus-5.5')).toEqual({ family: 'Opus', version: '5.5' });
    });

    it('omits the version when there is none', () => {
      expect(parseModelName('Claude Opus')).toEqual({ family: 'Opus', version: undefined });
    });

    it('keeps non-Claude names unversioned', () => {
      expect(parseModelName('GPT-4')).toEqual({ family: 'GPT-4' });
      expect(parseModelName('Claude Unknown')).toEqual({ family: 'Unknown' });
    });
  });

  describe('shortenModelName', () => {
    it('should extract Opus from model name', () => {
      expect(shortenModelName('Claude Opus 4')).toBe('Opus');
      expect(shortenModelName('claude-opus-4')).toBe('Opus');
      expect(shortenModelName('Claude 4 Opus')).toBe('Opus');
    });

    it('should extract Sonnet from model name', () => {
      expect(shortenModelName('Claude 3.5 Sonnet')).toBe('Sonnet');
      expect(shortenModelName('claude-sonnet-3.5')).toBe('Sonnet');
    });

    it('should extract Haiku from model name', () => {
      expect(shortenModelName('Claude 3 Haiku')).toBe('Haiku');
      expect(shortenModelName('claude-haiku')).toBe('Haiku');
    });

    it('should extract Fable from model name', () => {
      expect(shortenModelName('Claude Fable 5')).toBe('Fable');
      expect(shortenModelName('claude-fable-5')).toBe('Fable');
      expect(shortenModelName('Fable 5')).toBe('Fable');
    });

    it('should fallback to second word after Claude', () => {
      expect(shortenModelName('Claude Unknown')).toBe('Unknown');
    });

    it('should return original if no pattern matches', () => {
      expect(shortenModelName('GPT-4')).toBe('GPT-4');
    });
  });

  describe('calculatePercent', () => {
    it('should calculate percentage correctly', () => {
      expect(calculatePercent(50, 100)).toBe(50);
      expect(calculatePercent(1, 4)).toBe(25);
      expect(calculatePercent(75, 100)).toBe(75);
    });

    it('should return 0 for zero total', () => {
      expect(calculatePercent(50, 0)).toBe(0);
      expect(calculatePercent(0, 0)).toBe(0);
    });

    it('should cap at 100%', () => {
      expect(calculatePercent(150, 100)).toBe(100);
    });

    it('should round to nearest integer', () => {
      expect(calculatePercent(1, 3)).toBe(33);
      expect(calculatePercent(2, 3)).toBe(67);
    });
  });

  describe('formatDuration', () => {
    const timeLabels = { hours: 'h', minutes: 'm' };

    it('should return 0m for zero or negative', () => {
      expect(formatDuration(0, timeLabels)).toBe('0m');
      expect(formatDuration(-1000, timeLabels)).toBe('0m');
    });

    it('should format minutes only', () => {
      expect(formatDuration(5 * 60 * 1000, timeLabels)).toBe('5m');
      expect(formatDuration(30 * 60 * 1000, timeLabels)).toBe('30m');
    });

    it('should format hours only when no remaining minutes', () => {
      expect(formatDuration(60 * 60 * 1000, timeLabels)).toBe('1h');
      expect(formatDuration(2 * 60 * 60 * 1000, timeLabels)).toBe('2h');
    });

    it('should format hours and minutes', () => {
      expect(formatDuration(90 * 60 * 1000, timeLabels)).toBe('1h30m');
      expect(formatDuration(125 * 60 * 1000, timeLabels)).toBe('2h5m');
    });
  });

  describe('formatWindowLabel', () => {
    it('should use the localized label for known windows', () => {
      expect(formatWindowLabel(5 * 3600, 'fallback', MOCK_TRANSLATIONS)).toBe('5h');
      expect(formatWindowLabel(7 * 86400, 'fallback', MOCK_TRANSLATIONS)).toBe('7d');
    });

    it('should label a weekly primary window as 7d, not 5h', () => {
      // Codex Pro returns a single 604800s primary window and a null secondary
      expect(formatWindowLabel(604800, MOCK_TRANSLATIONS.labels['5h'], MOCK_TRANSLATIONS)).toBe('7d');
    });

    it('should derive a label for other durations', () => {
      expect(formatWindowLabel(3600, 'fallback', MOCK_TRANSLATIONS)).toBe('1h');
      expect(formatWindowLabel(30 * 86400, 'fallback', MOCK_TRANSLATIONS)).toBe('30d');
      expect(formatWindowLabel(30 * 60, 'fallback', MOCK_TRANSLATIONS)).toBe('30m');
    });

    it('should localize derived labels with the translated time units', () => {
      const ko: Translations = {
        ...MOCK_TRANSLATIONS,
        labels: { ...MOCK_TRANSLATIONS.labels, '5h': '5시간', '7d': '7일' },
        time: { days: '일', hours: '시간', minutes: '분', seconds: '초' },
      };

      expect(formatWindowLabel(5 * 3600, 'fallback', ko)).toBe('5시간');
      expect(formatWindowLabel(30 * 86400, 'fallback', ko)).toBe('30일');
      expect(formatWindowLabel(3 * 3600, 'fallback', ko)).toBe('3시간');
    });

    it('should fall back when the duration is unknown or invalid', () => {
      expect(formatWindowLabel(null, 'fallback', MOCK_TRANSLATIONS)).toBe('fallback');
      expect(formatWindowLabel(undefined, 'fallback', MOCK_TRANSLATIONS)).toBe('fallback');
      expect(formatWindowLabel(0, 'fallback', MOCK_TRANSLATIONS)).toBe('fallback');
      expect(formatWindowLabel(-1, 'fallback', MOCK_TRANSLATIONS)).toBe('fallback');
      expect(formatWindowLabel(NaN, 'fallback', MOCK_TRANSLATIONS)).toBe('fallback');
    });
  });
});

describe('sparkline', () => {
  it('scales to the largest value', () => {
    expect(sparkline([0, 4, 8])).toBe('▁▅█');
    expect(sparkline([1, 8])).toBe('▂█');
  });
  it('draws the lowest bar for zeros and nothing for an empty series', () => {
    expect(sparkline([0, 0])).toBe('▁▁');
    expect(sparkline([])).toBe('');
  });
  it('draws a single value as full', () => {
    expect(sparkline([5])).toBe('█');
  });
});

describe('formatElapsed', () => {
  it.each([
    [0, '0s'], [42_000, '42s'], [192_000, '3m12s'], [3_900_000, '1h05m'], [-5, '0s'],
  ])('%d ms -> %s', (ms, expected) => {
    expect(formatElapsed(ms)).toBe(expected);
  });
});
