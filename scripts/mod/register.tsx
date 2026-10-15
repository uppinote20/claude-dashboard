/**
 * claude-dashboard mod: runs the unchanged renderer (dist/index.js) as a subprocess with a
 * statusLine-shaped stdin built from mod data, and draws its lines in a Pane (/claude-dashboard-pane)
 * or above the prompt (/claude-dashboard-band), where it stands in for this session's statusLine.
 * Exported as a function declaration: the engine's validator reads the built dist/mod.js
 * literally and refuses `var register = …`, which an arrow export compiles to.
 * @handbook 9.1-mod-renderer-subprocess
 * @handbook 9.3-engine-validator-constraints
 * @handbook 9.5-pane-views
 */
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import en from '../../locales/en.json'
import ko from '../../locales/ko.json'
import { parseAnsi, type Segment } from './ansi'
import { PANE_VIEWS, resolvePaneCommand, resolveToggle, type PaneView } from './toggle'
import { buildStdin, type ModRateLimit, type ModSnapshot } from './stdin-builder'
import { isMissingExecutable, NODE_LOOKUP_SCRIPT, parseNodePath } from './node-path'

const PANE = 'claude-dashboard'
const TICK_MS = 60_000
// Session views follow subagents and background jobs, which fire no session.measure.
const VIEW_TICK_MS = 10_000
const RUN_TIMEOUT_MS = 5_000
// An interactive shell sourcing nvm can be slow; this runs once per session at most.
const NODE_LOOKUP_TIMEOUT_MS = 10_000

const paneLines = atom({ plugin: 'claude-dashboard', key: 'paneLines' } as const, [] as Segment[][])
const bandLines = atom({ plugin: 'claude-dashboard', key: 'bandLines' } as const, [] as Segment[][])
// The band only draws here; elsewhere no heartbeat is sent, so statusLine stays.
const BAND_SURFACES: ReadonlySet<string> = new Set(['terminal', 'desktop'])

type Strings = typeof en.mod

// The mod cannot read the dashboard config; follow the host locale, falling back to English.
let cachedStrings: Strings | null = null
function strings(): Strings {
  if (cachedStrings) return cachedStrings
  try {
    cachedStrings = (Intl.DateTimeFormat().resolvedOptions().locale.startsWith('ko') ? ko : en).mod
  } catch {
    cachedStrings = en.mod
  }
  return cachedStrings
}

interface Usage {
  startedAt?: number
  context: { tokens?: number; window: number; percent?: number }
  rateLimits: readonly ModRateLimit[]
  cost?: { usd: number }
}

// Module state: a reload re-runs register and session.start, so starting over is fine.
const snapshot: ModSnapshot = { sessionId: '', model: '', cwd: '', rateLimits: [] }
let isPaneOpen = false
// Session-scoped like the band: a new session opens on the dashboard.
let paneView: PaneView = 'dashboard'
let isBandOn = false
// Band runs re-mark the session when they finish; off must wait for them before clearing.
const bandRuns = new Set<Promise<void>>()
let ticker: Timer | null = null
let tickerMs = 0

// 'node' off PATH until it fails to start; then the looked-up path, shared by concurrent runs.
let nodeCommand = 'node'
let nodeLookup: Promise<string | null> | null = null

// Helpers that take $ are top-level declarations: the engine's validator follows $ only into those.
async function lookUpNode($: EngineInterface): Promise<string | null> {
  try {
    const run = await $.process.run(['sh', '-c', NODE_LOOKUP_SCRIPT], { timeoutMs: NODE_LOOKUP_TIMEOUT_MS })
    return run.exitCode === 0 ? parseNodePath(run.stdout) : null
  } catch (err) {
    $.ui.log(`${strings().renderFailed}: node lookup: ${(err as Error).message}`, { to: 'debug' })
    return null
  }
}

