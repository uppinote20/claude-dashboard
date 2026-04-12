#!/usr/bin/env node

// scripts/utils/api-client.ts
import { readFile as readFile2, writeFile, mkdir, readdir, stat as stat2, unlink } from "fs/promises";
import { execFile as execFile2 } from "child_process";
import os from "os";
import path from "path";

// scripts/types.ts
var NEGATIVE_CACHE_SECONDS = 30;

// scripts/utils/credentials.ts
import { execFile } from "child_process";
import { readFile, stat } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
var KEYCHAIN_CACHE_TTL_MS = 1e4;
var KEYCHAIN_BACKOFF_MS = 6e4;
var credentialsCache = null;
var keychainBackoffAt = null;
async function getCredentials() {
  try {
    if (process.platform === "darwin") {
      return await getCredentialsFromKeychain();
    }
    return await getCredentialsFromFile();
  } catch {
    return null;
  }
}
function execKeychainAsync() {
  return new Promise((resolve, reject) => {
    execFile(
      "security",
      ["find-generic-password", "-s", "Claude Code-credentials", "-w"],
      { encoding: "utf-8", timeout: 3e3 },
      (error, stdout) => {
        if (error)
          reject(error);
        else
          resolve(stdout.trim());
      }
    );
  });
}
async function getCredentialsFromKeychain() {
  if (keychainBackoffAt !== null && Date.now() - keychainBackoffAt < KEYCHAIN_BACKOFF_MS) {
    return await getCredentialsFromFile();
  }
  if (credentialsCache?.timestamp && Date.now() - credentialsCache.timestamp < KEYCHAIN_CACHE_TTL_MS) {
    return credentialsCache.token;
  }
  try {
    const result = await execKeychainAsync();
    const creds = JSON.parse(result);
    const token = creds?.claudeAiOauth?.accessToken ?? null;
    credentialsCache = { token, timestamp: Date.now() };
    keychainBackoffAt = null;
    return token;
  } catch {
    keychainBackoffAt = Date.now();
    return await getCredentialsFromFile();
  }
}
async function getCredentialsFromFile() {
  try {
    const credPath = join(homedir(), ".claude", ".credentials.json");
    const fileStat = await stat(credPath);
    const mtime = fileStat.mtimeMs;
    if (credentialsCache?.mtime === mtime) {
      return credentialsCache.token;
    }
    const content = await readFile(credPath, "utf-8");
    const creds = JSON.parse(content);
    const token = creds?.claudeAiOauth?.accessToken ?? null;
    credentialsCache = { token, mtime };
    return token;
  } catch {
    return null;
  }
}

// scripts/utils/hash.ts
import { createHash } from "crypto";
var HASH_LENGTH = 16;
function hashToken(token) {
  return createHash("sha256").update(token).digest("hex").substring(0, HASH_LENGTH);
}

// scripts/version.ts
var VERSION = "1.24.0";

// scripts/utils/debug.ts
var DEBUG = process.env.DEBUG === "claude-dashboard" || process.env.DEBUG === "1" || process.env.DEBUG === "true";
function debugLog(context, message, error) {
  if (!DEBUG)
    return;
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const prefix = `[claude-dashboard:${context}]`;
  if (error) {
    console.error(`${timestamp} ${prefix} ${message}`, error);
  } else {
    console.log(`${timestamp} ${prefix} ${message}`);
  }
}

// scripts/utils/api-client.ts
var API_URL = "https://api.anthropic.com/api/oauth/usage";
var API_TIMEOUT_MS = 5e3;
var MAX_RETRY_AFTER_MS = 1e4;
var STALE_FALLBACK_SECONDS = 3600;
var CACHE_DIR = path.join(os.homedir(), ".cache", "claude-dashboard");
var CACHE_CLEANUP_AGE_SECONDS = 3600;
var CLEANUP_INTERVAL_MS = 36e5;
var usageCacheMap = /* @__PURE__ */ new Map();
var pendingRequests = /* @__PURE__ */ new Map();
var lastTokenHash = null;
var lastCleanupTime = 0;
var dirEnsured = false;
async function ensureCacheDir() {
  if (dirEnsured)
    return;
  try {
    await mkdir(CACHE_DIR, { recursive: true, mode: 448 });
    dirEnsured = true;
  } catch {
  }
}
function getCacheFilePath(tokenHash) {
  return path.join(CACHE_DIR, `cache-${tokenHash}.json`);
}
function isCacheValid(tokenHash, ttlSeconds) {
  const cache = usageCacheMap.get(tokenHash);
  if (!cache)
    return false;
  const ageSeconds = (Date.now() - cache.timestamp) / 1e3;
  const effectiveTtl = cache.isError ? NEGATIVE_CACHE_SECONDS : ttlSeconds;
  return ageSeconds < effectiveTtl;
}
async function fetchUsageLimits(ttlSeconds = 300) {
  const token = await getCredentials();
  if (!token) {
    if (lastTokenHash) {
      const cached = usageCacheMap.get(lastTokenHash);
      if (cached && !cached.isError)
        return cached.data;
      const fileCache = await loadFileCache(lastTokenHash, STALE_FALLBACK_SECONDS);
      if (fileCache)
        return fileCache;
    }
    return null;
  }
  const tokenHash = hashToken(token);
  lastTokenHash = tokenHash;
  if (isCacheValid(tokenHash, ttlSeconds)) {
    const cached = usageCacheMap.get(tokenHash);
    if (cached) {
      if (cached.isError) {
        debugLog("api", "Negative cache hit, returning stale or null");
        return loadFileCache(tokenHash, STALE_FALLBACK_SECONDS);
      }
      return cached.data;
    }
  }
  const fileCacheRaw = await loadFileCacheRaw(tokenHash, ttlSeconds);
  if (fileCacheRaw) {
    usageCacheMap.set(tokenHash, { data: fileCacheRaw.data, timestamp: fileCacheRaw.timestamp });
    return fileCacheRaw.data;
  }
  const pending = pendingRequests.get(tokenHash);
  if (pending) {
    return pending;
  }
  const requestPromise = fetchFromApi(token, tokenHash);
  pendingRequests.set(tokenHash, requestPromise);
  try {
    const result = await requestPromise;
    if (result)
      return result;
    const staleMemory = usageCacheMap.get(tokenHash);
    debugLog("api", `Setting negative cache for ${NEGATIVE_CACHE_SECONDS}s`);
    usageCacheMap.set(tokenHash, {
      data: null,
      timestamp: Date.now(),
      isError: true
    });
    if (staleMemory && !staleMemory.isError)
      return staleMemory.data;
    const staleFile = await loadFileCache(tokenHash, STALE_FALLBACK_SECONDS);
    if (staleFile)
      return staleFile;
    return null;
  } finally {
    pendingRequests.delete(tokenHash);
  }
}
async function makeRequest(token) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    return await fetch(API_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": `claude-dashboard/${VERSION}`,
        Authorization: `Bearer ${token}`,
        "anthropic-beta": "oauth-2025-04-20"
      },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}
