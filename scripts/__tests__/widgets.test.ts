/**
 * @handbook 8.1-test-structure
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
import { codexUsageWidget } from '../widgets/codex-usage.js';
import { geminiUsageWidget } from '../widgets/gemini-usage.js';
import { configCountsWidget } from '../widgets/config-counts.js';
import { sessionDurationWidget } from '../widgets/session-duration.js';
import { versionWidget } from '../widgets/version.js';
import { linesChangedWidget } from '../widgets/lines-changed.js';
import { outputStyleWidget } from '../widgets/output-style.js';
import * as codexClient from '../utils/codex-client.js';
import * as geminiClient from '../utils/gemini-client.js';
import * as sessionUtils from '../utils/session.js';
import type { WidgetContext, StdinInput, ModelData } from '../types.js';
import { MOCK_TRANSLATIONS, MOCK_CONFIG, MOCK_STDIN } from './fixtures.js';

// Mock version module for codex-client
vi.mock('../version.js', () => ({
  VERSION: '1.0.0-test',
}));

function createStdin(overrides: Partial<StdinInput> = {}): StdinInput {
  return { ...MOCK_STDIN, ...overrides };
}

function createContext(stdinOverrides: Partial<StdinInput> = {}): WidgetContext {
  return {
    stdin: createStdin(stdinOverrides),
    config: MOCK_CONFIG,
    translations: MOCK_TRANSLATIONS,
    rateLimits: null,
  };
}

function createModelData(overrides: Partial<ModelData> = {}): ModelData {
  return {
    id: 'claude-opus-4-6',
    displayName: 'Claude Opus 4.6',
    effortLevel: 'high',
    fastMode: false,
    ...overrides,
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
      expect(data).toEqual({ id: '', displayName: '-', effortLevel: 'high', fastMode: expect.any(Boolean) });
    });

    it('should extract model data', async () => {
      const ctx = createContext();
      const data = await modelWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.id).toBe('claude-sonnet-3.5');
      expect(data?.displayName).toBe('Claude 3.5 Sonnet');
    });

    it('should render shortened model name with effort for Sonnet', () => {
      const ctx = createContext();
      const result = modelWidget.render(
        createModelData({ id: 'claude-sonnet', displayName: 'Claude 3.5 Sonnet' }),
        ctx,
      );

      expect(result).toContain('Sonnet');
      expect(result).toContain('🤖');
      expect(result).toContain('(H)');
    });

    it('should shorten Opus model name with effort', () => {
      const ctx = createContext();
      const result = modelWidget.render(
        createModelData({ id: 'claude-opus', displayName: 'Claude Opus 4' }),
        ctx,
      );

      expect(result).toContain('Opus');
      expect(result).toContain('(H)');
    });

    it('should show medium effort for Opus 4.6 by default', () => {
      const ctx = createContext();
      const result = modelWidget.render(
        createModelData({ id: 'claude-opus-4-6', displayName: 'Claude Opus 4.6', effortLevel: 'medium' }),
        ctx,
      );

      expect(result).toContain('Opus');
      expect(result).toContain('(M)');
    });

    it('should show medium effort for Sonnet 4.6 by default', () => {
      const ctx = createContext();
      const result = modelWidget.render(
        createModelData({ id: 'claude-sonnet-4-6', displayName: 'Claude Sonnet 4.6', effortLevel: 'medium' }),
        ctx,
      );

      expect(result).toContain('Sonnet');
      expect(result).toContain('(M)');
    });

    it('should show effort level for Sonnet', () => {
      const ctx = createContext();
      const result = modelWidget.render(
        createModelData({ id: 'claude-sonnet-4-6', displayName: 'Claude Sonnet 4.6', effortLevel: 'low' }),
        ctx,
      );

      expect(result).toContain('Sonnet');
      expect(result).toContain('(L)');
    });

    it('should not show effort level for Haiku', () => {
      const ctx = createContext();
      const result = modelWidget.render(
        createModelData({ id: 'claude-haiku', displayName: 'Claude 4.5 Haiku' }),
        ctx,
      );

      expect(result).toContain('Haiku');
      expect(result).not.toContain('(H)');
      expect(result).not.toContain('(M)');
      expect(result).not.toContain('(L)');
    });

    it('should show fast mode indicator for Opus', () => {
      const ctx = createContext();
      const result = modelWidget.render(
        createModelData({ effortLevel: 'medium', fastMode: true }),
        ctx,
      );

      expect(result).toContain('Opus');
      expect(result).toContain('(M)');
      expect(result).toContain('↯');
    });

    it('should not show fast mode indicator for Sonnet', () => {
      const ctx = createContext();
      const result = modelWidget.render(
        createModelData({ id: 'claude-sonnet-4-6', displayName: 'Claude Sonnet 4.6', fastMode: true }),
        ctx,
      );

      expect(result).toContain('Sonnet');
      expect(result).toContain('(H)');
      expect(result).not.toContain('↯');
    });

    it('should not show fast mode indicator for Haiku', () => {
      const ctx = createContext();
      const result = modelWidget.render(
        createModelData({ id: 'claude-haiku', displayName: 'Claude 4.5 Haiku', fastMode: true }),
        ctx,
      );

      expect(result).toContain('Haiku');
      expect(result).not.toContain('↯');
    });

    it('should not show fast mode indicator when fast mode is off', () => {
      const ctx = createContext();
      const result = modelWidget.render(createModelData(), ctx);

      expect(result).toContain('Opus');
      expect(result).toContain('(H)');
      expect(result).not.toContain('↯');
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

    it('should use official used_percentage when available', async () => {
      const ctx = createContext({
        context_window: {
          total_input_tokens: 5000,
          total_output_tokens: 2000,
          context_window_size: 200000,
          used_percentage: 42,
          current_usage: {
            input_tokens: 5000,
            output_tokens: 2000,
            cache_creation_input_tokens: 1000,
            cache_read_input_tokens: 500,
          },
        },
      });
      const data = await contextWidget.getData(ctx);

      expect(data?.percentage).toBe(42);
    });

    it('should fall back to calculated percentage when used_percentage is null', async () => {
      const ctx = createContext({
        context_window: {
          total_input_tokens: 5000,
          total_output_tokens: 2000,
          context_window_size: 200000,
          used_percentage: null,
          current_usage: {
            input_tokens: 5000,
            output_tokens: 2000,
            cache_creation_input_tokens: 1000,
            cache_read_input_tokens: 500,
          },
        },
      });
      const data = await contextWidget.getData(ctx);

      // Fallback: calculatePercent(6500, 200000) = 3%
      expect(data?.percentage).toBe(3);
    });

    it('should fall back to calculated percentage when used_percentage is undefined', async () => {
      const ctx = createContext();
      const data = await contextWidget.getData(ctx);

      // No used_percentage in MOCK_STDIN, so fallback
      expect(data?.percentage).toBe(3);
    });

    it('should use used_percentage even when current_usage is null', async () => {
      const ctx = createContext({
        context_window: {
          total_input_tokens: 0,
          total_output_tokens: 0,
          context_window_size: 200000,
          used_percentage: 15,
          current_usage: null,
        },
      });
      const data = await contextWidget.getData(ctx);

      expect(data?.percentage).toBe(15);
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

  describe('codexUsageWidget', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('should have correct id and name', () => {
      expect(codexUsageWidget.id).toBe('codexUsage');
      expect(codexUsageWidget.name).toBe('Codex Usage');
    });

    it('should return null when Codex is not installed', async () => {
      vi.spyOn(codexClient, 'isCodexInstalled').mockResolvedValue(false);

      const ctx = createContext();
      const data = await codexUsageWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should return error state when API call fails', async () => {
      vi.spyOn(codexClient, 'isCodexInstalled').mockResolvedValue(true);
      vi.spyOn(codexClient, 'fetchCodexUsage').mockResolvedValue(null);

      const ctx = createContext();
      const data = await codexUsageWidget.getData(ctx);

      // Should return error state instead of null
      expect(data).not.toBeNull();
      expect(data?.isError).toBe(true);
      expect(data?.model).toBe('codex');
      expect(data?.primaryPercent).toBeNull();
    });

    it('should return usage data when API call succeeds', async () => {
      vi.spyOn(codexClient, 'isCodexInstalled').mockResolvedValue(true);
      vi.spyOn(codexClient, 'fetchCodexUsage').mockResolvedValue({
        model: 'gpt-5.2-codex',
        planType: 'plus',
        primary: { usedPercent: 15, resetAt: 1769604227 },
        secondary: { usedPercent: 5, resetAt: 1770191027 },
      });

      const ctx = createContext();
      const data = await codexUsageWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.model).toBe('gpt-5.2-codex');
      expect(data?.planType).toBe('plus');
      expect(data?.primaryPercent).toBe(15);
      expect(data?.secondaryPercent).toBe(5);
    });

    it('should handle missing primary window', async () => {
      vi.spyOn(codexClient, 'isCodexInstalled').mockResolvedValue(true);
      vi.spyOn(codexClient, 'fetchCodexUsage').mockResolvedValue({
        model: 'o3',
        planType: 'pro',
        primary: null,
        secondary: { usedPercent: 10, resetAt: 1770191027 },
      });

      const ctx = createContext();
      const data = await codexUsageWidget.getData(ctx);

      expect(data?.primaryPercent).toBeNull();
      expect(data?.secondaryPercent).toBe(10);
    });

    it('should render model name and percentages', () => {
      const ctx = createContext();
      const data = {
        model: 'gpt-5.2-codex',
        planType: 'plus',
        primaryPercent: 25,
        primaryResetAt: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        secondaryPercent: 10,
        secondaryResetAt: Math.floor(Date.now() / 1000) + 86400, // 1 day from now
      };
      const result = codexUsageWidget.render(data, ctx);

      expect(result).toContain('🔷');
      expect(result).toContain('gpt-5.2-codex');
      expect(result).toContain('5h:');
      expect(result).toContain('25%');
      expect(result).toContain('7d:');
      expect(result).toContain('10%');
    });

    it('should render reset times', () => {
      const ctx = createContext();
      const data = {
        model: 'gpt-5.2-codex',
        planType: 'plus',
        primaryPercent: 50,
        primaryResetAt: Math.floor(Date.now() / 1000) + 7200, // 2 hours from now
        secondaryPercent: 20,
        secondaryResetAt: null,
      };
      const result = codexUsageWidget.render(data, ctx);

      expect(result).toContain('('); // Has reset time in parentheses
      expect(result).toMatch(/1h\d+m|2h/); // ~2 hours remaining (1h59m or 2h depending on timing)
    });

    it('should handle null percentages gracefully', () => {
      const ctx = createContext();
      const data = {
        model: 'o3',
        planType: 'pro',
        primaryPercent: null,
        primaryResetAt: null,
        secondaryPercent: null,
        secondaryResetAt: null,
      };
      const result = codexUsageWidget.render(data, ctx);

      expect(result).toContain('🔷');
      expect(result).toContain('o3');
      expect(result).not.toContain('5h:');
      expect(result).not.toContain('7d:');
    });

    it('should render error indicator when isError is true', () => {
      const ctx = createContext();
      const data = {
        model: 'codex',
        planType: '',
        primaryPercent: null,
        primaryResetAt: null,
        secondaryPercent: null,
        secondaryResetAt: null,
        isError: true,
      };
      const result = codexUsageWidget.render(data, ctx);

      expect(result).toContain('🔷');
      expect(result).toContain('codex');
      expect(result).toContain('⚠️');
      expect(result).not.toContain('5h:');
      expect(result).not.toContain('7d:');
    });
  });

  describe('geminiUsageWidget', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('should have correct id and name', () => {
      expect(geminiUsageWidget.id).toBe('geminiUsage');
      expect(geminiUsageWidget.name).toBe('Gemini Usage');
    });

    it('should return null when Gemini is not installed', async () => {
      vi.spyOn(geminiClient, 'isGeminiInstalled').mockResolvedValue(false);

      const ctx = createContext();
      const data = await geminiUsageWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should return error state when API call fails', async () => {
      vi.spyOn(geminiClient, 'isGeminiInstalled').mockResolvedValue(true);
      vi.spyOn(geminiClient, 'fetchGeminiUsage').mockResolvedValue(null);

      const ctx = createContext();
      const data = await geminiUsageWidget.getData(ctx);

      // Should return error state instead of null
      expect(data).not.toBeNull();
      expect(data?.isError).toBe(true);
      expect(data?.model).toBe('gemini');
      expect(data?.usedPercent).toBeNull();
    });

    it('should return usage data when API call succeeds', async () => {
      vi.spyOn(geminiClient, 'isGeminiInstalled').mockResolvedValue(true);
      vi.spyOn(geminiClient, 'fetchGeminiUsage').mockResolvedValue({
        model: 'gemini-2.5-pro',
        usedPercent: 25,
        resetAt: '2026-01-30T10:00:00Z',
        buckets: [
          { modelId: 'gemini-2.5-pro', usedPercent: 25, resetAt: '2026-01-30T10:00:00Z' },
        ],
      });

      const ctx = createContext();
      const data = await geminiUsageWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.model).toBe('gemini-2.5-pro');
      expect(data?.usedPercent).toBe(25);
      expect(data?.resetAt).toBe('2026-01-30T10:00:00Z');
    });

    it('should handle null usedPercent', async () => {
      vi.spyOn(geminiClient, 'isGeminiInstalled').mockResolvedValue(true);
      vi.spyOn(geminiClient, 'fetchGeminiUsage').mockResolvedValue({
        model: 'gemini-2.0-flash',
        usedPercent: null,
        resetAt: null,
        buckets: [],
      });

      const ctx = createContext();
      const data = await geminiUsageWidget.getData(ctx);

      expect(data?.model).toBe('gemini-2.0-flash');
      expect(data?.usedPercent).toBeNull();
      expect(data?.resetAt).toBeNull();
    });

    it('should render model name and percentage', () => {
      const ctx = createContext();
      const data = {
        model: 'gemini-2.5-pro',
        usedPercent: 35,
        resetAt: '2026-01-30T10:00:00Z',
      };
      const result = geminiUsageWidget.render(data, ctx);

      expect(result).toContain('💎');
      expect(result).toContain('gemini-2.5-pro');
      expect(result).toContain('35%');
    });

    it('should render reset time', () => {
      const ctx = createContext();
      // Set reset time to ~2 hours from now
      const resetAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      const data = {
        model: 'gemini-2.0-flash',
        usedPercent: 50,
        resetAt,
      };
      const result = geminiUsageWidget.render(data, ctx);

      expect(result).toContain('('); // Has reset time in parentheses
      expect(result).toMatch(/1h\d+m|2h/); // ~2 hours remaining
    });

    it('should handle null usedPercent in render', () => {
      const ctx = createContext();
      const data = {
        model: 'gemini-3-pro-preview',
        usedPercent: null,
        resetAt: null,
      };
      const result = geminiUsageWidget.render(data, ctx);

      expect(result).toContain('💎');
      expect(result).toContain('gemini-3-pro-preview');
      expect(result).not.toContain('%');
    });

    it('should render error indicator when isError is true', () => {
      const ctx = createContext();
      const data = {
        model: 'gemini',
        usedPercent: null,
        resetAt: null,
        isError: true,
      };
      const result = geminiUsageWidget.render(data, ctx);

      expect(result).toContain('💎');
      expect(result).toContain('gemini');
      expect(result).toContain('⚠️');
    });
  });

  describe('configCountsWidget', () => {
    it('should have correct id and name', () => {
      expect(configCountsWidget.id).toBe('configCounts');
      expect(configCountsWidget.name).toBe('Config Counts');
    });

    it('should return null when workspace is missing', async () => {
      const ctx = createContext({ workspace: undefined as any });
      const data = await configCountsWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should render claudeMd count', () => {
      const ctx = createContext();
      const data = { claudeMd: 2, rules: 0, mcps: 0, hooks: 0 };
      const result = configCountsWidget.render(data, ctx);

      expect(result).toContain('CLAUDE.md');
      expect(result).toContain('2');
    });

    it('should render rules count', () => {
      const ctx = createContext();
      const data = { claudeMd: 0, rules: 5, mcps: 0, hooks: 0 };
      const result = configCountsWidget.render(data, ctx);

      expect(result).toContain('Rules');
      expect(result).toContain('5');
    });

    it('should render mcps count', () => {
      const ctx = createContext();
      const data = { claudeMd: 0, rules: 0, mcps: 3, hooks: 0 };
      const result = configCountsWidget.render(data, ctx);

      expect(result).toContain('MCP');
      expect(result).toContain('3');
    });

    it('should render hooks count', () => {
      const ctx = createContext();
      const data = { claudeMd: 0, rules: 0, mcps: 0, hooks: 2 };
      const result = configCountsWidget.render(data, ctx);

      expect(result).toContain('Hooks');
      expect(result).toContain('2');
    });

    it('should render multiple counts', () => {
      const ctx = createContext();
      const data = { claudeMd: 1, rules: 3, mcps: 2, hooks: 1 };
      const result = configCountsWidget.render(data, ctx);

      expect(result).toContain('CLAUDE.md: 1');
      expect(result).toContain('Rules: 3');
      expect(result).toContain('MCP: 2');
      expect(result).toContain('Hooks: 1');
    });

    it('should only render non-zero counts', () => {
      const ctx = createContext();
      const data = { claudeMd: 1, rules: 0, mcps: 2, hooks: 0 };
      const result = configCountsWidget.render(data, ctx);

      expect(result).toContain('CLAUDE.md');
      expect(result).toContain('MCP');
      expect(result).not.toContain('Rules');
      expect(result).not.toContain('Hooks');
    });
  });

  describe('sessionDurationWidget', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('should have correct id and name', () => {
      expect(sessionDurationWidget.id).toBe('sessionDuration');
      expect(sessionDurationWidget.name).toBe('Session Duration');
    });

    it('should use total_duration_ms from stdin when available', async () => {
      const ctx = createContext({
        cost: { total_cost_usd: 0.5, total_duration_ms: 600000 },
      });
      const data = await sessionDurationWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.elapsedMs).toBe(600000); // 10 minutes from stdin
    });

    it('should fall back to file-based duration when total_duration_ms is missing', async () => {
      vi.spyOn(sessionUtils, 'getSessionElapsedMs').mockResolvedValue(120000);

      const ctx = createContext(); // MOCK_STDIN has no total_duration_ms
      const data = await sessionDurationWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.elapsedMs).toBe(120000);
    });

    it('should fall back to file-based duration when total_duration_ms is 0', async () => {
      vi.spyOn(sessionUtils, 'getSessionElapsedMs').mockResolvedValue(60000);

      const ctx = createContext({
        cost: { total_cost_usd: 0.5, total_duration_ms: 0 },
      });
      const data = await sessionDurationWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.elapsedMs).toBe(60000);
    });

    it('should return elapsed time data', async () => {
      vi.spyOn(sessionUtils, 'getSessionElapsedMs').mockResolvedValue(3600000); // 1 hour

      const ctx = createContext();
      const data = await sessionDurationWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.elapsedMs).toBe(3600000);
    });

    it('should use session_id from stdin if available', async () => {
      const mockGetSessionElapsedMs = vi.spyOn(sessionUtils, 'getSessionElapsedMs').mockResolvedValue(1000);

      const ctx = createContext();
      ctx.stdin.session_id = 'test-session-123';
      await sessionDurationWidget.getData(ctx);

      expect(mockGetSessionElapsedMs).toHaveBeenCalledWith('test-session-123');
    });

    it('should use default session_id when not provided', async () => {
      const mockGetSessionElapsedMs = vi.spyOn(sessionUtils, 'getSessionElapsedMs').mockResolvedValue(1000);

      const ctx = createContext();
      ctx.stdin.session_id = undefined;
      await sessionDurationWidget.getData(ctx);

      expect(mockGetSessionElapsedMs).toHaveBeenCalledWith('default');
    });

    it('should render duration with timer icon', () => {
      const ctx = createContext();
      const data = { elapsedMs: 3661000 }; // 1h 1m 1s
      const result = sessionDurationWidget.render(data, ctx);

      expect(result).toContain('⏱');
      expect(result).toContain('1h');
    });

    it('should format short durations', () => {
      const ctx = createContext();
      const data = { elapsedMs: 300000 }; // 5 minutes
      const result = sessionDurationWidget.render(data, ctx);

      expect(result).toContain('5m');
    });

    it('should format long durations', () => {
      const ctx = createContext();
      const data = { elapsedMs: 90000000 }; // 25 hours
      const result = sessionDurationWidget.render(data, ctx);

      expect(result).toContain('25h');
    });
  });

  describe('versionWidget', () => {
    it('should have correct id and name', () => {
      expect(versionWidget.id).toBe('version');
      expect(versionWidget.name).toBe('Version');
    });

    it('should use stdin version when available', async () => {
      const ctx = createContext({ version: '1.0.80' });
      const data = await versionWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.version).toBe('1.0.80');
    });

    it('should return null when stdin version is missing', async () => {
      const ctx = createContext(); // No version in MOCK_STDIN
      const data = await versionWidget.getData(ctx);

      expect(data).toBeNull();
    });

    it('should render version with v prefix', () => {
      const ctx = createContext();
      const data = { version: '1.0.80' };
      const result = versionWidget.render(data, ctx);

      expect(result).toContain('v1.0.80');
    });
  });

  describe('linesChangedWidget', () => {
    it('should have correct id and name', () => {
      expect(linesChangedWidget.id).toBe('linesChanged');
      expect(linesChangedWidget.name).toBe('Lines Changed');
    });

    it('should return data when added and removed are present', async () => {
      const ctx = createContext({
        cost: { total_cost_usd: 0.5, total_lines_added: 156, total_lines_removed: 23 },
      });
      const data = await linesChangedWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.added).toBe(156);
      expect(data?.removed).toBe(23);
    });

    it('should return null when both are 0', async () => {
      const ctx = createContext({
        cost: { total_cost_usd: 0.5, total_lines_added: 0, total_lines_removed: 0 },
      });
      const data = await linesChangedWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should return null when both are missing', async () => {
      const ctx = createContext({
        cost: { total_cost_usd: 0.5 },
      });
      const data = await linesChangedWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should return data when only added is present', async () => {
      const ctx = createContext({
        cost: { total_cost_usd: 0.5, total_lines_added: 42 },
      });
      const data = await linesChangedWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.added).toBe(42);
      expect(data?.removed).toBe(0);
    });

    it('should return data when only removed is present', async () => {
      const ctx = createContext({
        cost: { total_cost_usd: 0.5, total_lines_removed: 15 },
      });
      const data = await linesChangedWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.added).toBe(0);
      expect(data?.removed).toBe(15);
    });

    it('should render only removed part when added is 0', () => {
      const ctx = createContext();
      const data = { added: 0, removed: 15 };
      const result = linesChangedWidget.render(data, ctx);

      expect(result).toContain('-15');
      expect(result).not.toContain('+');
    });

    it('should render only added part when removed is 0', () => {
      const ctx = createContext();
      const data = { added: 100, removed: 0 };
      const result = linesChangedWidget.render(data, ctx);

      expect(result).toContain('+100');
      expect(result).not.toContain('-');
    });

    it('should render both added and removed', () => {
      const ctx = createContext();
      const data = { added: 156, removed: 23 };
      const result = linesChangedWidget.render(data, ctx);

      expect(result).toContain('+156');
      expect(result).toContain('-23');
    });
  });

  describe('outputStyleWidget', () => {
    it('should have correct id and name', () => {
      expect(outputStyleWidget.id).toBe('outputStyle');
      expect(outputStyleWidget.name).toBe('Output Style');
    });

    it('should return data when style is non-default', async () => {
      const ctx = createContext({ output_style: { name: 'concise' } });
      const data = await outputStyleWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.styleName).toBe('concise');
    });

    it('should return null when style is default', async () => {
      const ctx = createContext({ output_style: { name: 'default' } });
      const data = await outputStyleWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should return null when output_style is missing', async () => {
      const ctx = createContext();
      const data = await outputStyleWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should render style name', () => {
      const ctx = createContext();
      const data = { styleName: 'explanatory' };
      const result = outputStyleWidget.render(data, ctx);

      expect(result).toContain('explanatory');
    });
  });
});
