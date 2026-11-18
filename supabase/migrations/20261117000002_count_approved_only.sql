-- Only Approved Completed items count (spec 10.1): done numbers, valid, ranking. A Waiting item is
-- reported separately as waiting_records; a Returned one counts nowhere. Lists are unaffected.
-- dashboard_kpis gains a column, so it is dropped and created again with the same grants.
drop function public.dashboard_kpis();

CREATE FUNCTION public.dashboard_kpis()
 RETURNS TABLE(total_members integer, total_records integer, done_records integer, in_progress_records integer, not_started_records integer, active_certs integer, expiring_60_certs integer, expiring_soon_certs integer, expired_certs integer, no_expiry_certs integer, completion_done_records integer, completion_in_progress_records integer, waiting_records integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
begin
  if public.app_role() is null then
    raise exception 'the dashboard needs a signed-in user with a profile' using errcode = '42501';
  end if;
  return query
  with base as (
    select r.status,
           r.approval,
           c.kind,
           public.expiry_status(r.issued_date, c.validity_months, public.vn_today()) as expiry
    from public.training_records r
    join public.members m on m.id = r.member_id and m.is_active
    join public.certificates c on c.id = r.certificate_id
  )
  select
    (select count(*) from public.members where is_active)::int,
    (count(*) filter (where status <> 'done' or approval = 'approved'))::int,
    (count(*) filter (where status = 'done' and approval = 'approved'))::int,
    (count(*) filter (where status = 'in_progress'))::int,
    (count(*) filter (where status = 'not_started'))::int,
    (count(*) filter (where kind = 'exam' and status = 'done' and approval = 'approved' and expiry = 'Active'))::int,
    (count(*) filter (where kind = 'exam' and status = 'done' and approval = 'approved' and expiry = 'Expiring in 60d'))::int,
    (count(*) filter (where kind = 'exam' and status = 'done' and approval = 'approved' and expiry = 'Expiring Soon'))::int,
    (count(*) filter (where kind = 'exam' and status = 'done' and approval = 'approved' and expiry = 'Expired'))::int,
    (count(*) filter (where kind = 'exam' and status = 'done' and approval = 'approved' and expiry = 'No Expiry'))::int,
    (count(*) filter (where kind = 'completion' and status = 'done' and approval = 'approved'))::int,
    (count(*) filter (where kind = 'completion' and status = 'in_progress'))::int,
    (count(*) filter (where status = 'done' and approval = 'waiting'))::int
  from base;
end;
$function$;

revoke execute on function public.dashboard_kpis() from public, anon;
grant execute on function public.dashboard_kpis() to authenticated;
create or replace FUNCTION public.dashboard_breakdown(p_dimension text, p_limit integer DEFAULT NULL::integer)
 RETURNS TABLE(group_key text, group_label text, headcount integer, people integer, records integer, done integer, in_progress integer, not_started integer, valid integer, expired integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare
  v_role public.user_role := public.app_role();
begin
  if v_role is null then
    raise exception 'the dashboard needs a signed-in user with a profile' using errcode = '42501';
  end if;
  if p_dimension is null or p_dimension not in ('team', 'cert_type', 'provider', 'certificate') then
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
      coalesce(t.name, 'No team'),
      count(distinct m.id)::int,
      (count(distinct r.member_id) filter (where r.status <> 'done' or r.approval = 'approved'))::int,
      (count(r.id) filter (where r.status <> 'done' or r.approval = 'approved'))::int,
      (count(r.id) filter (where r.status = 'done' and r.approval = 'approved'))::int,
      (count(r.id) filter (where r.status = 'in_progress'))::int,
      (count(r.id) filter (where r.status = 'not_started'))::int,
      (count(r.id) filter (where r.status = 'done' and r.approval = 'approved' and c.kind = 'exam'
         and public.expiry_status(r.issued_date, c.validity_months, public.vn_today()) <> 'Expired'))::int,
      (count(r.id) filter (where r.status = 'done' and r.approval = 'approved' and c.kind = 'exam'
         and public.expiry_status(r.issued_date, c.validity_months, public.vn_today()) = 'Expired'))::int
    from public.members m
    left join public.teams t on t.id = m.team_id
    left join public.training_records r on r.member_id = m.id
    left join public.certificates c on c.id = r.certificate_id
    where m.is_active
    group by t.id, t.name
    order by count(r.id) filter (where r.status <> 'done' or r.approval = 'approved') desc, coalesce(t.name, 'No team'), coalesce(t.id::text, 'none')
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
        when 'cert_type' then coalesce(ct.name, 'Uncategorised')
        when 'provider' then coalesce(p.name, 'Unknown provider')
        else c.name
      end as glabel,
      m.id as member_id,
      r.status,
      r.approval,
      c.kind,
      public.expiry_status(r.issued_date, c.validity_months, public.vn_today()) as expiry
    from public.training_records r
    join public.members m on m.id = r.member_id and m.is_active
    join public.certificates c on c.id = r.certificate_id
    left join public.cert_types ct on ct.id = c.cert_type_id
    left join public.providers p on p.id = c.provider_id
  ),
  agg as (
    select
      gkey,
      glabel,
      -- A learner whose only items wait or were returned counts nowhere yet, so not toward the privacy threshold either.
      (count(distinct member_id) filter (where status <> 'done' or approval = 'approved'))::int as people,
      (count(*) filter (where status <> 'done' or approval = 'approved'))::int as records,
      (count(*) filter (where status = 'done' and approval = 'approved'))::int as done,
      (count(*) filter (where status = 'in_progress'))::int as in_progress,
      (count(*) filter (where status = 'not_started'))::int as not_started,
      (count(*) filter (where status = 'done' and approval = 'approved' and kind = 'exam' and expiry <> 'Expired'))::int as valid,
      (count(*) filter (where status = 'done' and approval = 'approved' and kind = 'exam' and expiry = 'Expired'))::int as expired
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
$function$;

CREATE OR REPLACE FUNCTION public.dashboard_ranking()
 RETURNS TABLE(member_id uuid, member_code text, full_name text, team_name text, valid_certs integer, done_certs integer, in_progress integer, rank integer)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
#variable_conflict use_column
begin
  if public.app_role() is distinct from 'admin' and public.app_role() is distinct from 'manager' then
    raise exception 'the ranking is only for admins and managers' using errcode = '42501';
  end if;
  return query
  with per_member as (
    select m.id as mid, m.code as mcode, m.full_name as mname, t.name as tname,
      (count(r.id) filter (where r.status = 'done' and r.approval = 'approved' and c.kind = 'exam'
         and public.expiry_status(r.issued_date, c.validity_months, public.vn_today()) <> 'Expired'))::int as nvalid,
      (count(r.id) filter (where r.status = 'done' and r.approval = 'approved' and c.kind = 'exam'))::int as ndone,
      (count(r.id) filter (where r.status = 'in_progress'))::int as nprogress
    from public.members m
    left join public.teams t on t.id = m.team_id
    left join public.training_records r on r.member_id = m.id
    left join public.certificates c on c.id = r.certificate_id
    where m.is_active
    group by m.id, m.code, m.full_name, t.name
  )
  select mid, mcode, mname, tname, nvalid, ndone, nprogress,
         (dense_rank() over (order by nvalid desc, ndone desc))::int
  from per_member
  order by 8, mname, mid;
end;
$function$;
