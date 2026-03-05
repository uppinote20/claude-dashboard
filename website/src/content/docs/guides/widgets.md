---
title: 위젯
description: 사용 가능한 모든 위젯 목록
sidebar:
  order: 2
---

claude-dashboard는 28개 이상의 위젯을 제공합니다. 각 위젯은 독립적으로 데이터를 가져오고 렌더링하며, 데이터를 가져올 수 없는 경우 자동으로 숨겨집니다.

## Core

| 위젯 | ID | 설명 |
|------|-----|------|
| 모델 | `model` | 모델 이름과 이모지, Opus/Sonnet 노력 수준(H/M/L), Opus 빠른 모드(↯) |
| 컨텍스트 | `context` | 프로그레스 바, 백분율, 토큰 수 (🟢 0-50% / 🟡 51-80% / 🔴 81-100%) |
| 비용 | `cost` | 세션 비용 (USD) |
| 프로젝트 정보 | `projectInfo` | 디렉토리 + git 브랜치 + ahead/behind (↑↓) |

## Rate Limits

| 위젯 | ID | 설명 |
|------|-----|------|
| 5시간 제한 | `rateLimit5h` | 5시간 속도 제한 및 리셋 카운트다운 |
| 7일 제한 | `rateLimit7d` | 7일 속도 제한 (Max 전용) |
| 7일 Sonnet 제한 | `rateLimit7dSonnet` | 7일 Sonnet 제한 (Max 전용) |

## Session

| 위젯 | ID | 설명 |
|------|-----|------|
| 세션 ID | `sessionId` | 세션 ID (8자 축약) |
| 세션 ID (전체) | `sessionIdFull` | 세션 ID (전체 UUID) |
| 세션 시간 | `sessionDuration` | 세션 지속 시간 |
| 설정 카운트 | `configCounts` | CLAUDE.md, rules, MCPs, hooks 개수 |

## Activity

| 위젯 | ID | 설명 |
|------|-----|------|
| 도구 활동 | `toolActivity` | 실행 중/완료된 도구 |
| 에이전트 상태 | `agentStatus` | 서브에이전트 진행 상황 |
| TODO 진행률 | `todoProgress` | TODO 완료율 |

## Analytics

| 위젯 | ID | 설명 |
|------|-----|------|
| 번 레이트 | `burnRate` | 분당 토큰 소비량 |
| 캐시 히트율 | `cacheHit` | 캐시 히트율 백분율 |
| 고갈 시간 | `depletionTime` | 속도 제한 도달 예상 시간 (근사치)^1^ |

## Multi-CLI

| 위젯 | ID | 설명 |
|------|-----|------|
| Codex 사용량 | `codexUsage` | OpenAI Codex CLI 사용량 (미설치 시 자동 숨김)^2^ |
| Gemini 사용량 | `geminiUsage` | Google Gemini CLI - 현재 모델 (미설치 시 자동 숨김)^3^ |
| Gemini 전체 | `geminiUsageAll` | Google Gemini CLI - 전체 모델 (미설치 시 자동 숨김)^3^ |
| z.ai 사용량 | `zaiUsage` | z.ai/ZHIPU 사용량 (z.ai 미사용 시 자동 숨김)^4^ |

## Insights

| 위젯 | ID | 설명 |
|------|-----|------|
| 토큰 분석 | `tokenBreakdown` | 입력/출력/캐시 쓰기/캐시 읽기 토큰 분석 |
| 성능 배지 | `performance` | 복합 효율성 배지 (캐시 히트율 + 출력 비율) |
| 비용 예측 | `forecast` | 세션 속도 기반 시간당 예상 비용 |
| 예산 | `budget` | 일일 지출 vs 설정된 예산 한도^5^ |

## 참고 사항

1. 모든 사용량이 현재 세션에서 발생했다고 가정합니다. 세션이 길어질수록 정확도가 향상됩니다.
2. `~/.codex/auth.json`이 없으면 자동 숨김됩니다.
3. `~/.gemini/oauth_creds.json`이 없으면 자동 숨김됩니다.
4. `ANTHROPIC_BASE_URL`을 통해 z.ai가 감지되지 않으면 자동 숨김됩니다.
5. 설정 파일에 `"dailyBudget"` 값이 필요합니다.

## 다국어 지원

영어와 한국어를 지원하며, 시스템 언어를 자동 감지하거나 설정 시 직접 지정할 수 있습니다.
