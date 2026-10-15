---
title: Mod (패널 & 밴드)
description: Claude Code mod로 대시보드를 패널 또는 프롬프트 위 밴드로 표시
sidebar:
  order: 6
---

claude-dashboard는 Claude Code **mod**(function-hook 플러그인, 얼리 액세스, Claude Code 2.1.289에서 확인)로도 제공됩니다. 같은 플러그인 안에 `hooks/hooks.json`(`"modules": ["../dist/mod.js"]`)으로 포함되어 있어 따로 설치할 것이 없습니다.

mod는 터미널과 데스크톱 Code 탭에서만 표시됩니다. VS Code 패널이나 `claude -p`에서는 나타나지 않습니다.

## 명령어

| 명령어 | 동작 |
|--------|------|
| `/claude-dashboard-pane [on\|off\|dashboard\|turns\|agents\|files\|todos\|errors\|bg]` | 대화 기록 옆에 패널을 열거나 닫습니다(인자가 없으면 현재 상태 반대로, 마지막 뷰 유지). 뷰 이름을 주면 해당 뷰로 패널을 열고, 이미 열려 있으면 그 자리에서 전환합니다. 기본 뷰 `dashboard`는 `modPane` 레이아웃(기본값 `detailed`)을 씁니다. |
| `/claude-dashboard-band [on\|off]` | 프롬프트 위에 대시보드를 표시하고 **현재 세션에서만** statusLine을 숨깁니다. 레이아웃은 `modBand`(기본값: statusLine 레이아웃)를 따릅니다. |

`/claude-dashboard-band`는 `settings.json`을 수정하지 않으며 현재 세션에만 적용됩니다.

### 패널 뷰

| 뷰 | 표시 내용 |
|----|-----------|
| `dashboard` | `modPane` 레이아웃의 위젯 (기본 뷰, 60초마다 갱신) |
| `turns` | 사용자 프롬프트당 한 줄, 최신순(최근 20개): `#N HH:MM 프롬프트 경과시간 ↑입력 ↓출력 🔧도구 🤖에이전트`. 헤더에 턴별 토큰 스파크라인이 표시됩니다. 슬래시 명령은 `/name args`, 셸 입력은 `!cmd`로 표시하며 스킬 본문, 작업 알림, 명령 출력은 제외합니다. 금액($)이 아닌 토큰 기준 |
| `agents` | 이 세션의 서브에이전트(최근 활동 20개): 타입, 실제 모델, 설명, 경과 시간, 도구 호출 수, 현재 실행 중인 도구. 실행 중이 먼저, `✓`는 완료, `? stale`은 실행 중이지만 10분간 트랜스크립트 기록이 없는 상태 |
| `files` | 이 세션에서 Edit/Write/MultiEdit/NotebookEdit로 수정한 파일(성공한 결과만, 메인 + 서브에이전트): 프로젝트 기준 상대 경로, 횟수, 출처(`main`, `+N agents`). 최대 30개 |
| `todos` | TodoWrite / Tasks 전체 목록 (✓ / ▶ / ○) |
| `errors` | 실패한 도구 호출, 최신순(15개): 시각, `tool(target)`, 에러 첫 줄. 권한 거부·차단은 🚫 |
| `bg` | `run_in_background` Bash 작업과 비동기 에이전트(시작부터 완료 알림까지). 실행 중이 먼저, 세션이 10분간 유휴인데 완료 알림이 없으면 `? stale` |

선택한 뷰는 해당 세션에서만 유지되며(새 세션은 `dashboard`로 시작) `dashboard` 외의 뷰는 10초마다, 그리고 세션 측정 때마다 갱신됩니다. 포함되지 않는 것: 에이전트 팀/팀원, 데스크톱 앱의 plan 도구, 턴별 $ 비용, 클릭 이동.

## 설정

```json
{
  "modPane": "detailed",
  "modBand": "MC$R|BDO",
  "modBandDefault": true
}
```

- `modPane`, `modBand`에는 디스플레이 모드 이름(`compact`, `normal`, `detailed`), `"MC$R|BDO"` 같은 프리셋 문자열, 또는 `[["model", "context"], ["sessionIdFull"]]` 같은 위젯 배열을 지정할 수 있습니다. 배열은 statusLine의 `lines`와 같은 형식이라 프리셋 문자가 없는 위젯도 넣을 수 있습니다. 알 수 없는 위젯 ID는 무시되고, 남는 위젯이 없으면 기본값을 씁니다.
- `"modBandDefault": true`로 설정하면 세션 시작 시 밴드가 자동으로 켜집니다.
- 대화형 `/claude-dashboard:setup`이 mod 대시보드 사용 방식(statusLine만 / pane으로 엿보기 / band로 대체 / 둘 다)을 묻고 이 키들을 대신 써 줍니다. setup을 다시 실행해도 묻지 않은 키는 유지됩니다.
- 테마, 언어, `disabledWidgets`는 일반 설정을 그대로 따릅니다.
- `cacheHit`, `tokenBreakdown`, `performance`는 mod API에 요청별 캐시 사용량이 없어 패널과 밴드에서 숨겨집니다.

## statusLine이 숨겨지는 방식

밴드가 켜져 있는 동안 세션별 하트비트 마커(`~/.cache/claude-dashboard/band-<sessionId>`)를 기록합니다. 마커는 렌더링할 때마다(최대 60초 간격) 갱신되며 180초가 지나면 무시됩니다. `/claude-dashboard-band off`를 실행하거나 세션이 끝나면 삭제됩니다. 따라서 모드가 어떤 이유로든 멈추더라도 3분 이내에 statusLine이 자동으로 돌아옵니다.

## 데이터 출처

패널과 밴드는 mod API(Claude Code가 전달하는 컨텍스트, 속도 제한, 비용)와, 변경 없이 서브프로세스로 실행되는 렌더러 `dist/index.js`를 함께 사용합니다.
