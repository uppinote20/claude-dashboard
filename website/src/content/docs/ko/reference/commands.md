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

모든 AI CLI(Claude, Codex, Gemini, Antigravity, z.ai)의 사용량 제한을 확인하고, 가장 여유 있는 CLI를 추천합니다.

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
- **Codex**: 사용량 제한, 플랜 정보 (설치된 경우) — 각 윈도우는 실제 기간으로 표시 (Plus는 5시간 + 7일, Pro는 7일 하나)
- **Gemini**: 모델별 사용량 백분율 (설치된 경우)
- **Antigravity**: 모델 패밀리별 주간 quota — Gemini vs Claude+GPT (설치 시)
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

statusLine shim을 복구하거나 상태를 확인합니다 (보통은 자동으로 처리됩니다).

### 사용 예시

```bash
/claude-dashboard:update
```

### 사용 시점

일반적으로는 실행할 필요가 없습니다. `statusLine`은 매 렌더링마다 최신 설치 버전을 자동으로
찾아내는 고정 shim 경로(`plugins/data/claude-dashboard-claude-dashboard/statusline.mjs`)를
가리키므로, `SessionStart` 훅이 `/plugin update claude-dashboard` 이후에도 계속 최신 상태를
유지해 줍니다. 훅을 비활성화했거나 상태줄이 갱신되지 않을 때만 이 커맨드를 실행하세요.

### 동작 방식

1. 고정된 데이터 디렉터리 경로에 shim을 설치하거나 최신화하고, `settings.json`(`CLAUDE_CONFIG_DIR`가
   설정되어 있으면 `$CLAUDE_CONFIG_DIR/settings.json`, 아니면 `~/.claude/settings.json`)의
   `statusLine`이 그 경로를 가리키도록 설정합니다
2. shim이 현재 어떤 빌드를 가리키는지 보고합니다

`settings.json`이 변경된 경우 다음 상호작용부터 바로 적용됩니다 — 재시작은 필요하지 않습니다.
