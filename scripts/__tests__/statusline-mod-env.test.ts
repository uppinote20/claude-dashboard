/**
 * @covers scripts/statusline.ts
 * @covers scripts/utils/render-mode.ts
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');
const SID = '11111111-2222-3333-4444-555555555555';
const STDIN = JSON.stringify({
  session_id: SID,
  model: { id: 'claude-opus-5-5', display_name: 'Opus 5.5' },
  workspace: { current_dir: '/tmp' },
  context_window: {
    total_input_tokens: 84000, total_output_tokens: 0, context_window_size: 200000,
    used_percentage: 42, remaining_percentage: 58, current_usage: null,
  },
  cost: { total_cost_usd: 1.23 },
});

let home: string;
const run = (env: Record<string, string> = {}) =>
  execFileSync('node', [path.join(ROOT, 'dist/index.js')], {
    input: STDIN,
    env: { PATH: process.env.PATH!, HOME: home, ...env },
    encoding: 'utf8',
  });
const writeConfig = (config: object) => {
  mkdirSync(path.join(home, '.claude'), { recursive: true });
  writeFileSync(path.join(home, '.claude', 'claude-dashboard.local.json'), JSON.stringify(config));
};
const marker = () => path.join(home, '.cache', 'claude-dashboard', `band-${SID}`);

beforeAll(() => { execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'ignore' }); });
beforeEach(() => { home = mkdtempSync(path.join(os.tmpdir(), 'cd-home-')); });
afterEach(() => { rmSync(home, { recursive: true, force: true }); });

describe('renderer under mod env', () => {
  it('renders normally without a marker', () => {
    expect(run()).toContain('42%');
  });

  it('band render marks the session and still prints', () => {
    const out = run({ CLAUDE_DASHBOARD_MOD: '1', CLAUDE_DASHBOARD_BAND_SESSION: SID });
    expect(out).toContain('42%');
    expect(existsSync(marker())).toBe(true);
  });

  it('statusLine render is suppressed while the band is active', () => {
    run({ CLAUDE_DASHBOARD_MOD: '1', CLAUDE_DASHBOARD_BAND_SESSION: SID });
    expect(run().trim()).toBe('');
  });

  it('pane session view replaces the widget dashboard', () => {
    // STDIN carries no transcript_path, so the view reports it instead of widgets.
    const out = run({ CLAUDE_DASHBOARD_MOD: '1', CLAUDE_DASHBOARD_SURFACE: 'pane', CLAUDE_DASHBOARD_PANE_VIEW: 'turns' });
    expect(out).toContain('Transcript not available yet');
    expect(out).not.toContain('42%');
  });

  it('pane render is not suppressed by an active band', () => {
    run({ CLAUDE_DASHBOARD_MOD: '1', CLAUDE_DASHBOARD_BAND_SESSION: SID });
    const out = run({ CLAUDE_DASHBOARD_MOD: '1', CLAUDE_DASHBOARD_SURFACE: 'pane' });
    expect(out.split('\n').filter(Boolean).length).toBeGreaterThan(1);
  });

  it('mod renders hide widgets that need current_usage the mod cannot supply', () => {
    const out = run({ CLAUDE_DASHBOARD_MOD: '1', CLAUDE_DASHBOARD_SURFACE: 'pane' });
    expect(out).not.toContain('📦');
    expect(run({ CLAUDE_DASHBOARD_DISPLAY_MODE: 'detailed' })).toBe(run());
  });

  it('pane uses modPane from the config', () => {
    writeConfig({ modPane: 'M|C' });
    const lines = run({ CLAUDE_DASHBOARD_MOD: '1', CLAUDE_DASHBOARD_SURFACE: 'pane' }).split('\n').filter(Boolean);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('Opus');
    expect(lines[1]).toContain('42%');
  });

  it('pane takes custom widget lines from modPane', () => {
    writeConfig({ modPane: [['model'], ['context'], ['notAWidget']] });
    const lines = run({ CLAUDE_DASHBOARD_MOD: '1', CLAUDE_DASHBOARD_SURFACE: 'pane' }).split('\n').filter(Boolean);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('Opus');
    expect(lines[1]).toContain('42%');
  });

  it('band keeps the statusLine layout unless modBand is set', () => {
    writeConfig({ preset: 'M|C' });
    const band = () => run({ CLAUDE_DASHBOARD_MOD: '1', CLAUDE_DASHBOARD_BAND_SESSION: SID }).split('\n').filter(Boolean);
    expect(band()).toHaveLength(2);
    writeConfig({ preset: 'M|C', modBand: 'C' });
    expect(band()).toHaveLength(1);
  });

  it('prints mod settings for the mod', () => {
    expect(JSON.parse(run({ CLAUDE_DASHBOARD_MOD: '1', CLAUDE_DASHBOARD_MOD_SETTINGS: '1' }))).toEqual({ bandDefault: false });
    writeConfig({ modBandDefault: true });
    expect(JSON.parse(run({ CLAUDE_DASHBOARD_MOD: '1', CLAUDE_DASHBOARD_MOD_SETTINGS: '1' }))).toEqual({ bandDefault: true });
  });

  it('band off clears the marker and statusLine returns', () => {
    run({ CLAUDE_DASHBOARD_MOD: '1', CLAUDE_DASHBOARD_BAND_SESSION: SID });
    expect(run({ CLAUDE_DASHBOARD_MOD: '1', CLAUDE_DASHBOARD_BAND_OFF: SID }).trim()).toBe('');
    expect(existsSync(marker())).toBe(false);
    expect(run()).toContain('42%');
  });
});
