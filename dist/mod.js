// scripts/mod/register.tsx
import { atom, read, update } from "claude-code";

// locales/en.json
var en_default = {
  model: {
    opus: "Opus",
    sonnet: "Sonnet",
    haiku: "Haiku"
  },
  labels: {
    "5h": "5h",
    "7d": "7d",
    "7d_all": "7d",
    "7d_sonnet": "7d-S",
    "7d_fable": "7d-F",
    codex: "Codex",
    "1m": "1m"
  },
  time: {
    days: "d",
    hours: "h",
    minutes: "m",
    seconds: "s"
  },
  errors: {
    no_context: "No context yet"
  },
  widgets: {
    tools: "Tools",
    done: "done",
    running: "running",
    agent: "Agent",
    todos: "Tasks",
    claudeMd: "CLAUDE.md",
    agentsMd: "AGENTS.md",
    addedDirs: "+Dirs",
    rules: "Rules",
    mcps: "MCP",
    hooks: "Hooks",
    burnRate: "Rate",
    cache: "Cache",
    tokenSpeedLast: "last",
    cacheMiss: "miss",
    toLimit: "to",
    forecast: "Forecast",
    budget: "Budget",
    performance: "Perf",
    tokenBreakdown: "Tokens",
    todayCost: "Today",
    apiDuration: "API",
    peakHours: "Peak",
    offPeak: "Off-Peak"
  },
  checkUsage: {
    title: "CLI Usage Dashboard",
    recommendation: "Recommendation",
    lowestUsage: "Lowest usage",
    used: "used",
    notInstalled: "not installed",
    errorFetching: "Error fetching data",
    noData: "No usage data available"
  },
  paneViews: {
    turns: "Turns",
    agents: "Agents",
    files: "Files",
    todos: "Todos",
    errors: "Errors",
    background: "Background",
    emptyTurns: "No prompts yet",
    emptyAgents: "No subagents in this session",
    emptyFiles: "No files written yet",
    emptyTodos: "No todo list yet",
    emptyErrors: "No failed tools",
    emptyBackground: "No background jobs",
    noTranscript: "Transcript not available yet",
    running: "running",
    done: "done",
    stale: "stale",
    main: "main",
    agentsSuffix: "agents"
  },
  mod: {
    paneTitle: "Dashboard",
    paneOpened: "Dashboard pane opened.",
    paneClosed: "Dashboard pane closed.",
    bandOn: "Dashboard band on \u2014 statusLine hidden for this session (terminal/desktop only).",
    bandOff: "Dashboard band off \u2014 statusLine restored.",
    paneUsage: "Usage: /claude-dashboard-pane [on|off|dashboard|turns|agents|files|todos|errors|bg]",
    bandUsage: "Usage: /claude-dashboard-band [on|off]",
    renderFailed: "Dashboard render failed",
    paneViewSwitched: "Dashboard pane view:",
    tabs: {
      dashboard: "Dash",
      turns: "Turns",
      agents: "Agents",
      files: "Files",
      todos: "Todos",
      errors: "Errors",
      bg: "Bg"
    }
  }
};