async function makeRequestViaCurl(token) {
  return new Promise((resolve) => {
    const child = execFile2(
      "curl",
      [
        "-s",
        "-w",
        "\n%{http_code}",
        API_URL,
        "-H",
        "Accept: application/json",
        "-H",
        `User-Agent: claude-dashboard/${VERSION}`,
        "-H",
        `Authorization: Bearer ${token}`,
        "-H",
        "anthropic-beta: oauth-2025-04-20"
      ],
      { encoding: "utf-8", timeout: API_TIMEOUT_MS },
      (error, stdout) => {
        if (error) {
          debugLog("api", "curl fallback failed", error);
          resolve(null);
          return;
        }
        try {
          const lines = stdout.trimEnd().split("\n");
          const statusCode = parseInt(lines[lines.length - 1], 10);
          const body = lines.slice(0, -1).join("\n");
          const data = JSON.parse(body);
          resolve({ ok: statusCode >= 200 && statusCode < 300, status: statusCode, data });
        } catch {
          debugLog("api", "curl response parse failed");
          resolve(null);
        }
      }
    );
    child.on("error", () => resolve(null));
  });
}
async function fetchFromApi(token, tokenHash) {
  try {
    let response = await makeRequest(token);
    if (response.status === 429) {
      const retryAfterHeader = response.headers.get("retry-after");
      if (retryAfterHeader === null) {
        debugLog("api", "429 received, no retry-after header, skipping");
      } else {
        const retryAfter = parseInt(retryAfterHeader, 10);
        if (!isNaN(retryAfter) && retryAfter * 1e3 <= MAX_RETRY_AFTER_MS) {
          debugLog("api", `429 received, retrying after ${retryAfter}s`);
          await new Promise((r) => setTimeout(r, retryAfter * 1e3));
          response = await makeRequest(token);
        } else {
          debugLog("api", `429 received, retry-after ${retryAfter}s exceeds limit, skipping`);
        }
      }
    }
    if (response.status === 403) {
      debugLog("api", "403 from fetch, trying curl fallback");
      const curlResult = await makeRequestViaCurl(token);
      if (curlResult?.ok) {
        return parseAndCacheLimits(curlResult.data, tokenHash);
      }
      debugLog("api", `curl fallback ${curlResult ? `returned ${curlResult.status}` : "failed"}`);
      return null;
    }
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return parseAndCacheLimits(data, tokenHash);
  } catch (error) {
    debugLog("api", "Request failed", error);
    return null;
  }
}
function validateLimitWindow(raw) {
  if (!raw || typeof raw !== "object")
    return null;
  const w = raw;
  if (typeof w.utilization !== "number")
    return null;
  return {
    utilization: w.utilization,
    resets_at: typeof w.resets_at === "string" ? w.resets_at : null
  };
}
async function parseAndCacheLimits(data, tokenHash) {
  const d = data && typeof data === "object" ? data : {};
  const limits = {
    five_hour: validateLimitWindow(d.five_hour),
    seven_day: validateLimitWindow(d.seven_day),
    seven_day_sonnet: validateLimitWindow(d.seven_day_sonnet)
  };
  usageCacheMap.set(tokenHash, { data: limits, timestamp: Date.now() });
  await saveFileCache(tokenHash, limits);
  return limits;
}
async function loadFileCacheRaw(tokenHash, ttlSeconds) {
  try {
    const cacheFile = getCacheFilePath(tokenHash);
    const raw = await readFile2(cacheFile, "utf-8");
    const content = JSON.parse(raw);
    const ageSeconds = (Date.now() - content.timestamp) / 1e3;
    if (ageSeconds < ttlSeconds) {
      return { data: content.data, timestamp: content.timestamp };
    }
    return null;
  } catch {
    return null;
  }
}
async function loadFileCache(tokenHash, ttlSeconds) {
  const raw = await loadFileCacheRaw(tokenHash, ttlSeconds);
  return raw?.data ?? null;
}
async function saveFileCache(tokenHash, data) {
  try {
    await ensureCacheDir();
    const cacheFile = getCacheFilePath(tokenHash);
    await writeFile(
      cacheFile,
      JSON.stringify({
        data,
        timestamp: Date.now()
      }),
      { mode: 384 }
    );
    cleanupExpiredCache().catch(() => {
    });
  } catch {
  }
}
async function cleanupExpiredCache() {
  const now = Date.now();
  if (now - lastCleanupTime < CLEANUP_INTERVAL_MS) {
    return;
  }
  lastCleanupTime = now;
  try {
    const files = await readdir(CACHE_DIR);
    for (const file of files) {
      if (!file.startsWith("cache-") || !file.endsWith(".json")) {
        continue;
      }
      const filePath = path.join(CACHE_DIR, file);
      try {
        const fileStat = await stat2(filePath);
        const ageSeconds = (now - fileStat.mtimeMs) / 1e3;
        if (ageSeconds > CACHE_CLEANUP_AGE_SECONDS) {
          await unlink(filePath);
        }
      } catch {
      }
    }
  } catch {
  }
}

