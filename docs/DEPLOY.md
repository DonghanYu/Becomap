# 배포 안내 (정식 공개 전 단계)

정식 공개 전까지 검색엔진 차단이 적용되어 있습니다.
- `src/app/robots.ts` → `/robots.txt`에서 전체 차단(`Disallow: /`)
- `src/app/layout.tsx` → `<meta name="robots" content="noindex, nofollow">`
- `next.config.ts` → 모든 응답에 `X-Robots-Tag: noindex, nofollow`

## 1. Supabase

1. Supabase 프로젝트를 만들고 **Project URL**, **anon key**, **service role key**를 확인합니다.
2. 마이그레이션 적용(셋 중 하나)
   - GitHub Actions 자동 적용(아래 2-1절)
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

## 2-1. GitHub에서 자동 배포(GitHub Actions)

`.github/workflows/ci.yml`이 다음 순서로 실행됩니다.

1. **test**: 모든 push·PR에서 단위·DB 통합·E2E·Python 테스트
2. **deploy**: `main` 또는 `claude/awesome-wright-url30z` 브랜치 push, 또는 Actions 화면의 수동 실행(Run workflow)에서
   테스트가 통과하면 `supabase db push`로 마이그레이션 적용 → Vercel CLI로 프로덕션 배포
   (`vercel pull` → `vercel build --prod` → `vercel deploy --prebuilt --prod`). 배포 URL은 실행 결과 요약(Summary)에 표시됩니다.

Secrets 등록 위치: GitHub 저장소 → Settings → Secrets and variables → Actions → New repository secret

| Secret | 얻는 곳 |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Supabase 대시보드 → Account → Access Tokens에서 생성 |
| `SUPABASE_DB_PASSWORD` | 프로젝트 생성 시 정한 DB 비밀번호 |
| `SUPABASE_PROJECT_ID` | 프로젝트 ref (Project Settings → General) |
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens에서 생성 |
| `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | 로컬에서 `npx vercel link` 실행 후 생성되는 `.vercel/project.json`의 `orgId`, `projectId` |

추가로 Vercel 프로젝트 Settings → Environment Variables(Production)에 2절의 환경 변수를 넣어야 합니다.
워크플로가 `vercel pull`로 이 값을 받아 빌드합니다(`NEXT_PUBLIC_*`는 빌드 시점에 포함됨).

- Secrets가 하나라도 없으면 deploy 단계는 경고만 남기고 건너뜁니다(테스트는 그대로 실행).
- 빈 DB에 합성 시드를 처음 넣을 때: Actions → ci-deploy → Run workflow에서 `seed`를 체크해 한 번 실행합니다.
  같은 시드를 다시 넣으면 직업 slug 중복으로 실패하므로 반복하지 않습니다.
- Vercel의 Git 연동(대시보드에서 저장소 연결)도 켜 두면 배포가 두 번 일어날 수 있으니 둘 중 하나만 사용합니다.

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
