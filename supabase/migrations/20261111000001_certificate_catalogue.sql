-- Certificates and courses become two catalogues (spec 2026-11-10-certificate-catalogue-design.md, decision #65).
-- A certificate is what a member holds (exam or course completion); a course is how a member studies.
-- Every existing course row becomes an exam certificate with the SAME id, so old links keep working.

create type public.certificate_kind as enum ('exam', 'completion');

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  kind public.certificate_kind not null,
  cert_type_id uuid references public.cert_types (id) on delete restrict,
  provider_id uuid references public.providers (id) on delete restrict,
  level text,
  validity_months int check (validity_months is null or validity_months > 0),
  url text,
  course_id uuid unique references public.courses (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, name),
  constraint certificates_completion_has_course check ((kind = 'completion') = (course_id is not null))
);
create trigger certificates_set_updated_at before update on public.certificates
  for each row execute function public.set_updated_at();

alter table public.courses
  add column prepares_for_id uuid references public.certificates (id) on delete set null;
create index courses_prepares_for_id_idx on public.courses (prepares_for_id);

-- prepares_for must be an exam: a completion is granted by a course, it is not prepared for.
create function public.courses_prepares_for_exam()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.prepares_for_id is not null and not exists (
    select 1 from public.certificates where id = new.prepares_for_id and kind = 'exam'
  ) then
    raise exception 'prepares_for must be an exam certificate' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger courses_prepares_for_exam before insert or update of prepares_for_id on public.courses
  for each row execute function public.courses_prepares_for_exam();

-- RLS: everyone signed in reads, only admins write (same as courses).
alter table public.certificates enable row level security;
create policy "certificates: authenticated read" on public.certificates
  for select to authenticated using (true);
create policy "certificates: admin write" on public.certificates
  for all to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');

-- 1. Copy: same ids, all exams.
insert into public.certificates (id, name, kind, cert_type_id, provider_id, level, validity_months, url)
select id, name, 'exam', cert_type_id, provider_id, level, validity_months, url from public.courses;

-- 2. Records point at the certificate; course_id becomes the optional "course studied".
alter table public.training_records add column certificate_id uuid references public.certificates (id) on delete restrict;
update public.training_records set certificate_id = course_id;
alter table public.training_records
  alter column certificate_id set not null,
  alter column course_id drop not null,
  drop constraint training_records_member_course_key,
  add constraint training_records_member_certificate_key unique (member_id, certificate_id),
  drop constraint training_records_course_id_fkey,
  add constraint training_records_course_id_fkey foreign key (course_id) references public.courses (id) on delete set null;
create index training_records_certificate_id_idx on public.training_records (certificate_id);

-- 3. Keep as courses only the rows that carry course data or a record; each prepares for itself.
delete from public.courses c
where c.cost is null and c.est_hours is null and c.refund_conditions is null and not c.refundable
  and not exists (select 1 from public.training_records r where r.course_id = c.id);
update public.courses set prepares_for_id = id;

-- A completion record gets the granting course; an exam record has no course or one that prepares for it.
-- Validates on insert and only when certificate_id or course_id changes, so a record stays editable
-- (status, progress) after an admin changes "Prepares for".
create function public.training_records_course_matches_certificate()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_kind public.certificate_kind;
  v_granting uuid;
begin
  if tg_op = 'UPDATE'
     and new.certificate_id is not distinct from old.certificate_id
     and new.course_id is not distinct from old.course_id then
    return new;
  end if;
  select kind, course_id into v_kind, v_granting from public.certificates where id = new.certificate_id;
  if v_kind = 'completion' then
    new.course_id := v_granting;
  elsif v_kind = 'exam' and new.course_id is not null and not exists (
    select 1 from public.courses where id = new.course_id and prepares_for_id = new.certificate_id
  ) then
    raise exception 'course does not prepare for this certificate' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger training_records_course_matches_certificate
  before insert or update of certificate_id, course_id on public.training_records
  for each row execute function public.training_records_course_matches_certificate();

-- 4. Views and functions that read the dropped courses columns.
drop view public.v_training_records;
drop view public.v_data_quality_issues;

alter table public.courses drop column cert_type_id, drop column level, drop column validity_months;

create view public.v_training_records
with (security_invoker = true)
as
select
  r.*,
  ce.name as certificate_name,
  ce.kind as certificate_kind,
  co.name as course_name,
  ce.validity_months,
  e.expiry_date,
  e.expiry_date - public.vn_today() as days_to_expiry,
  public.expiry_status(r.issued_date, ce.validity_months, public.vn_today()) as expiry_status,
  m.code as member_code,
  m.full_name as member_name,
  m.email::text as member_email,
  m.team_id,
  t.name as team_name,
  ce.cert_type_id,
  ct.name as cert_type_name,
  ce.provider_id,
  p.name as provider_name,
  co.cost,
  co.cost_currency,
  co.est_hours
