/**
 * Turns the renderer's ANSI output into <Text> segments for the mod's Pane/AbovePrompt.
 * The engine refuses a whole tree when any text holds an escape character, so every escape
 * is consumed here; colours become hex (#rrggbb), the one format every surface renders
 * (`ansi256(n)` strings are not). Pure and Node-free: bundled into dist/mod.js.
 * @handbook 9.2-ansi-to-text
 * @tested scripts/__tests__/mod-ansi.test.ts
 */
export interface Segment {
  text: string;
  color?: string;
  bold?: boolean;
  dim?: boolean;
}

type Style = Omit<Segment, 'text'>;

// xterm defaults for SGR 30-37 / 90-97 (also ansi256 0-15).
const BASIC_HEX = [
  '#000000', '#cd0000', '#00cd00', '#cdcd00', '#0000ee', '#cd00cd', '#00cdcd', '#e5e5e5',
  '#7f7f7f', '#ff0000', '#00ff00', '#ffff00', '#5c5cff', '#ff00ff', '#00ffff', '#ffffff',
];
const CUBE = [0, 95, 135, 175, 215, 255];

const hex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`;

export function ansi256ToHex(n: number): string {
  if (n < 16) return BASIC_HEX[n];
  if (n < 232) {
    const i = n - 16;
    return hex(CUBE[Math.floor(i / 36)], CUBE[Math.floor(i / 6) % 6], CUBE[i % 6]);
  }
  const level = 8 + (n - 232) * 10;
  return hex(level, level, level);
}

function applySgr(style: Style, params: string): Style {
  const codes = params === '' ? [0] : params.split(';').map(Number);
  let next: Style = { ...style };
  for (let i = 0; i < codes.length; i++) {
    const c = codes[i];
    if (c === 0) next = {};
    else if (c === 1) next.bold = true;
    else if (c === 2) next.dim = true;
    else if (c === 22) { delete next.bold; delete next.dim; }
    else if (c === 39) delete next.color;
    else if (c >= 30 && c <= 37) next.color = BASIC_HEX[c - 30];
    else if (c >= 90 && c <= 97) next.color = BASIC_HEX[c - 90 + 8];
    else if (c === 38 && codes[i + 1] === 5) { next.color = ansi256ToHex(codes[i + 2]); i += 2; }
    else if (c === 38 && codes[i + 1] === 2) { next.color = hex(codes[i + 2], codes[i + 3], codes[i + 4]); i += 4; }
    // Other SGR codes (underline, background, …) are not used by colors.ts and are dropped.
  }
  return next;
}

const OSC = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;
const CSI = /\x1b\[([0-9;]*)([A-Za-z])/g;
const TRUNCATED_CSI = /\x1b\[[0-9;]*$/;
// Anything left after the escapes are consumed: a lone ESC, BEL, CR, … would make the engine
// refuse the whole tree, so it is dropped (a tab becomes a space).
// eslint-disable-next-line no-control-regex
const CONTROL = /[\x00-\x08\x0a-\x1f\x7f]/g;
const toText = (raw: string) => raw.replace(/\t/g, ' ').replace(CONTROL, '');

/**
 * Renderer stdout → rows. Blank lines at either end (the trailing newline) are dropped; a blank
 * line between content becomes a one-space row, since an empty <Text> takes no height.
 */
export function parseOutput(stdout: string): Segment[][] {
  const lines = stdout.split('\n');
  const first = lines.findIndex(l => l.length > 0);
  if (first < 0) return [];
  const last = lines.findLastIndex(l => l.length > 0);
  return lines.slice(first, last + 1).map(l => (l.length > 0 ? parseAnsi(l) : [{ text: ' ' }]));
}

export function parseAnsi(line: string): Segment[] {
  const clean = line.replace(OSC, '').replace(TRUNCATED_CSI, '');
  const out: Segment[] = [];
  let style: Style = {};
  let last = 0;
  const push = (raw: string) => {
    const text = toText(raw);
    if (text) out.push({ text, ...style });
  };
  for (const m of clean.matchAll(CSI)) {
    push(clean.slice(last, m.index));
    if (m[2] === 'm') style = applySgr(style, m[1]);
    last = m.index! + m[0].length;
  }
  push(clean.slice(last));
  return out;
}
