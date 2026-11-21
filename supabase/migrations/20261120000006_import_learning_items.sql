-- commit_import routes learning rows (decision #72, spec §5.4): kind = 'learning' upserts learning_items,
-- matching the open item with the same member, course and exam target. Certificate rows are unchanged.
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
  v_learning boolean;
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
    -- Decision #72: a learning row may have no certificate (course only); kind is absent in older batches.
    v_learning := n->>'kind' = 'learning';

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

      if jsonb_typeof(n->'course') is distinct from 'object' then
        v_cert_id := null;
      elsif n->'course' ? 'id' then
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

      if v_learning then
        -- The open item for the same exam, whatever its course; else for the same course with no exam
        -- (src/features/import/plan.ts learningKey; one open item per exam, migration 20261120000010).
        select id into v_existing_id from public.learning_items
          where member_id = v_member_id
            and case when v_cert_id is not null then target_certificate_id = v_cert_id
                     else target_certificate_id is null
                          and course_id is not distinct from coalesce(v_studied_id, v_course_id) end
            and status <> 'done'
          order by created_at desc, id desc
          limit 1;
        if v_existing_id is not null then
          update public.learning_items set
            -- A course named in the sheet becomes how the member prepares (self-study gets a course); none keeps it.
            course_id = coalesce(v_studied_id, v_course_id, course_id),
            status = (r->>'status')::public.record_status,
            progress = (r->>'progress')::int,
            planned_date = coalesce((r->>'plannedExamDate')::date, planned_date),
            finished_date = case when r->>'status' = 'done'
              then coalesce((r->>'issuedDate')::date, finished_date, public.vn_today()) else finished_date end,
            notes = coalesce(r->>'notes', notes)
          where id = v_existing_id;
          v_inserted := false;
        else
          insert into public.learning_items (
            member_id, course_id, target_certificate_id, status, progress, planned_date, finished_date, notes
          ) values (
            v_member_id, coalesce(v_studied_id, v_course_id), v_cert_id,
            (r->>'status')::public.record_status,
            (r->>'progress')::int,
            (r->>'plannedExamDate')::date,
            case when r->>'status' = 'done' then coalesce((r->>'issuedDate')::date, public.vn_today()) end,
            r->>'notes'
          );
          v_inserted := true;
        end if;
      else
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
