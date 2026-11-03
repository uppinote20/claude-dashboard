/**
 * @covers scripts/utils/render-mode.ts
 */
import { describe, it, expect } from 'vitest';
import { resolveRenderMode, resolveModLayout } from '../utils/render-mode.js';
import { DEFAULT_CONFIG, type Config } from '../types.js';

describe('resolveRenderMode', () => {
  it('is a plain statusLine render without mod env', () => {
    expect(resolveRenderMode({})).toEqual({ fromMod: false });
  });

  it('reads the surface only from the mod', () => {
    expect(resolveRenderMode({ CLAUDE_DASHBOARD_MOD: '1', CLAUDE_DASHBOARD_SURFACE: 'pane' }))
      .toEqual({ fromMod: true, surface: 'pane' });
    expect(resolveRenderMode({ CLAUDE_DASHBOARD_SURFACE: 'pane' })).toEqual({ fromMod: false });
  });

  it('reads a pane view only for the pane surface', () => {
    const pane = { CLAUDE_DASHBOARD_MOD: '1', CLAUDE_DASHBOARD_SURFACE: 'pane' };
    expect(resolveRenderMode({ ...pane, CLAUDE_DASHBOARD_PANE_VIEW: 'turns' }))
      .toEqual({ fromMod: true, surface: 'pane', paneView: 'turns' });
    expect(resolveRenderMode({ ...pane, CLAUDE_DASHBOARD_PANE_VIEW: 'dashboard' }))
      .toEqual({ fromMod: true, surface: 'pane' });
    expect(resolveRenderMode({ ...pane, CLAUDE_DASHBOARD_PANE_VIEW: 'bogus' }))
      .toEqual({ fromMod: true, surface: 'pane' });
    expect(resolveRenderMode({ CLAUDE_DASHBOARD_MOD: '1', CLAUDE_DASHBOARD_SURFACE: 'band', CLAUDE_DASHBOARD_PANE_VIEW: 'turns' }))
      .toEqual({ fromMod: true, surface: 'band' });
  });

  it('ignores unknown surfaces', () => {
    expect(resolveRenderMode({ CLAUDE_DASHBOARD_MOD: '1', CLAUDE_DASHBOARD_SURFACE: 'huge' }))
      .toEqual({ fromMod: true });
  });

  it('band off wins over band session', () => {
    expect(resolveRenderMode({
      CLAUDE_DASHBOARD_MOD: '1',
      CLAUDE_DASHBOARD_BAND_SESSION: 'a',
      CLAUDE_DASHBOARD_BAND_OFF: 'a',
    })).toEqual({ fromMod: true, clearSession: 'a' });
  });

  it('a band session marks and implies the band surface', () => {
    expect(resolveRenderMode({ CLAUDE_DASHBOARD_MOD: '1', CLAUDE_DASHBOARD_BAND_SESSION: 'a' }))
      .toEqual({ fromMod: true, surface: 'band', markSession: 'a' });
  });

  it('asks for mod settings', () => {
    expect(resolveRenderMode({ CLAUDE_DASHBOARD_MOD: '1', CLAUDE_DASHBOARD_MOD_SETTINGS: '1' }))
      .toEqual({ fromMod: true, printSettings: true });
  });
});

describe('resolveModLayout', () => {
  const config = (extra: Partial<Config> = {}): Config => ({ ...DEFAULT_CONFIG, ...extra });

  it('pane defaults to detailed', () => {
    expect(resolveModLayout(config(), 'pane')).toEqual({ displayMode: 'detailed', lines: undefined });
  });

  it('band defaults to the statusLine layout', () => {
    expect(resolveModLayout(config(), 'band')).toEqual({});
  });

  it('accepts a display mode name', () => {
    expect(resolveModLayout(config({ modBand: 'normal' }), 'band')).toEqual({ displayMode: 'normal', lines: undefined });
  });

  it('accepts a preset string', () => {
    expect(resolveModLayout(config({ modPane: 'MC|$' }), 'pane'))
      .toEqual({ displayMode: 'custom', lines: [['model', 'context'], ['cost']] });
  });

  const known = (id: string) => ['model', 'context', 'cost', 'sessionIdFull'].includes(id);

  it('accepts custom widget lines', () => {
    expect(resolveModLayout(config({ modPane: [['model', 'context'], ['sessionIdFull']] }), 'pane', known))
      .toEqual({ displayMode: 'custom', lines: [['model', 'context'], ['sessionIdFull']] });
    expect(resolveModLayout(config({ modBand: [['cost']] }), 'band', known))
      .toEqual({ displayMode: 'custom', lines: [['cost']] });
  });

  it('drops unknown widget ids and lines left empty', () => {
    const modPane = [['model', 'nope'], ['ghost'], [42, 'cost']] as unknown as Config['modPane'];
    expect(resolveModLayout(config({ modPane }), 'pane', known))
      .toEqual({ displayMode: 'custom', lines: [['model'], ['cost']] });
  });

  it('falls back when custom lines leave nothing to draw', () => {
    const modPane = [['ghost'], []] as unknown as Config['modPane'];
    expect(resolveModLayout(config({ modPane }), 'pane', known))
      .toEqual({ displayMode: 'detailed', lines: undefined });
    expect(resolveModLayout(config({ modBand: [] }), 'band', known)).toEqual({});
    const modBand = { lines: [] } as unknown as Config['modBand'];
    expect(resolveModLayout(config({ modBand }), 'band', known)).toEqual({});
  });

  it('falls back on an unparsable value', () => {
    expect(resolveModLayout(config({ modPane: '~~' }), 'pane')).toEqual({ displayMode: 'detailed', lines: undefined });
    expect(resolveModLayout(config({ modBand: '~~' }), 'band')).toEqual({});
  });
});
