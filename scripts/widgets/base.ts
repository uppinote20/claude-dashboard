/**
 * Base widget interface and types
 * @handbook 3.1-widget-interface
 * @handbook 2.3-export-pattern
 */

import type { WidgetContext, WidgetData, WidgetId } from '../types.js';

/**
 * Widget interface - all widgets must implement this
 */
export interface Widget<T extends WidgetData = WidgetData> {
  /** Unique widget identifier */
  readonly id: WidgetId;

  /** Human-readable widget name */
  readonly name: string;

  /**
   * Collect data for this widget
   * @returns Widget data or null if unavailable
   */
  getData(ctx: WidgetContext): Promise<T | null>;

  /**
   * Render widget data to a formatted string
   * @param data - Widget data from getData()
   * @param ctx - Widget context for translations and config
   * @returns Formatted string for display
   */
  render(data: T, ctx: WidgetContext): string;
}

/**
 * Widget render result
 */
export interface WidgetRenderResult {
  id: WidgetId;
  output: string;
}

