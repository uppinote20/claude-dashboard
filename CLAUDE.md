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
│   └── setup.md             # /claude-dashboard:setup command
├── scripts/
│   ├── statusline.ts        # Main entry point
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
│   │   └── zai-usage.ts     # z.ai/ZHIPU usage widget
│   └── utils/
│       ├── api-client.ts    # OAuth API client with caching
│       ├── codex-client.ts  # Codex CLI API client
│       ├── gemini-client.ts # Gemini CLI API client
│       ├── zai-api-client.ts # z.ai/ZHIPU API client
│       ├── provider.ts      # Provider detection (anthropic/zai/zhipu)
│       ├── colors.ts        # ANSI color codes
│       ├── credentials.ts   # Keychain/credentials extraction
│       ├── debug.ts         # Debug utilities
│       ├── formatters.ts    # Token/cost/time/duration formatting
│       ├── hash.ts          # Token hashing for cache keys
│       ├── i18n.ts          # Internationalization
│       ├── progress-bar.ts  # Progress bar rendering
│       ├── session.ts       # Session duration tracking
│       └── transcript-parser.ts # Transcript JSONL parsing
├── locales/
│   ├── en.json              # English translations
│   └── ko.json              # Korean translations
├── dist/
│   └── index.js             # Built output (committed)
└── package.json
```

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
| `model` | stdin | Model name with emoji |
| `context` | stdin | Progress bar, %, tokens |
| `cost` | stdin | Session cost |
| `rateLimit5h` | API | 5-hour rate limit |
| `rateLimit7d` | API | 7-day rate limit (Max) |
| `rateLimit7dSonnet` | API | 7-day Sonnet limit (Max) |
| `projectInfo` | stdin + git | Directory + branch |
| `configCounts` | filesystem | CLAUDE.md, rules, MCPs, hooks |
| `sessionDuration` | file | Session duration |
| `toolActivity` | transcript | Tool tracking |
| `agentStatus` | transcript | Agent tracking |
| `todoProgress` | transcript | Todo completion |
| `burnRate` | stdin + session | Token consumption per minute |
| `cacheHit` | stdin | Cache hit rate percentage |
| `depletionTime` | API + session | Estimated time to rate limit |
| `codexUsage` | Codex API | OpenAI Codex CLI usage (model, 5h, 7d) |
| `geminiUsage` | Gemini API | Google Gemini CLI usage (model, usage %) |
| `zaiUsage` | z.ai API | z.ai/ZHIPU GLM usage (5h tokens, 1m MCP) |

### Display Modes

```typescript
type DisplayMode = 'compact' | 'normal' | 'detailed' | 'custom';

// Additive approach: each mode adds lines, widgets stay in same position
const DISPLAY_PRESETS = {
  compact: [
    ['model', 'context', 'cost', 'rateLimit5h', 'rateLimit7d', 'rateLimit7dSonnet'],
  ],
  normal: [
    ['model', 'context', 'cost', 'rateLimit5h', 'rateLimit7d', 'rateLimit7dSonnet'],
    ['projectInfo', 'sessionDuration', 'todoProgress'],
  ],
  detailed: [
    ['model', 'context', 'cost', 'rateLimit5h', 'rateLimit7d', 'rateLimit7dSonnet'],
    ['projectInfo', 'sessionDuration', 'burnRate', 'depletionTime', 'todoProgress'],
    ['configCounts', 'toolActivity', 'agentStatus', 'cacheHit'],
    ['codexUsage', 'geminiUsage', 'zaiUsage'],
  ],
};
```

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

### Transcript Caching

- Transcript parser caches parsed data with mtime check
- Re-parses only when file changes
- Shared across tool/agent/todo widgets

### Cleanup Behavior

- **Trigger**: Time-based (once per hour maximum)
- **Target**: Files older than `CACHE_MAX_AGE_SECONDS` (1 hour)
- **Pattern**: Only `cache-*.json` files in cache directory

### Request Deduplication

- `pendingRequests` Map prevents concurrent duplicate API calls
- Same token hash → shares single in-flight request
