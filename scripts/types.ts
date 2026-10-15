/**
 * Core type definitions and display presets
 * @handbook 2.1-naming-conventions
 * @handbook 3.5-display-mode-presets
 */

/**
 * Stdin JSON input from Claude Code
 * @handbook 2.1-naming-conventions
 * @handbook 3.5-display-mode-presets
 */
export interface StdinInput {
  model: {
    id: string;
    display_name: string;
  };
  workspace: {
    current_dir: string;
    /** Directory where Claude Code was launched (may differ from current_dir) */
    project_dir?: string;
    /** Directories added via /add-dir (since v2.1.77) */
    added_dirs?: string[];
  };
  /** Worktree info (present only during --worktree sessions) */
  worktree?: {
    name: string;
    path: string;
    branch?: string;
    original_cwd: string;
    original_branch?: string;
  };
  context_window: {
    /**
     * Since Claude Code 2.1.132 these two are current-context values from the most
     * recent API response, not session totals. Session totals must come from the
     * transcript (see ParsedTranscript token accounting).
     */
    total_input_tokens: number;
    total_output_tokens: number;
    context_window_size: number;
    /** Official usage percentage from Claude Code stdin (0-100) */
    used_percentage?: number | null;
    /** Official remaining percentage from Claude Code stdin (0-100) */
    remaining_percentage?: number | null;
    current_usage: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens: number;
      cache_read_input_tokens: number;
    } | null;
  };
  cost: {
    total_cost_usd: number;
    /** Total session duration in milliseconds from Claude Code stdin */
    total_duration_ms?: number;
    /**
     * Total time spent in API calls in ms (excludes user/tool time). Process-wide:
     * includes subagent, compaction and side-query calls, so it does not pair with
     * main-transcript token counts.
     */
    total_api_duration_ms?: number;
    /** Total lines added in the session */
    total_lines_added?: number;
    /** Total lines removed in the session */
    total_lines_removed?: number;
  };
  /** Output style configuration */
  output_style?: { name: string };
  /** Path to transcript.jsonl file (if available) */
  transcript_path?: string;
  /** Claude Code version string */
  version?: string;
  /** Whether total tokens from most recent API response exceeds 200k (fixed threshold) */
  exceeds_200k_tokens?: boolean;
  /** Whether fast mode is enabled for the session (live value, since v2.1.25x) */
  fast_mode?: boolean;
  /**
   * Live reasoning effort for the session, including mid-session `/effort` changes
   * and the model's default-effort hold. Absent when the model has no effort tier.
   * Ultracode reports as `xhigh`.
   */
  effort?: { level: string };
  /** Whether extended thinking is enabled for the session */
  thinking?: { enabled: boolean };
  /**
   * Main-conversation prompt cache statistics (since v2.1.251).
   * Absent until the first API response; subagent requests are not counted.
   */
  prompt_cache?: PromptCacheStdin;
  /**
   * Rate limits from Claude Code stdin (Pro/Max subscribers, after first API response).
   * Each window may be independently absent.
   */
  rate_limits?: {
    five_hour?: {
      used_percentage: number;
      /** Unix epoch seconds */
      resets_at: number;
    };
    seven_day?: {
      used_percentage: number;
      /** Unix epoch seconds */
      resets_at: number;
    };
  };
  /** Vim mode info (present only when vim mode is enabled) */
  vim?: { mode: 'NORMAL' | 'INSERT' };
  /** Agent info (present only when running with --agent flag) */
  agent?: { name: string };
  /** Session ID for duration tracking */
  session_id?: string;
  /** Session name set via /rename command (since v2.1.77) */
  session_name?: string;
  /** Current permission mode (base hook field) */
  permission_mode?: string;
  /** Remote session info (present only in remote/bridge mode) */
  remote?: { session_id: string };
  /** Subagent identifier (present only in subagent context) */
  agent_id?: string;
  /** Subagent type name (present only in subagent context) */
  agent_type?: string;
}

/**
 * `prompt_cache` object from Claude Code stdin. Timestamps are Unix epoch seconds.
 * Only the fields the dashboard reads are typed; the object carries more.
 */
