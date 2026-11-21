-- Fixes on top of 20261118000001-3 (renewal, member delete, member proposals):
-- 1. A pending or rejected proposal is seen only by its proposer, the proposer's managers and the admin.
-- 2. approve_certificate: one admin step that turns the typed provider into a provider and, for a course
--    completion, creates the course that grants it, so the catalogue CHECKs hold once it is approved.
-- 3. A Completed item replaced by a later approved renewal of the same certificate counts nowhere
--    (it stays in lists as history): counted_approval() feeds the dashboards, v_training_records.renewed the app.
-- 4. commit_import updates the same record the preview matched: the active attempt, else the latest Completed one.

-- 1. Visibility of proposals
drop policy "certificates: authenticated read" on public.certificates;
create policy "certificates: read approved or own proposals" on public.certificates
  for select to authenticated
  using (
    catalogue_status = 'approved'
    or (select public.app_role()) = 'admin'
    or proposed_by = (select public.my_member_id())
    or proposed_by in (select public.managed_member_ids())
  );

-- 3. Renewal: a later approved Completed record of the same member and certificate replaces this one.
create function public.is_renewed(r public.training_records)
returns boolean
language sql
stable
set search_path = ''
as $$
  select r.status = 'done' and r.issued_date is not null and exists (
    select 1 from public.training_records n
    where n.member_id = r.member_id and n.certificate_id = r.certificate_id
      and n.status = 'done' and n.approval = 'approved' and n.issued_date > r.issued_date
  );
$$;

-- The approval a count looks at: a renewed record behaves like one nobody approved, so it counts nowhere.
create function public.counted_approval(r public.training_records)
returns public.approval_state
language sql
stable
set search_path = ''
as $$
  select case when public.is_renewed(r) then null else r.approval end;
$$;

create or replace view public.v_training_records
with (security_invoker = true)
as
select
  r.id, r.member_id, r.course_id, r.status, r.progress, r.planned_exam_date, r.issued_date,
  r.certificate_url, r.evidence_path, r.via_company, r.refund_status, r.notes,
  r.progress_updated_at, r.created_by, r.created_at, r.updated_at, r.certificate_id,
  ce.name as certificate_name,
  ce.kind as certificate_kind,
  co.name as course_name,
  ce.validity_months,
  e.expiry_date,
  e.expiry_date - public.vn_today() as days_to_expiry,
  case when ce.kind = 'completion' then 'No Expiry'
       else public.expiry_status(r.issued_date, ce.validity_months, public.vn_today()) end as expiry_status,
  m.code as member_code,
  m.full_name as member_name,
  m.email::text as member_email,
  m.team_id,
  t.name as team_name,
  ce.cert_type_id,
  ct.name as cert_type_name,
  ce.provider_id,
  coalesce(p.name, ce.proposed_provider) as provider_name,
  co.cost,
  co.cost_currency,
  co.est_hours,
  r.approval,
  r.approval_note,
  ce.catalogue_status as certificate_catalogue_status,
  public.is_renewed(r) as renewed
from public.training_records r
join public.certificates ce on ce.id = r.certificate_id
left join public.courses co on co.id = r.course_id
join public.members m on m.id = r.member_id
left join public.teams t on t.id = m.team_id
left join public.cert_types ct on ct.id = ce.cert_type_id
left join public.providers p on p.id = ce.provider_id
cross join lateral (
  select case
    when ce.kind = 'exam' and r.issued_date is not null and ce.validity_months is not null
      then (r.issued_date + make_interval(months => ce.validity_months))::date
  end as expiry_date
) e;

-- Dashboards: same bodies as 20261117000002, counting through counted_approval().

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
      (count(distinct r.member_id) filter (where r.status <> 'done' or public.counted_approval(r) = 'approved'))::int,
      (count(r.id) filter (where r.status <> 'done' or public.counted_approval(r) = 'approved'))::int,
      (count(r.id) filter (where r.status = 'done' and public.counted_approval(r) = 'approved'))::int,
      (count(r.id) filter (where r.status = 'in_progress'))::int,
      (count(r.id) filter (where r.status = 'not_started'))::int,
      (count(r.id) filter (where r.status = 'done' and public.counted_approval(r) = 'approved' and c.kind = 'exam'
         and public.expiry_status(r.issued_date, c.validity_months, public.vn_today()) <> 'Expired'))::int,
      (count(r.id) filter (where r.status = 'done' and public.counted_approval(r) = 'approved' and c.kind = 'exam'
         and public.expiry_status(r.issued_date, c.validity_months, public.vn_today()) = 'Expired'))::int
    from public.members m
    left join public.teams t on t.id = m.team_id
    left join public.training_records r on r.member_id = m.id
    left join public.certificates c on c.id = r.certificate_id
    where m.is_active
    group by t.id, t.name
    order by count(r.id) filter (where r.status <> 'done' or public.counted_approval(r) = 'approved') desc, coalesce(t.name, 'No team'), coalesce(t.id::text, 'none')
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
      public.counted_approval(r) as approval,
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
      (count(r.id) filter (where r.status = 'done' and public.counted_approval(r) = 'approved' and c.kind = 'exam'
         and public.expiry_status(r.issued_date, c.validity_months, public.vn_today()) <> 'Expired'))::int as nvalid,
      (count(r.id) filter (where r.status = 'done' and public.counted_approval(r) = 'approved' and c.kind = 'exam'))::int as ndone,
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

