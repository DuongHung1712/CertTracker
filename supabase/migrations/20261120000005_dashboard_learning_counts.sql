-- The journey (in progress / not started / planned exams) is counted from learning_items (decision #72, spec §5.3).
-- Certificate counts keep reading training_records. Signatures and return columns are unchanged.

CREATE OR REPLACE FUNCTION public.dashboard_kpis()
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
           public.counted_approval(r) as approval,
           c.kind,
           public.expiry_status(r.issued_date, c.validity_months, public.vn_today()) as expiry
    from public.training_records r
    join public.members m on m.id = r.member_id and m.is_active
    join public.certificates c on c.id = r.certificate_id
  ),
  journey as (
    select li.status, li.course_id
    from public.learning_items li
    join public.members m on m.id = li.member_id and m.is_active
  )
  select
    (select count(*) from public.members where is_active)::int,
    (count(*) filter (where status = 'done' and approval = 'approved'))::int,
    (count(*) filter (where status = 'done' and approval = 'approved'))::int,
    (select count(*) from journey where status = 'in_progress')::int,
    (select count(*) from journey where status = 'not_started')::int,
    (count(*) filter (where kind = 'exam' and status = 'done' and approval = 'approved' and expiry = 'Active'))::int,
    (count(*) filter (where kind = 'exam' and status = 'done' and approval = 'approved' and expiry = 'Expiring in 60d'))::int,
    (count(*) filter (where kind = 'exam' and status = 'done' and approval = 'approved' and expiry = 'Expiring Soon'))::int,
    (count(*) filter (where kind = 'exam' and status = 'done' and approval = 'approved' and expiry = 'Expired'))::int,
    (count(*) filter (where kind = 'exam' and status = 'done' and approval = 'approved' and expiry = 'No Expiry'))::int,
    (count(*) filter (where kind = 'completion' and status = 'done' and approval = 'approved'))::int,
    (select count(*) from journey where course_id is not null and status <> 'done')::int,
    (count(*) filter (where status = 'done' and approval = 'waiting'))::int
  from base;
end;
$function$;

CREATE OR REPLACE FUNCTION public.dashboard_breakdown(p_dimension text, p_limit integer DEFAULT NULL::integer)
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
  if p_dimension = 'team' and v_role = 'member' then
    return;
  end if;

  -- One row per counted thing: an approved certificate (src 'cert') or an open learning item (src 'learn').
  return query
  with items as (
    select r.member_id, r.certificate_id as cert_id, 'cert'::text as src, r.status,
           public.counted_approval(r) as approval,
           public.expiry_status(r.issued_date, c.validity_months, public.vn_today()) as expiry,
           c.kind
    from public.training_records r
    join public.certificates c on c.id = r.certificate_id
    union all
    select li.member_id, li.target_certificate_id, 'learn', li.status, null, null, 'exam'::public.certificate_kind
    from public.learning_items li
    where li.status <> 'done'
  ),
  counted as (
    select i.*,
      (i.src = 'learn' or (i.status = 'done' and i.approval = 'approved')) as is_counted
    from items i
  ),
  base as (
    select
      case p_dimension
        when 'team' then coalesce(t.id::text, 'none')
        when 'cert_type' then coalesce(ct.id::text, 'none')
        when 'provider' then coalesce(p.id::text, 'none')
        else coalesce(c.id::text, 'none')
      end as gkey,
      case p_dimension
        when 'team' then coalesce(t.name, 'No team')
        when 'cert_type' then coalesce(ct.name, 'Uncategorised')
        when 'provider' then coalesce(p.name, 'Unknown provider')
        else coalesce(c.name, 'No exam target')
      end as glabel,
      x.member_id, x.src, x.status, x.approval, x.expiry, x.kind, x.is_counted
    from counted x
    join public.members m on m.id = x.member_id and m.is_active
    left join public.teams t on t.id = m.team_id
    left join public.certificates c on c.id = x.cert_id
    left join public.cert_types ct on ct.id = c.cert_type_id
    left join public.providers p on p.id = c.provider_id
    -- Course-only learning items have no certificate dimension; they still count per team.
    where p_dimension = 'team' or x.cert_id is not null
  ),
  agg as (
    select
      gkey, glabel,
      (count(distinct member_id) filter (where is_counted))::int as people,
      (count(*) filter (where is_counted))::int as records,
      (count(*) filter (where src = 'cert' and status = 'done' and approval = 'approved'))::int as done,
      (count(*) filter (where src = 'learn' and status = 'in_progress'))::int as in_progress,
      (count(*) filter (where src = 'learn' and status = 'not_started'))::int as not_started,
      (count(*) filter (where src = 'cert' and status = 'done' and approval = 'approved' and kind = 'exam' and expiry <> 'Expired'))::int as valid,
      (count(*) filter (where src = 'cert' and status = 'done' and approval = 'approved' and kind = 'exam' and expiry = 'Expired'))::int as expired
    from base
    group by gkey, glabel
  ),
  heads as (
    -- Teams show even when nobody has anything yet (0%).
    select coalesce(t.id::text, 'none') as gkey, coalesce(t.name, 'No team') as glabel, count(*)::int as headcount
    from public.members m
    left join public.teams t on t.id = m.team_id
    where m.is_active
    group by t.id, t.name
  )
  select
    coalesce(a.gkey, h.gkey), coalesce(a.glabel, h.glabel),
    case when p_dimension = 'team' then coalesce(h.headcount, 0) end,
    coalesce(a.people, 0), coalesce(a.records, 0), coalesce(a.done, 0), coalesce(a.in_progress, 0),
    coalesce(a.not_started, 0), coalesce(a.valid, 0), coalesce(a.expired, 0)
  from agg a
  full join heads h on p_dimension = 'team' and h.gkey = a.gkey
  where (p_dimension = 'team' or a.gkey is not null)
    and (v_role <> 'member' or coalesce(a.people, 0) >= 3)
  order by coalesce(a.records, 0) desc, coalesce(a.glabel, h.glabel), coalesce(a.gkey, h.gkey)
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
      (count(r.id) filter (where r.status = 'done' and public.counted_approval(r) = 'approved' and c.kind = 'exam'
         and public.expiry_status(r.issued_date, c.validity_months, public.vn_today()) <> 'Expired'))::int as nvalid,
      (count(r.id) filter (where r.status = 'done' and public.counted_approval(r) = 'approved' and c.kind = 'exam'))::int as ndone,
      (select count(*) from public.learning_items li where li.member_id = m.id and li.status = 'in_progress')::int as nprogress
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

