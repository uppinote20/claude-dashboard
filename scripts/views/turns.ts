/**
 * Turns view: one line per user prompt, newest first, with what the turn cost.
 * @handbook 9.5-pane-views
 */

import { colorize } from '../utils/colors.js';
import { ICON } from '../utils/emoji.js';
import { formatElapsed, formatTokens, sparkline, truncate } from '../utils/formatters.js';
import { clock, emptyLine, header, isSessionIdle, type ViewContext } from './shared.js';

export const MAX_TURN_LINES = 20;
const PROMPT_CHARS = 48;

export function renderTurns(v: ViewContext): string[] {
  const { transcript, t, theme, now } = v;
  const turns = transcript.turns;
  if (turns.length === 0) return [header(v, ICON.scroll, t.turns), emptyLine(v, t.emptyTurns)];

  const recent = turns.slice(-MAX_TURN_LINES);
  const spark = colorize(sparkline(recent.map((x) => x.tokensIn + x.tokensOut)), theme.info);
  const lines = [header(v, ICON.scroll, t.turns, String(transcript.turnCount), spark)];

  // The newest turn is still going until the main thread comes to rest (or goes quiet).
  const lastRunning = transcript.lastStopReason !== 'end_turn' && !isSessionIdle(v);
  for (let i = recent.length - 1; i >= 0; i--) {
    const turn = recent[i];
    const isLast = i === recent.length - 1;
    const number = transcript.turnCount - (recent.length - 1 - i);
    const elapsed = formatElapsed((isLast && lastRunning ? now : turn.lastAt) - turn.at);
    const marker = isLast ? colorize('▶', theme.accent) : ' ';
    const prompt = colorize(truncate(turn.prompt, PROMPT_CHARS), isLast ? theme.accent : theme.model);
    const meta = [
      elapsed,
      `↑${formatTokens(turn.tokensIn)} ↓${formatTokens(turn.tokensOut)}`,
      turn.tools > 0 ? `${ICON.wrench}${turn.tools}` : '',
      turn.agents > 0 ? `${ICON.robot}${turn.agents}` : '',
    ].filter(Boolean).join('  ');
    lines.push(`${marker} ${colorize(`#${number} ${clock(turn.at)}`, theme.secondary)}  ${prompt}  ${colorize(meta, theme.secondary)}`);
  }
  return lines;
}
