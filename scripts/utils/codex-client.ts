/**
 * Codex CLI API client
 * Fetches usage limits from ChatGPT backend API
 */

import { readFile, stat, writeFile, mkdir } from 'fs/promises';
import { execFileSync } from 'child_process';
import os from 'os';
import path from 'path';
import type { CodexUsageLimits, CacheEntry } from '../types.js';
import { hashToken } from './hash.js';
import { VERSION } from '../version.js';
import { debugLog } from './debug.js';

const API_TIMEOUT_MS = 5000;
const CODEX_AUTH_PATH = path.join(os.homedir(), '.codex', 'auth.json');
const CODEX_CONFIG_PATH = path.join(os.homedir(), '.codex', 'config.toml');
const CACHE_DIR = path.join(os.homedir(), '.cache', 'claude-dashboard');
const MODEL_CACHE_PATH = path.join(CACHE_DIR, 'codex-model-cache.json');

/**
 * In-memory cache for Codex usage
 */
const codexCacheMap: Map<string, CacheEntry<CodexUsageLimits>> = new Map();

/**
 * Pending API requests to prevent duplicates
 */
const pendingRequests: Map<string, Promise<CodexUsageLimits | null>> = new Map();

/**
 * Cached auth data with mtime tracking
 */
let cachedAuth: { data: CodexAuthData; mtime: number } | null = null;

interface CodexAuthData {
  accessToken: string;
  accountId: string;
}

interface CodexModelCache {
  model: string;
  configMtime: number;
}

interface CodexApiResponse {
  plan_type: string;
  rate_limit: {
    allowed: boolean;
    limit_reached: boolean;
    primary_window: {
      used_percent: number;
      limit_window_seconds: number;
      reset_after_seconds: number;
      reset_at: number;
    } | null;
    secondary_window: {
      used_percent: number;
      limit_window_seconds: number;
      reset_after_seconds: number;
      reset_at: number;
    } | null;
  };
  credits: {
    has_credits: boolean;
    unlimited: boolean;
    balance: string;
  };
}

/**
 * Type guard to validate Codex API response structure
 */
function isValidCodexApiResponse(data: unknown): data is CodexApiResponse {
  return (
    data !== null &&
    typeof data === 'object' &&
    'rate_limit' in data &&
    'plan_type' in data &&
    typeof (data as Record<string, unknown>).rate_limit === 'object' &&
    (data as Record<string, unknown>).rate_limit !== null
  );
}

/**
 * Check if Codex CLI is installed
 */
