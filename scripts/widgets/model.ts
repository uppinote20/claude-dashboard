/**
 * Model widget - displays current Claude model name with effort level
 */

import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import type { Widget } from './base.js';
import type { WidgetContext, ModelData, EffortLevel } from '../types.js';
import { COLORS, RESET } from '../utils/colors.js';
import { shortenModelName } from '../utils/formatters.js';
import { isZaiProvider } from '../utils/provider.js';

const EFFORT_LEVELS = new Set<string>(['high', 'medium', 'low']);

function isEffortLevel(value: unknown): value is EffortLevel {
  return typeof value === 'string' && EFFORT_LEVELS.has(value);
}

let settingsCache: { mtime: number; effortLevel: EffortLevel } | null = null;

async function getEffortLevel(): Promise<EffortLevel> {
  const settingsPath = join(homedir(), '.claude', 'settings.json');

  try {
    const fileStat = await stat(settingsPath);
    if (settingsCache && settingsCache.mtime === fileStat.mtimeMs) {
      return settingsCache.effortLevel;
    }
    const content = await readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(content);
    const level: EffortLevel = isEffortLevel(settings.effortLevel)
      ? settings.effortLevel
      : 'high';
    settingsCache = { mtime: fileStat.mtimeMs, effortLevel: level };
    return level;
  } catch {
    settingsCache = null;
  }

  const envEffort = process.env.CLAUDE_CODE_EFFORT_LEVEL;
  if (isEffortLevel(envEffort)) {
    return envEffort;
  }

  return 'high';
}

export const modelWidget: Widget<ModelData> = {
  id: 'model',
  name: 'Model',

  async getData(ctx: WidgetContext): Promise<ModelData | null> {
    const { model } = ctx.stdin;
    const effortLevel = await getEffortLevel();

    return {
      id: model?.id || '',
      displayName: model?.display_name || '-',
      effortLevel,
    };
  },

  render(data: ModelData): string {
    const shortName = shortenModelName(data.displayName);
    const icon = isZaiProvider() ? '🟠' : '🤖';

    // Show effort suffix for Opus: (H), (M), (L)
    const effortSuffix = shortName === 'Opus'
      ? `(${data.effortLevel[0].toUpperCase()})`
      : '';

    return `${COLORS.pastelCyan}${icon} ${shortName}${effortSuffix}${RESET}`;
  },
};
