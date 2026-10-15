/**
 * Errors view: failed tool calls, newest first — the ones that scroll past unnoticed.
 * @handbook 9.5-pane-views
 */

import { colorize } from '../utils/colors.js';
import { ICON } from '../utils/emoji.js';
import { truncate } from '../utils/formatters.js';
import { clock, emptyLine, header, type ViewContext } from './shared.js';

export const MAX_ERROR_LINES = 15;
const MESSAGE_CHARS = 60;
const DENIED_RE = /denied|not allowed|blocked/i;

export function renderErrors(v: ViewContext): string[] {
  const { t, theme } = v;
  const errors = v.transcript.toolErrors;
  if (errors.length === 0) return [header(v, ICON.warning, t.errors), emptyLine(v, t.emptyErrors)];

  const lines = [header(v, ICON.warning, t.errors, String(errors.length))];
  for (const e of errors.slice(-MAX_ERROR_LINES).reverse()) {
    const marker = DENIED_RE.test(e.message) ? ICON.noEntry : colorize('✗', theme.danger);
    const tool = e.target ? `${e.tool}(${e.target})` : e.tool;
    lines.push(
      `${marker} ${colorize(clock(e.at), theme.secondary)}  ${colorize(tool, theme.model)}  ${colorize(truncate(e.message, MESSAGE_CHARS), theme.secondary)}`
    );
  }
  return lines;
}
