# 배포 안내 (정식 공개 전 단계)

- 지금 바로 볼 수 있는 읽기 전용 데모는 0절(GitHub Pages)입니다.
- 로그인·등록까지 포함한 전체 서비스는 1~2절(Supabase + 서버 호스팅)이 필요합니다.

정식 공개 전까지 검색엔진 차단이 적용되어 있습니다.
- `src/app/robots.ts` → `/robots.txt`에서 전체 차단(`Disallow: /`)
- `src/app/layout.tsx` → `<meta name="robots" content="noindex, nofollow">`
- `next.config.ts` → 모든 응답에 `X-Robots-Tag: noindex, nofollow`

## 1. Supabase

1. Supabase 프로젝트를 만들고 **Project URL**, **anon key**, **service role key**를 확인합니다.
2. 마이그레이션 적용(둘 중 하나)
   - Supabase CLI: `supabase link --project-ref <ref>` 후 `supabase db push`
   - 또는 SQL Editor/psql에서 `supabase/migrations/*.sql`을 파일명 순서대로 실행
   - ⚠️ `supabase/tests/supabase_stub.sql`은 로컬 테스트 전용이므로 실제 프로젝트에 실행하지 않습니다.
3. 개발용 합성 데이터 적재(선택): `psql "<DB 연결 문자열>" -f supabase/seed.sql`
4. Authentication 설정
   - Email 공급자 사용(매직 링크)
   - Site URL: 배포 주소, Redirect URLs: `https://<배포 주소>/auth/callback`
5. 관리자 지정(SQL Editor):
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = '<관리자 이메일>';
   ```

참고: Supabase 대시보드의 보안 검사(Advisor)가 `occupation_totals`, `node_agg`, `flow_agg`를
"security definer view"로 경고할 수 있습니다. 이 뷰들은 의도적으로 소유자 권한으로 원본을 읽고
**표본 5명 이상인 집계 값만** 내보내도록 설계했습니다(`supabase/migrations/20261008000002_aggregates_rls.sql`).

## 2. 웹 앱(Vercel 또는 동등 서비스)

환경 변수(`.env.example` 참고)

| 이름 | 값 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key(서버 전용, 탈퇴 시 계정 삭제에만 사용) |
| `NEXT_PUBLIC_SITE_URL` | 배포 주소(예: `https://example.vercel.app`) |
| `DATA_BACKEND` | `supabase`(기본값, 생략 가능) |

빌드 명령 `npm run build`, 실행 `npm start`(Vercel은 자동 감지).

## 0. 읽기 전용 데모: GitHub Pages (등록 불필요)

주소: **https://donghanyu.github.io/Becomap/**

`.github/workflows/ci.yml`의 `pages` 작업이 테스트 통과 후 자동으로 배포합니다
(`main` 또는 `claude/awesome-wright-url30z` 브랜치 push, 또는 Actions → ci-deploy → Run workflow).

- 최초 1회만: 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 바꿉니다.
- 동작: Actions 안에서 Postgres를 띄워 합성 시드를 넣고, 공개 집계 뷰를 `anon` 권한으로 읽어 정적 HTML을 만듭니다
  (`scripts/build_static.sh`). 표본 5명 기준 필터는 DB 뷰에서 적용된 값 그대로입니다.
- 제공 기능: 검색, 경로 그래프, "지금 나는" → 다음 단기 목적지, 관문 공식 통계 패널
- 제외 기능: 로그인·경로 등록·철회·관리자(서버가 필요). 해당 메뉴는 "데모 안내" 화면으로 바뀝니다.
- 검색엔진 차단 한계: 하위 경로(`/Becomap/`) 배포라 robots.txt가 적용되지 않고 응답 헤더도 설정할 수 없어,
  각 페이지의 `<meta name="robots" content="noindex, nofollow">`만 적용됩니다.
- 로컬 확인: `npm run db:local` → `DATABASE_URL=... bash scripts/build_static.sh` → `node scripts/serve_static.mjs`
  → http://localhost:4300/Becomap/ (E2E: `npx playwright test -c playwright.static.config.ts`)

## 3. 배포 후 확인

- [ ] `/robots.txt`가 `Disallow: /`를 반환
- [ ] 응답 헤더에 `X-Robots-Tag: noindex`
- [ ] 첫 화면 검색 → 결과 화면 → "지금 나는" 선택 시 다음 단기 목적지 표시
- [ ] 이메일 로그인 → 동의 → 경로 저장 → 내 정보에서 철회 시 경로 삭제
- [ ] 관리자 계정으로 `/admin` 접속, 비관리자는 404

## 4. 정식 공개 전 할 일

- 개인정보·광고 분야 법률 자문 후 `content/consent_v1.md` 확정(현재 "초안")
- 합성 데이터 삭제: `delete from public.contributors where is_synthetic;`
- 검색엔진 차단 해제는 위 세 곳을 함께 수정
