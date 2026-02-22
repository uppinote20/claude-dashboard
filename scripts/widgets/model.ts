/**
 * Model widget - displays current Claude model name with effort level and fast mode
 *
 * Effort level: Shown for Opus and Sonnet (H/M/L), hidden for Haiku
 * Fast mode: Opus 4.6 exclusive feature, indicated by ↯ symbol
 */

import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import type { Widget } from './base.js';
import type { WidgetContext, ModelData, EffortLevel } from '../types.js';
import { RESET, getTheme } from '../utils/colors.js';
import { shortenModelName } from '../utils/formatters.js';
import { isZaiProvider } from '../utils/provider.js';

const EFFORT_LEVELS = new Set<string>(['high', 'medium', 'low']);

function isEffortLevel(value: unknown): value is EffortLevel {
  return typeof value === 'string' && EFFORT_LEVELS.has(value);
}

interface ModelSettings {
  effortLevel: EffortLevel;
  fastMode: boolean;
}

const DEFAULT_SETTINGS: ModelSettings = { effortLevel: 'high', fastMode: false };

let settingsCache: (ModelSettings & { mtime: number }) | null = null;

async function getModelSettings(): Promise<ModelSettings> {
  const settingsPath = join(homedir(), '.claude', 'settings.json');

  try {
    const fileStat = await stat(settingsPath);
    if (settingsCache && settingsCache.mtime === fileStat.mtimeMs) {
      return { effortLevel: settingsCache.effortLevel, fastMode: settingsCache.fastMode };
    }
    const content = await readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(content);
    const effortLevel: EffortLevel = isEffortLevel(settings.effortLevel)
      ? settings.effortLevel
      : 'high';
    const fastMode = settings.fastMode === true;
    settingsCache = { mtime: fileStat.mtimeMs, effortLevel, fastMode };
    return { effortLevel, fastMode };
  } catch {
    settingsCache = null;
  }

  const envEffort = process.env.CLAUDE_CODE_EFFORT_LEVEL;
  if (isEffortLevel(envEffort)) {
    return { effortLevel: envEffort, fastMode: false };
  }

  return DEFAULT_SETTINGS;
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
    const icon = isZaiProvider() ? '🟠' : '🤖';

    // Show effort suffix for Opus and Sonnet: (H), (M), (L). Haiku excluded.
    const supportsEffort = shortName === 'Opus' || shortName === 'Sonnet';
    const effortSuffix = supportsEffort
      ? `(${data.effortLevel[0].toUpperCase()})`
      : '';

    // Fast mode indicator (Opus 4.6 exclusive)
    const fastIndicator = shortName === 'Opus' && data.fastMode ? ' ↯' : '';

    return `${getTheme().model}${icon} ${shortName}${effortSuffix}${fastIndicator}${RESET}`;
  },
};
