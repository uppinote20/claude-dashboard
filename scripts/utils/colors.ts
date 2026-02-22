/**
 * ANSI color codes for terminal output with theme support
 */

import type { ThemeId } from '../types.js';

/**
 * Semantic color roles used by widgets
 */
export interface ThemeColors {
  // Styles
  dim: string;
  bold: string;

  // Semantic roles
  model: string;        // Model name
  folder: string;       // Directory name, cost
  branch: string;       // Git branch
  safe: string;         // Low usage, positive status
  warning: string;      // Medium usage
  danger: string;       // High usage, errors
  secondary: string;    // Secondary/muted info
  accent: string;       // Yellow-ish accent (cost, labels)
  info: string;         // Informational (blue/cyan)

  // Progress bar
  barFilled: string;    // Filled portion
  barEmpty: string;     // Empty portion

  // Direct ANSI (always available)
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  gray: string;
}

/**
 * Theme definitions
 */
const THEMES: Record<ThemeId, ThemeColors> = {
  default: {
    dim: '\x1b[2m',
    bold: '\x1b[1m',

    model: '\x1b[38;5;117m',       // pastelCyan
    folder: '\x1b[38;5;222m',      // pastelYellow
    branch: '\x1b[38;5;218m',      // pastelPink
    safe: '\x1b[38;5;151m',        // pastelGreen
    warning: '\x1b[38;5;222m',     // pastelYellow
    danger: '\x1b[38;5;210m',      // pastelRed
    secondary: '\x1b[38;5;249m',   // pastelGray
    accent: '\x1b[38;5;222m',      // pastelYellow
    info: '\x1b[38;5;117m',        // pastelCyan

    barFilled: '\x1b[32m',         // green
    barEmpty: '\x1b[90m',          // gray

    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',
  },

  minimal: {
    dim: '\x1b[2m',
    bold: '\x1b[1m',

    model: '\x1b[37m',             // white
    folder: '\x1b[37m',            // white
    branch: '\x1b[37m',            // white
    safe: '\x1b[90m',              // gray
    warning: '\x1b[37m',           // white
    danger: '\x1b[1;37m',          // bold white
    secondary: '\x1b[90m',         // gray
    accent: '\x1b[37m',            // white
    info: '\x1b[37m',              // white

    barFilled: '\x1b[37m',         // white
    barEmpty: '\x1b[90m',          // gray

    red: '\x1b[37m',
    green: '\x1b[37m',
    yellow: '\x1b[37m',
    blue: '\x1b[37m',
    magenta: '\x1b[37m',
    cyan: '\x1b[37m',
    white: '\x1b[37m',
    gray: '\x1b[90m',
  },

  catppuccin: {
    dim: '\x1b[2m',
    bold: '\x1b[1m',

    model: '\x1b[38;2;137;180;250m',    // #89b4fa blue
    folder: '\x1b[38;2;249;226;175m',   // #f9e2af yellow
    branch: '\x1b[38;2;245;194;231m',   // #f5c2e7 pink
    safe: '\x1b[38;2;166;227;161m',     // #a6e3a1 green
    warning: '\x1b[38;2;250;179;135m',  // #fab387 peach
    danger: '\x1b[38;2;243;139;168m',   // #f38ba8 red
    secondary: '\x1b[38;2;127;132;156m', // #7f849c overlay1
    accent: '\x1b[38;2;250;179;135m',   // #fab387 peach
    info: '\x1b[38;2;116;199;236m',     // #74c7ec sapphire

    barFilled: '\x1b[38;2;166;227;161m', // #a6e3a1 green
    barEmpty: '\x1b[38;2;88;91;112m',    // #585b70 surface2

    red: '\x1b[38;2;243;139;168m',
    green: '\x1b[38;2;166;227;161m',
    yellow: '\x1b[38;2;249;226;175m',
    blue: '\x1b[38;2;137;180;250m',
    magenta: '\x1b[38;2;203;166;247m',
    cyan: '\x1b[38;2;148;226;213m',
    white: '\x1b[38;2;205;214;244m',
    gray: '\x1b[38;2;127;132;156m',
  },

  gruvbox: {
    dim: '\x1b[2m',
    bold: '\x1b[1m',

    model: '\x1b[38;2;215;153;33m',    // #d79921 yellow
    folder: '\x1b[38;2;250;189;47m',   // #fabd2f bright yellow
    branch: '\x1b[38;2;211;134;155m',  // #d3869b purple
    safe: '\x1b[38;2;184;187;38m',     // #b8bb26 green
    warning: '\x1b[38;2;250;189;47m',  // #fabd2f yellow
    danger: '\x1b[38;2;204;36;29m',    // #cc241d red
    secondary: '\x1b[38;2;168;153;132m', // #a89984 gray
    accent: '\x1b[38;2;250;189;47m',   // #fabd2f yellow
    info: '\x1b[38;2;131;165;152m',    // #83a598 blue

    barFilled: '\x1b[38;2;184;187;38m', // #b8bb26 green
    barEmpty: '\x1b[38;2;80;73;69m',    // #504945 dark gray

    red: '\x1b[38;2;204;36;29m',
    green: '\x1b[38;2;184;187;38m',
    yellow: '\x1b[38;2;250;189;47m',
    blue: '\x1b[38;2;131;165;152m',
    magenta: '\x1b[38;2;211;134;155m',
    cyan: '\x1b[38;2;142;192;124m',
    white: '\x1b[38;2;235;219;178m',
    gray: '\x1b[38;2;168;153;132m',
  },

  dracula: {
    dim: '\x1b[2m',
    bold: '\x1b[1m',

    model: '\x1b[38;2;189;147;249m',    // #bd93f9 purple
    folder: '\x1b[38;2;255;184;108m',   // #ffb86c orange
    branch: '\x1b[38;2;255;121;198m',   // #ff79c6 pink
    safe: '\x1b[38;2;80;250;123m',      // #50fa7b green
    warning: '\x1b[38;2;241;250;140m',  // #f1fa8c yellow
    danger: '\x1b[38;2;255;85;85m',     // #ff5555 red
    secondary: '\x1b[38;2;98;114;164m', // #6272a4 comment
    accent: '\x1b[38;2;255;184;108m',   // #ffb86c orange
    info: '\x1b[38;2;139;233;253m',     // #8be9fd cyan

    barFilled: '\x1b[38;2;80;250;123m',  // #50fa7b green
    barEmpty: '\x1b[38;2;68;71;90m',     // #44475a current line

    red: '\x1b[38;2;255;85;85m',
    green: '\x1b[38;2;80;250;123m',
    yellow: '\x1b[38;2;241;250;140m',
    blue: '\x1b[38;2;189;147;249m',
    magenta: '\x1b[38;2;255;121;198m',
    cyan: '\x1b[38;2;139;233;253m',
    white: '\x1b[38;2;248;248;242m',
    gray: '\x1b[38;2;98;114;164m',
  },
};