export interface PromptCacheStdin {
  /** Whether the cached prefix is still within its TTL */
  warm: boolean;
  /** Whether any response this session reported cache tokens (false = caching off / not reported) */
  caching_observed: boolean;
  /** Cache lifetime of the current prefix: "5m" or "1h" */
  ttl?: string;
  /** When the cached prefix goes cold; null when the last response reported no cache tokens */
  expires_at?: number | null;
  /** API requests recorded for the main conversation */
  requests?: number;
  /** Requests that re-processed content the cache already held */
  misses?: number;
  /** Cache rebuilds that followed compaction or tool-result clearing */
  expected_rebuilds?: number;
  /** Cache read tokens / all input tokens, 0..1; null while all counts are zero */
  hit_ratio?: number | null;
  /** Likely cause of the last miss (since v2.1.260); null until the first miss */
  last_miss_cause?: { causes?: string[] } | null;
}

/**
 * Widget identifiers
 */
export type WidgetId =
  | 'model'
  | 'context'
  | 'contextBar'
  | 'contextPercentage'
  | 'contextUsage'
  | 'cost'
  | 'rateLimit5h'
  | 'rateLimit7d'
  | 'rateLimit7dSonnet'
  | 'rateLimit7dFable'
  | 'projectInfo'
  | 'configCounts'
  | 'sessionDuration'
  | 'sessionId'
  | 'sessionIdFull'
  | 'toolActivity'
  | 'agentStatus'
  | 'todoProgress'
  | 'burnRate'
  | 'depletionTime'
  | 'cacheHit'
  | 'promptCache'
  | 'promptCacheState'
  | 'promptCacheHit'
  | 'promptCacheMisses'
  | 'codexUsage'
  | 'geminiUsage'
  | 'geminiUsageAll'
  | 'antigravityUsage'
  | 'antigravityUsageAll'
  | 'zaiUsage'
  | 'tokenBreakdown'
  | 'performance'
  | 'forecast'
  | 'budget'
  | 'version'
  | 'linesChanged'
  | 'outputStyle'
  | 'tokenSpeed'
  | 'tokenSpeedLast'
  | 'sessionName'
  | 'todayCost'
  | 'lastPrompt'
  | 'vimMode'
  | 'apiDuration'
  | 'peakHours'
  | 'tagStatus'
  | 'slashCommand'
  | 'agentMode';

/**
 * Display mode for status line output
 */
export type DisplayMode = 'compact' | 'normal' | 'detailed' | 'custom';

/**
 * Preset configurations for each display mode
 *
 * compact: Essential metrics - 1 line
 * normal: Essential + project/session/todo - 2 lines
 * detailed: Normal + config/tools/agents (additive) - 6 lines
 */
export const DISPLAY_PRESETS: Record<Exclude<DisplayMode, 'custom'>, WidgetId[][]> = {
  compact: [
    ['model', 'context', 'cost', 'rateLimit5h', 'rateLimit7d', 'rateLimit7dSonnet', 'rateLimit7dFable', 'zaiUsage'],
  ],
  normal: [
    ['model', 'context', 'cost', 'rateLimit5h', 'rateLimit7d', 'rateLimit7dSonnet', 'rateLimit7dFable', 'zaiUsage'],
    ['projectInfo', 'sessionId', 'sessionDuration', 'burnRate', 'todoProgress'],
  ],
  detailed: [
    ['model', 'context', 'cost', 'rateLimit5h', 'rateLimit7d', 'rateLimit7dSonnet', 'rateLimit7dFable', 'zaiUsage'],
    ['projectInfo', 'sessionName', 'sessionId', 'sessionDuration', 'burnRate', 'tokenSpeed', 'depletionTime', 'todoProgress'],
    ['configCounts', 'toolActivity', 'agentStatus', 'cacheHit', 'promptCache', 'performance'],
    ['tokenBreakdown', 'forecast', 'budget', 'todayCost'],
    ['codexUsage', 'geminiUsage', 'antigravityUsage', 'linesChanged', 'outputStyle', 'version', 'peakHours'],
    ['lastPrompt', 'vimMode', 'apiDuration', 'tagStatus'],
  ],
};

/**
 * Theme identifiers
 */
export type ThemeId = 'default' | 'minimal' | 'catppuccin' | 'catppuccinLatte' | 'dracula' | 'gruvbox' | 'nord' | 'tokyoNight' | 'solarized';

/**
 * Separator styles for widget dividers
 */
export type SeparatorStyle = 'pipe' | 'space' | 'dot' | 'arrow';

/** Layout for a dashboard mod surface: same forms as the status line (mode name, preset string, custom lines). */
export type ModLayout = string | WidgetId[][];

/**
 * User configuration stored in ~/.claude/claude-dashboard.local.json
 */