export async function isCodexInstalled(): Promise<boolean> {
  try {
    await stat(CODEX_AUTH_PATH);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get Codex auth credentials from ~/.codex/auth.json
 */
async function getCodexAuth(): Promise<CodexAuthData | null> {
  try {
    const fileStat = await stat(CODEX_AUTH_PATH);

    // Use cached auth if file hasn't changed
    if (cachedAuth && cachedAuth.mtime === fileStat.mtimeMs) {
      return cachedAuth.data;
    }

    const raw = await readFile(CODEX_AUTH_PATH, 'utf-8');
    const json = JSON.parse(raw);

    const accessToken = json?.tokens?.access_token;
    const accountId = json?.tokens?.account_id;

    if (!accessToken || !accountId) {
      return null;
    }

    const data = { accessToken, accountId };
    cachedAuth = { data, mtime: fileStat.mtimeMs };
    return data;
  } catch {
    return null;
  }
}

/**
 * Get model from ~/.codex/config.toml
 */
async function getModelFromConfig(): Promise<string | null> {
  try {
    const raw = await readFile(CODEX_CONFIG_PATH, 'utf-8');
    // Parse simple TOML: model = "value" or model = 'value'
    // Limitations: Only root-level keys supported, no sections [section], no escaped quotes
    const match = raw.match(/^model\s*=\s*["']([^"']+)["']\s*(?:#.*)?$/m);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Get config.toml mtime for cache validation
 */
async function getConfigMtime(): Promise<number> {
  try {
    const fileStat = await stat(CODEX_CONFIG_PATH);
    return fileStat.mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * Load cached model if valid (config.toml unchanged)
 */
async function getCachedModel(currentMtime: number): Promise<string | null> {
  try {
    const raw = await readFile(MODEL_CACHE_PATH, 'utf-8');
    const cache: CodexModelCache = JSON.parse(raw);
    if (cache.configMtime === currentMtime && cache.model) {
      debugLog('codex', 'getCachedModel: cache hit', cache.model);
      return cache.model;
    }
    debugLog('codex', 'getCachedModel: cache stale');
    return null;
  } catch {
    return null;
  }
}

/**
 * Save model to cache
 */
async function saveModelCache(model: string, configMtime: number): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    const cache: CodexModelCache = { model, configMtime };
    await writeFile(MODEL_CACHE_PATH, JSON.stringify(cache), 'utf-8');
    debugLog('codex', 'saveModelCache: saved', model);
  } catch (err) {
    debugLog('codex', 'saveModelCache: error', err);
  }
}

/**
 * Detect model by running codex exec and parsing output header
 */
function detectModelFromCodexExec(): string | null {
  try {
    debugLog('codex', 'detectModelFromCodexExec: running codex exec...');
    const output = execFileSync('codex', ['exec', '1+1='], {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Parse "model: xxx" line from output header
    const match = output.match(/^model:\s*(.+)$/m);
    if (match) {
      const model = match[1].trim();
      debugLog('codex', 'detectModelFromCodexExec: detected', model);
      return model;
    }
    debugLog('codex', 'detectModelFromCodexExec: no model line found');
    return null;
  } catch (err) {
    debugLog('codex', 'detectModelFromCodexExec: error', err);
    return null;
  }
}

/**
 * Get current Codex model
 * Priority: config.toml > cached detection > live detection via codex exec
 */
export async function getCodexModel(): Promise<string | null> {
  // 1. Try config.toml first (explicit user setting)
  const configModel = await getModelFromConfig();
  if (configModel) {
    debugLog('codex', 'getCodexModel: from config', configModel);
    return configModel;
  }

  // 2. Check cached model (mtime-based validation)
  const configMtime = await getConfigMtime();
  const cachedModel = await getCachedModel(configMtime);
  if (cachedModel) {
    return cachedModel;
  }

  // 3. Detect via codex exec and cache
  const detectedModel = detectModelFromCodexExec();
  if (detectedModel) {
    await saveModelCache(detectedModel, configMtime);
    return detectedModel;
  }

  return null;
}

/**
 * Fetch Codex usage limits
 */
export async function fetchCodexUsage(ttlSeconds: number = 60): Promise<CodexUsageLimits | null> {
  const auth = await getCodexAuth();
  if (!auth) {
    return null;
  }

  const tokenHash = hashToken(auth.accessToken);

  // Check memory cache
  const cached = codexCacheMap.get(tokenHash);
  if (cached) {
    const ageSeconds = (Date.now() - cached.timestamp) / 1000;
    if (ageSeconds < ttlSeconds) {
      return cached.data;
    }
  }

  // Check pending request
  const pending = pendingRequests.get(tokenHash);
  if (pending) {
    return pending;
  }

  // Create new request
  const requestPromise = fetchFromCodexApi(auth);
  pendingRequests.set(tokenHash, requestPromise);

  try {
    return await requestPromise;
  } finally {
    pendingRequests.delete(tokenHash);
  }
}

/**
 * Internal API fetch
 */
async function fetchFromCodexApi(
  auth: CodexAuthData
): Promise<CodexUsageLimits | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    debugLog('codex', 'fetchFromCodexApi: starting...');

    const response = await fetch('https://chatgpt.com/backend-api/wham/usage', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': `claude-dashboard/${VERSION}`,
        'Authorization': `Bearer ${auth.accessToken}`,
        'ChatGPT-Account-Id': auth.accountId,
      },
      signal: controller.signal,
    });

    debugLog('codex', 'fetchFromCodexApi: response status', response.status);

    if (!response.ok) {
      debugLog('codex', 'fetchFromCodexApi: response not ok');
      return null;
    }

    const data: unknown = await response.json();

    if (!isValidCodexApiResponse(data)) {
      debugLog('codex', 'fetchFromCodexApi: invalid response structure');
      return null;
    }

    const typedData = data;
    debugLog('codex', 'fetchFromCodexApi: got data', typedData.plan_type);
    const model = await getCodexModel();

    const limits: CodexUsageLimits = {
      model: model ?? 'unknown',
      planType: typedData.plan_type,
      primary: typedData.rate_limit.primary_window
        ? {
            usedPercent: typedData.rate_limit.primary_window.used_percent,
            resetAt: typedData.rate_limit.primary_window.reset_at,
          }
        : null,
      secondary: typedData.rate_limit.secondary_window
        ? {
            usedPercent: typedData.rate_limit.secondary_window.used_percent,
            resetAt: typedData.rate_limit.secondary_window.reset_at,
          }
        : null,
    };

    // Update cache
    const tokenHash = hashToken(auth.accessToken);
    codexCacheMap.set(tokenHash, { data: limits, timestamp: Date.now() });
    debugLog('codex', 'fetchFromCodexApi: success', limits);

    return limits;
  } catch (err) {
    debugLog('codex', 'fetchFromCodexApi: error', err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Clear cache (for testing)
 */
export function clearCodexCache(): void {
  codexCacheMap.clear();
  cachedAuth = null;
}
