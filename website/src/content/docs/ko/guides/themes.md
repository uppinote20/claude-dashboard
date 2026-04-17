---
title: 테마
description: 9가지 색상 테마 설정
sidebar:
  order: 3
---

claude-dashboard는 9가지 색상 테마를 제공합니다. 테마는 `getTheme()` 함수의 시맨틱 역할을 통해 위젯 색상을 결정합니다.

## 사용 가능한 테마

| 테마 | 스타일 |
|------|--------|
| `default` | 파스텔 색상 (cyan, yellow, pink, green) |
| `minimal` | 모노크롬 (white + gray) |
| `catppuccin` | Catppuccin Mocha 팔레트 |
| `catppuccinLatte` | Catppuccin Latte 팔레트 (라이트 모드 터미널용) |
| `dracula` | Dracula 팔레트 |
| `gruvbox` | Gruvbox 팔레트 |
| `nord` | Nord polar night/frost 팔레트 |
| `tokyoNight` | Tokyo Night blue/purple 팔레트 |
| `solarized` | Solarized dark 팔레트 |

### 테마별 미리보기

각 테마의 실제 색상으로 렌더링한 compact 모드 예시입니다.

**default** — 파스텔 색상
<div style="background:#1e1e2e; padding:8px 12px; border-radius:6px; font-family:monospace; font-size:14px; margin-bottom:8px"><span style="color:#87d7ff">◆ Opus(X)</span> <span style="color:#808080">│</span> <span style="color:#afd7af">██░░ 45%</span> <span style="color:#808080">│</span> <span style="color:#ffd787">$1.25</span> <span style="color:#808080">│</span> <span style="color:#afd7af">5h: 42%</span> <span style="color:#808080">│</span> <span style="color:#ffd787">7d: 69%</span></div>

**minimal** — 모노크롬
<div style="background:#1e1e2e; padding:8px 12px; border-radius:6px; font-family:monospace; font-size:14px; margin-bottom:8px"><span style="color:#ffffff">◆ Opus(X)</span> <span style="color:#808080">│</span> <span style="color:#808080">██░░ 45%</span> <span style="color:#808080">│</span> <span style="color:#ffffff">$1.25</span> <span style="color:#808080">│</span> <span style="color:#808080">5h: 42%</span> <span style="color:#808080">│</span> <span style="color:#ffffff">7d: 69%</span></div>

**catppuccin** — Catppuccin Mocha
<div style="background:#1e1e2e; padding:8px 12px; border-radius:6px; font-family:monospace; font-size:14px; margin-bottom:8px"><span style="color:#89b4fa">◆ Opus(X)</span> <span style="color:#6c7086">│</span> <span style="color:#a6e3a1">██░░ 45%</span> <span style="color:#6c7086">│</span> <span style="color:#f9e2af">$1.25</span> <span style="color:#6c7086">│</span> <span style="color:#a6e3a1">5h: 42%</span> <span style="color:#6c7086">│</span> <span style="color:#fab387">7d: 69%</span></div>

**catppuccinLatte** — Catppuccin Latte (라이트 모드 터미널용)
<div style="background:#eff1f5; padding:8px 12px; border-radius:6px; font-family:monospace; font-size:14px; margin-bottom:8px"><span style="color:#1e66f5">◆ Opus(X)</span> <span style="color:#8c8fa1">│</span> <span style="color:#40a02b">██░░ 45%</span> <span style="color:#8c8fa1">│</span> <span style="color:#fe640b">$1.25</span> <span style="color:#8c8fa1">│</span> <span style="color:#40a02b">5h: 42%</span> <span style="color:#8c8fa1">│</span> <span style="color:#fe640b">7d: 69%</span></div>

**dracula** — Dracula
<div style="background:#1e1e2e; padding:8px 12px; border-radius:6px; font-family:monospace; font-size:14px; margin-bottom:8px"><span style="color:#bd93f9">◆ Opus(X)</span> <span style="color:#6272a4">│</span> <span style="color:#50fa7b">██░░ 45%</span> <span style="color:#6272a4">│</span> <span style="color:#ffb86c">$1.25</span> <span style="color:#6272a4">│</span> <span style="color:#50fa7b">5h: 42%</span> <span style="color:#6272a4">│</span> <span style="color:#f1fa8c">7d: 69%</span></div>