export interface Config {
  language: 'en' | 'ko' | 'auto';
  plan: 'pro' | 'max';
  /** Display mode: preset (compact/normal/detailed) or custom */
  displayMode: DisplayMode;
  /** Custom line configuration (only used when displayMode is 'custom') */
  lines?: WidgetId[][];
  /** Widget IDs to disable from display presets */
  disabledWidgets?: WidgetId[];
  /** Color theme */
  theme?: ThemeId;
  /** Separator style between widgets. Default: 'pipe' */
  separator?: SeparatorStyle;
  /**
   * Preset shorthand string for quick widget layout.
   * Each character maps to a widget, '|' separates lines.
   * Example: "MC$R|PSD" → Line 1: Model, Context, Cost, RateLimit5h; Line 2: ProjectInfo, SessionDuration, DepletionTime
   * When set, overrides displayMode with 'custom' and generates lines from the string.
   */
  preset?: string;
  /** Dashboard mod pane layout: a display mode name, a preset string, or widget lines (default: detailed) */
  modPane?: ModLayout;
  /** Dashboard mod band layout: a display mode name, a preset string, or widget lines (default: the statusLine layout) */
  modBand?: ModLayout;
  /** Turn the dashboard mod band on when a session starts */
  modBandDefault?: boolean;
  /** Daily budget limit in USD. Enables budget tracking widget. */
  dailyBudget?: number;
  /**
   * Glob patterns for tagStatus widget. Each pattern resolves to at most one
   * tag (the most recent reachable from HEAD). Defaults to ['v*'].
   */
  tagPatterns?: string[];
  cache: {
    ttlSeconds: number;
  };
}

/**
 * Mapping of single characters to widget IDs for preset shortcuts.
 * Used to convert compact preset strings like "MC$R" into widget arrays.
 */
export const PRESET_CHAR_MAP: Record<string, WidgetId> = {
  M: 'model',
  C: 'context',
  b: 'contextBar',
  '%': 'contextPercentage',
  '#': 'contextUsage',
  $: 'cost',
  R: 'rateLimit5h',
  '7': 'rateLimit7d',
  S: 'rateLimit7dSonnet',
  f: 'rateLimit7dFable',
  P: 'projectInfo',
  I: 'sessionId',
  D: 'sessionDuration',
  T: 'toolActivity',
  A: 'agentStatus',
  O: 'todoProgress',
  B: 'burnRate',
  E: 'depletionTime',
  H: 'cacheHit',
  c: 'promptCache',
  w: 'promptCacheState',
  h: 'promptCacheHit',
  x: 'promptCacheMisses',
  X: 'codexUsage',
  G: 'geminiUsage',
  '^': 'antigravityUsage',
  Z: 'zaiUsage',
  K: 'configCounts',
  N: 'tokenBreakdown',
  F: 'performance',
  W: 'forecast',
  U: 'budget',
  V: 'version',
  L: 'linesChanged',
  Y: 'outputStyle',
  Q: 'tokenSpeed',
  q: 'tokenSpeedLast',
  J: 'sessionName',
  '@': 'todayCost',
  '?': 'lastPrompt',
  m: 'vimMode',
  a: 'apiDuration',
  p: 'peakHours',
  t: 'tagStatus',
  '/': 'slashCommand',
  g: 'agentMode',
};

/**
 * Parse a preset shorthand string into widget line arrays.
 * Characters are mapped via PRESET_CHAR_MAP, '|' separates lines.
 * Unknown characters are silently skipped.
 */
