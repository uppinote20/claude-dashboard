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
  | 'todoProgress';

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
    ['projectInfo', 'sessionDuration', 'todoProgress'],
  ],
  detailed: [
    ['model', 'context', 'cost', 'rateLimit5h', 'rateLimit7d', 'rateLimit7dSonnet'],
    ['projectInfo', 'sessionDuration', 'todoProgress'],
    ['configCounts', 'toolActivity', 'agentStatus'],
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
  | TodoProgressData;

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