from public.training_records r
join public.certificates ce on ce.id = r.certificate_id
left join public.courses co on co.id = r.course_id
join public.members m on m.id = r.member_id
left join public.teams t on t.id = m.team_id
left join public.cert_types ct on ct.id = ce.cert_type_id
left join public.providers p on p.id = ce.provider_id
cross join lateral (
  select case
    when r.issued_date is not null and ce.validity_months is not null
      then (r.issued_date + make_interval(months => ce.validity_months))::date
  end as expiry_date
) e;

-- Same four branches and column contract as 20261004000001, with the certificate in place of the course.
-- Only exams are flagged for a missing validity: completions usually never expire.
create view public.v_data_quality_issues
with (security_invoker = true)
as
select
  'overdue_exam'::text as issue_type,
  'warning'::text as severity,
  r.id as subject_id,
  r.member_id,
  m.code as member_code,
  m.full_name as member_name,
  m.team_id,
  t.name as team_name,
  r.certificate_id,
  c.name as certificate_name,
  r.id as record_id,
  r.planned_exam_date as since,
  public.vn_today() - r.planned_exam_date as days
from public.training_records r
join public.members m on m.id = r.member_id
join public.certificates c on c.id = r.certificate_id
left join public.teams t on t.id = m.team_id
where m.is_active
  and r.status <> 'done'
  and r.planned_exam_date < public.vn_today()

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

revoke all on public.v_data_quality_issues from anon;
grant select on public.v_data_quality_issues to authenticated;

-- Dashboard functions: the certificate holds the validity now; dimension 'course' becomes 'certificate'.
-- Signatures, return columns and grants are unchanged.
-- Org-wide numbers for every signed-in role. SECURITY DEFINER because a Member's RLS shows only
-- their own rows. Numbers only: no name, no email, no id leaves this function.
create or replace function public.dashboard_kpis()
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
    join public.certificates c on c.id = r.certificate_id
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
create or replace function public.dashboard_breakdown(p_dimension text, p_limit int default null)
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
    left join public.certificates c on c.id = r.certificate_id
    where m.is_active
    group by t.id, t.name
    order by count(r.id) desc, coalesce(t.name, 'No team'), coalesce(t.id::text, 'none')
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
create or replace function public.dashboard_ranking()
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
    left join public.certificates c on c.id = r.certificate_id
    where m.is_active
    group by m.id, m.code, m.full_name, t.name
  )
  select mid, mcode, mname, tname, nvalid, ndone, nprogress,
         (dense_rank() over (order by nvalid desc, ndone desc))::int
  from per_member
  order by 8, mname, mid;
end;
$$;

-- commit_import: as in 20261031000003, but the staged "course" is a certificate. An unknown name creates an
-- exam certificate; when the row also has cost, currency or hours it creates a course with the same name and
-- provider that prepares for it and is used as the course studied. Existing certificates are never changed.
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
  v_provider_id uuid;
  v_cert_type_id uuid;
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

    -- Reset every loop: INSERT ... ON CONFLICT DO NOTHING RETURNING ... INTO leaves the variable
    -- untouched when nothing is inserted, which would silently reuse the previous row's id.
    v_member_id := null;
    v_cert_id := null;
    v_course_id := null;
    v_provider_id := null;
    v_cert_type_id := null;
    n := v_row.normalized;
    r := n->'record';

    begin
      if n->'member' ? 'id' then
        v_member_id := (n->'member'->>'id')::uuid;
      else
        insert into public.members (full_name, email, team_id)
        values (n->'member'->>'fullName', (n->'member'->>'email')::extensions.citext, (n->'member'->>'teamId')::uuid)
        on conflict (email) do nothing
        returning id into v_member_id;
        if v_member_id is null then
          -- Explicit operator: with search_path = '' a bare = does not resolve to citext's
          -- case-insensitive operator (it falls back to text equality, so 'B@X' would not match 'b@x').
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

      insert into public.training_records as t (
        member_id, certificate_id, course_id, status, progress, planned_exam_date, issued_date,
        certificate_url, via_company, refund_status, notes
      ) values (
        v_member_id, v_cert_id, v_course_id,
        (r->>'status')::public.record_status,
        (r->>'progress')::int,
        (r->>'plannedExamDate')::date,
        (r->>'issuedDate')::date,
        r->>'certificateUrl',
        coalesce((r->>'viaCompany')::boolean, false),
        coalesce((r->>'refundStatus')::public.refund_status, 'n_a'),
        r->>'notes'
      )
      on conflict (member_id, certificate_id) do update set
        status = excluded.status,
        progress = excluded.progress,
        planned_exam_date = coalesce((r->>'plannedExamDate')::date, t.planned_exam_date),
        issued_date = coalesce((r->>'issuedDate')::date, t.issued_date),
        certificate_url = coalesce(r->>'certificateUrl', t.certificate_url),
        via_company = coalesce((r->>'viaCompany')::boolean, t.via_company),
        refund_status = coalesce((r->>'refundStatus')::public.refund_status, t.refund_status),
        notes = coalesce(r->>'notes', t.notes)
      returning (xmax = 0) into v_inserted;
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
