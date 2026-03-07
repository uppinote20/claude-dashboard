---
title: Quick Start
description: First setup and basic usage
sidebar:
  order: 2
---

After installing claude-dashboard, you can configure it using the `/claude-dashboard:setup` command.

## Run Setup

The simplest way to get started is to run the setup command without arguments. This launches interactive mode, which guides you through selecting a display mode, language, plan, and theme:

```
/claude-dashboard:setup
```

## Choose a Display Mode

There are three built-in preset modes:

### Compact (1 line) -- Default

Shows the essential metrics on a single line.

```
/claude-dashboard:setup compact
```

```
🤖 Opus(H) │ ██░░ 80% │ $1.25 │ 5h: 42% │ 7d: 69%
```

### Normal (2 lines)

Adds project info, session details, and progress tracking.

```
/claude-dashboard:setup normal
```

```
🤖 Opus(H) │ ██░░ 80% │ $1.25 │ 5h: 42% │ 7d: 69%
📁 project (main ↑3) │ 🔑 abc123 │ ⏱ 45m │ 🔥 5K/m │ ✓ 3/5
```

### Detailed (5 lines)

Shows all available widgets including analytics, multi-CLI usage, and insights.

```
/claude-dashboard:setup detailed
```

```
🤖 Opus(H) │ ██░░ 80% │ $1.25 │ 5h: 42% │ 7d: 69%
📁 project (main ↑3) │ 🔑 abc123 │ ⏱ 45m │ 🔥 5K/m │ ⏳ 2h │ ✓ 3/5
CLAUDE.md: 2 │ ⚙️ 12 done │ 🤖 Agent: 1 │ 📦 85% │ 🟢 72%
📊 In 30K · Out 8K │ 📈 ~$8/h │ 💵 $5/$15
🔷 codex │ 💎 gemini
```

## Specify Language and Plan

You can pass additional arguments for language and plan:

```bash
/claude-dashboard:setup normal en pro       # English, Pro plan
/claude-dashboard:setup detailed ko max     # Korean, Max plan
```

## What's Next

- Learn more about each mode in the [Display Modes](/guides/display-modes/) guide
- See all available widgets in the [Widgets](/guides/widgets/) guide
- Customize colors with [Themes](/guides/themes/)
- Fine-tune your layout with [Configuration](/guides/configuration/)
