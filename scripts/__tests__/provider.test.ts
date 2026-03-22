/**
 * @handbook 8.1-test-structure
 * @covers scripts/utils/provider.ts
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('provider', () => {
  const originalEnv = process.env.ANTHROPIC_BASE_URL;

  beforeEach(() => {
    delete process.env.ANTHROPIC_BASE_URL;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ANTHROPIC_BASE_URL = originalEnv;
    } else {
      delete process.env.ANTHROPIC_BASE_URL;
    }
  });

  describe('detectProvider', () => {
    it('should return anthropic by default', async () => {
      const { detectProvider } = await import('../utils/provider.js');
      expect(detectProvider()).toBe('anthropic');
    });

    it('should detect z.ai provider', async () => {
      process.env.ANTHROPIC_BASE_URL = 'https://api.z.ai/v1';
      const { detectProvider } = await import('../utils/provider.js');
      expect(detectProvider()).toBe('zai');
    });

    it('should detect ZHIPU provider', async () => {
      process.env.ANTHROPIC_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4';
      const { detectProvider } = await import('../utils/provider.js');
      expect(detectProvider()).toBe('zhipu');
    });
  });

  describe('isZaiProvider', () => {
    it('should return false for anthropic', async () => {
      const { isZaiProvider } = await import('../utils/provider.js');
      expect(isZaiProvider()).toBe(false);
    });

    it('should return true for z.ai', async () => {
      process.env.ANTHROPIC_BASE_URL = 'https://api.z.ai/v1';
      const { isZaiProvider } = await import('../utils/provider.js');
      expect(isZaiProvider()).toBe(true);
    });

    it('should return true for ZHIPU', async () => {
      process.env.ANTHROPIC_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4';
      const { isZaiProvider } = await import('../utils/provider.js');
      expect(isZaiProvider()).toBe(true);
    });
  });

  describe('getZaiApiBaseUrl', () => {
    it('should return null when no base URL', async () => {
      const { getZaiApiBaseUrl } = await import('../utils/provider.js');
      expect(getZaiApiBaseUrl()).toBeNull();
    });

    it('should extract origin from base URL', async () => {
      process.env.ANTHROPIC_BASE_URL = 'https://api.z.ai/v1/messages';
      const { getZaiApiBaseUrl } = await import('../utils/provider.js');
      expect(getZaiApiBaseUrl()).toBe('https://api.z.ai');
    });

    it('should return null for invalid URL', async () => {
      process.env.ANTHROPIC_BASE_URL = 'not-a-url';
      const { getZaiApiBaseUrl } = await import('../utils/provider.js');
      expect(getZaiApiBaseUrl()).toBeNull();
    });
  });
});
