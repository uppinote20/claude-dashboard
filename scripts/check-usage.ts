#!/usr/bin/env node
/**
 * CLI Usage Dashboard
 * Displays usage limits for all AI CLIs (Claude, Codex, Gemini, z.ai)
 * and recommends the one with the most available capacity.
 * @handbook 7.1-common-api-pattern
 * @tested scripts/__tests__/check-usage.test.ts
 */

import { fetchUsageLimits } from './utils/api-client.js';
import { fetchCodexUsage, isCodexInstalled } from './utils/codex-client.js';
import { fetchGeminiUsage, isGeminiInstalled } from './utils/gemini-client.js';
import { fetchAntigravityUsage, isAntigravityInstalled } from './utils/antigravity-client.js';
import { fetchZaiUsage, isZaiInstalled, type ZaiUsageLimits } from './utils/zai-api-client.js';
import { isZaiProvider } from './utils/provider.js';
import { formatTimeRemaining, formatWindowLabel } from './utils/formatters.js';
import { getColorForPercent, colorize, COLORS } from './utils/colors.js';
import { ICON } from './utils/emoji.js';
import { getTranslationsByLang, detectSystemLanguage } from './utils/i18n.js';
import type {
  UsageLimits,
  CodexUsageLimits,
  GeminiUsageLimits,
  AntigravityUsageLimits,
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
 * Shared section envelope: handles label, not-installed, and error states.
 * Calls contentFn only when data is available.
 */
function renderSection(
  name: string,
  usage: CLIUsageInfo,
  t: Translations,
  contentFn: (lines: string[]) => void,
  hasData = true,
): string[] {
  const lines: string[] = [];
  const label = colorize(`[${name}]`, COLORS.pastelCyan);

  if (!usage.available) {
    lines.push(`${label} ${colorize(`(${t.checkUsage.notInstalled})`, COLORS.gray)}`);
    return lines;
  }

  if (usage.error || !hasData) {
    lines.push(`${label} ${colorize(`${ICON.warning} ${t.checkUsage.errorFetching}`, COLORS.pastelYellow)}`);
    return lines;
  }

  lines.push(`${label}`);
  contentFn(lines);
  return lines;
}

/**
 * Render usage percent with color and optional reset time
 */
function formatUsageRow(label: string, percent: number, resetStr: string): string {
  const color = getColorForPercent(percent);
  return `${label}: ${colorize(`${percent}%`, color)}${resetStr ? ` (${resetStr})` : ''}`;
}

/**
 * Render aligned label/percent rows — shared by bucket- and group-based sections
 */
function renderUsageRows(
  lines: string[],
  rows: Array<{ label: string; usedPercent: number | null; resetAt: string | null }>,
  t: Translations
): void {
  if (rows.length === 0) {
    return;
  }
  const maxLabelLen = Math.max(...rows.map((r) => r.label.length));

  for (const row of rows) {
    const paddedLabel = row.label.padEnd(maxLabelLen);
    if (row.usedPercent !== null) {
      const color = getColorForPercent(row.usedPercent);
      const reset = row.resetAt ? ` (${formatTimeRemaining(row.resetAt, t)})` : '';
      lines.push(`  ${colorize(paddedLabel, COLORS.pastelGray)}  ${colorize(`${row.usedPercent}%`, color)}${reset}`);
    } else {
      lines.push(`  ${colorize(paddedLabel, COLORS.pastelGray)}  ${colorize('--', COLORS.gray)}`);
    }
  }
}

/**
 * Render Claude/z.ai-style section from CLIUsageInfo
 */
function renderGenericSection(
  name: string,
  usage: CLIUsageInfo,
  t: Translations,
  extraParts?: (parts: string[]) => void,
): string[] {
  return renderSection(name, usage, t, (lines) => {
    const parts: string[] = [];

    if (usage.fiveHourPercent !== null) {
      const reset = usage.fiveHourReset ? formatTimeRemaining(usage.fiveHourReset, t) : '';
      parts.push(formatUsageRow(t.labels['5h'], usage.fiveHourPercent, reset));
    }
    if (usage.sevenDayPercent !== null) {
      const reset = usage.sevenDayReset ? formatTimeRemaining(usage.sevenDayReset, t) : '';
      parts.push(formatUsageRow(t.labels['7d'], usage.sevenDayPercent, reset));
    }
    extraParts?.(parts);

    if (parts.length > 0) {
      lines.push(`  ${parts.join('  |  ')}`);
    }
  });
}

/**
 * Render Codex-specific section with timestamp-based reset
 */
function renderCodexSection(
  usage: CLIUsageInfo,
  codexData: CodexUsageLimits | null,
  t: Translations
): string[] {
  if (!codexData) {
    return renderSection('Codex', usage, t, () => {}, false);
  }

  return renderSection('Codex', usage, t, (lines) => {
    const parts: string[] = [];

    if (codexData.primary) {
      const percent = Math.round(codexData.primary.usedPercent);
      const label = formatWindowLabel(codexData.primary.windowSeconds, t.labels['5h'], t);
      parts.push(formatUsageRow(label, percent, formatTimeFromTimestamp(codexData.primary.resetAt, t)));
    }
    if (codexData.secondary) {
      const percent = Math.round(codexData.secondary.usedPercent);
      const label = formatWindowLabel(codexData.secondary.windowSeconds, t.labels['7d'], t);
      parts.push(formatUsageRow(label, percent, formatTimeFromTimestamp(codexData.secondary.resetAt, t)));
    }
    if (codexData.planType) {
      parts.push(`Plan: ${colorize(codexData.planType, COLORS.pastelGray)}`);
    }

    if (parts.length > 0) {
      lines.push(`  ${parts.join('  |  ')}`);
    }
  });
}

/**
 * Render Gemini-specific section with all model buckets
 */
function renderGeminiSection(
  usage: CLIUsageInfo,
  geminiData: GeminiUsageLimits | null,
  t: Translations
): string[] {
  if (!geminiData) {
    return renderSection('Gemini', usage, t, () => {}, false);
  }

  return renderSection('Gemini', usage, t, (lines) => {
    if (geminiData.buckets && geminiData.buckets.length > 0) {
      renderUsageRows(
        lines,
        geminiData.buckets.map((b) => ({
          label: b.modelId || 'unknown',
          usedPercent: b.usedPercent,
          resetAt: b.resetAt,
        })),
        t
      );
    } else if (geminiData.usedPercent !== null) {
      const color = getColorForPercent(geminiData.usedPercent);
      const reset = geminiData.resetAt
        ? ` (${formatTimeRemaining(geminiData.resetAt, t)})`
        : '';
      const modelInfo = geminiData.model ? `${geminiData.model}: ` : '';
      lines.push(`  ${modelInfo}${colorize(`${geminiData.usedPercent}%`, color)}${reset}`);
    }
  });
}

/**
 * Render Antigravity-specific section with model-family groups
 */
function renderAntigravitySection(
  usage: CLIUsageInfo,
  antigravityData: AntigravityUsageLimits | null,
  t: Translations
): string[] {
  if (!antigravityData) {
    return renderSection('Antigravity', usage, t, () => {}, false);
  }

  return renderSection('Antigravity', usage, t, (lines) => {
    renderUsageRows(lines, antigravityData.groups, t);

    const extras: string[] = [];
    if (antigravityData.model) {
      extras.push(`Model: ${colorize(antigravityData.model, COLORS.pastelGray)}`);
    }
    if (antigravityData.planType) {
      extras.push(`Plan: ${colorize(antigravityData.planType, COLORS.pastelGray)}`);
    }
    if (extras.length > 0) {
      lines.push(`  ${extras.join('  |  ')}`);
    }
  });
}

/**
 * Calculate recommendation based on lowest usage
 */
export function calculateRecommendation(
  usages: Array<CLIUsageInfo | null>,
  t: Translations
): { name: string | null; reason: string } {
  // Each CLI exposes its own primary metric via primaryPercent (5h window for
  // Claude/Codex/Gemini, or the weekly window when the plan has no 5h bucket;
  // weekly family limit for Antigravity, token bucket for z.ai); pass null to
  // exclude a CLI from scoring.
  const candidates = usages
    .filter((u): u is CLIUsageInfo => u !== null && u.available && !u.error && u.primaryPercent !== null)
    .map((u) => ({ name: u.name.toLowerCase(), score: u.primaryPercent! }));

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
    primaryPercent: null,
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
    primaryPercent: null,
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
    primaryPercent: limits.five_hour ? Math.round(limits.five_hour.utilization) : null,
    fiveHourPercent: limits.five_hour ? Math.round(limits.five_hour.utilization) : null,
    sevenDayPercent: limits.seven_day ? Math.round(limits.seven_day.utilization) : null,
    fiveHourReset: normalizeToISO(limits.five_hour?.resets_at ?? null),
    sevenDayReset: normalizeToISO(limits.seven_day?.resets_at ?? null),
  };
}

