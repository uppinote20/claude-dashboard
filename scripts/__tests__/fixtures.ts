/**
 * Shared test fixtures for widget and formatter tests.
 * Values match en.json locale to keep tests consistent with production.
 */

import type { Translations, Config, StdinInput } from '../types.js';

export const MOCK_TRANSLATIONS: Translations = {
  model: { opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku' },
  labels: { '5h': '5h', '7d': '7d', '7d_all': '7d', '7d_sonnet': '7d-S', '1m': '1m' },
  time: { days: 'd', hours: 'h', minutes: 'm', seconds: 's' },
  errors: { no_context: 'No context yet' },
  widgets: {
    tools: 'Tools',
    done: 'done',
    running: 'running',
    agent: 'Agent',
    todos: 'Todos',
    claudeMd: 'CLAUDE.md',
    rules: 'Rules',
    mcps: 'MCP',
    hooks: 'Hooks',
    burnRate: 'Rate',
    cache: 'Cache',
    toLimit: 'to',
  },
  checkUsage: {
    title: 'CLI Usage Dashboard',
    recommendation: 'Recommendation',
    lowestUsage: 'Lowest usage',
    used: 'used',
    notInstalled: 'not installed',
    errorFetching: 'Error fetching data',
    noData: 'No usage data available',
  },
};

export const MOCK_CONFIG: Config = {
  language: 'en',
  plan: 'max',
  displayMode: 'compact',
  cache: { ttlSeconds: 60 },
};

export const MOCK_STDIN: StdinInput = {
  model: { id: 'claude-sonnet-3.5', display_name: 'Claude 3.5 Sonnet' },
  workspace: { current_dir: '/test/project' },
  context_window: {
    total_input_tokens: 5000,
    total_output_tokens: 2000,
    context_window_size: 200000,
    current_usage: {
      input_tokens: 5000,
      output_tokens: 2000,
      cache_creation_input_tokens: 1000,
      cache_read_input_tokens: 500,
    },
  },
  cost: { total_cost_usd: 0.75 },
  session_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
};
