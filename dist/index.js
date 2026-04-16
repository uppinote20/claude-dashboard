#!/usr/bin/env node

// scripts/statusline.ts
import { readFile as readFile9, stat as stat10 } from "fs/promises";
import { join as join6 } from "path";
import { homedir as homedir6 } from "os";

// scripts/types.ts
var DISPLAY_PRESETS = {
  compact: [
    ["model", "context", "cost", "rateLimit5h", "rateLimit7d", "rateLimit7dSonnet", "zaiUsage"]
  ],
  normal: [
    ["model", "context", "cost", "rateLimit5h", "rateLimit7d", "rateLimit7dSonnet", "zaiUsage"],
    ["projectInfo", "sessionId", "sessionDuration", "burnRate", "todoProgress"]
  ],
  detailed: [
    ["model", "context", "cost", "rateLimit5h", "rateLimit7d", "rateLimit7dSonnet", "zaiUsage"],
    ["projectInfo", "sessionName", "sessionId", "sessionDuration", "burnRate", "tokenSpeed", "depletionTime", "todoProgress"],
    ["configCounts", "toolActivity", "agentStatus", "cacheHit", "performance"],
    ["tokenBreakdown", "forecast", "budget", "todayCost"],
    ["codexUsage", "geminiUsage", "linesChanged", "outputStyle", "version", "peakHours"],
    ["lastPrompt"]
  ]
};
var PRESET_CHAR_MAP = {
  M: "model",
  C: "context",
  $: "cost",
  R: "rateLimit5h",
  "7": "rateLimit7d",
  S: "rateLimit7dSonnet",
  P: "projectInfo",
  I: "sessionId",
  D: "sessionDuration",
  T: "toolActivity",
  A: "agentStatus",
  O: "todoProgress",
  B: "burnRate",
  E: "depletionTime",
  H: "cacheHit",
  X: "codexUsage",
  G: "geminiUsage",
  Z: "zaiUsage",
  K: "configCounts",
  N: "tokenBreakdown",
  F: "performance",
  W: "forecast",
  U: "budget",
  V: "version",
  L: "linesChanged",
  Y: "outputStyle",
  Q: "tokenSpeed",
  J: "sessionName",
  "@": "todayCost",
  "?": "lastPrompt",
  m: "vimMode",
  a: "apiDuration",
  p: "peakHours"
};
function parsePreset(preset) {
  return preset.split("|").map(
    (line) => [...line].map((ch) => PRESET_CHAR_MAP[ch]).filter((id) => id !== void 0)
  ).filter((line) => line.length > 0);
}
var DEFAULT_CONFIG = {
  language: "auto",
  plan: "max",
  displayMode: "compact",
  cache: {
    ttlSeconds: 300
  }
};
var NEGATIVE_CACHE_SECONDS = 30;

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
function setTheme(themeId) {
  activeTheme = THEMES[themeId ?? "default"] ?? THEMES.default;
  cachedSeparator = null;
}
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
var SEPARATOR_CHARS = {
  pipe: "\u2502",
  space: " ",
  dot: "\xB7",
  arrow: "\u203A"
};
var activeSeparatorStyle = "pipe";
var cachedSeparator = null;
function setSeparatorStyle(style) {
  activeSeparatorStyle = style && style in SEPARATOR_CHARS ? style : "pipe";
  cachedSeparator = null;
}
function getSeparator() {
  if (cachedSeparator !== null)
    return cachedSeparator;
  const char = SEPARATOR_CHARS[activeSeparatorStyle];
  cachedSeparator = activeSeparatorStyle === "space" ? "  " : ` ${getTheme().dim}${char}${RESET} `;
  return cachedSeparator;
}

// scripts/utils/api-client.ts
import { readFile as readFile2, writeFile, mkdir, readdir, stat as stat2, unlink } from "fs/promises";
import { execFile as execFile2 } from "child_process";
import os from "os";
import path from "path";

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
var VERSION = "1.25.0";

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
function getTranslations(config) {
  let lang;
  if (config.language === "auto") {
    lang = detectSystemLanguage();
  } else {
    lang = config.language;
  }
  return LOCALES[lang] || LOCALES.en;
}

// scripts/widgets/model.ts
import { readFile as readFile3, stat as stat3 } from "fs/promises";
import { join as join2 } from "path";
import { homedir as homedir2 } from "os";