/**
 * Decide whether a Codex window belongs in the weekly bucket. Falls back to the
 * window's position in the response when the API (or a cached payload predating
 * `limit_window_seconds`) does not report a duration.
 */
function isWeeklyWindow(
  windowSeconds: number | null | undefined,
  positionalDefault: boolean
): boolean {
  if (typeof windowSeconds !== 'number' || !Number.isFinite(windowSeconds) || windowSeconds <= 0) {
    return positionalDefault;
  }
  return windowSeconds >= 86400;
}

/**
 * Parse Codex usage limits.
 *
 * Windows are routed into the 5h/7d buckets by their own duration, not by their
 * position: a Pro account returns its weekly window in `primary` and nothing in
 * `secondary`, which would otherwise publish weekly usage as `fiveHourPercent`.
 */
export function parseCodexUsage(limits: CodexUsageLimits | null, installed: boolean): CLIUsageInfo {
  if (!installed) return createNotInstalledResult('Codex');
  if (!limits) return createErrorResult('Codex');

  const primaryIsWeekly = limits.primary
    ? isWeeklyWindow(limits.primary.windowSeconds, false)
    : false;
  const secondaryIsWeekly = limits.secondary
    ? isWeeklyWindow(limits.secondary.windowSeconds, true)
    : false;

  const fiveHour = limits.primary && !primaryIsWeekly
    ? limits.primary
    : limits.secondary && !secondaryIsWeekly
      ? limits.secondary
      : null;
  const sevenDay = limits.primary && primaryIsWeekly
    ? limits.primary
    : limits.secondary && secondaryIsWeekly
      ? limits.secondary
      : null;

  // A plan without a short window (Pro) is scored on the only limit it has.
  const primary = fiveHour ?? sevenDay;

  return {
    name: 'Codex',
    available: true,
    error: false,
    primaryPercent: primary ? Math.round(primary.usedPercent) : null,
    fiveHourPercent: fiveHour ? Math.round(fiveHour.usedPercent) : null,
    sevenDayPercent: sevenDay ? Math.round(sevenDay.usedPercent) : null,
    fiveHourReset: fiveHour ? new Date(fiveHour.resetAt * 1000).toISOString() : null,
    sevenDayReset: sevenDay ? new Date(sevenDay.resetAt * 1000).toISOString() : null,
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
    primaryPercent: limits.usedPercent,
    fiveHourPercent: limits.usedPercent,
    sevenDayPercent: null,
    fiveHourReset: normalizeToISO(limits.resetAt),
    sevenDayReset: null,
    model: limits.model,
    buckets,
  };
}

