#!/usr/bin/env node

// scripts/statusline.ts
import { readFile as readFile7, stat as stat7 } from "fs/promises";
import { join as join4 } from "path";
import { homedir as homedir3 } from "os";

// scripts/types.ts
var DISPLAY_PRESETS = {
  compact: [
    ["model", "context", "cost", "rateLimit5h", "rateLimit7d", "rateLimit7dSonnet", "zaiUsage"]
  ],
  normal: [
    ["model", "context", "cost", "rateLimit5h", "rateLimit7d", "rateLimit7dSonnet", "zaiUsage"],
    ["projectInfo", "sessionDuration", "burnRate", "todoProgress"]
  ],
  detailed: [
    ["model", "context", "cost", "rateLimit5h", "rateLimit7d", "rateLimit7dSonnet", "zaiUsage"],
    ["projectInfo", "sessionDuration", "burnRate", "depletionTime", "todoProgress"],
    ["configCounts", "toolActivity", "agentStatus", "cacheHit"],
    ["codexUsage", "geminiUsage"]
  ]
};
var DEFAULT_CONFIG = {
  language: "auto",
  plan: "max",
  displayMode: "compact",
  cache: {
    ttlSeconds: 60
  }
};

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
var VERSION = "1.9.0";

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
function getTranslations(config) {
  let lang;
  if (config.language === "auto") {
    lang = detectSystemLanguage();
  } else {
    lang = config.language;
  }
  return LOCALES[lang] || LOCALES.en;
}

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
var modelWidget = {
  id: "model",
  name: "Model",
  async getData(ctx) {
    const { model } = ctx.stdin;
    return {
      id: model?.id || "",
      displayName: model?.display_name || "-"
    };
  },
  render(data) {
    const shortName = shortenModelName(data.displayName);
    const icon = isZaiProvider() ? "\u{1F7E0}" : "\u{1F916}";
    return `${COLORS.pastelCyan}${icon} ${shortName}${RESET}`;
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
    if (!usage) {
      return {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        contextSize,
        percentage: 0
      };
    }
    const inputTokens = usage.input_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens;
    const outputTokens = usage.output_tokens;
    const totalTokens = inputTokens + outputTokens;
    const percentage = calculatePercent(inputTokens, contextSize);
    return {
      inputTokens,
      outputTokens,
      totalTokens,
      contextSize,
      percentage
    };
  },
  render(data) {
    const parts = [];
    parts.push(renderProgressBar(data.percentage));
    const percentColor = getColorForPercent(data.percentage);
    parts.push(colorize(`${data.percentage}%`, percentColor));
    parts.push(
      `${formatTokens(data.inputTokens)}/${formatTokens(data.contextSize)}`
    );
    const separator = ` ${COLORS.dim}\u2502${RESET} `;
    return parts.join(separator);
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
    return colorize(formatCost(data.totalCostUsd), COLORS.pastelYellow);
  }
};

