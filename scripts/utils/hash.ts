import { createHash } from 'crypto';

/**
 * Hash length for token cache keys
 * 16 hex characters = 64 bits = 2^64 keyspace for collision resistance
 */
const HASH_LENGTH = 16;

/**
 * Generate a short hash from token for cache key
 * Uses SHA-256 and takes first 16 characters
 *
 * @param token - The OAuth access token
 * @returns 16-character hash string
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex').substring(0, HASH_LENGTH);
}

/** Exported for testing */
export { HASH_LENGTH };