/**
 * Parse Antigravity usage limits.
 * Quota is a weekly per-family limit; the tightest group is exposed as the
 * 7d metric and groups map to buckets for JSON consumers.
 */
export function parseAntigravityUsage(limits: AntigravityUsageLimits | null, installed: boolean): CLIUsageInfo {
  if (!installed) return createNotInstalledResult('Antigravity');
  if (!limits) return createErrorResult('Antigravity');

  let worst: AntigravityUsageLimits['groups'][number] | null = null;
  for (const group of limits.groups) {
    if (group.usedPercent !== null && (worst?.usedPercent == null || group.usedPercent > worst.usedPercent)) {
      worst = group;
    }
  }

  return {
    name: 'Antigravity',
    available: true,
    error: false,
    // Weekly family-group limits — the tightest group is the primary/7d metric
    primaryPercent: worst?.usedPercent ?? null,
    fiveHourPercent: null,
    sevenDayPercent: worst?.usedPercent ?? null,
    fiveHourReset: null,
    sevenDayReset: normalizeToISO(worst?.resetAt ?? null),
    model: limits.model,
    plan: limits.planType,
    groups: limits.groups.map((g) => ({
      label: g.label,
      usedPercent: g.usedPercent,
      resetAt: normalizeToISO(g.resetAt),
    })),
    buckets: limits.buckets.map((b) => ({
      modelId: b.modelId,
      label: b.label,
      usedPercent: b.usedPercent,
      resetAt: normalizeToISO(b.resetAt),
    })),
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
    primaryPercent: limits.tokensPercent,
    fiveHourPercent: limits.tokensPercent,
    sevenDayPercent: limits.mcpPercent,
    fiveHourReset: limits.tokensResetAt ? new Date(limits.tokensResetAt).toISOString() : null,
    sevenDayReset: limits.mcpResetAt ? new Date(limits.mcpResetAt).toISOString() : null,
    model: limits.model,
  };
}

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
    antigravityInstalled,
  ] = await Promise.all([
    fetchUsageLimits(CHECK_USAGE_TTL_SECONDS),
    isCodexInstalled(),
    isGeminiInstalled(),
    isAntigravityInstalled(),
  ]);

  // Fetch Codex, Gemini, and z.ai only if installed
  const [codexLimits, geminiLimits, antigravityLimits, zaiLimits] = await Promise.all([
    codexInstalled ? fetchCodexUsage(CHECK_USAGE_TTL_SECONDS) : Promise.resolve(null),
    geminiInstalled ? fetchGeminiUsage(CHECK_USAGE_TTL_SECONDS) : Promise.resolve(null),
    antigravityInstalled ? fetchAntigravityUsage(CHECK_USAGE_TTL_SECONDS) : Promise.resolve(null),
    zaiInstalled ? fetchZaiUsage(CHECK_USAGE_TTL_SECONDS) : Promise.resolve(null),
  ]);

  // Parse usage data
  const claudeUsage = parseClaudeUsage(claudeLimits);
  const codexUsage = parseCodexUsage(codexLimits, codexInstalled);
  const geminiUsage = parseGeminiUsage(geminiLimits, geminiInstalled);
  const antigravityUsage = parseAntigravityUsage(antigravityLimits, antigravityInstalled);
  const zaiUsage = parseZaiUsage(zaiLimits, zaiInstalled);

  // Calculate recommendation
  // z.ai provider replaces the Anthropic quota system, so Claude is excluded there
  const recommendation = calculateRecommendation(
    [
      isZaiProvider() ? null : claudeUsage,
      codexInstalled ? codexUsage : null,
      geminiInstalled ? geminiUsage : null,
      antigravityInstalled ? antigravityUsage : null,
      zaiInstalled ? zaiUsage : null,
    ],
    t
  );

  // JSON output mode
  if (isJsonMode) {
    const output: CheckUsageOutput = {
      claude: claudeUsage,
      codex: codexInstalled ? codexUsage : null,
      gemini: geminiInstalled ? geminiUsage : null,
      antigravity: antigravityInstalled ? antigravityUsage : null,
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
  const claudeLines = renderGenericSection('Claude', claudeUsage, t, (parts) => {
    if (claudeUsage.plan) parts.push(`Plan: ${colorize(claudeUsage.plan, COLORS.pastelGray)}`);
  });
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

  // Antigravity section
  if (antigravityInstalled) {
    const antigravityLines = renderAntigravitySection(antigravityUsage, antigravityLimits, t);
    if (antigravityLines.length > 0) {
      outputLines.push(...antigravityLines);
      outputLines.push('');
    }
  }

  // z.ai section
  if (zaiInstalled) {
    const zaiLines = renderGenericSection('z.ai', zaiUsage, t, (parts) => {
      if (zaiUsage.model) parts.push(`Model: ${colorize(zaiUsage.model, COLORS.pastelGray)}`);
    });
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
