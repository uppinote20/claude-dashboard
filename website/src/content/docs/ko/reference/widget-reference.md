---
title: 위젯 레퍼런스
description: 각 위젯의 상세 데이터 및 동작 설명
sidebar:
  order: 2
---

각 위젯의 데이터 소스, 표시 내용, 출력 예시를 상세하게 설명합니다.

## Core

### model

- **ID**: `model`
- **데이터 소스**: stdin (모델 정보) + settings
- **표시 내용**: 모델 이름과 이모지. Opus/Sonnet의 경우 노력 수준(H=high, M=medium, L=low)을 표시합니다. Opus에서 빠른 모드가 활성화되면 (↯) 기호를 추가합니다.
- **출력 예시**: `◆ Opus(H)`, `◆ Opus(H) ↯`, `◆ Sonnet(M)`, `◆ Haiku`

### context

- **ID**: `context`
- **데이터 소스**: stdin (context_window)
- **표시 내용**: 프로그레스 바와 백분율, 총 토큰 수. 사용률에 따라 색상이 변경됩니다.
  - 🟢 0-50%: 안전
  - 🟡 51-80%: 주의
  - 🔴 81-100%: 위험
- **출력 예시**: `██████░░░░ 58% 120K`

### cost

- **ID**: `cost`
- **데이터 소스**: stdin (cost)
- **표시 내용**: 현재 세션의 누적 비용을 USD로 표시합니다.
- **출력 예시**: `$1.25`, `$0.03`

### projectInfo

- **ID**: `projectInfo`
- **데이터 소스**: stdin (workspace) + git
- **표시 내용**: 현재 작업 디렉토리 이름, git 브랜치 (remote 설정 시 OSC8 클릭 가능 링크), upstream 대비 ahead/behind 커밋 수. CWD가 프로젝트 루트와 다르면 하위 경로를 표시하고, worktree 세션에서는 worktree 표시기를 보여줍니다.
- **출력 예시**: `📁 my-project (main)`, `📁 dashboard (feat/widgets ↑3)`, `📁 api (main ↑2↓1)`, `📁 project (src/components) (main)`, `📁 project (main) 🌳 wt:feature-branch`

## Rate Limits

### rateLimit5h

- **ID**: `rateLimit5h`
- **데이터 소스**: API (OAuth usage 엔드포인트)
- **표시 내용**: 5시간 속도 제한 사용률. 리셋까지 남은 시간을 카운트다운으로 표시합니다. API 오류 시 경고 기호를 표시합니다.
- **출력 예시**: `5h: 42%`, `5h: 85% ⏱2h15m`, `5h: ⚠️`

### rateLimit7d

- **ID**: `rateLimit7d`
- **데이터 소스**: API (OAuth usage 엔드포인트)
- **표시 내용**: 7일 전체 모델 속도 제한. Max 플랜에서만 표시됩니다.
- **출력 예시**: `7d: 69%`, `7d: 92% ⏱3d`

### rateLimit7dSonnet

- **ID**: `rateLimit7dSonnet`
- **데이터 소스**: API (OAuth usage 엔드포인트)
- **표시 내용**: 7일 Sonnet 모델 속도 제한. Max 플랜에서만 표시됩니다.
- **출력 예시**: `7dS: 55%`

## Session

### sessionId

- **ID**: `sessionId`
- **데이터 소스**: stdin (session_id)
- **표시 내용**: 현재 세션 ID의 앞 8자를 표시합니다.
- **출력 예시**: `🔑 a1b2c3d4`

### sessionIdFull

- **ID**: `sessionIdFull`
- **데이터 소스**: stdin (session_id)
- **표시 내용**: 현재 세션의 전체 UUID를 표시합니다.
- **출력 예시**: `🔑 a1b2c3d4-e5f6-7890-abcd-ef1234567890`

### sessionName

- **ID**: `sessionName`
- **데이터 소스**: transcript (JSONL)
- **표시 내용**: /rename 명령으로 설정된 세션 이름. 세션 이름이 없으면 위젯이 숨겨집니다.
- **출력 예시**: `» feature-auth`, `» bug-fix-login`

### sessionDuration

- **ID**: `sessionDuration`
- **데이터 소스**: 파일 (세션 시작 시간 저장)
- **표시 내용**: 현재 세션이 시작된 이후 경과 시간.
- **출력 예시**: `⏱ 45m`, `⏱ 1h30m`, `⏱ 5m`

