/**
 * Provider detection utility
 * Detects whether Claude is running via Anthropic, z.ai, or ZHIPU
 */

/**
 * Provider type for API routing
 */
export type ProviderType = 'anthropic' | 'zai' | 'zhipu';

/**
 * Detect current provider based on ANTHROPIC_BASE_URL
 */
export function detectProvider(): ProviderType {
  const baseUrl = process.env.ANTHROPIC_BASE_URL || '';

  if (baseUrl.includes('api.z.ai')) {
    return 'zai';
  }
  if (baseUrl.includes('bigmodel.cn')) {
    return 'zhipu';
  }

  return 'anthropic';
}

/**
 * Check if using z.ai or ZHIPU provider
 */
export function isZaiProvider(): boolean {
  const provider = detectProvider();
  return provider === 'zai' || provider === 'zhipu';
}

/**
 * Get the z.ai API base URL from ANTHROPIC_BASE_URL
 * Extracts the origin (scheme + host) for quota API calls
 */
export function getZaiApiBaseUrl(): string | null {
  const baseUrl = process.env.ANTHROPIC_BASE_URL;
  if (!baseUrl) {
    return null;
  }

  try {
    const url = new URL(baseUrl);
    return url.origin;
  } catch {
    return null;
  }
}