// scripts/utils/formatters.ts
function formatTokens(tokens) {
  if (tokens >= 1e6) {
    const value = tokens / 1e6;
    return value >= 10 ? `${Math.round(value)}M` : `${value.toFixed(1)}M`;
  }
  if (tokens >= 1e3) {
    const value = tokens / 1e3;
    return value >= 10 ? `${Math.round(value)}K` : `${value.toFixed(1)}K`;
  }
  return String(tokens);
}
function formatCost(cost) {
  return `$${cost.toFixed(2)}`;
}
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
function shortenModelName(displayName) {
  const lower = displayName.toLowerCase();
  if (lower.includes("opus"))
    return "Opus";
  if (lower.includes("sonnet"))
    return "Sonnet";
  if (lower.includes("haiku"))
    return "Haiku";
  const parts = displayName.split(/\s+/);
  if (parts.length > 1 && parts[0].toLowerCase() === "claude") {
    return parts[1];
  }
  return displayName;
}
function calculatePercent(current, total) {
  if (total <= 0)
    return 0;
  return Math.min(100, Math.round(current / total * 100));
}
function formatDuration(ms, t) {
  if (ms <= 0)
    return `0${t.minutes}`;
  const totalMinutes = Math.floor(ms / (1e3 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) {
    return `${hours}${t.hours}${minutes}${t.minutes}`;
  }
  if (hours > 0) {
    return `${hours}${t.hours}`;
  }
  return `${minutes}${t.minutes}`;
}
function truncate(str, maxLen) {
  return str.length <= maxLen ? str : str.slice(0, maxLen) + "\u2026";
}
function clampPercent(value) {
  return Math.min(100, Math.max(0, Math.round(value)));
}
function osc8Link(url, text) {
  return `\x1B]8;;${url}\x1B\\${text}\x1B]8;;\x1B\\`;
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

// scripts/widgets/model.ts
var EFFORT_LEVELS = /* @__PURE__ */ new Set(["high", "medium", "low"]);
function isEffortLevel(value) {
  return typeof value === "string" && EFFORT_LEVELS.has(value);
}
function getDefaultEffort(modelId) {
  if (modelId.includes("opus-4-6") || modelId.includes("sonnet-4-6"))
    return "medium";
  return "high";
}
var settingsCache = null;
async function getModelSettings(modelId) {
  const defaultEffort = getDefaultEffort(modelId);
  const settingsPath = join2(homedir2(), ".claude", "settings.json");
  try {
    const fileStat = await stat3(settingsPath);
    if (settingsCache && settingsCache.mtime === fileStat.mtimeMs) {
      return {
        effortLevel: isEffortLevel(settingsCache.rawEffort) ? settingsCache.rawEffort : defaultEffort,
        fastMode: settingsCache.fastMode
      };
    }
    const content = await readFile3(settingsPath, "utf-8");
    const settings = JSON.parse(content);
    const rawEffort = settings.effortLevel;
    const fastMode = settings.fastMode === true;
    settingsCache = { mtime: fileStat.mtimeMs, rawEffort, fastMode };
    return {
      effortLevel: isEffortLevel(rawEffort) ? rawEffort : defaultEffort,
      fastMode
    };
  } catch {
    settingsCache = null;
  }
  const envEffort = process.env.CLAUDE_CODE_EFFORT_LEVEL;
  if (isEffortLevel(envEffort)) {
    return { effortLevel: envEffort, fastMode: false };
  }
  return { effortLevel: defaultEffort, fastMode: false };
}
var modelWidget = {
  id: "model",
  name: "Model",
  async getData(ctx) {
    const { model } = ctx.stdin;
    const modelId = model?.id || "";
    const { effortLevel, fastMode } = await getModelSettings(modelId);
    return {
      id: model?.id || "",
      displayName: model?.display_name || "-",
      effortLevel,
      fastMode
    };
  },
  render(data) {
    const shortName = shortenModelName(data.displayName);
    const icon = isZaiProvider() ? "\u{1F7E0}" : "\u25C6";
    const supportsEffort = shortName === "Opus" || shortName === "Sonnet";
    const effortSuffix = supportsEffort ? `(${data.effortLevel[0].toUpperCase()})` : "";
    const fastIndicator = shortName === "Opus" && data.fastMode ? " \u21AF" : "";
    return `${getTheme().model}${icon} ${shortName}${effortSuffix}${fastIndicator}${RESET}`;
  }
};

// scripts/utils/progress-bar.ts
var DEFAULT_PROGRESS_BAR_CONFIG = {
  width: 10,
  filledChar: "\u2588",
  // █ (full block)
  emptyChar: "\u2591"
  // ░ (light shade)
};
function renderProgressBar(percent, config = DEFAULT_PROGRESS_BAR_CONFIG) {
  const { width, filledChar, emptyChar } = config;
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const filled = Math.round(clampedPercent / 100 * width);
  const empty = width - filled;
  const bar = filledChar.repeat(filled) + emptyChar.repeat(empty);
  const color = getColorForPercent(clampedPercent);
  return `${color}${bar}${RESET}`;
}

// scripts/widgets/context.ts
var contextWidget = {
  id: "context",
  name: "Context",
  async getData(ctx) {
    const { context_window } = ctx.stdin;
    const usage = context_window?.current_usage;
    const contextSize = context_window?.context_window_size || 2e5;
    const officialPercent = context_window?.used_percentage;
    if (!usage) {
      return {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        contextSize,
        percentage: typeof officialPercent === "number" ? Math.round(officialPercent) : 0
      };
    }
    const inputTokens = usage.input_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens;
    const outputTokens = usage.output_tokens;
    const totalTokens = inputTokens + outputTokens;
    const percentage = typeof officialPercent === "number" ? Math.round(officialPercent) : calculatePercent(inputTokens, contextSize);
    return {
      inputTokens,
      outputTokens,
      totalTokens,
      contextSize,
      percentage
    };
  },
  render(data, _ctx) {
    const parts = [];
    parts.push(renderProgressBar(data.percentage));
    const percentColor = getColorForPercent(data.percentage);
    parts.push(colorize(`${data.percentage}%`, percentColor));
    parts.push(
      `${formatTokens(data.inputTokens)}/${formatTokens(data.contextSize)}`
    );
    return parts.join(getSeparator());
  }
};

// scripts/widgets/cost.ts
var costWidget = {
  id: "cost",
  name: "Cost",
  async getData(ctx) {
    const { cost } = ctx.stdin;
    return {
      totalCostUsd: cost?.total_cost_usd ?? 0
    };
  },
  render(data) {
    return colorize(formatCost(data.totalCostUsd), getTheme().accent);
  }
};

// scripts/widgets/rate-limit.ts
function renderRateLimit(data, ctx, labelKey) {
  if (data.isError) {
    return colorize("\u26A0\uFE0F", getTheme().warning);
  }
  const { translations: t } = ctx;
  const color = getColorForPercent(data.utilization);
  const label = `${t.labels[labelKey]}: ${colorize(`${data.utilization}%`, color)}`;
  if (!data.resetsAt)
    return label;
  return `${label} (${formatTimeRemaining(data.resetsAt, t)})`;
}
function getLimitData(limits, key) {
  const limit = limits?.[key];
  if (!limit)
    return null;
  return {
    utilization: Math.round(limit.utilization),
    resetsAt: limit.resets_at
  };
}
function shouldHideAnthropicLimits() {
  return isZaiProvider();
}
var rateLimit5hWidget = {
  id: "rateLimit5h",
  name: "5h Rate Limit",
  async getData(ctx) {
    if (shouldHideAnthropicLimits())
      return null;
    const data = getLimitData(ctx.rateLimits, "five_hour");
    return data ?? { utilization: 0, resetsAt: null, isError: true };
  },
  render(data, ctx) {
    return renderRateLimit(data, ctx, "5h");
  }
};
var rateLimit7dWidget = {
  id: "rateLimit7d",
  name: "7d Rate Limit",
  async getData(ctx) {
    if (shouldHideAnthropicLimits())
      return null;
    return getLimitData(ctx.rateLimits, "seven_day");
  },
  render(data, ctx) {
    return renderRateLimit(data, ctx, "7d_all");
  }
};
var rateLimit7dSonnetWidget = {
  id: "rateLimit7dSonnet",
  name: "7d Sonnet Rate Limit",
  async getData(ctx) {
    if (shouldHideAnthropicLimits())
      return null;
    if (ctx.config.plan !== "max")
      return null;
    return getLimitData(ctx.rateLimits, "seven_day_sonnet");
  },
  render(data, ctx) {
    return renderRateLimit(data, ctx, "7d_sonnet");
  }
};

// scripts/widgets/project-info.ts
import { basename, relative } from "path";

// scripts/utils/git.ts
import { execFile as execFile3 } from "child_process";
function execGit(args, cwd, timeout) {
  return new Promise((resolve, reject) => {
    execFile3("git", ["--no-optional-locks", ...args], {
      cwd,
      encoding: "utf-8",
      timeout
    }, (error, stdout) => {
      if (error)
        reject(error);
      else
        resolve(stdout);
    });
  });
}
function countUntrackedLines(cwd, timeout) {
  return new Promise((resolve) => {
    execFile3(
      "sh",
      ["-c", "git --no-optional-locks ls-files --others --exclude-standard -z | xargs -0 cat 2>/dev/null | wc -l"],
      { cwd, encoding: "utf-8", timeout },
      (_error, stdout) => {
        const match = stdout?.match(/(\d+)/);
        resolve(match ? parseInt(match[1], 10) : 0);
      }
    );
  });
}

// scripts/widgets/project-info.ts
var GIT_CACHE_TTL_MS = 5e3;
var gitCache = null;
async function getGitBranch(cwd) {
  try {
    const result = await execGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd, 500);
    return result.trim() || void 0;
  } catch {
    return void 0;
  }
}
async function isGitDirty(cwd) {
  try {
    const result = await execGit(["status", "--porcelain"], cwd, 1e3);
    return result.trim().length > 0;
  } catch {
    return false;
  }
}
async function getAheadBehind(cwd) {
  try {
    const result = await execGit(["rev-list", "--left-right", "--count", "@{u}...HEAD"], cwd, 500);
    const parts = result.trim().split(/\s+/);
    if (parts.length === 2) {
      return {
        behind: parseInt(parts[0], 10) || 0,
        ahead: parseInt(parts[1], 10) || 0
      };
    }
    return null;
  } catch {
    return null;
  }
}
async function getGitRemoteUrl(cwd) {
  try {
    const result = await execGit(["remote", "get-url", "origin"], cwd, 500);
    return normalizeGitUrl(result.trim()) || void 0;
  } catch {
    return void 0;
  }
}
function normalizeGitUrl(url) {
  const sshMatch = url.match(/^(?:ssh:\/\/)?git@([^:/]+)[:/](.+?)(?:\.git)?$/);
  if (sshMatch)
    return `https://${sshMatch[1]}/${sshMatch[2]}`;
  const httpsMatch = url.match(/^https?:\/\/(?:[^@/]+@)?(.+?)(?:\.git)?$/);
  if (httpsMatch)
    return `https://${httpsMatch[1]}`;
  return null;
}
async function getGitData(cwd) {
  if (gitCache && gitCache.cwd === cwd && Date.now() - gitCache.timestamp < GIT_CACHE_TTL_MS) {
    return gitCache.data;
  }
  const [branch, dirty, ab, remoteUrl] = await Promise.all([
    getGitBranch(cwd),
    isGitDirty(cwd),
    getAheadBehind(cwd),
    getGitRemoteUrl(cwd)
  ]);
  const data = { branch, dirty, ab, remoteUrl };
  gitCache = { cwd, data, timestamp: Date.now() };
  return data;
}
var projectInfoWidget = {
  id: "projectInfo",
  name: "Project Info",
  async getData(ctx) {
    const currentDir = ctx.stdin.workspace?.current_dir;
    if (!currentDir) {
      return null;
    }
    const projectDir = ctx.stdin.workspace?.project_dir;
    const dirName = basename(projectDir || currentDir);
    const subPath = projectDir && currentDir !== projectDir && currentDir.startsWith(projectDir + "/") ? relative(projectDir, currentDir) : void 0;
    const worktreeName = ctx.stdin.worktree?.name || void 0;
    const { branch, dirty, ab, remoteUrl } = await getGitData(currentDir);
    let gitBranch;
    let ahead;
    let behind;
    if (branch) {
      gitBranch = dirty ? `${branch}*` : branch;
      if (ab) {
        ahead = ab.ahead;
        behind = ab.behind;
      }
    }
    return {
      dirName,
      gitBranch,
      ahead,
      behind,
      subPath,
      worktreeName,
      remoteUrl: remoteUrl && branch ? `${remoteUrl}/tree/${branch.split("/").map(encodeURIComponent).join("/")}` : void 0
    };
  },
  render(data, _ctx) {
    const theme = getTheme();
    const parts = [];
    const dirDisplay = data.subPath ? `\u{1F4C1} ${data.dirName} (${data.subPath})` : `\u{1F4C1} ${data.dirName}`;
    parts.push(colorize(dirDisplay, theme.folder));
    if (data.gitBranch) {
      let branchStr = data.gitBranch;
      const aheadStr = (data.ahead ?? 0) > 0 ? `\u2191${data.ahead}` : "";
      const behindStr = (data.behind ?? 0) > 0 ? `\u2193${data.behind}` : "";
      const indicators = `${aheadStr}${behindStr}`;
      if (indicators) {
        branchStr += ` ${indicators}`;
      }
      const branchDisplay = data.remoteUrl ? `(${osc8Link(data.remoteUrl, branchStr)})` : `(${branchStr})`;
      parts.push(colorize(branchDisplay, theme.branch));
    }
    if (data.worktreeName) {
      parts.push(colorize(`\u{1F333} wt:${data.worktreeName}`, theme.info));
    }
    return parts.join(" ");
  }
};

// scripts/widgets/config-counts.ts
import { readdir as readdir2, readFile as readFile4, stat as stat4 } from "fs/promises";
import { join as join3 } from "path";
var CONFIG_CACHE_TTL_MS = 3e4;
var EMPTY_FS_COUNTS = { claudeMd: 0, agentsMd: 0, rules: 0, mcps: 0, hooks: 0 };
var configCountsCache = null;
async function countFiles(dir, pattern) {
  try {
    const files = await readdir2(dir);
    if (pattern) {
      return files.filter((f) => pattern.test(f)).length;
    }
    return files.length;
  } catch {
    return 0;
  }
}
async function fileExists(path4) {
  try {
    await stat4(path4);
    return true;
  } catch {
    return false;
  }
}
async function countClaudeMd(projectDir) {
  const [root, nested] = await Promise.all([
    fileExists(join3(projectDir, "CLAUDE.md")),
    fileExists(join3(projectDir, ".claude", "CLAUDE.md"))
  ]);
  return (root ? 1 : 0) + (nested ? 1 : 0);
}
async function countAgentsMd(projectDir) {
  const [root, agentFiles] = await Promise.all([
    fileExists(join3(projectDir, "AGENTS.md")),
    countFiles(join3(projectDir, ".claude", "agents"), /\.md$/)
  ]);
  return (root ? 1 : 0) + agentFiles;
}
async function countMcps(projectDir) {
  const homeDir = process.env.HOME || "";
  const mcpPaths = [
    { path: join3(projectDir, ".claude", "mcp.json"), key: "mcpServers" },
    { path: join3(homeDir, ".claude.json"), key: "mcpServers" },
    { path: join3(homeDir, ".config", "claude-code", "mcp.json"), key: "mcpServers" }
  ];
  const counts = await Promise.all(
    mcpPaths.map(async ({ path: path4, key }) => {
      try {
        const content = await readFile4(path4, "utf-8");
        const config = JSON.parse(content);
        return Object.keys(config[key] || {}).length;
      } catch {
        return 0;
      }
    })
  );
  return counts.reduce((a, b) => a + b, 0);
}
var configCountsWidget = {
  id: "configCounts",
  name: "Config Counts",
  async getData(ctx) {
    const currentDir = ctx.stdin.workspace?.current_dir;
    if (!currentDir) {
      return null;
    }
    const addedDirs = ctx.stdin.workspace?.added_dirs?.length ?? 0;
    if (configCountsCache?.projectDir === currentDir && Date.now() - configCountsCache.timestamp < CONFIG_CACHE_TTL_MS) {
      if (!configCountsCache.data && addedDirs === 0)
        return null;
      const fsData2 = configCountsCache.data ?? EMPTY_FS_COUNTS;
      return { ...fsData2, addedDirs };
    }
    const claudeDir = join3(currentDir, ".claude");
    const [claudeMd, agentsMd, rules, mcps, hooks] = await Promise.all([
      countClaudeMd(currentDir),
      countAgentsMd(currentDir),
      countFiles(join3(claudeDir, "rules")),
      countMcps(currentDir),
      countFiles(join3(claudeDir, "hooks"))
    ]);
    const fsData = claudeMd === 0 && agentsMd === 0 && rules === 0 && mcps === 0 && hooks === 0 ? null : { claudeMd, agentsMd, rules, mcps, hooks };
    configCountsCache = { projectDir: currentDir, data: fsData, timestamp: Date.now() };
    if (!fsData && addedDirs === 0)
      return null;
    return { ...fsData ?? EMPTY_FS_COUNTS, addedDirs };
  },
  render(data, ctx) {
    const { translations: t } = ctx;
    const parts = [];
    if (data.claudeMd > 0) {
      parts.push(`${t.widgets.claudeMd}: ${data.claudeMd}`);
    }
    if (data.agentsMd > 0) {
      parts.push(`${t.widgets.agentsMd}: ${data.agentsMd}`);
    }
    if (data.rules > 0) {
      parts.push(`${t.widgets.rules}: ${data.rules}`);
    }
    if (data.mcps > 0) {
      parts.push(`${t.widgets.mcps}: ${data.mcps}`);
    }
    if (data.hooks > 0) {
      parts.push(`${t.widgets.hooks}: ${data.hooks}`);
    }
    if (data.addedDirs > 0) {
      parts.push(`${t.widgets.addedDirs}: ${data.addedDirs}`);
    }
    return colorize(parts.join(", "), getTheme().secondary);
  }
};

// scripts/utils/session.ts
import { readFile as readFile5, mkdir as mkdir2, open, readdir as readdir3, unlink as unlink2, stat as stat5 } from "fs/promises";
import { join as join4 } from "path";
import { homedir as homedir3 } from "os";
var SESSION_DIR = join4(homedir3(), ".cache", "claude-dashboard", "sessions");
var SESSION_MAX_AGE_SECONDS = 604800;
var CLEANUP_INTERVAL_MS2 = 36e5;
function isErrnoException(error, code) {
  return error instanceof Error && "code" in error && error.code === code;
}
var lastCleanupTime2 = 0;
var sessionCache = /* @__PURE__ */ new Map();
var pendingRequests2 = /* @__PURE__ */ new Map();
function sanitizeSessionId(sessionId) {
  return sessionId.replace(/[^a-zA-Z0-9-_]/g, "");
}
async function getSessionStartTime(sessionId) {
  const safeSessionId = sanitizeSessionId(sessionId);
  if (sessionCache.has(safeSessionId)) {
    return sessionCache.get(safeSessionId);
  }
  const pending = pendingRequests2.get(safeSessionId);
  if (pending) {
    return pending;
  }
  const promise = getOrCreateSessionStartTimeImpl(safeSessionId);
  pendingRequests2.set(safeSessionId, promise);
  try {
    return await promise;
  } finally {
    pendingRequests2.delete(safeSessionId);
  }
}
async function getOrCreateSessionStartTimeImpl(safeSessionId) {
  const sessionFile = join4(SESSION_DIR, `${safeSessionId}.json`);
  try {
    const content = await readFile5(sessionFile, "utf-8");
    const data = JSON.parse(content);
    if (typeof data.startTime !== "number") {
      debugLog("session", `Invalid session file format for ${safeSessionId}`);
      throw new Error("Invalid session file format");
    }
    sessionCache.set(safeSessionId, data.startTime);
    return data.startTime;
  } catch (error) {
    if (!isErrnoException(error, "ENOENT")) {
      debugLog("session", `Failed to read session ${safeSessionId}`, error);
    }
    const startTime = Date.now();
    try {
      await mkdir2(SESSION_DIR, { recursive: true });
      const fileHandle = await open(sessionFile, "wx");
      try {
        await fileHandle.writeFile(JSON.stringify({ startTime }), "utf-8");
      } finally {
        await fileHandle.close();
      }
      sessionCache.set(safeSessionId, startTime);
      cleanupExpiredSessions().catch(() => {
      });
      return startTime;
    } catch (writeError) {
      if (isErrnoException(writeError, "EEXIST")) {
        try {
          const content = await readFile5(sessionFile, "utf-8");
          const data = JSON.parse(content);
          if (typeof data.startTime === "number") {
            sessionCache.set(safeSessionId, data.startTime);
            return data.startTime;
          }
        } catch {
          debugLog("session", `Failed to read existing session ${safeSessionId} after EEXIST`);
        }
      }
      if (!isErrnoException(writeError, "EEXIST")) {
        debugLog("session", `Failed to persist session ${safeSessionId}`, writeError);
      }
      sessionCache.set(safeSessionId, startTime);
      return startTime;
    }
  }
}
async function getSessionElapsedMs(sessionId) {
  const startTime = await getSessionStartTime(sessionId);
  return Date.now() - startTime;
}
async function getSessionElapsedMinutes(ctx, minMinutes = 1) {
  const sessionId = ctx.stdin.session_id || "default";
  const elapsedMs = await getSessionElapsedMs(sessionId);
  const elapsedMinutes = elapsedMs / (1e3 * 60);
  if (elapsedMinutes < minMinutes)
    return null;
  return elapsedMinutes;
}
async function cleanupExpiredSessions() {
  const now = Date.now();
  if (now - lastCleanupTime2 < CLEANUP_INTERVAL_MS2) {
    return;
  }
  lastCleanupTime2 = now;
  try {
    const files = await readdir3(SESSION_DIR);
    const cutoffTime = now - SESSION_MAX_AGE_SECONDS * 1e3;
    for (const file of files) {
      if (!file.endsWith(".json"))
        continue;
      try {
        const filePath = join4(SESSION_DIR, file);
        const fileStat = await stat5(filePath);
        if (fileStat.mtimeMs < cutoffTime) {
          await unlink2(filePath);
          debugLog("session", `Cleaned up expired session: ${file}`);
        }
      } catch {
      }
    }
  } catch {
  }
}

// scripts/widgets/session-duration.ts
var sessionDurationWidget = {
  id: "sessionDuration",
  name: "Session Duration",
  async getData(ctx) {
    const stdinDuration = ctx.stdin.cost?.total_duration_ms;
    if (typeof stdinDuration === "number" && stdinDuration > 0) {
      return { elapsedMs: stdinDuration };
    }
    const sessionId = ctx.stdin.session_id || "default";
    const elapsedMs = await getSessionElapsedMs(sessionId);
    return { elapsedMs };
  },
  render(data, ctx) {
    const { translations: t } = ctx;
    const duration = formatDuration(data.elapsedMs, t.time);
    return colorize(`\u23F1 ${duration}`, getTheme().secondary);
  }
};

// scripts/utils/transcript-parser.ts
import { open as open2, stat as stat6 } from "fs/promises";
import { basename as basename2 } from "path";
var cachedTranscript = null;
function createParsedTranscript() {
  return {
    toolUses: /* @__PURE__ */ new Map(),
    completedToolCount: 0,
    runningToolIds: /* @__PURE__ */ new Set(),
    lastTodoWriteInput: null,
    activeAgentIds: /* @__PURE__ */ new Set(),
    completedAgentCount: 0,
    tasks: /* @__PURE__ */ new Map(),
    nextTaskId: 1,
    pendingTaskCreates: /* @__PURE__ */ new Map(),
    pendingTaskUpdates: /* @__PURE__ */ new Map()
  };
}
function parseJsonlContent(content) {
  const entries = [];
  for (const line of content.split("\n")) {
    if (!line)
      continue;
    try {
      entries.push(JSON.parse(line));
    } catch {
    }
  }
  return entries;
}
function processEntries(entries, existing) {
  for (const entry of entries) {
    if (!existing.sessionStartTime && entry.timestamp) {
      existing.sessionStartTime = new Date(entry.timestamp).getTime();
    }
    if (entry.customTitle) {
      existing.sessionName = entry.customTitle;
    }
    if (entry.type === "assistant" && entry.message?.content) {
      for (const block of entry.message.content) {
        if (block.type === "tool_use" && block.id && block.name) {
          existing.toolUses.set(block.id, {
            name: block.name,
            timestamp: entry.timestamp,
            input: block.input
          });
          existing.runningToolIds.add(block.id);
          if (block.name === "Task") {
            existing.activeAgentIds.add(block.id);
          }
          if (block.name === "TaskCreate") {
            const input = block.input;
            if (input?.subject) {
              const seqId = String(existing.nextTaskId);
              existing.nextTaskId++;
              existing.pendingTaskCreates.set(block.id, {
                subject: input.subject,
                status: normalizeTaskStatus(input.status || "pending"),
                seqId
              });
            }
          } else if (block.name === "TaskUpdate") {
            const input = block.input;
            if (input?.taskId) {
              existing.pendingTaskUpdates.set(block.id, {
                taskId: input.taskId,
                status: input.status,
                subject: input.subject
              });
            }
          }
        }
      }
    }
    if (entry.type === "user" && entry.message?.content) {
      for (const block of entry.message.content) {
        if (block.type === "tool_result" && block.tool_use_id) {
          existing.completedToolCount++;
          existing.runningToolIds.delete(block.tool_use_id);
          if (existing.activeAgentIds.delete(block.tool_use_id)) {
            existing.completedAgentCount++;
          }
          const tool = existing.toolUses.get(block.tool_use_id);
          if (tool?.name === "TodoWrite") {
            existing.lastTodoWriteInput = tool.input;
          }
          const pendingCreate = existing.pendingTaskCreates.get(block.tool_use_id);
          if (pendingCreate) {
            existing.tasks.set(pendingCreate.seqId, {
              subject: pendingCreate.subject,
              status: pendingCreate.status
            });
            existing.pendingTaskCreates.delete(block.tool_use_id);
          }
          const pendingUpdate = existing.pendingTaskUpdates.get(block.tool_use_id);
          if (pendingUpdate) {
            const task = existing.tasks.get(pendingUpdate.taskId);
            if (task) {
              if (pendingUpdate.status)
                task.status = normalizeTaskStatus(pendingUpdate.status);
              if (pendingUpdate.subject)
                task.subject = pendingUpdate.subject;
            }
            existing.pendingTaskUpdates.delete(block.tool_use_id);
          }
          existing.toolUses.delete(block.tool_use_id);
        }
      }
    }
  }
}
async function readFromOffset(filePath, offset, fileSize) {
  const bytesToRead = fileSize - offset;
  if (bytesToRead <= 0)
    return "";
  const fd = await open2(filePath, "r");
  try {
    const buffer = Buffer.alloc(bytesToRead);
    await fd.read(buffer, 0, bytesToRead, offset);
    return buffer.toString("utf-8");
  } finally {
    await fd.close();
  }
}
async function parseTranscript(transcriptPath) {
  try {
    const fileStat = await stat6(transcriptPath);
    const fileSize = fileStat.size;
    if (cachedTranscript?.path === transcriptPath && cachedTranscript.size <= fileSize) {
      if (cachedTranscript.size === fileSize) {
        return cachedTranscript.data;
      }
      const newContent = await readFromOffset(transcriptPath, cachedTranscript.size, fileSize);
      processEntries(parseJsonlContent(newContent), cachedTranscript.data);
      cachedTranscript.size = fileSize;
      return cachedTranscript.data;
    }
    const content = await readFromOffset(transcriptPath, 0, fileSize);
    const data = createParsedTranscript();
    processEntries(parseJsonlContent(content), data);
    cachedTranscript = { path: transcriptPath, size: fileSize, data };
    return data;
  } catch {
    return null;
  }
}
function extractToolTarget(name, input) {
  if (!input || typeof input !== "object")
    return void 0;
  const inp = input;
  switch (name) {
    case "Read":
    case "Write":
    case "Edit":
      return typeof inp.file_path === "string" ? basename2(inp.file_path) : void 0;
    case "Glob":
    case "Grep":
      return typeof inp.pattern === "string" ? truncate(inp.pattern, 20) : void 0;
    case "Bash":
      return typeof inp.command === "string" ? truncate(inp.command, 25) : void 0;
    default:
      return void 0;
  }
}
function getRunningTools(transcript) {
  const running = [];
  for (const id of transcript.runningToolIds) {
    const tool = transcript.toolUses.get(id);
    if (!tool)
      continue;
    running.push({
      name: tool.name,
      startTime: tool.timestamp ? new Date(tool.timestamp).getTime() : Date.now(),
      target: extractToolTarget(tool.name, tool.input)
    });
  }
  return running;
}
function getCompletedToolCount(transcript) {
  return transcript.completedToolCount;
}
function normalizeTaskStatus(status) {
  switch (status) {
    case "not_started":
      return "pending";
    case "running":
      return "in_progress";
    case "complete":
    case "done":
      return "completed";
    default:
      return status;
  }
}
function extractTodoProgress(transcript) {
  const lastTodoWrite = transcript.lastTodoWriteInput;
  if (!lastTodoWrite || typeof lastTodoWrite !== "object") {
    return null;
  }
  const input = lastTodoWrite;
  if (!Array.isArray(input.todos)) {
    return null;
  }
  const todos = input.todos;
  const completed = todos.filter((t) => normalizeTaskStatus(t.status) === "completed").length;
  const total = todos.length;
  const current = todos.find((t) => {
    const s = normalizeTaskStatus(t.status);
    return s === "in_progress" || s === "pending";
  });
  return {
    current: current ? {
      content: current.content,
      status: normalizeTaskStatus(current.status)
    } : void 0,
    completed,
    total
  };
}
function extractTaskProgress(transcript) {
  if (transcript.tasks.size === 0)
    return null;
  const all = [...transcript.tasks.values()];
  const completed = all.filter((t) => t.status === "completed").length;
  const current = all.find(
    (t) => t.status === "in_progress" || t.status === "pending"
  );
  return {
    current: current ? { content: current.subject, status: current.status } : void 0,
    completed,
    total: all.length
  };
}
function extractTodoOrTaskProgress(transcript) {
  return extractTaskProgress(transcript) ?? extractTodoProgress(transcript);
}
async function getTranscript(ctx) {
  const transcriptPath = ctx.stdin.transcript_path;
  if (!transcriptPath)
    return null;
  return parseTranscript(transcriptPath);
}
function extractAgentStatus(transcript) {
  const active = [];
  for (const id of transcript.activeAgentIds) {
    const tool = transcript.toolUses.get(id);
    if (!tool)
      continue;
    const input = tool.input;
    active.push({
      name: input?.subagent_type || "Agent",
      description: input?.description
    });
  }
  return { active, completed: transcript.completedAgentCount };
}

// scripts/widgets/tool-activity.ts
var toolActivityWidget = {
  id: "toolActivity",
  name: "Tool Activity",
  async getData(ctx) {
    const transcript = await getTranscript(ctx);
    if (!transcript)
      return null;
    const running = getRunningTools(transcript);
    const completed = getCompletedToolCount(transcript);
    return { running, completed };
  },
  render(data, ctx) {
    const { translations: t } = ctx;
    const theme = getTheme();
    if (data.running.length === 0) {
      return colorize(
        `${t.widgets.tools}: ${data.completed} ${t.widgets.done}`,
        theme.secondary
      );
    }
    const runningNames = data.running.slice(0, 2).map((r) => r.target ? `${r.name}(${r.target})` : r.name).join(", ");
    const more = data.running.length > 2 ? ` +${data.running.length - 2}` : "";
    return `${colorize("\u2699\uFE0F", theme.warning)} ${runningNames}${more} (${data.completed} ${t.widgets.done})`;
  }
};

// scripts/widgets/agent-status.ts
var agentStatusWidget = {
  id: "agentStatus",
  name: "Agent Status",
  async getData(ctx) {
    const transcript = await getTranscript(ctx);
    if (!transcript)
      return null;
    const status = extractAgentStatus(transcript);
    if (status.active.length === 0 && status.completed === 0) {
      return null;
    }
    return status;
  },
  render(data, ctx) {
    const { translations: t } = ctx;
    const theme = getTheme();
    if (data.active.length === 0) {
      return colorize(
        `${t.widgets.agent}: ${data.completed} ${t.widgets.done}`,
        theme.secondary
      );
    }
    const activeAgent = data.active[0];
    const agentText = activeAgent.description ? `${activeAgent.name}: ${truncate(activeAgent.description, 20)}` : activeAgent.name;
    const more = data.active.length > 1 ? ` +${data.active.length - 1}` : "";
    return `${colorize("\u{1F916}", theme.info)} ${t.widgets.agent}: ${agentText}${more}`;
  }
};

// scripts/widgets/todo-progress.ts
var todoProgressWidget = {
  id: "todoProgress",
  name: "Todo Progress",
  async getData(ctx) {
    const transcript = await getTranscript(ctx);
    if (!transcript)
      return null;
    const progress = extractTodoOrTaskProgress(transcript);
    return progress || { total: 0, completed: 0 };
  },
  render(data, ctx) {
    const { translations: t } = ctx;
    const theme = getTheme();
    if (data.total === 0) {
      return colorize(`${t.widgets.todos}: -`, theme.dim);
    }
    const percent = calculatePercent(data.completed, data.total);
    const color = getColorForPercent(100 - percent);
    if (data.current) {
      const taskName = truncate(data.current.content, 15);
      return `${colorize("\u2713", theme.safe)} ${taskName} [${data.completed}/${data.total}]`;
    }
    return colorize(
      `${t.widgets.todos}: ${data.completed}/${data.total}`,
      data.completed === data.total ? theme.safe : color
    );
  }
};

// scripts/widgets/burn-rate.ts
var burnRateWidget = {
  id: "burnRate",
  name: "Burn Rate",
  async getData(ctx) {
    const usage = ctx.stdin.context_window?.current_usage;
    let elapsedMinutes;
    try {
      elapsedMinutes = await getSessionElapsedMinutes(ctx, 0);
    } catch (error) {
      debugLog("burnRate", "Failed to get session elapsed time", error);
      return null;
    }
    if (elapsedMinutes === null)
      return null;
    if (!usage || elapsedMinutes === 0) {
      return { tokensPerMinute: 0 };
    }
    const totalTokens = usage.input_tokens + usage.output_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens;
    if (totalTokens === 0) {
      return { tokensPerMinute: 0 };
    }
    const tokensPerMinute = totalTokens / elapsedMinutes;
    if (!Number.isFinite(tokensPerMinute) || tokensPerMinute < 0) {
      return null;
    }
    return { tokensPerMinute };
  },
  render(data, _ctx) {
    return `\u{1F525} ${formatTokens(Math.round(data.tokensPerMinute))}/min`;
  }
};

// scripts/widgets/depletion-time.ts
var MAX_DISPLAY_MINUTES = 24 * 60;
var MIN_UTILIZATION_RATE = 0.01;
var depletionTimeWidget = {
  id: "depletionTime",
  name: "Depletion Time",
  async getData(ctx) {
    const utilization = ctx.rateLimits?.five_hour?.utilization;
    if (!utilization || utilization < 1)
      return null;
    const elapsedMinutes = await getSessionElapsedMinutes(ctx, 0);
    if (elapsedMinutes === null || elapsedMinutes === 0)
      return null;
    const utilizationPerMinute = utilization / elapsedMinutes;
    if (utilizationPerMinute < MIN_UTILIZATION_RATE)
      return null;
    const minutesToLimit = (100 - utilization) / utilizationPerMinute;
    if (!Number.isFinite(minutesToLimit) || minutesToLimit < 0)
      return null;
    if (minutesToLimit > MAX_DISPLAY_MINUTES)
      return null;
    return {
      minutesToLimit: Math.round(minutesToLimit),
      limitType: "5h"
    };
  },
  render(data, ctx) {
    const { translations: t } = ctx;
    const duration = formatDuration(data.minutesToLimit * 60 * 1e3, t.time);
    return colorize(`\u23F3 ~${duration} ${t.widgets.toLimit} ${data.limitType}`, getTheme().warning);
  }
};

// scripts/widgets/cache-hit.ts
var cacheHitWidget = {
  id: "cacheHit",
  name: "Cache Hit Rate",
  async getData(ctx) {
    const usage = ctx.stdin.context_window?.current_usage;
    if (!usage) {
      return { hitPercentage: 0 };
    }
    const cacheRead = usage.cache_read_input_tokens;
    const freshInput = usage.input_tokens;
    const cacheCreation = usage.cache_creation_input_tokens;
    const total = cacheRead + freshInput + cacheCreation;
    if (total === 0) {
      return { hitPercentage: 0 };
    }
    const hitPercentage = Math.min(100, Math.max(0, Math.round(cacheRead / total * 100)));
    return { hitPercentage };
  },
  render(data) {
    const color = getColorForPercent(100 - data.hitPercentage);
    return `\u{1F4E6} ${colorize(`${data.hitPercentage}%`, color)}`;
  }
};

// scripts/utils/codex-client.ts
import { readFile as readFile6, stat as stat7, writeFile as writeFile2, mkdir as mkdir3 } from "fs/promises";
import { execFile as execFile4 } from "child_process";
import os2 from "os";
import path2 from "path";
var API_TIMEOUT_MS2 = 5e3;
var CODEX_AUTH_PATH = path2.join(os2.homedir(), ".codex", "auth.json");
var CODEX_CONFIG_PATH = path2.join(os2.homedir(), ".codex", "config.toml");
var CACHE_DIR2 = path2.join(os2.homedir(), ".cache", "claude-dashboard");
var MODEL_CACHE_PATH = path2.join(CACHE_DIR2, "codex-model-cache.json");
var codexCacheMap = /* @__PURE__ */ new Map();
var pendingRequests3 = /* @__PURE__ */ new Map();
var cachedAuth = null;
function isValidCodexApiResponse(data) {
  return data !== null && typeof data === "object" && "rate_limit" in data && "plan_type" in data && typeof data.rate_limit === "object" && data.rate_limit !== null;
}
async function isCodexInstalled() {
  try {
    await stat7(CODEX_AUTH_PATH);
    return true;
  } catch {
    return false;
  }
}
async function getCodexAuth() {
  try {
    const fileStat = await stat7(CODEX_AUTH_PATH);
    if (cachedAuth && cachedAuth.mtime === fileStat.mtimeMs) {
      return cachedAuth.data;
    }
    const raw = await readFile6(CODEX_AUTH_PATH, "utf-8");
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
    const raw = await readFile6(CODEX_CONFIG_PATH, "utf-8");
    const match = raw.match(/^model\s*=\s*["']([^"']+)["']\s*(?:#.*)?$/m);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
async function getConfigMtime() {
  try {
    const fileStat = await stat7(CODEX_CONFIG_PATH);
    return fileStat.mtimeMs;
  } catch {
    return 0;
  }
}
async function getCachedModel(currentMtime) {
  try {
    const raw = await readFile6(MODEL_CACHE_PATH, "utf-8");
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
    await mkdir3(CACHE_DIR2, { recursive: true });
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
      execFile4("codex", ["exec", "1+1="], {
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
  const pending = pendingRequests3.get(tokenHash);
  if (pending) {
    return pending;
  }
  const requestPromise = fetchFromCodexApi(auth, tokenHash);
  pendingRequests3.set(tokenHash, requestPromise);
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
    pendingRequests3.delete(tokenHash);
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

// scripts/widgets/codex-usage.ts
function formatRateLimit(label, percent, resetAt, ctx) {
  const color = getColorForPercent(percent);
  let result = `${label}: ${colorize(`${Math.round(percent)}%`, color)}`;
  if (resetAt) {
    const resetTime = formatTimeRemaining(new Date(resetAt * 1e3), ctx.translations);
    if (resetTime) {
      result += ` (${resetTime})`;
    }
  }
  return result;
}
var codexUsageWidget = {
  id: "codexUsage",
  name: "Codex Usage",
  async getData(ctx) {
    const installed = await isCodexInstalled();
    debugLog("codex", "isCodexInstalled:", installed);
    if (!installed) {
      return null;
    }
    const limits = await fetchCodexUsage(ctx.config.cache.ttlSeconds);
    debugLog("codex", "fetchCodexUsage result:", limits);
    if (!limits) {
      return {
        model: "codex",
        planType: "",
        primaryPercent: null,
        primaryResetAt: null,
        secondaryPercent: null,
        secondaryResetAt: null,
        isError: true
      };
    }
    return {
      model: limits.model,
      planType: limits.planType,
      primaryPercent: limits.primary?.usedPercent ?? null,
      primaryResetAt: limits.primary?.resetAt ?? null,
      secondaryPercent: limits.secondary?.usedPercent ?? null,
      secondaryResetAt: limits.secondary?.resetAt ?? null
    };
  },
  render(data, ctx) {
    const { translations: t } = ctx;
    const theme = getTheme();
    const parts = [];
    parts.push(`${colorize("\u{1F537}", theme.info)} ${data.model}`);
    if (data.isError) {
      parts.push(colorize("\u26A0\uFE0F", theme.warning));
    } else {
      if (data.primaryPercent !== null) {
        parts.push(formatRateLimit(t.labels["5h"], data.primaryPercent, data.primaryResetAt, ctx));
      }
      if (data.secondaryPercent !== null) {
        parts.push(formatRateLimit(t.labels["7d"], data.secondaryPercent, data.secondaryResetAt, ctx));
      }
    }
    return parts.join(` ${colorize("\u2502", theme.dim)} `);
  }
};

// scripts/utils/gemini-client.ts
import { readFile as readFile7, writeFile as writeFile3, stat as stat8 } from "fs/promises";
import { execFile as execFile5 } from "child_process";
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
var pendingRequests4 = /* @__PURE__ */ new Map();
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
    await stat8(oauthPath);
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
      execFile5(
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
    const fileStat = await stat8(oauthPath);
    if (cachedCredentials && cachedCredentials.mtime === fileStat.mtimeMs) {
      return cachedCredentials.data;
    }
    const raw = await readFile7(oauthPath, "utf-8");
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
      const raw = await readFile7(oauthPath, "utf-8");
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
    const fileStat = await stat8(settingsPath);
    if (cachedSettings && cachedSettings.mtime === fileStat.mtimeMs) {
      return cachedSettings.data;
    }
    const raw = await readFile7(settingsPath, "utf-8");
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
  const pending = pendingRequests4.get(tokenHash);
  if (pending) {
    return pending;
  }
  const requestPromise = fetchFromGeminiApi(credentials, projectId);
  pendingRequests4.set(tokenHash, requestPromise);
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
    pendingRequests4.delete(tokenHash);
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

// scripts/widgets/gemini-usage.ts
function formatUsage(percent, resetAt, ctx) {
  const color = getColorForPercent(percent);
  let result = colorize(`${Math.round(percent)}%`, color);
  if (resetAt) {
    const resetTime = formatTimeRemaining(new Date(resetAt), ctx.translations);
    if (resetTime) {
      result += ` (${resetTime})`;
    }
  }
  return result;
}
var geminiUsageWidget = {
  id: "geminiUsage",
  name: "Gemini Usage",
  async getData(ctx) {
    const installed = await isGeminiInstalled();
    debugLog("gemini", "isGeminiInstalled:", installed);
    if (!installed) {
      return null;
    }
    const limits = await fetchGeminiUsage(ctx.config.cache.ttlSeconds);
    debugLog("gemini", "fetchGeminiUsage result:", limits);
    if (!limits) {
      return {
        model: "gemini",
        usedPercent: null,
        resetAt: null,
        isError: true
      };
    }
    return {
      model: limits.model,
      usedPercent: limits.usedPercent,
      resetAt: limits.resetAt
    };
  },
  render(data, ctx) {
    const theme = getTheme();
    const parts = [];
    parts.push(`${colorize("\u{1F48E}", theme.info)} ${data.model}`);
    if (data.isError) {
      parts.push(colorize("\u26A0\uFE0F", theme.warning));
    } else if (data.usedPercent !== null) {
      parts.push(formatUsage(data.usedPercent, data.resetAt, ctx));
    }
    return parts.join(` ${colorize("\u2502", theme.dim)} `);
  }
};
var geminiUsageAllWidget = {
  id: "geminiUsageAll",
  name: "Gemini Usage All",
  async getData(ctx) {
    const installed = await isGeminiInstalled();
    debugLog("gemini", "geminiUsageAll - isGeminiInstalled:", installed);
    if (!installed) {
      return null;
    }
    const limits = await fetchGeminiUsage(ctx.config.cache.ttlSeconds);
    debugLog("gemini", "geminiUsageAll - fetchGeminiUsage result:", limits);
    if (!limits) {
      return {
        buckets: [],
        isError: true
      };
    }
    return {
      buckets: limits.buckets.map((b) => ({
        modelId: b.modelId || "unknown",
        usedPercent: b.usedPercent,
        resetAt: b.resetAt
      }))
    };
  },
  render(data, ctx) {
    const theme = getTheme();
    if (data.isError) {
      return `${colorize("\u{1F48E}", theme.info)} Gemini ${colorize("\u26A0\uFE0F", theme.warning)}`;
    }
    if (data.buckets.length === 0) {
      return `${colorize("\u{1F48E}", theme.info)} Gemini ${colorize("--", theme.secondary)}`;
    }
    const parts = data.buckets.map((bucket) => {
      const modelShort = bucket.modelId.replace("gemini-", "");
      if (bucket.usedPercent !== null) {
        return `${colorize(modelShort, theme.secondary)}: ${formatUsage(bucket.usedPercent, bucket.resetAt, ctx)}`;
      }
      return `${colorize(modelShort, theme.secondary)}: ${colorize("--", theme.secondary)}`;
    });
    return `${colorize("\u{1F48E}", theme.info)} ${parts.join(" \u2502 ")}`;
  }
};

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
var pendingRequests5 = /* @__PURE__ */ new Map();
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
  const pending = pendingRequests5.get(cacheKey);
  if (pending) {
    return pending;
  }
  const requestPromise = fetchFromZaiApi(baseUrl, authToken);
  pendingRequests5.set(cacheKey, requestPromise);
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
    pendingRequests5.delete(cacheKey);
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

// scripts/widgets/zai-usage.ts
function formatPercent(percent) {
  const color = getColorForPercent(percent);
  return colorize(`${Math.round(percent)}%`, color);
}
var zaiUsageWidget = {
  id: "zaiUsage",
  name: "Z.ai Usage",
  async getData(ctx) {
    const installed = isZaiInstalled();
    debugLog("zai", "isZaiInstalled:", installed);
    if (!installed) {
      return null;
    }
    const limits = await fetchZaiUsage(ctx.config.cache.ttlSeconds);
    debugLog("zai", "fetchZaiUsage result:", limits);
    const modelName = ctx.stdin.model?.display_name || "GLM";
    if (!limits) {
      return {
        model: modelName,
        tokensPercent: null,
        tokensResetAt: null,
        mcpPercent: null,
        mcpResetAt: null,
        isError: true
      };
    }
    return {
      model: modelName,
      tokensPercent: limits.tokensPercent,
      tokensResetAt: limits.tokensResetAt,
      mcpPercent: limits.mcpPercent,
      mcpResetAt: limits.mcpResetAt
    };
  },
  render(data, ctx) {
    const { translations: t } = ctx;
    const theme = getTheme();
    const parts = [];
    parts.push(`\u{1F7E0} ${data.model}`);
    if (data.isError) {
      parts.push(colorize("\u26A0\uFE0F", theme.warning));
    } else {
      if (data.tokensPercent !== null) {
        let tokenPart = `${t.labels["5h"]}: ${formatPercent(data.tokensPercent)}`;
        if (data.tokensResetAt) {
          tokenPart += ` (${formatTimeRemaining(new Date(data.tokensResetAt), t)})`;
        }
        parts.push(tokenPart);
      }
      if (data.mcpPercent !== null) {
        let mcpPart = `${t.labels["1m"]}: ${formatPercent(data.mcpPercent)}`;
        if (data.mcpResetAt) {
          mcpPart += ` (${formatTimeRemaining(new Date(data.mcpResetAt), t)})`;
        }
        parts.push(mcpPart);
      }
    }
    return parts.join(` ${colorize("\u2502", theme.dim)} `);
  }
};

// scripts/widgets/session-id.ts
async function getSessionIdData(ctx) {
  const sessionId = ctx.stdin.session_id;
  if (!sessionId)
    return null;
  return {
    sessionId,
    shortId: sessionId.slice(0, 8)
  };
}
var sessionIdWidget = {
  id: "sessionId",
  name: "Session ID (Short)",
  getData: getSessionIdData,
  render(data) {
    return colorize(`\u{1F511} ${data.shortId}`, getTheme().secondary);
  }
};
var sessionIdFullWidget = {
  id: "sessionIdFull",
  name: "Session ID (Full)",
  getData: getSessionIdData,
  render(data) {
    return colorize(`\u{1F511} ${data.sessionId}`, getTheme().secondary);
  }
};

// scripts/widgets/token-breakdown.ts
var tokenBreakdownWidget = {
  id: "tokenBreakdown",
  name: "Token Breakdown",
  async getData(ctx) {
    const usage = ctx.stdin.context_window?.current_usage;
    if (!usage)
      return null;
    const { input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens } = usage;
    const total = input_tokens + output_tokens + cache_creation_input_tokens + cache_read_input_tokens;
    if (total === 0)
      return null;
    return {
      inputTokens: input_tokens,
      outputTokens: output_tokens,
      cacheWriteTokens: cache_creation_input_tokens,
      cacheReadTokens: cache_read_input_tokens
    };
  },
  render(data, _ctx) {
    const theme = getTheme();
    const parts = [];
    if (data.inputTokens > 0)
      parts.push(`${colorize("In", theme.info)} ${formatTokens(data.inputTokens)}`);
    if (data.outputTokens > 0)
      parts.push(`${colorize("Out", theme.accent)} ${formatTokens(data.outputTokens)}`);
    if (data.cacheWriteTokens > 0)
      parts.push(`${colorize("W", theme.warning)} ${formatTokens(data.cacheWriteTokens)}`);
    if (data.cacheReadTokens > 0)
      parts.push(`${colorize("R", theme.safe)} ${formatTokens(data.cacheReadTokens)}`);
    return `\u{1F4CA} ${parts.join(colorize(" \xB7 ", theme.secondary))}`;
  }
};

// scripts/widgets/performance.ts
var GOOD_THRESHOLD = 70;
var OK_THRESHOLD = 40;
var performanceWidget = {
  id: "performance",
  name: "Performance",
  async getData(ctx) {
    const usage = ctx.stdin.context_window?.current_usage;
    if (!usage)
      return null;
    const totalTokens = usage.input_tokens + usage.output_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens;
    if (totalTokens === 0)
      return null;
    const elapsedMinutes = await getSessionElapsedMinutes(ctx, 0);
    if (elapsedMinutes === null || elapsedMinutes === 0)
      return null;
    const totalInput = usage.input_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens;
    const cacheHitRate = totalInput > 0 ? usage.cache_read_input_tokens / totalInput * 100 : 0;
    const outputRatio = usage.output_tokens / totalTokens * 100;
    const score = Math.min(100, Math.max(0, Math.round(cacheHitRate * 0.6 + outputRatio * 0.4)));
    return {
      score,
      cacheHitRate: Math.round(cacheHitRate),
      outputRatio: Math.round(outputRatio)
    };
  },
  render(data, _ctx) {
    const theme = getTheme();
    let badge;
    let color;
    if (data.score >= GOOD_THRESHOLD) {
      badge = "\u{1F7E2}";
      color = theme.safe;
    } else if (data.score >= OK_THRESHOLD) {
      badge = "\u{1F7E1}";
      color = theme.warning;
    } else {
      badge = "\u{1F534}";
      color = theme.danger;
    }
    return `${badge} ${colorize(`${data.score}%`, color)}`;
  }
};

// scripts/widgets/forecast.ts
var forecastWidget = {
  id: "forecast",
  name: "Cost Forecast",
  async getData(ctx) {
    const totalCost = ctx.stdin.cost?.total_cost_usd ?? 0;
    if (totalCost <= 0)
      return null;
    const elapsedMinutes = await getSessionElapsedMinutes(ctx, 1);
    if (elapsedMinutes === null || elapsedMinutes === 0)
      return null;
    const costPerMinute = totalCost / elapsedMinutes;
    const hourlyCost = costPerMinute * 60;
    if (!Number.isFinite(hourlyCost) || hourlyCost < 0)
      return null;
    return {
      currentCost: totalCost,
      hourlyCost
    };
  },
  render(data, _ctx) {
    const theme = getTheme();
    let hourlyColor;
    if (data.hourlyCost > 10) {
      hourlyColor = theme.danger;
    } else if (data.hourlyCost > 5) {
      hourlyColor = theme.warning;
    } else {
      hourlyColor = theme.safe;
    }
    return `\u{1F4C8} ${colorize(formatCost(data.currentCost), theme.accent)} \u2192 ${colorize(`~${formatCost(data.hourlyCost)}/h`, hourlyColor)}`;
  }
};

// scripts/utils/budget.ts
import { readFile as readFile8, mkdir as mkdir4, writeFile as writeFile4 } from "fs/promises";
import { join as join5 } from "path";
import { homedir as homedir4 } from "os";
var BUDGET_DIR = join5(homedir4(), ".cache", "claude-dashboard");
var BUDGET_FILE = join5(BUDGET_DIR, "budget.json");
var budgetCache = null;
var dirEnsured2 = false;
var pendingRecordDaily = null;
function getToday() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
async function loadBudgetState() {
  const today = getToday();
  if (budgetCache && budgetCache.date === today) {
    return budgetCache;
  }
  const fresh = { date: today, dailyTotal: 0, sessions: {} };
  try {
    const content = await readFile8(BUDGET_FILE, "utf-8");
    const state = JSON.parse(content);
    if (state.date !== today || !Number.isFinite(state.dailyTotal) || !state.sessions || typeof state.sessions !== "object") {
      return fresh;
    }
    budgetCache = state;
    return state;
  } catch {
    return fresh;
  }
}
async function saveBudgetState(state) {
  try {
    if (!dirEnsured2) {
      await mkdir4(BUDGET_DIR, { recursive: true });
      dirEnsured2 = true;
    }
    await writeFile4(BUDGET_FILE, JSON.stringify(state), "utf-8");
    budgetCache = state;
  } catch (error) {
    debugLog("budget", "Failed to save budget state", error);
  }
}
async function recordCostAndGetDaily(sessionId, sessionCost) {
  if (pendingRecordDaily)
    return pendingRecordDaily;
  pendingRecordDaily = recordCostAndGetDailyImpl(sessionId, sessionCost);
  try {
    return await pendingRecordDaily;
  } finally {
    pendingRecordDaily = null;
  }
}
async function recordCostAndGetDailyImpl(sessionId, sessionCost) {
  const state = await loadBudgetState();
  if (sessionCost <= 0 && !(sessionId in state.sessions)) {
    return state.dailyTotal;
  }
  const lastSeen = state.sessions[sessionId] ?? 0;
  const delta = Math.max(0, sessionCost - lastSeen);
  if (delta === 0)
    return state.dailyTotal;
  state.dailyTotal += delta;
  state.sessions[sessionId] = sessionCost;
  saveBudgetState(state).catch(() => {
  });
  return state.dailyTotal;
}

// scripts/widgets/budget.ts
var WARNING_THRESHOLD = 0.8;
var DANGER_THRESHOLD = 0.95;
var budgetWidget = {
  id: "budget",
  name: "Budget",
  async getData(ctx) {
    const { dailyBudget } = ctx.config;
    if (!dailyBudget || dailyBudget <= 0)
      return null;
    const sessionCost = ctx.stdin.cost?.total_cost_usd ?? 0;
    const sessionId = ctx.stdin.session_id || "default";
    const dailyTotal = await recordCostAndGetDaily(sessionId, sessionCost);
    return {
      dailyTotal,
      dailyBudget,
      utilization: Math.min(1, dailyTotal / dailyBudget)
    };
  },
  render(data, _ctx) {
    const theme = getTheme();
    const percent = Math.round(data.utilization * 100);
    let color;
    let icon;
    if (data.utilization >= DANGER_THRESHOLD) {
      color = theme.danger;
      icon = "\u{1F6A8}";
    } else if (data.utilization >= WARNING_THRESHOLD) {
      color = theme.warning;
      icon = "\u26A0\uFE0F";
    } else {
      color = theme.safe;
      icon = "\u{1F4B5}";
    }
    return `${icon} ${colorize(`${formatCost(data.dailyTotal)}`, color)} / ${colorize(formatCost(data.dailyBudget), theme.secondary)} ${colorize(`(${percent}%)`, color)}`;
  }
};

// scripts/widgets/version.ts
var versionWidget = {
  id: "version",
  name: "Version",
  async getData(ctx) {
    const version = ctx.stdin.version;
    if (!version)
      return null;
    return { version };
  },
  render(data, _ctx) {
    return colorize(`v${data.version}`, getTheme().dim);
  }
};

// scripts/widgets/lines-changed.ts
var DIFF_CACHE_TTL_MS = 1e4;
var diffCache = null;
var linesChangedWidget = {
  id: "linesChanged",
  name: "Lines Changed",
  async getData(ctx) {
    const cwd = ctx.stdin.workspace?.current_dir;
    if (!cwd)
      return null;
    if (diffCache?.cwd === cwd && Date.now() - diffCache.timestamp < DIFF_CACHE_TTL_MS) {
      return diffCache.data;
    }
    try {
      const [diffOutput, untracked] = await Promise.all([
        execGit(["diff", "HEAD", "--shortstat"], cwd, 1e3),
        countUntrackedLines(cwd, 1e3)
      ]);
      const insertMatch = diffOutput.match(/(\d+) insertion/);
      const deleteMatch = diffOutput.match(/(\d+) deletion/);
      const tracked = insertMatch ? parseInt(insertMatch[1], 10) : 0;
      const removed = deleteMatch ? parseInt(deleteMatch[1], 10) : 0;
      const added = tracked + untracked;
      const data = added === 0 && removed === 0 ? null : { added, removed, untracked };
      diffCache = { cwd, data, timestamp: Date.now() };
      return data;
    } catch {
      diffCache = { cwd, data: null, timestamp: Date.now() };
      return null;
    }
  },
  render(data, _ctx) {
    const theme = getTheme();
    const parts = [];
    if (data.added > 0)
      parts.push(colorize(`+${data.added}`, theme.safe));
    if (data.removed > 0)
      parts.push(colorize(`-${data.removed}`, theme.danger));
    return parts.join(" ");
  }
};

// scripts/widgets/output-style.ts
var outputStyleWidget = {
  id: "outputStyle",
  name: "Output Style",
  async getData(ctx) {
    const name = ctx.stdin.output_style?.name;
    if (!name || name === "default")
      return null;
    return { styleName: name };
  },
  render(data, _ctx) {
    return colorize(data.styleName, getTheme().dim);
  }
};

// scripts/widgets/token-speed.ts
var tokenSpeedWidget = {
  id: "tokenSpeed",
  name: "Token Speed",
  async getData(ctx) {
    const outputTokens = ctx.stdin.context_window?.total_output_tokens;
    const apiDurationMs = ctx.stdin.cost?.total_api_duration_ms;
    if (!outputTokens || !apiDurationMs || apiDurationMs <= 0)
      return null;
    const tokensPerSecond = outputTokens / (apiDurationMs / 1e3);
    if (!Number.isFinite(tokensPerSecond) || tokensPerSecond <= 0)
      return null;
    return { tokensPerSecond };
  },
  render(data, _ctx) {
    return colorize(`\u26A1 ${Math.round(data.tokensPerSecond)} tok/s`, getTheme().accent);
  }
};

// scripts/widgets/session-name.ts
var sessionNameWidget = {
  id: "sessionName",
  name: "Session Name",
  async getData(ctx) {
    if (ctx.stdin.session_name)
      return { name: ctx.stdin.session_name };
    const transcript = await getTranscript(ctx);
    if (!transcript?.sessionName)
      return null;
    return { name: transcript.sessionName };
  },
  render(data, _ctx) {
    return colorize(`\xBB ${truncate(data.name, 20)}`, getTheme().secondary);
  }
};

// scripts/widgets/today-cost.ts
var todayCostWidget = {
  id: "todayCost",
  name: "Today Cost",
  async getData(ctx) {
    const sessionCost = ctx.stdin.cost?.total_cost_usd ?? 0;
    const sessionId = ctx.stdin.session_id || "default";
    const dailyTotal = await recordCostAndGetDaily(sessionId, sessionCost);
    if (dailyTotal <= 0)
      return null;
    return { dailyTotal };
  },
  render(data, ctx) {
    const { translations: t } = ctx;
    return colorize(`\u{1F4B0} ${t.widgets.todayCost}: ${formatCost(data.dailyTotal)}`, getTheme().secondary);
  }
};

// scripts/utils/history-parser.ts
import { open as open3, stat as stat9 } from "fs/promises";
import { homedir as homedir5 } from "os";
var HISTORY_PATH = `${homedir5()}/.claude/history.jsonl`;
var CHUNK = 16 * 1024;
function resolvePastedText(display, pastedContents) {
  if (!pastedContents)
    return display;
  return display.replace(
    /\[Pasted text #(\d+)[^\]]*\]/g,
    (match, id) => pastedContents[id]?.content ?? match
  );
}
var historyCache = null;
async function getLastUserPrompt(sessionId) {
  try {
    const fileStat = await stat9(HISTORY_PATH);
    if (historyCache && historyCache.fileSize === fileStat.size) {
      const cached = historyCache.results.get(sessionId);
      if (cached !== void 0)
        return cached;
    }
    if (!historyCache || historyCache.fileSize !== fileStat.size) {
      historyCache = { fileSize: fileStat.size, results: /* @__PURE__ */ new Map() };
    }
    const size = Math.min(CHUNK, fileStat.size);
    const fd = await open3(HISTORY_PATH, "r");
    try {
      const buffer = Buffer.alloc(size);
      await fd.read(buffer, 0, size, fileStat.size - size);
      const lines = buffer.toString("utf-8").split("\n");
      for (let i = lines.length - 1; i >= 0; i--) {
        if (!lines[i])
          continue;
        try {
          const entry = JSON.parse(lines[i]);
          if (entry.sessionId === sessionId && entry.display?.trim() && entry.timestamp) {
            const text = resolvePastedText(entry.display, entry.pastedContents);
            const result = {
              text: text.replace(/\s+/g, " ").trim(),
              timestamp: entry.timestamp
            };
            historyCache.results.set(sessionId, result);
            return result;
          }
        } catch {
        }
      }
    } finally {
      await fd.close();
    }
    historyCache.results.set(sessionId, null);
  } catch {
  }
  return null;
}

// scripts/widgets/last-prompt.ts
var lastPromptWidget = {
  id: "lastPrompt",
  name: "Last Prompt",
  async getData(ctx) {
    const sessionId = ctx.stdin.session_id;
    if (!sessionId)
      return null;
    return getLastUserPrompt(sessionId);
  },
  render(data, _ctx) {
    const theme = getTheme();
    const timeStr = new Date(data.timestamp).toTimeString().slice(0, 5);
    return `\u{1F4AC} ${colorize(timeStr, theme.secondary)} ${truncate(data.text, 60)}`;
  }
};

// scripts/widgets/vim-mode.ts
var vimModeWidget = {
  id: "vimMode",
  name: "Vim Mode",
  async getData(ctx) {
    const mode = ctx.stdin.vim?.mode;
    if (!mode)
      return null;
    return { mode };
  },
  render(data, _ctx) {
    const theme = getTheme();
    const color = data.mode === "INSERT" ? theme.safe : theme.dim;
    return colorize(data.mode, color);
  }
};

// scripts/widgets/api-duration.ts
var apiDurationWidget = {
  id: "apiDuration",
  name: "API Duration",
  async getData(ctx) {
    const totalMs = ctx.stdin.cost?.total_duration_ms;
    const apiMs = ctx.stdin.cost?.total_api_duration_ms;
    if (!totalMs || !apiMs || totalMs <= 0)
      return null;
    const percentage = Math.round(apiMs / totalMs * 100);
    return { percentage: Math.min(percentage, 100) };
  },
  render(data, ctx) {
    const theme = getTheme();
    const color = data.percentage > 70 ? theme.warning : theme.dim;
    return colorize(`${ctx.translations.widgets.apiDuration} ${data.percentage}%`, color);
  }
};

// scripts/widgets/peak-hours.ts
var PEAK_START_HOUR = 5;
var PEAK_END_HOUR = 11;
var PACIFIC_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  hourCycle: "h23",
  hour: "numeric",
  minute: "numeric",
  weekday: "short"
});
function getPacificTime() {
  const parts = PACIFIC_FORMATTER.formatToParts(/* @__PURE__ */ new Date());
  const hour = parseInt(parts.find((p) => p.type === "hour").value, 10);
  const minute = parseInt(parts.find((p) => p.type === "minute").value, 10);
  const weekday = parts.find((p) => p.type === "weekday").value;
  const dayMap = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };
  return { hour, minute, dayOfWeek: dayMap[weekday] ?? 0 };
}
function isWeekday(dayOfWeek) {
  return dayOfWeek >= 1 && dayOfWeek <= 5;
}
function isPeakTime(pt) {
  return isWeekday(pt.dayOfWeek) && pt.hour >= PEAK_START_HOUR && pt.hour < PEAK_END_HOUR;
}
function getMinutesToTransition(pt) {
  const currentMinutes = pt.hour * 60 + pt.minute;
  if (isPeakTime(pt)) {
    return PEAK_END_HOUR * 60 - currentMinutes;
  }
  if (isWeekday(pt.dayOfWeek) && currentMinutes < PEAK_START_HOUR * 60) {
    return PEAK_START_HOUR * 60 - currentMinutes;
  }
  let daysUntilNextWeekday;
  if (pt.dayOfWeek === 5) {
    daysUntilNextWeekday = 3;
  } else if (pt.dayOfWeek === 6) {
    daysUntilNextWeekday = 2;
  } else if (pt.dayOfWeek === 0) {
    daysUntilNextWeekday = 1;
  } else {
    daysUntilNextWeekday = 1;
  }
  const minutesRemainingToday = 24 * 60 - currentMinutes;
  return minutesRemainingToday + (daysUntilNextWeekday - 1) * 24 * 60 + PEAK_START_HOUR * 60;
}
var peakHoursWidget = {
  id: "peakHours",
  name: "Peak Hours",
  async getData(_ctx) {
    const pt = getPacificTime();
    return {
      isPeak: isPeakTime(pt),
      minutesToTransition: getMinutesToTransition(pt)
    };
  },
  render(data, ctx) {
    const { translations: t } = ctx;
    const theme = getTheme();
    const transitionAt = new Date(Date.now() + data.minutesToTransition * 60 * 1e3);
    const countdown = formatTimeRemaining(transitionAt, t);
    if (data.isPeak) {
      const label2 = t.widgets.peakHours ?? "Peak";
      return `${colorize(label2, theme.danger)} (${countdown})`;
    }
    const label = t.widgets.offPeak ?? "Off-Peak";
    return `${colorize(label, theme.safe)} (${countdown})`;
  }
};

// scripts/widgets/index.ts
var widgetRegistry = /* @__PURE__ */ new Map([
  ["model", modelWidget],
  ["context", contextWidget],
  ["cost", costWidget],
  ["rateLimit5h", rateLimit5hWidget],
  ["rateLimit7d", rateLimit7dWidget],
  ["rateLimit7dSonnet", rateLimit7dSonnetWidget],
  ["projectInfo", projectInfoWidget],
  ["configCounts", configCountsWidget],
  ["sessionDuration", sessionDurationWidget],
  ["toolActivity", toolActivityWidget],
  ["agentStatus", agentStatusWidget],
  ["todoProgress", todoProgressWidget],
  ["burnRate", burnRateWidget],
  ["depletionTime", depletionTimeWidget],
  ["cacheHit", cacheHitWidget],
  ["codexUsage", codexUsageWidget],
  ["geminiUsage", geminiUsageWidget],
  ["geminiUsageAll", geminiUsageAllWidget],
  ["zaiUsage", zaiUsageWidget],
  ["sessionId", sessionIdWidget],
  ["sessionIdFull", sessionIdFullWidget],
  ["tokenBreakdown", tokenBreakdownWidget],
  ["performance", performanceWidget],
  ["forecast", forecastWidget],
  ["budget", budgetWidget],
  ["version", versionWidget],
  ["linesChanged", linesChangedWidget],
  ["outputStyle", outputStyleWidget],
  ["tokenSpeed", tokenSpeedWidget],
  ["sessionName", sessionNameWidget],
  ["todayCost", todayCostWidget],
  ["lastPrompt", lastPromptWidget],
  ["vimMode", vimModeWidget],
  ["apiDuration", apiDurationWidget],
  ["peakHours", peakHoursWidget]
]);
function getWidget(id) {
  return widgetRegistry.get(id);
}
function getLines(config) {
  const lines = config.displayMode === "custom" && config.lines ? config.lines : DISPLAY_PRESETS[config.displayMode] || DISPLAY_PRESETS.compact;
  const disabled = config.disabledWidgets;
  if (!disabled || disabled.length === 0) {
    return lines;
  }
  const disabledSet = new Set(disabled);
  return lines.map((line) => line.filter((id) => !disabledSet.has(id))).filter((line) => line.length > 0);
}
async function renderWidget(widgetId, ctx) {
  const widget = getWidget(widgetId);
  if (!widget) {
    return null;
  }
  try {
    const data = await widget.getData(ctx);
    if (!data) {
      return null;
    }
    const output = widget.render(data, ctx);
    return { id: widgetId, output };
  } catch (error) {
    debugLog("widget", `Widget '${widgetId}' failed`, error);
    return null;
  }
}
async function renderLine(widgetIds, ctx) {
  const results = await Promise.all(
    widgetIds.map((id) => renderWidget(id, ctx))
  );
  const separator = getSeparator();
  const outputs = results.filter((r) => r !== null && r.output.length > 0).map((r) => r.output);
  return outputs.join(separator);
}
async function renderAllLines(ctx) {
  const lines = getLines(ctx.config);
  const rendered = await Promise.all(lines.map((lineWidgets) => renderLine(lineWidgets, ctx)));
  return rendered.filter((line) => line.length > 0);
}
async function formatOutput(ctx) {
  const lines = await renderAllLines(ctx);
  return lines.join("\n");
}

// scripts/statusline.ts
var CONFIG_PATH = join6(homedir6(), ".claude", "claude-dashboard.local.json");
var configCache = null;
async function readStdin() {
  try {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.from(chunk));
    }
    const content = Buffer.concat(chunks).toString("utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}
async function loadConfig() {
  try {
    const fileStat = await stat10(CONFIG_PATH);
    const mtime = fileStat.mtimeMs;
    if (configCache?.mtime === mtime) {
      return configCache.config;
    }
    const content = await readFile9(CONFIG_PATH, "utf-8");
    const userConfig = JSON.parse(content);
    const config = {
      ...DEFAULT_CONFIG,
      ...userConfig
    };
    if (config.preset) {
      const lines = parsePreset(config.preset);
      if (lines.length > 0) {
        config.displayMode = "custom";
        config.lines = lines;
      }
    }
    configCache = { config, mtime };
    return config;
  } catch {
    return DEFAULT_CONFIG;
  }
}
function convertStdinLimit(window) {
  return {
    utilization: window.used_percentage,
    resets_at: new Date(window.resets_at * 1e3).toISOString()
  };
}
function parseStdinRateLimits(stdin) {
  const rl = stdin.rate_limits;
  if (!rl)
    return null;
  return {
    five_hour: rl.five_hour ? convertStdinLimit(rl.five_hour) : null,
    seven_day: rl.seven_day ? convertStdinLimit(rl.seven_day) : null,
    seven_day_sonnet: null
    // Not available in stdin
  };
}
async function main() {
  const config = await loadConfig();
  setTheme(config.theme);
  setSeparatorStyle(config.separator);
  const translations = getTranslations(config);
  const stdin = await readStdin();
  if (!stdin) {
    console.log(colorize("\u26A0\uFE0F", COLORS.yellow));
    return;
  }
  const stdinLimits = parseStdinRateLimits(stdin);
  let rateLimits;
  if (!stdinLimits) {
    rateLimits = await fetchUsageLimits(config.cache.ttlSeconds);
  } else if (config.plan === "max") {
    const apiLimits = await fetchUsageLimits(config.cache.ttlSeconds);
    rateLimits = { ...stdinLimits, seven_day_sonnet: apiLimits?.seven_day_sonnet ?? null };
  } else {
    rateLimits = stdinLimits;
  }
  const ctx = {
    stdin,
    config,
    translations,
    rateLimits
  };
  const output = await formatOutput(ctx);
  console.log(output);
}
main().catch(() => {
  console.log(colorize("\u26A0\uFE0F", COLORS.yellow));
});
