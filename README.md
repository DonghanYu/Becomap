# 되고 싶어요. (Becomap)

장래희망을 검색하면 현직 종사자들이 지나온 경로(학교·학원·시험·첫 소속)를 합산한 경로 그래프를 보여주는 웹 서비스의 MVP입니다.
계획은 [`docs/PLAN.md`](docs/PLAN.md), 작업 규칙은 [`CLAUDE.md`](CLAUDE.md), 배포는 [`docs/DEPLOY.md`](docs/DEPLOY.md)를 참고하세요.

> 현재 경로 데이터는 모두 **합성(가상) 데이터**입니다. 실제 종사자 통계가 아닙니다.

## 구성

| 경로 | 내용 |
| --- | --- |
| `supabase/migrations/` | 스키마, 집계 뷰(MIN_SAMPLE=5 필터), RLS, 기여자·관리자 RPC |
| `supabase/seed.sql` | 합성 시드(16개 직업 × 30명). `scripts/generate_seed.py`로 생성 |
| `scripts/analyze_keywords.py` | Phase 0 검색량 분석 → `reports/` |
| `src/app/` | 첫 화면·검색·결과(`/jobs/[slug]`)·로그인·동의(`/contribute`)·내 정보(`/me`)·관리자(`/admin`) |
| `src/lib/` | 검색 매칭, 단기 목적지 계산, 데이터 읽기 계층 |
| `content/consent_v1.md` | 동의 문구(초안, 법률 검토 전) |
| `tests/unit`, `tests/db`, `e2e/` | Vitest 단위·DB 통합, Playwright E2E |

## 로컬 실행

```bash
npm install
pip install pandas matplotlib openpyxl

# 1) 로컬 Postgres에 Supabase 스텁 + 마이그레이션 + 합성 시드 적용
DATABASE_URL=postgres://postgres:postgres@localhost:5432/becomap npm run db:local

# 2) 공개 화면만 로컬 DB로 보기(.env.local)
#    DATA_BACKEND=postgres
#    DATABASE_URL=postgres://postgres:postgres@localhost:5432/becomap
npm run dev
```

로그인·등록·관리자 화면은 Supabase Auth가 필요합니다(`.env.example` 참고).
`DATA_BACKEND=postgres`는 로컬·CI용이며, 쿼리를 `anon` 역할로 실행해 Supabase API와 같은 권한으로 집계 뷰만 읽습니다.

## 테스트

```bash
npm test                                   # 단위 + DB 통합(DATABASE_URL이 있을 때)
npm run test:e2e                           # Playwright(로컬 DB 필요)
python3 -m unittest discover -s scripts/tests
```

## 검색량 분석(Phase 0)

```bash
# 합성 샘플로 실행 확인
python3 scripts/analyze_keywords.py --raw-dir data/raw/samples/naver_keyword_tool
# 실제 원자료: data/raw/naver_keyword_tool/에 키워드도구 결과(CSV/XLSX)를 넣고
python3 scripts/analyze_keywords.py --as-of 2026-10-08
```

원자료 컬럼명이 `RAW_COLUMN_CANDIDATES`와 다르면 스크립트가 실제 컬럼 목록을 출력하고 멈춥니다(추측 매핑 금지).
