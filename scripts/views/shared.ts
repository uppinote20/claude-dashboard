/**
 * Shared pieces of the pane views: the per-render context and line helpers.
 * @handbook 9.5-pane-views
 */

import { relative, isAbsolute, sep } from 'path';
import { homedir } from 'os';
import type { ParsedTranscript, Translations, WidgetContext } from '../types.js';
import { colorize, getTheme, RESET, type ThemeColors } from '../utils/colors.js';
import { parseModelName } from '../utils/formatters.js';
import { STALE_AFTER_MS } from '../utils/subagents.js';

export interface ViewContext {
  ctx: WidgetContext;
  transcript: ParsedTranscript;
  t: Translations['paneViews'];
  theme: ThemeColors;
  now: number;
}

export function makeViewContext(ctx: WidgetContext, transcript: ParsedTranscript, now: number): ViewContext {
  return { ctx, transcript, t: ctx.translations.paneViews, theme: getTheme(), now };
}

/**
 * True once the main thread has written nothing for STALE_AFTER_MS: the session was left
 * or exited, so a turn or job still marked running is no longer known to be.
 */
export function isSessionIdle(v: ViewContext): boolean {
  return v.now - (v.transcript.lastEntryAt ?? 0) > STALE_AFTER_MS;
}

/** `📜 Turns · 12` plus optional trailing segments. */
export function header(v: ViewContext, icon: string, title: string, ...extra: string[]): string {
  const head = `${icon} ${v.theme.bold}${title}${RESET}`;
  return [head, ...extra.filter(Boolean)].join(colorize(' · ', v.theme.secondary));
}

export function emptyLine(v: ViewContext, text: string): string {
  return colorize(`  ${text}`, v.theme.secondary);
}

export function dim(v: ViewContext, text: string): string {
  return `${v.theme.dim}${text}${RESET}`;
}

/** Local wall-clock `HH:MM`. */
export function clock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** `claude-sonnet-5-5` → `Sonnet 5.5`; unknown ids fall through unchanged. */
export function modelLabel(model: string): string {
  const { family, version } = parseModelName(model);
  return version ? `${family} ${version}` : family;
}

/** Path relative to the project when inside it, `~/…` when under home, else as is. */
export function displayPath(path: string, base: string | undefined): string {
  if (base && isAbsolute(path)) {
    const rel = relative(base, path);
    if (rel && !rel.startsWith('..') && !isAbsolute(rel)) return rel;
  }
  const home = homedir();
  return path.startsWith(home + sep) ? `~${path.slice(home.length)}` : path;
}
