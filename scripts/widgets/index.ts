/**
 * Widget registry and orchestrator
 */

import type { Widget, WidgetRenderResult } from './base.js';
import type {
  WidgetId,
  WidgetContext,
  Config,
  DISPLAY_PRESETS,
  DisplayMode,
} from '../types.js';
import { COLORS, RESET } from '../utils/colors.js';
import { debugLog } from '../utils/debug.js';

// Widget imports
import { modelWidget } from './model.js';
import { contextWidget } from './context.js';
import { costWidget } from './cost.js';
import { rateLimit5hWidget, rateLimit7dWidget, rateLimit7dSonnetWidget } from './rate-limit.js';
import { projectInfoWidget } from './project-info.js';
import { configCountsWidget } from './config-counts.js';
import { sessionDurationWidget } from './session-duration.js';
import { toolActivityWidget } from './tool-activity.js';
import { agentStatusWidget } from './agent-status.js';
import { todoProgressWidget } from './todo-progress.js';
import { burnRateWidget } from './burn-rate.js';
import { depletionTimeWidget } from './depletion-time.js';
import { cacheHitWidget } from './cache-hit.js';
import { codexUsageWidget } from './codex-usage.js';

/**
 * Widget registry - maps widget IDs to widget implementations
 */
const widgetRegistry = new Map<WidgetId, Widget>([
  ['model', modelWidget],
  ['context', contextWidget],
  ['cost', costWidget],
  ['rateLimit5h', rateLimit5hWidget],
  ['rateLimit7d', rateLimit7dWidget],
  ['rateLimit7dSonnet', rateLimit7dSonnetWidget],
  ['projectInfo', projectInfoWidget],
  ['configCounts', configCountsWidget],
  ['sessionDuration', sessionDurationWidget],
  ['toolActivity', toolActivityWidget],
  ['agentStatus', agentStatusWidget],
  ['todoProgress', todoProgressWidget],
  ['burnRate', burnRateWidget],
  ['depletionTime', depletionTimeWidget],
  ['cacheHit', cacheHitWidget],
  ['codexUsage', codexUsageWidget],
] as [WidgetId, Widget][]);

/**
 * Get widget by ID
 */
export function getWidget(id: WidgetId): Widget | undefined {
  return widgetRegistry.get(id);
}

/**
 * Get all registered widgets
 */
export function getAllWidgets(): Widget[] {
  return Array.from(widgetRegistry.values());
}

/**
 * Get lines configuration based on display mode
 */
export function getLines(config: Config): WidgetId[][] {
  if (config.displayMode === 'custom' && config.lines) {
    return config.lines;
  }

  // Preset configurations (synced with DISPLAY_PRESETS in types.ts)
  const presets = {
    compact: [
      ['model', 'context', 'cost', 'rateLimit5h', 'rateLimit7d', 'rateLimit7dSonnet'],
    ] as WidgetId[][],
    normal: [
      ['model', 'context', 'cost', 'rateLimit5h', 'rateLimit7d', 'rateLimit7dSonnet'],
      ['projectInfo', 'sessionDuration', 'burnRate', 'todoProgress'],
    ] as WidgetId[][],
    detailed: [
      ['model', 'context', 'cost', 'rateLimit5h', 'rateLimit7d', 'rateLimit7dSonnet'],
      ['projectInfo', 'sessionDuration', 'burnRate', 'depletionTime', 'todoProgress'],
      ['configCounts', 'toolActivity', 'agentStatus', 'cacheHit'],
      ['codexUsage'],
    ] as WidgetId[][],
  };

  return presets[config.displayMode as keyof typeof presets] || presets.compact;
}

/**
 * Render a single widget
 */
async function renderWidget(
  widgetId: WidgetId,
  ctx: WidgetContext
): Promise<WidgetRenderResult | null> {
  const widget = getWidget(widgetId);
  if (!widget) {
    return null;
  }

  try {
    const data = await widget.getData(ctx);
    if (!data) {
      return null;
    }

    const output = widget.render(data, ctx);
    return { id: widgetId, output };
  } catch (error) {
    // Graceful degradation - skip failed widgets, but log for debugging
    debugLog('widget', `Widget '${widgetId}' failed`, error);
    return null;
  }
}

/**
 * Render a line of widgets
 */
async function renderLine(
  widgetIds: WidgetId[],
  ctx: WidgetContext
): Promise<string> {
  const results = await Promise.all(
    widgetIds.map((id) => renderWidget(id, ctx))
  );

  const separator = ` ${COLORS.dim}│${RESET} `;
  const outputs = results
    .filter((r): r is WidgetRenderResult => r !== null && r.output.length > 0)
    .map((r) => r.output);

  return outputs.join(separator);
}

/**
 * Render all lines based on configuration
 */
export async function renderAllLines(ctx: WidgetContext): Promise<string[]> {
  const lines = getLines(ctx.config);
  const renderedLines: string[] = [];

  for (const lineWidgets of lines) {
    const rendered = await renderLine(lineWidgets, ctx);
    if (rendered.length > 0) {
      renderedLines.push(rendered);
    }
  }

  return renderedLines;
}

/**
 * Format final output with multiple lines
 */
export async function formatOutput(ctx: WidgetContext): Promise<string> {
  const lines = await renderAllLines(ctx);
  return lines.join('\n');
}