-- 4. Import: same body as 20261118000001, one deterministic match per member and certificate.
create or replace function public.commit_import(p_batch_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_batch public.import_batches;
  v_row record;
  n jsonb;
  r jsonb;
  v_member_id uuid;
  v_cert_id uuid;
  v_course_id uuid;
  v_studied_id uuid;
  v_provider_id uuid;
  v_cert_type_id uuid;
  v_existing_id uuid;
  v_inserted boolean;
  v_created int := 0;
  v_updated int := 0;
  v_skipped int := 0;
  v_stored bigint;
  v_new_members int := 0;
  v_new_courses int := 0;
  v_summary jsonb;
begin
  if public.app_role() is distinct from 'admin' then
    raise exception 'only admins can commit an import' using errcode = '42501';
  end if;

  select * into v_batch from public.import_batches where id = p_batch_id for update;
  if not found then
    raise exception 'import batch not found' using errcode = 'P0002';
  end if;
  if v_batch.status = 'committed' then
    return v_batch.summary;
  end if;
  if v_batch.status = 'discarded' then
    raise exception 'import batch was discarded' using errcode = '55000';
  end if;

  select count(*) into v_stored from public.import_rows where batch_id = p_batch_id;
  if v_stored <> v_batch.expected_rows then
    raise exception 'import batch is incomplete: % of % rows stored', v_stored, v_batch.expected_rows
      using errcode = '22023';
  end if;

  for v_row in
    select row_no, action, normalized from public.import_rows where batch_id = p_batch_id order by row_no
  loop
    if v_row.action = 'skip' then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    -- Reset every loop
    v_member_id := null;
    v_cert_id := null;
    v_course_id := null;
    v_provider_id := null;
    v_cert_type_id := null;
    v_existing_id := null;
    n := v_row.normalized;
    r := n->'record';

    begin
      -- Inside the block so a malformed id keeps the "import row N:" prefix.
      v_studied_id := (n->'courseStudied'->>'id')::uuid;
      if n->'member' ? 'id' then
        v_member_id := (n->'member'->>'id')::uuid;
      else
        insert into public.members (full_name, email, team_id)
        values (n->'member'->>'fullName', (n->'member'->>'email')::extensions.citext, (n->'member'->>'teamId')::uuid)
        on conflict (email) do nothing
        returning id into v_member_id;
        if v_member_id is null then
          select id into v_member_id from public.members
            where email operator(extensions.=) (n->'member'->>'email')::extensions.citext;
        else
          v_new_members := v_new_members + 1;
        end if;
      end if;

      if n->'course' ? 'id' then
        v_cert_id := (n->'course'->>'id')::uuid;
      else
        if n->'course'->'provider' ? 'id' then
          v_provider_id := (n->'course'->'provider'->>'id')::uuid;
        else
          insert into public.providers (name) values (n->'course'->'provider'->>'name')
          on conflict (name) do nothing
          returning id into v_provider_id;
          if v_provider_id is null then
            select id into v_provider_id from public.providers where name = n->'course'->'provider'->>'name';
          end if;
        end if;

        if jsonb_typeof(n->'course'->'certType') = 'object' then
          if n->'course'->'certType' ? 'id' then
            v_cert_type_id := (n->'course'->'certType'->>'id')::uuid;
          else
            insert into public.cert_types (name) values (n->'course'->'certType'->>'name')
            on conflict (name) do nothing
            returning id into v_cert_type_id;
            if v_cert_type_id is null then
              select id into v_cert_type_id from public.cert_types where name = n->'course'->'certType'->>'name';
            end if;
          end if;
        end if;

        insert into public.certificates (name, kind, provider_id, cert_type_id, validity_months)
        values (n->'course'->>'name', 'exam', v_provider_id, v_cert_type_id, (n->'course'->>'validityMonths')::int)
        on conflict (provider_id, name) do nothing
        returning id into v_cert_id;
        if v_cert_id is null then
          select id into v_cert_id from public.certificates
            where provider_id = v_provider_id and name = n->'course'->>'name';
        else
          v_new_courses := v_new_courses + 1;
        end if;

        -- Cost, currency or hours on the row: the course studied is a self-preparing course (created once).
        if n->'course'->>'cost' is not null or n->'course'->>'costCurrency' is not null
           or n->'course'->>'estHours' is not null then
          insert into public.courses (name, provider_id, cost, cost_currency, est_hours, prepares_for_id)
          values (n->'course'->>'name', v_provider_id, (n->'course'->>'cost')::numeric,
                  n->'course'->>'costCurrency', (n->'course'->>'estHours')::int, v_cert_id)
          on conflict (provider_id, name) do nothing
          returning id into v_course_id;
          if v_course_id is null then
            select id into v_course_id from public.courses
              where provider_id = v_provider_id and name = n->'course'->>'name' and prepares_for_id = v_cert_id;
          end if;
        end if;
      end if;

      -- One row per member and certificate in the sheet: update the record the preview matched
      -- (src/features/import/plan.ts preferredRecord): the active attempt, else the latest Completed one.
      select id into v_existing_id from public.training_records
        where member_id = v_member_id and certificate_id = v_cert_id
        order by (status <> 'done') desc, issued_date desc nulls last, id desc
        limit 1;

      if v_existing_id is not null then
        update public.training_records set
          course_id = coalesce(v_studied_id, v_course_id, course_id),
          status = (r->>'status')::public.record_status,
          progress = (r->>'progress')::int,
          planned_exam_date = coalesce((r->>'plannedExamDate')::date, planned_exam_date),
          issued_date = coalesce((r->>'issuedDate')::date, issued_date),
          certificate_url = coalesce(r->>'certificateUrl', certificate_url),
          via_company = coalesce((r->>'viaCompany')::boolean, via_company),
          refund_status = coalesce((r->>'refundStatus')::public.refund_status, refund_status),
          notes = coalesce(r->>'notes', notes)
        where id = v_existing_id;
        v_inserted := false;
      else
        insert into public.training_records (
          member_id, certificate_id, course_id, status, progress, planned_exam_date, issued_date,
          certificate_url, via_company, refund_status, notes
        ) values (
          v_member_id, v_cert_id, coalesce(v_studied_id, v_course_id),
          (r->>'status')::public.record_status,
          (r->>'progress')::int,
          (r->>'plannedExamDate')::date,
          (r->>'issuedDate')::date,
          r->>'certificateUrl',
          coalesce((r->>'viaCompany')::boolean, false),
          coalesce((r->>'refundStatus')::public.refund_status, 'n_a'),
          r->>'notes'
        );
        v_inserted := true;
      end if;
    exception when others then
      raise exception 'import row %: %', v_row.row_no, sqlerrm using errcode = sqlstate;
    end;

    if v_inserted then
      v_created := v_created + 1;
    else
      v_updated := v_updated + 1;
    end if;
  end loop;

  v_summary := jsonb_build_object(
    'created', v_created, 'updated', v_updated, 'skipped', v_skipped,
    'newMembers', v_new_members, 'newCourses', v_new_courses);
  update public.import_batches
    set status = 'committed', summary = v_summary, committed_at = now()
    where id = p_batch_id;
  return v_summary;
end;
$$;

revoke execute on function public.commit_import(uuid) from public, anon;
grant execute on function public.commit_import(uuid) to authenticated;

-- 2. Approve a member's proposal (admin only; RLS "certificates: admin write" also applies).
create function public.approve_certificate(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cert public.certificates;
  v_provider_id uuid;
  v_course_id uuid;
begin
  if public.app_role() is distinct from 'admin' then
    raise exception 'only admins can approve a proposal' using errcode = '42501';
  end if;
  select * into v_cert from public.certificates where id = p_id and catalogue_status = 'pending' for update;
  if not found then
    raise exception 'proposal not found or already reviewed' using errcode = 'P0002';
  end if;

  v_provider_id := v_cert.provider_id;
  if v_provider_id is null then
    if nullif(btrim(v_cert.proposed_provider), '') is null then
      raise exception 'choose a provider before approving' using errcode = '23502';
    end if;
    insert into public.providers (name) values (btrim(v_cert.proposed_provider))
    on conflict (name) do nothing
    returning id into v_provider_id;
    if v_provider_id is null then
      select id into v_provider_id from public.providers where name = btrim(v_cert.proposed_provider);
    end if;
  end if;

  -- A course completion is granted by a course of the same name (catalogue rule, decision #65).
  v_course_id := v_cert.course_id;
  if v_cert.kind = 'completion' and v_course_id is null then
    insert into public.courses (name, provider_id) values (v_cert.name, v_provider_id)
    on conflict (provider_id, name) do nothing
    returning id into v_course_id;
    if v_course_id is null then
      select id into v_course_id from public.courses where provider_id = v_provider_id and name = v_cert.name;
    end if;
  end if;

  update public.certificates set
    provider_id = v_provider_id,
    course_id = v_course_id,
    proposed_provider = null,
    catalogue_status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = now()
  where id = p_id;
end;
$$;

revoke execute on function public.approve_certificate(uuid) from public, anon;
grant execute on function public.approve_certificate(uuid) to authenticated;
