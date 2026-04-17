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
    /** Total time spent in API calls in ms (excludes user/tool time) */
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
 * Widget identifiers
 */
export type WidgetId =
  | 'model'
  | 'context'
  | 'cost'
  | 'rateLimit5h'
  | 'rateLimit7d'
  | 'rateLimit7dSonnet'
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
  | 'codexUsage'
  | 'geminiUsage'
  | 'geminiUsageAll'
  | 'zaiUsage'
  | 'tokenBreakdown'
  | 'performance'
  | 'forecast'
  | 'budget'
  | 'version'
  | 'linesChanged'
  | 'outputStyle'
  | 'tokenSpeed'
  | 'sessionName'
  | 'todayCost'
  | 'lastPrompt'
  | 'vimMode'
  | 'apiDuration'
  | 'peakHours'
  | 'tagStatus';

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
    ['model', 'context', 'cost', 'rateLimit5h', 'rateLimit7d', 'rateLimit7dSonnet', 'zaiUsage'],
  ],
  normal: [
    ['model', 'context', 'cost', 'rateLimit5h', 'rateLimit7d', 'rateLimit7dSonnet', 'zaiUsage'],
    ['projectInfo', 'sessionId', 'sessionDuration', 'burnRate', 'todoProgress'],
  ],
  detailed: [
    ['model', 'context', 'cost', 'rateLimit5h', 'rateLimit7d', 'rateLimit7dSonnet', 'zaiUsage'],
    ['projectInfo', 'sessionName', 'sessionId', 'sessionDuration', 'burnRate', 'tokenSpeed', 'depletionTime', 'todoProgress'],
    ['configCounts', 'toolActivity', 'agentStatus', 'cacheHit', 'performance'],
    ['tokenBreakdown', 'forecast', 'budget', 'todayCost'],
    ['codexUsage', 'geminiUsage', 'linesChanged', 'outputStyle', 'version', 'peakHours'],
    ['lastPrompt'],
  ],
};

/**
 * Theme identifiers
 */
export type ThemeId = 'default' | 'minimal' | 'catppuccin' | 'dracula' | 'gruvbox' | 'nord' | 'tokyoNight' | 'solarized';

/**
 * Separator styles for widget dividers
 */
export type SeparatorStyle = 'pipe' | 'space' | 'dot' | 'arrow';

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
  $: 'cost',
  R: 'rateLimit5h',
  '7': 'rateLimit7d',
  S: 'rateLimit7dSonnet',
  P: 'projectInfo',
  I: 'sessionId',
  D: 'sessionDuration',
  T: 'toolActivity',
  A: 'agentStatus',
  O: 'todoProgress',
  B: 'burnRate',
  E: 'depletionTime',
  H: 'cacheHit',
  X: 'codexUsage',
  G: 'geminiUsage',
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
  J: 'sessionName',
  '@': 'todayCost',
  '?': 'lastPrompt',
  m: 'vimMode',
  a: 'apiDuration',
  p: 'peakHours',
  t: 'tagStatus',
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
export type EffortLevel = 'xhigh' | 'high' | 'medium' | 'low';

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
  active: Array<{ name: string; description?: string }>;
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
 * Codex CLI usage limits from ChatGPT backend API
 */
export interface CodexUsageLimits {
  /** Current model from config.toml */
  model: string;
  /** Plan type: plus, pro, etc. */
  planType: string;
  /** Primary (5h) rate limit window */
  primary: {
    usedPercent: number;
    resetAt: number;
  } | null;
  /** Secondary (7d) rate limit window */
  secondary: {
    usedPercent: number;
    resetAt: number;
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
  secondaryPercent: number | null;
  secondaryResetAt: number | null;
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
  /** Output tokens per second of API time. Always >= 0. */
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
  | CodexUsageData
  | GeminiUsageData
  | GeminiUsageAllData
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
  | TagStatusData;

/**
 * Transcript entry from JSONL file
 */
export interface TranscriptEntry {
  type: 'assistant' | 'user' | 'tool_result' | 'system';
  timestamp?: string;
  /** Session name set by /rename command */
  customTitle?: string;
  message?: {
    content?: Array<{
      type: 'tool_use' | 'tool_result' | 'text';
      id?: string;
      tool_use_id?: string; // For tool_result blocks
      name?: string;
      input?: unknown;
      /** Text content for 'text' type blocks */
      text?: string;
    }>;
  };
}

/**
 * Parsed transcript data.
 * Incrementally tracked fields (running tools, agents, tasks, lastTodoWrite)
 * are updated in processEntries() so extract functions read O(1).
 */
export interface ParsedTranscript {
  toolUses: Map<string, { name: string; timestamp?: string; input?: unknown }>;
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
}

/**
 * Bucket usage info for CLI with multiple model buckets (e.g., Gemini)
 */
export interface BucketUsageInfo {
  modelId: string;
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
  fiveHourPercent: number | null;
  sevenDayPercent: number | null;
  fiveHourReset: string | null;
  sevenDayReset: string | null;
  model?: string;
  plan?: string;
  buckets?: BucketUsageInfo[];
}

/**
 * Output structure for check-usage command
 */
export interface CheckUsageOutput {
  claude: CLIUsageInfo;
  codex: CLIUsageInfo | null;
  gemini: CLIUsageInfo | null;
  zai: CLIUsageInfo | null;
  recommendation: string | null;
  recommendationReason: string;
}
