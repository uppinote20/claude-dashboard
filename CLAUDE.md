# Claude Code Configuration

## Project Overview

**claude-dashboard** is a Claude Code plugin that provides a comprehensive status line with modular widget system, multi-line display, context usage, API rate limits, and cost tracking.

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.0+
- **Build**: esbuild
- **Target**: Claude Code Plugin

## Project Structure

```
claude-dashboard/
├── .claude-plugin/
│   ├── plugin.json          # Plugin manifest
│   └── marketplace.json     # Marketplace metadata
├── commands/
│   ├── setup.md             # /claude-dashboard:setup command
│   └── check-usage.md       # /claude-dashboard:check-usage command
├── scripts/
│   ├── statusline.ts        # Main entry point (status line)
│   ├── check-usage.ts       # CLI usage dashboard entry point
│   ├── types.ts             # TypeScript interfaces
│   ├── widgets/             # Widget system
│   │   ├── base.ts          # Widget interface
│   │   ├── index.ts         # Widget registry & orchestrator
│   │   ├── model.ts         # Model widget
│   │   ├── context.ts       # Context usage widget
│   │   ├── cost.ts          # Cost widget
│   │   ├── rate-limit.ts    # Rate limit widgets (5h, 7d)
│   │   ├── project-info.ts  # Project info widget
│   │   ├── config-counts.ts # Config counts widget
│   │   ├── session-duration.ts # Session duration widget
│   │   ├── tool-activity.ts # Tool activity widget
│   │   ├── agent-status.ts  # Agent status widget
│   │   ├── todo-progress.ts # Todo progress widget
│   │   ├── burn-rate.ts     # Burn rate widget
│   │   ├── cache-hit.ts     # Cache hit rate widget
│   │   ├── depletion-time.ts # Depletion time widget
│   │   ├── codex-usage.ts   # Codex CLI usage widget
│   │   ├── gemini-usage.ts  # Gemini CLI usage widget
│   │   ├── zai-usage.ts     # z.ai/ZHIPU usage widget
│   │   ├── token-breakdown.ts # Token breakdown widget
│   │   ├── performance.ts   # Performance badge widget
│   │   ├── forecast.ts      # Cost forecast widget
│   │   └── budget.ts        # Budget tracking widget
│   └── utils/
│       ├── api-client.ts    # OAuth API client with caching
│       ├── codex-client.ts  # Codex CLI API client
│       ├── gemini-client.ts # Gemini CLI API client
│       ├── zai-api-client.ts # z.ai/ZHIPU API client
│       ├── provider.ts      # Provider detection (anthropic/zai/zhipu)
│       ├── colors.ts        # ANSI color codes + theme system
│       ├── credentials.ts   # Keychain/credentials extraction
│       ├── debug.ts         # Debug utilities
│       ├── formatters.ts    # Token/cost/time/duration formatting
│       ├── hash.ts          # Token hashing for cache keys
│       ├── i18n.ts          # Internationalization
│       ├── progress-bar.ts  # Progress bar rendering
│       ├── session.ts       # Session duration tracking
│       ├── budget.ts        # Budget tracking utilities
│       └── transcript-parser.ts # Transcript JSONL parsing
├── locales/
│   ├── en.json              # English translations
│   └── ko.json              # Korean translations
├── dist/
│   ├── index.js             # Status line built output (committed)
│   └── check-usage.js       # CLI usage dashboard built output (committed)
└── package.json
```

## Engineering Handbook

구현 패턴, 아키텍처 결정, 코딩 컨벤션은 [`docs/ENGINEERING_HANDBOOK.md`](docs/ENGINEERING_HANDBOOK.md) 참조.

**양방향 링크 시스템:**
- 코드의 `@handbook 3.1` → ENGINEERING_HANDBOOK 섹션 참조
- 문서의 `<!-- @code -->` 마커 → 소스 파일 참조
- 변경 시 양쪽 동기화 필요
- 마커 검색: `grep -r "@handbook" scripts/`

| 찾는 것 | HANDBOOK 섹션 |
|---------|--------------|
| 코딩 컨벤션 | 2 |
| 위젯 아키텍처 | 3 |
| 캐싱 아키텍처 | 4 |
| 테마 & i18n | 5 |
| 에러 핸들링 | 6 |
| API 클라이언트 | 7 |
| 테스트 | 8 |

