#!/usr/bin/env node

// scripts/utils/api-client.ts
import { readFile as readFile2, writeFile, mkdir, readdir, stat as stat2, unlink } from "fs/promises";
import os from "os";
import path from "path";

// scripts/utils/credentials.ts
import { execFileSync } from "child_process";
import { readFile, stat } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
var KEYCHAIN_CACHE_TTL_MS = 1e4;
var credentialsCache = null;
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
async function getCredentialsFromKeychain() {
  if (credentialsCache?.timestamp && Date.now() - credentialsCache.timestamp < KEYCHAIN_CACHE_TTL_MS) {
    return credentialsCache.token;
  }
  try {
    const result = execFileSync(
      "security",
      ["find-generic-password", "-s", "Claude Code-credentials", "-w"],
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    ).trim();
    const creds = JSON.parse(result);
    const token = creds?.claudeAiOauth?.accessToken ?? null;
    credentialsCache = { token, timestamp: Date.now() };
    return token;
  } catch {
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
var VERSION = "1.8.0";

// scripts/utils/api-client.ts
var API_TIMEOUT_MS = 5e3;
var CACHE_DIR = path.join(os.homedir(), ".cache", "claude-dashboard");
var CACHE_MAX_AGE_SECONDS = 3600;
var CLEANUP_INTERVAL_MS = 36e5;
var usageCacheMap = /* @__PURE__ */ new Map();
var pendingRequests = /* @__PURE__ */ new Map();
var lastTokenHash = null;
var lastCleanupTime = 0;
async function ensureCacheDir() {
  try {
    await mkdir(CACHE_DIR, { recursive: true, mode: 448 });
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
  return ageSeconds < ttlSeconds;
}
async function fetchUsageLimits(ttlSeconds = 60) {
  const token = await getCredentials();
  if (!token) {
    if (lastTokenHash) {
      const cached = usageCacheMap.get(lastTokenHash);
      if (cached)
        return cached.data;
      const fileCache2 = await loadFileCache(lastTokenHash, ttlSeconds * 10);
      if (fileCache2)
        return fileCache2;
    }
    return null;
  }
  const tokenHash = hashToken(token);
  lastTokenHash = tokenHash;
  if (isCacheValid(tokenHash, ttlSeconds)) {
    const cached = usageCacheMap.get(tokenHash);
    if (cached)
      return cached.data;
  }
  const fileCache = await loadFileCache(tokenHash, ttlSeconds);
  if (fileCache) {
    usageCacheMap.set(tokenHash, { data: fileCache, timestamp: Date.now() });
    return fileCache;
  }
  const pending = pendingRequests.get(tokenHash);
  if (pending) {
    return pending;
  }
  const requestPromise = fetchFromApi(token, tokenHash);
  pendingRequests.set(tokenHash, requestPromise);
  try {
    return await requestPromise;
  } finally {
    pendingRequests.delete(tokenHash);
  }
}
async function fetchFromApi(token, tokenHash) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    const response = await fetch("https://api.anthropic.com/api/oauth/usage", {
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
    clearTimeout(timeout);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    const limits = {
      five_hour: data.five_hour ?? null,
      seven_day: data.seven_day ?? null,
      seven_day_sonnet: data.seven_day_sonnet ?? null
    };
    usageCacheMap.set(tokenHash, { data: limits, timestamp: Date.now() });
    await saveFileCache(tokenHash, limits);
    return limits;
  } catch {
    return null;
  }
}
async function loadFileCache(tokenHash, ttlSeconds) {
  try {
    const cacheFile = getCacheFilePath(tokenHash);
    const raw = await readFile2(cacheFile, "utf-8");
    const content = JSON.parse(raw);
    const ageSeconds = (Date.now() - content.timestamp) / 1e3;
    if (ageSeconds < ttlSeconds) {
      return content.data;
    }
    return null;
  } catch {
    return null;
  }
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
        if (ageSeconds > CACHE_MAX_AGE_SECONDS) {
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
import { execFileSync as execFileSync2 } from "child_process";
import os2 from "os";
import path2 from "path";

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

// scripts/utils/codex-client.ts
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
function detectModelFromCodexExec() {
  try {
    debugLog("codex", "detectModelFromCodexExec: running codex exec...");
    const output = execFileSync2("codex", ["exec", "1+1="], {
      encoding: "utf-8",
      timeout: 1e4,
      stdio: ["pipe", "pipe", "pipe"]
    });
    const match = output.match(/^model:\s*(.+)$/m);
    if (match) {
      const model = match[1].trim();
      debugLog("codex", "detectModelFromCodexExec: detected", model);
      return model;
    }
    debugLog("codex", "detectModelFromCodexExec: no model line found");
    return null;
  } catch (err) {
    debugLog("codex", "detectModelFromCodexExec: error", err);
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
  const detectedModel = detectModelFromCodexExec();
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
    if (ageSeconds < ttlSeconds) {
      return cached.data;
    }
  }
  const pending = pendingRequests2.get(tokenHash);
  if (pending) {
    return pending;
  }
  const requestPromise = fetchFromCodexApi(auth);
  pendingRequests2.set(tokenHash, requestPromise);
  try {
    return await requestPromise;
  } finally {
    pendingRequests2.delete(tokenHash);
  }
}
async function fetchFromCodexApi(auth) {
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
    const typedData = data;
    debugLog("codex", "fetchFromCodexApi: got data", typedData.plan_type);
    const model = await getCodexModel();
    const limits = {
      model: model ?? "unknown",
      planType: typedData.plan_type,
      primary: typedData.rate_limit.primary_window ? {
        usedPercent: typedData.rate_limit.primary_window.used_percent,
        resetAt: typedData.rate_limit.primary_window.reset_at
      } : null,
      secondary: typedData.rate_limit.secondary_window ? {
        usedPercent: typedData.rate_limit.secondary_window.used_percent,
        resetAt: typedData.rate_limit.secondary_window.reset_at
      } : null
    };
    const tokenHash = hashToken(auth.accessToken);
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
import { execFileSync as execFileSync3 } from "child_process";
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
  try {
    const result = execFileSync3(
      "security",
      ["find-generic-password", "-s", KEYCHAIN_SERVICE_NAME, "-a", MAIN_ACCOUNT_KEY, "-w"],
      { encoding: "utf-8", timeout: 3e3, stdio: ["pipe", "pipe", "pipe"] }
    ).trim();
    if (!result) {
      return null;
    }
    const stored = JSON.parse(result);
    if (!stored.token?.accessToken) {
      return null;
    }
    return {
      accessToken: stored.token.accessToken,
      refreshToken: stored.token.refreshToken,
      expiryDate: stored.token.expiresAt
    };
  } catch {
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
      selectedModel: json?.selectedModel || json?.model,
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
    if (ageSeconds < ttlSeconds) {
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
    return await requestPromise;
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

// scripts/utils/zai-api-client.ts
var API_TIMEOUT_MS4 = 5e3;
function toSafePercent(value) {
  return Math.min(100, Math.max(0, Math.round(value * 100)));
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
    if (ageSeconds < ttlSeconds) {
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
    }
    return result;
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
      if (limit.type === "TOKENS_LIMIT") {
        if (limit.currentValue !== void 0) {
          tokensPercent = toSafePercent(limit.currentValue);
        }
        if (limit.nextResetTime !== void 0) {
          tokensResetAt = limit.nextResetTime;
        }
      } else if (limit.type === "TIME_LIMIT") {
        if (limit.usage !== void 0) {
          mcpPercent = toSafePercent(limit.usage);
        } else if (limit.currentValue !== void 0) {
          mcpPercent = toSafePercent(limit.currentValue);
        }
        if (limit.nextResetTime !== void 0) {
          mcpResetAt = limit.nextResetTime;
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

// scripts/utils/colors.ts
var COLORS = {
  // Reset
  reset: "\x1B[0m",
  // Styles
  dim: "\x1B[2m",
  bold: "\x1B[1m",
  // Foreground colors (standard ANSI 16)
  red: "\x1B[31m",
  green: "\x1B[32m",
  yellow: "\x1B[33m",
  blue: "\x1B[34m",
  magenta: "\x1B[35m",
  cyan: "\x1B[36m",
  white: "\x1B[37m",
  gray: "\x1B[90m",
  // Bright variants
  brightRed: "\x1B[91m",
  brightGreen: "\x1B[92m",
  brightYellow: "\x1B[93m",
  brightCyan: "\x1B[96m",
  // Pastel colors (256-color mode)
  pastelYellow: "\x1B[38;5;222m",
  // Cream/soft yellow - for folders, cost
  pastelCyan: "\x1B[38;5;117m",
  // Soft cyan - for model
  pastelPink: "\x1B[38;5;218m",
  // Soft pink - for git branch
  pastelGreen: "\x1B[38;5;151m",
  // Mint green - for positive/safe status
  pastelOrange: "\x1B[38;5;216m",
  // Soft orange - for warning status
  pastelRed: "\x1B[38;5;210m",
  // Soft coral - for danger status
  pastelGray: "\x1B[38;5;249m"
  // Light gray - for secondary info
};
var RESET = COLORS.reset;
function getColorForPercent(percent) {
  if (percent <= 50)
    return COLORS.pastelGreen;
  if (percent <= 80)
    return COLORS.pastelYellow;
  return COLORS.pastelRed;
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
    todos: "Todos",
    claudeMd: "CLAUDE.md",
    rules: "Rules",
    mcps: "MCP",
    hooks: "Hooks",
    burnRate: "Rate",
    cache: "Cache",
    toLimit: "to"
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
    rules: "\uADDC\uCE59",
    mcps: "MCP",
    hooks: "\uD6C5",
    burnRate: "\uC18C\uBAA8\uC728",
    cache: "\uCE90\uC2DC",
    toLimit: "\uD6C4"
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
function renderClaudeSection(name, usage, t) {
  const lines = [];
  const label = colorize(`[${name}]`, COLORS.pastelCyan);
  if (!usage.available) {
    lines.push(`${label} ${colorize(`(${t.checkUsage.notInstalled})`, COLORS.gray)}`);
    return lines;
  }
  if (usage.error) {
    lines.push(`${label} ${colorize(`\u26A0\uFE0F ${t.checkUsage.errorFetching}`, COLORS.pastelYellow)}`);
    return lines;
  }
  const parts = [];
  if (usage.fiveHourPercent !== null) {
    const color5h = getColorForPercent(usage.fiveHourPercent);
    const reset5h = usage.fiveHourReset ? ` (${formatTimeRemaining(usage.fiveHourReset, t)})` : "";
    parts.push(`${t.labels["5h"]}: ${colorize(`${usage.fiveHourPercent}%`, color5h)}${reset5h}`);
  }
  if (usage.sevenDayPercent !== null) {
    const color7d = getColorForPercent(usage.sevenDayPercent);
    const reset7d = usage.sevenDayReset ? ` (${formatTimeRemaining(usage.sevenDayReset, t)})` : "";
    parts.push(`${t.labels["7d"]}: ${colorize(`${usage.sevenDayPercent}%`, color7d)}${reset7d}`);
  }
  if (usage.plan) {
    parts.push(`Plan: ${colorize(usage.plan, COLORS.pastelGray)}`);
  }
  if (usage.model && name === "Gemini") {
    parts.push(`Model: ${colorize(usage.model, COLORS.pastelGray)}`);
  }
  lines.push(`${label}`);
  if (parts.length > 0) {
    lines.push(`  ${parts.join("  |  ")}`);
  }
  return lines;
}
function renderCodexSection(usage, codexData, t) {
  const lines = [];
  const label = colorize("[Codex]", COLORS.pastelCyan);
  if (!usage.available) {
    lines.push(`${label} ${colorize(`(${t.checkUsage.notInstalled})`, COLORS.gray)}`);
    return lines;
  }
  if (usage.error || !codexData) {
    lines.push(`${label} ${colorize(`\u26A0\uFE0F ${t.checkUsage.errorFetching}`, COLORS.pastelYellow)}`);
    return lines;
  }
  const parts = [];
  if (codexData.primary) {
    const percent = Math.round(codexData.primary.usedPercent);
    const color5h = getColorForPercent(percent);
    const reset5h = formatTimeFromTimestamp(codexData.primary.resetAt, t);
    parts.push(`${t.labels["5h"]}: ${colorize(`${percent}%`, color5h)} (${reset5h})`);
  }
  if (codexData.secondary) {
    const percent = Math.round(codexData.secondary.usedPercent);
    const color7d = getColorForPercent(percent);
    const reset7d = formatTimeFromTimestamp(codexData.secondary.resetAt, t);
    parts.push(`${t.labels["7d"]}: ${colorize(`${percent}%`, color7d)} (${reset7d})`);
  }
  if (codexData.planType) {
    parts.push(`Plan: ${colorize(codexData.planType, COLORS.pastelGray)}`);
  }
  lines.push(`${label}`);
  if (parts.length > 0) {
    lines.push(`  ${parts.join("  |  ")}`);
  }
  return lines;
}
function renderGeminiSection(usage, geminiData, t) {
  const lines = [];
  const label = colorize("[Gemini]", COLORS.pastelCyan);
  if (!usage.available) {
    lines.push(`${label} ${colorize(`(${t.checkUsage.notInstalled})`, COLORS.gray)}`);
    return lines;
  }
  if (usage.error || !geminiData) {
    lines.push(`${label} ${colorize(`\u26A0\uFE0F ${t.checkUsage.errorFetching}`, COLORS.pastelYellow)}`);
    return lines;
  }
  lines.push(`${label}`);
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
  } else {
    if (geminiData.usedPercent !== null) {
      const color = getColorForPercent(geminiData.usedPercent);
      const reset = geminiData.resetAt ? ` (${formatTimeRemaining(geminiData.resetAt, t)})` : "";
      const modelInfo = geminiData.model ? `${geminiData.model}: ` : "";
      lines.push(`  ${modelInfo}${colorize(`${geminiData.usedPercent}%`, color)}${reset}`);
    }
  }
  return lines;
}
function renderZaiSection(usage, zaiData, t) {
  const lines = [];
  const label = colorize("[z.ai]", COLORS.pastelCyan);
  if (!usage.available) {
    lines.push(`${label} ${colorize(`(${t.checkUsage.notInstalled})`, COLORS.gray)}`);
    return lines;
  }
  if (usage.error || !zaiData) {
    lines.push(`${label} ${colorize(`\u26A0\uFE0F ${t.checkUsage.errorFetching}`, COLORS.pastelYellow)}`);
    return lines;
  }
  const parts = [];
  if (zaiData.tokensPercent !== null) {
    const color = getColorForPercent(zaiData.tokensPercent);
    const reset = zaiData.tokensResetAt ? ` (${formatTimeRemaining(new Date(zaiData.tokensResetAt), t)})` : "";
    parts.push(`Tokens: ${colorize(`${zaiData.tokensPercent}%`, color)}${reset}`);
  }
  if (zaiData.mcpPercent !== null) {
    const color = getColorForPercent(zaiData.mcpPercent);
    const reset = zaiData.mcpResetAt ? ` (${formatTimeRemaining(new Date(zaiData.mcpResetAt), t)})` : "";
    parts.push(`MCP: ${colorize(`${zaiData.mcpPercent}%`, color)}${reset}`);
  }
  if (zaiData.model) {
    parts.push(`Model: ${colorize(zaiData.model, COLORS.pastelGray)}`);
  }
  lines.push(`${label}`);
  if (parts.length > 0) {
    lines.push(`  ${parts.join("  |  ")}`);
  }
  return lines;
}
function calculateRecommendation(claudeUsage, codexUsage, geminiUsage, zaiUsage, t) {
  const candidates = [];
  if (!claudeUsage.error && claudeUsage.fiveHourPercent !== null) {
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
  const claudeLines = renderClaudeSection("Claude", claudeUsage, t);
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
    const zaiLines = renderZaiSection(zaiUsage, zaiLimits, t);
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