// scripts/utils/codex-client.ts
import { readFile as readFile3, stat as stat3, writeFile as writeFile2, mkdir as mkdir2 } from "fs/promises";
import { execFile as execFile3 } from "child_process";
import os2 from "os";
import path2 from "path";
var API_TIMEOUT_MS2 = 5e3;
var CODEX_AUTH_PATH = path2.join(os2.homedir(), ".codex", "auth.json");
var CODEX_CONFIG_PATH = path2.join(os2.homedir(), ".codex", "config.toml");
var CACHE_DIR2 = path2.join(os2.homedir(), ".cache", "claude-dashboard");
var MODEL_CACHE_PATH = path2.join(CACHE_DIR2, "codex-model-cache.json");
var codexCacheMap = /* @__PURE__ */ new Map();
var pendingRequests2 = /* @__PURE__ */ new Map();
var cachedAuth = null;
function isValidCodexApiResponse(data) {
  return data !== null && typeof data === "object" && "rate_limit" in data && "plan_type" in data && typeof data.rate_limit === "object" && data.rate_limit !== null;
}
async function isCodexInstalled() {
  try {
    await stat3(CODEX_AUTH_PATH);
    return true;
  } catch {
    return false;
  }
}
async function getCodexAuth() {
  try {
    const fileStat = await stat3(CODEX_AUTH_PATH);
    if (cachedAuth && cachedAuth.mtime === fileStat.mtimeMs) {
      return cachedAuth.data;
    }
    const raw = await readFile3(CODEX_AUTH_PATH, "utf-8");
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
async function getModelFromConfig() {
  try {
    const raw = await readFile3(CODEX_CONFIG_PATH, "utf-8");
    const match = raw.match(/^model\s*=\s*["']([^"']+)["']\s*(?:#.*)?$/m);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
async function getConfigMtime() {
  try {
    const fileStat = await stat3(CODEX_CONFIG_PATH);
    return fileStat.mtimeMs;
  } catch {
    return 0;
  }
}
async function getCachedModel(currentMtime) {
  try {
    const raw = await readFile3(MODEL_CACHE_PATH, "utf-8");
    const cache = JSON.parse(raw);
    if (cache.configMtime === currentMtime && cache.model) {
      debugLog("codex", "getCachedModel: cache hit", cache.model);
      return cache.model;
    }
    debugLog("codex", "getCachedModel: cache stale");
    return null;
  } catch {
    return null;
  }
}
async function saveModelCache(model, configMtime) {
  try {
    await mkdir2(CACHE_DIR2, { recursive: true });
    const cache = { model, configMtime };
    await writeFile2(MODEL_CACHE_PATH, JSON.stringify(cache), "utf-8");
    debugLog("codex", "saveModelCache: saved", model);
  } catch (err) {
    debugLog("codex", "saveModelCache: error", err);
  }
}
var modelDetectionFailedAt = null;
var MODEL_DETECTION_BACKOFF_MS = 3e5;
async function detectModelFromCodexExec() {
  if (modelDetectionFailedAt !== null && Date.now() - modelDetectionFailedAt < MODEL_DETECTION_BACKOFF_MS) {
    debugLog("codex", "detectModelFromCodexExec: skipping (backoff)");
    return null;
  }
  try {
    debugLog("codex", "detectModelFromCodexExec: running codex exec...");
    const output = await new Promise((resolve, reject) => {
      execFile3("codex", ["exec", "1+1="], {
        encoding: "utf-8",
        timeout: 1e4
      }, (error, stdout) => {
        if (error)
          reject(error);
        else
          resolve(stdout);
      });
    });
    const match = output.match(/^model:\s*(.+)$/m);
    if (match) {
      const model = match[1].trim();
      debugLog("codex", "detectModelFromCodexExec: detected", model);
      modelDetectionFailedAt = null;
      return model;
    }
    debugLog("codex", "detectModelFromCodexExec: no model line found");
    modelDetectionFailedAt = Date.now();
    return null;
  } catch (err) {
    debugLog("codex", "detectModelFromCodexExec: error", err);
    modelDetectionFailedAt = Date.now();
    return null;
  }
}
async function getCodexModel() {
  const configModel = await getModelFromConfig();
  if (configModel) {
    debugLog("codex", "getCodexModel: from config", configModel);
    return configModel;
  }
  const configMtime = await getConfigMtime();
  const cachedModel = await getCachedModel(configMtime);
  if (cachedModel) {
    return cachedModel;
  }
  const detectedModel = await detectModelFromCodexExec();
  if (detectedModel) {
    await saveModelCache(detectedModel, configMtime);
    return detectedModel;
  }
  return null;
}
async function fetchCodexUsage(ttlSeconds = 60) {
  const auth = await getCodexAuth();
  if (!auth) {
    return null;
  }
  const tokenHash = hashToken(auth.accessToken);
  const cached = codexCacheMap.get(tokenHash);
  if (cached) {
    const ageSeconds = (Date.now() - cached.timestamp) / 1e3;
    const effectiveTtl = cached.isError ? NEGATIVE_CACHE_SECONDS : ttlSeconds;
    if (ageSeconds < effectiveTtl) {
      if (cached.isError) {
        debugLog("codex", "Negative cache hit, skipping API call");
        return null;
      }
      return cached.data;
    }
  }
  const pending = pendingRequests2.get(tokenHash);
  if (pending) {
    return pending;
  }
  const requestPromise = fetchFromCodexApi(auth, tokenHash);
  pendingRequests2.set(tokenHash, requestPromise);
  try {
    const result = await requestPromise;
    if (result)
      return result;
    debugLog("codex", `Setting negative cache for ${NEGATIVE_CACHE_SECONDS}s`);
    codexCacheMap.set(tokenHash, {
      data: null,
      timestamp: Date.now(),
      isError: true
    });
    if (cached && !cached.isError) {
      debugLog("codex", "Returning stale cache data");
      return cached.data;
    }
    return null;
  } finally {
    pendingRequests2.delete(tokenHash);
  }
}
async function fetchFromCodexApi(auth, tokenHash) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS2);
  try {
    debugLog("codex", "fetchFromCodexApi: starting...");
    const response = await fetch("https://chatgpt.com/backend-api/wham/usage", {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": `claude-dashboard/${VERSION}`,
        "Authorization": `Bearer ${auth.accessToken}`,
        "ChatGPT-Account-Id": auth.accountId
      },
      signal: controller.signal
    });
    debugLog("codex", "fetchFromCodexApi: response status", response.status);
    if (!response.ok) {
      debugLog("codex", "fetchFromCodexApi: response not ok");
      return null;
    }
    const data = await response.json();
    if (!isValidCodexApiResponse(data)) {
      debugLog("codex", "fetchFromCodexApi: invalid response structure");
      return null;
    }
    debugLog("codex", "fetchFromCodexApi: got data", data.plan_type);
    const model = await getCodexModel();
    const limits = {
      model: model ?? "unknown",
      planType: data.plan_type,
      primary: data.rate_limit.primary_window ? {
        usedPercent: data.rate_limit.primary_window.used_percent,
        resetAt: data.rate_limit.primary_window.reset_at
      } : null,
      secondary: data.rate_limit.secondary_window ? {
        usedPercent: data.rate_limit.secondary_window.used_percent,
        resetAt: data.rate_limit.secondary_window.reset_at
      } : null
    };
    codexCacheMap.set(tokenHash, { data: limits, timestamp: Date.now() });
    debugLog("codex", "fetchFromCodexApi: success", limits);
    return limits;
  } catch (err) {
    debugLog("codex", "fetchFromCodexApi: error", err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// scripts/utils/gemini-client.ts
import { readFile as readFile4, writeFile as writeFile3, stat as stat4 } from "fs/promises";
import { execFile as execFile4 } from "child_process";
import os3 from "os";
import path3 from "path";
var API_TIMEOUT_MS3 = 5e3;
var GEMINI_DIR = ".gemini";
var OAUTH_CREDS_FILE = "oauth_creds.json";
var SETTINGS_FILE = "settings.json";
var KEYCHAIN_SERVICE_NAME = "gemini-cli-oauth";
var MAIN_ACCOUNT_KEY = "main-account";
var CODE_ASSIST_ENDPOINT = "https://cloudcode-pa.googleapis.com";
var CODE_ASSIST_API_VERSION = "v1internal";
var GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
var OAUTH_CLIENT_ID = "681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com";
var OAUTH_CLIENT_SECRET = "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";
var TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1e3;
var geminiCacheMap = /* @__PURE__ */ new Map();
var pendingRequests3 = /* @__PURE__ */ new Map();
var pendingRefreshRequests = /* @__PURE__ */ new Map();
var cachedCredentials = null;
var keychainCache = null;
var KEYCHAIN_CACHE_TTL_MS2 = 1e4;
var cachedSettings = null;
function getGeminiDir() {
  return path3.join(os3.homedir(), GEMINI_DIR);
}
async function isGeminiInstalled() {
  try {
    const keychainToken = await getTokenFromKeychain();
    if (keychainToken) {
      return true;
    }
    const oauthPath = path3.join(getGeminiDir(), OAUTH_CREDS_FILE);
    await stat4(oauthPath);
    return true;
  } catch {
    return false;
  }
}
async function getTokenFromKeychain() {
  if (os3.platform() !== "darwin") {
    return null;
  }
  if (keychainCache && Date.now() - keychainCache.timestamp < KEYCHAIN_CACHE_TTL_MS2) {
    return keychainCache.data;
  }
  try {
    const result = await new Promise((resolve, reject) => {
      execFile4(
        "security",
        ["find-generic-password", "-s", KEYCHAIN_SERVICE_NAME, "-a", MAIN_ACCOUNT_KEY, "-w"],
        { encoding: "utf-8", timeout: 3e3 },
        (error, stdout) => {
          if (error)
            reject(error);
          else
            resolve(stdout.trim());
        }
      );
    });
    if (!result) {
      keychainCache = { data: null, timestamp: Date.now() };
      return null;
    }
    const stored = JSON.parse(result);
    if (!stored.token?.accessToken) {
      keychainCache = { data: null, timestamp: Date.now() };
      return null;
    }
    const data = {
      accessToken: stored.token.accessToken,
      refreshToken: stored.token.refreshToken,
      expiryDate: stored.token.expiresAt
    };
    keychainCache = { data, timestamp: Date.now() };
    return data;
  } catch {
    keychainCache = { data: null, timestamp: Date.now() };
    return null;
  }
}
async function getCredentialsFromFile2() {
  try {
    const oauthPath = path3.join(getGeminiDir(), OAUTH_CREDS_FILE);
    const fileStat = await stat4(oauthPath);
    if (cachedCredentials && cachedCredentials.mtime === fileStat.mtimeMs) {
      return cachedCredentials.data;
    }
    const raw = await readFile4(oauthPath, "utf-8");
    const json = JSON.parse(raw);
    const accessToken = json?.access_token;
    if (!accessToken) {
      return null;
    }
    const data = {
      accessToken,
      refreshToken: json?.refresh_token,
      expiryDate: json?.expiry_date
    };
    cachedCredentials = { data, mtime: fileStat.mtimeMs };
    return data;
  } catch {
    return null;
  }
}
async function getGeminiCredentials() {
  const keychainCreds = await getTokenFromKeychain();
  if (keychainCreds) {
    return keychainCreds;
  }
  return getCredentialsFromFile2();
}
function tokenNeedsRefresh(credentials) {
  if (!credentials.expiryDate) {
    return false;
  }
  return credentials.expiryDate < Date.now() + TOKEN_REFRESH_BUFFER_MS;
}
async function refreshTokenInternal(credentials) {
  try {
    debugLog("gemini", "refreshTokenInternal: attempting refresh...");
    const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: credentials.refreshToken,
        client_id: OAUTH_CLIENT_ID,
        client_secret: OAUTH_CLIENT_SECRET
      }),
      signal: AbortSignal.timeout(API_TIMEOUT_MS3)
    });
    if (!response.ok) {
      debugLog("gemini", "refreshTokenInternal: failed", response.status);
      return null;
    }
    const data = await response.json();
    if (!data.access_token) {
      debugLog("gemini", "refreshTokenInternal: no access_token in response");
      return null;
    }
    const newCredentials = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || credentials.refreshToken,
      expiryDate: Date.now() + data.expires_in * 1e3
    };
    await saveCredentialsToFile(newCredentials, data);
    cachedCredentials = null;
    debugLog("gemini", "refreshTokenInternal: success, new expiry", new Date(newCredentials.expiryDate).toISOString());
    return newCredentials;
  } catch (err) {
    debugLog("gemini", "refreshTokenInternal: error", err);
    return null;
  }
}
async function refreshToken(credentials) {
  if (!credentials.refreshToken) {
    debugLog("gemini", "refreshToken: no refresh token available");
    return null;
  }
  const tokenHash = hashToken(credentials.accessToken);
  const pending = pendingRefreshRequests.get(tokenHash);
  if (pending) {
    debugLog("gemini", "refreshToken: using pending refresh request");
    return pending;
  }
  const refreshPromise = refreshTokenInternal(credentials).finally(() => {
    pendingRefreshRequests.delete(tokenHash);
  });
  pendingRefreshRequests.set(tokenHash, refreshPromise);
  return refreshPromise;
}
async function saveCredentialsToFile(credentials, rawResponse) {
  try {
    const oauthPath = path3.join(getGeminiDir(), OAUTH_CREDS_FILE);
    let existingData = {};
    try {
      const raw = await readFile4(oauthPath, "utf-8");
      existingData = JSON.parse(raw);
    } catch {
    }
    const newData = {
      ...existingData,
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
      expiry_date: credentials.expiryDate,
      token_type: rawResponse.token_type || "Bearer",
      scope: rawResponse.scope || existingData.scope
    };
    await writeFile3(oauthPath, JSON.stringify(newData, null, 2), { mode: 384 });
    debugLog("gemini", "saveCredentialsToFile: saved");
  } catch (err) {
    debugLog("gemini", "saveCredentialsToFile: error", err);
  }
}
async function getValidCredentials() {
  let credentials = await getGeminiCredentials();
  if (!credentials) {
    return null;
  }
  if (tokenNeedsRefresh(credentials)) {
    debugLog("gemini", "getValidCredentials: token expired or expiring, attempting refresh");
    const refreshedCreds = await refreshToken(credentials);
    if (refreshedCreds) {
      return refreshedCreds;
    }
    debugLog("gemini", "getValidCredentials: refresh failed");
    return null;
  }
  return credentials;
}
var projectIdCacheMap = /* @__PURE__ */ new Map();
var PROJECT_ID_CACHE_TTL_MS = 5 * 60 * 1e3;
async function getGeminiSettings() {
  try {
    const settingsPath = path3.join(getGeminiDir(), SETTINGS_FILE);
    const fileStat = await stat4(settingsPath);
    if (cachedSettings && cachedSettings.mtime === fileStat.mtimeMs) {
      return cachedSettings.data;
    }
    const raw = await readFile4(settingsPath, "utf-8");
    const json = JSON.parse(raw);
    const data = {
      cloudaicompanionProject: json?.cloudaicompanionProject,
      selectedModel: json?.selectedModel || json?.model?.name,
      auth: json?.auth
    };
    cachedSettings = { data, mtime: fileStat.mtimeMs };
    return data;
  } catch {
    return null;
  }
}
async function getGeminiModel() {
  const settings = await getGeminiSettings();
  return settings?.selectedModel ?? null;
}
async function getProjectId(credentials) {
  const envProjectId = process.env["GOOGLE_CLOUD_PROJECT"] || process.env["GOOGLE_CLOUD_PROJECT_ID"];
  if (envProjectId) {
    return envProjectId;
  }
  const settings = await getGeminiSettings();
  if (settings?.cloudaicompanionProject) {
    return settings.cloudaicompanionProject;
  }
  const tokenHash = hashToken(credentials.accessToken);
  const cached = projectIdCacheMap.get(tokenHash);
  if (cached && Date.now() - cached.timestamp < PROJECT_ID_CACHE_TTL_MS) {
    return cached.data;
  }
  try {
    const url = `${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}:loadCodeAssist`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": `claude-dashboard/${VERSION}`,
        "Authorization": `Bearer ${credentials.accessToken}`
      },
      body: JSON.stringify({
        metadata: {
          ideType: "GEMINI_CLI",
          platform: "PLATFORM_UNSPECIFIED",
          pluginType: "GEMINI"
        }
      }),
      signal: AbortSignal.timeout(API_TIMEOUT_MS3)
    });
    if (!response.ok) {
      debugLog("gemini", "loadCodeAssist: response not ok", response.status);
      return null;
    }
    const data = await response.json();
    const projectId = data?.cloudaicompanionProject;
    if (projectId) {
      projectIdCacheMap.set(tokenHash, { data: projectId, timestamp: Date.now() });
      return projectId;
    }
  } catch (err) {
    debugLog("gemini", "loadCodeAssist error:", err);
  }
  return null;
}
async function fetchGeminiUsage(ttlSeconds = 60) {
  const credentials = await getValidCredentials();
  if (!credentials) {
    debugLog("gemini", "fetchGeminiUsage: no valid credentials");
    return null;
  }
  const projectId = await getProjectId(credentials);
  if (!projectId) {
    debugLog("gemini", "fetchGeminiUsage: no project ID found");
    return null;
  }
  const tokenHash = hashToken(credentials.accessToken);
  const cached = geminiCacheMap.get(tokenHash);
  if (cached) {
    const ageSeconds = (Date.now() - cached.timestamp) / 1e3;
    const effectiveTtl = cached.isError ? NEGATIVE_CACHE_SECONDS : ttlSeconds;
    if (ageSeconds < effectiveTtl) {
      if (cached.isError) {
        debugLog("gemini", "Negative cache hit, skipping API call");
        return null;
      }
      debugLog("gemini", "fetchGeminiUsage: returning cached data");
      return cached.data;
    }
  }
  const pending = pendingRequests3.get(tokenHash);
  if (pending) {
    return pending;
  }
  const requestPromise = fetchFromGeminiApi(credentials, projectId);
  pendingRequests3.set(tokenHash, requestPromise);
  try {
    const result = await requestPromise;
    if (result)
      return result;
    debugLog("gemini", `Setting negative cache for ${NEGATIVE_CACHE_SECONDS}s`);
    geminiCacheMap.set(tokenHash, {
      data: null,
      timestamp: Date.now(),
      isError: true
    });
    if (cached && !cached.isError) {
      debugLog("gemini", "Returning stale cache data");
      return cached.data;
    }
    return null;
  } finally {
    pendingRequests3.delete(tokenHash);
  }
}
async function fetchFromGeminiApi(credentials, projectId) {
  try {
    debugLog("gemini", "fetchFromGeminiApi: starting...");
    const url = `${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}:retrieveUserQuota`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": `claude-dashboard/${VERSION}`,
        "Authorization": `Bearer ${credentials.accessToken}`
      },
      body: JSON.stringify({
        project: projectId
      }),
      signal: AbortSignal.timeout(API_TIMEOUT_MS3)
    });
    debugLog("gemini", "fetchFromGeminiApi: response status", response.status);
    if (!response.ok) {
      debugLog("gemini", "fetchFromGeminiApi: response not ok");
      return null;
    }
    let data;
    try {
      data = await response.json();
    } catch {
      debugLog("gemini", "fetchFromGeminiApi: invalid JSON response");
      return null;
    }
    if (!data || typeof data !== "object") {
      debugLog("gemini", "fetchFromGeminiApi: invalid response - not an object");
      return null;
    }
    const typedData = data;
    debugLog("gemini", `fetchFromGeminiApi: got data ${typedData.buckets?.length || 0} buckets`);
    const model = await getGeminiModel();
    let primaryBucket = null;
    let currentModelBucket = null;
    if (typedData.buckets && Array.isArray(typedData.buckets)) {
      for (const bucket of typedData.buckets) {
        if (model && bucket.modelId && bucket.modelId.includes(model)) {
          currentModelBucket = bucket;
        }
        if (!primaryBucket) {
          primaryBucket = bucket;
        }
      }
    }
    const activeBucket = currentModelBucket || primaryBucket;
    const displayModel = model ?? activeBucket?.modelId ?? "unknown";
    const limits = {
      model: displayModel,
      // remainingFraction is remaining, so usage = 1 - remaining
      usedPercent: activeBucket?.remainingFraction !== void 0 ? Math.round((1 - activeBucket.remainingFraction) * 100) : null,
      resetAt: activeBucket?.resetTime ?? null,
      buckets: typedData.buckets?.map((b) => ({
        modelId: b.modelId,
        usedPercent: b.remainingFraction !== void 0 ? Math.round((1 - b.remainingFraction) * 100) : null,
        resetAt: b.resetTime ?? null
      })) ?? []
    };
    const tokenHash = hashToken(credentials.accessToken);
    geminiCacheMap.set(tokenHash, { data: limits, timestamp: Date.now() });
    debugLog("gemini", "fetchFromGeminiApi: success", limits);
    return limits;
  } catch (err) {
    debugLog("gemini", "fetchFromGeminiApi: error", err);
    return null;
  }
}

