# 되고 싶어요. — 웹 서비스 구축 계획 (MVP)

작성일: 2026-10-08 · 실행 도구: Claude Code · 규칙: 루트의 `CLAUDE.md`

## 1. 목표와 범위

MVP는 두 직군 그룹, 16개 직업에 대해 "○○가 되고 싶어요" 검색 → 경로 그래프 → 단기 목적지 표시까지 동작하는 웹 서비스입니다. 실데이터 수집 전 단계이므로 경로 데이터는 합성 데이터로 개발하고, 종사자 본인 등록 기능까지 완성합니다.

| 그룹 | 직업 |
| --- | --- |
| A. 전문직·고위직 | 변호사, 판사, 검사, 의사, 회계사, 변리사, 세무사, 삼성전자 공채 입사 |
| B. 기술직 | 소프트웨어 개발자, AI 엔지니어, 데이터 분석가, 반도체 엔지니어, 정보보안 전문가, 전기 기술자, 자동차 정비사, 항공정비사 |

범위 밖: 광고, 결제, 종사자 상담 중개, 공개 프로필 자동 수집(크롤링).

## 2. 사람이 먼저 해야 할 일 (DH)

1. Supabase 프로젝트 생성 → URL·anon key·service role key를 `.env.local`에 입력
2. GitHub 저장소 생성 (배포 대상: Vercel 또는 동등 서비스, 정식 공개 전까지 `noindex`)
3. 네이버 검색광고 키워드도구에 `keywords/*.csv`의 키워드를 입력하고 결과를 내려받아 `data/raw/naver_keyword_tool/`에 저장
4. (선택) 네이버 데이터랩 검색어트렌드에서 직업별 연령 추이 CSV를 내려받아 `data/raw/datalab/`에 저장
5. (선택) 교육부·한국직업능력연구원 「2025년 초·중등 진로교육 현황조사」 보고서에서 16개 직업의 희망 비율을 찾아 `data/raw/career_survey_2025.csv`에 직접 입력 (보고서에 없는 직업은 빈칸)
6. 정식 공개 전: 개인정보·광고 분야 법률 자문

## 3. 데이터 모델 (초안)

```sql
-- 직업
create table occupations (
  id serial primary key,
  slug text unique not null,          -- 'lawyer', 'judge', ...
  name_ko text not null,              -- '변호사'
  grp text not null check (grp in ('A_전문직','B_기술직'))
);

-- 경로 단계 유형 (그래프의 열 순서)
create type stage as enum ('high_school','undergrad','grad','prep','gate','first_job','career');

-- 마디: 기관명 대신 유형 라벨이 기본
create table nodes (
  id serial primary key,
  stage stage not null,
  label_type text not null,           -- '학부-법학', '학원-LEET 준비', '관문-변호사시험'
  institution_name text,              -- 공개 동의 시에만 화면 노출
  is_gate boolean default false
);

-- 기여자(종사자) = Supabase Auth 사용자
create table contributors (
  id uuid primary key references auth.users on delete cascade,
  occupation_id int references occupations,
  consent_version text not null,
  consented_at timestamptz not null
);

-- 경로와 단계
create table path_steps (
  id bigserial primary key,
  contributor_id uuid references contributors on delete cascade,
  seq int not null,
  node_id int references nodes,
  start_year_bucket text,             -- '2010-2014' 형태로 구간화
  visibility text not null default 'aggregate_only'
    check (visibility in ('aggregate_only','public'))
);

-- 관문 공식 통계 (부록 A의 값만, 출처 필수)
create table gate_stats (
  id serial primary key,
  node_id int references nodes,
  year int,
  metric text,                        -- 'pass_rate_examinees' 등
  value numeric,                      -- 출처 없으면 NULL
  source_url text,
  note text
);

-- 검색량 (Phase 0 결과 적재)
create table keyword_volume (
  keyword text,
  occupation_id int references occupations,
  intent text,
  pc int, mobile int,
  below_threshold boolean,            -- 원자료가 '<10'인 경우
  as_of date
);
```

집계 뷰: `flow_agg(occupation_id, from_node, to_node, contributors)`를 만들고 `having count(distinct contributor_id) >= MIN_SAMPLE`로 거릅니다. 앱은 이 뷰만 읽고, `path_steps` 원본에는 RLS로 본인 행만 접근하게 합니다.

## 4. 단계별 작업

각 Phase는 Claude Code에 "docs/PLAN.md의 Phase N을 진행해줘"라고 요청하는 단위입니다.

### Phase 0. 저장소 초기화와 검색량 분석
- Next.js 프로젝트 골격, `.env.example`, `supabase/` 폴더, `scripts/` 폴더 생성
- `scripts/analyze_keywords.py` 작성
    - 입력: `keywords/*.csv`(직업·의도 매핑), `data/raw/naver_keyword_tool/*`(CSV 또는 XLSX)
    - 원자료의 컬럼명은 실제 파일을 열어 확인한 뒤 매핑하고, 확신이 없으면 작업을 멈추고 질문
    - 키워드 매칭은 공백을 제거해 비교 (도구가 공백을 다르게 표기할 수 있음)
    - "<10" 값은 수치로 바꾸지 말고 `below_threshold = true`로 표시하고 합계에서 별도 표기
    - 출력: `reports/keyword_volume.md` (직업별 진로 검색량 합계, 모바일 비중, 그룹 A·B 비교, 의도별 구성), 막대그래프 PNG, `keyword_volume` 적재용 CSV
    - `career_survey_2025.csv`가 있으면 희망 비율 대비 검색량 표를 추가
