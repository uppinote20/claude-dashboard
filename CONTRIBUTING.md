# Contributing to claude-dashboard

Thank you for your interest in contributing to claude-dashboard!

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/claude-dashboard.git
   cd claude-dashboard
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development

### Build

```bash
npm run build
```

### Test locally

```bash
echo '{"model":{"display_name":"Opus"},"context_window":{"context_window_size":200000,"current_usage":{"input_tokens":50000,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}},"cost":{"total_cost_usd":0.5}}' | node dist/index.js
```

### Test with Claude Code

```bash
claude --plugin-dir /path/to/claude-dashboard
```

## Contributing a Widget

All status-line widgets implement the same small interface, so new widgets can be added without touching the orchestrator.

### Interface

```ts
// scripts/widgets/base.ts
export interface Widget<T extends WidgetData = WidgetData> {
  readonly id: WidgetId;
  readonly name: string;
  getData(ctx: WidgetContext): Promise<T | null>;
  render(data: T, ctx: WidgetContext): string;
}
```

`getData` returns `null` to opt out of rendering — use this whenever required data is missing (no token, no transcript, feature disabled, etc.) so the widget gracefully disappears instead of erroring.

### Steps

1. **Pick a data source.** stdin (always available), transcript JSONL, an API client, git, or a config file.
2. **Create `scripts/widgets/<your-widget>.ts`** and implement `Widget`.
3. **Register the ID** in the `WidgetId` union in `scripts/types.ts`.
4. **Register the widget instance** in `scripts/widgets/index.ts` (import + map entry + preset character if you want a shorthand).
5. **Add translations** for any user-facing strings to every locale under `locales/*.json`.
6. **Write tests** in `scripts/__tests__/widgets.test.ts` (or a dedicated file). Cover both the populated state and the `null`/hidden state.
7. **Update presets** in `DISPLAY_PRESETS` in `scripts/types.ts` only if you want the widget to ship in the `normal`/`detailed` defaults — most third-party widgets should stay opt-in.

### Reference widgets

| Pattern | Example |
|---|---|
| Pure stdin | [`scripts/widgets/cost.ts`](scripts/widgets/cost.ts) |
| Cached API call | [`scripts/widgets/rate-limit.ts`](scripts/widgets/rate-limit.ts) |
| Transcript parsing | [`scripts/widgets/tool-activity.ts`](scripts/widgets/tool-activity.ts) |
| Git + module cache | [`scripts/widgets/tag-status.ts`](scripts/widgets/tag-status.ts) |

For deeper guidance on caching, theming, and error handling, see [`docs/ENGINEERING_HANDBOOK.md`](docs/ENGINEERING_HANDBOOK.md) sections 3–7.

## Pull Request Process

1. Ensure your code builds without errors
2. Test your changes locally with Claude Code
3. Update README.md if you've changed functionality
4. Create a Pull Request with a clear description

## Code Style

- Use TypeScript
- Follow existing code patterns
- Keep functions small and focused
- Add comments for complex logic

## Reporting Issues

- Use GitHub Issues
- Include Claude Code version
- Provide steps to reproduce
- Include error messages if any

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
