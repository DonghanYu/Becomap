-- 집계 뷰(MIN_SAMPLE 필터), RLS 정책, 기여자용 RPC
--
-- 원칙
--  * 앱(익명 방문자)은 집계 뷰와 공개 참조 테이블(occupations, nodes, gate_stats)만 읽습니다.
--  * 집계 뷰는 서로 다른 기여자 수가 min_sample() 미만인 행을 DB에서 제외합니다.
--    프런트엔드나 API 파라미터로 이 기준을 바꿀 수 없습니다.
--  * path_steps 원본은 RLS로 본인 행만 접근합니다.

-- 최소 표본 기준 (변경은 마이그레이션으로만) ------------------------------------
create function public.min_sample() returns int
language sql immutable as $$ select 5 $$;

-- 보조 함수 ----------------------------------------------------------
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create function public.my_contributor_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.contributors where user_id = auth.uid();
$$;

create function public._node_exists(p_id int) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.nodes where id = p_id);
$$;

-- 집계 뷰 ------------------------------------------------------------
-- 뷰는 소유자 권한으로 실행되어 path_steps 원본을 읽지만, 출력은 집계 값뿐입니다.
-- 기관명(institution_name)과 연도·공개 범위 등 개별 속성은 어떤 뷰에도 포함하지 않습니다.

-- 승인된 마디만 남긴 뒤 순서를 다시 매긴 경로
create view public._approved_steps with (security_barrier = true) as
select c.occupation_id,
       s.contributor_id,
       s.node_id,
       row_number() over (partition by s.contributor_id order by s.seq) as pos
from public.path_steps s
join public.contributors c on c.id = s.contributor_id
join public.nodes n on n.id = s.node_id
where n.approved;

revoke all on public._approved_steps from public, anon, authenticated;

create view public.occupation_totals with (security_barrier = true) as
select a.occupation_id,
       count(distinct a.contributor_id)::int as contributors,
       bool_or(c.is_synthetic) as has_synthetic
from public._approved_steps a
join public.contributors c on c.id = a.contributor_id
group by a.occupation_id
having count(distinct a.contributor_id) >= public.min_sample();

create view public.node_agg with (security_barrier = true) as
select a.occupation_id,
       a.node_id,
       n.stage,
       n.label_type,
       n.is_gate,
       n.description,
       count(distinct a.contributor_id)::int as contributors
from public._approved_steps a
join public.nodes n on n.id = a.node_id
group by a.occupation_id, a.node_id, n.stage, n.label_type, n.is_gate, n.description
having count(distinct a.contributor_id) >= public.min_sample();

create view public.flow_agg with (security_barrier = true) as
with pairs as (
  select a.occupation_id,
         a.contributor_id,
         a.node_id as from_node,
         lead(a.node_id) over (partition by a.contributor_id order by a.pos) as to_node
  from public._approved_steps a
)
select occupation_id,
       from_node,
       to_node,
       count(distinct contributor_id)::int as contributors
from pairs
where to_node is not null and to_node <> from_node
group by occupation_id, from_node, to_node
having count(distinct contributor_id) >= public.min_sample();

grant select on public.occupation_totals, public.node_agg, public.flow_agg to anon, authenticated;

-- RLS ---------------------------------------------------------------
alter table public.occupations enable row level security;
alter table public.nodes enable row level security;
alter table public.contributors enable row level security;
alter table public.path_steps enable row level security;
alter table public.gate_stats enable row level security;
alter table public.keyword_volume enable row level security;
alter table public.admins enable row level security;
alter table public.admin_audit_log enable row level security;

create policy occupations_read on public.occupations for select using (true);
create policy gate_stats_read on public.gate_stats for select using (true);

-- 미승인 마디는 제안자, 그 마디를 경로에 쓴 본인, 관리자에게만 보입니다.
create policy nodes_read on public.nodes for select
  using (
    approved
    or created_by = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.path_steps s
               where s.node_id = nodes.id and s.contributor_id = public.my_contributor_id())
  );

create policy contributors_own_select on public.contributors for select
  using (user_id = auth.uid() or public.is_admin());
create policy contributors_own_insert on public.contributors for insert
  with check (user_id = auth.uid() and not is_synthetic and reviewed_at is null);
create policy contributors_own_update on public.contributors for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and not is_synthetic);
create policy contributors_own_delete on public.contributors for delete
  using (user_id = auth.uid());

create policy path_steps_own_select on public.path_steps for select
  using (contributor_id = public.my_contributor_id() or public.is_admin());
create policy path_steps_own_insert on public.path_steps for insert
  with check (contributor_id = public.my_contributor_id());
create policy path_steps_own_update on public.path_steps for update
  using (contributor_id = public.my_contributor_id())
  with check (contributor_id = public.my_contributor_id());
create policy path_steps_own_delete on public.path_steps for delete
  using (contributor_id = public.my_contributor_id());