### lastPrompt

- **ID**: `lastPrompt`
- **데이터 소스**: transcript (JSONL)
- **표시 내용**: 현재 세션의 마지막 사용자 프롬프트를 타임스탬프와 함께 표시합니다. 세션 컨텍스트를 빠르게 파악할 수 있습니다. 프롬프트가 없으면 위젯이 숨겨집니다.
- **출력 예시**: `💬 14:32 미들웨어 인증 버그 수정해줘`, `▸ 09:15 API 클라이언트 유닛 테스트 추가`

### configCounts

- **ID**: `configCounts`
- **데이터 소스**: 파일시스템
- **표시 내용**: 프로젝트에 설정된 CLAUDE.md 파일 수, AGENTS.md 파일 수, 규칙 수, MCP 서버 수, 훅 수, 추가 디렉토리 수.
- **출력 예시**: `CLAUDE.md: 2 │ AGENTS.md: 1 │ Rules: 3 │ MCPs: 1 │ Hooks: 2 │ +Dirs: 2`

## Activity

### toolActivity

- **ID**: `toolActivity`
- **데이터 소스**: transcript (JSONL)
- **표시 내용**: 현재 실행 중인 도구와 완료된 도구의 수. 실행 중인 도구는 대상(파일 경로, 명령어 등)과 함께 표시됩니다.
- **출력 예시**: `⚙️ 12 done`, `⚙️ Read(app.ts) (8 done)`, `⚙️ Read(app.ts), Bash(npm test) (12 done)`

### agentStatus

- **ID**: `agentStatus`
- **데이터 소스**: transcript (JSONL)
- **표시 내용**: 활성 서브에이전트 수와 완료된 에이전트 수.
- **출력 예시**: `🤖 Agent: 1 active ▸ 3 done`, `🤖 Agent: 2 done`

### todoProgress

- **ID**: `todoProgress`
- **데이터 소스**: transcript (JSONL)
- **표시 내용**: TODO 목록의 완료율. 현재 진행 중인 항목이 있으면 함께 표시합니다.
- **출력 예시**: `✓ 3/5`, `✓ 10/10 ✅`

## Analytics

### burnRate

- **ID**: `burnRate`
- **데이터 소스**: stdin (토큰) + session (경과 시간)
- **표시 내용**: 분당 토큰 소비량 (세션 평균).
- **출력 예시**: `🔥 5K/m`, `🔥 12K/m`

### tokenSpeed

- **ID**: `tokenSpeed`
- **데이터 소스**: stdin
- **표시 내용**: 출력 토큰 생성 속도. 초당 생성되는 토큰 수를 표시합니다.
- **출력 예시**: `⚡ 67 tok/s`, `⚡ 120 tok/s`

### cacheHit

- **ID**: `cacheHit`
- **데이터 소스**: stdin (cache_read_input_tokens, 전체 입력)
- **표시 내용**: 캐시에서 제공된 토큰의 비율. 높을수록 효율적입니다.
- **출력 예시**: `📦 85%`, `📦 42%`

### depletionTime

- **ID**: `depletionTime`
- **데이터 소스**: API (속도 제한) + session (경과 시간)
- **표시 내용**: 현재 소비 속도를 기준으로 속도 제한에 도달할 때까지 남은 예상 시간. 어떤 제한(5시간/7일)에 먼저 도달하는지도 표시합니다.
- **출력 예시**: `⏳ 2h (5h)`, `⏳ 45m (7d)`

## Multi-CLI

### codexUsage

- **ID**: `codexUsage`
- **데이터 소스**: Codex API (ChatGPT 백엔드)
- **표시 내용**: OpenAI Codex CLI의 모델명과 5시간/7일 사용률. `~/.codex/auth.json`이 없으면 자동 숨김됩니다.
- **출력 예시**: `🔷 codex o4-mini 5h:30% 7d:15%`

### geminiUsage

- **ID**: `geminiUsage`
- **데이터 소스**: Gemini API (Google Code Assist)
- **표시 내용**: Google Gemini CLI의 현재 모델 사용률. `~/.gemini/oauth_creds.json`이 없으면 자동 숨김됩니다.
- **출력 예시**: `💎 gemini 2.5-pro 45%`

