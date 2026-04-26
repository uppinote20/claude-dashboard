/**
 * @handbook 8.1-test-structure
 * @handbook 8.4-test-cache-reset
 * @covers scripts/widgets/model.ts
 * @covers scripts/widgets/context.ts
 * @covers scripts/widgets/cost.ts
 * @covers scripts/widgets/todo-progress.ts
 * @covers scripts/widgets/agent-status.ts
 * @covers scripts/widgets/tool-activity.ts
 * @covers scripts/widgets/project-info.ts
 * @covers scripts/widgets/burn-rate.ts
 * @covers scripts/widgets/cache-hit.ts
 * @covers scripts/widgets/depletion-time.ts
 * @covers scripts/widgets/codex-usage.ts
 * @covers scripts/widgets/gemini-usage.ts
 * @covers scripts/widgets/config-counts.ts
 * @covers scripts/widgets/session-duration.ts
 * @covers scripts/widgets/version.ts
 * @covers scripts/widgets/lines-changed.ts
 * @covers scripts/widgets/output-style.ts
 * @covers scripts/widgets/token-speed.ts
 * @covers scripts/widgets/session-name.ts
 * @covers scripts/widgets/today-cost.ts
 * @covers scripts/widgets/budget.ts
 * @covers scripts/widgets/forecast.ts
 * @covers scripts/widgets/performance.ts
 * @covers scripts/widgets/token-breakdown.ts
 * @covers scripts/widgets/zai-usage.ts
 * @covers scripts/widgets/last-prompt.ts
 * @covers scripts/widgets/vim-mode.ts
 * @covers scripts/widgets/api-duration.ts
 * @covers scripts/widgets/peak-hours.ts
 * @covers scripts/widgets/tag-status.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { modelWidget, getDefaultEffort } from '../widgets/model.js';
import {
  contextWidget,
  contextBarWidget,
  contextPercentageWidget,
  contextUsageWidget,
} from '../widgets/context.js';
import { costWidget } from '../widgets/cost.js';
import { todoProgressWidget } from '../widgets/todo-progress.js';
import { agentStatusWidget } from '../widgets/agent-status.js';
import { toolActivityWidget } from '../widgets/tool-activity.js';
import { projectInfoWidget, clearGitCacheForTest } from '../widgets/project-info.js';
import { burnRateWidget } from '../widgets/burn-rate.js';
import { cacheHitWidget } from '../widgets/cache-hit.js';
import { depletionTimeWidget } from '../widgets/depletion-time.js';
import { codexUsageWidget } from '../widgets/codex-usage.js';
import { geminiUsageWidget } from '../widgets/gemini-usage.js';
import { configCountsWidget } from '../widgets/config-counts.js';
import { sessionDurationWidget } from '../widgets/session-duration.js';
import { versionWidget } from '../widgets/version.js';
import { linesChangedWidget, clearDiffCacheForTest } from '../widgets/lines-changed.js';
import { outputStyleWidget } from '../widgets/output-style.js';
import { tokenSpeedWidget } from '../widgets/token-speed.js';
import { sessionNameWidget } from '../widgets/session-name.js';
import { todayCostWidget } from '../widgets/today-cost.js';
import { budgetWidget } from '../widgets/budget.js';
import { forecastWidget } from '../widgets/forecast.js';
import { performanceWidget } from '../widgets/performance.js';
import { tokenBreakdownWidget } from '../widgets/token-breakdown.js';
import { zaiUsageWidget } from '../widgets/zai-usage.js';
import { lastPromptWidget } from '../widgets/last-prompt.js';
import { vimModeWidget } from '../widgets/vim-mode.js';
import { apiDurationWidget } from '../widgets/api-duration.js';
import { peakHoursWidget, isPeakTime, getMinutesToTransition } from '../widgets/peak-hours.js';
import { tagStatusWidget, clearTagCacheForTest } from '../widgets/tag-status.js';
import * as codexClient from '../utils/codex-client.js';
import * as zaiClient from '../utils/zai-api-client.js';
import * as historyParser from '../utils/history-parser.js';
import * as gitUtils from '../utils/git.js';
import * as geminiClient from '../utils/gemini-client.js';
import * as sessionUtils from '../utils/session.js';
import * as budgetUtils from '../utils/budget.js';
import * as transcriptParser from '../utils/transcript-parser.js';
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
  beforeEach(() => {
    vi.restoreAllMocks();
    clearGitCacheForTest();
    clearDiffCacheForTest();
    clearTagCacheForTest();
  });

  describe('modelWidget', () => {
    it('should have correct id and name', () => {
      expect(modelWidget.id).toBe('model');
      expect(modelWidget.name).toBe('Model');
    });

    it('should return default values when model data is missing', async () => {
      const ctx = createContext({ model: undefined as any });
      const data = await modelWidget.getData(ctx);
      expect(data).toEqual({
        id: '',
        displayName: '-',
        effortLevel: expect.stringMatching(/^(xhigh|high|medium|low)$/),
        fastMode: expect.any(Boolean),
      });
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
      expect(result).toContain('◆');
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

    it('should show medium effort for Opus 4.6 when set', () => {
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

    it('should show xhigh effort as (X) for Opus', () => {
      const ctx = createContext();
      const result = modelWidget.render(
        createModelData({ id: 'claude-opus-4-7', displayName: 'Claude Opus 4.7', effortLevel: 'xhigh' }),
        ctx,
      );

      expect(result).toContain('Opus');
      expect(result).toContain('(X)');
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

  describe('getDefaultEffort', () => {
    it('should return xhigh for opus models', () => {
      expect(getDefaultEffort('claude-opus-4-7')).toBe('xhigh');
      expect(getDefaultEffort('claude-opus-4-6')).toBe('xhigh');
    });

    it('should return medium for sonnet models', () => {
      expect(getDefaultEffort('claude-sonnet-4-6')).toBe('medium');
      expect(getDefaultEffort('claude-sonnet-3.5')).toBe('medium');
    });

    it('should return high as safety net for unknown models', () => {
      expect(getDefaultEffort('unknown-model')).toBe('high');
      expect(getDefaultEffort('')).toBe('high');
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

  describe('context sub-widgets', () => {
    const sampleData = {
      inputTokens: 50000,
      outputTokens: 10000,
      totalTokens: 60000,
      contextSize: 200000,
      percentage: 25,
    };

    it('contextBarWidget has correct id and name', () => {
      expect(contextBarWidget.id).toBe('contextBar');
      expect(contextBarWidget.name).toBe('Context (Bar)');
    });

    it('contextBarWidget renders only the progress bar (no percent, no tokens)', () => {
      const ctx = createContext();
      const result = contextBarWidget.render(sampleData, ctx);
      expect(result).not.toContain('25%');
      expect(result).not.toContain('50K/200K');
      expect(result.length).toBeGreaterThan(0);
    });

    it('contextPercentageWidget has correct id and name', () => {
      expect(contextPercentageWidget.id).toBe('contextPercentage');
      expect(contextPercentageWidget.name).toBe('Context (Percentage)');
    });

    it('contextPercentageWidget renders only the percentage', () => {
      const ctx = createContext();
      const result = contextPercentageWidget.render(sampleData, ctx);
      expect(result).toContain('25%');
      expect(result).not.toContain('50K/200K');
    });

    it('contextUsageWidget has correct id and name', () => {
      expect(contextUsageWidget.id).toBe('contextUsage');
      expect(contextUsageWidget.name).toBe('Context (Usage)');
    });

    it('contextUsageWidget renders only the token count', () => {
      const ctx = createContext();
      const result = contextUsageWidget.render(sampleData, ctx);
      expect(result).toContain('50K/200K');
      expect(result).not.toContain('25%');
    });

    it('sub-widgets share the same getData reference as contextWidget', () => {
      expect(contextBarWidget.getData).toBe(contextWidget.getData);
      expect(contextPercentageWidget.getData).toBe(contextWidget.getData);
      expect(contextUsageWidget.getData).toBe(contextWidget.getData);
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

    it('should use project_dir for dirName when available', async () => {
      const ctx = createContext({
        workspace: { current_dir: '/project/src/components', project_dir: '/project' },
      });
      const data = await projectInfoWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.dirName).toBe('project');
      expect(data?.subPath).toBe('src/components');
    });

    it('should not set subPath when current_dir equals project_dir', async () => {
      const ctx = createContext({
        workspace: { current_dir: '/project', project_dir: '/project' },
      });
      const data = await projectInfoWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.subPath).toBeUndefined();
    });

    it('should not set subPath when project_dir is missing', async () => {
      const ctx = createContext();
      const data = await projectInfoWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.subPath).toBeUndefined();
    });

    it('should not set subPath when current_dir is a sibling with same prefix', async () => {
      const ctx = createContext({
        workspace: { current_dir: '/home/user/proj-backup/src', project_dir: '/home/user/proj' },
      });
      const data = await projectInfoWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.subPath).toBeUndefined();
    });

    it('should render subPath in parentheses', () => {
      const ctx = createContext();
      const data = { dirName: 'my-project', gitBranch: 'main', subPath: 'src/components' };
      const result = projectInfoWidget.render(data, ctx);

      expect(result).toContain('my-project (src/components)');
    });

    it('should extract worktree name from stdin', async () => {
      const ctx = createContext({
        worktree: { name: 'my-feature', path: '/tmp/wt', original_cwd: '/project' },
      } as any);
      const data = await projectInfoWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.worktreeName).toBe('my-feature');
    });

    it('should not set worktreeName when worktree is missing', async () => {
      const ctx = createContext();
      const data = await projectInfoWidget.getData(ctx);

      expect(data?.worktreeName).toBeUndefined();
    });

    it('should render worktree indicator', () => {
      const ctx = createContext();
      const data = { dirName: 'my-project', gitBranch: 'main', worktreeName: 'my-feature' };
      const result = projectInfoWidget.render(data, ctx);

      expect(result).toContain('🌳');
      expect(result).toContain('wt:my-feature');
    });

    it('should re-fetch after clearGitCacheForTest()', async () => {
      const spy = vi.spyOn(gitUtils, 'execGit').mockImplementation(async (args: string[]) => {
        if (args[0] === 'rev-parse') return 'main\n';
        if (args[0] === 'status') return '';
        if (args[0] === 'rev-list') return '0\t0\n';
        if (args[0] === 'remote') return '';
        return '';
      });
      const ctx = createContext();

      await projectInfoWidget.getData(ctx);
      const callsAfterFirst = spy.mock.calls.length;
      await projectInfoWidget.getData(ctx);
      expect(spy.mock.calls.length).toBe(callsAfterFirst); // cached

      clearGitCacheForTest();
      await projectInfoWidget.getData(ctx);
      expect(spy.mock.calls.length).toBeGreaterThan(callsAfterFirst); // re-fetched
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

      expect(result).toContain('…');
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

      expect(result).toContain('…');
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

    it('should render tool targets when present', () => {
      const ctx = createContext();
      const data = {
        running: [
          { name: 'Read', startTime: Date.now(), target: 'app.ts' },
          { name: 'Bash', startTime: Date.now(), target: 'npm test' },
        ],
        completed: 3,
      };
      const result = toolActivityWidget.render(data, ctx);

      expect(result).toContain('Read(app.ts)');
      expect(result).toContain('Bash(npm test)');
    });

    it('should render tool name only when target is absent', () => {
      const ctx = createContext();
      const data = {
        running: [
          { name: 'Agent', startTime: Date.now() },
        ],
        completed: 2,
      };
      const result = toolActivityWidget.render(data, ctx);

      expect(result).toContain('Agent');
      expect(result).not.toContain('Agent(');
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
      const data = { claudeMd: 2, agentsMd: 0, rules: 0, mcps: 0, hooks: 0, addedDirs: 0 };
      const result = configCountsWidget.render(data, ctx);

      expect(result).toContain('CLAUDE.md');
      expect(result).toContain('2');
    });

    it('should render rules count', () => {
      const ctx = createContext();
      const data = { claudeMd: 0, agentsMd: 0, rules: 5, mcps: 0, hooks: 0, addedDirs: 0 };
      const result = configCountsWidget.render(data, ctx);

      expect(result).toContain('Rules');
      expect(result).toContain('5');
    });

    it('should render mcps count', () => {
      const ctx = createContext();
      const data = { claudeMd: 0, agentsMd: 0, rules: 0, mcps: 3, hooks: 0, addedDirs: 0 };
      const result = configCountsWidget.render(data, ctx);

      expect(result).toContain('MCP');
      expect(result).toContain('3');
    });

    it('should render hooks count', () => {
      const ctx = createContext();
      const data = { claudeMd: 0, agentsMd: 0, rules: 0, mcps: 0, hooks: 2, addedDirs: 0 };
      const result = configCountsWidget.render(data, ctx);

      expect(result).toContain('Hooks');
      expect(result).toContain('2');
    });

    it('should render multiple counts', () => {
      const ctx = createContext();
      const data = { claudeMd: 1, agentsMd: 0, rules: 3, mcps: 2, hooks: 1, addedDirs: 0 };
      const result = configCountsWidget.render(data, ctx);

      expect(result).toContain('CLAUDE.md: 1');
      expect(result).toContain('Rules: 3');
      expect(result).toContain('MCP: 2');
      expect(result).toContain('Hooks: 1');
    });

    it('should only render non-zero counts', () => {
      const ctx = createContext();
      const data = { claudeMd: 1, agentsMd: 0, rules: 0, mcps: 2, hooks: 0, addedDirs: 0 };
      const result = configCountsWidget.render(data, ctx);

      expect(result).toContain('CLAUDE.md');
      expect(result).toContain('MCP');
      expect(result).not.toContain('Rules');
      expect(result).not.toContain('Hooks');
    });

    it('should render agentsMd count', () => {
      const ctx = createContext();
      const data = { claudeMd: 1, agentsMd: 2, rules: 0, mcps: 0, hooks: 0, addedDirs: 0 };
      const result = configCountsWidget.render(data, ctx);
      expect(result).toContain('AGENTS.md');
      expect(result).toContain('2');
    });

    it('should render addedDirs count', () => {
      const ctx = createContext();
      const data = { claudeMd: 1, agentsMd: 0, rules: 0, mcps: 0, hooks: 0, addedDirs: 3 };
      const result = configCountsWidget.render(data, ctx);
      expect(result).toContain('+Dirs');
      expect(result).toContain('3');
    });
  });

  describe('sessionDurationWidget', () => {
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

    it('should return data from git diff when changes exist', async () => {
      vi.spyOn(gitUtils, 'execGit').mockResolvedValue(' 3 files changed, 156 insertions(+), 23 deletions(-)\n');
      vi.spyOn(gitUtils, 'countUntrackedLines').mockResolvedValue(0);

      const data = await linesChangedWidget.getData(createContext());

      expect(data).not.toBeNull();
      expect(data?.added).toBe(156);
      expect(data?.removed).toBe(23);
      expect(data?.untracked).toBe(0);
    });

    it('should include untracked file lines in added count', async () => {
      vi.spyOn(gitUtils, 'execGit').mockResolvedValue(' 1 file changed, 10 insertions(+)\n');
      vi.spyOn(gitUtils, 'countUntrackedLines').mockResolvedValue(50);

      const data = await linesChangedWidget.getData(createContext());

      expect(data).not.toBeNull();
      expect(data?.added).toBe(60);
      expect(data?.removed).toBe(0);
      expect(data?.untracked).toBe(50);
    });

    it('should return data when only untracked files exist', async () => {
      vi.spyOn(gitUtils, 'execGit').mockResolvedValue('');
      vi.spyOn(gitUtils, 'countUntrackedLines').mockResolvedValue(30);

      const data = await linesChangedWidget.getData(createContext());

      expect(data).not.toBeNull();
      expect(data?.added).toBe(30);
      expect(data?.removed).toBe(0);
      expect(data?.untracked).toBe(30);
    });

    it('should return null when git diff is empty and no untracked', async () => {
      vi.spyOn(gitUtils, 'execGit').mockResolvedValue('');
      vi.spyOn(gitUtils, 'countUntrackedLines').mockResolvedValue(0);

      const data = await linesChangedWidget.getData(createContext());
      expect(data).toBeNull();
    });

    it('should return null when git diff fails', async () => {
      vi.spyOn(gitUtils, 'execGit').mockRejectedValue(new Error('not a git repo'));
      vi.spyOn(gitUtils, 'countUntrackedLines').mockResolvedValue(0);

      const data = await linesChangedWidget.getData(createContext());
      expect(data).toBeNull();
    });

    it('should return data with only insertions', async () => {
      vi.spyOn(gitUtils, 'execGit').mockResolvedValue(' 1 file changed, 42 insertions(+)\n');
      vi.spyOn(gitUtils, 'countUntrackedLines').mockResolvedValue(0);

      const data = await linesChangedWidget.getData(createContext());

      expect(data).not.toBeNull();
      expect(data?.added).toBe(42);
      expect(data?.removed).toBe(0);
    });

    it('should return data with only deletions', async () => {
      vi.spyOn(gitUtils, 'execGit').mockResolvedValue(' 1 file changed, 15 deletions(-)\n');
      vi.spyOn(gitUtils, 'countUntrackedLines').mockResolvedValue(0);

      const data = await linesChangedWidget.getData(createContext());

      expect(data).not.toBeNull();
      expect(data?.added).toBe(0);
      expect(data?.removed).toBe(15);
    });

    it('should render only removed part when added is 0', () => {
      const ctx = createContext();
      const data = { added: 0, removed: 15, untracked: 0 };
      const result = linesChangedWidget.render(data, ctx);

      expect(result).toContain('-15');
      expect(result).not.toContain('+');
    });

    it('should render only added part when removed is 0', () => {
      const ctx = createContext();
      const data = { added: 100, removed: 0, untracked: 30 };
      const result = linesChangedWidget.render(data, ctx);

      expect(result).toContain('+100');
      expect(result).not.toContain('-');
    });

    it('should render both added and removed', () => {
      const ctx = createContext();
      const data = { added: 156, removed: 23, untracked: 0 };
      const result = linesChangedWidget.render(data, ctx);

      expect(result).toContain('+156');
      expect(result).toContain('-23');
    });

    it('should re-fetch after clearDiffCacheForTest()', async () => {
      const spy = vi
        .spyOn(gitUtils, 'execGit')
        .mockResolvedValue(' 1 file changed, 7 insertions(+)\n');
      vi.spyOn(gitUtils, 'countUntrackedLines').mockResolvedValue(0);
      const ctx = createContext();

      await linesChangedWidget.getData(ctx);
      const callsAfterFirst = spy.mock.calls.length;
      await linesChangedWidget.getData(ctx);
      expect(spy.mock.calls.length).toBe(callsAfterFirst); // cached

      clearDiffCacheForTest();
      await linesChangedWidget.getData(ctx);
      expect(spy.mock.calls.length).toBeGreaterThan(callsAfterFirst); // re-fetched
    });
  });

  describe('tagStatusWidget', () => {
    function tagCtx(config: Partial<WidgetContext['config']> = {}): WidgetContext {
      return {
        ...createContext(),
        config: { ...MOCK_CONFIG, ...config },
      };
    }

    it('should have correct id and name', () => {
      expect(tagStatusWidget.id).toBe('tagStatus');
      expect(tagStatusWidget.name).toBe('Tag Status');
    });

    it('should resolve default v* pattern when tagPatterns unset', async () => {
      vi.spyOn(gitUtils, 'execGit').mockImplementation(async (args: string[]) => {
        if (args[0] === 'describe') return 'v1.25.1\n';
        if (args[0] === 'rev-list') return '0\n';
        return '';
      });

      const data = await tagStatusWidget.getData(tagCtx());

      expect(data).not.toBeNull();
      expect(data?.tags).toEqual([{ name: 'v1.25.1', count: 0 }]);
    });

    it('should resolve multiple patterns and preserve order', async () => {
      vi.spyOn(gitUtils, 'execGit').mockImplementation(async (args: string[]) => {
        const matchIdx = args.indexOf('--match');
        const pattern = matchIdx >= 0 ? args[matchIdx + 1] : null;
        if (args[0] === 'describe') {
          if (pattern === 'v*') return 'v1.25.1\n';
          if (pattern === 'sync-*') return 'sync-handbook\n';
          return '';
        }
        if (args[0] === 'rev-list') {
          const spec = args[2];
          if (spec?.startsWith('v1.25.1')) return '0\n';
          if (spec?.startsWith('sync-handbook')) return '12\n';
        }
        return '';
      });

      const data = await tagStatusWidget.getData(
        tagCtx({ tagPatterns: ['v*', 'sync-*'] }),
      );

      expect(data?.tags).toEqual([
        { name: 'v1.25.1', count: 0 },
        { name: 'sync-handbook', count: 12 },
      ]);
    });

    it('should skip patterns that do not match any tag', async () => {
      vi.spyOn(gitUtils, 'execGit').mockImplementation(async (args: string[]) => {
        const matchIdx = args.indexOf('--match');
        const pattern = matchIdx >= 0 ? args[matchIdx + 1] : null;
        if (args[0] === 'describe') {
          if (pattern === 'v*') return 'v1.25.1\n';
          throw new Error('no matching tags');
        }
        if (args[0] === 'rev-list') return '3\n';
        return '';
      });

      const data = await tagStatusWidget.getData(
        tagCtx({ tagPatterns: ['v*', 'nonexistent-*'] }),
      );

      expect(data?.tags).toEqual([{ name: 'v1.25.1', count: 3 }]);
    });

    it('should return null when all patterns fail to match', async () => {
      vi.spyOn(gitUtils, 'execGit').mockRejectedValue(new Error('no matching tags'));

      const data = await tagStatusWidget.getData(
        tagCtx({ tagPatterns: ['nope-*'] }),
      );

      expect(data).toBeNull();
    });

    it('should return null when tagPatterns is explicitly empty', async () => {
      const spy = vi.spyOn(gitUtils, 'execGit');

      const data = await tagStatusWidget.getData(
        tagCtx({ tagPatterns: [] }),
      );

      expect(data).toBeNull();
      expect(spy).not.toHaveBeenCalled();
    });

    it('should return null when cwd is missing', async () => {
      const data = await tagStatusWidget.getData(
        createContext({ workspace: { current_dir: '' } }),
      );
      expect(data).toBeNull();
    });

    it('should omit +N when count is 0', () => {
      const ctx = createContext();
      const result = tagStatusWidget.render({ tags: [{ name: 'v1.25.1', count: 0 }] }, ctx);

      expect(result).toContain('v1.25.1');
      expect(result).not.toContain('+0');
    });

    it('should render +N when count is positive', () => {
      const ctx = createContext();
      const result = tagStatusWidget.render(
        { tags: [{ name: 'sync-handbook', count: 12 }] },
        ctx,
      );

      expect(result).toContain('sync-handbook');
      expect(result).toContain('+12');
    });

    it('should render multiple tags separated by space', () => {
      const ctx = createContext();
      const result = tagStatusWidget.render(
        { tags: [{ name: 'v1.25.1', count: 0 }, { name: 'sync-handbook', count: 3 }] },
        ctx,
      );

      expect(result).toContain('v1.25.1');
      expect(result).toContain('sync-handbook');
      expect(result).toContain('+3');
    });

    it('should reuse cached result on repeated calls with same ctx', async () => {
      const spy = vi.spyOn(gitUtils, 'execGit').mockImplementation(async (args: string[]) => {
        if (args[0] === 'describe') return 'v1.25.1\n';
        if (args[0] === 'rev-list') return '0\n';
        return '';
      });

      const ctx = tagCtx();
      const first = await tagStatusWidget.getData(ctx);
      const callsAfterFirst = spy.mock.calls.length;
      const second = await tagStatusWidget.getData(ctx);

      expect(first).toEqual(second);
      expect(spy.mock.calls.length).toBe(callsAfterFirst);
    });

    it('should re-fetch after clearTagCacheForTest()', async () => {
      const spy = vi.spyOn(gitUtils, 'execGit').mockImplementation(async (args: string[]) => {
        if (args[0] === 'describe') return 'v1.25.1\n';
        if (args[0] === 'rev-list') return '0\n';
        return '';
      });
      const ctx = tagCtx();

      await tagStatusWidget.getData(ctx);
      const callsAfterFirst = spy.mock.calls.length;
      await tagStatusWidget.getData(ctx);
      expect(spy.mock.calls.length).toBe(callsAfterFirst); // cached

      clearTagCacheForTest();
      await tagStatusWidget.getData(ctx);
      expect(spy.mock.calls.length).toBeGreaterThan(callsAfterFirst); // re-fetched
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

  describe('tokenSpeedWidget', () => {
    it('should have correct id and name', () => {
      expect(tokenSpeedWidget.id).toBe('tokenSpeed');
      expect(tokenSpeedWidget.name).toBe('Token Speed');
    });

    it('should return data when output tokens and api duration are present', async () => {
      const ctx = createContext({
        context_window: {
          total_input_tokens: 5000,
          total_output_tokens: 3000,
          context_window_size: 200000,
          current_usage: null,
        },
        cost: { total_cost_usd: 0.5, total_api_duration_ms: 10000 },
      });
      const data = await tokenSpeedWidget.getData(ctx);

      expect(data).not.toBeNull();
      // 3000 / (10000 / 1000) = 300
      expect(data?.tokensPerSecond).toBe(300);
    });

    it('should return null when total_api_duration_ms is missing', async () => {
      const ctx = createContext({
        cost: { total_cost_usd: 0.5 },
      });
      const data = await tokenSpeedWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should return null when total_api_duration_ms is 0', async () => {
      const ctx = createContext({
        cost: { total_cost_usd: 0.5, total_api_duration_ms: 0 },
      });
      const data = await tokenSpeedWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should return null when total_output_tokens is missing or 0', async () => {
      const ctx = createContext({
        context_window: {
          total_input_tokens: 5000,
          total_output_tokens: 0,
          context_window_size: 200000,
          current_usage: null,
        },
        cost: { total_cost_usd: 0.5, total_api_duration_ms: 5000 },
      });
      const data = await tokenSpeedWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should render token speed with lightning icon', () => {
      const ctx = createContext();
      const data = { tokensPerSecond: 150 };
      const result = tokenSpeedWidget.render(data, ctx);

      expect(result).toContain('⚡');
      expect(result).toContain('150 tok/s');
    });

    it('should round tokensPerSecond in render', () => {
      const ctx = createContext();
      const data = { tokensPerSecond: 123.7 };
      const result = tokenSpeedWidget.render(data, ctx);

      expect(result).toContain('124 tok/s');
    });
  });

  describe('sessionNameWidget', () => {
    it('should have correct id and name', () => {
      expect(sessionNameWidget.id).toBe('sessionName');
      expect(sessionNameWidget.name).toBe('Session Name');
    });

    it('should return null when transcript_path is missing', async () => {
      const ctx = createContext();
      const data = await sessionNameWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should return null when transcript has no sessionName', async () => {
      vi.spyOn(transcriptParser, 'getTranscript').mockResolvedValue({
        toolUses: new Map(),
        completedToolCount: 0,
        runningToolIds: new Set(),
        lastTodoWriteInput: null,
        activeAgentIds: new Set(),
        completedAgentCount: 0,
        tasks: new Map(),
        nextTaskId: 1,
        pendingTaskCreates: new Map(),
        pendingTaskUpdates: new Map(),
      });

      const ctx = createContext({ transcript_path: '/tmp/transcript.jsonl' });
      const data = await sessionNameWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should prefer stdin session_name over transcript', async () => {
      const ctx = createContext({ session_name: 'stdin-session', transcript_path: '/tmp/transcript.jsonl' });
      const data = await sessionNameWidget.getData(ctx);
      expect(data).not.toBeNull();
      expect(data?.name).toBe('stdin-session');
    });

    it('should return session name from transcript', async () => {
      vi.spyOn(transcriptParser, 'getTranscript').mockResolvedValue({
        toolUses: new Map(),
        completedToolCount: 0,
        runningToolIds: new Set(),
        lastTodoWriteInput: null,
        activeAgentIds: new Set(),
        completedAgentCount: 0,
        tasks: new Map(),
        nextTaskId: 1,
        pendingTaskCreates: new Map(),
        pendingTaskUpdates: new Map(),
        sessionName: 'my-feature-work',
      });

      const ctx = createContext({ transcript_path: '/tmp/transcript.jsonl' });
      const data = await sessionNameWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.name).toBe('my-feature-work');
    });

    it('should render session name with arrow prefix', () => {
      const ctx = createContext();
      const data = { name: 'bug-fix-session' };
      const result = sessionNameWidget.render(data, ctx);

      expect(result).toContain('»');
      expect(result).toContain('bug-fix-session');
    });

    it('should truncate long session names to 20 chars', () => {
      const ctx = createContext();
      const data = { name: 'this-is-a-very-long-session-name-that-exceeds-limit' };
      const result = sessionNameWidget.render(data, ctx);

      expect(result).toContain('»');
      expect(result).toContain('…');
    });
  });

  describe('todayCostWidget', () => {
    it('should have correct id and name', () => {
      expect(todayCostWidget.id).toBe('todayCost');
      expect(todayCostWidget.name).toBe('Today Cost');
    });

    it('should return data when dailyTotal is positive', async () => {
      vi.spyOn(budgetUtils, 'recordCostAndGetDaily').mockResolvedValue(2.5);

      const ctx = createContext();
      const data = await todayCostWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.dailyTotal).toBe(2.5);
    });

    it('should return null when dailyTotal is 0', async () => {
      vi.spyOn(budgetUtils, 'recordCostAndGetDaily').mockResolvedValue(0);

      const ctx = createContext();
      const data = await todayCostWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should return null when dailyTotal is negative', async () => {
      vi.spyOn(budgetUtils, 'recordCostAndGetDaily').mockResolvedValue(-1);

      const ctx = createContext();
      const data = await todayCostWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should pass session_id and cost to recordCostAndGetDaily', async () => {
      const mockRecord = vi.spyOn(budgetUtils, 'recordCostAndGetDaily').mockResolvedValue(1.0);

      const ctx = createContext({
        session_id: 'test-session-456',
        cost: { total_cost_usd: 0.75 },
      });
      await todayCostWidget.getData(ctx);

      expect(mockRecord).toHaveBeenCalledWith('test-session-456', 0.75);
    });

    it('should use default session_id when not provided', async () => {
      const mockRecord = vi.spyOn(budgetUtils, 'recordCostAndGetDaily').mockResolvedValue(1.0);

      const ctx = createContext();
      ctx.stdin.session_id = undefined;
      await todayCostWidget.getData(ctx);

      expect(mockRecord).toHaveBeenCalledWith('default', 0.75);
    });

    it('should render daily total with Today label', () => {
      const ctx = createContext();
      const data = { dailyTotal: 3.5 };
      const result = todayCostWidget.render(data, ctx);

      expect(result).toContain('💰');
      expect(result).toContain('Today');
      expect(result).toContain('$3.50');
    });

    it('should format small daily totals correctly', () => {
      const ctx = createContext();
      const data = { dailyTotal: 0.05 };
      const result = todayCostWidget.render(data, ctx);

      expect(result).toContain('$0.05');
    });
  });

  describe('budgetWidget', () => {
    it('should have correct id and name', () => {
      expect(budgetWidget.id).toBe('budget');
      expect(budgetWidget.name).toBe('Budget');
    });

    it('should return null when dailyBudget is not configured', async () => {
      const ctx = createContext();
      const data = await budgetWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should return budget data when configured', async () => {
      vi.spyOn(budgetUtils, 'recordCostAndGetDaily').mockResolvedValue(5.0);

      const ctx = { ...createContext(), config: { ...MOCK_CONFIG, dailyBudget: 20 } };
      const data = await budgetWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.dailyTotal).toBe(5.0);
      expect(data?.dailyBudget).toBe(20);
      expect(data?.utilization).toBe(0.25);
    });

    it('should cap utilization at 1', async () => {
      vi.spyOn(budgetUtils, 'recordCostAndGetDaily').mockResolvedValue(30.0);

      const ctx = { ...createContext(), config: { ...MOCK_CONFIG, dailyBudget: 20 } };
      const data = await budgetWidget.getData(ctx);

      expect(data?.utilization).toBe(1);
    });

    it('should render safe icon for low utilization', () => {
      const ctx = createContext();
      const data = { dailyTotal: 5, dailyBudget: 20, utilization: 0.25 };
      const result = budgetWidget.render(data, ctx);
      expect(result).toContain('💵');
      expect(result).toContain('$5.00');
      expect(result).toContain('$20.00');
    });

    it('should render warning icon for high utilization', () => {
      const ctx = createContext();
      const data = { dailyTotal: 17, dailyBudget: 20, utilization: 0.85 };
      const result = budgetWidget.render(data, ctx);
      expect(result).toContain('⚠️');
    });

    it('should render danger icon for critical utilization', () => {
      const ctx = createContext();
      const data = { dailyTotal: 19.5, dailyBudget: 20, utilization: 0.975 };
      const result = budgetWidget.render(data, ctx);
      expect(result).toContain('🚨');
    });
  });

  describe('forecastWidget', () => {
    it('should have correct id and name', () => {
      expect(forecastWidget.id).toBe('forecast');
      expect(forecastWidget.name).toBe('Cost Forecast');
    });

    it('should return null when cost is 0', async () => {
      const ctx = createContext({ cost: { total_cost_usd: 0 } });
      const data = await forecastWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should return forecast data when cost and session time available', async () => {
      vi.spyOn(sessionUtils, 'getSessionElapsedMinutes').mockResolvedValue(30);

      const ctx = createContext({ cost: { total_cost_usd: 1.5 } });
      const data = await forecastWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.currentCost).toBe(1.5);
      expect(data?.hourlyCost).toBe(3.0);
    });

    it('should render with arrow and hourly rate', () => {
      const ctx = createContext();
      const data = { currentCost: 1.5, hourlyCost: 3.0 };
      const result = forecastWidget.render(data, ctx);
      expect(result).toContain('📈');
      expect(result).toContain('$1.50');
      expect(result).toContain('~$3.00/h');
    });
  });

  describe('performanceWidget', () => {
    it('should have correct id and name', () => {
      expect(performanceWidget.id).toBe('performance');
      expect(performanceWidget.name).toBe('Performance');
    });

    it('should return null when no usage data', async () => {
      const ctx = createContext({
        context_window: { ...MOCK_STDIN.context_window, current_usage: null },
      });
      const data = await performanceWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should calculate composite score', async () => {
      vi.spyOn(sessionUtils, 'getSessionElapsedMinutes').mockResolvedValue(10);

      const ctx = createContext();
      const data = await performanceWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.score).toBeGreaterThanOrEqual(0);
      expect(data?.score).toBeLessThanOrEqual(100);
      expect(data?.cacheHitRate).toBeDefined();
      expect(data?.outputRatio).toBeDefined();
    });

    it('should render green badge for high score', () => {
      const ctx = createContext();
      const data = { score: 80, cacheHitRate: 70, outputRatio: 30 };
      const result = performanceWidget.render(data, ctx);
      expect(result).toContain('🟢');
      expect(result).toContain('80%');
    });

    it('should render yellow badge for medium score', () => {
      const ctx = createContext();
      const data = { score: 50, cacheHitRate: 40, outputRatio: 20 };
      const result = performanceWidget.render(data, ctx);
      expect(result).toContain('🟡');
    });

    it('should render red badge for low score', () => {
      const ctx = createContext();
      const data = { score: 20, cacheHitRate: 10, outputRatio: 10 };
      const result = performanceWidget.render(data, ctx);
      expect(result).toContain('🔴');
    });
  });

  describe('tokenBreakdownWidget', () => {
    it('should have correct id and name', () => {
      expect(tokenBreakdownWidget.id).toBe('tokenBreakdown');
      expect(tokenBreakdownWidget.name).toBe('Token Breakdown');
    });

    it('should return null when no usage data', async () => {
      const ctx = createContext({
        context_window: { ...MOCK_STDIN.context_window, current_usage: null },
      });
      const data = await tokenBreakdownWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should return null when all tokens are 0', async () => {
      const ctx = createContext({
        context_window: {
          ...MOCK_STDIN.context_window,
          current_usage: {
            input_tokens: 0, output_tokens: 0,
            cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
          },
        },
      });
      const data = await tokenBreakdownWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should return token breakdown data', async () => {
      const ctx = createContext();
      const data = await tokenBreakdownWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.inputTokens).toBe(5000);
      expect(data?.outputTokens).toBe(2000);
      expect(data?.cacheWriteTokens).toBe(1000);
      expect(data?.cacheReadTokens).toBe(500);
    });

    it('should render with chart icon and labels', () => {
      const ctx = createContext();
      const data = { inputTokens: 5000, outputTokens: 2000, cacheWriteTokens: 1000, cacheReadTokens: 500 };
      const result = tokenBreakdownWidget.render(data, ctx);
      expect(result).toContain('📊');
      expect(result).toContain('In');
      expect(result).toContain('Out');
    });

    it('should omit zero-value parts', () => {
      const ctx = createContext();
      const data = { inputTokens: 5000, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 };
      const result = tokenBreakdownWidget.render(data, ctx);
      expect(result).toContain('In');
      expect(result).not.toContain('Out');
    });
  });

  describe('zaiUsageWidget', () => {
    it('should have correct id and name', () => {
      expect(zaiUsageWidget.id).toBe('zaiUsage');
      expect(zaiUsageWidget.name).toBe('Z.ai Usage');
    });

    it('should return null when not installed', async () => {
      vi.spyOn(zaiClient, 'isZaiInstalled').mockReturnValue(false);

      const ctx = createContext();
      const data = await zaiUsageWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should return error state when API fails', async () => {
      vi.spyOn(zaiClient, 'isZaiInstalled').mockReturnValue(true);
      vi.spyOn(zaiClient, 'fetchZaiUsage').mockResolvedValue(null);

      const ctx = createContext();
      const data = await zaiUsageWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.isError).toBe(true);
    });

    it('should return usage data when available', async () => {
      vi.spyOn(zaiClient, 'isZaiInstalled').mockReturnValue(true);
      vi.spyOn(zaiClient, 'fetchZaiUsage').mockResolvedValue({
        model: 'GLM',
        tokensPercent: 45,
        tokensResetAt: Date.now() + 3600000,
        mcpPercent: 20,
        mcpResetAt: Date.now() + 86400000,
      });

      const ctx = createContext();
      const data = await zaiUsageWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.tokensPercent).toBe(45);
      expect(data?.mcpPercent).toBe(20);
    });

    it('should render with warning on error', () => {
      const ctx = createContext();
      const data = {
        model: 'GLM', tokensPercent: null, tokensResetAt: null,
        mcpPercent: null, mcpResetAt: null, isError: true,
      };
      const result = zaiUsageWidget.render(data, ctx);
      expect(result).toContain('🟠');
      expect(result).toContain('⚠️');
    });

    it('should render usage percentages', () => {
      const ctx = createContext();
      const data = {
        model: 'GLM', tokensPercent: 45, tokensResetAt: null,
        mcpPercent: 20, mcpResetAt: null,
      };
      const result = zaiUsageWidget.render(data, ctx);
      expect(result).toContain('🟠');
      expect(result).toContain('45%');
      expect(result).toContain('20%');
    });
  });

  describe('lastPromptWidget', () => {
    it('should have correct id and name', () => {
      expect(lastPromptWidget.id).toBe('lastPrompt');
      expect(lastPromptWidget.name).toBe('Last Prompt');
    });

    it('should return null when no session_id', async () => {
      const ctx = createContext({ session_id: undefined });
      const data = await lastPromptWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should return prompt data from history', async () => {
      vi.spyOn(historyParser, 'getLastUserPrompt').mockResolvedValue({
        text: 'Fix the login bug',
        timestamp: '2024-01-01T12:30:00Z',
      });

      const ctx = createContext();
      const data = await lastPromptWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.text).toBe('Fix the login bug');
    });

    it('should render with time and text', () => {
      const ctx = createContext();
      const data = { text: 'Fix the login bug', timestamp: '2024-01-01T12:30:00Z' };
      const result = lastPromptWidget.render(data, ctx);
      expect(result).toContain('💬');
      expect(result).toContain('Fix the login bug');
    });

    it('should truncate long prompts to 60 chars', () => {
      const ctx = createContext();
      const longText = 'A'.repeat(80);
      const data = { text: longText, timestamp: '2024-01-01T12:30:00Z' };
      const result = lastPromptWidget.render(data, ctx);
      expect(result).toContain('…');
    });
  });

  describe('vimModeWidget', () => {
    it('should have correct id and name', () => {
      expect(vimModeWidget.id).toBe('vimMode');
      expect(vimModeWidget.name).toBe('Vim Mode');
    });

    it('should return null when vim is not enabled', async () => {
      const ctx = createContext();
      const data = await vimModeWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should return mode when vim is enabled', async () => {
      const ctx = createContext({ vim: { mode: 'NORMAL' } });
      const data = await vimModeWidget.getData(ctx);
      expect(data).not.toBeNull();
      expect(data?.mode).toBe('NORMAL');
    });

    it('should return INSERT mode', async () => {
      const ctx = createContext({ vim: { mode: 'INSERT' } });
      const data = await vimModeWidget.getData(ctx);
      expect(data?.mode).toBe('INSERT');
    });

    it('should render NORMAL with dim color', () => {
      const ctx = createContext();
      const result = vimModeWidget.render({ mode: 'NORMAL' }, ctx);
      expect(result).toContain('NORMAL');
    });

    it('should render INSERT with safe color', () => {
      const ctx = createContext();
      const result = vimModeWidget.render({ mode: 'INSERT' }, ctx);
      expect(result).toContain('INSERT');
    });
  });

  describe('peakHoursWidget', () => {
    it('should have correct id and name', () => {
      expect(peakHoursWidget.id).toBe('peakHours');
      expect(peakHoursWidget.name).toBe('Peak Hours');
    });

    it('should always return data', async () => {
      const ctx = createContext();
      const data = await peakHoursWidget.getData(ctx);
      expect(data).not.toBeNull();
      expect(typeof data?.isPeak).toBe('boolean');
      expect(typeof data?.minutesToTransition).toBe('number');
    });

    // isPeakTime unit tests (exported pure function)
    it('isPeakTime returns true for weekday peak hours', () => {
      expect(isPeakTime({ hour: 5, minute: 0, dayOfWeek: 1 })).toBe(true);   // Mon 5:00 AM
      expect(isPeakTime({ hour: 8, minute: 30, dayOfWeek: 3 })).toBe(true);  // Wed 8:30 AM
      expect(isPeakTime({ hour: 10, minute: 59, dayOfWeek: 5 })).toBe(true); // Fri 10:59 AM
    });

    it('isPeakTime returns false at off-peak boundary', () => {
      expect(isPeakTime({ hour: 11, minute: 0, dayOfWeek: 3 })).toBe(false);  // Wed 11:00 AM
      expect(isPeakTime({ hour: 4, minute: 59, dayOfWeek: 2 })).toBe(false);  // Tue 4:59 AM
      expect(isPeakTime({ hour: 14, minute: 0, dayOfWeek: 4 })).toBe(false);  // Thu 2:00 PM
    });

    it('isPeakTime returns false on weekends even during peak hours', () => {
      expect(isPeakTime({ hour: 8, minute: 0, dayOfWeek: 0 })).toBe(false);  // Sun 8:00 AM
      expect(isPeakTime({ hour: 8, minute: 0, dayOfWeek: 6 })).toBe(false);  // Sat 8:00 AM
    });

    it('should render Peak label during peak', () => {
      const ctx = createContext();
      const result = peakHoursWidget.render({ isPeak: true, minutesToTransition: 150 }, ctx);
      expect(result).toContain('Peak');
      expect(result).toContain('(2h30m)');
    });

    it('should render Off-Peak label during off-peak', () => {
      const ctx = createContext();
      const result = peakHoursWidget.render({ isPeak: false, minutesToTransition: 90 }, ctx);
      expect(result).toContain('Off-Peak');
      expect(result).toContain('(1h30m)');
    });

    it('should render large countdown for weekend', () => {
      const ctx = createContext();
      const result = peakHoursWidget.render({ isPeak: false, minutesToTransition: 3900 }, ctx);
      expect(result).toContain('Off-Peak');
      expect(result).toContain('2d17h');
    });

    // getMinutesToTransition unit tests (exported pure function)
    it('getMinutesToTransition returns remaining peak minutes during peak', () => {
      // Wed 8:30 AM → 11:00 AM = 150 minutes
      expect(getMinutesToTransition({ hour: 8, minute: 30, dayOfWeek: 3 })).toBe(150);
      // Mon 5:00 AM → 11:00 AM = 360 minutes
      expect(getMinutesToTransition({ hour: 5, minute: 0, dayOfWeek: 1 })).toBe(360);
      // Fri 10:59 AM → 11:00 AM = 1 minute
      expect(getMinutesToTransition({ hour: 10, minute: 59, dayOfWeek: 5 })).toBe(1);
    });

    it('getMinutesToTransition returns minutes to peak for weekday before peak', () => {
      // Tue 4:59 AM → 5:00 AM = 1 minute
      expect(getMinutesToTransition({ hour: 4, minute: 59, dayOfWeek: 2 })).toBe(1);
      // Mon 0:00 AM → 5:00 AM = 300 minutes
      expect(getMinutesToTransition({ hour: 0, minute: 0, dayOfWeek: 1 })).toBe(300);
    });

    it('getMinutesToTransition returns minutes to next Monday for weekend', () => {
      // Sat 12:00 PM → Mon 5:00 AM = 41h = 2460 min
      expect(getMinutesToTransition({ hour: 12, minute: 0, dayOfWeek: 6 })).toBe(2460);
      // Sun 12:00 PM → Mon 5:00 AM = 17h = 1020 min
      expect(getMinutesToTransition({ hour: 12, minute: 0, dayOfWeek: 0 })).toBe(1020);
    });

    it('getMinutesToTransition returns minutes to next day for weekday after peak', () => {
      // Wed 3:00 PM → Thu 5:00 AM = 14h = 840 min
      expect(getMinutesToTransition({ hour: 15, minute: 0, dayOfWeek: 3 })).toBe(840);
      // Wed 11:00 AM → Thu 5:00 AM = 18h = 1080 min
      expect(getMinutesToTransition({ hour: 11, minute: 0, dayOfWeek: 3 })).toBe(1080);
    });

    it('getMinutesToTransition handles Friday after peak to Monday', () => {
      // Fri 11:00 AM → Mon 5:00 AM = 66h = 3960 min
      expect(getMinutesToTransition({ hour: 11, minute: 0, dayOfWeek: 5 })).toBe(3960);
      // Fri 3:00 PM → Mon 5:00 AM = 62h = 3720 min
      expect(getMinutesToTransition({ hour: 15, minute: 0, dayOfWeek: 5 })).toBe(3720);
    });
  });

  describe('apiDurationWidget', () => {
    it('should have correct id and name', () => {
      expect(apiDurationWidget.id).toBe('apiDuration');
      expect(apiDurationWidget.name).toBe('API Duration');
    });

    it('should return null when duration data is missing', async () => {
      const ctx = createContext({ cost: { total_cost_usd: 0.5 } });
      const data = await apiDurationWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should return null when total_duration_ms is 0', async () => {
      const ctx = createContext({
        cost: { total_cost_usd: 0.5, total_duration_ms: 0, total_api_duration_ms: 100 },
      });
      const data = await apiDurationWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should calculate percentage correctly', async () => {
      const ctx = createContext({
        cost: { total_cost_usd: 0.5, total_duration_ms: 10000, total_api_duration_ms: 4500 },
      });
      const data = await apiDurationWidget.getData(ctx);
      expect(data).not.toBeNull();
      expect(data?.percentage).toBe(45);
    });

    it('should cap percentage at 100', async () => {
      const ctx = createContext({
        cost: { total_cost_usd: 0.5, total_duration_ms: 1000, total_api_duration_ms: 1500 },
      });
      const data = await apiDurationWidget.getData(ctx);
      expect(data?.percentage).toBe(100);
    });

    it('should render with API prefix', () => {
      const ctx = createContext();
      const result = apiDurationWidget.render({ percentage: 45 }, ctx);
      expect(result).toContain('API');
      expect(result).toContain('45%');
    });
  });
});
