import { describe, it, expect } from 'vitest';
import {
  rateLimit5hWidget,
  rateLimit7dWidget,
  rateLimit7dSonnetWidget,
} from '../widgets/rate-limit.js';
import type { WidgetContext, UsageLimits, Config } from '../types.js';
import { MOCK_TRANSLATIONS, MOCK_CONFIG, MOCK_STDIN } from './fixtures.js';

// Helper to create widget context
function createContext(rateLimits: UsageLimits | null | undefined, config?: Partial<Config>): WidgetContext {
  return {
    stdin: MOCK_STDIN,
    config: { ...MOCK_CONFIG, ...config },
    translations: MOCK_TRANSLATIONS,
    rateLimits,
  };
}

describe('rate-limit widgets', () => {
  describe('rateLimit5hWidget', () => {
    it('should return error data when rateLimits is null (API failed)', async () => {
      const ctx = createContext(null);
      const data = await rateLimit5hWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.isError).toBe(true);
    });

    it('should render warning icon when API failed', () => {
      const ctx = createContext(null);
      const errorData = { utilization: 0, resetsAt: null, isError: true };
      const result = rateLimit5hWidget.render(errorData, ctx);

      // Should contain warning emoji (with or without ANSI codes)
      expect(result).toContain('⚠️');
    });

    it('should return error data when five_hour is not available', async () => {
      const ctx = createContext({
        five_hour: null,
        seven_day: null,
        seven_day_sonnet: null,
      });
      const data = await rateLimit5hWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.isError).toBe(true);
    });

    it('should return correct data when five_hour is available', async () => {
      const ctx = createContext({
        five_hour: { utilization: 45.7, resets_at: '2024-01-01T12:00:00Z' },
        seven_day: null,
        seven_day_sonnet: null,
      });
      const data = await rateLimit5hWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.utilization).toBe(46); // Rounded
      expect(data?.resetsAt).toBe('2024-01-01T12:00:00Z');
      expect(data?.isError).toBeUndefined();
    });

    it('should render utilization percentage', () => {
      const ctx = createContext(null);
      const data = { utilization: 75, resetsAt: null };
      const result = rateLimit5hWidget.render(data, ctx);

      expect(result).toContain('5h');
      expect(result).toContain('75%');
    });
  });

  describe('rateLimit7dWidget', () => {
    it('should return null for non-max plan', async () => {
      const ctx = createContext(
        { five_hour: null, seven_day: { utilization: 50, resets_at: null }, seven_day_sonnet: null },
        { plan: 'pro' }
      );
      const data = await rateLimit7dWidget.getData(ctx);

      expect(data).toBeNull();
    });

    it('should return null when API failed (different from 5h widget)', async () => {
      const ctx = createContext(null, { plan: 'max' });
      const data = await rateLimit7dWidget.getData(ctx);

      // 7d widget returns null on API failure (5h widget handles the warning)
      expect(data).toBeNull();
    });

    it('should return data for max plan when seven_day is available', async () => {
      const ctx = createContext(
        { five_hour: null, seven_day: { utilization: 30, resets_at: null }, seven_day_sonnet: null },
        { plan: 'max' }
      );
      const data = await rateLimit7dWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.utilization).toBe(30);
    });

    it('should render 7d label', () => {
      const ctx = createContext(null, { plan: 'max' });
      const data = { utilization: 50, resetsAt: null };
      const result = rateLimit7dWidget.render(data, ctx);

      expect(result).toContain('7d');
      expect(result).toContain('50%');
    });
  });

  describe('rateLimit7dSonnetWidget', () => {
    it('should return null for non-max plan', async () => {
      const ctx = createContext(
        { five_hour: null, seven_day: null, seven_day_sonnet: { utilization: 25, resets_at: null } },
        { plan: 'pro' }
      );
      const data = await rateLimit7dSonnetWidget.getData(ctx);

      expect(data).toBeNull();
    });

    it('should return data for max plan when seven_day_sonnet is available', async () => {
      const ctx = createContext(
        { five_hour: null, seven_day: null, seven_day_sonnet: { utilization: 25, resets_at: null } },
        { plan: 'max' }
      );
      const data = await rateLimit7dSonnetWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.utilization).toBe(25);
    });

    it('should render 7d-S label', () => {
      const ctx = createContext(null, { plan: 'max' });
      const data = { utilization: 60, resetsAt: null };
      const result = rateLimit7dSonnetWidget.render(data, ctx);

      expect(result).toContain('7d-S');
      expect(result).toContain('60%');
    });
  });
});