**gruvbox** — Gruvbox
<div style="background:#1e1e2e; padding:8px 12px; border-radius:6px; font-family:monospace; font-size:14px; margin-bottom:8px"><span style="color:#d79921">◆ Opus(X)</span> <span style="color:#928374">│</span> <span style="color:#b8bb26">██░░ 45%</span> <span style="color:#928374">│</span> <span style="color:#fabd2f">$1.25</span> <span style="color:#928374">│</span> <span style="color:#b8bb26">5h: 42%</span> <span style="color:#928374">│</span> <span style="color:#fabd2f">7d: 69%</span></div>

**nord** — Nord
<div style="background:#1e1e2e; padding:8px 12px; border-radius:6px; font-family:monospace; font-size:14px; margin-bottom:8px"><span style="color:#88c0d0">◆ Opus(X)</span> <span style="color:#4c566a">│</span> <span style="color:#a3be8c">██░░ 45%</span> <span style="color:#4c566a">│</span> <span style="color:#ebcb8b">$1.25</span> <span style="color:#4c566a">│</span> <span style="color:#a3be8c">5h: 42%</span> <span style="color:#4c566a">│</span> <span style="color:#ebcb8b">7d: 69%</span></div>

**tokyoNight** — Tokyo Night
<div style="background:#1a1b26; padding:8px 12px; border-radius:6px; font-family:monospace; font-size:14px; margin-bottom:8px"><span style="color:#7aa2f7">◆ Opus(X)</span> <span style="color:#565f89">│</span> <span style="color:#9ece6a">██░░ 45%</span> <span style="color:#565f89">│</span> <span style="color:#e0af68">$1.25</span> <span style="color:#565f89">│</span> <span style="color:#9ece6a">5h: 42%</span> <span style="color:#565f89">│</span> <span style="color:#e0af68">7d: 69%</span></div>

**solarized** — Solarized Dark
<div style="background:#1e1e2e; padding:8px 12px; border-radius:6px; font-family:monospace; font-size:14px; margin-bottom:8px"><span style="color:#268bd2">◆ Opus(X)</span> <span style="color:#586e75">│</span> <span style="color:#859900">██░░ 45%</span> <span style="color:#586e75">│</span> <span style="color:#b58900">$1.25</span> <span style="color:#586e75">│</span> <span style="color:#859900">5h: 42%</span> <span style="color:#586e75">│</span> <span style="color:#b58900">7d: 69%</span></div>

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

### 구분선 스타일 미리보기

<div style="background:#1a1b26; padding:8px 12px; border-radius:6px; font-family:monospace; font-size:14px; margin-bottom:8px"><span style="color:#7aa2f7">◆ Opus(X)</span> <span style="color:#565f89">│</span> <span style="color:#9ece6a">██░░ 45%</span> <span style="color:#565f89">│</span> <span style="color:#e0af68">$1.25</span> <span style="color:#565f89">│</span> <span style="color:#9ece6a">5h: 42%</span>  <span style="color:#565f89; font-size:12px">pipe (기본값)</span></div>

<div style="background:#1a1b26; padding:8px 12px; border-radius:6px; font-family:monospace; font-size:14px; margin-bottom:8px"><span style="color:#7aa2f7">◆ Opus(X)</span>  <span style="color:#9ece6a">██░░ 45%</span>  <span style="color:#e0af68">$1.25</span>  <span style="color:#9ece6a">5h: 42%</span>  <span style="color:#565f89; font-size:12px">space</span></div>

<div style="background:#1a1b26; padding:8px 12px; border-radius:6px; font-family:monospace; font-size:14px; margin-bottom:8px"><span style="color:#7aa2f7">◆ Opus(X)</span> <span style="color:#565f89">·</span> <span style="color:#9ece6a">██░░ 45%</span> <span style="color:#565f89">·</span> <span style="color:#e0af68">$1.25</span> <span style="color:#565f89">·</span> <span style="color:#9ece6a">5h: 42%</span>  <span style="color:#565f89; font-size:12px">dot</span></div>

<div style="background:#1a1b26; padding:8px 12px; border-radius:6px; font-family:monospace; font-size:14px; margin-bottom:8px"><span style="color:#7aa2f7">◆ Opus(X)</span> <span style="color:#565f89">›</span> <span style="color:#9ece6a">██░░ 45%</span> <span style="color:#565f89">›</span> <span style="color:#e0af68">$1.25</span> <span style="color:#565f89">›</span> <span style="color:#9ece6a">5h: 42%</span>  <span style="color:#565f89; font-size:12px">arrow</span></div>

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
    "ttlSeconds": 300
  }
}
```
