/**
 * Core type definitions and display presets
 * @handbook 2.1-naming-conventions
 * @handbook 3.5-display-mode-presets
 */

/**
 * Stdin JSON input from Claude Code
 * @handbook 2.1-naming-rules
 * @handbook 3.5-display-modes-presets
 */
export interface StdinInput {
  model: {
    id: string;
    display_name: string;
  };
  workspace: {
    current_dir: string;
  };
  context_window: {
    total_input_tokens: number;
    total_output_tokens: number;
    context_window_size: number;
    current_usage: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens: number;
      cache_read_input_tokens: number;
    } | null;
  };
  cost: {
    total_cost_usd: number;
  };
  /** Path to transcript.jsonl file (if available) */
  transcript_path?: string;
  /** Session ID for duration tracking */
  session_id?: string;
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
  | 'budget';

/**
 * Display mode for status line output
 */
export type DisplayMode = 'compact' | 'normal' | 'detailed' | 'custom';

/**
 * Preset configurations for each display mode
 *
 * compact: Essential metrics - 1 line
 * normal: Essential + project/session/todo - 2 lines
 * detailed: Normal + config/tools/agents (additive) - 5 lines
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
    ['projectInfo', 'sessionId', 'sessionDuration', 'burnRate', 'depletionTime', 'todoProgress'],
    ['configCounts', 'toolActivity', 'agentStatus', 'cacheHit', 'performance'],
    ['tokenBreakdown', 'forecast', 'budget'],
    ['codexUsage', 'geminiUsage'],
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
export type EffortLevel = 'high' | 'medium' | 'low';

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
}

export interface ConfigCountsData {
  claudeMd: number;
  rules: number;
  mcps: number;
  hooks: number;
}

export interface SessionDurationData {
  elapsedMs: number;
}

export interface ToolActivityData {
  running: Array<{ name: string; startTime: number }>;
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
  | BudgetData;

/**
 * Transcript entry from JSONL file
 */
export interface TranscriptEntry {
  type: 'assistant' | 'user' | 'tool_result' | 'system';
  timestamp?: string;
  message?: {
    content?: Array<{
      type: 'tool_use' | 'tool_result' | 'text';
      id?: string;
      tool_use_id?: string; // For tool_result blocks
      name?: string;
      input?: unknown;
    }>;
  };
}

/**
 * Parsed transcript data
 */
export interface ParsedTranscript {
  entries: TranscriptEntry[];
  toolUses: Map<string, { name: string; timestamp?: string }>;
  toolResults: Set<string>;
  sessionStartTime?: number;
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
