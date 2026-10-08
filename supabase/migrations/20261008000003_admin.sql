-- 운영 기반(Phase 4): 관리자 검토·마디 병합 RPC와 감사 로그
-- 모든 관리자 함수는 is_admin()을 확인하고, 변경 작업은 admin_audit_log에 기록합니다.
-- 관리자 지정은 SQL로만 합니다: insert into public.admins (user_id) values ('<auth.users.id>');

create function public._require_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception '관리자 권한이 필요합니다.';
  end if;
end $$;

create function public._audit(p_action text, p_detail jsonb) returns void
language sql security definer set search_path = public as $$
  insert into public.admin_audit_log (admin_id, action, detail) values (auth.uid(), p_action, p_detail);
$$;

-- 검토 대기열: 실제 기여자(합성 제외)의 경로. 이메일 등 계정 정보는 포함하지 않습니다.
create function public.admin_review_queue(p_limit int default 50)
returns table (
  contributor_id uuid,
  occupation_name text,
  created_at timestamptz,
  reviewed_at timestamptz,
  steps jsonb
) language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_admin();
  return query
  select c.id,
         o.name_ko,
         c.created_at,
         c.reviewed_at,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'seq', s.seq, 'stage', n.stage, 'label_type', n.label_type,
                    'start_year_bucket', s.start_year_bucket, 'approved', n.approved)
                  order by s.seq)
           from public.path_steps s join public.nodes n on n.id = s.node_id
           where s.contributor_id = c.id), '[]'::jsonb)
  from public.contributors c
  join public.occupations o on o.id = c.occupation_id
  where not c.is_synthetic
  order by c.reviewed_at nulls first, c.created_at desc
  limit least(greatest(p_limit, 1), 200);
end $$;

create function public.admin_mark_reviewed(p_contributor uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_admin();
  update public.contributors set reviewed_at = now() where id = p_contributor;
  perform public._audit('mark_reviewed', jsonb_build_object('contributor_id', p_contributor));
end $$;

create function public.admin_delete_contributor(p_contributor uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_admin();
  delete from public.contributors where id = p_contributor and not is_synthetic;
  perform public._audit('delete_contributor',
    jsonb_build_object('contributor_id', p_contributor, 'reason', p_reason));
end $$;

create function public.admin_pending_nodes()
returns table (id int, stage public.stage, label_type text, usage int, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_admin();
  return query
  select n.id, n.stage, n.label_type,
         (select count(distinct s.contributor_id)::int from public.path_steps s where s.node_id = n.id),
         n.created_at
  from public.nodes n
  where not n.approved
  order by n.created_at;
end $$;

create function public.admin_approve_node(p_node int)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_admin();
  update public.nodes set approved = true where id = p_node;
  perform public._audit('approve_node', jsonb_build_object('node_id', p_node));
end $$;

-- 마디 라벨 병합: p_from을 p_to로 합칩니다(같은 단계 유형끼리만).
create function public.admin_merge_nodes(p_from int, p_to int)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_from public.nodes%rowtype;
  v_to public.nodes%rowtype;
begin
  perform public._require_admin();
  select * into v_from from public.nodes where id = p_from;
  select * into v_to from public.nodes where id = p_to;
  if v_from.id is null or v_to.id is null or p_from = p_to then
    raise exception '병합할 마디를 찾을 수 없습니다.';
  end if;
  if v_from.stage <> v_to.stage then
    raise exception '같은 단계 유형의 마디끼리만 병합할 수 있습니다.';
  end if;
  update public.path_steps set node_id = p_to where node_id = p_from;
  update public.gate_stats set node_id = p_to where node_id = p_from;
  delete from public.nodes where id = p_from;
  perform public._audit('merge_nodes', jsonb_build_object(
    'from_id', p_from, 'from_label', v_from.label_type,
    'to_id', p_to, 'to_label', v_to.label_type));
end $$;

revoke execute on function
  public._require_admin(), public._audit(text, jsonb),
  public.admin_review_queue(int), public.admin_mark_reviewed(uuid),
  public.admin_delete_contributor(uuid, text), public.admin_pending_nodes(),
  public.admin_approve_node(int), public.admin_merge_nodes(int, int)
  from public, anon;
grant execute on function
  public.admin_review_queue(int), public.admin_mark_reviewed(uuid),
  public.admin_delete_contributor(uuid, text), public.admin_pending_nodes(),
  public.admin_approve_node(int), public.admin_merge_nodes(int, int)
  to authenticated;
