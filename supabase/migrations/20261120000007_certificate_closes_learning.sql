-- A Completed certificate closes the member's open learning item for it, whatever path added it
-- (Submit certificate, Add certificate, renewal, import): no planned exam lingers after the result
-- is in (decision #72, final review). Exam: items aiming for that exam. Course certificate: items on
-- the course that grants it.
create function public.close_learning_for_certificate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind public.certificate_kind;
  v_course uuid;
begin
  if new.status <> 'done' or (tg_op = 'UPDATE' and old.status = 'done') then
    return null;
  end if;
  select kind, course_id into v_kind, v_course from public.certificates where id = new.certificate_id;
  update public.learning_items li
  set status = 'done', progress = 100, finished_date = least(coalesce(new.issued_date, public.vn_today()), public.vn_today())
  where li.member_id = new.member_id
    and li.status <> 'done'
    and (
      (v_kind = 'exam' and li.target_certificate_id = new.certificate_id)
      or (v_kind = 'completion' and v_course is not null and li.course_id = v_course)
    );
  return null;
end;
$$;

revoke execute on function public.close_learning_for_certificate() from public, anon, authenticated;

create trigger training_records_close_learning
  after insert or update of status on public.training_records
  for each row execute function public.close_learning_for_certificate();
