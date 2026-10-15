/**
 * @covers scripts/mod/toggle.ts
 */
import { describe, it, expect } from 'vitest';
import { resolvePaneCommand, resolveToggle } from '../mod/toggle.js';

describe('resolveToggle', () => {
  it.each([
    ['on', false, true], ['on', true, true],
    ['off', true, false], ['off', false, false],
    [' ON ', false, true], ['Off', true, false],
  ])('%j with current=%s -> %s', (args, current, expected) => {
    expect(resolveToggle(args, current)).toBe(expected);
  });

  it('flips the current state without an argument', () => {
    expect(resolveToggle('', false)).toBe(true);
    expect(resolveToggle('   ', true)).toBe(false);
  });

  it('rejects anything else so the caller can show usage', () => {
    expect(resolveToggle('open', false)).toBeNull();
    expect(resolveToggle('on off', false)).toBeNull();
  });
});

describe('resolvePaneCommand', () => {
  it('opens on a named view, or switches an open pane in place', () => {
    expect(resolvePaneCommand('turns', false, 'dashboard')).toEqual({ open: true, view: 'turns' });
    expect(resolvePaneCommand(' Agents ', true, 'turns')).toEqual({ open: true, view: 'agents' });
    expect(resolvePaneCommand('dashboard', true, 'bg')).toEqual({ open: true, view: 'dashboard' });
  });

  it('on / off / toggle keep the last view', () => {
    expect(resolvePaneCommand('', false, 'files')).toEqual({ open: true, view: 'files' });
    expect(resolvePaneCommand('off', true, 'files')).toEqual({ open: false, view: 'files' });
    expect(resolvePaneCommand('on', false, 'errors')).toEqual({ open: true, view: 'errors' });
  });

  it('rejects anything else', () => {
    expect(resolvePaneCommand('history', false, 'dashboard')).toBeNull();
  });
});
