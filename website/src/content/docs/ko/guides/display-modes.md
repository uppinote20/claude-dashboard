---
title: 디스플레이 모드
description: compact, normal, detailed 모드 설명
sidebar:
  order: 1
---

claude-dashboard는 세 가지 프리셋 디스플레이 모드와 커스텀 모드를 제공합니다. 각 모드는 이전 모드에 줄을 추가하는 방식(additive)으로 구성되어 있어, 위젯의 위치가 모드 간에 일관되게 유지됩니다.

## Compact (1줄, 기본값)

핵심 지표만 한 줄로 표시합니다.

```
/claude-dashboard:setup compact
```

**포함 위젯:** model, context, cost, rateLimit5h, rateLimit7d, rateLimit7dSonnet, zaiUsage

> `peakHours`는 detailed 모드(5줄)에서만 기본 포함됩니다. 프리셋 단축키(`p`)로 다른 모드에도 추가할 수 있습니다.

```
◆ Opus(H) │ ██░░ 80% │ $1.25 │ 5h: 42% │ 7d: 69%
```

> `rateLimit*` 위젯과 `zaiUsage` 위젯은 프로바이더에 따라 자동으로 표시됩니다 (상호 배타적).

## Normal (2줄)

Compact의 모든 위젯에 프로젝트 정보와 세션 관련 위젯을 추가합니다.

```
/claude-dashboard:setup normal
```

**1줄:** model, context, cost, rateLimit5h, rateLimit7d, rateLimit7dSonnet, zaiUsage<br/>
**2줄:** projectInfo, sessionId, sessionDuration, burnRate, todoProgress

```
◆ Opus(H) │ ██░░ 80% │ $1.25 │ 5h: 42% │ 7d: 69%
📁 project (main ↑3) │ 🔑 abc123 │ ⏱ 45m │ 🔥 5K/m │ ✓ 3/5
```

## Detailed (6줄)

모든 위젯을 포함하는 전체 대시보드입니다.

```
/claude-dashboard:setup detailed
```

**1줄:** model, context, cost, rateLimit5h, rateLimit7d, rateLimit7dSonnet, zaiUsage<br/>
**2줄:** projectInfo, sessionName, sessionId, sessionDuration, burnRate, tokenSpeed, depletionTime, todoProgress<br/>
**3줄:** configCounts, toolActivity, agentStatus, cacheHit, performance<br/>
**4줄:** tokenBreakdown, forecast, budget, todayCost<br/>
**5줄:** codexUsage, geminiUsage, linesChanged, outputStyle, version, peakHours<br/>
**6줄:** lastPrompt

```
◆ Opus(H) │ ██░░ 80% │ $1.25 │ 5h: 42% │ 7d: 69%
📁 project (main ↑3) │ » feature-auth │ 🔑 abc123 │ ⏱ 45m │ 🔥 5K/m │ ⚡ 67 tok/s │ ⏳ 2h │ ✓ 3/5
CLAUDE.md: 2 │ ⚙️ Read(app.ts) (12 done) │ 🤖 Agent: 1 │ 📦 85% │ 🟢 72%
📊 In 30K · Out 8K │ 📈 ~$8/h │ 💵 $5/$15 │ 💰 오늘: $4.83
🔷 codex │ 💎 gemini │ +156 -23 │ concise │ v1.0.80 │ 비피크 (23h9m)
💬 14:32 미들웨어 인증 버그 수정해줘
```

## Custom (사용자 정의)

위젯의 순서와 줄 구성을 직접 제어할 수 있습니다.

```bash
/claude-dashboard:setup custom auto max "model,context,cost|projectInfo,todoProgress"
```

`|`로 줄을 구분하고, 쉼표로 위젯을 나열합니다. 사용 가능한 위젯은 [위젯](/ko/guides/widgets/) 페이지를 참고하세요.

## 언어 및 플랜 설정

모든 모드에서 언어와 플랜을 지정할 수 있습니다:

```bash
/claude-dashboard:setup compact en pro    # 영어, Pro 플랜
/claude-dashboard:setup normal ko max     # 한국어, Max 플랜
/claude-dashboard:setup detailed          # 자동 언어, 기본 Max 플랜
```

## 멀티 프로바이더 지원

z.ai/ZHIPU, Codex, Gemini가 설치되어 있으면 자동으로 감지되어 해당 위젯이 표시됩니다. `rateLimit*` 위젯과 `zaiUsage` 위젯은 현재 프로바이더에 따라 상호 배타적으로 동작합니다.