| 패턴 | 참고 파일 |
|------|----------|
| 위젯 구현 (기본) | `scripts/widgets/cost.ts` |
| 위젯 구현 (API) | `scripts/widgets/rate-limit.ts` |
| 위젯 구현 (transcript) | `scripts/widgets/tool-activity.ts` |
| API 클라이언트 | `scripts/utils/api-client.ts` |
| 포매팅 유틸리티 | `scripts/utils/formatters.ts` |

## Widget Architecture

### Widget Interface

Each widget implements the `Widget` interface:

```typescript
interface Widget<T extends WidgetData> {
  id: WidgetId;
  name: string;
  getData(ctx: WidgetContext): Promise<T | null>;
  render(data: T, ctx: WidgetContext): string;
}
```

### Available Widgets

| Widget ID | Data Source | Description |
|-----------|-------------|-------------|
| `model` | stdin + settings | Model name with emoji, effort level for Opus/Sonnet (H/M/L), fast mode for Opus (↯) |
| `context` | stdin | Progress bar, %, tokens |
| `cost` | stdin | Session cost |
| `rateLimit5h` | API | 5-hour rate limit |
| `rateLimit7d` | API | 7-day rate limit (Max) |
| `rateLimit7dSonnet` | API | 7-day Sonnet limit (Max) |
| `projectInfo` | stdin + git | Directory + branch + ahead/behind (↑↓) |
| `configCounts` | filesystem | CLAUDE.md, rules, MCPs, hooks |
| `sessionDuration` | file | Session duration |
| `toolActivity` | transcript | Tool tracking |
| `agentStatus` | transcript | Agent tracking |
| `todoProgress` | transcript | Todo completion |
| `burnRate` | stdin + session | Token consumption per minute |
| `cacheHit` | stdin | Cache hit rate percentage |
| `depletionTime` | API + session | Estimated time to rate limit |
| `codexUsage` | Codex API | OpenAI Codex CLI usage (model, 5h, 7d) |
| `geminiUsage` | Gemini API | Google Gemini CLI usage (current model only) |
| `geminiUsageAll` | Gemini API | Google Gemini CLI usage (all model buckets) |
| `zaiUsage` | z.ai API | z.ai/ZHIPU GLM usage (5h tokens, 1m MCP) |
| `tokenBreakdown` | stdin | Input/output/cache write/read token breakdown |
| `performance` | stdin + session | Composite efficiency badge (cache hit + output ratio) |
| `forecast` | stdin + session | Estimated hourly cost based on session rate |
| `budget` | stdin + file | Daily spending vs configured budget limit |
| `linesChanged` | stdin | Lines added/removed count |
| `outputStyle` | stdin | Current output style |
| `version` | stdin | Claude Code version display |

### Display Modes

```typescript
type DisplayMode = 'compact' | 'normal' | 'detailed' | 'custom';

// Additive approach: each mode adds lines, widgets stay in same position
const DISPLAY_PRESETS = {
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
    ['codexUsage', 'geminiUsage', 'linesChanged', 'outputStyle', 'version'],
  ],
};
```

### Preset Shortcuts

Quick widget layout via single-character shorthand. Set `"preset"` in config, use `|` to separate lines.

```json
{ "preset": "MC$R|BDO" }
```

| Char | Widget | Char | Widget |
|------|--------|------|--------|
| `M` | model | `T` | toolActivity |
| `C` | context | `A` | agentStatus |
| `$` | cost | `O` | todoProgress |
| `R` | rateLimit5h | `B` | burnRate |
| `7` | rateLimit7d | `E` | depletionTime |
| `S` | rateLimit7dSonnet | `H` | cacheHit |
| `P` | projectInfo | `X` | codexUsage |
| `I` | sessionId | `G` | geminiUsage |
| `D` | sessionDuration | `Z` | zaiUsage |
| `K` | configCounts | `N` | tokenBreakdown |
| `F` | performance | `W` | forecast |
| `U` | budget | `L` | linesChanged |
| `V` | version | `Y` | outputStyle |

### Theme System

