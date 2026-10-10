# Trailweight — 프로젝트 인수인계 문서

> 이 문서는 AI 어시스턴트(또는 새 개발자)에게 프로젝트를 넘길 때 필요한 핵심 컨텍스트를 담는다.
> 코드를 수정하기 전에 반드시 끝까지 읽을 것. 특히 **[성능 교훈](#7-성능-교훈-절대-되돌리지-말-것)** 과 **[주의사항](#8-개발-환경--주의사항)**.

## 1. 앱 개요

- **Trailweight**: 백패킹 장비/여정 관리 앱. 주 사용자는 소유자 1인 + 지인 몇 명.
- 모바일 우선 웹앱(홈 화면 추가해 PWA처럼 사용). **기준 디바이스 iPhone 16 Pro (393pt)** — 하단 플로팅 컨트롤(GNB·FAB·선택바)은 높이 56px로 통일, 393pt에서 겹치지 않아야 함.
- 배포: **https://bpl-three-theta.vercel.app** (GitHub `pyoungtan/bpl` → master push 시 Vercel 자동 배포)
- 탭 2개, 좌하단 플로팅 글래스 GNB(아이콘 전용):
  - **Gear** (장비 카탈로그) — 컴포넌트는 리네임 전 이름인 `components/gear/GearShelf.tsx` 그대로
  - **Trip** (패킹 스냅샷/여행 기록)

## 2. 스택

| 영역 | 선택 |
|---|---|
| 프레임워크 | **Next.js 16** (Turbopack) + React 19 — ⚠️ 학습 데이터보다 최신. **코드 작성 전 `node_modules/next/dist/docs/` 의 해당 가이드를 먼저 읽을 것** (AGENTS.md 지시) |
| 스타일 | Tailwind v4 (디자인 토큰은 `app/globals.css`의 CSS 변수) |
| 상태 | Zustand + persist (localStorage, **키 `"bpl-v5"`** — 시드 데이터를 바꾸면 키를 올려 강제 리시드하는 관례, 단 기존 로컬 트립/프리셋이 날아감) |
| 애니메이션 | framer-motion 12 |
| DnD | @dnd-kit (편집 모드 순서 변경) |
| 아이콘 | lucide-react |
| 클라우드 | Supabase (env 없으면 완전 로컬 모드로 동작) |

## 3. 디자인 시스템 — "iOS 블랙 & Liquid Glass" (브랜치 `claude/ios27-glass`)

> 이전 "Anthropic 웜 에디토리얼"(크림 `#faf9f5` + 코랄 `#cc785c` + Newsreader serif) UI는 `master` / `codex/claude-original`에 그대로 있다.

- 흰 캔버스 `#fff` / 다크 `#000`. 토큰은 전부 `app/globals.css`. **`--tint` = 검정(라이트) / 흰색(다크)**, 그 위 글자는 반드시 `text-on-tint`(`text-white` 금지 — 다크에서 흰 바탕 흰 글씨가 됨).
- Glass 재질: `.glass`(컨트롤), `.glass-strong`(메뉴·시트·다이얼로그) + `.press-fx`/`.g-glow`(눌림 swell·stretch, 터치 글로우). `backdrop-filter`는 떠 있는 소수 요소에만. `prefers-reduced-transparency`면 불투명 `--g-solid`로 폴백(형태·테두리 유지).
- 상단 바(`components/TopBar.tsx`, ChatGPT iOS 치수: 원형 44pt · 세그먼트 48pt/알약 40pt · 좌우 16pt · 라벨 17pt medium, 항목 폭은 라벨+18pt 패딩): 좌 검색(🔍↔×)/‹(뒤로) · 가운데 Gear|Trip 세그먼트(또는 상세 화면의 상태 캡슐) · 우 ⋯ 모프 메뉴(맨 아래에 항상 '설정'). 화면 타이틀 영역은 없음. 각 화면은 `useTopBar({ onBack?, center?, onSearch?, searching?, menu? })`로 등록. 바 위치는 CSS 변수 `--bar-top` / 하단 플로팅은 `--bar-bottom`.
- 주 액션 버튼: `InkButton`(검정 캡슐), 보조: `GlassButton` (`components/ui/Glass.tsx`). 둘 다 `touch-none`이라 **스크롤 영역 안의 인라인 버튼에는 쓰지 말 것**(fixed 플로팅 전용).
- 시트(`ui/Sheet.tsx`): 화면 가장자리에서 띄운 glass-strong 패널, radius 32, 좌 × 글래스 원형 · 우 검정 캡슐 액션.
- 카테고리 색상 팔레트(`lib/colors.ts`)는 그대로 — 12색 이름 해시 매핑(`colorForCategory`).
- 서체: 시스템 SF 스택(`--font-sans`, `--font-serif` 둘 다 동일). 타이틀은 bold, 숫자는 `tabular` 유틸.
- 리스트는 카드 박스 없이 **flat, 항목 사이 구분선 없음**(여백만으로 구분) — Gear·Trip·시트·설정 공통. 남은 구분선은 ⋯ 메뉴의 그룹 구분선뿐.
- 플로팅 요소 그림자는 `.shadow-float`(수직 오프셋 0 앰비언트 — 모바일 브라우저 크롬에 그림자가 잘리는 문제 회피).

## 4. 데이터 모델 (`lib/types.ts`)

- **GearItem**: `majorCategory`(대분류, store의 `categories: string[]`가 1급 순서 소스), `minorCategory`, `brand`, **`weightG`(캐노니컬 그램, 소수 0.1g까지)**, `quantity`(기준 수량), `price`, `worn`(착용)/`consumable`(소모 — 베이스 무게에서 제외), `hidden`, `addOnIds`(애드온 링크 — 애드온은 최상위 목록에서 숨고 부모의 드롭다운에 중첩).
- **Trip**: `startDate/endDate`(+레거시 `date`), `place`, `companions: string[]`(레거시 문자열은 `lib/trips.ts`의 `tripCompanions()`가 읽기 시 분리), `tempLow/tempHigh`(**문자열** — iOS 숫자 키보드에 −가 없어 자유 입력), `extraWeightG`(장비 없이 수동 추가하는 무게, 회색 슬라이스로 합산), `packed: {gearId, quantity}[]`, `checked: string[]`(장비 점검 모드), `createdAt`.
- 무게 표시: `lib/units.ts` — `formatWeight`(g는 소수 1자리까지, 정수면 `.0` 생략), `formatWeightSmart`(1000g 이상 kg 승격).
- 통계: `lib/calc.ts` `computeStats`. **트립에서 패킹된 애드온의 무게는 부모의 카테고리로 귀속**(도넛·카테고리 합계 일관성).
- 트립 상세의 카테고리 그룹 순서는 **반드시 store `categories` 배열 순서** (gearOrder 첫 등장 순서를 쓰면 정렬이 틀어지는 버그가 있었음).

## 5. 클라우드 동기화 (`lib/useCloudSync.ts`, `lib/supabase.ts`)

- env `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` 없으면 클라우드 코드 전체 비활성(로컬 전용).
- **로컬 우선**: 편집 즉시 localStorage 저장. 로그인 시 pull, 변경 시 디바운스(800ms) push, realtime으로 타 기기 반영. 유저당 `user_data` 테이블 jsonb 1행(RLS own-row). 스키마 `supabase/schema.sql`, 설정 가이드 `SETUP.md`.
- **인증**: 이메일 OTP. `flowType: 'implicit'` 매직링크 + **6자리 코드 입력이 주 경로**(안정적). Supabase 설정 필수사항: Site URL/Redirect URLs = Vercel 도메인, Magic Link 이메일 템플릿에 `{{ .Token }}` 포함, 이메일 가입 허용.
- **메일 발송**: Supabase 내장 메일은 조직 멤버에게만 감(외부인 500 에러). **커스텀 SMTP 필수** — Brevo 설정됨(Host `smtp-relay.brevo.com:587`, Username=계정 이메일, Password=SMTP 키, Sender=**인증된 발신자**). Resend는 도메인 미보유로 보류.
- **충돌 안전장치** (중요, 데이터 유실 방지):
  - 로그인 pull 시 로컬이 "첫 실행 샘플 그대로(pristine)"가 아니고 클라우드와 다르면 **무조건 선택 다이얼로그**(AppShell의 `SyncConflictDialog`) — 어느 쪽을 쓸지 유저가 고름. 더 **예전 쪽을 고르면 2차 확인 팝업**.
  - 비교는 `lib/store.ts`의 `dataSignature`(키 정렬 정규화 JSON — Postgres jsonb가 키 순서를 안 지키므로 단순 stringify 비교 금지).
  - 로컬 수정 시각은 localStorage `bpl-local-updated-at`에 스탬프(설정류 변경 제외).
  - **push는 성공 후에만 `lastPushed` 갱신** + 모든 요청 15초 타임아웃 + 실패 시 자동 재시도(push 5s/pull 6s) + 콘솔에 `[cloud sync] push/pull failed:` 로깅. (과거: 보내기 전에 보냄 처리해서 실패 시 영원히 "동기화 중" 멈춤 버그 있었음 — 재발 금지)

## 6. 핵심 컴포넌트/패턴

- **`components/ui/SwipeRow.tsx`**: 앱 전체 스와이프 행 공통(방향 인지, 리스트당 1행만 열림 — `openId`를 리스트가 소유, 본문 불투명 유지). Gear 행: ←수정/삭제(2탭 확인), →숨김. 트립 행/트립 내 행: ←삭제.
- **`components/ui/Sheet.tsx`**: 바텀시트 공통. ① body `position:fixed` 스크롤락 + 닫을 때 스크롤 복원(키보드로 인한 배경 스크롤 유실 방지), ② **VisualViewport로 키보드 높이 추적** → 시트를 키보드 위로 리프트 + `max-h-[min(92dvh,100%)]`, ③ 포커스된 필드 자동 center 스크롤. **새 시트의 입력에 autoFocus 금지**(열림 애니메이션 중 키보드가 시트를 밀어 올림).
- **`components/ui/RangeCalendar.tsx`**: 기간 선택(첫 탭=시작, 둘째 탭=종료, 이전 날짜 탭=리셋), 헤더 탭 → 12개월 그리드(화살표가 연 단위).
- **Gear 선택 모델**: 행 탭=선택 토글(체크박스 없음), 선택 시 헤더에 개수·무게(코랄), 하단 팩 수량 스테퍼(−/+만, 이름 없음), "Trip에 추가". 애드온 하위행은 pointerup+이동가드로 선택(iOS 연속 탭 보호).
- **대분류 접기**: 헤더 탭 토글, localStorage `bpl-collapsed-cats` 기억. 편집/검색/칩필터 중엔 무시.
- **트립 내 장비**: 행 탭 → 수량 스테퍼+삭제 패널 확장. `장비 추가` 시트는 애드온 중첩+수량 스테퍼 지원. 좌측 가장자리 스와이프 백(콘텐츠가 손가락 추종, 70px 임계).
- **드래그 정렬**(편집 모드): **단일 SortableContext가 전 카테고리를 관통** → 카테고리 경계 넘어 실시간 정렬, `DragOverlay`로 부유 복제본, 드롭 시 `moveGear`(대상 카테고리 자동 채택). 드래그 중 `document.body.dataset.dragging`으로 PullToRefresh 차단.
- **LighterPack 가져오기**: 설정 시트 → `app/api/lighterpack/route.ts`(서버 프록시, CORS 회피) → `lib/lighterpack.ts` 파서(숫자 문자참조 `&#x2F;` 디코딩 포함). 교체 가져오기는 **2차 확인 팝업 필수**.
- **트립 목록 정렬**: 칩 3종(다녀온 날짜/작성일/함께한 사람-가나다), localStorage `bpl-trip-sort`. 사람순일 때만 부제가 동행 태그로 바뀜.

## 7. 성능 교훈 (절대 되돌리지 말 것)

아이폰 ProMotion(120Hz)에서 프레임 유지가 요구사항. 긴 목록(수백 행) 위에서:

1. **height를 프레임마다 애니메이션하지 말 것** — 아래 전체가 매 프레임 리플로우되어 60fps 미만으로 떨어짐.
2. **접기/펼치기에서 행을 조건부 마운트하지 말 것** — 펼칠 때 수십 개 SwipeRow 마운트 커밋이 시작 히치를 만듦.
3. 현재 확정 구성(Gear 대분류 접기): **행 상시 마운트 + `display:none` 토글(리플로우 1회)** + 아래 섹션들은 `motion.section layout="position"` **FLIP transform 글라이드** + 펼침 블록은 `.fold-reveal` CSS opacity 페이드 → 애니메이션 프레임 전부 컴포지터 전용.
4. 탭 전환 슬라이드는 **CSS 키프레임**(fill-mode 기본값) — 종료 후 transform이 none으로 복원되어야 내부 sticky 헤더/fixed FAB가 안 깨짐. framer로 x를 애니메이션하면 transform이 잔류해 fixed 기준이 바뀜.
5. 스와이프/시트/백스와이프/GNB pill은 전부 transform/opacity 기반 — 유지할 것.
6. 그래도 걸리면 다음 단계는 **목록 가상화**뿐.

## 8. 개발 환경 & 주의사항

- **Windows**. Node v24(winget 유저 스코프)가 기존 프로세스 PATH에 없을 수 있음 → PowerShell에서 `$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")` 후 npm/npx 사용. node 절대경로는 `.claude/launch.json` 참고.
- dev 서버: `next dev --port 3000` (launch 설정명 "dev"). **Next 16은 같은 디렉터리에 dev 서버 2개 금지**(포트 달라도 락 걸림).
- Tailwind v4 토큰(`globals.css`) 변경은 HMR이 안 먹을 수 있음 → dev 서버 재시작.
- 환경변수는 `.env.local`(커밋 안 됨). Vercel에도 동일 키 설정되어 있음.
- 검증 루틴: `npx tsc --noEmit` 통과 확인 → 커밋 → master push(=배포). 테스트 코드는 없음.
- 커밋 메시지는 영어, 본문에 이유 서술. 한국어 UI 문구가 많으니 인코딩(UTF-8) 주의.

## 9. 미완 / 백로그

- PWA 오프라인 캐싱·설치 매니페스트 (현재는 홈 화면 추가 + pull-to-refresh로 새 배포 수동 갱신)
- CSV export / 백업 다운로드 (현재 유일한 로컬 백업 수단 없음 — 브라우저 데이터 삭제 시 미동기화 데이터 유실)
- 친구 공유(트립 읽기 공유 등)
- Brevo 발신자/도메인 인증 상태에 따라 외부 사용자의 코드 메일 수신 재확인
- 트립 상세의 소규모 확장(도넛 세부·달력 등)은 아직 height 애니메이션 — 짧은 페이지라 유지 중, 문제 시 §7 방식으로 전환
