/**
 * @handbook 8.1-test-structure
 * @covers scripts/utils/i18n.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectSystemLanguage,
  getTranslations,
  getTranslationsByLang,
} from '../utils/i18n.js';
import type { Config } from '../types.js';

describe('i18n', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('detectSystemLanguage', () => {
    it('should detect Korean from LANG', () => {
      process.env.LANG = 'ko_KR.UTF-8';
      expect(detectSystemLanguage()).toBe('ko');
    });

    it('should detect Korean from LC_ALL', () => {
      delete process.env.LANG;
      process.env.LC_ALL = 'ko_KR.UTF-8';
      expect(detectSystemLanguage()).toBe('ko');
    });

    it('should detect Korean from LC_MESSAGES', () => {
      delete process.env.LANG;
      delete process.env.LC_ALL;
      process.env.LC_MESSAGES = 'ko_KR.UTF-8';
      expect(detectSystemLanguage()).toBe('ko');
    });

    it('should default to English', () => {
      delete process.env.LANG;
      delete process.env.LC_ALL;
      delete process.env.LC_MESSAGES;
      expect(detectSystemLanguage()).toBe('en');
    });

    it('should default to English for non-Korean locales', () => {
      process.env.LANG = 'en_US.UTF-8';
      expect(detectSystemLanguage()).toBe('en');

      process.env.LANG = 'ja_JP.UTF-8';
      expect(detectSystemLanguage()).toBe('en');
    });
  });

  describe('getTranslations', () => {
    it('should return English translations for language=en', () => {
      const config: Config = {
        language: 'en',
        plan: 'max',
        displayMode: 'compact',
        cache: { ttlSeconds: 60 },
      };
      const t = getTranslations(config);
      expect(t.labels['5h']).toBe('5h');
      expect(t.time.hours).toBe('h');
    });

    it('should return Korean translations for language=ko', () => {
      const config: Config = {
        language: 'ko',
        plan: 'max',
        displayMode: 'compact',
        cache: { ttlSeconds: 60 },
      };
      const t = getTranslations(config);
      expect(t.time.hours).toBe('시간');
      expect(t.time.minutes).toBe('분');
    });

    it('should auto-detect language when set to auto', () => {
      process.env.LANG = 'ko_KR.UTF-8';
      const config: Config = {
        language: 'auto',
        plan: 'max',
        displayMode: 'compact',
        cache: { ttlSeconds: 60 },
      };
      const t = getTranslations(config);
      expect(t.time.hours).toBe('시간');
    });
  });

  describe('getTranslationsByLang', () => {
    it('should return English translations', () => {
      const t = getTranslationsByLang('en');
      expect(t.labels['5h']).toBe('5h');
    });

    it('should return Korean translations', () => {
      const t = getTranslationsByLang('ko');
      expect(t.time.hours).toBe('시간');
    });
  });
});
