/**
 * @handbook 2.1-naming-rules
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

/**
 * Shorten model name
 * Examples: "Claude 3.5 Sonnet" -> "Sonnet", "Claude Opus 4.5" -> "Opus"
 */
export function shortenModelName(displayName: string): string {
  const lower = displayName.toLowerCase();

  if (lower.includes('opus')) return 'Opus';
  if (lower.includes('sonnet')) return 'Sonnet';
  if (lower.includes('haiku')) return 'Haiku';

  // Fallback: return first word after "Claude" or the original
  const parts = displayName.split(/\s+/);
  if (parts.length > 1 && parts[0].toLowerCase() === 'claude') {
    return parts[1];
  }

  return displayName;
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