// scripts/utils/provider.ts
function detectProvider() {
  const baseUrl = process.env.ANTHROPIC_BASE_URL || "";
  if (baseUrl.includes("api.z.ai")) {
    return "zai";
  }
  if (baseUrl.includes("bigmodel.cn")) {
    return "zhipu";
  }
  return "anthropic";
}
function isZaiProvider() {
  const provider = detectProvider();
  return provider === "zai" || provider === "zhipu";
}
function getZaiApiBaseUrl() {
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

// scripts/utils/formatters.ts
function formatTimeRemaining(resetAt, t) {
  const reset = typeof resetAt === "string" ? new Date(resetAt) : resetAt;
  const now = /* @__PURE__ */ new Date();
  const diffMs = reset.getTime() - now.getTime();
  if (diffMs <= 0)
    return `0${t.time.minutes}`;
  const totalMinutes = Math.floor(diffMs / (1e3 * 60));
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;
  if (days > 0) {
    return `${days}${t.time.days}${hours}${t.time.hours}`;
  }
  if (hours > 0) {
    return `${hours}${t.time.hours}${minutes}${t.time.minutes}`;
  }
  return `${minutes}${t.time.minutes}`;
}
function clampPercent(value) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

// scripts/utils/zai-api-client.ts
var API_TIMEOUT_MS4 = 5e3;
function calculateUsagePercent(currentValue, remaining) {
  const total = currentValue + remaining;
  if (total <= 0) {
    return null;
  }
  return clampPercent(currentValue / total * 100);
}
function parseUsagePercent(limit) {
  if (limit.percentage !== void 0) {
    return clampPercent(limit.percentage);
  }
  if (limit.currentValue !== void 0 && limit.remaining !== void 0) {
    return calculateUsagePercent(limit.currentValue, limit.remaining);
  }
  if (limit.currentValue !== void 0 && limit.usage !== void 0 && limit.usage > 0) {
    return clampPercent(limit.currentValue / limit.usage * 100);
  }
  return null;
}
var zaiCacheMap = /* @__PURE__ */ new Map();
var pendingRequests4 = /* @__PURE__ */ new Map();
function isZaiInstalled() {
  return isZaiProvider() && !!getZaiApiBaseUrl() && !!getZaiAuthToken();
}
function getZaiAuthToken() {
  return process.env.ANTHROPIC_AUTH_TOKEN || null;
}
async function fetchZaiUsage(ttlSeconds = 60) {
  if (!isZaiProvider()) {
    debugLog("zai", "fetchZaiUsage: not a z.ai provider");
    return null;
  }
  const baseUrl = getZaiApiBaseUrl();
  const authToken = getZaiAuthToken();
  if (!baseUrl || !authToken) {
    debugLog("zai", "fetchZaiUsage: missing base URL or auth token");
    return null;
  }
  const tokenHash = hashToken(authToken);
  const cacheKey = `${baseUrl}:${tokenHash}`;
  const cached = zaiCacheMap.get(cacheKey);
  if (cached) {
    const ageSeconds = (Date.now() - cached.timestamp) / 1e3;
    const effectiveTtl = cached.isError ? NEGATIVE_CACHE_SECONDS : ttlSeconds;
    if (ageSeconds < effectiveTtl) {
      if (cached.isError) {
        debugLog("zai", "Negative cache hit, skipping API call");
        return null;
      }
      debugLog("zai", "fetchZaiUsage: returning cached data");
      return cached.data;
    }
  }
  const pending = pendingRequests4.get(cacheKey);
  if (pending) {
    return pending;
  }
  const requestPromise = fetchFromZaiApi(baseUrl, authToken);
  pendingRequests4.set(cacheKey, requestPromise);
  try {
    const result = await requestPromise;
    if (result) {
      zaiCacheMap.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    }
    debugLog("zai", `Setting negative cache for ${NEGATIVE_CACHE_SECONDS}s`);
    zaiCacheMap.set(cacheKey, {
      data: null,
      timestamp: Date.now(),
      isError: true
    });
    if (cached && !cached.isError) {
      debugLog("zai", "Returning stale cache data");
      return cached.data;
    }
    return null;
  } finally {
    pendingRequests4.delete(cacheKey);
  }
}
async function fetchFromZaiApi(baseUrl, authToken) {
  try {
    debugLog("zai", "fetchFromZaiApi: starting...");
    const url = `${baseUrl}/api/monitor/usage/quota/limit`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      signal: AbortSignal.timeout(API_TIMEOUT_MS4)
    });
    debugLog("zai", "fetchFromZaiApi: response status", response.status);
    if (!response.ok) {
      debugLog("zai", "fetchFromZaiApi: response not ok");
      return null;
    }
    let data;
    try {
      data = await response.json();
    } catch {
      debugLog("zai", "fetchFromZaiApi: invalid JSON response");
      return null;
    }
    if (!data || typeof data !== "object") {
      debugLog("zai", "fetchFromZaiApi: invalid response - not an object");
      return null;
    }
    const typedData = data;
    const limits = typedData.data?.limits;
    if (!limits || !Array.isArray(limits)) {
      debugLog("zai", "fetchFromZaiApi: no limits array");
      return null;
    }
    debugLog("zai", `fetchFromZaiApi: got ${limits.length} limits`);
    let tokensPercent = null;
    let tokensResetAt = null;
    let mcpPercent = null;
    let mcpResetAt = null;
    for (const limit of limits) {
      const resetTime = limit.nextResetTime;
      if (limit.type === "TOKENS_LIMIT") {
        tokensPercent = parseUsagePercent(limit);
        if (resetTime !== void 0) {
          tokensResetAt = resetTime;
        }
      } else if (limit.type === "TIME_LIMIT") {
        mcpPercent = parseUsagePercent(limit);
        if (resetTime !== void 0) {
          mcpResetAt = resetTime;
        }
      }
    }
    const result = {
      model: "GLM",
      tokensPercent,
      tokensResetAt,
      mcpPercent,
      mcpResetAt
    };
    debugLog("zai", "fetchFromZaiApi: success", result);
    return result;
  } catch (err) {
    debugLog("zai", "fetchFromZaiApi: error", err);
    return null;
  }
}

