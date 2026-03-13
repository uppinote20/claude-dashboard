---
title: Preset Shortcuts
description: Quick layout with single-character shorthand
sidebar:
  order: 5
---

Preset shortcuts let you define your entire widget layout using a compact single-character notation. Set the `"preset"` field in your configuration file to use this feature.

## How It Works

Each character maps to a specific widget. Use `|` to separate lines. Unknown characters are silently ignored.

```json
{
  "preset": "MC$R|BDO"
}
```

This creates a 2-line layout:
- **Line 1:** model, context, cost, rateLimit5h
- **Line 2:** burnRate, sessionDuration, todoProgress

## Character Mapping

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
| `U` | budget | `V` | version |
| `L` | linesChanged | `Y` | outputStyle |
| `Q` | tokenSpeed | `J` | sessionName |
| `@` | todayCost | | |

## Examples

### Compact with rate limits

```json
{ "preset": "MC$R7S" }
```

Result: model, context, cost, rateLimit5h, rateLimit7d, rateLimit7dSonnet -- all on one line.

### Two-line with analytics

```json
{ "preset": "MC$R|BDEO" }
```

- **Line 1:** model, context, cost, rateLimit5h
- **Line 2:** burnRate, sessionDuration, depletionTime, todoProgress

### Full monitoring

```json
{ "preset": "MC$R7|PIDBO|KTAHF|NWU|XGLYV" }
```

- **Line 1:** model, context, cost, rateLimit5h, rateLimit7d
- **Line 2:** projectInfo, sessionId, sessionDuration, burnRate, todoProgress
- **Line 3:** configCounts, toolActivity, agentStatus, cacheHit, performance
- **Line 4:** tokenBreakdown, forecast, budget
- **Line 5:** codexUsage, geminiUsage, linesChanged, outputStyle, version

## Combining with Other Options

The preset shorthand can be combined with theme, separator, and other configuration options:

```json
{
  "preset": "MC$R|BDO",
  "theme": "tokyoNight",
  "separator": "dot",
  "plan": "max",
  "language": "auto",
  "cache": {
    "ttlSeconds": 300
  }
}
```

When `preset` is set, it overrides the `displayMode` with `custom` and generates the `lines` array automatically.
