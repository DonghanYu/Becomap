# 배포 안내 (정식 공개 전 단계)

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