-- Overdue planned exams come from learning items with an exam target (same column contract).
create or replace view public.v_data_quality_issues
with (security_invoker = true)
as
select
  'overdue_exam'::text as issue_type,
  'warning'::text as severity,
  li.id as subject_id,
  li.member_id,
  m.code as member_code,
  m.full_name as member_name,
  m.team_id,
  t.name as team_name,
  li.target_certificate_id as certificate_id,
  c.name as certificate_name,
  li.id as record_id,
  li.planned_date as since,
  public.vn_today() - li.planned_date as days
from public.learning_items li
join public.members m on m.id = li.member_id
join public.certificates c on c.id = li.target_certificate_id
left join public.teams t on t.id = m.team_id
where m.is_active
  and li.status <> 'done'
  and li.planned_date < public.vn_today()

union all
select
  'done_no_evidence', 'warning',
  r.id, r.member_id, m.code, m.full_name, m.team_id, t.name,
  r.certificate_id, c.name, r.id,
  r.issued_date,
  public.vn_today() - r.issued_date
from public.training_records r
join public.members m on m.id = r.member_id
join public.certificates c on c.id = r.certificate_id
left join public.teams t on t.id = m.team_id
where m.is_active
  and r.status = 'done'
  and r.evidence_path is null
  and nullif(btrim(r.certificate_url), '') is null

union all
select
  'member_no_team', 'warning',
  m.id, m.id, m.code, m.full_name, null::uuid, null::text,
  null::uuid, null::text, null::uuid,
  (m.created_at at time zone 'Asia/Ho_Chi_Minh')::date,
  public.vn_today() - (m.created_at at time zone 'Asia/Ho_Chi_Minh')::date
from public.members m
where m.is_active
  and m.team_id is null
  and (select public.app_role()) = 'admin'

union all
select
  'certificate_no_validity', 'info',
  c.id, null::uuid, null::text, null::text, null::uuid, null::text,
  c.id, c.name, null::uuid,
  (c.created_at at time zone 'Asia/Ho_Chi_Minh')::date,
  public.vn_today() - (c.created_at at time zone 'Asia/Ho_Chi_Minh')::date
from public.certificates c
where c.kind = 'exam'
  and c.validity_months is null
  and (select public.app_role()) = 'admin'
  and exists (select 1 from public.training_records r where r.certificate_id = c.id);