// locales/ko.json
var ko_default = {
  model: {
    opus: "Opus",
    sonnet: "Sonnet",
    haiku: "Haiku"
  },
  labels: {
    "5h": "5\uC2DC\uAC04",
    "7d": "7\uC77C",
    "7d_all": "7\uC77C",
    "7d_sonnet": "7\uC77C-S",
    "7d_fable": "7\uC77C-F",
    codex: "Codex",
    "1m": "1\uAC1C\uC6D4"
  },
  time: {
    days: "\uC77C",
    hours: "\uC2DC\uAC04",
    minutes: "\uBD84",
    seconds: "\uCD08"
  },
  errors: {
    no_context: "\uCEE8\uD14D\uC2A4\uD2B8 \uC5C6\uC74C"
  },
  widgets: {
    tools: "\uB3C4\uAD6C",
    done: "\uC644\uB8CC",
    running: "\uC2E4\uD589\uC911",
    agent: "\uC5D0\uC774\uC804\uD2B8",
    todos: "\uD560\uC77C",
    claudeMd: "CLAUDE.md",
    agentsMd: "AGENTS.md",
    addedDirs: "+\uB514\uB809\uD1A0\uB9AC",
    rules: "\uADDC\uCE59",
    mcps: "MCP",
    hooks: "\uD6C5",
    burnRate: "\uC18C\uBAA8\uC728",
    cache: "\uCE90\uC2DC",
    tokenSpeedLast: "\uCD5C\uADFC",
    cacheMiss: "miss",
    toLimit: "\uD6C4",
    forecast: "\uC608\uCE21",
    budget: "\uC608\uC0B0",
    performance: "\uC131\uB2A5",
    tokenBreakdown: "\uD1A0\uD070",
    todayCost: "\uC624\uB298",
    apiDuration: "API",
    peakHours: "\uD53C\uD06C",
    offPeak: "\uBE44\uD53C\uD06C"
  },
  checkUsage: {
    title: "CLI \uC0AC\uC6A9\uB7C9 \uB300\uC2DC\uBCF4\uB4DC",
    recommendation: "\uCD94\uCC9C",
    lowestUsage: "\uAC00\uC7A5 \uC5EC\uC720",
    used: "\uC0AC\uC6A9",
    notInstalled: "\uC124\uCE58\uB418\uC9C0 \uC54A\uC74C",
    errorFetching: "\uB370\uC774\uD130 \uAC00\uC838\uC624\uAE30 \uC624\uB958",
    noData: "\uC0AC\uC6A9\uB7C9 \uB370\uC774\uD130 \uC5C6\uC74C"
  },
  paneViews: {
    turns: "\uD134",
    agents: "\uC5D0\uC774\uC804\uD2B8",
    files: "\uD30C\uC77C",
    todos: "\uD560 \uC77C",
    errors: "\uC5D0\uB7EC",
    background: "\uBC31\uADF8\uB77C\uC6B4\uB4DC",
    emptyTurns: "\uC544\uC9C1 \uC785\uB825\uC774 \uC5C6\uC2B5\uB2C8\uB2E4",
    emptyAgents: "\uC774 \uC138\uC158\uC5D0 \uC11C\uBE0C\uC5D0\uC774\uC804\uD2B8\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4",
    emptyFiles: "\uC544\uC9C1 \uC218\uC815\uD55C \uD30C\uC77C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4",
    emptyTodos: "\uC544\uC9C1 \uD560 \uC77C \uBAA9\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4",
    emptyErrors: "\uC2E4\uD328\uD55C \uB3C4\uAD6C\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4",
    emptyBackground: "\uBC31\uADF8\uB77C\uC6B4\uB4DC \uC791\uC5C5\uC774 \uC5C6\uC2B5\uB2C8\uB2E4",
    noTranscript: "\uC544\uC9C1 transcript\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4",
    running: "\uC9C4\uD589 \uC911",
    done: "\uC644\uB8CC",
    stale: "\uBA48\uCDA4",
    main: "\uBA54\uC778",
    agentsSuffix: "\uC5D0\uC774\uC804\uD2B8"
  },
  mod: {
    paneTitle: "\uB300\uC2DC\uBCF4\uB4DC",
    paneOpened: "\uB300\uC2DC\uBCF4\uB4DC \uD328\uB110\uC744 \uC5F4\uC5C8\uC2B5\uB2C8\uB2E4.",
    paneClosed: "\uB300\uC2DC\uBCF4\uB4DC \uD328\uB110\uC744 \uB2EB\uC558\uC2B5\uB2C8\uB2E4.",
    bandOn: "\uB300\uC2DC\uBCF4\uB4DC \uBC34\uB4DC \uCF1C\uC9D0 \u2014 \uC774 \uC138\uC158\uC758 statusLine\uC744 \uC228\uAE41\uB2C8\uB2E4 (\uD130\uBBF8\uB110/\uB370\uC2A4\uD06C\uD1B1 \uC804\uC6A9).",
    bandOff: "\uB300\uC2DC\uBCF4\uB4DC \uBC34\uB4DC \uAEBC\uC9D0 \u2014 statusLine\uC744 \uBCF5\uC6D0\uD588\uC2B5\uB2C8\uB2E4.",
    paneUsage: "\uC0AC\uC6A9\uBC95: /claude-dashboard-pane [on|off|dashboard|turns|agents|files|todos|errors|bg]",
    bandUsage: "\uC0AC\uC6A9\uBC95: /claude-dashboard-band [on|off]",
    renderFailed: "\uB300\uC2DC\uBCF4\uB4DC \uB80C\uB354 \uC2E4\uD328",
    paneViewSwitched: "\uB300\uC2DC\uBCF4\uB4DC \uD328\uB110 \uBCF4\uAE30:",
    tabs: {
      dashboard: "\uB300\uC2DC",
      turns: "\uD134",
      agents: "\uC5D0\uC774\uC804\uD2B8",
      files: "\uD30C\uC77C",
      todos: "\uD560 \uC77C",
      errors: "\uC5D0\uB7EC",
      bg: "\uBC31\uADF8\uB77C\uC6B4\uB4DC"
    }
  }
};

