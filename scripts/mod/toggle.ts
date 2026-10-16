/**
 * Shared argument rules for the mod's commands: `on`, `off`, or nothing to flip the
 * current state; the pane also takes a view name. Pure and Node-free: bundled into
 * dist/mod.js and imported by the renderer (render-mode.ts).
 * @handbook 9.4-render-mode-env
 * @handbook 9.5-pane-views
 * @tested scripts/__tests__/mod-toggle.test.ts
 */

/** The state to switch to, or null when the argument is not one the command takes. */
export function resolveToggle(args: string, current: boolean): boolean | null {
  const arg = args.trim().toLowerCase();
  if (arg === '') return !current;
  if (arg === 'on') return true;
  if (arg === 'off') return false;
  return null;
}

/** What the pane draws: the widget dashboard, or one of the session views. */
export const PANE_VIEWS = ['dashboard', 'turns', 'agents', 'files', 'todos', 'errors', 'bg'] as const;
export type PaneView = (typeof PANE_VIEWS)[number];
/** The views drawn from the session's transcripts rather than the widget pipeline. */
export type SessionView = Exclude<PaneView, 'dashboard'>;

export function isPaneView(value: string | undefined): value is PaneView {
  return value !== undefined && (PANE_VIEWS as readonly string[]).includes(value);
}

/**
 * `/claude-dashboard-pane` arguments: a view name opens the pane on that view (or switches
 * it in place); `on` / `off` / nothing behave like resolveToggle and keep the last view.
 * Null for anything else.
 */
export function resolvePaneCommand(
  args: string,
  isOpen: boolean,
  view: PaneView,
): { open: boolean; view: PaneView } | null {
  const arg = args.trim().toLowerCase();
  if (isPaneView(arg)) return { open: true, view: arg };
  const open = resolveToggle(arg, isOpen);
  return open === null ? null : { open, view };
}