async function runRenderer($: EngineInterface, env: Record<string, string>) {
  const argv = (node: string) => [node, `${$.plugin.root}/dist/index.js`]
  const init = { stdin: JSON.stringify(buildStdin(snapshot)), env: { CLAUDE_DASHBOARD_MOD: '1', ...env }, timeoutMs: RUN_TIMEOUT_MS }
  try {
    return await $.process.run(argv(nodeCommand), init)
  } catch (err) {
    if (nodeCommand !== 'node' || !isMissingExecutable(err)) throw err
    nodeLookup ??= lookUpNode($)
    const found = await nodeLookup
    if (!found) throw err
    nodeCommand = found
    return await $.process.run(argv(found), init)
  }
}

async function renderLines($: EngineInterface, env: Record<string, string>): Promise<Segment[][] | null> {
  try {
    const run = await runRenderer($, env)
    if (run.exitCode !== 0) {
      $.ui.log(`${strings().renderFailed}: exit ${run.exitCode} ${run.stderr.slice(0, 200)}`)
      return null
    }
    return run.stdout.split('\n').filter(l => l.length > 0).map(parseAnsi)
  } catch (err) {
    $.ui.log(`${strings().renderFailed}: ${(err as Error).message}`)
    return null
  }
}

// Keep the last good lines on failure; show ⚠️ only when there is nothing to keep.
function keepOrWarn(lines: Segment[][] | null) {
  return (prev: Segment[][]) => lines ?? (prev.length > 0 ? prev : [[{ text: `⚠️ ${strings().renderFailed}` }]])
}

async function canDrawBand($: EngineInterface): Promise<boolean> {
  const surfaces = await $.session.surfaces()
  return surfaces.some(s => BAND_SURFACES.has(s))
}

async function refreshPane($: EngineInterface) {
  if (!isPaneOpen) return
  const lines = await renderLines($, { CLAUDE_DASHBOARD_SURFACE: 'pane', CLAUDE_DASHBOARD_PANE_VIEW: paneView })
  await update($, paneLines, keepOrWarn(lines))
}

async function runBand($: EngineInterface) {
  const lines = await renderLines($, { CLAUDE_DASHBOARD_BAND_SESSION: snapshot.sessionId })
  await update($, bandLines, keepOrWarn(lines))
}

// Every band render refreshes the session's marker: the heartbeat that hides statusLine.
async function refreshBand($: EngineInterface) {
  if (!isBandOn || !(await canDrawBand($))) return
  // Off may have landed while surfaces() was in flight; a run now would re-mark the session.
  if (!isBandOn) return
  const run = runBand($)
  bandRuns.add(run)
  try {
    await run
  } finally {
    bandRuns.delete(run)
  }
}

// Hand statusLine back: stop new band runs, let started ones finish, then drop the marker.
async function stopBand($: EngineInterface) {
  isBandOn = false
  await Promise.allSettled([...bandRuns])
  await renderLines($, { CLAUDE_DASHBOARD_BAND_OFF: snapshot.sessionId })
}

// Pane and band are separate renderer runs; run them side by side.
async function refresh($: EngineInterface) {
  await Promise.all([refreshPane($), refreshBand($)])
}

// One refresh at a time: a request during a run folds into one more run after it, so a burst
// of measures spawns at most two renders and an older run never lands after a newer one.
let refreshing: Promise<void> | null = null
let refreshAgain = false

function requestRefresh($: EngineInterface): Promise<void> {
  if (refreshing) {
    refreshAgain = true
    return refreshing
  }
  refreshing = drainRefreshes($)
  return refreshing
}

async function drainRefreshes($: EngineInterface) {
  try {
    do {
      refreshAgain = false
      await refresh($)
    } while (refreshAgain)
  } catch (err) {
    $.ui.log(`${strings().renderFailed}: ${(err as Error).message}`)
  } finally {
    refreshing = null
  }
}

