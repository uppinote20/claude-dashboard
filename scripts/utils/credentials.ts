/**
 * OAuth credential extraction with platform-specific caching
 * @handbook 4.4-credential-caching
 */
import { execFileSync } from 'child_process';
import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

/**
 * Cache TTL for keychain credentials (10 seconds)
 * Keychain access is expensive, so we cache for a short period
 */
const KEYCHAIN_CACHE_TTL_MS = 10_000;

/**
 * Cached credentials with mtime-based invalidation for file
 * or TTL-based invalidation for keychain
 */
let credentialsCache: {
  token: string | null;
  mtime?: number; // For file-based cache
  timestamp?: number; // For keychain-based cache
} | null = null;

/**
 * Get OAuth access token from Claude Code credentials
 *
 * On macOS: Reads from Keychain (TTL-based cache)
 * On Linux/Windows: Reads from ~/.claude/.credentials.json (mtime-based cache)
 *
 * @returns Access token or null if not found
 */
export async function getCredentials(): Promise<string | null> {
  try {
    if (process.platform === 'darwin') {
      return await getCredentialsFromKeychain();
    }
    return await getCredentialsFromFile();
  } catch {
    return null;
  }
}

/**
 * Get credentials from macOS Keychain (with TTL-based cache)
 */
async function getCredentialsFromKeychain(): Promise<string | null> {
  // Check TTL-based cache
  if (
    credentialsCache?.timestamp &&
    Date.now() - credentialsCache.timestamp < KEYCHAIN_CACHE_TTL_MS
  ) {
    return credentialsCache.token;
  }

  try {
    const result = execFileSync(
      'security',
      ['find-generic-password', '-s', 'Claude Code-credentials', '-w'],
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();

    const creds = JSON.parse(result);
    const token = creds?.claudeAiOauth?.accessToken ?? null;

    // Cache result
    credentialsCache = { token, timestamp: Date.now() };
    return token;
  } catch {
    // Fallback to file if Keychain fails
    return await getCredentialsFromFile();
  }
}

/**
 * Get credentials from file (~/.claude/.credentials.json) with mtime-based cache
 */
async function getCredentialsFromFile(): Promise<string | null> {
  try {
    const credPath = join(homedir(), '.claude', '.credentials.json');

    // Check mtime for cache invalidation
    const fileStat = await stat(credPath);
    const mtime = fileStat.mtimeMs;

    // Return cached if mtime matches
    if (credentialsCache?.mtime === mtime) {
      return credentialsCache.token;
    }

    const content = await readFile(credPath, 'utf-8');
    const creds = JSON.parse(content);
    const token = creds?.claudeAiOauth?.accessToken ?? null;

    // Cache result
    credentialsCache = { token, mtime };
    return token;
  } catch {
    return null;
  }
}
