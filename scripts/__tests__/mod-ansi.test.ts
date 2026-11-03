/**
 * @covers scripts/mod/ansi.ts
 */
import { describe, it, expect } from 'vitest';
import { parseAnsi, parseOutput, ansi256ToHex } from '../mod/ansi.js';

describe('parseAnsi', () => {
  it('returns plain text as one segment', () => {
    expect(parseAnsi('hello')).toEqual([{ text: 'hello' }]);
  });

  it('maps truecolor, 256 and basic colours to hex', () => {
    expect(parseAnsi('\x1b[38;2;255;0;16mA\x1b[0m')).toEqual([{ text: 'A', color: '#ff0010' }]);
    expect(parseAnsi('\x1b[38;5;196mB\x1b[0m')).toEqual([{ text: 'B', color: '#ff0000' }]);
    expect(parseAnsi('\x1b[36mC\x1b[39m')).toEqual([{ text: 'C', color: '#00cdcd' }]);
  });

  it('tracks bold/dim and resets', () => {
    expect(parseAnsi('\x1b[1;2mX\x1b[22mY\x1b[0mZ')).toEqual([
      { text: 'X', bold: true, dim: true }, { text: 'Y' }, { text: 'Z' },
    ]);
  });

  it('strips OSC 8 hyperlinks and unknown CSI codes', () => {
    const line = '\x1b]8;;https://x.dev\x07link\x1b]8;;\x07 \x1b[4mU\x1b[K';
    const segs = parseAnsi(line);
    expect(segs.map(s => s.text).join('')).toBe('link U');
    expect(JSON.stringify(segs)).not.toContain('\\u001b');
  });

  it('leaves no control character the engine would refuse', () => {
    const segs = parseAnsi('a\x1bb\tc\rd\x07e\x1b[38;2;1;2;3');
    expect(segs.map(s => s.text).join('')).toBe('ab cde');
    // eslint-disable-next-line no-control-regex
    expect(segs.every(s => !/[\x00-\x1f\x7f]/.test(s.text))).toBe(true);
  });

  it('drops empty segments between adjacent codes', () => {
    expect(parseAnsi('\x1b[31m\x1b[1mR')).toEqual([{ text: 'R', color: '#cd0000', bold: true }]);
  });
});

describe('ansi256ToHex', () => {
  it.each([[0, '#000000'], [15, '#ffffff'], [16, '#000000'], [231, '#ffffff'], [232, '#080808'], [255, '#eeeeee']])(
    '%i -> %s', (n, hex) => { expect(ansi256ToHex(n)).toBe(hex); },
  );
});

describe('parseOutput', () => {
  it('keeps blank lines between content as one-space rows so they take height', () => {
    expect(parseOutput('a\n\nb')).toEqual([[{ text: 'a' }], [{ text: ' ' }], [{ text: 'b' }]]);
  });

  it('drops blank lines at either end, including the trailing newline', () => {
    expect(parseOutput('\na\n\n')).toEqual([[{ text: 'a' }]]);
    expect(parseOutput('')).toEqual([]);
  });
});
