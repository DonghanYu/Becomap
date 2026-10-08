-- 되고 싶어요. — 기본 스키마
-- docs/PLAN.md 3절 초안을 기반으로 하되, 다음을 보완했습니다.
--  * contributors: 합성(가상) 기여자를 auth.users에 넣지 않도록 id와 user_id를 분리하고 is_synthetic 표시
--  * nodes: 마디 설명, 사용자 제안 마디의 승인 여부(approved), 라벨 중복 방지
--  * path_steps: (기여자, 순서) 유일, 연도 구간 형식 검사
--  * gate_stats: 값이 있으면 출처 필수

-- 직업 ---------------------------------------------------------------
create table public.occupations (
  id serial primary key,
  slug text unique not null,
  name_ko text not null,
  grp text not null check (grp in ('A_전문직', 'B_기술직')),
  aliases text[] not null default '{}',   -- 검색 별칭 (예: CPA → 회계사)
  sort_order int not null default 0
);

-- 경로 단계 유형 (그래프의 열 순서) --------------------------------------
create type public.stage as enum
  ('high_school', 'undergrad', 'grad', 'prep', 'gate', 'first_job', 'career');

-- 마디: 기관명 대신 유형 라벨이 기본 -------------------------------------
create table public.nodes (
  id serial primary key,
  stage public.stage not null,
  label_type text not null check (char_length(label_type) between 2 and 60),
  institution_name text,                  -- 공개 동의 시에만 노출(MVP에서는 어떤 뷰도 노출하지 않음)
  is_gate boolean not null default false,
  description text,
  approved boolean not null default true, -- 사용자가 제안한 마디는 관리자 승인 전까지 false
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  unique (stage, label_type)
);

-- 기여자(종사자) ------------------------------------------------------
create table public.contributors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users on delete cascade, -- 합성 기여자는 NULL
  is_synthetic boolean not null default false,
  occupation_id int not null references public.occupations,
  consent_version text not null,
  consented_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (is_synthetic or user_id is not null)
);

-- 경로 단계 -----------------------------------------------------------
create table public.path_steps (
  id bigserial primary key,
  contributor_id uuid not null references public.contributors on delete cascade,
  seq int not null check (seq >= 1),
  node_id int not null references public.nodes,
  start_year_bucket text check (start_year_bucket ~ '^[0-9]{4}-[0-9]{4}$'),
  visibility text not null default 'aggregate_only'
    check (visibility in ('aggregate_only', 'public')),
  unique (contributor_id, seq)
);
create index path_steps_node_idx on public.path_steps (node_id);

-- 관문 공식 통계 (PLAN.md 부록 A의 값만, 값이 있으면 출처 필수) ----------------
create table public.gate_stats (
  id serial primary key,
  node_id int not null references public.nodes on delete cascade,
  year int,
  metric text not null,
  value numeric,
  source_url text,
  note text,
  check (value is null or source_url is not null)
);

-- 검색량 (Phase 0 결과 적재, 비공개) -----------------------------------
create table public.keyword_volume (
  keyword text not null,
  occupation_id int references public.occupations,
  intent text,
  pc int,
  mobile int,
  below_threshold boolean not null default false,
  as_of date
);

-- 관리자와 감사 로그 (Phase 4) ------------------------------------------
create table public.admins (
  user_id uuid primary key references auth.users on delete cascade
);

create table public.admin_audit_log (
  id bigserial primary key,
  admin_id uuid,
  action text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
