/**
 * @handbook 2.1-naming-conventions
 * @tested scripts/__tests__/formatters.test.ts
 */
import type { Translations } from '../types.js';

/**
 * Format token count in K/M format
 * Examples: 1500 -> "1.5K", 150000 -> "150K", 1500000 -> "1.5M"
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    const value = tokens / 1_000_000;
    return value >= 10 ? `${Math.round(value)}M` : `${value.toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    const value = tokens / 1_000;
    return value >= 10 ? `${Math.round(value)}K` : `${value.toFixed(1)}K`;
  }
  return String(tokens);
}

/**
 * Format cost in USD
 * Examples: 0.5 -> "$0.50", 1.234 -> "$1.23"
 */
export function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

/**
 * Format time remaining until reset
 * Examples: 3d2h, 2h30m, 45m, 5m
 */
export function formatTimeRemaining(resetAt: string | Date, t: Translations): string {
  const reset = typeof resetAt === 'string' ? new Date(resetAt) : resetAt;
  const now = new Date();
  const diffMs = reset.getTime() - now.getTime();

  if (diffMs <= 0) return `0${t.time.minutes}`;

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
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

const MODEL_FAMILIES = ['Opus', 'Sonnet', 'Haiku', 'Fable'] as const;

const PARENTHETICAL = /\([^)]*\)/g;
const VERSION_WORD = /^\d+(\.\d+)?$/;
// One- or two-digit parts, "-" or "." separated, so date suffixes never read as versions.
const ID_VERSION = '(\\d{1,2})(?:[-.](\\d{1,2}))?(?!\\d)';
/** Per family: family-first ids ("claude-opus-4-8") and version-first ids ("claude-3-5-sonnet"). */
const ID_PATTERNS = new Map(
  MODEL_FAMILIES.map((f) => {
    const key = f.toLowerCase();
    return [key, [new RegExp(`${key}-${ID_VERSION}`), new RegExp(`claude-${ID_VERSION}-${key}`)]] as const;
  })
);

/**
 * Split a model name into its family and version.
 * Examples: "Opus 5.5" -> { Opus, 5.5 }, "Opus 5 (1M context)" -> { Opus, 5 },
 *           "Claude 3.5 Sonnet" -> { Sonnet, 3.5 }, "claude-opus-4-8[1m]" -> { Opus, 4.8 }
 * Non-Claude names keep the "first word after Claude" / original-name fallback, no version.
 */
export function parseModelName(displayName: string): { family: string; version?: string } {
  const lower = displayName.toLowerCase();
  const family = MODEL_FAMILIES.find((f) => lower.includes(f.toLowerCase()));

  if (!family) {
    const parts = displayName.split(/\s+/);
    if (parts.length > 1 && parts[0].toLowerCase() === 'claude') return { family: parts[1] };
    return { family: displayName };
  }

  return { family, version: extractVersion(lower, family.toLowerCase()) };
}

function extractVersion(lower: string, family: string): string | undefined {
  // Display names: a standalone number, either side of the family ("Opus 5.5",
  // "Claude 3.5 Sonnet"). Parentheticals such as "(1M context)" are not versions.
  const word = lower.replace(PARENTHETICAL, ' ').split(/\s+/).find((w) => VERSION_WORD.test(w));
  if (word) return word;

  // Model ids: "claude-opus-4-8", "claude-sonnet-3.5", "claude-3-5-sonnet-20241022".
  for (const pattern of ID_PATTERNS.get(family) ?? []) {
    const match = lower.match(pattern);
    if (match) return match[2] ? `${match[1]}.${match[2]}` : match[1];
  }
  return undefined;
}

/**
 * Shorten model name to its family
 * Examples: "Claude 3.5 Sonnet" -> "Sonnet", "Claude Opus 4.5" -> "Opus",
 *           "Claude Fable 5" -> "Fable"
 */
export function shortenModelName(displayName: string): string {
  return parseModelName(displayName).family;
}

/**
 * Calculate percentage
 */
export function calculatePercent(current: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((current / total) * 100));
}

/**
 * Format duration in milliseconds to human readable format
 * Examples: 3600000 -> "1h", 5400000 -> "1h30m", 300000 -> "5m"
 */
export function formatDuration(ms: number, t: { hours: string; minutes: string }): string {
  if (ms <= 0) return `0${t.minutes}`;

  const totalMinutes = Math.floor(ms / (1000 * 60));
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

/**
 * Truncate string to maxLen characters, appending '…' if truncated.
 */
export function truncate(str: string, maxLen: number): string {
  return str.length <= maxLen ? str : str.slice(0, maxLen) + '…';
}

/**
 * Clamp a value to the 0-100 percentage range.
 * Useful for ensuring API-derived percentages are safe for display.
 */
export function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

/**
 * Label a rate-limit window from its own duration rather than its position in the
 * API response. Providers do not guarantee that the primary window is the short one:
 * a Codex Pro account returns a single 604800s (7d) primary window and a null
 * secondary, which a position-based label renders as "5h".
 *
 * Falls back to the caller's positional label when the duration is unknown, so
 * responses (or caches) predating the field keep their previous rendering.
 * Any other duration is derived from the localized `time` units, so it reads the
 * same way as the two known windows in every locale.
 */
export function formatWindowLabel(
  windowSeconds: number | null | undefined,
  fallback: string,
  t: Translations
): string {
  if (typeof windowSeconds !== 'number' || !Number.isFinite(windowSeconds) || windowSeconds <= 0) {
    return fallback;
  }

  const MINUTE = 60;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  if (windowSeconds === 5 * HOUR) return t.labels['5h'];
  if (windowSeconds === 7 * DAY) return t.labels['7d'];

  if (windowSeconds >= DAY) return `${Math.round(windowSeconds / DAY)}${t.time.days}`;
  if (windowSeconds >= HOUR) return `${Math.round(windowSeconds / HOUR)}${t.time.hours}`;
  return `${Math.max(1, Math.round(windowSeconds / MINUTE))}${t.time.minutes}`;
}

/**
 * Wrap text in OSC8 hyperlink escape sequence.
 * Terminals that don't support OSC8 simply display the text without the link.
 * @see https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda
 */
export function osc8Link(url: string, text: string): string {
  return `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`;
}

const SPARK_BARS = '▁▂▃▄▅▆▇█';

/**
 * One block glyph per value, scaled to the largest (`[1, 4, 8]` → `▁▄█`). An all-zero
 * series draws the lowest bar for each value; an empty one draws nothing.
 */
export function sparkline(values: readonly number[]): string {
  const max = Math.max(0, ...values);
  return values
    .map((v) => {
      if (max === 0 || !(v > 0)) return SPARK_BARS[0];
      return SPARK_BARS[Math.min(SPARK_BARS.length - 1, Math.round((v / max) * (SPARK_BARS.length - 1)))];
    })
    .join('');
}

/** Second-resolution elapsed time: `42s`, `3m12s`, `1h05m`. */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m${String(totalSeconds % 60).padStart(2, '0')}s`;
  return `${Math.floor(totalMinutes / 60)}h${String(totalMinutes % 60).padStart(2, '0')}m`;
}
