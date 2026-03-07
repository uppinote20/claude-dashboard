---
title: 커맨드
description: 사용 가능한 모든 커맨드 레퍼런스
sidebar:
  order: 1
---

claude-dashboard는 4개의 커맨드를 제공합니다.

## /claude-dashboard:setup

상태줄 디스플레이 모드, 언어, 플랜, 테마를 설정합니다.

### 인자

- **인자 없음**: 대화형 모드 (질문을 통해 설정)
- **인자 있음**: 직접 설정 모드

| 인자 | 설명 | 기본값 |
|------|------|--------|
| `$1` | 디스플레이 모드 (`compact`, `normal`, `detailed`, `custom`) | `compact` |
| `$2` | 언어 (`auto`, `en`, `ko`) | `auto` |
| `$3` | 플랜 (`max`, `pro`) | `max` |
| `$4` | 커스텀 위젯 (custom 모드 전용, `"widget1,widget2\|widget3"`) | - |

### 사용 예시

```bash
# 대화형 모드
/claude-dashboard:setup

# 프리셋 모드
/claude-dashboard:setup normal
/claude-dashboard:setup compact en pro
/claude-dashboard:setup detailed ko max

# 커스텀 모드
/claude-dashboard:setup custom auto max "model,context,cost|projectInfo,todoProgress"
```

## /claude-dashboard:check-usage

모든 AI CLI(Claude, Codex, Gemini, z.ai)의 사용량 제한을 확인하고, 가장 여유 있는 CLI를 추천합니다.

### 인자

| 인자 | 설명 |
|------|------|
| (없음) | 컬러 인터랙티브 출력 |
| `--json` | 스크립팅용 JSON 출력 |
| `--lang ko` | 한국어로 출력 |
| `--lang en` | 영어로 출력 |

### 사용 예시

```bash
# 인터랙티브 출력
/claude-dashboard:check-usage

# JSON 출력
/claude-dashboard:check-usage --json

# 한국어 출력
/claude-dashboard:check-usage --lang ko
```

### 출력 내용

각 설치된 CLI의 사용량을 표시합니다:

- **Claude**: 5시간 및 7일 속도 제한, 리셋 시간
- **Codex**: 5시간 및 7일 제한, 플랜 정보 (설치된 경우)
- **Gemini**: 모델별 사용량 백분율 (설치된 경우)
- **z.ai**: 토큰 및 MCP 사용량 (설정된 경우)

하단에 현재 사용량이 가장 낮은 CLI를 추천합니다.

## /claude-dashboard:setup-alias

터미널에서 `check-ai` 쉘 별칭을 설정합니다. macOS/Linux (zsh/bash) 및 Windows (PowerShell)를 지원합니다.

### 사용 예시

```bash
/claude-dashboard:setup-alias
```

설정 완료 후 터미널에서 직접 사용할 수 있습니다:

```bash
check-ai          # 컬러 출력
check-ai --json   # 스크립팅용 JSON 출력
```

### 지원 환경

- **macOS/Linux**: `~/.zshrc` 또는 `~/.bashrc`에 함수를 추가합니다.
- **Windows**: PowerShell 프로파일에 함수를 추가합니다.

별칭은 플러그인의 최신 버전을 자동으로 찾으므로, 플러그인 업데이트 후에도 별도 재설정 없이 동작합니다.

## /claude-dashboard:update

플러그인 업데이트 후 `settings.json`의 `statusLine` 경로를 최신 버전으로 갱신합니다.

### 사용 예시

```bash
/claude-dashboard:update
```

### 사용 시점

플러그인을 업데이트한 후 실행합니다:

```bash
# 마켓플레이스를 통해 업데이트 후
/plugin update claude-dashboard
/claude-dashboard:update

# git pull로 수동 업데이트 후
/claude-dashboard:update
```

업데이트 후 변경 사항을 적용하려면 Claude Code를 재시작해야 합니다.
