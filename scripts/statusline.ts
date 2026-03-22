#!/usr/bin/env node

/**
 * Claude Dashboard Status Line
 * Displays model info, context usage, rate limits, and more
 * @handbook 2.2-import-order
 * @handbook 4.6-config-caching
 * @handbook 6.1-hierarchical-defense
 */

import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

import type { StdinInput, Config, WidgetContext, UsageLimits } from './types.js';
import { DEFAULT_CONFIG, parsePreset } from './types.js';
import { COLORS, colorize, setTheme, setSeparatorStyle } from './utils/colors.js';
import { fetchUsageLimits } from './utils/api-client.js';
import { getTranslations } from './utils/i18n.js';
import { formatOutput } from './widgets/index.js';

const CONFIG_PATH = join(homedir(), '.claude', 'claude-dashboard.local.json');

/**
 * Cached config with mtime-based invalidation
 */
let configCache: {
  config: Config;
  mtime: number;
} | null = null;

/**
 * Read and parse stdin JSON
 */
async function readStdin(): Promise<StdinInput | null> {
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.from(chunk));
    }
    const content = Buffer.concat(chunks).toString('utf-8');
    return JSON.parse(content) as StdinInput;
  } catch {
    return null;
  }
}

/**
 * Load user configuration with mtime-based cache and migration support
 */
async function loadConfig(): Promise<Config> {
  try {
    // Check mtime for cache invalidation
    const fileStat = await stat(CONFIG_PATH);
    const mtime = fileStat.mtimeMs;

    // Return cached if mtime matches
    if (configCache?.mtime === mtime) {
      return configCache.config;
    }

    const content = await readFile(CONFIG_PATH, 'utf-8');
    const userConfig = JSON.parse(content);

    // Migrate old config format (add displayMode if missing)
    const config: Config = {
      ...DEFAULT_CONFIG,
      ...userConfig,
    };

    // Apply preset shorthand if configured
    if (config.preset) {
      const lines = parsePreset(config.preset);
      if (lines.length > 0) {
        config.displayMode = 'custom';
        config.lines = lines;
      }
    }

    // Cache result
    configCache = { config, mtime };
    return config;
  } catch {
    return DEFAULT_CONFIG;
  }
}

/**
 * Convert a single stdin rate limit window (epoch seconds) to UsageLimits field format (ISO string).
 */
function convertStdinLimit(window: { used_percentage: number; resets_at: number }) {
  return {
    utilization: window.used_percentage,
    resets_at: new Date(window.resets_at * 1000).toISOString(),
  };
}

/**
 * Convert stdin rate_limits (Unix epoch seconds) to UsageLimits format (ISO string).
 * Returns null when stdin doesn't provide rate_limits (before first API response or older Claude Code).
 */
function parseStdinRateLimits(stdin: StdinInput): UsageLimits | null {
  const rl = stdin.rate_limits;
  if (!rl) return null;

  return {
    five_hour: rl.five_hour ? convertStdinLimit(rl.five_hour) : null,
    seven_day: rl.seven_day ? convertStdinLimit(rl.seven_day) : null,
    seven_day_sonnet: null, // Not available in stdin
  };
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Load configuration
  const config = await loadConfig();

  // Initialize theme and separator
  setTheme(config.theme);
  setSeparatorStyle(config.separator);

  // Get translations
  const translations = getTranslations(config);

  // Read stdin
  const stdin = await readStdin();
  if (!stdin) {
    console.log(colorize('⚠️', COLORS.yellow));
    return;
  }

  // Build rate limits: prefer stdin, fallback to API
  const stdinLimits = parseStdinRateLimits(stdin);
  let rateLimits: UsageLimits | null;

  if (!stdinLimits) {
    // Stdin rate_limits not yet available — full API fallback
    rateLimits = await fetchUsageLimits(config.cache.ttlSeconds);
  } else if (config.plan === 'max') {
    // Hybrid: stdin for 5h/7d, API only for seven_day_sonnet
    const apiLimits = await fetchUsageLimits(config.cache.ttlSeconds);
    rateLimits = { ...stdinLimits, seven_day_sonnet: apiLimits?.seven_day_sonnet ?? null };
  } else {
    rateLimits = stdinLimits;
  }

  // Create widget context
  const ctx: WidgetContext = {
    stdin,
    config,
    translations,
    rateLimits,
  };

  // Format output using widget system
  const output = await formatOutput(ctx);

  console.log(output);
}

// Run
main().catch(() => {
  console.log(colorize('⚠️', COLORS.yellow));
});
