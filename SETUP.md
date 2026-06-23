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

1. **GitHub** 가입(https://github.com) → 새 저장소(repository) 생성(이름 예: `trailweight`, Private 가능).
2. 이 프로젝트 코드를 그 저장소에 올립니다. (제가 커밋까지 준비해두면, 표시되는 명령 몇 줄만 복사·실행하시면 됩니다.)
3. **Vercel** 가입(https://vercel.com) — **GitHub 계정으로 로그인** 추천.
4. Vercel → **Add New… → Project** → 방금 만든 GitHub 저장소 **Import**.
5. **Environment Variables** 에 1단계의 두 값을 추가:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. **Deploy** → 잠시 후 `https://무언가.vercel.app` 주소가 생깁니다. 폰·PC 어디서나 그 주소로 접속!
7. (중요) 배포 주소가 정해지면 Supabase → **Authentication → URL Configuration → Site URL / Redirect URLs** 에 그 주소(`https://....vercel.app`)를 추가해야 메일 로그인 링크가 올바르게 돌아옵니다.

이후 코드를 GitHub에 올릴 때마다 Vercel이 **자동으로 다시 배포**합니다.

---

## 핸드폰 홈 화면에 추가
배포된 주소를 사파리/크롬에서 열고 **공유 → 홈 화면에 추가** 하면 앱처럼 쓸 수 있어요.