// scripts/utils/colors.ts
var THEMES = {
  default: {
    dim: "\x1B[2m",
    bold: "\x1B[1m",
    model: "\x1B[38;5;117m",
    // pastelCyan
    folder: "\x1B[38;5;222m",
    // pastelYellow
    branch: "\x1B[38;5;218m",
    // pastelPink
    safe: "\x1B[38;5;151m",
    // pastelGreen
    warning: "\x1B[38;5;222m",
    // pastelYellow
    danger: "\x1B[38;5;210m",
    // pastelRed
    secondary: "\x1B[38;5;249m",
    // pastelGray
    accent: "\x1B[38;5;222m",
    // pastelYellow
    info: "\x1B[38;5;117m",
    // pastelCyan
    barFilled: "\x1B[32m",
    // green
    barEmpty: "\x1B[90m",
    // gray
    red: "\x1B[31m",
    green: "\x1B[32m",
    yellow: "\x1B[33m",
    blue: "\x1B[34m",
    magenta: "\x1B[35m",
    cyan: "\x1B[36m",
    white: "\x1B[37m",
    gray: "\x1B[90m"
  },
  minimal: {
    dim: "\x1B[2m",
    bold: "\x1B[1m",
    model: "\x1B[37m",
    // white
    folder: "\x1B[37m",
    // white
    branch: "\x1B[37m",
    // white
    safe: "\x1B[90m",
    // gray
    warning: "\x1B[37m",
    // white
    danger: "\x1B[1;37m",
    // bold white
    secondary: "\x1B[90m",
    // gray
    accent: "\x1B[37m",
    // white
    info: "\x1B[37m",
    // white
    barFilled: "\x1B[37m",
    // white
    barEmpty: "\x1B[90m",
    // gray
    red: "\x1B[37m",
    green: "\x1B[37m",
    yellow: "\x1B[37m",
    blue: "\x1B[37m",
    magenta: "\x1B[37m",
    cyan: "\x1B[37m",
    white: "\x1B[37m",
    gray: "\x1B[90m"
  },
  catppuccin: {
    dim: "\x1B[2m",
    bold: "\x1B[1m",
    model: "\x1B[38;2;137;180;250m",
    // #89b4fa blue
    folder: "\x1B[38;2;249;226;175m",
    // #f9e2af yellow
    branch: "\x1B[38;2;245;194;231m",
    // #f5c2e7 pink
    safe: "\x1B[38;2;166;227;161m",
    // #a6e3a1 green
    warning: "\x1B[38;2;250;179;135m",
    // #fab387 peach
    danger: "\x1B[38;2;243;139;168m",
    // #f38ba8 red
    secondary: "\x1B[38;2;127;132;156m",
    // #7f849c overlay1
    accent: "\x1B[38;2;250;179;135m",
    // #fab387 peach
    info: "\x1B[38;2;116;199;236m",
    // #74c7ec sapphire
    barFilled: "\x1B[38;2;166;227;161m",
    // #a6e3a1 green
    barEmpty: "\x1B[38;2;88;91;112m",
    // #585b70 surface2
    red: "\x1B[38;2;243;139;168m",
    green: "\x1B[38;2;166;227;161m",
    yellow: "\x1B[38;2;249;226;175m",
    blue: "\x1B[38;2;137;180;250m",
    magenta: "\x1B[38;2;203;166;247m",
    cyan: "\x1B[38;2;148;226;213m",
    white: "\x1B[38;2;205;214;244m",
    gray: "\x1B[38;2;127;132;156m"
  },
  gruvbox: {
    dim: "\x1B[2m",
    bold: "\x1B[1m",
    model: "\x1B[38;2;215;153;33m",
    // #d79921 yellow
    folder: "\x1B[38;2;250;189;47m",
    // #fabd2f bright yellow
    branch: "\x1B[38;2;211;134;155m",
    // #d3869b purple
    safe: "\x1B[38;2;184;187;38m",
    // #b8bb26 green
    warning: "\x1B[38;2;250;189;47m",
    // #fabd2f yellow
    danger: "\x1B[38;2;204;36;29m",
    // #cc241d red
    secondary: "\x1B[38;2;168;153;132m",
    // #a89984 gray
    accent: "\x1B[38;2;250;189;47m",
    // #fabd2f yellow
    info: "\x1B[38;2;131;165;152m",
    // #83a598 blue
    barFilled: "\x1B[38;2;184;187;38m",
    // #b8bb26 green
    barEmpty: "\x1B[38;2;80;73;69m",
    // #504945 dark gray
    red: "\x1B[38;2;204;36;29m",
    green: "\x1B[38;2;184;187;38m",
    yellow: "\x1B[38;2;250;189;47m",
    blue: "\x1B[38;2;131;165;152m",
    magenta: "\x1B[38;2;211;134;155m",
    cyan: "\x1B[38;2;142;192;124m",
    white: "\x1B[38;2;235;219;178m",
    gray: "\x1B[38;2;168;153;132m"
  },
  dracula: {
    dim: "\x1B[2m",
    bold: "\x1B[1m",
    model: "\x1B[38;2;189;147;249m",
    // #bd93f9 purple
    folder: "\x1B[38;2;255;184;108m",
    // #ffb86c orange
    branch: "\x1B[38;2;255;121;198m",
    // #ff79c6 pink
    safe: "\x1B[38;2;80;250;123m",
    // #50fa7b green
    warning: "\x1B[38;2;241;250;140m",
    // #f1fa8c yellow
    danger: "\x1B[38;2;255;85;85m",
    // #ff5555 red
    secondary: "\x1B[38;2;98;114;164m",
    // #6272a4 comment
    accent: "\x1B[38;2;255;184;108m",
    // #ffb86c orange
    info: "\x1B[38;2;139;233;253m",
    // #8be9fd cyan
    barFilled: "\x1B[38;2;80;250;123m",
    // #50fa7b green
    barEmpty: "\x1B[38;2;68;71;90m",
    // #44475a current line
    red: "\x1B[38;2;255;85;85m",
    green: "\x1B[38;2;80;250;123m",
    yellow: "\x1B[38;2;241;250;140m",
    blue: "\x1B[38;2;189;147;249m",
    magenta: "\x1B[38;2;255;121;198m",
    cyan: "\x1B[38;2;139;233;253m",
    white: "\x1B[38;2;248;248;242m",
    gray: "\x1B[38;2;98;114;164m"
  },
  nord: {
    dim: "\x1B[2m",
    bold: "\x1B[1m",
    model: "\x1B[38;2;136;192;208m",
    // #88c0d0 frost cyan
    folder: "\x1B[38;2;235;203;139m",
    // #ebcb8b yellow
    branch: "\x1B[38;2;180;142;173m",
    // #b48ead purple
    safe: "\x1B[38;2;163;190;140m",
    // #a3be8c green
    warning: "\x1B[38;2;235;203;139m",
    // #ebcb8b yellow
    danger: "\x1B[38;2;191;97;106m",
    // #bf616a red
    secondary: "\x1B[38;2;76;86;106m",
    // #4c566a polar night
    accent: "\x1B[38;2;208;135;112m",
    // #d08770 orange
    info: "\x1B[38;2;129;161;193m",
    // #81a1c1 frost blue
    barFilled: "\x1B[38;2;163;190;140m",
    // #a3be8c green
    barEmpty: "\x1B[38;2;67;76;94m",
    // #434c5e polar night
    red: "\x1B[38;2;191;97;106m",
    green: "\x1B[38;2;163;190;140m",
    yellow: "\x1B[38;2;235;203;139m",
    blue: "\x1B[38;2;129;161;193m",
    magenta: "\x1B[38;2;180;142;173m",
    cyan: "\x1B[38;2;136;192;208m",
    white: "\x1B[38;2;236;239;244m",
    gray: "\x1B[38;2;76;86;106m"
  },
  tokyoNight: {
    dim: "\x1B[2m",
    bold: "\x1B[1m",
    model: "\x1B[38;2;122;162;247m",
    // #7aa2f7 blue
    folder: "\x1B[38;2;224;175;104m",
    // #e0af68 yellow
    branch: "\x1B[38;2;187;154;247m",
    // #bb9af7 purple
    safe: "\x1B[38;2;158;206;106m",
    // #9ece6a green
    warning: "\x1B[38;2;224;175;104m",
    // #e0af68 yellow
    danger: "\x1B[38;2;247;118;142m",
    // #f7768e red
    secondary: "\x1B[38;2;86;95;137m",
    // #565f89 comment
    accent: "\x1B[38;2;255;158;100m",
    // #ff9e64 orange
    info: "\x1B[38;2;125;207;255m",
    // #7dcfff cyan
    barFilled: "\x1B[38;2;158;206;106m",
    // #9ece6a green
    barEmpty: "\x1B[38;2;59;66;97m",
    // #3b4261 dark
    red: "\x1B[38;2;247;118;142m",
    green: "\x1B[38;2;158;206;106m",
    yellow: "\x1B[38;2;224;175;104m",
    blue: "\x1B[38;2;122;162;247m",
    magenta: "\x1B[38;2;187;154;247m",
    cyan: "\x1B[38;2;125;207;255m",
    white: "\x1B[38;2;169;177;214m",
    gray: "\x1B[38;2;86;95;137m"
  },
  solarized: {
    dim: "\x1B[2m",
    bold: "\x1B[1m",
    model: "\x1B[38;2;38;139;210m",
    // #268bd2 blue
    folder: "\x1B[38;2;181;137;0m",
    // #b58900 yellow
    branch: "\x1B[38;2;211;54;130m",
    // #d33682 magenta
    safe: "\x1B[38;2;133;153;0m",
    // #859900 green
    warning: "\x1B[38;2;181;137;0m",
    // #b58900 yellow
    danger: "\x1B[38;2;220;50;47m",
    // #dc322f red
    secondary: "\x1B[38;2;88;110;117m",
    // #586e75 base01
    accent: "\x1B[38;2;203;75;22m",
    // #cb4b16 orange
    info: "\x1B[38;2;42;161;152m",
    // #2aa198 cyan
    barFilled: "\x1B[38;2;133;153;0m",
    // #859900 green
    barEmpty: "\x1B[38;2;7;54;66m",
    // #073642 base02
    red: "\x1B[38;2;220;50;47m",
    green: "\x1B[38;2;133;153;0m",
    yellow: "\x1B[38;2;181;137;0m",
    blue: "\x1B[38;2;38;139;210m",
    magenta: "\x1B[38;2;211;54;130m",
    cyan: "\x1B[38;2;42;161;152m",
    white: "\x1B[38;2;253;246;227m",
    gray: "\x1B[38;2;88;110;117m"
  }
};
var activeTheme = THEMES.default;
function getTheme() {
  return activeTheme;
}
var RESET = "\x1B[0m";
var COLORS = {
  reset: RESET,
  dim: "\x1B[2m",
  bold: "\x1B[1m",
  red: "\x1B[31m",
  green: "\x1B[32m",
  yellow: "\x1B[33m",
  blue: "\x1B[34m",
  magenta: "\x1B[35m",
  cyan: "\x1B[36m",
  white: "\x1B[37m",
  gray: "\x1B[90m",
  brightRed: "\x1B[91m",
  brightGreen: "\x1B[92m",
  brightYellow: "\x1B[93m",
  brightCyan: "\x1B[96m",
  pastelYellow: "\x1B[38;5;222m",
  pastelCyan: "\x1B[38;5;117m",
  pastelPink: "\x1B[38;5;218m",
  pastelGreen: "\x1B[38;5;151m",
  pastelOrange: "\x1B[38;5;216m",
  pastelRed: "\x1B[38;5;210m",
  pastelGray: "\x1B[38;5;249m"
};
function getColorForPercent(percent) {
  const theme = getTheme();
  if (percent <= 50)
    return theme.safe;
  if (percent <= 80)
    return theme.warning;
  return theme.danger;
}
function colorize(text, color) {
  return `${color}${text}${RESET}`;
}

