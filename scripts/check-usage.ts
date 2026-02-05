#!/usr/bin/env node
/**
 * CLI Usage Dashboard
 * Displays usage limits for all AI CLIs (Claude, Codex, Gemini, z.ai)
 * and recommends the one with the most available capacity.
 */

import { fetchUsageLimits } from './utils/api-client.js';
import { fetchCodexUsage, isCodexInstalled } from './utils/codex-client.js';
import { fetchGeminiUsage, isGeminiInstalled } from './utils/gemini-client.js';
import { fetchZaiUsage, isZaiInstalled, type ZaiUsageLimits } from './utils/zai-api-client.js';
import { isZaiProvider } from './utils/provider.js';
import { formatTimeRemaining } from './utils/formatters.js';
import { getColorForPercent, colorize, COLORS } from './utils/colors.js';
import { getTranslationsByLang, detectSystemLanguage } from './utils/i18n.js';
import type {
  UsageLimits,
  CodexUsageLimits,
  GeminiUsageLimits,
  Translations,
  CLIUsageInfo,
  BucketUsageInfo,
  CheckUsageOutput,
} from './types.js';

const BOX_WIDTH = 40;
const CHECK_USAGE_TTL_SECONDS = 60;

/**
 * Normalize date string to consistent ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)
 */