### geminiUsageAll

- **ID**: `geminiUsageAll`
- **데이터 소스**: Gemini API (Google Code Assist)
- **표시 내용**: Google Gemini CLI의 모든 모델 버킷 사용률. `~/.gemini/oauth_creds.json`이 없으면 자동 숨김됩니다.
- **출력 예시**: `💎 2.5-pro:45% 2.5-flash:20%`

### zaiUsage

- **ID**: `zaiUsage`
- **데이터 소스**: z.ai API
- **표시 내용**: z.ai/ZHIPU GLM의 5시간 토큰 사용률과 월간 MCP 사용률. `ANTHROPIC_BASE_URL`을 통해 z.ai가 감지되지 않으면 자동 숨김됩니다.
- **출력 예시**: `🟢 GLM 5h:25% 1m:10%`

## Insights

### tokenBreakdown

- **ID**: `tokenBreakdown`
- **데이터 소스**: stdin (current_usage)
- **표시 내용**: 입력/출력/캐시 쓰기/캐시 읽기 토큰의 세부 분석.
- **출력 예시**: `📊 In 30K · Out 8K · CW 5K · CR 25K`

### performance

- **ID**: `performance`
- **데이터 소스**: stdin (토큰) + session (경과 시간)
- **표시 내용**: 캐시 히트율과 출력 비율을 조합한 복합 효율성 점수 (0-100).
- **출력 예시**: `🟢 72%`, `🟡 55%`, `🔴 30%`

### forecast

- **ID**: `forecast`
- **데이터 소스**: stdin (비용) + session (경과 시간)
- **표시 내용**: 세션의 현재 소비 속도를 기반으로 추정한 시간당 비용.
- **출력 예시**: `📈 ~$8/h`, `📈 ~$2/h`

### budget

- **ID**: `budget`
- **데이터 소스**: stdin (비용) + 파일 (예산 설정)
- **표시 내용**: 오늘의 누적 지출과 설정된 일일 예산 한도. 설정 파일에 `"dailyBudget"` 값이 필요합니다.
  - 80% 소진 시 경고 표시
  - 95% 소진 시 위험 표시
- **출력 예시**: `💵 $5/$15`, `💵 $14/$15 ⚠️`, `💵 $15/$15 🚨`

### todayCost

- **ID**: `todayCost`
- **데이터 소스**: stdin (비용) + 파일 (일일 비용 기록)
- **표시 내용**: 오늘 전체 세션의 누적 비용을 표시합니다.
- **출력 예시**: `💰 오늘: $4.83`, `💰 오늘: $12.50`

## Info

### version

- **ID**: `version`
- **데이터 소스**: stdin (version)
- **표시 내용**: Claude Code 버전. stdin에 버전 정보가 없으면 위젯이 숨겨집니다.
- **출력 예시**: `v1.0.80`

### linesChanged

- **ID**: `linesChanged`
- **데이터 소스**: git (`git diff HEAD --shortstat` + `git ls-files --others`)
- **표시 내용**: 커밋되지 않은 추가/삭제된 줄 수 (untracked 신규 파일 포함). 커밋하면 자연스럽게 리셋. 변경이 없으면 위젯이 숨겨집니다.
- **출력 예시**: `+156 -23`, `+42`, `-15`

### outputStyle

- **ID**: `outputStyle`
- **데이터 소스**: stdin (output_style)
- **표시 내용**: 현재 출력 스타일 이름. "default"이거나 설정되지 않은 경우 위젯이 숨겨집니다.
- **출력 예시**: `concise`, `verbose`

### vimMode

- **ID**: `vimMode`
- **데이터 소스**: stdin (vim.mode)
- **표시 내용**: 현재 vim 모드 (NORMAL 또는 INSERT). vim 모드가 비활성화되면 숨겨집니다.
- **프리셋 문자**: `m`
- **출력 예시**: `NORMAL`, `INSERT`

### apiDuration

- **ID**: `apiDuration`
- **데이터 소스**: stdin (cost.total_duration_ms, cost.total_api_duration_ms)
- **표시 내용**: 세션 시간 중 API 응답 대기에 사용된 비율. 세션이 API 바운드인지 도구 실행 바운드인지 파악에 유용합니다.
- **프리셋 문자**: `a`
- **출력 예시**: `API 45%`, `API 72%`
