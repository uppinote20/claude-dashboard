/**
 * Model widget - displays current Claude model name with effort level and fast mode
 * @handbook 2.1-naming-conventions
 *
 * Effort level: Shown for Opus, Sonnet, and Fable (MAX/X/H/M/L), hidden for Haiku
 * Fast mode: Opus 4.7/4.8 exclusive feature, indicated by ↯ symbol
 * @handbook 3.3-widget-data-sources
 * @tested scripts/__tests__/widgets.test.ts
 */

import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import type { Widget } from './base.js';
import type { WidgetContext, ModelData, EffortLevel } from '../types.js';
import { RESET, getTheme } from '../utils/colors.js';
import { ICON } from '../utils/emoji.js';
import { shortenModelName } from '../utils/formatters.js';
import { isZaiProvider } from '../utils/provider.js';

/**
 * Effort badge labels, ordered high→low. An explicit map (not `effortLevel[0]`)
 * because 'max' and 'medium' both start with 'M'. Typing it as
 * Record<EffortLevel, string> makes the compiler require a label for every tier,
 * so a newly added EffortLevel can't silently render a wrong/blank badge.
 */
const EFFORT_BADGE: Record<EffortLevel, string> = {
  max: 'MAX',
  xhigh: 'X',
  high: 'H',
  medium: 'M',
  low: 'L',
};

/** Valid effort tiers, derived from the badge map so the two never drift. */
const EFFORT_LEVELS = new Set<string>(Object.keys(EFFORT_BADGE));

function isEffortLevel(value: unknown): value is EffortLevel {
  return typeof value === 'string' && EFFORT_LEVELS.has(value);
}

interface ModelSettings {
  effortLevel: EffortLevel;
  fastMode: boolean;
}

/**
 * Fallback effort when settings.json is absent or lacks `effortLevel`.
 * Mirrors Claude Code's runtime defaults so the badge matches actual behavior
 * for users who never ran `/effort`. Current-generation models — Opus 4.8,
 * Sonnet 5, Fable 5 — all default to 'high' (Haiku has no effort tier; render()
 * hides its badge). The `_modelId` param is kept as the seam for reintroducing
 * per-model defaults if a future model diverges.
 * (History: pre-5 Opus defaulted to xhigh, pre-5 Sonnet to medium.)
 */
export function getDefaultEffort(_modelId: string): EffortLevel {
  return 'high';
}

let settingsCache: { rawEffort: unknown; fastMode: boolean; mtime: number } | null = null;

async function getModelSettings(modelId: string): Promise<ModelSettings> {
  const defaultEffort = getDefaultEffort(modelId);
  const settingsPath = join(homedir(), '.claude', 'settings.json');

  try {
    const fileStat = await stat(settingsPath);
    if (settingsCache && settingsCache.mtime === fileStat.mtimeMs) {
      return {
        effortLevel: isEffortLevel(settingsCache.rawEffort) ? settingsCache.rawEffort : defaultEffort,
        fastMode: settingsCache.fastMode,
      };
    }
    const content = await readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(content);
    const rawEffort = settings.effortLevel;
    const fastMode = settings.fastMode === true;
    settingsCache = { mtime: fileStat.mtimeMs, rawEffort, fastMode };
    return {
      effortLevel: isEffortLevel(rawEffort) ? rawEffort : defaultEffort,
      fastMode,
    };
  } catch {
    settingsCache = null;
  }

  const envEffort = process.env.CLAUDE_CODE_EFFORT_LEVEL;
  if (isEffortLevel(envEffort)) {
    return { effortLevel: envEffort, fastMode: false };
  }

  return { effortLevel: defaultEffort, fastMode: false };
}

export const modelWidget: Widget<ModelData> = {
  id: 'model',
  name: 'Model',

  async getData(ctx: WidgetContext): Promise<ModelData | null> {
    const { model } = ctx.stdin;
    const modelId = model?.id || '';
    const { effortLevel, fastMode } = await getModelSettings(modelId);

    return {
      id: modelId,
      displayName: model?.display_name || '-',
      effortLevel,
      fastMode,
    };
  },

  render(data: ModelData): string {
    const shortName = shortenModelName(data.displayName);
    const icon = isZaiProvider() ? ICON.orangeCircle : '◆';

    // Effort badge shown for Opus/Sonnet/Fable; Haiku has no effort tier
    const supportsEffort =
      shortName === 'Opus' || shortName === 'Sonnet' || shortName === 'Fable';
    const effortSuffix = supportsEffort ? `(${EFFORT_BADGE[data.effortLevel]})` : '';

    // Fast mode indicator (Opus 4.7/4.8 exclusive)
    const fastIndicator = shortName === 'Opus' && data.fastMode ? ' ↯' : '';

    return `${getTheme().model}${icon} ${shortName}${effortSuffix}${fastIndicator}${RESET}`;
  },
};