export function normalizeToISO(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Format time remaining from Unix timestamp in seconds (Codex style)
 */
function formatTimeFromTimestamp(resetAt: number, t: Translations): string {
  const resetDate = new Date(resetAt * 1000);
  return formatTimeRemaining(resetDate, t);
}

/**
 * Render horizontal line
 */
function renderLine(char: string = '═'): string {
  return char.repeat(BOX_WIDTH);
}

/**
 * Render centered title
 */
function renderTitle(title: string): string {
  const padding = Math.max(0, Math.floor((BOX_WIDTH - title.length) / 2));
  return ' '.repeat(padding) + colorize(title, COLORS.bold);
}

/**
 * Render a CLI section
 */
function renderClaudeSection(
  name: string,
  usage: CLIUsageInfo,
  t: Translations
): string[] {
  const lines: string[] = [];
  const label = colorize(`[${name}]`, COLORS.pastelCyan);

  if (!usage.available) {
    lines.push(`${label} ${colorize(`(${t.checkUsage.notInstalled})`, COLORS.gray)}`);
    return lines;
  }

  if (usage.error) {
    lines.push(`${label} ${colorize(`⚠️ ${t.checkUsage.errorFetching}`, COLORS.pastelYellow)}`);
    return lines;
  }

  const parts: string[] = [];

  // 5h usage
  if (usage.fiveHourPercent !== null) {
    const color5h = getColorForPercent(usage.fiveHourPercent);
    const reset5h = usage.fiveHourReset
      ? ` (${formatTimeRemaining(usage.fiveHourReset, t)})`
      : '';
    parts.push(`${t.labels['5h']}: ${colorize(`${usage.fiveHourPercent}%`, color5h)}${reset5h}`);
  }

  // 7d usage
  if (usage.sevenDayPercent !== null) {
    const color7d = getColorForPercent(usage.sevenDayPercent);
    const reset7d = usage.sevenDayReset
      ? ` (${formatTimeRemaining(usage.sevenDayReset, t)})`
      : '';
    parts.push(`${t.labels['7d']}: ${colorize(`${usage.sevenDayPercent}%`, color7d)}${reset7d}`);
  }

  // Plan info (for Codex)
  if (usage.plan) {
    parts.push(`Plan: ${colorize(usage.plan, COLORS.pastelGray)}`);
  }

  // Model info (for Gemini)
  if (usage.model && name === 'Gemini') {
    parts.push(`Model: ${colorize(usage.model, COLORS.pastelGray)}`);
  }

  lines.push(`${label}`);
  if (parts.length > 0) {
    lines.push(`  ${parts.join('  |  ')}`);
  }

  return lines;
}

/**
 * Render Codex-specific section with timestamp-based reset
 */
function renderCodexSection(
  usage: CLIUsageInfo,
  codexData: CodexUsageLimits | null,
  t: Translations
): string[] {
  const lines: string[] = [];
  const label = colorize('[Codex]', COLORS.pastelCyan);

  if (!usage.available) {
    lines.push(`${label} ${colorize(`(${t.checkUsage.notInstalled})`, COLORS.gray)}`);
    return lines;
  }

  if (usage.error || !codexData) {
    lines.push(`${label} ${colorize(`⚠️ ${t.checkUsage.errorFetching}`, COLORS.pastelYellow)}`);
    return lines;
  }

  const parts: string[] = [];

  // 5h usage (primary window)
  if (codexData.primary) {
    const percent = Math.round(codexData.primary.usedPercent);
    const color5h = getColorForPercent(percent);
    const reset5h = formatTimeFromTimestamp(codexData.primary.resetAt, t);
    parts.push(`${t.labels['5h']}: ${colorize(`${percent}%`, color5h)} (${reset5h})`);
  }

  // 7d usage (secondary window)
  if (codexData.secondary) {
    const percent = Math.round(codexData.secondary.usedPercent);
    const color7d = getColorForPercent(percent);
    const reset7d = formatTimeFromTimestamp(codexData.secondary.resetAt, t);
    parts.push(`${t.labels['7d']}: ${colorize(`${percent}%`, color7d)} (${reset7d})`);
  }

  // Plan info
  if (codexData.planType) {
    parts.push(`Plan: ${colorize(codexData.planType, COLORS.pastelGray)}`);
  }

  lines.push(`${label}`);
  if (parts.length > 0) {
    lines.push(`  ${parts.join('  |  ')}`);
  }

  return lines;
}

/**
 * Render Gemini-specific section with all model buckets
 */
function renderGeminiSection(
  usage: CLIUsageInfo,
  geminiData: GeminiUsageLimits | null,
  t: Translations
): string[] {
  const lines: string[] = [];
  const label = colorize('[Gemini]', COLORS.pastelCyan);

  if (!usage.available) {
    lines.push(`${label} ${colorize(`(${t.checkUsage.notInstalled})`, COLORS.gray)}`);
    return lines;
  }

  if (usage.error || !geminiData) {
    lines.push(`${label} ${colorize(`⚠️ ${t.checkUsage.errorFetching}`, COLORS.pastelYellow)}`);
    return lines;
  }

  lines.push(`${label}`);

  // Show all model buckets
  if (geminiData.buckets && geminiData.buckets.length > 0) {
    // Find max model name length for alignment
    const maxModelLen = Math.max(...geminiData.buckets.map(b => (b.modelId || 'unknown').length));

    for (const bucket of geminiData.buckets) {
      const modelName = bucket.modelId || 'unknown';
      const paddedModel = modelName.padEnd(maxModelLen);

      if (bucket.usedPercent !== null) {
        const color = getColorForPercent(bucket.usedPercent);
        const reset = bucket.resetAt
          ? ` (${formatTimeRemaining(bucket.resetAt, t)})`
          : '';
        lines.push(`  ${colorize(paddedModel, COLORS.pastelGray)}  ${colorize(`${bucket.usedPercent}%`, color)}${reset}`);
      } else {
        lines.push(`  ${colorize(paddedModel, COLORS.pastelGray)}  ${colorize('--', COLORS.gray)}`);
      }
    }
  } else {
    // Fallback to single usage display
    if (geminiData.usedPercent !== null) {
      const color = getColorForPercent(geminiData.usedPercent);
      const reset = geminiData.resetAt
        ? ` (${formatTimeRemaining(geminiData.resetAt, t)})`
        : '';
      const modelInfo = geminiData.model ? `${geminiData.model}: ` : '';
      lines.push(`  ${modelInfo}${colorize(`${geminiData.usedPercent}%`, color)}${reset}`);
    }
  }

  return lines;
}

/**
 * Render z.ai-specific section
 */
function renderZaiSection(
  usage: CLIUsageInfo,
  zaiData: ZaiUsageLimits | null,
  t: Translations
): string[] {
  const lines: string[] = [];
  const label = colorize('[z.ai]', COLORS.pastelCyan);

  if (!usage.available) {
    lines.push(`${label} ${colorize(`(${t.checkUsage.notInstalled})`, COLORS.gray)}`);
    return lines;
  }

  if (usage.error || !zaiData) {
    lines.push(`${label} ${colorize(`⚠️ ${t.checkUsage.errorFetching}`, COLORS.pastelYellow)}`);
    return lines;
  }

  const parts: string[] = [];

  // Token usage (5h equivalent)
  if (zaiData.tokensPercent !== null) {
    const color = getColorForPercent(zaiData.tokensPercent);
    const reset = zaiData.tokensResetAt
      ? ` (${formatTimeRemaining(new Date(zaiData.tokensResetAt), t)})`
      : '';
    parts.push(`Tokens: ${colorize(`${zaiData.tokensPercent}%`, color)}${reset}`);
  }

  // MCP usage (monthly)
  if (zaiData.mcpPercent !== null) {
    const color = getColorForPercent(zaiData.mcpPercent);
    const reset = zaiData.mcpResetAt
      ? ` (${formatTimeRemaining(new Date(zaiData.mcpResetAt), t)})`
      : '';
    parts.push(`MCP: ${colorize(`${zaiData.mcpPercent}%`, color)}${reset}`);
  }

  // Model info
  if (zaiData.model) {
    parts.push(`Model: ${colorize(zaiData.model, COLORS.pastelGray)}`);
  }

  lines.push(`${label}`);
  if (parts.length > 0) {
    lines.push(`  ${parts.join('  |  ')}`);
  }

  return lines;
}

/**
 * Calculate recommendation based on lowest usage
 */
export function calculateRecommendation(
  claudeUsage: CLIUsageInfo,
  codexUsage: CLIUsageInfo | null,
  geminiUsage: CLIUsageInfo | null,
  zaiUsage: CLIUsageInfo | null,
  t: Translations
): { name: string | null; reason: string } {
  const candidates: { name: string; score: number }[] = [];

  // Claude score (lower is better - using 5h as primary metric)
  // Exclude from recommendations when using z.ai provider (different quota system)
  if (!isZaiProvider() && !claudeUsage.error && claudeUsage.fiveHourPercent !== null) {
    candidates.push({ name: 'claude', score: claudeUsage.fiveHourPercent });
  }

  // Codex score
  if (codexUsage && codexUsage.available && !codexUsage.error && codexUsage.fiveHourPercent !== null) {
    candidates.push({ name: 'codex', score: codexUsage.fiveHourPercent });
  }

  // Gemini score (uses single usage percent)
  if (geminiUsage && geminiUsage.available && !geminiUsage.error && geminiUsage.fiveHourPercent !== null) {
    candidates.push({ name: 'gemini', score: geminiUsage.fiveHourPercent });
  }

  // z.ai score (uses token percent as primary metric)
  if (zaiUsage && zaiUsage.available && !zaiUsage.error && zaiUsage.fiveHourPercent !== null) {
    candidates.push({ name: 'z.ai', score: zaiUsage.fiveHourPercent });
  }

  if (candidates.length === 0) {
    return {
      name: null,
      reason: t.checkUsage.noData,
    };
  }

  // Sort by score (ascending - lower usage is better)
  candidates.sort((a, b) => a.score - b.score);

  const best = candidates[0];
  const reason = `${t.checkUsage.lowestUsage} (${best.score}% ${t.checkUsage.used})`;

  return { name: best.name, reason };
}

/**
 * Create a CLIUsageInfo result for not-installed CLI
 */
function createNotInstalledResult(name: string): CLIUsageInfo {
  return {
    name,
    available: false,
    error: false,
    fiveHourPercent: null,
    sevenDayPercent: null,
    fiveHourReset: null,
    sevenDayReset: null,
  };
}

/**
 * Create a CLIUsageInfo result for error state
 */
function createErrorResult(name: string): CLIUsageInfo {
  return {
    name,
    available: true,
    error: true,
    fiveHourPercent: null,
    sevenDayPercent: null,
    fiveHourReset: null,
    sevenDayReset: null,
  };
}

/**
 * Parse Claude usage limits
 * Note: API returns utilization as percentage (0-100), not fraction (0-1)
 */
export function parseClaudeUsage(limits: UsageLimits | null): CLIUsageInfo {
  if (!limits) {
    return createErrorResult('Claude');
  }

  return {
    name: 'Claude',
    available: true,
    error: false,
    fiveHourPercent: limits.five_hour ? Math.round(limits.five_hour.utilization) : null,
    sevenDayPercent: limits.seven_day ? Math.round(limits.seven_day.utilization) : null,
    fiveHourReset: normalizeToISO(limits.five_hour?.resets_at ?? null),
    sevenDayReset: normalizeToISO(limits.seven_day?.resets_at ?? null),
  };
}

/**
 * Parse Codex usage limits
 */
export function parseCodexUsage(limits: CodexUsageLimits | null, installed: boolean): CLIUsageInfo {
  if (!installed) return createNotInstalledResult('Codex');
  if (!limits) return createErrorResult('Codex');

  return {
    name: 'Codex',
    available: true,
    error: false,
    fiveHourPercent: limits.primary ? Math.round(limits.primary.usedPercent) : null,
    sevenDayPercent: limits.secondary ? Math.round(limits.secondary.usedPercent) : null,
    fiveHourReset: limits.primary ? new Date(limits.primary.resetAt * 1000).toISOString() : null,
    sevenDayReset: limits.secondary ? new Date(limits.secondary.resetAt * 1000).toISOString() : null,
    model: limits.model,
    plan: limits.planType,
  };
}

/**
 * Parse Gemini usage limits
 */
export function parseGeminiUsage(limits: GeminiUsageLimits | null, installed: boolean): CLIUsageInfo {
  if (!installed) return createNotInstalledResult('Gemini');
  if (!limits) return createErrorResult('Gemini');

  // Convert buckets to BucketUsageInfo format with normalized ISO timestamps
  const buckets: BucketUsageInfo[] | undefined = limits.buckets?.map((b) => ({
    modelId: b.modelId || 'unknown',
    usedPercent: b.usedPercent,
    resetAt: normalizeToISO(b.resetAt),
  }));

  return {
    name: 'Gemini',
    available: true,
    error: false,
    fiveHourPercent: limits.usedPercent,
    sevenDayPercent: null,
    fiveHourReset: normalizeToISO(limits.resetAt),
    sevenDayReset: null,
    model: limits.model,
    buckets,
  };
}

/**
 * Parse z.ai usage limits
 */
export function parseZaiUsage(limits: ZaiUsageLimits | null, installed: boolean): CLIUsageInfo {
  if (!installed) return createNotInstalledResult('z.ai');
  if (!limits) return createErrorResult('z.ai');

  return {
    name: 'z.ai',
    available: true,
    error: false,
    fiveHourPercent: limits.tokensPercent,
    sevenDayPercent: limits.mcpPercent,
    fiveHourReset: limits.tokensResetAt ? new Date(limits.tokensResetAt).toISOString() : null,
    sevenDayReset: limits.mcpResetAt ? new Date(limits.mcpResetAt).toISOString() : null,
    model: limits.model,
  };
}

/**
 * Main function
 */
/**
 * Parse --lang argument from command line
 */
function parseLangArg(args: string[]): 'en' | 'ko' | null {
  const langIndex = args.indexOf('--lang');
  if (langIndex !== -1 && args[langIndex + 1]) {
    const lang = args[langIndex + 1].toLowerCase();
    if (lang === 'ko' || lang === 'en') {
      return lang;
    }
  }
  return null;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isJsonMode = args.includes('--json');
  const lang = parseLangArg(args) ?? detectSystemLanguage();
  const t = getTranslationsByLang(lang);

  // Check installation status
  const zaiInstalled = isZaiInstalled();

  // Fetch all usage data in parallel
  const [
    claudeLimits,
    codexInstalled,
    geminiInstalled,
  ] = await Promise.all([
    fetchUsageLimits(CHECK_USAGE_TTL_SECONDS),
    isCodexInstalled(),
    isGeminiInstalled(),
  ]);

  // Fetch Codex, Gemini, and z.ai only if installed
  const [codexLimits, geminiLimits, zaiLimits] = await Promise.all([
    codexInstalled ? fetchCodexUsage(CHECK_USAGE_TTL_SECONDS) : Promise.resolve(null),
    geminiInstalled ? fetchGeminiUsage(CHECK_USAGE_TTL_SECONDS) : Promise.resolve(null),
    zaiInstalled ? fetchZaiUsage(CHECK_USAGE_TTL_SECONDS) : Promise.resolve(null),
  ]);

  // Parse usage data
  const claudeUsage = parseClaudeUsage(claudeLimits);
  const codexUsage = parseCodexUsage(codexLimits, codexInstalled);
  const geminiUsage = parseGeminiUsage(geminiLimits, geminiInstalled);
  const zaiUsage = parseZaiUsage(zaiLimits, zaiInstalled);

  // Calculate recommendation
  const recommendation = calculateRecommendation(
    claudeUsage,
    codexInstalled ? codexUsage : null,
    geminiInstalled ? geminiUsage : null,
    zaiInstalled ? zaiUsage : null,
    t
  );

  // JSON output mode
  if (isJsonMode) {
    const output: CheckUsageOutput = {
      claude: claudeUsage,
      codex: codexInstalled ? codexUsage : null,
      gemini: geminiInstalled ? geminiUsage : null,
      zai: zaiInstalled ? zaiUsage : null,
      recommendation: recommendation.name,
      recommendationReason: recommendation.reason,
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // Pretty output
  const outputLines: string[] = [];

  // Header
  outputLines.push(colorize(renderLine(), COLORS.gray));
  outputLines.push(renderTitle(t.checkUsage.title));
  outputLines.push(colorize(renderLine(), COLORS.gray));
  outputLines.push('');

  // Claude section (always available)
  const claudeLines = renderClaudeSection('Claude', claudeUsage, t);
  if (claudeLines.length > 0) {
    outputLines.push(...claudeLines);
    outputLines.push('');
  }

  // Codex section (use special renderer for timestamp handling)
  if (codexInstalled) {
    const codexLines = renderCodexSection(codexUsage, codexLimits, t);
    if (codexLines.length > 0) {
      outputLines.push(...codexLines);
      outputLines.push('');
    }
  }

  // Gemini section
  if (geminiInstalled) {
    const geminiLines = renderGeminiSection(geminiUsage, geminiLimits, t);
    if (geminiLines.length > 0) {
      outputLines.push(...geminiLines);
      outputLines.push('');
    }
  }

  // z.ai section
  if (zaiInstalled) {
    const zaiLines = renderZaiSection(zaiUsage, zaiLimits, t);
    if (zaiLines.length > 0) {
      outputLines.push(...zaiLines);
      outputLines.push('');
    }
  }

  // Recommendation
  outputLines.push(colorize(renderLine(), COLORS.gray));
  if (recommendation.name) {
    outputLines.push(
      `${t.checkUsage.recommendation}: ${colorize(recommendation.name, COLORS.pastelGreen)} (${recommendation.reason})`
    );
  } else {
    outputLines.push(colorize(recommendation.reason, COLORS.pastelYellow));
  }
  outputLines.push(colorize(renderLine(), COLORS.gray));

  // Print output
  console.log(outputLines.join('\n'));
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  const isJsonMode = process.argv.includes('--json');

  if (isJsonMode) {
    console.log(JSON.stringify({ error: message }));
  } else {
    console.error('Error:', message);
  }
  process.exit(1);
});
