---
title: 문제 해결
description: 자주 묻는 문제와 해결 방법
sidebar:
  label: 문제 해결
---

claude-dashboard 사용 중 발생할 수 있는 문제와 해결 방법을 안내합니다.

## 상태줄이 표시되지 않는 경우

상태줄이 나타나지 않을 때 다음을 확인하세요:

1. **플러그인 설치 확인**: Claude Code에서 `/plugin list`를 실행하여 claude-dashboard가 설치되어 있는지 확인합니다.

2. **settings.json 확인**: `~/.claude/settings.json` 파일의 `statusLine` 항목이
   `plugins/data/claude-dashboard-claude-dashboard/statusline.mjs` 경로를 가리키는지 확인합니다.
   없다면 setup 커맨드를 다시 실행하세요:
   ```
   /claude-dashboard:setup
   ```

3. **Claude Code 재시작**: 그래도 표시되지 않는다면 Claude Code를 재시작해 보세요.

4. **자동 갱신 확인**: 플러그인을 업데이트해도 보통 별도 조치가 필요 없습니다 — `SessionStart` 훅이
   매번 최신 설치 버전을 가리키도록 statusLine 경로를 자동으로 갱신합니다. 훅을 비활성화했거나
   재시작 후에도 갱신되지 않는다면 다음 커맨드로 직접 복구하세요:
   ```
   /claude-dashboard:update
   ```

## 속도 제한에 경고 기호 표시

속도 제한 위젯에 `⚠️`가 표시되는 경우:

1. **API 토큰 만료**: Claude Code에 다시 로그인하세요. OAuth 토큰이 만료되었을 수 있습니다.

2. **네트워크 문제**: 인터넷 연결을 확인하세요. API 서버에 접근할 수 없는 경우 경고가 표시됩니다.

3. **API 속도 제한**: API 자체의 요청 제한에 걸린 경우입니다. 60초 후 캐시가 갱신되면 정상으로 돌아옵니다.

## 언어가 잘못 설정된 경우

시스템 언어 자동 감지가 원하는 대로 동작하지 않을 때, setup 커맨드에서 언어를 직접 지정하세요:

```
# 한국어로 설정
/claude-dashboard:setup normal ko

# 영어로 설정
/claude-dashboard:setup normal en
```

또는 설정 파일(`~/.claude/claude-dashboard.local.json`)을 직접 수정할 수 있습니다:

```json
{
  "language": "ko"
}
```

## 캐시 문제

API 응답이 오래된 데이터를 표시하거나, 비정상적인 값이 보이는 경우 캐시를 삭제하세요.

캐시 파일 위치: `~/.cache/claude-dashboard/`

```bash
rm -rf ~/.cache/claude-dashboard/
```

캐시 파일은 1시간 후 자동으로 정리됩니다. 수동 삭제 후 다음 상태줄 갱신 시 새로운 데이터를 가져옵니다.

## 멀티 CLI 위젯이 표시되지 않는 경우

Codex, Gemini, Antigravity, z.ai 위젯은 해당 CLI가 설치되어 있을 때만 표시됩니다:

- **Codex**: `~/.codex/auth.json` 파일이 필요합니다. Codex CLI를 설치하고 인증을 완료하세요.
- **Gemini**: `~/.gemini/oauth_creds.json` 파일이 필요합니다. Gemini CLI를 설치하고 인증을 완료하세요.
- **Antigravity**: `~/.gemini/antigravity-cli/antigravity-oauth-token` 파일이 없으면 자동 숨김됩니다. Antigravity CLI를 설치하고 인증을 완료하세요.
- **z.ai**: `ANTHROPIC_BASE_URL` 환경 변수를 통해 z.ai가 감지되어야 합니다.

해당 파일이나 설정이 없으면 관련 위젯은 자동으로 숨겨지며, 오류가 발생하지 않습니다.

## 예산 위젯이 표시되지 않는 경우

`budget` 위젯은 설정 파일에 `"dailyBudget"` 값이 지정된 경우에만 활성화됩니다:

```json
{
  "dailyBudget": 15
}
```

## 플러그인 업데이트 후 상태줄이 갱신되지 않는 경우

일반적으로는 아무 조치도 필요 없습니다. `statusLine`은 매 렌더링마다 최신 설치 버전을 자동으로
찾아내는 고정 shim 경로(`plugins/data/claude-dashboard-claude-dashboard/statusline.mjs`)를
가리키므로, `/plugin update`만으로 충분합니다.

그래도 이전 버전이 표시된다면 Claude Code를 한 번 재시작하세요 — `SessionStart` 훅이 shim을
설치하고 `settings.json`을 자동으로 마이그레이션하며, 이 과정은 한 번만 실행되면 됩니다.
재시작 후에도 문제가 지속되면 다음 커맨드로 직접 복구합니다 (훅을 비활성화한 경우에도 이
방법을 사용하세요):

```
/claude-dashboard:update
```

이 마이그레이션이 처음 실행될 때 `settings.json` 옆에 `settings.json.bak` 백업 파일을 한 번
생성합니다. 마이그레이션 이전 값으로 되돌려야 할 때 이 파일을 사용할 수 있습니다.

shim은 항상 설치된 것 중 최신 버전을 사용하므로, 최신 버전의 캐시 디렉터리가 남아 있으면 이전
버전을 설치해도 효과가 없습니다. 이전 빌드를 일부러 테스트하려면
`plugins/cache/claude-dashboard/claude-dashboard/` 아래의 최신 버전 디렉터리를 삭제하세요.

여전히 문제가 있으면 setup을 다시 실행합니다:
```
/claude-dashboard:setup
```
