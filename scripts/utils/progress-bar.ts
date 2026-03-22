/**
 * @handbook 5.3-usage-based-color
 * @tested scripts/__tests__/progress-bar.test.ts
 */
import { getColorForPercent, RESET } from './colors.js';

/**
 * Progress bar configuration
 */
export interface ProgressBarConfig {
  width: number;
  filledChar: string;
  emptyChar: string;
}

/**
 * Default progress bar configuration
 */
export const DEFAULT_PROGRESS_BAR_CONFIG: ProgressBarConfig = {
  width: 10,
  filledChar: '\u2588', // █ (full block)
  emptyChar: '\u2591', // ░ (light shade)
};

/**
 * Render a progress bar with color based on percentage
 *
 * @param percent - Percentage (0-100)
 * @param config - Progress bar configuration
 * @returns Colored progress bar string
 *
 * @example
 * renderProgressBar(45) // "████░░░░░░" (green)
 * renderProgressBar(75) // "███████░░░" (yellow)
 * renderProgressBar(90) // "█████████░" (red)
 */
export function renderProgressBar(
  percent: number,
  config: ProgressBarConfig = DEFAULT_PROGRESS_BAR_CONFIG
): string {
  const { width, filledChar, emptyChar } = config;

  // Clamp percent to 0-100
  const clampedPercent = Math.max(0, Math.min(100, percent));

  // Calculate filled and empty portions
  const filled = Math.round((clampedPercent / 100) * width);
  const empty = width - filled;

  // Build the bar
  const bar = filledChar.repeat(filled) + emptyChar.repeat(empty);

  // Apply color based on percentage
  const color = getColorForPercent(clampedPercent);

  return `${color}${bar}${RESET}`;
}

/**
 * Render progress bar without color (for testing)
 */
export function renderProgressBarPlain(
  percent: number,
  config: ProgressBarConfig = DEFAULT_PROGRESS_BAR_CONFIG
): string {
  const { width, filledChar, emptyChar } = config;
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clampedPercent / 100) * width);
  const empty = width - filled;

  return filledChar.repeat(filled) + emptyChar.repeat(empty);
}
