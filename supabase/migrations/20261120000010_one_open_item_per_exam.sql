-- One open learning item per member and exam (decision #74): how you prepare (self-study or a course)
-- is a field of the item, not a second item. Closed items are history and may repeat (a retake).
do $$
declare
  v_dupes text;
begin
  select string_agg(format('member %s, exam %s (%s items)', member_id, target_certificate_id, n), '; ')
    into v_dupes
  from (
    select member_id, target_certificate_id, count(*) as n
    from public.learning_items
    where target_certificate_id is not null and status <> 'done'
    group by 1, 2
    having count(*) > 1
  ) d;
  if v_dupes is not null then
    raise exception 'merge or remove duplicate open learning items before this migration: %', v_dupes;
  end if;
end;
$$;

create unique index learning_items_one_open_per_exam
  on public.learning_items (member_id, target_certificate_id)
  where target_certificate_id is not null and status <> 'done';
