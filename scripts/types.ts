/**
 * Stdin JSON input from Claude Code
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
  | 'toolActivity'
  | 'agentStatus'
  | 'todoProgress'
  | 'burnRate'
  | 'depletionTime'
  | 'cacheHit'
  | 'codexUsage'
  | 'geminiUsage';

/**
 * Display mode for status line output
 */
export type DisplayMode = 'compact' | 'normal' | 'detailed' | 'custom';

/**
 * Preset configurations for each display mode
 *
 * compact: Essential metrics - 1 line
 * normal: Essential + project/session/todo - 2 lines
 * detailed: Normal + config/tools/agents (additive) - 3 lines
 */
export const DISPLAY_PRESETS: Record<Exclude<DisplayMode, 'custom'>, WidgetId[][]> = {
  compact: [
    ['model', 'context', 'cost', 'rateLimit5h', 'rateLimit7d', 'rateLimit7dSonnet'],
  ],
  normal: [
    ['model', 'context', 'cost', 'rateLimit5h', 'rateLimit7d', 'rateLimit7dSonnet'],
    ['projectInfo', 'sessionDuration', 'burnRate', 'todoProgress'],
  ],
  detailed: [
    ['model', 'context', 'cost', 'rateLimit5h', 'rateLimit7d', 'rateLimit7dSonnet'],
    ['projectInfo', 'sessionDuration', 'burnRate', 'depletionTime', 'todoProgress'],
    ['configCounts', 'toolActivity', 'agentStatus', 'cacheHit'],
    ['codexUsage', 'geminiUsage'],
  ],
};

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
  cache: {
    ttlSeconds: number;
  };
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: Config = {
  language: 'auto',
  plan: 'max',
  displayMode: 'compact',
  cache: {
    ttlSeconds: 60,
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
 * Cache entry for API responses
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

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
export interface ModelData {
  id: string;
  displayName: string;
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
 * Gemini usage widget data
 */
export interface GeminiUsageData {
  model: string;
  usedPercent: number | null;
  resetAt: string | null;
  /** Indicates API error occurred */
  isError?: boolean;
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
  | ToolActivityData
  | AgentStatusData
  | TodoProgressData
  | BurnRateData
  | DepletionTimeData
  | CacheHitData
  | CodexUsageData
  | GeminiUsageData;

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