Color themes via `getTheme()` semantic roles. Set `"theme"` in config.

| Theme | Style |
|-------|-------|
| `default` | Pastel colors (cyan, yellow, pink, green) |
| `minimal` | Monochrome (white + gray) |
| `catppuccin` | Catppuccin Mocha palette |
| `dracula` | Dracula palette |
| `gruvbox` | Gruvbox palette |
| `nord` | Nord polar night/frost palette |
| `tokyoNight` | Tokyo Night blue/purple palette |
| `solarized` | Solarized dark palette |

### Separator Styles

Widget separator style via `"separator"` in config.

| Style | Character | Example |
|-------|-----------|---------|
| `pipe` (default) | `│` | `Model │ Context │ Cost` |
| `space` | ` ` | `Model  Context  Cost` |
| `dot` | `·` | `Model · Context · Cost` |
| `arrow` | `›` | `Model › Context › Cost` |

### Widget Toggle

`"disabledWidgets"` in config filters widgets from any display mode (preset or custom).
Empty lines after filtering are automatically removed.

## Development Workflow

```bash
# Install dependencies
npm install

# Build
npm run build

# Test locally
echo '{"model":{"display_name":"Opus"},"workspace":{"current_dir":"/tmp"},...}' | node dist/index.js
```

## Code Style

- Use TypeScript strict mode
- ESM modules (import/export)
- Functional style preferred
- No external runtime dependencies (Node.js built-ins only)

## Key Conventions

1. **dist/index.js is committed** - Plugin users don't need to build
2. **60-second API cache** - Avoid rate limiting
3. **Graceful degradation** - Show ⚠️ on API errors, widgets return null on failure
4. **i18n** - All user-facing strings in locales/*.json
5. **Widget isolation** - Each widget handles its own data fetching and rendering

## Testing Checklist

Before committing:
- [ ] `npm run build` succeeds
- [ ] All display modes (compact/normal/detailed) work
- [ ] Pro/Max plan output format correct
- [ ] Korean/English switching works
- [ ] API error shows ⚠️ instead of crash
- [ ] Missing data gracefully hides widgets
- [ ] Theme switching works (default/minimal/catppuccin/dracula/gruvbox)
- [ ] `disabledWidgets` correctly filters widgets

## Common Tasks

### Adding a new widget

1. Create `scripts/widgets/{widget-name}.ts`
2. Implement `Widget` interface with `getData()` and `render()`
3. Add widget ID to `WidgetId` type in `types.ts`
4. Register widget in `scripts/widgets/index.ts`
5. Add translations to `locales/*.json` if needed
6. Update `DISPLAY_PRESETS` if adding to default modes
7. Rebuild and test

### Adding a new locale

1. Create `locales/{lang}.json` copying from `en.json`
2. Update `scripts/utils/i18n.ts` to import new locale
3. Test with `/claude-dashboard:setup normal {lang}`

### Modifying display modes

1. Edit `DISPLAY_PRESETS` in `scripts/types.ts`
2. Update `README.md` and `commands/setup.md` examples
3. Rebuild and test

### Updating API client

1. Edit `scripts/utils/api-client.ts`
2. Check cache invalidation logic
3. Test with expired cache (`rm -rf ~/.cache/claude-dashboard/`)

## Cache Architecture

### Multi-Account Support

- Each OAuth token is hashed (SHA-256, 16 chars) for cache key separation
- Cache files: `~/.cache/claude-dashboard/cache-{hash}.json`
- Supports concurrent account switching without cache conflicts

### Three-Tier Caching

1. **Memory cache** - In-process Map, fastest
2. **File cache** - Persists across process restarts
3. **API fetch** - Falls back when cache misses

### Transcript Caching (Incremental)

- Transcript parser tracks byte offset, only reads new bytes since last parse
- Full re-parse only on first load or file truncation
- Shared across tool/agent/todo widgets

### Cleanup Behavior

- **Trigger**: Time-based (once per hour maximum)
- **Target**: Files older than `CACHE_MAX_AGE_SECONDS` (1 hour)
- **Pattern**: Only `cache-*.json` files in cache directory

### Request Deduplication

- `pendingRequests` Map prevents concurrent duplicate API calls
- Same token hash → shares single in-flight request