// Settings live in the dashboard config, which only the Node renderer reads. On a host without node
// on PATH this is the first run, so it also pays the one-time node lookup (an rc-sourcing shell).
async function bandDefault($: EngineInterface): Promise<boolean> {
  try {
    const run = await runRenderer($, { CLAUDE_DASHBOARD_MOD_SETTINGS: '1' })
    return run.exitCode === 0 && JSON.parse(run.stdout).bandDefault === true
  } catch (err) {
    $.ui.log(`${strings().renderFailed}: ${(err as Error).message}`)
    return false
  }
}

async function setBand($: EngineInterface, on: boolean) {
  if (on) {
    isBandOn = true
    syncTicker($)
    await requestRefresh($)
  } else {
    await stopBand($)
    syncTicker($)
    await update($, bandLines, () => [])
  }
}

function syncTicker($: EngineInterface) {
  const needed = isPaneOpen || isBandOn
  const ms = isPaneOpen && paneView !== 'dashboard' ? VIEW_TICK_MS : TICK_MS
  if (ticker && (!needed || ms !== tickerMs)) {
    ticker.cancel()
    ticker = null
  }
  if (needed && !ticker) {
    ticker = $.clock.every(ms, () => void requestRefresh($))
    tickerMs = ms
  }
}

// A tab press or a view argument on an open pane: redraw in place on the new view.
async function selectView($: EngineInterface, view: PaneView) {
  if (view === paneView) return
  paneView = view
  syncTicker($)
  await requestRefresh($)
}

async function runPaneCommand($: EngineInterface, args: string): Promise<string> {
  const cmd = resolvePaneCommand(args, isPaneOpen, paneView)
  if (cmd === null) return strings().paneUsage
  if (!cmd.open) {
    await setPane($, false)
    return strings().paneClosed
  }
  const switched = cmd.view !== paneView
  if (isPaneOpen) {
    await selectView($, cmd.view)
  } else {
    // Set before opening so the first render already draws the asked-for view.
    paneView = cmd.view
    await setPane($, true)
  }
  return switched ? `${strings().paneViewSwitched} ${paneView}` : strings().paneOpened
}

function applyUsage(u: Usage) {
  if (u.startedAt !== undefined) snapshot.startedAt = u.startedAt
  snapshot.context = { tokens: u.context.tokens, window: u.context.window, percent: u.context.percent }
  snapshot.rateLimits = [...u.rateLimits]
  snapshot.costUsd = u.cost?.usd
}

async function setPane($: EngineInterface, open: boolean) {
  if (open === isPaneOpen) return
  isPaneOpen = open
  if (open) {
    await $.ui.open({ id: PANE, title: strings().paneTitle })
  } else {
    await $.ui.close({ id: PANE })
  }
  syncTicker($)
  if (open) await requestRefresh($)
}

// /clear, /resume and /branch replace the session without a new session.start: move the band
// marker to the new id and re-read the session-scoped figures.
async function switchSession($: EngineInterface, sessionId: string) {
  const wasBandOn = isBandOn
  if (wasBandOn) await stopBand($)
  snapshot.sessionId = sessionId
  // A failed read keeps the last value; the band must still be re-applied under the new id.
  const [usage, model] = await Promise.allSettled([$.session.usage(), $.session.model()])
  if (usage.status === 'fulfilled') applyUsage(usage.value)
  else $.ui.log(`${strings().renderFailed}: ${(usage.reason as Error).message}`)
  if (model.status === 'fulfilled') snapshot.model = model.value
  else $.ui.log(`${strings().renderFailed}: ${(model.reason as Error).message}`)
  if (wasBandOn || (await bandDefault($))) {
    await setBand($, true)
  } else {
    syncTicker($)
    await requestRefresh($)
  }
}