- 완료 기준: 샘플 입력 파일(합성)로 스크립트가 끝까지 실행되고, 실제 파일을 넣으면 같은 형식의 보고서가 생성됨

### Phase 1. DB 스키마, RLS, 시드
- 3절의 스키마를 마이그레이션으로 작성, RLS 정책 작성
- 시드: 16개 직업, 직업별 대표 경로 마디, 합성 기여자 직업당 30명 (경로 분기가 보이도록 2~3개 갈래로 분포)
- 판사 경로는 "변호사 자격 → 법조경력 5년 이상 → 법관 임용"처럼 변호사 경로에서 이어지게 구성
- 삼성전자 경로는 "직무적합성평가 → GSAT(SW 직군은 SW 역량테스트) → 면접"을 관문으로 구성
- `gate_stats`는 부록 A의 값만 입력
- 완료 기준: 표본 5명 미만 마디가 `flow_agg`에서 빠지는 것을 테스트로 확인, 타인의 `path_steps` 조회가 RLS로 막히는 것을 테스트로 확인

### Phase 2. 검색과 결과 화면
- 첫 화면: 검색창 "○○가 되고 싶어요", 그룹 A·B 직업 칩
- 검색: 직업명·별칭 매칭 (예: "CPA" → 회계사, "화이트해커" → 정보보안 전문가)
- 결과 화면: d3-sankey 경로 그래프, 표본 수·데이터 출처 표기, 상시 고지 문구
- "지금 나는" 단계 선택(고교/학부/졸업 후) → 이후 마디 중 가장 굵은 마디를 "다음 단기 목적지"로 강조
- 마디 클릭 패널: 설명, 거친 종사자 비율, 관문이면 공식 통과율과 출처 링크
- 모바일 우선 레이아웃
- 완료 기준: 16개 직업 모두 결과 화면이 열리고, 통계가 NULL인 관문은 "공식 통계 확인 중"으로 표시됨. Playwright로 "변호사" 검색 → 단기 목적지 표시까지 E2E 1건 통과

### Phase 3. 종사자 등록
- 이메일 로그인(Supabase Auth)
- 동의 화면: 수집 항목, 이용 목적, 공개 범위, 철회 방법 안내 (문구는 `content/consent_v1.md`에 두고 법률 검토 전 표시 "초안")
- 경로 입력기: 단계 추가·순서 변경·삭제, 단계별 공개 범위 선택, 연도는 5년 구간으로 선택
- 내 정보 화면에서 전체 삭제(철회) → 즉시 삭제
- 완료 기준: 등록 → 집계 반영(표본 기준 충족 시) → 철회 → 집계에서 사라짐을 테스트로 확인

### Phase 4. 운영 기반과 배포
- 관리자 화면: 신규 경로 검토(이상치 표시), 마디 라벨 병합
- 감사 로그: 관리자 작업 기록
- `robots.txt` 전체 차단, 메타 `noindex` (정식 공개 전까지)
- 배포 문서 `docs/DEPLOY.md`
- 완료 기준: 배포 URL에서 Phase 2·3 기능이 동작하고 검색엔진 차단이 적용됨

## 5. 검증 체크리스트 (매 Phase 종료 시)
- [ ] 합성 데이터 외 실존 인물 정보가 코드·시드에 없음
- [ ] 출처 없는 통계 수치가 없음
- [ ] MIN_SAMPLE 필터가 DB 단에서 적용됨
- [ ] 결과 화면에 상시 고지 문구와 표본 수가 보임
- [ ] 테스트 통과, `.env.local` 미커밋

## 부록 A. 관문 공식 통계 (확인된 값만)

| 관문 | 내용 | 출처 |
| --- | --- | --- |
| 변호사시험(제15회, 2026) | 응시 3,364명, 합격 1,714명, 응시자 대비 50.95%, 초시 70.04%, 법전원 입학정원 2,000명 | [법무부 보도자료 2026.4.23.](https://www.moj.go.kr/bbs/moj/182/493830/download.do) |
| 법관 임용 | 최소 법조경력 5년 이상(2024년 법원조직법 개정으로 유지) | [법률신문](https://www.lawtimes.co.kr/news/203750) |
| 삼성 신입 공채 | 직무적합성평가 → GSAT → 면접 → 건강검진, SW 직군은 GSAT 대신 SW 역량테스트 | [삼성 뉴스룸 2026.4.26.](https://news.samsung.com/kr/%EC%82%BC%EC%84%B1-2026%EB%85%84-%EC%83%81%EB%B0%98%EA%B8%B0-%EC%82%BC%EC%84%B1%EC%A7%81%EB%AC%B4%EC%A0%81%EC%84%B1%EA%B2%80%EC%82%ACgsat%EC%8B%A4%EC%8B%9C) |
| 그 밖의 관문 | 의사 국가시험, 공인회계사·변리사·세무사 시험, 각종 기사 자격 등 | TODO: 각 시행기관 공고에서 확인 후 추가 |
