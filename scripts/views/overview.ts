/**
 * Overview: the pane's dashboard tab as titled sections (usage, context, cost, session) instead
 * of statusLine widget lines. Drawn when `modPane` yields no widgets (isPaneOverview). Reuses
 * each widget's getData()/render(), so it adds layout only; a disabled, empty or failing
 * widget drops its row, and a section with no rows drops its title.
 * @handbook 9.6-pane-overview
 * @tested scripts/__tests__/pane-overview.test.ts
 */

import type { ContextData, RateLimitData, Translations, WidgetContext, WidgetId } from '../types.js';
import { getWidget } from '../widgets/index.js';
import { colorize, getColorForPercent, getTheme } from '../utils/colors.js';
import { debugLog } from '../utils/debug.js';
import { ICON } from '../utils/emoji.js';
import { formatTimeRemaining, formatTokens } from '../utils/formatters.js';
import { DEFAULT_PROGRESS_BAR_CONFIG, renderProgressBar } from '../utils/progress-bar.js';

// Width-agnostic: the renderer never learns the pane width, so every line stays near 50 columns.
const RULE_WIDTH = 48;
const LABEL_WIDTH = 8;
const GAUGE = { ...DEFAULT_PROGRESS_BAR_CONFIG, width: 20 };

const LIMIT_ROWS: Array<{ id: WidgetId; label: keyof Translations['labels'] }> = [
  { id: 'rateLimit5h', label: '5h' },
  { id: 'rateLimit7d', label: '7d_all' },
  { id: 'rateLimit7dSonnet', label: '7d_sonnet' },
  { id: 'rateLimit7dFable', label: '7d_fable' },
];
const OTHER_CLI_WIDGETS: WidgetId[] = ['codexUsage', 'geminiUsage', 'antigravityUsage', 'zaiUsage'];
const COST_WIDGETS: WidgetId[] = ['cost', 'todayCost', 'forecast', 'budget'];
const SESSION_LINES: WidgetId[][] = [
  ['model', 'sessionDuration', 'promptCache'],
  ['projectInfo', 'linesChanged'],
];

export async function renderOverview(ctx: WidgetContext): Promise<string> {
  const t = ctx.translations.overview;
  const sections = await Promise.all([
    section(t.usage, usageRows(ctx)),
    section(t.context, contextRows(ctx)),
    section(t.cost, joinedRows([COST_WIDGETS], ctx)),
    section(t.session, joinedRows(SESSION_LINES, ctx)),
  ]);
  return sections.filter((s) => s.length > 0).map((s) => s.join('\n')).join('\n\n');
}

async function section(title: string, rows: Promise<string[]>): Promise<string[]> {
  const body = await rows;
  if (body.length === 0) return [];
  const rule = '─'.repeat(Math.max(0, RULE_WIDTH - displayWidth(title) - 2));
  return [colorize(` ${title} ${rule}`, getTheme().secondary), ...body];
}

async function usageRows(ctx: WidgetContext): Promise<string[]> {
  const limits = await Promise.all(LIMIT_ROWS.map((row) => widgetData<RateLimitData>(row.id, ctx)));
  // rateLimit5h alone reports a failed fetch, so its error stands for every limit row.
  if (limits[0]?.isError) {
    return [colorize(`  ${ICON.warning} ${ctx.translations.overview.usageUnavailable}`, getTheme().warning)];
  }
  const rows = LIMIT_ROWS.flatMap((row, i) => {
    const data = limits[i];
    if (!data) return [];
    const reset = data.resetsAt ? `  ${formatTimeRemaining(data.resetsAt, ctx.translations)}` : '';
    return [`  ${padDisplay(ctx.translations.labels[row.label], LABEL_WIDTH)}${gauge(data.utilization)}${reset}`];
  });
  const others = await Promise.all(OTHER_CLI_WIDGETS.map((id) => widgetText(id, ctx)));
  return [...rows, ...others.filter((s): s is string => s !== null).map((s) => `  ${s}`)];
}

async function contextRows(ctx: WidgetContext): Promise<string[]> {
  const [context, breakdown] = await Promise.all([
    widgetData<ContextData>('context', ctx),
    widgetText('tokenBreakdown', ctx),
  ]);
  const rows: string[] = [];
  if (context) {
    // Input tokens fill the window; output counts toward the next turn (same as the context widget).
    const usage = `${formatTokens(context.inputTokens)} / ${formatTokens(context.contextSize)}`;
    rows.push(`  ${gauge(context.percentage)}  ${colorize(usage, getTheme().secondary)}`);
  }
  if (breakdown) rows.push(`  ${breakdown}`);
  return rows;
}

// One row per group: the group's rendered widgets joined with a dot, empty groups dropped.
async function joinedRows(groups: WidgetId[][], ctx: WidgetContext): Promise<string[]> {
  const rendered = await Promise.all(groups.map((ids) => Promise.all(ids.map((id) => widgetText(id, ctx)))));
  const dot = colorize(' · ', getTheme().secondary);
  return rendered
    .map((texts) => texts.filter((s): s is string => s !== null).join(dot))
    .filter((row) => row.length > 0)
    .map((row) => `  ${row}`);
}

function gauge(percent: number): string {
  const pct = `${Math.round(percent)}%`.padStart(5);
  return `${renderProgressBar(percent, GAUGE)}${colorize(pct, getColorForPercent(percent))}`;
}

async function widgetData<T>(id: WidgetId, ctx: WidgetContext): Promise<T | null> {
  const widget = ctx.config.disabledWidgets?.includes(id) ? undefined : getWidget(id);
  if (!widget) return null;
  try {
    return (await widget.getData(ctx)) as T | null;
  } catch (error) {
    debugLog('overview', `Widget '${id}' failed`, error);
    return null;
  }
}

async function widgetText(id: WidgetId, ctx: WidgetContext): Promise<string | null> {
  const data = await widgetData<never>(id, ctx);
  if (data === null) return null;
  try {
    return getWidget(id)!.render(data, ctx) || null;
  } catch (error) {
    debugLog('overview', `Widget '${id}' render failed`, error);
    return null;
  }
}

// Hangul and other wide characters take two terminal columns, so localized labels pad by width.
function padDisplay(text: string, width: number): string {
  return text + ' '.repeat(Math.max(1, width - displayWidth(text)));
}

function displayWidth(text: string): number {
  let width = 0;
  for (const ch of text) width += /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿＀-｠]/.test(ch) ? 2 : 1;
  return width;
}
