/**
 * Centralized emoji icons with VS-16 (U+FE0F) variation selectors.
 *
 * Each value ends with an invisible U+FE0F byte — this forces emoji presentation
 * on terminals whose main monospace font (Nerd Fonts, JetBrains Mono, etc.)
 * bundles monochrome glyphs for default-emoji codepoints. Without VS-16 the
 * text glyph wins over the system's color emoji font, producing inconsistent
 * monochrome/colored rendering across users.
 *
 * Always import from here; do not hardcode emoji literals in widgets.
 *
 * Excluded by design: non-emoji typographic symbols (`◆ ✓ ↑ ↓ → ↯`) have
 * Unicode `Emoji=No` — no colored variant exists, VS-16 has no effect on them.
 * Those literals remain inline in widgets (e.g. `model.ts ◆`, `todo-progress.ts ✓`).
 *
 * @handbook 5.5-emoji-icons
 * @tested scripts/__tests__/emoji.test.ts
 */

export const ICON = {
  warning: '⚠️',
  gear: '⚙️',
  alarm: '🚨️',
  stopwatch: '⏱️',
  hourglass: '⏳️',
  zap: '⚡️',
  banknote: '💵️',
  moneyBag: '💰️',
  chartUp: '📈️',
  robot: '🤖️',
  person: '👤️',
  folder: '📁️',
  tree: '🌳️',
  label: '🏷️',
  package: '📦️',
  chart: '📊️',
  blueDiamond: '🔷️',
  gem: '💎️',
  antigravity: '🪐️',
  orangeCircle: '🟠️',
  greenCircle: '🟢️',
  yellowCircle: '🟡️',
  redCircle: '🔴️',
  fire: '🔥️',
  speech: '💬️',
  target: '🎯️',
  key: '🔑️',
} as const;
