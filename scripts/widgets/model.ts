/**
 * Model widget - displays current Claude model name with effort level and fast mode
 * @handbook 2.1-naming-conventions
 *
 * Effort level: Shown for Opus and Sonnet (H/M/L), hidden for Haiku
 * Fast mode: Opus 4.6 exclusive feature, indicated by ↯ symbol
 * @handbook 3.3-widget-data-sources
 * @tested scripts/__tests__/widgets.test.ts
 */

import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import type { Widget } from './base.js';
import type { WidgetContext, ModelData, EffortLevel } from '../types.js';
import { RESET, getTheme } from '../utils/colors.js';
import { shortenModelName } from '../utils/formatters.js';
import { isZaiProvider } from '../utils/provider.js';

const EFFORT_LEVELS = new Set<string>(['xhigh', 'high', 'medium', 'low']);

function isEffortLevel(value: unknown): value is EffortLevel {
  return typeof value === 'string' && EFFORT_LEVELS.has(value);
}

interface ModelSettings {
  effortLevel: EffortLevel;
  fastMode: boolean;
}

function getDefaultEffort(): EffortLevel {
  return 'high';
}

let settingsCache: { rawEffort: unknown; fastMode: boolean; mtime: number } | null = null;

async function getModelSettings(): Promise<ModelSettings> {
  const defaultEffort = getDefaultEffort();
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
    const { effortLevel, fastMode } = await getModelSettings();

    return {
      id: model?.id || '',
      displayName: model?.display_name || '-',
      effortLevel,
      fastMode,
    };
  },

  render(data: ModelData): string {
    const shortName = shortenModelName(data.displayName);
    const icon = isZaiProvider() ? '🟠' : '◆';

    // Haiku excluded from effort badge
    const supportsEffort = shortName === 'Opus' || shortName === 'Sonnet';
    const effortSuffix = supportsEffort
      ? `(${data.effortLevel[0].toUpperCase()})`
      : '';

    // Fast mode indicator (Opus 4.6 exclusive)
    const fastIndicator = shortName === 'Opus' && data.fastMode ? ' ↯' : '';

    return `${getTheme().model}${icon} ${shortName}${effortSuffix}${fastIndicator}${RESET}`;
  },
};
