import { describe, it, expect } from 'vitest';
import { hashToken, HASH_LENGTH } from '../utils/hash.js';

describe('hashToken', () => {
  it('should return consistent hash for same input', () => {
    const token = 'test-token-12345';
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);

    expect(hash1).toBe(hash2);
  });

  it('should return different hashes for different inputs', () => {
    const hash1 = hashToken('token-a');
    const hash2 = hashToken('token-b');

    expect(hash1).not.toBe(hash2);
  });

  it('should return hash of correct length', () => {
    const token = 'some-oauth-token';
    const hash = hashToken(token);

    expect(hash).toHaveLength(HASH_LENGTH);
  });

  it('should return hexadecimal string', () => {
    const token = 'test-token';
    const hash = hashToken(token);

    expect(hash).toMatch(/^[a-f0-9]+$/);
  });

  it('should handle empty string', () => {
    const hash = hashToken('');

    expect(hash).toHaveLength(HASH_LENGTH);
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });

  it('should handle special characters', () => {
    const token = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
    const hash = hashToken(token);

    expect(hash).toHaveLength(HASH_LENGTH);
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });

  it('HASH_LENGTH should be 16 for collision resistance', () => {
    expect(HASH_LENGTH).toBe(16);
  });
});
