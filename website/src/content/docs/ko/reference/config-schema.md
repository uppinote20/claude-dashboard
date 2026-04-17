---
title: 설정 스키마
description: 설정 파일 JSON 스키마 레퍼런스
sidebar:
  order: 3
---

설정 파일(`~/.claude/claude-dashboard.local.json`)의 JSON 스키마를 설명합니다.

## Config 인터페이스

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `language` | `'en' \| 'ko' \| 'auto'` | `'auto'` | 언어 설정. `auto`는 시스템 언어를 자동 감지합니다. |
| `plan` | `'pro' \| 'max'` | `'max'` | 구독 플랜. 표시되는 속도 제한 위젯에 영향을 줍니다. |
| `displayMode` | `DisplayMode` | `'compact'` | 디스플레이 모드. `preset` 사용 시 자동으로 `'custom'`이 됩니다. |
| `lines` | `WidgetId[][]` | - | 커스텀 줄 구성. `displayMode`가 `'custom'`일 때만 사용됩니다. |
| `disabledWidgets` | `WidgetId[]` | `[]` | 비활성화할 위젯 ID 목록. 모든 모드에서 필터링됩니다. |
| `theme` | `ThemeId` | `'default'` | 색상 테마. |
| `separator` | `SeparatorStyle` | `'pipe'` | 위젯 간 구분선 스타일. |
| `preset` | `string` | - | 프리셋 단축키 문자열. 설정 시 `displayMode`를 `'custom'`으로 변경합니다. |
| `dailyBudget` | `number` | - | 일일 예산 한도 (USD). 설정 시 `budget` 위젯이 활성화됩니다. |
| `tagPatterns` | `string[]` | `["v*"]` | `tagStatus` 위젯용 glob 패턴 목록. 각 패턴은 HEAD에서 도달 가능한 최신 태그 하나에 매칭됩니다. 어떤 패턴도 매칭되지 않으면 위젯이 숨겨집니다. |
| `cache` | `{ ttlSeconds: number }` | `{ ttlSeconds: 300 }` | API 캐시 설정. |

## DisplayMode

디스플레이 모드 타입입니다.

```typescript
type DisplayMode = 'compact' | 'normal' | 'detailed' | 'custom';
```

| 값 | 설명 |
|----|------|
| `compact` | 1줄 핵심 지표 (기본값) |
| `normal` | 2줄 (핵심 + 프로젝트/세션) |
| `detailed` | 6줄 (모든 위젯) |
| `custom` | 사용자 정의 레이아웃 (`lines` 또는 `preset` 사용) |

## ThemeId

색상 테마 타입입니다.

```typescript
type ThemeId = 'default' | 'minimal' | 'catppuccin' | 'catppuccinLatte' | 'dracula' | 'gruvbox' | 'nord' | 'tokyoNight' | 'solarized';
```

| 값 | 스타일 |
|----|--------|
| `default` | 파스텔 색상 (cyan, yellow, pink, green) |
| `minimal` | 모노크롬 (white + gray) |
| `catppuccin` | Catppuccin Mocha 팔레트 |
| `catppuccinLatte` | Catppuccin Latte 팔레트 (라이트 모드 터미널용) |
| `dracula` | Dracula 팔레트 |
| `gruvbox` | Gruvbox 팔레트 |
| `nord` | Nord polar night/frost 팔레트 |
| `tokyoNight` | Tokyo Night blue/purple 팔레트 |
| `solarized` | Solarized dark 팔레트 |

## SeparatorStyle

위젯 구분선 스타일 타입입니다.

```typescript
type SeparatorStyle = 'pipe' | 'space' | 'dot' | 'arrow';
```

| 값 | 문자 | 예시 |
|----|------|------|
| `pipe` | `│` | `Model │ Context │ Cost` |
| `space` | ` ` | `Model  Context  Cost` |
| `dot` | `·` | `Model · Context · Cost` |
| `arrow` | `›` | `Model › Context › Cost` |

## WidgetId

사용 가능한 모든 위젯 ID입니다.

```typescript
type WidgetId =
  | 'model' | 'context' | 'contextBar' | 'contextPercentage' | 'contextUsage' | 'cost'
  | 'rateLimit5h' | 'rateLimit7d' | 'rateLimit7dSonnet'
  | 'projectInfo' | 'configCounts'
  | 'sessionDuration' | 'sessionId' | 'sessionIdFull' | 'sessionName'
  | 'toolActivity' | 'agentStatus' | 'todoProgress'
  | 'burnRate' | 'tokenSpeed' | 'depletionTime' | 'cacheHit'
  | 'codexUsage' | 'geminiUsage' | 'geminiUsageAll' | 'zaiUsage'
  | 'tokenBreakdown' | 'performance' | 'forecast' | 'budget' | 'todayCost'
  | 'version'
  | 'linesChanged'
  | 'outputStyle'
  | 'lastPrompt'
  | 'vimMode'
  | 'apiDuration'
  | 'peakHours'
  | 'tagStatus';
```

## 전체 설정 예시

모든 필드를 포함한 완전한 설정 파일 예시입니다:

```json
{
  "language": "auto",
  "plan": "max",
  "displayMode": "custom",
  "lines": [
    ["model", "context", "cost", "rateLimit5h", "rateLimit7d"],
    ["projectInfo", "sessionId", "sessionDuration", "burnRate", "todoProgress"]
  ],
  "theme": "catppuccin",
  "separator": "dot",
  "dailyBudget": 15,
  "disabledWidgets": ["geminiUsageAll"],
  "cache": {
    "ttlSeconds": 300
  }
}
```

## 프리셋 단축키 설정 예시

`preset` 필드를 사용한 간결한 설정입니다:

```json
{
  "language": "ko",
  "plan": "max",
  "preset": "MC$R7|PDBO|NWUF",
  "theme": "tokyoNight",
  "separator": "arrow",
  "dailyBudget": 20,
  "cache": {
    "ttlSeconds": 300
  }
}
```

## 기본 설정

설정 파일이 없거나 필드가 누락된 경우 적용되는 기본값입니다:

```json
{
  "language": "auto",
  "plan": "max",
  "displayMode": "compact",
  "cache": {
    "ttlSeconds": 300
  }
}
```
