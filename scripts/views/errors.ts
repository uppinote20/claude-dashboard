/**
 * Errors view: failed tool calls, newest first — the ones that scroll past unnoticed.
 * @handbook 9.5-pane-views
 * @tested scripts/__tests__/pane-views.test.ts
 */

import { colorize } from '../utils/colors.js';
import { ICON } from '../utils/emoji.js';
import { truncate } from '../utils/formatters.js';
import { toolLabel } from '../utils/transcript-parser.js';
import { clock, emptyView, header, type ViewContext } from './shared.js';

const MAX_ERROR_LINES = 15;
const MESSAGE_CHARS = 60;
const DENIED_RE = /denied|not allowed|blocked/i;

export function renderErrors(v: ViewContext): string[] {
  const { t, theme } = v;
  const errors = v.transcript.toolErrors;
  if (errors.length === 0) return emptyView(v, ICON.warning, t.errors, t.emptyErrors);

  const lines = [header(v, ICON.warning, t.errors, String(errors.length))];
  for (const e of errors.slice(-MAX_ERROR_LINES).reverse()) {
    const marker = DENIED_RE.test(e.message) ? ICON.noEntry : colorize('✗', theme.danger);
    const tool = toolLabel(e.tool, e.target);
    lines.push(
      `${marker} ${colorize(clock(e.at), theme.secondary)}  ${colorize(tool, theme.model)}  ${colorize(truncate(e.message, MESSAGE_CHARS), theme.secondary)}`
    );
  }
  return lines;
}