export function parsePreset(preset: string): WidgetId[][] {
  return preset
    .split('|')
    .map((line) =>
      [...line]
        .map((ch) => PRESET_CHAR_MAP[ch])
        .filter((id): id is WidgetId => id !== undefined)
    )
    .filter((line) => line.length > 0);
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: Config = {
  language: 'auto',
  plan: 'max',
  displayMode: 'compact',
  cache: {
    ttlSeconds: 300,
  },
};

/**
 * Translations interface
 */
export interface Translations {
  model: {
    opus: string;
    sonnet: string;
    haiku: string;
  };
  labels: {
    '5h': string;
    '7d': string;
    '7d_all': string;
    '7d_sonnet': string;
    '7d_fable': string;
    '1m': string;
  };
  time: {
    days: string;
    hours: string;
    minutes: string;
    seconds: string;
  };
  errors: {
    no_context: string;
  };
  /** Widget-specific labels */
  widgets: {
    tools: string;
    done: string;
    running: string;
    agent: string;
    todos: string;
    claudeMd: string;
    agentsMd: string;
    addedDirs: string;
    rules: string;
    mcps: string;
    hooks: string;
    burnRate: string;
    cache: string;
    tokenSpeedLast: string;
    cacheMiss: string;
    toLimit: string;
    forecast: string;
    budget: string;
    performance: string;
    tokenBreakdown: string;
    todayCost: string;
    apiDuration: string;
    peakHours: string;
    offPeak: string;
  };
  /** Check-usage command labels */
  checkUsage: {
    title: string;
    recommendation: string;
    lowestUsage: string;
    used: string;
    notInstalled: string;
    errorFetching: string;
    noData: string;
  };
  /** Pane view headers and empty states (scripts/views/) */
  paneViews: {
    turns: string;
    agents: string;
    files: string;
    todos: string;
    errors: string;
    background: string;
    emptyTurns: string;
    emptyAgents: string;
    emptyFiles: string;
    emptyTodos: string;
    emptyErrors: string;
    emptyBackground: string;
    noTranscript: string;
    running: string;
    done: string;
    stale: string;
    main: string;
    agentsSuffix: string;
  };
}

/**
 * API Rate Limits from oauth/usage endpoint
 */
export interface UsageLimits {
  five_hour: {
    utilization: number;
    resets_at: string | null;
  } | null;
  seven_day: {
    utilization: number;
    resets_at: string | null;
  } | null;
  seven_day_sonnet: {
    utilization: number;
    resets_at: string | null;
  } | null;
  /** Optional so pre-Fable UsageLimits literals stay valid; null on the stdin path, populated from the API's `limits[]` array. */
  seven_day_fable?: {
    utilization: number;
    resets_at: string | null;
  } | null;
}

/**
 * Negative cache TTL in seconds.
 * After an API failure, suppress retries for this duration.
 * Shared across all API clients (Anthropic, Codex, Gemini, z.ai).
 */
export const NEGATIVE_CACHE_SECONDS = 30;

/**
 * Cache entry for API responses (discriminated union).
 * Success entries hold data of type T; error entries hold null.
 * @handbook 4.1-three-tier-cache
 */
export type CacheEntry<T> =
  | { data: T; timestamp: number; isError?: false }
  | { data: null; timestamp: number; isError: true };

/**
 * Widget context passed to all widgets
 */
export interface WidgetContext {
  stdin: StdinInput;
  config: Config;
  translations: Translations;
  /** Cached API rate limits */
  rateLimits?: UsageLimits | null;
}

/**
 * Widget data types for each widget
 */
export type EffortLevel = 'max' | 'xhigh' | 'high' | 'medium' | 'low';

export interface ModelData {
  id: string;
  displayName: string;
  effortLevel: EffortLevel;
  fastMode: boolean;
}

export interface ContextData {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  contextSize: number;
  percentage: number;
}

export interface CostData {
  totalCostUsd: number;
}

export interface RateLimitData {
  utilization: number;
  resetsAt: string | null;
  isError?: boolean;
}

export interface ProjectInfoData {
  dirName: string;
  gitBranch?: string;
  /** Commits ahead of upstream */
  ahead?: number;
  /** Commits behind upstream */
  behind?: number;
  /** Relative path from project_dir when CWD differs */
  subPath?: string;
  /** Worktree name when in --worktree session */
  worktreeName?: string;
  /** Git remote HTTPS URL for OSC8 hyperlink (includes /tree/{branch}) */
  remoteUrl?: string;
}

/**
 * Tag status data - distance (commits ahead) from each matched tag.
 * Patterns with no matching tag are omitted; widget hidden when empty.
 */
export interface TagStatusData {
  tags: Array<{ name: string; count: number }>;
}

export interface ConfigCountsData {
  claudeMd: number;
  agentsMd: number;
  rules: number;
  mcps: number;
  hooks: number;
  addedDirs: number;
}

export interface SessionDurationData {
  elapsedMs: number;
}

export interface ToolActivityData {
  running: Array<{ name: string; startTime: number; target?: string }>;
  completed: number;
}

export interface AgentStatusData {
  active: Array<{
    name: string;
    description?: string;
    /**
     * Model the subagent runs on, when it can be determined from the Agent
     * tool's `model` parameter or `CLAUDE_CODE_SUBAGENT_MODEL`. Undefined when
     * it inherits the main conversation's model or can't be resolved.
     */
    model?: string;
  }>;
  completed: number;
}

export interface TodoProgressData {
  current?: { content: string; status: 'in_progress' | 'pending' };
  completed: number;
  total: number;
}

/**
 * Burn rate data - tokens consumed per minute
 * @invariant tokensPerMinute >= 0 (enforced in widget)
 */
export interface BurnRateData {
  /** Tokens consumed per minute (session average). Always >= 0. */
  tokensPerMinute: number;
}

/**
 * Depletion time data - estimated time until rate limit is reached
 * @invariant minutesToLimit >= 0 (enforced in widget)
 * @invariant Calculation assumes all current utilization is from this session (approximation)
 */
export interface DepletionTimeData {
  /** Estimated minutes until rate limit is reached. Always >= 0. */
  minutesToLimit: number;
  /** Which rate limit will be hit first */
  limitType: '5h' | '7d';
}

/**
 * Cache hit rate data - percentage of tokens served from cache
 * @invariant hitPercentage is in range [0, 100] (enforced in widget)
 */
export interface CacheHitData {
  /** Cache hit percentage (0-100). Higher is better (more cache reuse). */
  hitPercentage: number;
}

/**
 * Prompt cache data - session-wide main-conversation cache health from stdin.prompt_cache
 * @invariant hitPercentage is in range [0, 100] when defined (enforced in widget)
 */
export interface PromptCacheData {
  /** Whether the cached prefix is still within its TTL */
  warm: boolean;
  /** Session-wide share of input tokens served from cache (0-100); undefined while unknown */
  hitPercentage?: number;
  /** Requests counted as cache misses this session */
  misses: number;
  /** When the cached prefix goes cold (epoch ms); undefined when unknown */
  expiresAt?: number;
}

/**
 * Codex CLI usage limits from ChatGPT backend API
 */
export interface CodexUsageLimits {
  /** Current model from config.toml */
  model: string;
  /** Plan type: plus, pro, etc. */
  planType: string;
  /** Primary rate limit window (duration varies by plan — see windowSeconds) */
  primary: {
    usedPercent: number;
    resetAt: number;
    /** Window length in seconds; absent on responses/caches predating this field */
    windowSeconds?: number | null;
  } | null;
  /** Secondary rate limit window, when the plan has one */
  secondary: {
    usedPercent: number;
    resetAt: number;
    /** Window length in seconds; absent on responses/caches predating this field */
    windowSeconds?: number | null;
  } | null;
}

/**
 * Codex usage widget data
 */
export interface CodexUsageData {
  model: string;
  planType: string;
  primaryPercent: number | null;
  primaryResetAt: number | null;
  /** Primary window length in seconds; drives the displayed label */
  primaryWindowSeconds?: number | null;
  secondaryPercent: number | null;
  secondaryResetAt: number | null;
  /** Secondary window length in seconds; drives the displayed label */
  secondaryWindowSeconds?: number | null;
  /** Indicates API error occurred */
  isError?: boolean;
}

/**
 * Gemini CLI usage limits from Google Code Assist API
 */
export interface GeminiUsageLimits {
  /** Current model from settings.json */
  model: string;
  /** Used percentage (0-100) for current model */
  usedPercent: number | null;
  /** Reset time as ISO string */
  resetAt: string | null;
  /** All buckets from API response */
  buckets: Array<{
    modelId?: string;
    usedPercent: number | null;
    resetAt: string | null;
  }>;
}

/**
 * Gemini usage widget data (single model)
 */
export interface GeminiUsageData {
  model: string;
  usedPercent: number | null;
  resetAt: string | null;
  /** Indicates API error occurred */
  isError?: boolean;
}

/**
 * Gemini usage all widget data (all models)
 */
export interface GeminiUsageAllData {
  buckets: Array<{
    modelId: string;
    usedPercent: number | null;
    resetAt: string | null;
  }>;
  /** Indicates API error occurred */
  isError?: boolean;
}

/**
 * Antigravity CLI usage limits from Google Code Assist API.
 * Quota is shared per model family (weekly window); `groups` mirrors agy's
 * own family grouping while `buckets` keeps the raw per-model entries.
 */
export interface AntigravityUsageLimits {
  /** Current model from settings.json (display-name style) */
  model?: string;
  /** Plan type from loadCodeAssist (when provided) */
  planType?: string;
  /** Model-family groups sharing a weekly quota window */
  groups: Array<{
    label: string;
    usedPercent: number | null;
    resetAt: string | null;
  }>;
  /** Per-model buckets from fetchAvailableModels */
  buckets: Array<{
    modelId: string;
    label: string;
    usedPercent: number | null;
    resetAt: string | null;
  }>;
}

/**
 * Antigravity usage widget data (model-family groups)
 */
export interface AntigravityUsageData {
  groups: AntigravityUsageLimits['groups'];
  /** Indicates API error occurred */
  isError?: boolean;
}

/**
 * Antigravity usage all widget data (per-model buckets)
 */
export interface AntigravityUsageAllData {
  buckets: AntigravityUsageLimits['buckets'];
  /** Indicates API error occurred */
  isError?: boolean;
}

/**
 * Session ID widget data
 */
export interface SessionIdData {
  sessionId: string;
  shortId: string;
}

/**
 * z.ai/ZHIPU usage widget data
 */
export interface ZaiUsageData {
  /** Model name (e.g., 'GLM') */
  model: string;
  /** 5-hour token usage percentage (0-100) */
  tokensPercent: number | null;
  /** Token limit reset time (ms since epoch) */
  tokensResetAt: number | null;
  /** Monthly MCP usage percentage (0-100) */
  mcpPercent: number | null;
  /** MCP limit reset time (ms since epoch) */
  mcpResetAt: number | null;
  /** Indicates API error occurred */
  isError?: boolean;
}

/**
 * Token breakdown data - input/output/cache_write/cache_read
 */
export interface TokenBreakdownData {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
}

/**
 * Performance badge data - composite efficiency score
 * @invariant score is in range [0, 100]
 */
export interface PerformanceData {
  /** Composite score 0-100 (higher = better efficiency) */
  score: number;
  /** Cache hit rate percentage */
  cacheHitRate: number;
  /** Output token ratio percentage */
  outputRatio: number;
}

/**
 * Cost forecast data - estimated hourly cost
 */
export interface ForecastData {
  /** Current session total cost */
  currentCost: number;
  /** Estimated hourly cost extrapolated from session rate */
  hourlyCost: number;
}

/**
 * Budget tracking data - daily spending vs limit
 * @invariant utilization is in range [0, 1]
 */
export interface BudgetData {
  /** Total cost accumulated today */
  dailyTotal: number;
  /** User-configured daily budget limit */
  dailyBudget: number;
  /** Utilization ratio (0-1) */
  utilization: number;
}

/**
 * Version widget data
 */
export interface VersionData {
  version: string;
}

/**
 * Lines changed widget data - coding productivity metric
 */
export interface LinesChangedData {
  added: number;
  removed: number;
  untracked: number;
}

/**
 * Output style widget data - current output style display
 */
export interface OutputStyleData {
  styleName: string;
}

/**
 * Token speed data - output generation speed during API calls
 * @invariant tokensPerSecond >= 0 (enforced in widget)
 */
export interface TokenSpeedData {
  /** Output tokens per second of request wall-clock time. Always >= 0. */
  tokensPerSecond: number;
}

/**
 * Session name data - custom session label from /rename command
 */
export interface SessionNameData {
  /** Session name set by user via /rename */
  name: string;
}

/**
 * Today cost data - total spending across all sessions today
 */
export interface TodayCostData {
  /** Total cost accumulated today across all sessions */
  dailyTotal: number;
}

/**
 * API duration data - percentage of session time spent in API calls
 */
export interface ApiDurationData {
  /** API time as percentage of total session time (0-100) */
  percentage: number;
}

/**
 * Vim mode data - current vim mode when enabled
 */
export interface VimModeData {
  /** Vim mode */
  mode: 'NORMAL' | 'INSERT';
}

/**
 * Last prompt data - most recent user prompt in this session
 */
export interface LastPromptData {
  /** Last user prompt text */
  text: string;
  /** Prompt timestamp (ISO string) */
  timestamp: string;
}

/**
 * Agent mode - identity of the current session (custom agent and/or subagent type).
 * Distinct from `agentStatus` which tracks subagents spawned BY this session.
 */
export interface AgentModeData {
  /** Custom agent activated via /agent <name>, from stdin.agent.name */
  agentName?: string;
  /** Subagent type when this session was dispatched as a subagent, from stdin.agent_type */
  agentType?: string;
}

/**
 * Slash command activity - name of the slash command that started the current turn.
 * Cleared when the user sends a new plain-text message.
 */
export interface SlashCommandData {
  /** Full command name including leading slash, e.g. '/superpowers:brainstorming' */
  name: string;
  /**
   * Unix ms timestamp of when the command was issued. Captured for future
   * elapsed-time rendering (e.g. "🎯 /skill (42s)"); not consumed by the current renderer.
   */
  startTime: number;
}

/**
 * Peak hours data - whether currently in Anthropic API peak hours window
 */
export interface PeakHoursData {
  /** Whether currently in peak hours */
  isPeak: boolean;
  /** Minutes until next transition (peak→off-peak or off-peak→peak) */
  minutesToTransition: number;
}

/**
 * Union type of all widget data
 */
export type WidgetData =
  | ModelData
  | ContextData
  | CostData
  | RateLimitData
  | ProjectInfoData
  | ConfigCountsData
  | SessionDurationData
  | SessionIdData
  | ToolActivityData
  | AgentStatusData
  | TodoProgressData
  | BurnRateData
  | DepletionTimeData
  | CacheHitData
  | PromptCacheData
  | CodexUsageData
  | GeminiUsageData
  | GeminiUsageAllData
  | AntigravityUsageData
  | AntigravityUsageAllData
  | ZaiUsageData
  | TokenBreakdownData
  | PerformanceData
  | ForecastData
  | BudgetData
  | VersionData
  | LinesChangedData
  | OutputStyleData
  | TokenSpeedData
  | SessionNameData
  | TodayCostData
  | LastPromptData
  | VimModeData
  | ApiDurationData
  | PeakHoursData
  | TagStatusData
  | SlashCommandData
  | AgentModeData;

/**
 * Transcript entry from JSONL file
 */
export interface TranscriptEntry {
  type: 'assistant' | 'user' | 'tool_result' | 'system';
  timestamp?: string;
  /** True for subagent records written into the main transcript (older Claude Code) */
  isSidechain?: boolean;
  /** Injected by Claude Code (skill bodies, caveats, image refs), not typed by the user */
  isMeta?: boolean;
  /** Session name set by /rename command */
  customTitle?: string;
  message?: {
    /** Model that produced an assistant record */
    model?: string;
    /** Why an assistant response stopped (`end_turn`, `tool_use`, ...) */
    stop_reason?: string | null;
    /**
     * Block array (assistant + most user entries) or bare string
     * (legacy short-form user entries). Consumers must guard with
     * Array.isArray / typeof === 'string' before iterating.
     */
    content?: string | Array<{
      type: 'tool_use' | 'tool_result' | 'text';
      id?: string;
      tool_use_id?: string; // For tool_result blocks
      name?: string;
      input?: unknown;
      /** Text content for 'text' type blocks */
      text?: string;
      /** tool_result payload: a string or text blocks */
      content?: unknown;
      /** Set on a tool_result whose tool failed (exit code, denial, tool_use_error) */
      is_error?: boolean;
    }>;
  };
}

/**
 * Parsed transcript data.
 * Incrementally tracked fields (running tools, agents, tasks, lastTodoWrite)
 * are updated in processEntries() so extract functions read O(1).
 */
export interface ParsedTranscript {
  /**
   * Running tools only — entries are deleted when their tool_result arrives. `target`
   * is resolved on sight; `input` keeps just the fields later consumers read (see
   * retainToolInput), since this map is persisted with the parse state.
   */
  toolUses: Map<string, { name: string; timestamp?: string; target?: string; input?: unknown }>;
  /** Count of completed tools (replaces unbounded Set for memory efficiency) */
  completedToolCount: number;
  sessionStartTime?: number;
  /** Session name set by /rename command */
  sessionName?: string;

  // --- Incremental tracking (updated in processEntries) ---

  /** Tool IDs that have been dispatched but not yet returned */
  runningToolIds: Set<string>;
  /** Last completed TodoWrite input (for extractTodoProgress) */
  lastTodoWriteInput: unknown;
  /** Active agent (Task) tool IDs */
  activeAgentIds: Set<string>;
  /** Completed agent count */
  completedAgentCount: number;
  /** Tasks from TaskCreate/TaskUpdate, keyed by sequential ID */
  tasks: Map<string, { subject: string; status: string }>;
  /** Next sequential task ID for TaskCreate */
  nextTaskId: number;
  /** Pending TaskCreate tool_use IDs that haven't received results yet */
  pendingTaskCreates: Map<string, { subject: string; status: string; seqId: string }>;
  /** Pending TaskUpdate tool_use IDs */
  pendingTaskUpdates: Map<string, { taskId: string; status?: string; subject?: string }>;
  /** Slash command name + start time, cleared when a plain user message arrives */
  activeSlashCommand: SlashCommandData | null;

  // --- Token accounting (tokenSpeed / tokenSpeedLast / burnRate widgets) ---
  //
  // Derived from the transcript rather than stdin: Claude Code 2.1.132 changed
  // context_window's token counts from session totals to current-context values,
  // and cost.total_api_duration_ms also counts subagent and side-query calls whose
  // output never reaches this transcript.

  /** Output tokens of every main-conversation request with a measured span */
  sessionOutputTokens: number;
  /** Summed wall-clock spans of the same requests, in ms */
  sessionRequestMs: number;
  /** input + cache write + output of every main-conversation request (burnRate) */
  sessionConsumedTokens: number;
  /** Output tokens of the newest API response */
  lastRequestOutput: number;
  /** input + cache write tokens of the newest API response */
  lastRequestInput: number;
  /** Wall-clock span of the newest API response in ms; undefined until measurable */
  lastRequestDurationMs?: number;
  /** Id of the newest API response, tracked while its records stream in */
  lastRequestId?: string;
  /** Start of the newest response — the boundary pinned when its id first appeared */
  lastRequestStartAt?: number;
  /** Timestamp of the newest `user` entry (prompt or tool_result) */
  lastBoundaryAt?: number;

  // --- Pane views (scripts/views/) ---

  /** Turns started by real user input, oldest first, capped at MAX_TURNS */
  turns: TurnRecord[];
  /** Every turn ever started, including those dropped by the cap (turn numbering) */
  turnCount: number;
  /** Files written by Edit/Write/NotebookEdit, keyed by absolute path */
  touchedFiles: Map<string, TouchedFile>;
  /** Failed tool results, oldest first, capped at MAX_TOOL_ERRORS */
  toolErrors: ToolErrorRecord[];
  /** Background jobs (run_in_background Bash, async agents), keyed by task id */
  backgroundTasks: Map<string, BackgroundTask>;
  /** Timestamp of the newest entry; a subagent's last activity */
  lastEntryAt?: number;
  /** stop_reason of the newest assistant record; `end_turn` means the thread came to rest */
  lastStopReason?: string;
  /** Model of the newest assistant record */
  lastModel?: string;
}

/** One user turn: a prompt and everything the assistant did until the next one. */
export interface TurnRecord {
  /** Epoch ms of the prompt */
  at: number;
  /** One-line prompt text, slash command (`/ship args`) or shell input (`!cmd`) */
  prompt: string;
  /** Epoch ms of the turn's newest entry */
  lastAt: number;
  /** input + cache write tokens across the turn's requests */
  tokensIn: number;
  tokensOut: number;
  tools: number;
  agents: number;
}

export interface TouchedFile {
  edits: number;
  lastAt: number;
}

export interface ToolErrorRecord {
  at: number;
  tool: string;
  target?: string;
  /** First line of the error text */
  message: string;
}

export interface BackgroundTask {
  kind: 'bash' | 'agent' | 'other';
  description?: string;
  startedAt: number;
  /** `running` until a task-notification arrives, then its `<status>` */
  status: string;
  summary?: string;
  endedAt?: number;
}

/**
 * Bucket usage info for CLI with multiple model buckets (e.g., Gemini)
 */
export interface BucketUsageInfo {
  modelId: string;
  /** Human-readable display name when it differs from modelId */
  label?: string;
  usedPercent: number | null;
  resetAt: string | null;
}

/**
 * CLI usage data for check-usage command
 */
export interface CLIUsageInfo {
  name: string;
  available: boolean;
  error: boolean;
  /** Primary scoring metric for recommendations — window varies per CLI (5h, weekly, token bucket) */
  primaryPercent: number | null;
  fiveHourPercent: number | null;
  sevenDayPercent: number | null;
  fiveHourReset: string | null;
  sevenDayReset: string | null;
  model?: string;
  plan?: string;
  buckets?: BucketUsageInfo[];
  /** Family-group quota rows for CLIs with grouped limits (e.g., Antigravity) */
  groups?: Array<{ label: string; usedPercent: number | null; resetAt: string | null }>;
}

/**
 * Output structure for check-usage command
 */
export interface CheckUsageOutput {
  claude: CLIUsageInfo;
  codex: CLIUsageInfo | null;
  gemini: CLIUsageInfo | null;
  antigravity: CLIUsageInfo | null;
  zai: CLIUsageInfo | null;
  recommendation: string | null;
  recommendationReason: string;
}