// One plain Button per view: a click, its digit while the pane holds the keys, or Tab/arrows
// then Enter switches. The current tab is drawn bold, the rest dim.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawTabs($: EngineInterface, Box: any, Text: any, Button: any) {
  const labels = strings().tabs
  return (
    <Box flexDirection="row" gap={2}>
      {PANE_VIEWS.map((view, i) => (
        <Button
          key={`tab:${view}`}
          plain
          hotkey={String(i + 1)}
          dimColor={view !== paneView}
          onPress={() => void selectView($, view)}
        >
          {view === paneView ? <Text bold>{labels[view]}</Text> : labels[view]}
        </Button>
      ))}
    </Box>
  )
}

// Box/Text come from $.ui.resolve(e): each surface has its own element table.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawLines(Box: any, Text: any, lines: Segment[][]) {
  return (
    <Box flexDirection="column">
      {lines.map(line => (
        <Text>
          {line.map(seg => (
            <Text color={seg.color} bold={seg.bold} dimColor={seg.dim}>{seg.text}</Text>
          ))}
        </Text>
      ))}
    </Box>
  )
}

export function register(on: Parameters<Register>[0]) {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'claude-dashboard-pane',
      description: 'Show the dashboard or a session view (turns, agents, files, todos, errors, bg) in a pane',
      argumentHint: '[on|off|dashboard|turns|agents|files|todos|errors|bg]',
    })
    // session.start is awaited before the first prompt: fetch the independent reads together.
    const [id, model, cwd, root, version, usage] = await Promise.all([
      $.session.id(),
      $.session.model(),
      $.session.cwd(),
      $.session.root(),
      $.session.version(),
      $.session.usage(),
    ])
    Object.assign(snapshot, { sessionId: id, model, cwd, root, version: version.version })
    applyUsage(usage)
    await $.command.register({
      name: 'claude-dashboard-band',
      description: 'Show the dashboard above the prompt instead of the statusLine (on|off, none toggles)',
      argumentHint: '[on|off]',
    })
    if (await bandDefault($)) await setBand($, true)
    return next(e)
  })

  on('classic.SessionStart', async ($, e, next) => {
    if (e.transcript_path) snapshot.transcriptPath = e.transcript_path
    if (e.cwd) snapshot.cwd = e.cwd
    // An empty id means session.start has not run yet; it sets the id and band itself.
    if (e.session_id && snapshot.sessionId && e.session_id !== snapshot.sessionId) {
      await switchSession($, e.session_id)
    }
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    applyUsage(e)
    try {
      snapshot.model = await $.session.model()
    } catch (err) {
      // Keep the last known model; the refresh below must still run.
      $.ui.log(`${strings().renderFailed}: ${(err as Error).message}`)
    }
    void requestRefresh($)
    return next(e)
  })

  // Both commands take on, off, or nothing to flip the current state; the pane also takes a view.
  on('command.run', { command: 'claude-dashboard-pane' }, async ($, e) => {
    return { text: await runPaneCommand($, e.args) }
  })

  on('ui.close', { id: 'claude-dashboard' }, ($, e, next) => {
    isPaneOpen = false
    syncTicker($)
    return next(e)
  })

  on('command.run', { command: 'claude-dashboard-band' }, async ($, e) => {
    const on = resolveToggle(e.args, isBandOn)
    if (on === null) return { text: strings().bandUsage }
    await setBand($, on)
    return { text: on ? strings().bandOn : strings().bandOff }
  })

  on('ui.render', { component: 'Pane', requestId: 'claude-dashboard' }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const lines = await read($, paneLines)
    return (
      <Box flexDirection="column">
        {drawTabs($, Box, Text, Button)}
        {drawLines(Box, Text, lines)}
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!isBandOn || !BAND_SURFACES.has(e.surface) || e.props.hasSurvey) return next(e)
    const lines = await read($, bandLines)
    if (lines.length === 0) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    return drawLines(Box, Text, lines)
  })

  on('session.end', async ($, e, next) => {
    // Give statusLine back now rather than after the marker TTL.
    if (isBandOn) await stopBand($)
    isPaneOpen = false
    syncTicker($)
    return next(e)
  })
}
