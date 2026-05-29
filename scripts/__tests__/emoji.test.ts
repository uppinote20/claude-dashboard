/**
 * @handbook 5.5-emoji-icons
 * @handbook 8.1-test-structure
 * @covers scripts/utils/emoji.ts
 */
import { describe, it, expect } from 'vitest';
import { ICON } from '../utils/emoji.js';

describe('ICON registry', () => {
  it('every value ends with U+FE0F (VS-16) — forces emoji presentation', () => {
    for (const [key, value] of Object.entries(ICON)) {
      expect(value, `ICON.${key} must end with U+FE0F`).toMatch(/️$/);
    }
  });

  it('every value is a non-empty string', () => {
    for (const [key, value] of Object.entries(ICON)) {
      expect(typeof value, `ICON.${key} must be a string`).toBe('string');
      expect(value.length, `ICON.${key} must not be empty`).toBeGreaterThan(0);
    }
  });
});
