# Vercel 배포 가이드

claude-dashboard 문서 사이트를 Vercel에 배포하는 방법.

---

## Step 1: Vercel 계정 생성

1. **https://vercel.com** 접속
2. **"Sign Up"** 클릭
3. **"Continue with GitHub"** 선택 (GitHub 계정으로 로그인)
4. GitHub 권한 승인

---

## Step 2: 프로젝트 Import

1. Vercel 대시보드에서 **"Add New..." → "Project"** 클릭
2. **"Import Git Repository"** 섹션에서 `uppinote20/claude-dashboard` 레포를 찾기
   - 안 보이면 **"Adjust GitHub App Permissions"** 클릭 → 해당 레포 접근 허용
3. 레포 옆의 **"Import"** 클릭

---

## Step 3: 프로젝트 설정

Import 후 설정 화면이 나타남. 아래처럼 설정:

| 항목 | 값 |
|------|-----|
| **Project Name** | `claude-dashboard-docs` (원하는 이름) |
| **Framework Preset** | `Astro` (자동 감지될 수 있음) |
| **Root Directory** | **`website`** ← 반드시 변경! |
| Build Command | `npm run build` (기본값 유지) |
| Output Directory | `dist` (기본값 유지) |
| Install Command | `npm install` (기본값 유지) |

**Root Directory 변경 방법:**
- "Root Directory" 옆의 **"Edit"** 클릭
- `website` 입력
- 체크 표시 클릭

**"Deploy"** 버튼 클릭 → 첫 배포가 시작됨 (1-2분 소요)

---

## Step 4: 배포 확인

배포 완료 후 Vercel이 자동으로 URL을 부여함:
```
https://claude-dashboard-docs.vercel.app
```
이 URL로 접속해서 사이트가 정상 동작하는지 확인.

---

## Step 5: 커스텀 도메인 연결

1. Vercel 프로젝트 대시보드 → **"Settings"** 탭
2. 왼쪽 메뉴에서 **"Domains"** 클릭
3. 입력란에 **`claude-dashboard.uppinote.dev`** 입력
4. **"Add"** 클릭

Vercel이 DNS 설정 안내를 표시함 → Step 6으로.

---

## Step 6: DNS 설정 (uppinote.dev)

도메인 등록기관(Cloudflare, Namecheap 등)의 DNS 관리 페이지에서:

| 항목 | 값 |
|------|-----|
| **Type** | `CNAME` |
| **Name** | `claude-dashboard` |
| **Value** | `cname.vercel-dns.com` |
| **TTL** | Auto (또는 300) |

**Cloudflare 사용 시 주의:**
- Proxy 상태를 **"DNS only"** (회색 구름)로 설정
- 주황색 구름(Proxied)이면 SSL 인증서 충돌 가능

DNS 전파에 최대 몇 분~수 시간 소요. Vercel Domains 페이지에서 상태가 **"Valid Configuration"** 으로 바뀌면 완료.

---

## Step 7: Ignored Build Step 설정 (선택)

website/ 폴더가 변경되지 않았을 때 불필요한 빌드를 방지:

1. Vercel 프로젝트 **"Settings"** → **"Git"**
2. **"Ignored Build Step"** 섹션 찾기
3. **"Custom"** 선택
4. 다음 커맨드 입력:
   ```
   git diff HEAD^ HEAD --quiet -- website/
   ```
5. **"Save"** 클릭

이렇게 하면 `website/` 폴더에 변경이 있을 때만 빌드가 실행됨.

---

## Step 8: 최종 확인

- `https://claude-dashboard.uppinote.dev` 접속
- 한국어 랜딩 페이지 확인
- `/en/` 경로로 영어 전환 확인
- 사이드바 네비게이션 동작 확인
- 검색 (Cmd+K) 동작 확인

---

## 트러블슈팅

**빌드 실패 시:**
- Vercel 대시보드 → "Deployments" → 실패한 배포 클릭 → 로그 확인
- Root Directory가 `website`로 설정되었는지 재확인

**도메인 연결 안 될 때:**
- DNS 전파 대기 (최대 48시간, 보통 수 분)
- Vercel Domains 페이지에서 에러 메시지 확인
- CNAME 값이 정확히 `cname.vercel-dns.com`인지 확인

**404 에러 시:**
- Framework Preset이 `Astro`인지 확인
- Output Directory가 `dist`인지 확인
