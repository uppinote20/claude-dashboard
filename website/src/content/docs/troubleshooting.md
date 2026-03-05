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

2. **settings.json 확인**: `~/.claude/settings.json` 파일에 `statusLine` 설정이 있는지 확인합니다. 없다면 setup 커맨드를 다시 실행하세요:
   ```
   /claude-dashboard:setup
   ```

3. **Claude Code 재시작**: 설정 변경 후에는 Claude Code를 재시작해야 합니다.

4. **경로 업데이트**: 플러그인 업데이트 후 경로가 변경되었을 수 있습니다. 다음 커맨드를 실행하세요:
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

Codex, Gemini, z.ai 위젯은 해당 CLI가 설치되어 있을 때만 표시됩니다:

- **Codex**: `~/.codex/auth.json` 파일이 필요합니다. Codex CLI를 설치하고 인증을 완료하세요.
- **Gemini**: `~/.gemini/oauth_creds.json` 파일이 필요합니다. Gemini CLI를 설치하고 인증을 완료하세요.
- **z.ai**: `ANTHROPIC_BASE_URL` 환경 변수를 통해 z.ai가 감지되어야 합니다.

해당 파일이나 설정이 없으면 관련 위젯은 자동으로 숨겨지며, 오류가 발생하지 않습니다.

## 예산 위젯이 표시되지 않는 경우

`budget` 위젯은 설정 파일에 `"dailyBudget"` 값이 지정된 경우에만 활성화됩니다:

```json
{
  "dailyBudget": 15
}
```

## 플러그인 업데이트 후 문제

플러그인을 업데이트한 후 상태줄이 동작하지 않으면:

1. statusLine 경로를 업데이트합니다:
   ```
   /claude-dashboard:update
   ```

2. Claude Code를 재시작합니다.

3. 여전히 문제가 있으면 setup을 다시 실행합니다:
   ```
   /claude-dashboard:setup
   ```