// locales/en.json
var en_default = {
  model: {
    opus: "Opus",
    sonnet: "Sonnet",
    haiku: "Haiku"
  },
  labels: {
    "5h": "5h",
    "7d": "7d",
    "7d_all": "7d",
    "7d_sonnet": "7d-S",
    codex: "Codex",
    "1m": "1m"
  },
  time: {
    days: "d",
    hours: "h",
    minutes: "m",
    seconds: "s"
  },
  errors: {
    no_context: "No context yet"
  },
  widgets: {
    tools: "Tools",
    done: "done",
    running: "running",
    agent: "Agent",
    todos: "Tasks",
    claudeMd: "CLAUDE.md",
    agentsMd: "AGENTS.md",
    addedDirs: "+Dirs",
    rules: "Rules",
    mcps: "MCP",
    hooks: "Hooks",
    burnRate: "Rate",
    cache: "Cache",
    toLimit: "to",
    forecast: "Forecast",
    budget: "Budget",
    performance: "Perf",
    tokenBreakdown: "Tokens",
    todayCost: "Today",
    apiDuration: "API",
    peakHours: "Peak",
    offPeak: "Off-Peak"
  },
  checkUsage: {
    title: "CLI Usage Dashboard",
    recommendation: "Recommendation",
    lowestUsage: "Lowest usage",
    used: "used",
    notInstalled: "not installed",
    errorFetching: "Error fetching data",
    noData: "No usage data available"
  }
};

