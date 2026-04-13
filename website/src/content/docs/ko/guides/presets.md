---
title: 프리셋 단축키
description: 한 글자 단축키로 빠른 레이아웃 설정
sidebar:
  order: 5
---

프리셋 단축키를 사용하면 한 글자 문자로 위젯을 빠르게 배치할 수 있습니다. 설정 파일에 `"preset"` 값을 지정하면 `displayMode`와 `lines`를 자동으로 생성합니다.

## 사용법

설정 파일(`~/.claude/claude-dashboard.local.json`)에 `"preset"` 값을 추가합니다:

```json
{
  "preset": "MC$R|BDO"
}
```

위 예시는 다음과 같은 2줄 레이아웃을 생성합니다:
- **1줄**: model, context, cost, rateLimit5h
- **2줄**: burnRate, sessionDuration, todoProgress

## 문자-위젯 매핑 표

| 문자 | 위젯 | 문자 | 위젯 |
|------|------|------|------|
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
| `@` | todayCost | `?` | lastPrompt |
| `m` | vimMode | `a` | apiDuration |
| `p` | peakHours | | |

## 예시

### 속도 제한 포함 (1줄)

```json
{ "preset": "MC$R7S" }
```

결과: model, context, cost, rateLimit5h, rateLimit7d, rateLimit7dSonnet -- 한 줄에 모두 표시.

### 분석 포함 (2줄)

```json
{ "preset": "MC$R|BDEO" }
```

- **1줄:** model, context, cost, rateLimit5h
- **2줄:** burnRate, sessionDuration, depletionTime, todoProgress

### 전체 모니터링

```json
{ "preset": "MC$R7|PIDBO|KTAHF|NWU|XGLYV" }
```

- **1줄:** model, context, cost, rateLimit5h, rateLimit7d
- **2줄:** projectInfo, sessionId, sessionDuration, burnRate, todoProgress
- **3줄:** configCounts, toolActivity, agentStatus, cacheHit, performance
- **4줄:** tokenBreakdown, forecast, budget
- **5줄:** codexUsage, geminiUsage, linesChanged, outputStyle, version

## 다른 설정과 조합

프리셋 단축키는 테마, 구분선 등 다른 설정과 함께 사용할 수 있습니다:

```json
{
  "preset": "MC$R|BDO",
  "theme": "tokyoNight",
  "separator": "dot",
  "dailyBudget": 15,
  "cache": {
    "ttlSeconds": 300
  }
}
```

## 참고 사항

- 인식되지 않는 문자는 무시됩니다.
- `preset` 값이 설정되면 `displayMode`를 `custom`으로 자동 변경하고, 해당 문자열에서 `lines` 배열을 생성합니다.
- `disabledWidgets`와 함께 사용할 수 있으며, 비활성화된 위젯은 프리셋에서도 필터링됩니다.
