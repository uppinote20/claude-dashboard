import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { modelWidget } from '../widgets/model.js';
import { contextWidget } from '../widgets/context.js';
import { costWidget } from '../widgets/cost.js';
import { todoProgressWidget } from '../widgets/todo-progress.js';
import { agentStatusWidget } from '../widgets/agent-status.js';
import { toolActivityWidget } from '../widgets/tool-activity.js';
import { projectInfoWidget } from '../widgets/project-info.js';
import { burnRateWidget } from '../widgets/burn-rate.js';
import { cacheHitWidget } from '../widgets/cache-hit.js';
import { depletionTimeWidget } from '../widgets/depletion-time.js';
import type { WidgetContext, StdinInput, Config, Translations } from '../types.js';

// Mock translations
const mockTranslations: Translations = {
  model: { opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku' },
  labels: { '5h': '5h', '7d': '7d', '7d_all': '7d', '7d_sonnet': '7d-S' },
  time: { hours: 'h', minutes: 'm', seconds: 's' },
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
};

const mockConfig: Config = {
  language: 'en',
  plan: 'max',
  displayMode: 'compact',
  cache: { ttlSeconds: 60 },
};

function createStdin(overrides: Partial<StdinInput> = {}): StdinInput {
  return {
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
    ...overrides,
  };
}

function createContext(stdinOverrides: Partial<StdinInput> = {}): WidgetContext {
  return {
    stdin: createStdin(stdinOverrides),
    config: mockConfig,
    translations: mockTranslations,
    rateLimits: null,
  };
}

describe('widgets', () => {
  describe('modelWidget', () => {
    it('should have correct id and name', () => {
      expect(modelWidget.id).toBe('model');
      expect(modelWidget.name).toBe('Model');
    });

    it('should return default values when model data is missing', async () => {
      const ctx = createContext({ model: undefined as any });
      const data = await modelWidget.getData(ctx);
      expect(data).toEqual({ id: '', displayName: '-' });
    });

    it('should extract model data', async () => {
      const ctx = createContext();
      const data = await modelWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.id).toBe('claude-sonnet-3.5');
      expect(data?.displayName).toBe('Claude 3.5 Sonnet');
    });

    it('should render shortened model name', () => {
      const ctx = createContext();
      const data = { id: 'claude-sonnet', displayName: 'Claude 3.5 Sonnet' };
      const result = modelWidget.render(data, ctx);

      expect(result).toContain('Sonnet');
      expect(result).toContain('🤖');
    });

    it('should shorten Opus model name', () => {
      const ctx = createContext();
      const data = { id: 'claude-opus', displayName: 'Claude Opus 4' };
      const result = modelWidget.render(data, ctx);

      expect(result).toContain('Opus');
    });
  });

  describe('contextWidget', () => {
    it('should have correct id and name', () => {
      expect(contextWidget.id).toBe('context');
      expect(contextWidget.name).toBe('Context');
    });

    it('should return default values when usage is missing', async () => {
      const ctx = createContext({
        context_window: {
          total_input_tokens: 0,
          total_output_tokens: 0,
          context_window_size: 200000,
          current_usage: null,
        },
      });
      const data = await contextWidget.getData(ctx);
      expect(data).toEqual({
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        contextSize: 200000,
        percentage: 0,
      });
    });

    it('should calculate context data correctly', async () => {
      const ctx = createContext();
      const data = await contextWidget.getData(ctx);

      expect(data).not.toBeNull();
      // input_tokens(5000) + cache_creation(1000) + cache_read(500) = 6500
      expect(data?.inputTokens).toBe(6500);
      expect(data?.outputTokens).toBe(2000);
      expect(data?.totalTokens).toBe(8500);
      expect(data?.contextSize).toBe(200000);
      // 6500 / 200000 * 100 = 3.25% -> 3%
      expect(data?.percentage).toBe(3);
    });

    it('should render progress bar and percentage', () => {
      const ctx = createContext();
      const data = {
        inputTokens: 50000,
        outputTokens: 10000,
        totalTokens: 60000,
        contextSize: 200000,
        percentage: 25,
      };
      const result = contextWidget.render(data, ctx);

      expect(result).toContain('25%');
      expect(result).toContain('50K/200K');
    });
  });

  describe('costWidget', () => {
    it('should have correct id and name', () => {
      expect(costWidget.id).toBe('cost');
      expect(costWidget.name).toBe('Cost');
    });

    it('should return default values when cost is missing', async () => {
      const ctx = createContext({ cost: undefined as any });
      const data = await costWidget.getData(ctx);
      expect(data).toEqual({ totalCostUsd: 0 });
    });

    it('should extract cost data', async () => {
      const ctx = createContext();
      const data = await costWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.totalCostUsd).toBe(0.75);
    });

    it('should render formatted cost', () => {
      const ctx = createContext();
      const data = { totalCostUsd: 1.5 };
      const result = costWidget.render(data, ctx);

      expect(result).toContain('$1.50');
    });
  });

  describe('projectInfoWidget', () => {
    it('should have correct id and name', () => {
      expect(projectInfoWidget.id).toBe('projectInfo');
      expect(projectInfoWidget.name).toBe('Project Info');
    });

    it('should return null when workspace is missing', async () => {
      const ctx = createContext({ workspace: undefined as any });
      const data = await projectInfoWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should extract directory name', async () => {
      const ctx = createContext();
      const data = await projectInfoWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.dirName).toBe('project');
    });

    it('should render directory with folder icon', () => {
      const ctx = createContext();
      const data = { dirName: 'my-project', gitBranch: 'main' };
      const result = projectInfoWidget.render(data, ctx);

      expect(result).toContain('📁');
      expect(result).toContain('my-project');
      expect(result).toContain('main');
    });

    it('should render without git branch if not available', () => {
      const ctx = createContext();
      const data = { dirName: 'my-project' };
      const result = projectInfoWidget.render(data, ctx);

      expect(result).toContain('my-project');
      expect(result).not.toContain('(');
    });
  });

  describe('todoProgressWidget', () => {
    it('should have correct id and name', () => {
      expect(todoProgressWidget.id).toBe('todoProgress');
      expect(todoProgressWidget.name).toBe('Todo Progress');
    });

    it('should return null when no transcript path', async () => {
      const ctx = createContext();
      const data = await todoProgressWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should render placeholder when total is 0', () => {
      const ctx = createContext();
      const data = { completed: 0, total: 0 };
      const result = todoProgressWidget.render(data, ctx);
      expect(result).toContain('Todos: -');
    });

    it('should render current task with progress', () => {
      const ctx = createContext();
      const data = {
        current: { content: 'Fix bug', status: 'in_progress' as const },
        completed: 2,
        total: 5,
      };
      const result = todoProgressWidget.render(data, ctx);

      expect(result).toContain('Fix bug');
      expect(result).toContain('[2/5]');
      expect(result).toContain('✓');
    });

    it('should truncate long task names', () => {
      const ctx = createContext();
      const data = {
        current: { content: 'This is a very long task name that should be truncated', status: 'in_progress' as const },
        completed: 1,
        total: 3,
      };
      const result = todoProgressWidget.render(data, ctx);

      expect(result).toContain('...');
    });

    it('should render completed state', () => {
      const ctx = createContext();
      const data = { completed: 5, total: 5 };
      const result = todoProgressWidget.render(data, ctx);

      expect(result).toContain('Todos');
      expect(result).toContain('5/5');
    });
  });

  describe('agentStatusWidget', () => {
    it('should have correct id and name', () => {
      expect(agentStatusWidget.id).toBe('agentStatus');
      expect(agentStatusWidget.name).toBe('Agent Status');
    });

    it('should return null when no transcript path', async () => {
      const ctx = createContext();
      const data = await agentStatusWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should render active agent', () => {
      const ctx = createContext();
      const data = {
        active: [{ name: 'Explore', description: 'Searching codebase' }],
        completed: 2,
      };
      const result = agentStatusWidget.render(data, ctx);

      expect(result).toContain('Agent');
      expect(result).toContain('Explore');
      expect(result).toContain('🤖');
    });

    it('should truncate long descriptions', () => {
      const ctx = createContext();
      const data = {
        active: [{ name: 'Explore', description: 'This is a very long description that needs truncation' }],
        completed: 0,
      };
      const result = agentStatusWidget.render(data, ctx);

      expect(result).toContain('...');
    });

    it('should show completed count when no active agents', () => {
      const ctx = createContext();
      const data = { active: [], completed: 5 };
      const result = agentStatusWidget.render(data, ctx);

      expect(result).toContain('Agent');
      expect(result).toContain('5');
      expect(result).toContain('done');
    });
  });

  describe('toolActivityWidget', () => {
    it('should have correct id and name', () => {
      expect(toolActivityWidget.id).toBe('toolActivity');
      expect(toolActivityWidget.name).toBe('Tool Activity');
    });

    it('should return null when no transcript path', async () => {
      const ctx = createContext();
      const data = await toolActivityWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should render running tools', () => {
      const ctx = createContext();
      const data = {
        running: [
          { name: 'Bash', startTime: Date.now() },
          { name: 'Read', startTime: Date.now() },
        ],
        completed: 10,
      };
      const result = toolActivityWidget.render(data, ctx);

      expect(result).toContain('Bash');
      expect(result).toContain('Read');
      expect(result).toContain('10');
      expect(result).toContain('⚙️');
    });

    it('should limit displayed running tools', () => {
      const ctx = createContext();
      const data = {
        running: [
          { name: 'Bash', startTime: Date.now() },
          { name: 'Read', startTime: Date.now() },
          { name: 'Write', startTime: Date.now() },
          { name: 'Edit', startTime: Date.now() },
        ],
        completed: 5,
      };
      const result = toolActivityWidget.render(data, ctx);

      // Should show first 2 and "+2"
      expect(result).toContain('+2');
    });

    it('should show completed count when no running tools', () => {
      const ctx = createContext();
      const data = { running: [], completed: 15 };
      const result = toolActivityWidget.render(data, ctx);

      expect(result).toContain('Tools');
      expect(result).toContain('15');
      expect(result).toContain('done');
    });
  });

  describe('burnRateWidget', () => {
    it('should have correct id and name', () => {
      expect(burnRateWidget.id).toBe('burnRate');
      expect(burnRateWidget.name).toBe('Burn Rate');
    });

    it('should return 0 when usage is missing', async () => {
      const ctx = createContext({
        context_window: {
          total_input_tokens: 0,
          total_output_tokens: 0,
          context_window_size: 200000,
          current_usage: null,
        },
      });
      const data = await burnRateWidget.getData(ctx);
      expect(data).toEqual({ tokensPerMinute: 0 });
    });

    it('should render burn rate with tokens per minute', () => {
      const ctx = createContext();
      const data = { tokensPerMinute: 5500 };
      const result = burnRateWidget.render(data, ctx);

      expect(result).toContain('🔥');
      expect(result).toContain('5.5K');
      expect(result).toContain('/min');
    });

    it('should format large burn rates correctly', () => {
      const ctx = createContext();
      const data = { tokensPerMinute: 1500000 };
      const result = burnRateWidget.render(data, ctx);

      expect(result).toContain('1.5M');
    });
  });

  describe('cacheHitWidget', () => {
    it('should have correct id and name', () => {
      expect(cacheHitWidget.id).toBe('cacheHit');
      expect(cacheHitWidget.name).toBe('Cache Hit Rate');
    });

    it('should return 0% when usage is missing', async () => {
      const ctx = createContext({
        context_window: {
          total_input_tokens: 0,
          total_output_tokens: 0,
          context_window_size: 200000,
          current_usage: null,
        },
      });
      const data = await cacheHitWidget.getData(ctx);
      expect(data).toEqual({ hitPercentage: 0 });
    });

    it('should return 0% when no input tokens', async () => {
      const ctx = createContext({
        context_window: {
          total_input_tokens: 0,
          total_output_tokens: 0,
          context_window_size: 200000,
          current_usage: {
            input_tokens: 0,
            output_tokens: 0,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
          },
        },
      });
      const data = await cacheHitWidget.getData(ctx);
      expect(data).toEqual({ hitPercentage: 0 });
    });

    it('should calculate cache hit rate correctly', async () => {
      const ctx = createContext({
        context_window: {
          total_input_tokens: 10000,
          total_output_tokens: 5000,
          context_window_size: 200000,
          current_usage: {
            input_tokens: 3000,
            output_tokens: 5000,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 7000,
          },
        },
      });
      const data = await cacheHitWidget.getData(ctx);

      expect(data).not.toBeNull();
      // cache_read(7000) / (cache_read(7000) + input(3000) + cache_creation(0)) = 70%
      expect(data?.hitPercentage).toBe(70);
    });

    it('should include cache_creation_input_tokens in denominator', async () => {
      const ctx = createContext({
        context_window: {
          total_input_tokens: 14000,
          total_output_tokens: 5000,
          context_window_size: 200000,
          current_usage: {
            input_tokens: 0,
            output_tokens: 5000,
            cache_creation_input_tokens: 7000,
            cache_read_input_tokens: 7000,
          },
        },
      });
      const data = await cacheHitWidget.getData(ctx);

      expect(data).not.toBeNull();
      // cache_read(7000) / (cache_read(7000) + input(0) + cache_creation(7000)) = 50%
      expect(data?.hitPercentage).toBe(50);
    });

    it('should render cache hit percentage', () => {
      const ctx = createContext();
      const data = { hitPercentage: 67 };
      const result = cacheHitWidget.render(data, ctx);

      expect(result).toContain('📦');
      expect(result).toContain('67%');
    });
  });

  describe('depletionTimeWidget', () => {
    it('should have correct id and name', () => {
      expect(depletionTimeWidget.id).toBe('depletionTime');
      expect(depletionTimeWidget.name).toBe('Depletion Time');
    });

    it('should return null when rate limits are missing', async () => {
      const ctx = createContext();
      ctx.rateLimits = null;
      const data = await depletionTimeWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should return null when utilization is 0', async () => {
      const ctx = createContext();
      ctx.rateLimits = {
        five_hour: { utilization: 0, resets_at: null },
        seven_day: null,
        seven_day_sonnet: null,
      };
      const data = await depletionTimeWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should render depletion time estimate', () => {
      const ctx = createContext();
      const data = { minutesToLimit: 120, limitType: '5h' as const };
      const result = depletionTimeWidget.render(data, ctx);

      expect(result).toContain('⏳');
      expect(result).toContain('2h');
      expect(result).toContain('5h');
    });

    it('should format short depletion times', () => {
      const ctx = createContext();
      const data = { minutesToLimit: 45, limitType: '5h' as const };
      const result = depletionTimeWidget.render(data, ctx);

      expect(result).toContain('45m');
    });
  });
});
