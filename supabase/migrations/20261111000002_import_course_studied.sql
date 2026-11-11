-- commit_import reads an optional course studied: normalized.courseStudied.id names an existing course. It is saved on
-- insert and on update; a row that names none leaves the record's course alone. The self-preparing course created
-- for a priced new certificate is unchanged (a row cannot name both: nothing prepares for a certificate that is
-- still new, which the import plan reports as a row error). The record trigger still validates the pair (23514).
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
    v_studied_id := (n->'courseStudied'->>'id')::uuid;
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
        v_member_id, v_cert_id, coalesce(v_studied_id, v_course_id),
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
        course_id = coalesce(excluded.course_id, t.course_id),
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