// scripts/mod/ansi.ts
var BASIC_HEX = [
  "#000000",
  "#cd0000",
  "#00cd00",
  "#cdcd00",
  "#0000ee",
  "#cd00cd",
  "#00cdcd",
  "#e5e5e5",
  "#7f7f7f",
  "#ff0000",
  "#00ff00",
  "#ffff00",
  "#5c5cff",
  "#ff00ff",
  "#00ffff",
  "#ffffff"
];
var CUBE = [0, 95, 135, 175, 215, 255];
var hex = (r, g, b) => `#${[r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("")}`;
function ansi256ToHex(n) {
  if (n < 16)
    return BASIC_HEX[n];
  if (n < 232) {
    const i = n - 16;
    return hex(CUBE[Math.floor(i / 36)], CUBE[Math.floor(i / 6) % 6], CUBE[i % 6]);
  }
  const level = 8 + (n - 232) * 10;
  return hex(level, level, level);
}
function applySgr(style, params) {
  const codes = params === "" ? [0] : params.split(";").map(Number);
  let next = { ...style };
  for (let i = 0; i < codes.length; i++) {
    const c = codes[i];
    if (c === 0)
      next = {};
    else if (c === 1)
      next.bold = true;
    else if (c === 2)
      next.dim = true;
    else if (c === 22) {
      delete next.bold;
      delete next.dim;
    } else if (c === 39)
      delete next.color;
    else if (c >= 30 && c <= 37)
      next.color = BASIC_HEX[c - 30];
    else if (c >= 90 && c <= 97)
      next.color = BASIC_HEX[c - 90 + 8];
    else if (c === 38 && codes[i + 1] === 5) {
      next.color = ansi256ToHex(codes[i + 2]);
      i += 2;
    } else if (c === 38 && codes[i + 1] === 2) {
      next.color = hex(codes[i + 2], codes[i + 3], codes[i + 4]);
      i += 4;
    }
  }
  return next;
}
var OSC = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;
var CSI = /\x1b\[([0-9;]*)([A-Za-z])/g;
var TRUNCATED_CSI = /\x1b\[[0-9;]*$/;
var CONTROL = /[\x00-\x08\x0a-\x1f\x7f]/g;
var toText = (raw) => raw.replace(/\t/g, " ").replace(CONTROL, "");
function parseAnsi(line) {
  const clean = line.replace(OSC, "").replace(TRUNCATED_CSI, "");
  const out = [];
  let style = {};
  let last = 0;
  const push = (raw) => {
    const text = toText(raw);
    if (text)
      out.push({ text, ...style });
  };
  for (const m of clean.matchAll(CSI)) {
    push(clean.slice(last, m.index));
    if (m[2] === "m")
      style = applySgr(style, m[1]);
    last = m.index + m[0].length;
  }
  push(clean.slice(last));
  return out;
}

// scripts/mod/toggle.ts
function resolveToggle(args, current) {
  const arg = args.trim().toLowerCase();
  if (arg === "")
    return !current;
  if (arg === "on")
    return true;
  if (arg === "off")
    return false;
  return null;
}
var PANE_VIEWS = ["dashboard", "turns", "agents", "files", "todos", "errors", "bg"];
function isPaneView(value) {
  return value !== void 0 && PANE_VIEWS.includes(value);
}
function resolvePaneCommand(args, isOpen, view) {
  const arg = args.trim().toLowerCase();
  if (isPaneView(arg))
    return { open: true, view: arg };
  const open = resolveToggle(arg, isOpen);
  return open === null ? null : { open, view };
}

// scripts/mod/stdin-builder.ts
var MODEL_SCOPED = /opus|sonnet|fable/i;
function windowForKind(kind) {
  if (MODEL_SCOPED.test(kind))
    return null;
  if (/^(five_hour|5h|session)$/i.test(kind))
    return "five_hour";
  if (/^(seven_day|7d|weekly)$/i.test(kind))
    return "seven_day";
  return null;
}
function rateLimitsFrom(list) {
  const out = {};
  for (const rl of list) {
    const window = windowForKind(rl.kind);
    const resetsMs = rl.resetsAt ? Date.parse(rl.resetsAt) : NaN;
    if (!window || Number.isNaN(resetsMs))
      continue;
    out[window] = { used_percentage: rl.percentUsed, resets_at: Math.floor(resetsMs / 1e3) };
  }
  return Object.keys(out).length > 0 ? out : void 0;
}
function buildStdin(s, now = Date.now()) {
  const percent = s.context?.percent ?? null;
  const stdin = {
    session_id: s.sessionId,
    model: { id: s.model, display_name: s.model },
    workspace: { current_dir: s.cwd, ...s.root ? { project_dir: s.root } : {} },
    context_window: {
      total_input_tokens: s.context?.tokens ?? 0,
      total_output_tokens: 0,
      context_window_size: s.context?.window ?? 0,
      used_percentage: percent,
      remaining_percentage: percent === null ? null : 100 - percent,
      current_usage: null
    },
    cost: { total_cost_usd: s.costUsd ?? 0 }
  };
  if (s.startedAt !== void 0 && now >= s.startedAt) {
    stdin.cost.total_duration_ms = now - s.startedAt;
  }
  if (s.version)
    stdin.version = s.version;
  if (s.transcriptPath)
    stdin.transcript_path = s.transcriptPath;
  const rateLimits = rateLimitsFrom(s.rateLimits);
  if (rateLimits)
    stdin.rate_limits = rateLimits;
  return stdin;
}

// scripts/mod/node-path.ts
var NODE_LOOKUP_SCRIPT = `
tried=
for s in "$SHELL" bash zsh; do
  [ -n "$s" ] && s=$(command -v "$s" 2>/dev/null) || continue
  case " $tried " in *" $s "*) continue ;; esac
  tried="$tried $s"
  p=$("$s" -lic 'command -v node' </dev/null 2>/dev/null | tail -n 1)
  case "$p" in /*) [ -x "$p" ] && { echo "$p"; exit 0; } ;; esac
done
found=
for p in "$HOME"/.nvm/versions/node/*/bin/node; do [ -x "$p" ] && { echo "$p"; found=1; }; done
[ -n "$found" ] && exit 0
for p in "$HOME"/.local/share/fnm/aliases/default/bin/node "$HOME"/.volta/bin/node \\
         "$HOME"/.asdf/shims/node /opt/homebrew/bin/node /usr/local/bin/node; do
  [ -x "$p" ] && { echo "$p"; exit 0; }
done
exit 1
`;
function isMissingExecutable(err) {
  return err instanceof Error && /\bENOENT\b/.test(err.message);
}
var NVM_VERSION = /\/v(\d+)\.(\d+)\.(\d+)\/bin\/node$/;
function nvmVersion(nodePath) {
  return NVM_VERSION.exec(nodePath)?.slice(1).map(Number) ?? [-1, -1, -1];
}
function isNewer(a, b) {
  const i = a.findIndex((n, k) => n !== b[k]);
  return i !== -1 && a[i] > b[i];
}
function parseNodePath(stdout) {
  const paths = stdout.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("/"));
  if (paths.length === 0)
    return null;
  return paths.reduce((best, p) => isNewer(nvmVersion(p), nvmVersion(best)) ? p : best);
}

// scripts/mod/register.tsx
var PANE = "claude-dashboard";
var TICK_MS = 6e4;
var VIEW_TICK_MS = 1e4;
var RUN_TIMEOUT_MS = 5e3;
var NODE_LOOKUP_TIMEOUT_MS = 1e4;
var paneLines = atom({ plugin: "claude-dashboard", key: "paneLines" }, []);
var bandLines = atom({ plugin: "claude-dashboard", key: "bandLines" }, []);
var BAND_SURFACES = /* @__PURE__ */ new Set(["terminal", "desktop"]);
var cachedStrings = null;
function strings() {
  if (cachedStrings)
    return cachedStrings;
  try {
    cachedStrings = (Intl.DateTimeFormat().resolvedOptions().locale.startsWith("ko") ? ko_default : en_default).mod;
  } catch {
    cachedStrings = en_default.mod;
  }
  return cachedStrings;
}
var snapshot = { sessionId: "", model: "", cwd: "", rateLimits: [] };
var isPaneOpen = false;
var paneView = "dashboard";
var isBandOn = false;
var bandCarriesOver = false;
var bandRuns = /* @__PURE__ */ new Set();
var ticker = null;
var tickerMs = 0;
var nodeCommand = "node";
var nodeLookup = null;
async function lookUpNode($) {
  try {
    const run = await $.process.run(["sh", "-c", NODE_LOOKUP_SCRIPT], { timeoutMs: NODE_LOOKUP_TIMEOUT_MS });
    return run.exitCode === 0 ? parseNodePath(run.stdout) : null;
  } catch (err) {
    $.ui.log(`${strings().renderFailed}: node lookup: ${err.message}`, { to: "debug" });
    return null;
  }
}
async function runRenderer($, env) {
  const argv = (node) => [node, `${$.plugin.root}/dist/index.js`];
  const init = { stdin: JSON.stringify(buildStdin(snapshot)), env: { CLAUDE_DASHBOARD_MOD: "1", ...env }, timeoutMs: RUN_TIMEOUT_MS };
  try {
    return await $.process.run(argv(nodeCommand), init);
  } catch (err) {
    if (nodeCommand !== "node" || !isMissingExecutable(err))
      throw err;
    nodeLookup ??= lookUpNode($);
    const found = await nodeLookup;
    if (!found)
      throw err;
    nodeCommand = found;
    return await $.process.run(argv(found), init);
  }
}
async function renderLines($, env) {
  try {
    const run = await runRenderer($, env);
    if (run.exitCode !== 0) {
      $.ui.log(`${strings().renderFailed}: exit ${run.exitCode} ${run.stderr.slice(0, 200)}`);
      return null;
    }
    return run.stdout.split("\n").filter((l) => l.length > 0).map(parseAnsi);
  } catch (err) {
    $.ui.log(`${strings().renderFailed}: ${err.message}`);
    return null;
  }
}
function keepOrWarn(lines) {
  return (prev) => lines ?? (prev.length > 0 ? prev : [[{ text: `\u26A0\uFE0F ${strings().renderFailed}` }]]);
}
async function canDrawBand($) {
  const surfaces = await $.session.surfaces();
  return surfaces.some((s) => BAND_SURFACES.has(s));
}
async function refreshPane($) {
  if (!isPaneOpen)
    return;
  const lines = await renderLines($, { CLAUDE_DASHBOARD_SURFACE: "pane", CLAUDE_DASHBOARD_PANE_VIEW: paneView });
  await update($, paneLines, keepOrWarn(lines));
}
async function runBand($) {
  const lines = await renderLines($, { CLAUDE_DASHBOARD_BAND_SESSION: snapshot.sessionId });
  await update($, bandLines, keepOrWarn(lines));
}
async function refreshBand($) {
  if (!isBandOn || !await canDrawBand($))
    return;
  if (!isBandOn)
    return;
  const run = runBand($);
  bandRuns.add(run);
  try {
    await run;
  } finally {
    bandRuns.delete(run);
  }
}
async function stopBand($) {
  isBandOn = false;
  await Promise.allSettled([...bandRuns]);
  await renderLines($, { CLAUDE_DASHBOARD_BAND_OFF: snapshot.sessionId });
}
async function refresh($) {
  await Promise.all([refreshPane($), refreshBand($)]);
}
var refreshing = null;
var refreshAgain = false;
function requestRefresh($) {
  if (refreshing) {
    refreshAgain = true;
    return refreshing;
  }
  refreshing = drainRefreshes($);
  return refreshing;
}
async function drainRefreshes($) {
  try {
    do {
      refreshAgain = false;
      await refresh($);
    } while (refreshAgain);
  } catch (err) {
    $.ui.log(`${strings().renderFailed}: ${err.message}`);
  } finally {
    refreshing = null;
  }
}
async function bandDefault($) {
  try {
    const run = await runRenderer($, { CLAUDE_DASHBOARD_MOD_SETTINGS: "1" });
    return run.exitCode === 0 && JSON.parse(run.stdout).bandDefault === true;
  } catch (err) {
    $.ui.log(`${strings().renderFailed}: ${err.message}`);
    return false;
  }
}
async function setBand($, on) {
  if (on) {
    isBandOn = true;
    syncTicker($);
    await requestRefresh($);
  } else {
    await stopBand($);
    syncTicker($);
    await update($, bandLines, () => []);
  }
}
function syncTicker($) {
  const needed = isPaneOpen || isBandOn;
  const ms = isPaneOpen && paneView !== "dashboard" ? VIEW_TICK_MS : TICK_MS;
  if (ticker && (!needed || ms !== tickerMs)) {
    ticker.cancel();
    ticker = null;
  }
  if (needed && !ticker) {
    ticker = $.clock.every(ms, () => void requestRefresh($));
    tickerMs = ms;
  }
}
async function selectView($, view) {
  if (view === paneView)
    return;
  paneView = view;
  syncTicker($);
  await requestRefresh($);
}
async function runPaneCommand($, args) {
  const cmd = resolvePaneCommand(args, isPaneOpen, paneView);
  if (cmd === null)
    return strings().paneUsage;
  if (!cmd.open) {
    await setPane($, false);
    return strings().paneClosed;
  }
  const switched = cmd.view !== paneView;
  if (isPaneOpen) {
    await selectView($, cmd.view);
  } else {
    paneView = cmd.view;
    await setPane($, true);
  }
  return switched ? `${strings().paneViewSwitched} ${paneView}` : strings().paneOpened;
}
function applyUsage(u) {
  if (u.startedAt !== void 0)
    snapshot.startedAt = u.startedAt;
  snapshot.context = { tokens: u.context.tokens, window: u.context.window, percent: u.context.percent };
  snapshot.rateLimits = [...u.rateLimits];
  snapshot.costUsd = u.cost?.usd;
}
async function setPane($, open) {
  if (open === isPaneOpen)
    return;
  isPaneOpen = open;
  if (open) {
    await $.ui.open({ id: PANE, title: strings().paneTitle });
  } else {
    await $.ui.close({ id: PANE });
  }
  syncTicker($);
  if (open)
    await requestRefresh($);
}
async function switchSession($, sessionId) {
  const wasBandOn = isBandOn || bandCarriesOver;
  bandCarriesOver = false;
  if (isBandOn)
    await stopBand($);
  snapshot.sessionId = sessionId;
  paneView = "dashboard";
  const [usage, model] = await Promise.allSettled([$.session.usage(), $.session.model()]);
  if (usage.status === "fulfilled")
    applyUsage(usage.value);
  else
    $.ui.log(`${strings().renderFailed}: ${usage.reason.message}`);
  if (model.status === "fulfilled")
    snapshot.model = model.value;
  else
    $.ui.log(`${strings().renderFailed}: ${model.reason.message}`);
  if (wasBandOn || await bandDefault($)) {
    await setBand($, true);
  } else {
    syncTicker($);
    await requestRefresh($);
  }
}
function drawTabs($, Box, Text, Button) {
  const labels = strings().tabs;
  return /* @__PURE__ */ h(Box, { flexDirection: "row", gap: 2 }, PANE_VIEWS.map((view, i) => /* @__PURE__ */ h(
    Button,
    {
      key: `tab:${view}`,
      plain: true,
      hotkey: String(i + 1),
      dimColor: view !== paneView,
      onPress: () => void selectView($, view)
    },
    view === paneView ? /* @__PURE__ */ h(Text, { bold: true }, labels[view]) : labels[view]
  )));
}
function drawLines(Box, Text, lines) {
  return /* @__PURE__ */ h(Box, { flexDirection: "column" }, lines.map((line) => /* @__PURE__ */ h(Text, null, line.map((seg) => /* @__PURE__ */ h(Text, { color: seg.color, bold: seg.bold, dimColor: seg.dim }, seg.text)))));
}
function register(on) {
  on("session.start", async ($, e, next) => {
    await $.command.register({
      name: "claude-dashboard-pane",
      description: "Show the dashboard or a session view (turns, agents, files, todos, errors, bg) in a pane",
      argumentHint: "[on|off|dashboard|turns|agents|files|todos|errors|bg]"
    });
    const [id, model, cwd, root, version, usage] = await Promise.all([
      $.session.id(),
      $.session.model(),
      $.session.cwd(),
      $.session.root(),
      $.session.version(),
      $.session.usage()
    ]);
    Object.assign(snapshot, { sessionId: id, model, cwd, root, version: version.version });
    applyUsage(usage);
    await $.command.register({
      name: "claude-dashboard-band",
      description: "Show the dashboard above the prompt instead of the statusLine (on|off, none toggles)",
      argumentHint: "[on|off]"
    });
    if (await bandDefault($))
      await setBand($, true);
    return next(e);
  });
  on("classic.SessionStart", async ($, e, next) => {
    if (e.transcript_path)
      snapshot.transcriptPath = e.transcript_path;
    if (e.cwd)
      snapshot.cwd = e.cwd;
    if (e.session_id && snapshot.sessionId && e.session_id !== snapshot.sessionId) {
      await switchSession($, e.session_id);
    }
    return next(e);
  });
  on("session.measure", async ($, e, next) => {
    applyUsage(e);
    try {
      snapshot.model = await $.session.model();
    } catch (err) {
      $.ui.log(`${strings().renderFailed}: ${err.message}`);
    }
    void requestRefresh($);
    return next(e);
  });
  on("command.run", { command: "claude-dashboard-pane" }, async ($, e) => {
    return { text: await runPaneCommand($, e.args) };
  });
  on("ui.close", { id: "claude-dashboard" }, ($, e, next) => {
    isPaneOpen = false;
    syncTicker($);
    return next(e);
  });
  on("command.run", { command: "claude-dashboard-band" }, async ($, e) => {
    const on2 = resolveToggle(e.args, isBandOn);
    if (on2 === null)
      return { text: strings().bandUsage };
    await setBand($, on2);
    return { text: on2 ? strings().bandOn : strings().bandOff };
  });
  on("ui.render", { component: "Pane", requestId: "claude-dashboard" }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e);
    const lines = await read($, paneLines);
    return /* @__PURE__ */ h(Box, { flexDirection: "column" }, drawTabs($, Box, Text, Button), drawLines(Box, Text, lines));
  });
  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    if (!isBandOn || !BAND_SURFACES.has(e.surface) || e.props.hasSurvey)
      return next(e);
    const lines = await read($, bandLines);
    if (lines.length === 0)
      return next(e);
    const { Box, Text } = $.ui.resolve(e);
    return drawLines(Box, Text, lines);
  });
  on("session.end", async ($, e, next) => {
    const continues = e.reason === "clear" || e.reason === "resume";
    if (isBandOn) {
      await stopBand($);
      bandCarriesOver = continues;
    }
    if (!continues)
      isPaneOpen = false;
    syncTicker($);
    return next(e);
  });
}
export {
  register
};