// locales/ko.json
var ko_default = {
  model: {
    opus: "Opus",
    sonnet: "Sonnet",
    haiku: "Haiku"
  },
  labels: {
    "5h": "5\uC2DC\uAC04",
    "7d": "7\uC77C",
    "7d_all": "7\uC77C",
    "7d_sonnet": "7\uC77C-S",
    codex: "Codex",
    "1m": "1\uAC1C\uC6D4"
  },
  time: {
    days: "\uC77C",
    hours: "\uC2DC\uAC04",
    minutes: "\uBD84",
    seconds: "\uCD08"
  },
  errors: {
    no_context: "\uCEE8\uD14D\uC2A4\uD2B8 \uC5C6\uC74C"
  },
  widgets: {
    tools: "\uB3C4\uAD6C",
    done: "\uC644\uB8CC",
    running: "\uC2E4\uD589\uC911",
    agent: "\uC5D0\uC774\uC804\uD2B8",
    todos: "\uD560\uC77C",
    claudeMd: "CLAUDE.md",
    agentsMd: "AGENTS.md",
    addedDirs: "+\uB514\uB809\uD1A0\uB9AC",
    rules: "\uADDC\uCE59",
    mcps: "MCP",
    hooks: "\uD6C5",
    burnRate: "\uC18C\uBAA8\uC728",
    cache: "\uCE90\uC2DC",
    toLimit: "\uD6C4",
    forecast: "\uC608\uCE21",
    budget: "\uC608\uC0B0",
    performance: "\uC131\uB2A5",
    tokenBreakdown: "\uD1A0\uD070",
    todayCost: "\uC624\uB298",
    apiDuration: "API",
    peakHours: "\uD53C\uD06C",
    offPeak: "\uBE44\uD53C\uD06C"
  },
  checkUsage: {
    title: "CLI \uC0AC\uC6A9\uB7C9 \uB300\uC2DC\uBCF4\uB4DC",
    recommendation: "\uCD94\uCC9C",
    lowestUsage: "\uAC00\uC7A5 \uC5EC\uC720",
    used: "\uC0AC\uC6A9",
    notInstalled: "\uC124\uCE58\uB418\uC9C0 \uC54A\uC74C",
    errorFetching: "\uB370\uC774\uD130 \uAC00\uC838\uC624\uAE30 \uC624\uB958",
    noData: "\uC0AC\uC6A9\uB7C9 \uB370\uC774\uD130 \uC5C6\uC74C"
  }
};

// scripts/utils/i18n.ts
var LOCALES = {
  en: en_default,
  ko: ko_default
};
function detectSystemLanguage() {
  const lang = process.env.LANG || process.env.LC_ALL || process.env.LC_MESSAGES || "";
  if (lang.toLowerCase().startsWith("ko")) {
    return "ko";
  }
  return "en";
}
function getTranslationsByLang(lang) {
  return LOCALES[lang] || LOCALES.en;
}