// scripts/widgets/rate-limit.ts
function renderRateLimit(data, ctx, labelKey) {
  if (data.isError) {
    return colorize("\u26A0\uFE0F", COLORS.yellow);
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
    if (ctx.config.plan !== "max")
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
import { execFileSync as execFileSync2 } from "child_process";
import { basename } from "path";
function getGitBranch(cwd) {
  try {
    const result = execFileSync2("git", ["--no-optional-locks", "rev-parse", "--abbrev-ref", "HEAD"], {
      cwd,
      encoding: "utf-8",
      timeout: 500,
      // 500ms timeout to prevent blocking
      stdio: ["pipe", "pipe", "pipe"]
    });
    return result.trim() || void 0;
  } catch {
    return void 0;
  }
}
function isGitDirty(cwd) {
  try {
    const result = execFileSync2("git", ["--no-optional-locks", "status", "--porcelain"], {
      cwd,
      encoding: "utf-8",
      timeout: 1e3,
      // 1s timeout
      stdio: ["pipe", "pipe", "pipe"]
    });
    return result.trim().length > 0;
  } catch {
    return false;
  }
}
var projectInfoWidget = {
  id: "projectInfo",
  name: "Project Info",
  async getData(ctx) {
    const currentDir = ctx.stdin.workspace?.current_dir;
    if (!currentDir) {
      return null;
    }
    const dirName = basename(currentDir);
    const branch = getGitBranch(currentDir);
    let gitBranch;
    if (branch) {
      const dirty = isGitDirty(currentDir);
      gitBranch = dirty ? `${branch}*` : branch;
    }
    return {
      dirName,
      gitBranch
    };
  },
  render(data) {
    const parts = [];
    parts.push(colorize(`\u{1F4C1} ${data.dirName}`, COLORS.pastelYellow));
    if (data.gitBranch) {
      parts.push(colorize(`(${data.gitBranch})`, COLORS.pastelPink));
    }
    return parts.join(" ");
  }
};

// scripts/widgets/config-counts.ts
import { readdir as readdir2, access } from "fs/promises";
import { join as join2 } from "path";
import { constants } from "fs";
var CONFIG_CACHE_TTL_MS = 3e4;
var configCountsCache = null;
async function pathExists(path4) {
  try {
    await access(path4, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
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
async function countClaudeMd(projectDir) {
  let count = 0;
  if (await pathExists(join2(projectDir, "CLAUDE.md"))) {
    count++;
  }
  if (await pathExists(join2(projectDir, ".claude", "CLAUDE.md"))) {
    count++;
  }
  return count;
}
async function countMcps(projectDir) {
  const { readFile: readFile8 } = await import("fs/promises");
  const homeDir = process.env.HOME || "";
  const mcpPaths = [
    { path: join2(projectDir, ".claude", "mcp.json"), key: "mcpServers" },
    { path: join2(homeDir, ".claude.json"), key: "mcpServers" },
    { path: join2(homeDir, ".config", "claude-code", "mcp.json"), key: "mcpServers" }
  ];
  let totalCount = 0;
  for (const { path: path4, key } of mcpPaths) {
    if (await pathExists(path4)) {
      try {
        const content = await readFile8(path4, "utf-8");
        const config = JSON.parse(content);
        totalCount += Object.keys(config[key] || {}).length;
      } catch {
      }
    }
  }
  return totalCount;
}
var configCountsWidget = {
  id: "configCounts",
  name: "Config Counts",
  async getData(ctx) {
    const currentDir = ctx.stdin.workspace?.current_dir;
    if (!currentDir) {
      return null;
    }
    if (configCountsCache?.projectDir === currentDir && Date.now() - configCountsCache.timestamp < CONFIG_CACHE_TTL_MS) {
      return configCountsCache.data;
    }
    const claudeDir = join2(currentDir, ".claude");
    const [claudeMd, rules, mcps, hooks] = await Promise.all([
      countClaudeMd(currentDir),
      countFiles(join2(claudeDir, "rules")),
      countMcps(currentDir),
      countFiles(join2(claudeDir, "hooks"))
    ]);
    const data = claudeMd === 0 && rules === 0 && mcps === 0 && hooks === 0 ? null : { claudeMd, rules, mcps, hooks };
    configCountsCache = { projectDir: currentDir, data, timestamp: Date.now() };
    return data;
  },
  render(data, ctx) {
    const { translations: t } = ctx;
    const parts = [];
    if (data.claudeMd > 0) {
      parts.push(`${t.widgets.claudeMd}: ${data.claudeMd}`);
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
    return colorize(parts.join(", "), COLORS.dim);
  }
};

// scripts/utils/session.ts
import { readFile as readFile3, mkdir as mkdir2, open, readdir as readdir3, unlink as unlink2, stat as stat3 } from "fs/promises";
import { join as join3 } from "path";
import { homedir as homedir2 } from "os";
var SESSION_DIR = join3(homedir2(), ".cache", "claude-dashboard", "sessions");
var SESSION_MAX_AGE_SECONDS = 86400;
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
  const sessionFile = join3(SESSION_DIR, `${safeSessionId}.json`);
  try {
    const content = await readFile3(sessionFile, "utf-8");
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
          const content = await readFile3(sessionFile, "utf-8");
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
        const filePath = join3(SESSION_DIR, file);
        const fileStat = await stat3(filePath);
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
    const sessionId = ctx.stdin.session_id || "default";
    const elapsedMs = await getSessionElapsedMs(sessionId);
    return { elapsedMs };
  },
  render(data, ctx) {
    const { translations: t } = ctx;
    const duration = formatDuration(data.elapsedMs, t.time);
    return colorize(`\u23F1 ${duration}`, COLORS.dim);
  }
};

// scripts/utils/transcript-parser.ts
import { readFile as readFile4, stat as stat4 } from "fs/promises";
var cachedTranscript = null;
function parseJsonlLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}
async function parseTranscript(transcriptPath) {
  try {
    const fileStat = await stat4(transcriptPath);
    const mtime = fileStat.mtimeMs;
    if (cachedTranscript?.path === transcriptPath && cachedTranscript.mtime === mtime) {
      return cachedTranscript.data;
    }
    const content = await readFile4(transcriptPath, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    const entries = [];
    for (const line of lines) {
      const entry = parseJsonlLine(line);
      if (entry) {
        entries.push(entry);
      }
    }
    const toolUses = /* @__PURE__ */ new Map();
    const toolResults = /* @__PURE__ */ new Set();
    let sessionStartTime;
    for (const entry of entries) {
      if (!sessionStartTime && entry.timestamp) {
        sessionStartTime = new Date(entry.timestamp).getTime();
      }
      if (entry.type === "assistant" && entry.message?.content) {
        for (const block of entry.message.content) {
          if (block.type === "tool_use" && block.id && block.name) {
            toolUses.set(block.id, {
              name: block.name,
              timestamp: entry.timestamp
            });
          }
        }
      }
      if (entry.type === "user" && entry.message?.content) {
        for (const block of entry.message.content) {
          if (block.type === "tool_result" && block.tool_use_id) {
            toolResults.add(block.tool_use_id);
          }
        }
      }
    }
    const data = {
      entries,
      toolUses,
      toolResults,
      sessionStartTime
    };
    cachedTranscript = { path: transcriptPath, mtime, data };
    return data;
  } catch {
    return null;
  }
}
function getRunningTools(transcript) {
  const running = [];
  for (const [id, tool] of transcript.toolUses) {
    if (!transcript.toolResults.has(id)) {
      running.push({
        name: tool.name,
        startTime: tool.timestamp ? new Date(tool.timestamp).getTime() : Date.now()
      });
    }
  }
  return running;
}
function getCompletedToolCount(transcript) {
  return transcript.toolResults.size;
}
function extractTodoProgress(transcript) {
  let lastTodoWrite = null;
  for (const [id, tool] of transcript.toolUses) {
    if (tool.name === "TodoWrite" && transcript.toolResults.has(id)) {
      for (const entry of transcript.entries) {
        if (entry.type === "assistant" && entry.message?.content) {
          for (const block of entry.message.content) {
            if (block.type === "tool_use" && block.id === id && block.input) {
              lastTodoWrite = block.input;
            }
          }
        }
      }
    }
  }
  if (!lastTodoWrite || typeof lastTodoWrite !== "object") {
    return null;
  }
  const input = lastTodoWrite;
  if (!Array.isArray(input.todos)) {
    return null;
  }
  const todos = input.todos;
  const completed = todos.filter((t) => t.status === "completed").length;
  const total = todos.length;
  const current = todos.find(
    (t) => t.status === "in_progress" || t.status === "pending"
  );
  return {
    current: current ? {
      content: current.content,
      status: current.status
    } : void 0,
    completed,
    total
  };
}
function extractAgentStatus(transcript) {
  const active = [];
  let completed = 0;
  for (const [id, tool] of transcript.toolUses) {
    if (tool.name === "Task") {
      if (transcript.toolResults.has(id)) {
        completed++;
      } else {
        for (const entry of transcript.entries) {
          if (entry.type === "assistant" && entry.message?.content) {
            for (const block of entry.message.content) {
              if (block.type === "tool_use" && block.id === id && block.input) {
                const input = block.input;
                active.push({
                  name: input.subagent_type || "Agent",
                  description: input.description
                });
              }
            }
          }
        }
      }
    }
  }
  return { active, completed };
}

// scripts/widgets/tool-activity.ts
var toolActivityWidget = {
  id: "toolActivity",
  name: "Tool Activity",
  async getData(ctx) {
    const transcriptPath = ctx.stdin.transcript_path;
    if (!transcriptPath) {
      return null;
    }
    const transcript = await parseTranscript(transcriptPath);
    if (!transcript) {
      return null;
    }
    const running = getRunningTools(transcript);
    const completed = getCompletedToolCount(transcript);
    return { running, completed };
  },
  render(data, ctx) {
    const { translations: t } = ctx;
    if (data.running.length === 0) {
      return colorize(
        `${t.widgets.tools}: ${data.completed} ${t.widgets.done}`,
        COLORS.dim
      );
    }
    const runningNames = data.running.slice(0, 2).map((r) => r.name).join(", ");
    const more = data.running.length > 2 ? ` +${data.running.length - 2}` : "";
    return `${colorize("\u2699\uFE0F", COLORS.yellow)} ${runningNames}${more} (${data.completed} ${t.widgets.done})`;
  }
};

// scripts/widgets/agent-status.ts
var agentStatusWidget = {
  id: "agentStatus",
  name: "Agent Status",
  async getData(ctx) {
    const transcriptPath = ctx.stdin.transcript_path;
    if (!transcriptPath) {
      return null;
    }
    const transcript = await parseTranscript(transcriptPath);
    if (!transcript) {
      return null;
    }
    const status = extractAgentStatus(transcript);
    if (status.active.length === 0 && status.completed === 0) {
      return null;
    }
    return status;
  },
  render(data, ctx) {
    const { translations: t } = ctx;
    if (data.active.length === 0) {
      return colorize(
        `${t.widgets.agent}: ${data.completed} ${t.widgets.done}`,
        COLORS.dim
      );
    }
    const activeAgent = data.active[0];
    const agentText = activeAgent.description ? `${activeAgent.name}: ${activeAgent.description.slice(0, 20)}${activeAgent.description.length > 20 ? "..." : ""}` : activeAgent.name;
    const more = data.active.length > 1 ? ` +${data.active.length - 1}` : "";
    return `${colorize("\u{1F916}", COLORS.cyan)} ${t.widgets.agent}: ${agentText}${more}`;
  }
};

// scripts/widgets/todo-progress.ts
var todoProgressWidget = {
  id: "todoProgress",
  name: "Todo Progress",
  async getData(ctx) {
    const transcriptPath = ctx.stdin.transcript_path;
    if (!transcriptPath) {
      return null;
    }
    const transcript = await parseTranscript(transcriptPath);
    if (!transcript) {
      return null;
    }
    const progress = extractTodoProgress(transcript);
    return progress || { total: 0, completed: 0, current: null };
  },
  render(data, ctx) {
    const { translations: t } = ctx;
    if (data.total === 0) {
      return colorize(`${t.widgets.todos}: -`, COLORS.dim);
    }
    const percent = calculatePercent(data.completed, data.total);
    const color = getColorForPercent(100 - percent);
    if (data.current) {
      const taskName = data.current.content.length > 15 ? data.current.content.slice(0, 15) + "..." : data.current.content;
      return `${colorize("\u2713", COLORS.pastelGreen)} ${taskName} [${data.completed}/${data.total}]`;
    }
    return colorize(
      `${t.widgets.todos}: ${data.completed}/${data.total}`,
      data.completed === data.total ? COLORS.pastelGreen : color
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
  render(data) {
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
    const duration = formatDuration(data.minutesToLimit * 60 * 1e3, ctx.translations.time);
    return colorize(`\u23F3 ~${duration} to ${data.limitType}`, COLORS.yellow);
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
import { readFile as readFile5, stat as stat5, writeFile as writeFile2, mkdir as mkdir3 } from "fs/promises";
import { execFileSync as execFileSync3 } from "child_process";
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
    await stat5(CODEX_AUTH_PATH);
    return true;
  } catch {
    return false;
  }
}
async function getCodexAuth() {
  try {
    const fileStat = await stat5(CODEX_AUTH_PATH);
    if (cachedAuth && cachedAuth.mtime === fileStat.mtimeMs) {
      return cachedAuth.data;
    }
    const raw = await readFile5(CODEX_AUTH_PATH, "utf-8");
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
    const raw = await readFile5(CODEX_CONFIG_PATH, "utf-8");
    const match = raw.match(/^model\s*=\s*["']([^"']+)["']\s*(?:#.*)?$/m);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
async function getConfigMtime() {
  try {
    const fileStat = await stat5(CODEX_CONFIG_PATH);
    return fileStat.mtimeMs;
  } catch {
    return 0;
  }
}
async function getCachedModel(currentMtime) {
  try {
    const raw = await readFile5(MODEL_CACHE_PATH, "utf-8");
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
function detectModelFromCodexExec() {
  try {
    debugLog("codex", "detectModelFromCodexExec: running codex exec...");
    const output = execFileSync3("codex", ["exec", "1+1="], {
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
  const pending = pendingRequests3.get(tokenHash);
  if (pending) {
    return pending;
  }
  const requestPromise = fetchFromCodexApi(auth);
  pendingRequests3.set(tokenHash, requestPromise);
  try {
    return await requestPromise;
  } finally {
    pendingRequests3.delete(tokenHash);
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

// scripts/widgets/codex-usage.ts
function formatRateLimit(label, percent, resetAt, t) {
  const color = getColorForPercent(percent);
  let result = `${label}: ${colorize(`${Math.round(percent)}%`, color)}`;
  if (resetAt) {
    const resetTime = formatTimeRemaining(new Date(resetAt * 1e3), t);
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
    const parts = [];
    parts.push(`${colorize("\u{1F537}", COLORS.blue)} ${data.model}`);
    if (data.isError) {
      parts.push(colorize("\u26A0\uFE0F", COLORS.yellow));
    } else {
      if (data.primaryPercent !== null) {
        parts.push(formatRateLimit(t.labels["5h"], data.primaryPercent, data.primaryResetAt, t));
      }
      if (data.secondaryPercent !== null) {
        parts.push(formatRateLimit(t.labels["7d"], data.secondaryPercent, data.secondaryResetAt, t));
      }
    }
    return parts.join(` ${colorize("\u2502", COLORS.dim)} `);
  }
};

// scripts/utils/gemini-client.ts
import { readFile as readFile6, writeFile as writeFile3, stat as stat6 } from "fs/promises";
import { execFileSync as execFileSync4 } from "child_process";
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
    await stat6(oauthPath);
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
    const result = execFileSync4(
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
    const fileStat = await stat6(oauthPath);
    if (cachedCredentials && cachedCredentials.mtime === fileStat.mtimeMs) {
      return cachedCredentials.data;
    }
    const raw = await readFile6(oauthPath, "utf-8");
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
      const raw = await readFile6(oauthPath, "utf-8");
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
    const fileStat = await stat6(settingsPath);
    if (cachedSettings && cachedSettings.mtime === fileStat.mtimeMs) {
      return cachedSettings.data;
    }
    const raw = await readFile6(settingsPath, "utf-8");
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
  const pending = pendingRequests4.get(tokenHash);
  if (pending) {
    return pending;
  }
  const requestPromise = fetchFromGeminiApi(credentials, projectId);
  pendingRequests4.set(tokenHash, requestPromise);
  try {
    return await requestPromise;
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
function formatUsage(percent, resetAt, t) {
  const color = getColorForPercent(percent);
  let result = colorize(`${Math.round(percent)}%`, color);
  if (resetAt) {
    const resetTime = formatTimeRemaining(new Date(resetAt), t);
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
    const { translations: t } = ctx;
    const parts = [];
    parts.push(`${colorize("\u{1F48E}", COLORS.cyan)} ${data.model}`);
    if (data.isError) {
      parts.push(colorize("\u26A0\uFE0F", COLORS.yellow));
    } else if (data.usedPercent !== null) {
      parts.push(formatUsage(data.usedPercent, data.resetAt, t));
    }
    return parts.join(` ${colorize("\u2502", COLORS.dim)} `);
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
    const { translations: t } = ctx;
    if (data.isError) {
      return `${colorize("\u{1F48E}", COLORS.cyan)} Gemini ${colorize("\u26A0\uFE0F", COLORS.yellow)}`;
    }
    if (data.buckets.length === 0) {
      return `${colorize("\u{1F48E}", COLORS.cyan)} Gemini ${colorize("--", COLORS.dim)}`;
    }
    const parts = data.buckets.map((bucket) => {
      const modelShort = bucket.modelId.replace("gemini-", "");
      if (bucket.usedPercent !== null) {
        return `${colorize(modelShort, COLORS.dim)}: ${formatUsage(bucket.usedPercent, bucket.resetAt, t)}`;
      }
      return `${colorize(modelShort, COLORS.dim)}: ${colorize("--", COLORS.dim)}`;
    });
    return `${colorize("\u{1F48E}", COLORS.cyan)} ${parts.join(" \u2502 ")}`;
  }
};

// scripts/utils/zai-api-client.ts
var API_TIMEOUT_MS4 = 5e3;
function clampPercent(value) {
  return Math.min(100, Math.max(0, Math.round(value)));
}
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
    if (ageSeconds < ttlSeconds) {
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
    }
    return result;
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
function formatResetTime(resetAtMs, t) {
  const now = Date.now();
  const diffMs = resetAtMs - now;
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
    const parts = [];
    parts.push(`\u{1F7E0} ${data.model}`);
    if (data.isError) {
      parts.push(colorize("\u26A0\uFE0F", COLORS.yellow));
    } else {
      if (data.tokensPercent !== null) {
        let tokenPart = `${t.labels["5h"]}: ${formatPercent(data.tokensPercent)}`;
        if (data.tokensResetAt) {
          tokenPart += ` (${formatResetTime(data.tokensResetAt, t)})`;
        }
        parts.push(tokenPart);
      }
      if (data.mcpPercent !== null) {
        let mcpPart = `${t.labels["1m"]}: ${formatPercent(data.mcpPercent)}`;
        if (data.mcpResetAt) {
          mcpPart += ` (${formatResetTime(data.mcpResetAt, t)})`;
        }
        parts.push(mcpPart);
      }
    }
    return parts.join(` ${colorize("\u2502", COLORS.dim)} `);
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
  ["zaiUsage", zaiUsageWidget]
]);
function getWidget(id) {
  return widgetRegistry.get(id);
}
function getLines(config) {
  if (config.displayMode === "custom" && config.lines) {
    return config.lines;
  }
  return DISPLAY_PRESETS[config.displayMode] || DISPLAY_PRESETS.compact;
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
  const separator = ` ${COLORS.dim}\u2502${RESET} `;
  const outputs = results.filter((r) => r !== null && r.output.length > 0).map((r) => r.output);
  return outputs.join(separator);
}
async function renderAllLines(ctx) {
  const lines = getLines(ctx.config);
  const renderedLines = [];
  for (const lineWidgets of lines) {
    const rendered = await renderLine(lineWidgets, ctx);
    if (rendered.length > 0) {
      renderedLines.push(rendered);
    }
  }
  return renderedLines;
}
async function formatOutput(ctx) {
  const lines = await renderAllLines(ctx);
  return lines.join("\n");
}

// scripts/statusline.ts
var CONFIG_PATH = join4(homedir3(), ".claude", "claude-dashboard.local.json");
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
    const fileStat = await stat7(CONFIG_PATH);
    const mtime = fileStat.mtimeMs;
    if (configCache?.mtime === mtime) {
      return configCache.config;
    }
    const content = await readFile7(CONFIG_PATH, "utf-8");
    const userConfig = JSON.parse(content);
    const config = {
      ...DEFAULT_CONFIG,
      ...userConfig
    };
    if (!config.displayMode) {
      config.displayMode = "compact";
    }
    configCache = { config, mtime };
    return config;
  } catch {
    return DEFAULT_CONFIG;
  }
}
async function main() {
  const config = await loadConfig();
  const translations = getTranslations(config);
  const stdin = await readStdin();
  if (!stdin) {
    console.log(colorize("\u26A0\uFE0F", COLORS.yellow));
    return;
  }
  const rateLimits = await fetchUsageLimits(config.cache.ttlSeconds);
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