/**
 * Active theme (set once at startup)
 */
let activeTheme: ThemeColors = THEMES.default;

/**
 * Set the active theme
 */
export function setTheme(themeId: ThemeId | undefined): void {
  activeTheme = THEMES[themeId ?? 'default'] ?? THEMES.default;
}

/**
 * Get the active theme colors
 */
export function getTheme(): ThemeColors {
  return activeTheme;
}

export const RESET = '\x1b[0m';

/**
 * Legacy COLORS export for backward compatibility
 * Widgets should migrate to using getTheme() for themed colors
 */
export const COLORS = {
  reset: RESET,
  dim: '\x1b[2m',
  bold: '\x1b[1m',

  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightCyan: '\x1b[96m',

  pastelYellow: '\x1b[38;5;222m',
  pastelCyan: '\x1b[38;5;117m',
  pastelPink: '\x1b[38;5;218m',
  pastelGreen: '\x1b[38;5;151m',
  pastelOrange: '\x1b[38;5;216m',
  pastelRed: '\x1b[38;5;210m',
  pastelGray: '\x1b[38;5;249m',
} as const;

/**
 * Get color based on percentage using active theme
 * 0-50%: safe, 51-80%: warning, 81-100%: danger
 */
export function getColorForPercent(percent: number): string {
  const theme = getTheme();
  if (percent <= 50) return theme.safe;
  if (percent <= 80) return theme.warning;
  return theme.danger;
}

/**
 * Wrap text with color and auto-reset
 */
export function colorize(text: string, color: string): string {
  return `${color}${text}${RESET}`;
}

/**
 * Get the pipe separator string using active theme
 */
export function getSeparator(): string {
  return ` ${getTheme().dim}│${RESET} `;
}
