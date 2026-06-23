# Trailweight — 클라우드 동기화 + 웹 배포 가이드

디자이너용으로 최대한 쉽게 적었습니다. 순서대로 따라오시면 돼요.
모든 서비스는 **무료 요금제**로 충분합니다.

---

## 1단계. Supabase (클라우드 + 로그인)

기기 간 데이터 동기화를 담당합니다.

1. https://supabase.com → **Start your project** → 가입 (GitHub 계정으로 가입하면 이후가 편해요).
2. **New project** 클릭 → 이름 아무거나(예: `trailweight`), 비밀번호(DB 비번) 정하고 생성. (1~2분 기다림)
3. 왼쪽 메뉴 **SQL Editor → New query** → 이 저장소의 `supabase/schema.sql` 내용을 통째로 붙여넣고 **Run**. (테이블 + 보안 규칙 생성)
4. 왼쪽 **Project Settings → API** 로 가서 두 값을 복사:
   - **Project URL** (예: `https://abcd1234.supabase.co`)
   - **anon public** 키 (`anon` `public` 이라고 적힌 긴 문자열)
   - ⚠️ `service_role` 키는 절대 쓰지 마세요(비공개용).
5. **Authentication → Providers → Email** 이 켜져 있는지 확인(기본 켜짐). 이걸로 "메일 링크 로그인"을 씁니다.

이 두 값(Project URL, anon key)을 저(클로드)에게 알려주시면 로컬에서 바로 켜서 테스트해드릴 수 있어요. (anon 키는 공개되어도 안전한 키입니다.)

---

## 2단계. 로컬에서 동기화 테스트 (선택)

1. 프로젝트 폴더에 `.env.local` 파일을 만들고(`.env.example` 참고):
   ```
   NEXT_PUBLIC_SUPABASE_URL=(1단계의 Project URL)
   NEXT_PUBLIC_SUPABASE_ANON_KEY=(1단계의 anon key)
   ```
2. `npm run dev` 후 앱의 **설정**을 열면 "클라우드 동기화" 항목이 보입니다. 이메일을 넣고 **링크 받기** → 메일의 링크 클릭 → 로그인. 이후 변경이 자동 저장됩니다.

---

## 3단계. 웹 배포 (GitHub + Vercel) — 어디서나 접속

코드는 이미 커밋돼 있습니다. 터미널 없이 **GitHub Desktop**(GUI)으로 올리는 게 가장 쉬워요.

**A. GitHub에 올리기 (GitHub Desktop)**
1. https://desktop.github.com 에서 GitHub Desktop 설치 → 가입한 GitHub 계정으로 로그인.
2. 상단 **File → Add local repository** → 이 프로젝트 폴더(`D:\NAVER\2026\_Claude\bpl`) 선택.
3. 오른쪽 **Publish repository** 클릭 → 이름(`trailweight` 등) 확인 → (원하면 Private 체크) → **Publish**.
   - `.env.local`(키)은 깃에서 제외돼 있어 올라가지 않습니다. 안전.

**B. Vercel에 배포 (웹)**
4. https://vercel.com → **GitHub 계정으로 로그인**.
5. **Add New… → Project** → 방금 올린 `trailweight` 저장소 **Import**.
6. **Environment Variables** 섹션에 두 줄 추가 (Supabase 값):
   - 이름 `NEXT_PUBLIC_SUPABASE_URL` / 값 `https://ziqzsvnlubtxeskxspxg.supabase.co`
   - 이름 `NEXT_PUBLIC_SUPABASE_ANON_KEY` / 값 `sb_publishable_...`(본인 키)
7. **Deploy** → 잠시 후 `https://무언가.vercel.app` 주소 생성. 폰·PC 어디서나 접속!

**C. 로그인 링크가 돌아올 주소 등록 (중요)**
8. 배포 주소가 나오면 Supabase → **Authentication → URL Configuration** →
   - **Site URL** 을 `https://무언가.vercel.app` 로 설정
   - **Redirect URLs** 에도 같은 주소 추가
9. 이제 그 주소를 폰·PC에서 열고, 설정에서 이메일로 **로그인** → 두 기기가 같은 데이터로 동기화됩니다.

이후 GitHub Desktop으로 변경을 **Push** 할 때마다 Vercel이 자동 재배포합니다.

---

## 핸드폰 홈 화면에 추가
배포된 주소를 사파리/크롬에서 열고 **공유 → 홈 화면에 추가** 하면 앱처럼 쓸 수 있어요.