// scripts/check-usage.ts
var BOX_WIDTH = 40;
var CHECK_USAGE_TTL_SECONDS = 60;
function normalizeToISO(dateStr) {
  if (!dateStr)
    return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date.toISOString();
}
function formatTimeFromTimestamp(resetAt, t) {
  const resetDate = new Date(resetAt * 1e3);
  return formatTimeRemaining(resetDate, t);
}
function renderLine(char = "\u2550") {
  return char.repeat(BOX_WIDTH);
}
function renderTitle(title) {
  const padding = Math.max(0, Math.floor((BOX_WIDTH - title.length) / 2));
  return " ".repeat(padding) + colorize(title, COLORS.bold);
}
function renderSection(name, usage, t, contentFn, hasData = true) {
  const lines = [];
  const label = colorize(`[${name}]`, COLORS.pastelCyan);
  if (!usage.available) {
    lines.push(`${label} ${colorize(`(${t.checkUsage.notInstalled})`, COLORS.gray)}`);
    return lines;
  }
  if (usage.error || !hasData) {
    lines.push(`${label} ${colorize(`\u26A0\uFE0F ${t.checkUsage.errorFetching}`, COLORS.pastelYellow)}`);
    return lines;
  }
  lines.push(`${label}`);
  contentFn(lines);
  return lines;
}
function formatUsageRow(label, percent, resetStr) {
  const color = getColorForPercent(percent);
  return `${label}: ${colorize(`${percent}%`, color)}${resetStr ? ` (${resetStr})` : ""}`;
}
function renderGenericSection(name, usage, t, extraParts) {
  return renderSection(name, usage, t, (lines) => {
    const parts = [];
    if (usage.fiveHourPercent !== null) {
      const reset = usage.fiveHourReset ? formatTimeRemaining(usage.fiveHourReset, t) : "";
      parts.push(formatUsageRow(t.labels["5h"], usage.fiveHourPercent, reset));
    }
    if (usage.sevenDayPercent !== null) {
      const reset = usage.sevenDayReset ? formatTimeRemaining(usage.sevenDayReset, t) : "";
      parts.push(formatUsageRow(t.labels["7d"], usage.sevenDayPercent, reset));
    }
    extraParts?.(parts);
    if (parts.length > 0) {
      lines.push(`  ${parts.join("  |  ")}`);
    }
  });
}
function renderCodexSection(usage, codexData, t) {
  if (!codexData) {
    return renderSection("Codex", usage, t, () => {
    }, false);
  }
  return renderSection("Codex", usage, t, (lines) => {
    const parts = [];
    if (codexData.primary) {
      const percent = Math.round(codexData.primary.usedPercent);
      parts.push(formatUsageRow(t.labels["5h"], percent, formatTimeFromTimestamp(codexData.primary.resetAt, t)));
    }
    if (codexData.secondary) {
      const percent = Math.round(codexData.secondary.usedPercent);
      parts.push(formatUsageRow(t.labels["7d"], percent, formatTimeFromTimestamp(codexData.secondary.resetAt, t)));
    }
    if (codexData.planType) {
      parts.push(`Plan: ${colorize(codexData.planType, COLORS.pastelGray)}`);
    }
    if (parts.length > 0) {
      lines.push(`  ${parts.join("  |  ")}`);
    }
  });
}
function renderGeminiSection(usage, geminiData, t) {
  if (!geminiData) {
    return renderSection("Gemini", usage, t, () => {
    }, false);
  }
  return renderSection("Gemini", usage, t, (lines) => {
    if (geminiData.buckets && geminiData.buckets.length > 0) {
      const maxModelLen = Math.max(...geminiData.buckets.map((b) => (b.modelId || "unknown").length));
      for (const bucket of geminiData.buckets) {
        const modelName = bucket.modelId || "unknown";
        const paddedModel = modelName.padEnd(maxModelLen);
        if (bucket.usedPercent !== null) {
          const color = getColorForPercent(bucket.usedPercent);
          const reset = bucket.resetAt ? ` (${formatTimeRemaining(bucket.resetAt, t)})` : "";
          lines.push(`  ${colorize(paddedModel, COLORS.pastelGray)}  ${colorize(`${bucket.usedPercent}%`, color)}${reset}`);
        } else {
          lines.push(`  ${colorize(paddedModel, COLORS.pastelGray)}  ${colorize("--", COLORS.gray)}`);
        }
      }
    } else if (geminiData.usedPercent !== null) {
      const color = getColorForPercent(geminiData.usedPercent);
      const reset = geminiData.resetAt ? ` (${formatTimeRemaining(geminiData.resetAt, t)})` : "";
      const modelInfo = geminiData.model ? `${geminiData.model}: ` : "";
      lines.push(`  ${modelInfo}${colorize(`${geminiData.usedPercent}%`, color)}${reset}`);
    }
  });
}
function calculateRecommendation(claudeUsage, codexUsage, geminiUsage, zaiUsage, t) {
  const candidates = [];
  if (!isZaiProvider() && !claudeUsage.error && claudeUsage.fiveHourPercent !== null) {
    candidates.push({ name: "claude", score: claudeUsage.fiveHourPercent });
  }
  if (codexUsage && codexUsage.available && !codexUsage.error && codexUsage.fiveHourPercent !== null) {
    candidates.push({ name: "codex", score: codexUsage.fiveHourPercent });
  }
  if (geminiUsage && geminiUsage.available && !geminiUsage.error && geminiUsage.fiveHourPercent !== null) {
    candidates.push({ name: "gemini", score: geminiUsage.fiveHourPercent });
  }
  if (zaiUsage && zaiUsage.available && !zaiUsage.error && zaiUsage.fiveHourPercent !== null) {
    candidates.push({ name: "z.ai", score: zaiUsage.fiveHourPercent });
  }
  if (candidates.length === 0) {
    return {
      name: null,
      reason: t.checkUsage.noData
    };
  }
  candidates.sort((a, b) => a.score - b.score);
  const best = candidates[0];
  const reason = `${t.checkUsage.lowestUsage} (${best.score}% ${t.checkUsage.used})`;
  return { name: best.name, reason };
}
function createNotInstalledResult(name) {
  return {
    name,
    available: false,
    error: false,
    fiveHourPercent: null,
    sevenDayPercent: null,
    fiveHourReset: null,
    sevenDayReset: null
  };
}
function createErrorResult(name) {
  return {
    name,
    available: true,
    error: true,
    fiveHourPercent: null,
    sevenDayPercent: null,
    fiveHourReset: null,
    sevenDayReset: null
  };
}
function parseClaudeUsage(limits) {
  if (!limits) {
    return createErrorResult("Claude");
  }
  return {
    name: "Claude",
    available: true,
    error: false,
    fiveHourPercent: limits.five_hour ? Math.round(limits.five_hour.utilization) : null,
    sevenDayPercent: limits.seven_day ? Math.round(limits.seven_day.utilization) : null,
    fiveHourReset: normalizeToISO(limits.five_hour?.resets_at ?? null),
    sevenDayReset: normalizeToISO(limits.seven_day?.resets_at ?? null)
  };
}
function parseCodexUsage(limits, installed) {
  if (!installed)
    return createNotInstalledResult("Codex");
  if (!limits)
    return createErrorResult("Codex");
  return {
    name: "Codex",
    available: true,
    error: false,
    fiveHourPercent: limits.primary ? Math.round(limits.primary.usedPercent) : null,
    sevenDayPercent: limits.secondary ? Math.round(limits.secondary.usedPercent) : null,
    fiveHourReset: limits.primary ? new Date(limits.primary.resetAt * 1e3).toISOString() : null,
    sevenDayReset: limits.secondary ? new Date(limits.secondary.resetAt * 1e3).toISOString() : null,
    model: limits.model,
    plan: limits.planType
  };
}
function parseGeminiUsage(limits, installed) {
  if (!installed)
    return createNotInstalledResult("Gemini");
  if (!limits)
    return createErrorResult("Gemini");
  const buckets = limits.buckets?.map((b) => ({
    modelId: b.modelId || "unknown",
    usedPercent: b.usedPercent,
    resetAt: normalizeToISO(b.resetAt)
  }));
  return {
    name: "Gemini",
    available: true,
    error: false,
    fiveHourPercent: limits.usedPercent,
    sevenDayPercent: null,
    fiveHourReset: normalizeToISO(limits.resetAt),
    sevenDayReset: null,
    model: limits.model,
    buckets
  };
}
function parseZaiUsage(limits, installed) {
  if (!installed)
    return createNotInstalledResult("z.ai");
  if (!limits)
    return createErrorResult("z.ai");
  return {
    name: "z.ai",
    available: true,
    error: false,
    fiveHourPercent: limits.tokensPercent,
    sevenDayPercent: limits.mcpPercent,
    fiveHourReset: limits.tokensResetAt ? new Date(limits.tokensResetAt).toISOString() : null,
    sevenDayReset: limits.mcpResetAt ? new Date(limits.mcpResetAt).toISOString() : null,
    model: limits.model
  };
}
function parseLangArg(args) {
  const langIndex = args.indexOf("--lang");
  if (langIndex !== -1 && args[langIndex + 1]) {
    const lang = args[langIndex + 1].toLowerCase();
    if (lang === "ko" || lang === "en") {
      return lang;
    }
  }
  return null;
}
async function main() {
  const args = process.argv.slice(2);
  const isJsonMode = args.includes("--json");
  const lang = parseLangArg(args) ?? detectSystemLanguage();
  const t = getTranslationsByLang(lang);
  const zaiInstalled = isZaiInstalled();
  const [
    claudeLimits,
    codexInstalled,
    geminiInstalled
  ] = await Promise.all([
    fetchUsageLimits(CHECK_USAGE_TTL_SECONDS),
    isCodexInstalled(),
    isGeminiInstalled()
  ]);
  const [codexLimits, geminiLimits, zaiLimits] = await Promise.all([
    codexInstalled ? fetchCodexUsage(CHECK_USAGE_TTL_SECONDS) : Promise.resolve(null),
    geminiInstalled ? fetchGeminiUsage(CHECK_USAGE_TTL_SECONDS) : Promise.resolve(null),
    zaiInstalled ? fetchZaiUsage(CHECK_USAGE_TTL_SECONDS) : Promise.resolve(null)
  ]);
  const claudeUsage = parseClaudeUsage(claudeLimits);
  const codexUsage = parseCodexUsage(codexLimits, codexInstalled);
  const geminiUsage = parseGeminiUsage(geminiLimits, geminiInstalled);
  const zaiUsage = parseZaiUsage(zaiLimits, zaiInstalled);
  const recommendation = calculateRecommendation(
    claudeUsage,
    codexInstalled ? codexUsage : null,
    geminiInstalled ? geminiUsage : null,
    zaiInstalled ? zaiUsage : null,
    t
  );
  if (isJsonMode) {
    const output = {
      claude: claudeUsage,
      codex: codexInstalled ? codexUsage : null,
      gemini: geminiInstalled ? geminiUsage : null,
      zai: zaiInstalled ? zaiUsage : null,
      recommendation: recommendation.name,
      recommendationReason: recommendation.reason
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }
  const outputLines = [];
  outputLines.push(colorize(renderLine(), COLORS.gray));
  outputLines.push(renderTitle(t.checkUsage.title));
  outputLines.push(colorize(renderLine(), COLORS.gray));
  outputLines.push("");
  const claudeLines = renderGenericSection("Claude", claudeUsage, t, (parts) => {
    if (claudeUsage.plan)
      parts.push(`Plan: ${colorize(claudeUsage.plan, COLORS.pastelGray)}`);
  });
  if (claudeLines.length > 0) {
    outputLines.push(...claudeLines);
    outputLines.push("");
  }
  if (codexInstalled) {
    const codexLines = renderCodexSection(codexUsage, codexLimits, t);
    if (codexLines.length > 0) {
      outputLines.push(...codexLines);
      outputLines.push("");
    }
  }
  if (geminiInstalled) {
    const geminiLines = renderGeminiSection(geminiUsage, geminiLimits, t);
    if (geminiLines.length > 0) {
      outputLines.push(...geminiLines);
      outputLines.push("");
    }
  }
  if (zaiInstalled) {
    const zaiLines = renderGenericSection("z.ai", zaiUsage, t, (parts) => {
      if (zaiUsage.model)
        parts.push(`Model: ${colorize(zaiUsage.model, COLORS.pastelGray)}`);
    });
    if (zaiLines.length > 0) {
      outputLines.push(...zaiLines);
      outputLines.push("");
    }
  }
  outputLines.push(colorize(renderLine(), COLORS.gray));
  if (recommendation.name) {
    outputLines.push(
      `${t.checkUsage.recommendation}: ${colorize(recommendation.name, COLORS.pastelGreen)} (${recommendation.reason})`
    );
  } else {
    outputLines.push(colorize(recommendation.reason, COLORS.pastelYellow));
  }
  outputLines.push(colorize(renderLine(), COLORS.gray));
  console.log(outputLines.join("\n"));
}
main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  const isJsonMode = process.argv.includes("--json");
  if (isJsonMode) {
    console.log(JSON.stringify({ error: message }));
  } else {
    console.error("Error:", message);
  }
  process.exit(1);
});
export {
  calculateRecommendation,
  normalizeToISO,
  parseClaudeUsage,
  parseCodexUsage,
  parseGeminiUsage,
  parseZaiUsage
};
