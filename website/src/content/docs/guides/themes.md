---
title: 테마
description: 8가지 색상 테마 설정
sidebar:
  order: 3
---

claude-dashboard는 8가지 색상 테마를 제공합니다. 테마는 `getTheme()` 함수의 시맨틱 역할을 통해 위젯 색상을 결정합니다.

## 사용 가능한 테마

| 테마 | 스타일 |
|------|--------|
| `default` | 파스텔 색상 (cyan, yellow, pink, green) |
| `minimal` | 모노크롬 (white + gray) |
| `catppuccin` | Catppuccin Mocha 팔레트 |
| `dracula` | Dracula 팔레트 |
| `gruvbox` | Gruvbox 팔레트 |
| `nord` | Nord polar night/frost 팔레트 |
| `tokyoNight` | Tokyo Night blue/purple 팔레트 |
| `solarized` | Solarized dark 팔레트 |

## 테마 설정

설정 파일(`~/.claude/claude-dashboard.local.json`)에서 `"theme"` 값을 변경합니다:

```json
{
  "theme": "catppuccin"
}
```

또는 setup 커맨드의 대화형 모드에서 테마를 선택할 수 있습니다:

```
/claude-dashboard:setup
```

## 구분선 스타일

위젯 사이의 구분선 스타일을 설정할 수 있습니다. `"separator"` 값을 변경하세요.

| 스타일 | 문자 | 예시 |
|--------|------|------|
| `pipe` (기본값) | `│` | `Model │ Context │ Cost` |
| `space` | ` ` | `Model  Context  Cost` |
| `dot` | `·` | `Model · Context · Cost` |
| `arrow` | `›` | `Model › Context › Cost` |

### 구분선 설정 예시

```json
{
  "theme": "dracula",
  "separator": "dot"
}
```

## 테마 + 구분선 조합 예시

```json
{
  "language": "auto",
  "plan": "max",
  "displayMode": "normal",
  "theme": "tokyoNight",
  "separator": "arrow",
  "cache": {
    "ttlSeconds": 60
  }
}
```
