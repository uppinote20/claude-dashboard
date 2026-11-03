/**
 * @handbook 8.1-test-structure
 * @covers scripts/views/overview.ts
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderOverview } from '../views/overview.js';
import { codexUsageWidget } from '../widgets/codex-usage.js';
import type { Config, UsageLimits, WidgetContext, WidgetId } from '../types.js';
import { MOCK_CONFIG, MOCK_STDIN, MOCK_TRANSLATIONS } from './fixtures.js';

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

// Widgets that touch the filesystem, git or other CLIs; tests opt back in where needed.
const IO_WIDGETS: WidgetId[] = [
  'sessionDuration', 'todayCost', 'budget', 'forecast', 'projectInfo', 'linesChanged',
  'codexUsage', 'geminiUsage', 'antigravityUsage', 'zaiUsage',
];

const LIMITS: UsageLimits = {
  five_hour: { utilization: 42, resets_at: null },
  seven_day: { utilization: 9, resets_at: null },
  seven_day_sonnet: null,
  seven_day_fable: { utilization: 0, resets_at: null },
};

function ctx(rateLimits: UsageLimits | null, config: Partial<Config> = {}): WidgetContext {
  return {
    stdin: MOCK_STDIN,
    config: { ...MOCK_CONFIG, disabledWidgets: IO_WIDGETS, ...config },
    translations: MOCK_TRANSLATIONS,
    rateLimits,
  };
}

async function render(rateLimits: UsageLimits | null, config: Partial<Config> = {}): Promise<string[]> {
  return strip(await renderOverview(ctx(rateLimits, config))).split('\n');
}

describe('renderOverview', () => {
  afterEach(() => vi.restoreAllMocks());

  it('draws each rate limit as an aligned gauge row under USAGE', async () => {
    const lines = await render(LIMITS);
    expect(lines[0]).toMatch(/^ USAGE ─+$/);
    expect(lines).toContainEqual(expect.stringMatching(/^ {2}5h {6}█{8}░{12} {2}42%$/));
    expect(lines).toContainEqual(expect.stringMatching(/^ {2}7d {6}█{2}░{18} {3}9%$/));
    expect(lines).toContainEqual(expect.stringMatching(/^ {2}7d-F {4}░{20} {3}0%$/));
  });

  it('aligns gauges by display width when labels are Korean (two columns per Hangul)', async () => {
    const translations = {
      ...MOCK_TRANSLATIONS,
      labels: { ...MOCK_TRANSLATIONS.labels, '5h': '5시간', '7d_all': '7일', '7d_fable': '7일-F' },
    };
    const out = strip(await renderOverview({ ...ctx(LIMITS), translations })).split('\n');
    const columns = out
      .filter((l) => /[█░]{20}/.test(l))
      .slice(0, 3)
      .map((l) => [...l.slice(0, l.search(/[█░]/))].reduce((w, ch) => w + (/[가-힣]/.test(ch) ? 2 : 1), 0));
    expect(columns).toEqual([10, 10, 10]);
  });

  it('hides the 5h row when the account has no 5h window (verified Ultra)', async () => {
    const lines = await render({ ...LIMITS, five_hour: null });
    expect(lines.some((l) => l.includes('5h'))).toBe(false);
    expect(lines.some((l) => l.includes('⚠️'))).toBe(false);
    expect(lines).toContainEqual(expect.stringMatching(/^ {2}7d /));
  });

  it('shows one warning row when rate limits could not be fetched', async () => {
    const lines = await render(null);
    expect(lines[0]).toMatch(/^ USAGE/);
    expect(lines[1]).toMatch(/⚠️/);
    expect(lines[1]).toContain(MOCK_TRANSLATIONS.overview.usageUnavailable);
  });

  it('hides another CLI row in its error state but shows it with data', async () => {
    const enabled = { disabledWidgets: IO_WIDGETS.filter((id) => id !== 'codexUsage') };
    const codex = { model: 'gpt', planType: 'plus', primaryPercent: 12, primaryResetAt: null, secondaryPercent: null, secondaryResetAt: null };

    vi.spyOn(codexUsageWidget, 'getData').mockResolvedValue({ ...codex, primaryPercent: null, isError: true });
    expect((await render(LIMITS, enabled)).some((l) => l.includes('⚠️'))).toBe(false);

    vi.spyOn(codexUsageWidget, 'getData').mockResolvedValue(codex);
    expect(await render(LIMITS, enabled)).toContainEqual(expect.stringMatching(/^ {2}.*gpt.*12%/));
  });

  it('drops rows for disabled widgets', async () => {
    const lines = await render(LIMITS, { disabledWidgets: [...IO_WIDGETS, 'rateLimit7d'] });
    expect(lines.some((l) => /^ {2}7d /.test(l))).toBe(false);
    expect(lines).toContainEqual(expect.stringMatching(/^ {2}5h /));
  });

  it('draws the context gauge with used and total tokens', async () => {
    const lines = await render(LIMITS);
    const at = lines.findIndex((l) => l.startsWith(' CONTEXT'));
    expect(at).toBeGreaterThan(0);
    expect(lines[at + 1]).toMatch(/^ {2}[█░]{20} +\d+% {2}\S+ \/ 200K$/);
  });

  it('lists session cost under COST and hides the section when every cost widget is off', async () => {
    const shown = await render(LIMITS);
    const at = shown.findIndex((l) => l.startsWith(' COST'));
    expect(shown[at + 1]).toContain('$0.75');

    const hidden = await render(LIMITS, { disabledWidgets: [...IO_WIDGETS, 'cost'] });
    expect(hidden.some((l) => l.startsWith(' COST'))).toBe(false);
  });

  it('separates sections with a blank line and never ends with one', async () => {
    const lines = await render(LIMITS);
    const titles = lines.filter((l) => /^ [A-Z]+ ─+$/.test(l));
    expect(titles.length).toBeGreaterThanOrEqual(3);
    for (const title of titles.slice(1)) expect(lines[lines.indexOf(title) - 1]).toBe('');
    expect(lines[lines.length - 1]).not.toBe('');
  });
});
