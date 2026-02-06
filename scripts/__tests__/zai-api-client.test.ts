import { describe, it, expect } from 'vitest';
import { clampPercent, calculateUsagePercent, parseUsagePercent } from '../utils/zai-api-client.js';

describe('zai-api-client', () => {
  describe('clampPercent', () => {
    it('should return value within normal range', () => {
      expect(clampPercent(50)).toBe(50);
    });

    it('should clamp to 0-100 boundaries', () => {
      expect(clampPercent(-10)).toBe(0);
      expect(clampPercent(0)).toBe(0);
      expect(clampPercent(100)).toBe(100);
      expect(clampPercent(150)).toBe(100);
    });

    it('should round decimal values', () => {
      expect(clampPercent(42.6)).toBe(43);
    });
  });

  describe('calculateUsagePercent', () => {
    it('should calculate percentage from currentValue and remaining', () => {
      expect(calculateUsagePercent(50, 50)).toBe(50);
    });

    it('should return 100 when fully used', () => {
      expect(calculateUsagePercent(100, 0)).toBe(100);
    });

    it('should return 0 when unused', () => {
      expect(calculateUsagePercent(0, 100)).toBe(0);
    });

    it('should return null when total is 0', () => {
      expect(calculateUsagePercent(0, 0)).toBeNull();
    });

    it('should return null when total is negative', () => {
      expect(calculateUsagePercent(-1, -1)).toBeNull();
    });
  });

  describe('parseUsagePercent', () => {
    it('should prefer percentage field', () => {
      expect(parseUsagePercent({ percentage: 42 })).toBe(42);
    });

    it('should calculate from currentValue and remaining', () => {
      expect(parseUsagePercent({ currentValue: 30, remaining: 70 })).toBe(30);
    });

    it('should calculate from currentValue and usage (total limit)', () => {
      expect(parseUsagePercent({ currentValue: 25, usage: 100 })).toBe(25);
    });

    it('should prefer percentage over other fields', () => {
      expect(parseUsagePercent({
        percentage: 42,
        currentValue: 30,
        remaining: 70,
        usage: 100,
      })).toBe(42);
    });

    it('should return null for empty object', () => {
      expect(parseUsagePercent({})).toBeNull();
    });

    it('should return null when usage is 0 (division by zero)', () => {
      expect(parseUsagePercent({ currentValue: 50, usage: 0 })).toBeNull();
    });

    it('should return null when usage is negative', () => {
      expect(parseUsagePercent({ currentValue: 50, usage: -100 })).toBeNull();
    });

    it('should prefer percentage over currentValue/remaining', () => {
      expect(parseUsagePercent({
        percentage: 80,
        currentValue: 30,
        remaining: 70,
      })).toBe(80);
    });
  });
});