create policy admins_self_read on public.admins for select using (user_id = auth.uid());
create policy audit_admin_read on public.admin_audit_log for select using (public.is_admin());
-- keyword_volume: 정책 없음 → anon/authenticated 접근 불가(service_role 전용)

-- 권한: 익명 방문자는 원본 경로 테이블에 접근하지 않습니다.
revoke all on public.contributors, public.path_steps from anon;
revoke all on public.keyword_volume, public.admin_audit_log from anon, authenticated;
revoke insert, update, delete on public.occupations, public.nodes, public.gate_stats, public.admins
  from anon, authenticated;
grant select on public.occupations, public.nodes, public.gate_stats to anon, authenticated;
grant select, insert, update, delete on public.contributors, public.path_steps to authenticated;
grant select on public.admins, public.admin_audit_log to authenticated;
grant usage on sequence public.path_steps_id_seq to authenticated;

-- 기여자 RPC ---------------------------------------------------------

-- 동의 및 기여자 등록(재동의 시 직업·동의 버전 갱신). 호출자 권한(RLS 적용)으로 실행합니다.
create function public.register_contributor(p_occupation_id int, p_consent_version text)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  insert into public.contributors (user_id, occupation_id, consent_version, consented_at)
  values (auth.uid(), p_occupation_id, p_consent_version, now())
  on conflict (user_id) do update
    set occupation_id = excluded.occupation_id,
        consent_version = excluded.consent_version,
        consented_at = excluded.consented_at
  returning id into v_id;
  return v_id;
end $$;

-- 내 경로 전체 저장(기존 단계를 지우고 새 순서로 저장). 호출자 권한(RLS 적용)으로 실행합니다.
-- p_steps: [{"node_id": 1, "start_year_bucket": "2010-2014", "visibility": "aggregate_only"}, ...]
create function public.save_my_path(p_steps jsonb)
returns int language plpgsql security invoker set search_path = public as $$
declare
  v_cid uuid := public.my_contributor_id();
  v_count int;
begin
  if v_cid is null then
    raise exception '동의 후 경로를 저장할 수 있습니다.';
  end if;
  if jsonb_typeof(p_steps) <> 'array' then
    raise exception '경로 형식이 올바르지 않습니다.';
  end if;
  v_count := jsonb_array_length(p_steps);
  if v_count < 1 or v_count > 20 then
    raise exception '경로 단계는 1~20개여야 합니다.';
  end if;
  -- 존재하는 마디만 허용(미승인 마디는 승인 전까지 집계에 쓰이지 않음)
  if exists (
    select 1 from jsonb_array_elements(p_steps) e
    where not public._node_exists((e->>'node_id')::int)
  ) then
    raise exception '선택할 수 없는 마디가 포함되어 있습니다.';
  end if;

  delete from public.path_steps where contributor_id = v_cid;
  insert into public.path_steps (contributor_id, seq, node_id, start_year_bucket, visibility)
  select v_cid,
         t.ord::int,
         (t.e->>'node_id')::int,
         nullif(t.e->>'start_year_bucket', ''),
         coalesce(nullif(t.e->>'visibility', ''), 'aggregate_only')
  from jsonb_array_elements(p_steps) with ordinality as t(e, ord);

  -- 경로가 바뀌면 관리자 재검토 대상으로 돌립니다.
  update public.contributors set reviewed_at = null where id = v_cid;
  return v_count;
end $$;

-- 마디 제안: 목록에 없는 단계는 미승인 마디로 만들고, 관리자 승인 전에는 집계에 쓰이지 않습니다.
create function public.propose_node(p_stage public.stage, p_label text)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_label text := btrim(p_label);
  v_id int;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if char_length(v_label) < 2 or char_length(v_label) > 60 then
    raise exception '마디 이름은 2~60자여야 합니다.';
  end if;
  select id into v_id from public.nodes where stage = p_stage and label_type = v_label;
  if v_id is not null then
    return v_id;
  end if;
  if (select count(*) from public.nodes where created_by = auth.uid() and not approved) >= 10 then
    raise exception '승인 대기 중인 제안이 너무 많습니다.';
  end if;
  insert into public.nodes (stage, label_type, is_gate, approved, created_by)
  values (p_stage, v_label, p_stage = 'gate', false, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- 철회: 본인 기여자 행과 경로를 즉시 삭제(soft delete 아님). 본인이 제안한 미사용 미승인 마디도 삭제합니다.
create function public.withdraw_me()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  delete from public.contributors where user_id = auth.uid();  -- path_steps는 on delete cascade
  delete from public.nodes n
   where n.created_by = auth.uid() and not n.approved
     and not exists (select 1 from public.path_steps s where s.node_id = n.id);
end $$;

revoke execute on function public.register_contributor(int, text), public.save_my_path(jsonb),
  public.propose_node(public.stage, text), public.withdraw_me() from public, anon;
grant execute on function public.register_contributor(int, text), public.save_my_path(jsonb),
  public.propose_node(public.stage, text), public.withdraw_me() to authenticated;
