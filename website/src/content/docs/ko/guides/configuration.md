---
title: 설정
description: 상세 설정 방법
sidebar:
  order: 4
---

## setup 커맨드

`/claude-dashboard:setup` 커맨드로 상태줄을 설정할 수 있습니다.

### 프리셋 모드

```bash
# 1줄 (기본값)
/claude-dashboard:setup compact

# 2줄, 영어, Pro 플랜
/claude-dashboard:setup normal en pro

# 6줄, 한국어, Max 플랜
/claude-dashboard:setup detailed ko max
```

### 커스텀 모드

위젯의 순서와 줄 구성을 직접 지정합니다. `|`로 줄을 구분합니다.

```bash
/claude-dashboard:setup custom auto max "model,context,cost|projectInfo,todoProgress"
```

### 대화형 모드

인자 없이 실행하면 대화형으로 설정할 수 있습니다:

```
/claude-dashboard:setup
```

디스플레이 모드, 언어, 플랜, 테마를 순서대로 선택합니다.

## 플랜 차이

| 기능 | Max | Pro |
|------|-----|-----|
| 5시간 속도 제한 + 카운트다운 | O | O |
| 7일 전체 모델 사용량 | O | O |

## 설정 파일

설정 파일 위치: `~/.claude/claude-dashboard.local.json`

### 전체 설정 예시

```json
{
  "language": "auto",
  "plan": "max",
  "displayMode": "custom",
  "lines": [
    ["model", "context", "cost", "rateLimit5h"],
    ["projectInfo", "todoProgress"]
  ],
  "theme": "default",
  "separator": "pipe",
  "dailyBudget": 15,
  "disabledWidgets": [],
  "cache": {
    "ttlSeconds": 300
  }
}
```

### 프리셋 단축키 사용

프리셋 단축키를 사용하면 더 간결하게 설정할 수 있습니다:

```json
{
  "preset": "MC$R|BDO",
  "theme": "tokyoNight",
  "separator": "dot"
}
```

자세한 내용은 [프리셋 단축키](/ko/guides/presets/) 페이지를 참고하세요.

## 예산 추적

일일 예산 한도를 설정하면 `budget` 위젯이 활성화됩니다:

```json
{
  "dailyBudget": 15
}
```

- 80% 소진 시 경고 표시
- 95% 소진 시 위험 표시

## 태그 상태 패턴

`tagStatus` 위젯은 매칭된 각 git 태그로부터 HEAD까지의 커밋 수를 표시합니다. 추적할 태그 패턴은 `tagPatterns`로 설정합니다:

```json
{
  "tagPatterns": ["v*", "release-*"]
}
```

각 glob 패턴은 HEAD에서 도달 가능한 최신 태그 하나에만 매칭됩니다. 기본값은 `["v*"]`이며, 어떤 패턴도 태그와 매칭되지 않으면 위젯이 자동으로 숨겨집니다.

## 위젯 비활성화

`disabledWidgets` 배열에 위젯 ID를 추가하면 모든 디스플레이 모드에서 해당 위젯이 숨겨집니다. 필터링 후 빈 줄은 자동으로 제거됩니다.

```json
{
  "disabledWidgets": ["codexUsage", "geminiUsage"]
}
```

## 색상 범례

컨텍스트 사용량과 속도 제한 위젯에는 다음 색상이 적용됩니다:

- 🟢 **0-50%**: 안전 (Safe)
- 🟡 **51-80%**: 주의 (Warning)
- 🔴 **81-100%**: 위험 (Critical)
