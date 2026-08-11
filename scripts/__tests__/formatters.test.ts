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
  calculatePercent,
  formatDuration,
  formatWindowLabel,
} from '../utils/formatters.js';
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
