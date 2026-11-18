-- WBS / P0: Support certificate renewal lifecycle by relaxing the single-record constraint.
-- Allows members to declare renewals for expiring/expired certificates while preserving past attempt history.

-- 1. Drop the strict 1-record-per-certificate constraint that blocked renewal attempts
alter table public.training_records drop constraint if exists training_records_member_certificate_key;

-- 2. Prevent duplicate active preparation attempts (only one in-progress or not-started per certificate per member)
create unique index if not exists training_records_member_cert_active_idx
  on public.training_records (member_id, certificate_id)
  where (status in ('not_started', 'in_progress'));

-- 3. Prevent duplicate completions with the exact same issued date
create unique index if not exists training_records_member_cert_done_issued_idx
  on public.training_records (member_id, certificate_id, issued_date)
  where (status = 'done');

-- 4. Update commit_import to safely handle upserts without requiring a unique constraint on (member_id, certificate_id)
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

      -- Match existing record according to renewal lifecycle:
      -- 1) If importing an active attempt (not_started/in_progress), match an existing active attempt.
      -- 2) If importing a completed attempt (done), match an existing done record with the same issued date,
      --    or an active attempt being marked completed.
      -- Otherwise insert a new record so renewal history is preserved.
      if (r->>'status') in ('not_started', 'in_progress') then
        select id into v_existing_id from public.training_records
          where member_id = v_member_id and certificate_id = v_cert_id
            and status in ('not_started', 'in_progress')
          limit 1;
      else
        select id into v_existing_id from public.training_records
          where member_id = v_member_id and certificate_id = v_cert_id
            and status = 'done'
            and (issued_date = (r->>'issuedDate')::date or (r->>'issuedDate' is null and issued_date is null))
          limit 1;

        if v_existing_id is null then
          select id into v_existing_id from public.training_records
            where member_id = v_member_id and certificate_id = v_cert_id
              and status in ('not_started', 'in_progress')
            limit 1;
        end if;
      end if;

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
