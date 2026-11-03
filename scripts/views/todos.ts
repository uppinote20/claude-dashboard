/**
 * Todos view: the full todo / task list in list order.
 * @handbook 9.5-pane-views
 * @tested scripts/__tests__/pane-views.test.ts
 */

import { colorize } from '../utils/colors.js';
import { ICON } from '../utils/emoji.js';
import { extractTodoList } from '../utils/transcript-parser.js';
import { dim, emptyView, header, type ViewContext } from './shared.js';

export function renderTodos(v: ViewContext): string[] {
  const { t, theme } = v;
  const items = extractTodoList(v.transcript);
  if (items.length === 0) return emptyView(v, ICON.clipboard, t.todos, t.emptyTodos);

  const done = items.filter((i) => i.status === 'completed').length;
  const lines = [header(v, ICON.clipboard, t.todos, `${done}/${items.length}`)];
  for (const item of items) {
    if (item.status === 'completed') lines.push(dim(v, `✓ ${item.content}`));
    else if (item.status === 'in_progress') lines.push(colorize(`▶ ${item.content}`, theme.accent));
    else lines.push(`${colorize('○', theme.secondary)} ${item.content}`);
  }
  return lines;
}
