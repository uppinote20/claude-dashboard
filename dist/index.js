#!/usr/bin/env node

// scripts/statusline.ts
import { readFile as readFile2 } from "fs/promises";
import { join as join2 } from "path";
import { homedir as homedir2 } from "os";

// scripts/types.ts
var DEFAULT_CONFIG = {
  language: "auto",
  plan: "max",
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
  // Foreground colors
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
  brightCyan: "\x1B[96m"
};
var RESET = COLORS.reset;
function getColorForPercent(percent) {
  if (percent <= 50)
    return COLORS.green;
  if (percent <= 80)
    return COLORS.yellow;
  return COLORS.red;
}
function colorize(text, color) {
  return `${color}${text}${RESET}`;
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
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
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

// scripts/utils/api-client.ts
import fs from "fs";
import os from "os";
import path from "path";

// scripts/utils/credentials.ts
import { execFileSync } from "child_process";
import { readFile } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
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
  try {
    const result = execFileSync(
      "security",
      ["find-generic-password", "-s", "Claude Code-credentials", "-w"],
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    ).trim();
    const creds = JSON.parse(result);
    return creds?.claudeAiOauth?.accessToken ?? null;
  } catch {
    return await getCredentialsFromFile();
  }
}
async function getCredentialsFromFile() {
  try {
    const credPath = join(homedir(), ".claude", ".credentials.json");
    const content = await readFile(credPath, "utf-8");
    const creds = JSON.parse(content);
    return creds?.claudeAiOauth?.accessToken ?? null;
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
var VERSION = true ? "1.1.0" : "dev";

// scripts/utils/api-client.ts
var API_TIMEOUT_MS = 5e3;
var CACHE_DIR = path.join(os.homedir(), ".cache", "claude-dashboard");
var usageCacheMap = /* @__PURE__ */ new Map();
var pendingRequests = /* @__PURE__ */ new Map();
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true, mode: 448 });
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
    return null;
  }
  const tokenHash = hashToken(token);
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
    if (!fs.existsSync(cacheFile))
      return null;
    const content = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
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
    ensureCacheDir();
    const cacheFile = getCacheFilePath(tokenHash);
    fs.writeFileSync(
      cacheFile,
      JSON.stringify({
        data,
        timestamp: Date.now()
      })
    );
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
    "7d_sonnet": "7d-S"
  },
  time: {
    hours: "h",
    minutes: "m"
  },
  errors: {
    no_context: "No context yet"
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
    "7d_sonnet": "7\uC77C-S"
  },
  time: {
    hours: "\uC2DC\uAC04",
    minutes: "\uBD84"
  },
  errors: {
    no_context: "\uCEE8\uD14D\uC2A4\uD2B8 \uC5C6\uC74C"
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

// scripts/statusline.ts
var CONFIG_PATH = join2(homedir2(), ".claude", "claude-dashboard.local.json");
var SEPARATOR = ` ${COLORS.dim}\u2502${RESET} `;
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
    const content = await readFile2(CONFIG_PATH, "utf-8");
    const userConfig = JSON.parse(content);
    return { ...DEFAULT_CONFIG, ...userConfig };
  } catch {
    return DEFAULT_CONFIG;
  }
}
function buildContextSection(input, t) {
  const parts = [];
  const modelName = shortenModelName(input.model.display_name);
  parts.push(`${COLORS.cyan}\u{1F916} ${modelName}${RESET}`);
  const usage = input.context_window.current_usage;
  if (!usage) {
    parts.push(colorize(t.errors.no_context, COLORS.dim));
    return parts.join(SEPARATOR);
  }
  const currentTokens = usage.input_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens;
  const totalTokens = input.context_window.context_window_size;
  const percent = calculatePercent(currentTokens, totalTokens);
  parts.push(renderProgressBar(percent));
  const percentColor = getColorForPercent(percent);
  parts.push(colorize(`${percent}%`, percentColor));
  parts.push(`${formatTokens(currentTokens)}/${formatTokens(totalTokens)}`);
  parts.push(colorize(formatCost(input.cost.total_cost_usd), COLORS.yellow));
  return parts.join(SEPARATOR);
}
function buildRateLimitsSection(limits, config, t) {
  if (!limits) {
    return colorize("\u26A0\uFE0F", COLORS.yellow);
  }
  const parts = [];
  if (limits.five_hour) {
    const pct = Math.round(limits.five_hour.utilization);
    const color = getColorForPercent(pct);
    let text = `${t.labels["5h"]}: ${colorize(`${pct}%`, color)}`;
    if (limits.five_hour.resets_at) {
      const remaining = formatTimeRemaining(limits.five_hour.resets_at, t);
      text += ` (${remaining})`;
    }
    parts.push(text);
  }
  if (config.plan === "max") {
    if (limits.seven_day) {
      const pct = Math.round(limits.seven_day.utilization);
      const color = getColorForPercent(pct);
      parts.push(`${t.labels["7d_all"]}: ${colorize(`${pct}%`, color)}`);
    }
    if (limits.seven_day_sonnet) {
      const pct = Math.round(limits.seven_day_sonnet.utilization);
      const color = getColorForPercent(pct);
      parts.push(`${t.labels["7d_sonnet"]}: ${colorize(`${pct}%`, color)}`);
    }
  }
  return parts.join(SEPARATOR);
}
async function main() {
  const config = await loadConfig();
  const t = getTranslations(config);
  const input = await readStdin();
  if (!input) {
    console.log(colorize("\u26A0\uFE0F", COLORS.yellow));
    return;
  }
  const contextSection = buildContextSection(input, t);
  const limits = await fetchUsageLimits(config.cache.ttlSeconds);
  const rateLimitsSection = buildRateLimitsSection(limits, config, t);
  const output = [contextSection, rateLimitsSection].filter(Boolean).join(SEPARATOR);
  console.log(output);
}
main().catch(() => {
  console.log(colorize("\u26A0\uFE0F", COLORS.yellow));
});
