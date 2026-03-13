---
title: 빠른 시작
description: 첫 설정과 사용법
sidebar:
  order: 2
---

## 설치 후 첫 설정

설치가 완료되면 `/claude-dashboard:setup` 커맨드를 실행하여 상태줄을 설정합니다.

```
/claude-dashboard:setup
```

인자 없이 실행하면 대화형 모드로 디스플레이 모드, 언어, 플랜, 테마를 선택할 수 있습니다.

## 프리셋 모드

세 가지 프리셋 모드를 제공합니다:

### Compact (1줄, 기본값)

핵심 정보만 표시합니다: 모델, 컨텍스트 사용량, 비용, 속도 제한.

```
/claude-dashboard:setup compact
```

```
◆ Opus(H) │ ██░░ 80% │ $1.25 │ 5h: 42% │ 7d: 69%
```

### Normal (2줄)

프로젝트 정보, 세션 ID, 세션 시간, 번 레이트, TODO 진행률을 추가로 표시합니다.

```
/claude-dashboard:setup normal
```

```
◆ Opus(H) │ ██░░ 80% │ $1.25 │ 5h: 42% │ 7d: 69%
📁 project (main ↑3) │ 🔑 abc123 │ ⏱ 45m │ 🔥 5K/m │ ✓ 3/5
```

### Detailed (5줄)

모든 위젯을 포함하여 전체 대시보드를 표시합니다.

```
/claude-dashboard:setup detailed
```

```
◆ Opus(H) │ ██░░ 80% │ $1.25 │ 5h: 42% │ 7d: 69%
📁 project (main ↑3) │ » feature-auth │ 🔑 abc123 │ ⏱ 45m │ 🔥 5K/m │ ⚡ 67 tok/s │ ⏳ 2h │ ✓ 3/5
CLAUDE.md: 2 │ ⚙️ Read(app.ts) (12 done) │ 🤖 Agent: 1 │ 📦 85% │ 🟢 72%
📊 In 30K · Out 8K │ 📈 ~$8/h │ 💵 $5/$15 │ 💰 오늘: $4.83
🔷 codex │ 💎 gemini │ +156 -23 │ concise │ v1.0.80
```

## 언어 및 플랜 설정

언어와 플랜을 직접 지정할 수도 있습니다:

```bash
# 한국어, Max 플랜
/claude-dashboard:setup normal ko max

# 영어, Pro 플랜
/claude-dashboard:setup compact en pro
```

## 다음 단계

더 세부적인 설정이 필요하면 [디스플레이 모드](/ko/guides/display-modes/) 가이드에서 각 모드의 상세 위젯 구성을 확인하세요.
