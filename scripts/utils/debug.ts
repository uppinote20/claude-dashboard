/**
 * Debug utilities for claude-dashboard
 * @handbook 6.3-debug-mode
 *
 * Enable debug logging by setting DEBUG=claude-dashboard or DEBUG=1
 */

const DEBUG =
  process.env.DEBUG === 'claude-dashboard' ||
  process.env.DEBUG === '1' ||
  process.env.DEBUG === 'true';

/**
 * Log debug message if DEBUG is enabled
 */
export function debugLog(context: string, message: string, error?: unknown): void {
  if (!DEBUG) return;

  const timestamp = new Date().toISOString();
  const prefix = `[claude-dashboard:${context}]`;

  if (error) {
    console.error(`${timestamp} ${prefix} ${message}`, error);
  } else {
    console.log(`${timestamp} ${prefix} ${message}`);
  }
}

/**
 * Check if debug mode is enabled
 */
export function isDebugEnabled(): boolean {
  return DEBUG;
}
