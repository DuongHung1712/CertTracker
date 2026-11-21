-- Move every not-done training record into learning_items (decision #72, spec §4.4).
-- training_records keeps only results (status = done). Runs once here; idempotent if run again.
create function public.move_open_records_to_learning()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_with_evidence uuid[];
  v_unresolved uuid[];
begin
  -- A record needs a course or an exam target to become a learning item (learning_items_course_or_exam).
  -- An open record on a completion certificate with no granting course and no course of its own has neither:
  -- it stays in training_records for an admin to fix.
  select
    array_agg(r.id) filter (where c.kind = 'exam' or coalesce(c.course_id, r.course_id) is not null),
    array_agg(r.id) filter (where r.evidence_path is not null),
    array_agg(r.id) filter (where c.kind = 'completion' and coalesce(c.course_id, r.course_id) is null)
    into v_ids, v_with_evidence, v_unresolved
  from public.training_records r
  join public.certificates c on c.id = r.certificate_id
  where r.status in ('not_started', 'in_progress');

  if v_unresolved is not null then
    raise notice 'open records left in training_records (completion certificate without a course): %', v_unresolved;
  end if;
  if v_ids is null then
    return 0;
  end if;
  if v_with_evidence is not null then
    raise notice 'moved records that had evidence (file kept in storage, path kept in notes): %', v_with_evidence;
  end if;

  -- Same id: links, notifications and audit trails that point at the record keep working. Fields a learning
  -- item has no column for (company payment, refund, certificate link, evidence file, approval) go into notes,
  -- so nothing is lost and the evidence file stays findable.
  insert into public.learning_items (
    id, member_id, course_id, target_certificate_id, status, progress, planned_date, notes, created_by, created_at,
    progress_updated_at
  )
  select
    r.id,
    r.member_id,
    case when c.kind = 'completion' then coalesce(c.course_id, r.course_id) else r.course_id end,
    case when c.kind = 'exam' then r.certificate_id end,
    r.status,
    r.progress,
    r.planned_exam_date,
    nullif(concat_ws(chr(10),
      r.notes,
      case when r.via_company then 'Moved from certificate: paid by company' end,
      case when r.refund_status <> 'n_a' then 'Moved from certificate: refund ' || r.refund_status::text end,
      case when r.certificate_url is not null then 'Moved from certificate: link ' || r.certificate_url end,
      case when r.evidence_path is not null then 'Moved from certificate: evidence file ' || r.evidence_path end,
      case when r.approval is not null then 'Moved from certificate: approval ' || r.approval::text end
    ), ''),
    r.created_by,
    r.created_at,
    r.progress_updated_at
  from public.training_records r
  join public.certificates c on c.id = r.certificate_id
  where r.id = any (v_ids);

  delete from public.training_records where id = any (v_ids);
  return cardinality(v_ids);
end;
$$;

select public.move_open_records_to_learning();

revoke execute on function public.move_open_records_to_learning() from public, anon, authenticated;
