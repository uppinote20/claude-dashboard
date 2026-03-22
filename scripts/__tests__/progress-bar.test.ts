/**
 * @handbook 8.1-test-structure
 * @covers scripts/utils/progress-bar.ts
 */
import { describe, it, expect } from 'vitest';
import {
  renderProgressBar,
  renderProgressBarPlain,
  DEFAULT_PROGRESS_BAR_CONFIG,
} from '../utils/progress-bar.js';

describe('progress-bar', () => {
  describe('renderProgressBarPlain', () => {
    it('should render 0% as all empty', () => {
      const result = renderProgressBarPlain(0);
      expect(result).toBe('░░░░░░░░░░');
    });

    it('should render 100% as all filled', () => {
      const result = renderProgressBarPlain(100);
      expect(result).toBe('██████████');
    });

    it('should render 50% as half filled', () => {
      const result = renderProgressBarPlain(50);
      expect(result).toBe('█████░░░░░');
    });

    it('should clamp values above 100', () => {
      const result = renderProgressBarPlain(150);
      expect(result).toBe('██████████');
    });

    it('should clamp values below 0', () => {
      const result = renderProgressBarPlain(-10);
      expect(result).toBe('░░░░░░░░░░');
    });

    it('should respect custom config', () => {
      const config = { width: 5, filledChar: '#', emptyChar: '-' };
      expect(renderProgressBarPlain(40, config)).toBe('##---');
      expect(renderProgressBarPlain(80, config)).toBe('####-');
    });

    it('should round percentage correctly', () => {
      // 25% of 10 = 2.5, rounds to 3
      expect(renderProgressBarPlain(25)).toBe('███░░░░░░░');
      // 15% of 10 = 1.5, rounds to 2
      expect(renderProgressBarPlain(15)).toBe('██░░░░░░░░');
    });
  });

  describe('renderProgressBar', () => {
    it('should include ANSI color codes', () => {
      const result = renderProgressBar(50);
      // Should contain escape sequences
      expect(result).toContain('\x1b[');
      // Should contain the bar characters
      expect(result).toContain('█');
      expect(result).toContain('░');
    });

    it('should reset color at end', () => {
      const result = renderProgressBar(50);
      // Should end with reset code
      expect(result).toContain('\x1b[0m');
    });
  });

  describe('DEFAULT_PROGRESS_BAR_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_PROGRESS_BAR_CONFIG.width).toBe(10);
      expect(DEFAULT_PROGRESS_BAR_CONFIG.filledChar).toBe('\u2588');
      expect(DEFAULT_PROGRESS_BAR_CONFIG.emptyChar).toBe('\u2591');
    });
  });
});
