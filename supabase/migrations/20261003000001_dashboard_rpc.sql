-- Dashboard aggregates (spec §5, §6.2). See decisions.md #30–#32.
-- `#variable_conflict use_column`: the RETURNS TABLE column names (done, records, …) are also the
-- aliases used inside the queries; without it plpgsql reports "column reference is ambiguous".

-- Org-wide numbers for every signed-in role. SECURITY DEFINER because a Member's RLS shows only
-- their own rows. Numbers only: no name, no email, no id leaves this function.
create function public.dashboard_kpis()
returns table (
  total_members int,
  total_records int,
  done_records int,
  in_progress_records int,
  not_started_records int,
  active_certs int,
  expiring_60_certs int,
  expiring_soon_certs int,
  expired_certs int,
  no_expiry_certs int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if public.app_role() is null then
    raise exception 'the dashboard needs a signed-in user with a profile' using errcode = '42501';
  end if;

  return query
  with base as (
    select r.status,
           public.expiry_status(r.issued_date, c.validity_months, public.vn_today()) as expiry
    from public.training_records r
    join public.members m on m.id = r.member_id and m.is_active
    join public.courses c on c.id = r.course_id
  )
  select
    (select count(*) from public.members where is_active)::int,
    count(*)::int,
    (count(*) filter (where status = 'done'))::int,
    (count(*) filter (where status = 'in_progress'))::int,
    (count(*) filter (where status = 'not_started'))::int,
    (count(*) filter (where status = 'done' and expiry = 'Active'))::int,
    (count(*) filter (where status = 'done' and expiry = 'Expiring in 60d'))::int,
    (count(*) filter (where status = 'done' and expiry = 'Expiring Soon'))::int,
    (count(*) filter (where status = 'done' and expiry = 'Expired'))::int,
    (count(*) filter (where status = 'done' and expiry = 'No Expiry'))::int
  from base;
end;
$$;

-- Group statistics. Members never get per-team numbers, and any group with fewer than 3 distinct
-- learners is hidden from them (a group of one would identify that person).
create function public.dashboard_breakdown(p_dimension text, p_limit int default null)
returns table (
  group_key text,
  group_label text,
  headcount int,
  people int,
  records int,
  done int,
  in_progress int,
  not_started int,
  valid int,
  expired int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_role public.user_role := public.app_role();
begin
  if v_role is null then
    raise exception 'the dashboard needs a signed-in user with a profile' using errcode = '42501';
  end if;
  if p_dimension is null or p_dimension not in ('team', 'cert_type', 'provider', 'course') then
    raise exception 'unknown dimension %', p_dimension using errcode = '22023';
  end if;
  if p_limit is not null and p_limit < 1 then
    raise exception 'p_limit must be at least 1' using errcode = '22023';
  end if;

  if p_dimension = 'team' then
    if v_role = 'member' then
      return;
    end if;
    -- Starts from members so a team whose members have no records yet still shows (0%).
    return query
    select
      coalesce(t.id::text, 'none'),
      coalesce(t.name, 'Chưa có team'),
      count(distinct m.id)::int,
      count(distinct r.member_id)::int,
      count(r.id)::int,
      (count(r.id) filter (where r.status = 'done'))::int,
      (count(r.id) filter (where r.status = 'in_progress'))::int,
      (count(r.id) filter (where r.status = 'not_started'))::int,
      (count(r.id) filter (where r.status = 'done'
         and public.expiry_status(r.issued_date, c.validity_months, public.vn_today()) <> 'Expired'))::int,
      (count(r.id) filter (where r.status = 'done'
         and public.expiry_status(r.issued_date, c.validity_months, public.vn_today()) = 'Expired'))::int
    from public.members m
    left join public.teams t on t.id = m.team_id
    left join public.training_records r on r.member_id = m.id
    left join public.courses c on c.id = r.course_id
    where m.is_active
    group by t.id, t.name
    order by count(r.id) desc, coalesce(t.name, 'Chưa có team'), coalesce(t.id::text, 'none')
    limit p_limit;
    return;
  end if;

  return query
  with base as (
    select
      case p_dimension
        when 'cert_type' then coalesce(ct.id::text, 'none')
        when 'provider' then coalesce(p.id::text, 'none')
        else c.id::text
      end as gkey,
      case p_dimension
        when 'cert_type' then coalesce(ct.name, 'Chưa phân loại')
        when 'provider' then coalesce(p.name, 'Chưa rõ nhà cung cấp')
        else c.name
      end as glabel,
      m.id as member_id,
      r.status,
      public.expiry_status(r.issued_date, c.validity_months, public.vn_today()) as expiry
    from public.training_records r
    join public.members m on m.id = r.member_id and m.is_active
    join public.courses c on c.id = r.course_id
    left join public.cert_types ct on ct.id = c.cert_type_id
    left join public.providers p on p.id = c.provider_id
  ),
  agg as (
    select
      gkey,
      glabel,
      count(distinct member_id)::int as people,
      count(*)::int as records,
      (count(*) filter (where status = 'done'))::int as done,
      (count(*) filter (where status = 'in_progress'))::int as in_progress,
      (count(*) filter (where status = 'not_started'))::int as not_started,
      (count(*) filter (where status = 'done' and expiry <> 'Expired'))::int as valid,
      (count(*) filter (where status = 'done' and expiry = 'Expired'))::int as expired
    from base
    group by gkey, glabel
  )
  select agg.gkey, agg.glabel, null::int, agg.people, agg.records, agg.done, agg.in_progress,
         agg.not_started, agg.valid, agg.expired
  from agg
  where v_role <> 'member' or agg.people >= 3
  order by agg.records desc, agg.glabel, agg.gkey
  limit p_limit;
end;
$$;

-- Personal ranking. SECURITY INVOKER on purpose: RLS already gives Admin every member and Manager
-- only their teams (decision #32); the role check refuses Member, whose RLS would show them
-- their own row.
create function public.dashboard_ranking()
returns table (
  member_id uuid,
  member_code text,
  full_name text,
  team_name text,
  valid_certs int,
  done_certs int,
  in_progress int,
  rank int
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
begin
  if public.app_role() is distinct from 'admin' and public.app_role() is distinct from 'manager' then
    raise exception 'the ranking is only for admins and managers' using errcode = '42501';
  end if;

  return query
  with per_member as (
    select m.id as mid, m.code as mcode, m.full_name as mname, t.name as tname,
      (count(r.id) filter (where r.status = 'done'
         and public.expiry_status(r.issued_date, c.validity_months, public.vn_today()) <> 'Expired'))::int as nvalid,
      (count(r.id) filter (where r.status = 'done'))::int as ndone,
      (count(r.id) filter (where r.status = 'in_progress'))::int as nprogress
    from public.members m
    left join public.teams t on t.id = m.team_id
    left join public.training_records r on r.member_id = m.id
    left join public.courses c on c.id = r.course_id
    where m.is_active
    group by m.id, m.code, m.full_name, t.name
  )
  select mid, mcode, mname, tname, nvalid, ndone, nprogress,
         (dense_rank() over (order by nvalid desc, ndone desc))::int
  from per_member
  order by 8, mname, mid;
end;
$$;

-- Supabase grants EXECUTE on new functions to anon by default: take it away explicitly.
revoke execute on function public.dashboard_kpis() from public, anon;
revoke execute on function public.dashboard_breakdown(text, int) from public, anon;
revoke execute on function public.dashboard_ranking() from public, anon;
grant execute on function public.dashboard_kpis() to authenticated;
grant execute on function public.dashboard_breakdown(text, int) to authenticated;
grant execute on function public.dashboard_ranking() to authenticated;
