-- A proposed course is shared right away (decision #72, owner 2026-11-21): every signed-in user sees a
-- pending course and can track it, so the next member picks it instead of proposing it again.
-- Rejected courses stay visible only to admins, the proposer and their managers.
drop policy "courses: read approved or own proposals" on public.courses;
create policy "courses: read approved, pending or own proposals" on public.courses
  for select to authenticated
  using (
    catalogue_status in ('approved', 'pending')
    or (select public.app_role()) = 'admin'
    or proposed_by = (select public.my_member_id())
    or proposed_by in (select public.managed_member_ids())
  );

-- No second proposal of a course already in the catalogue or waiting for approval (case and spaces ignored).
create function public.courses_reject_duplicate_proposal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.catalogue_status = 'pending' and exists (
    select 1 from public.courses c
    where c.id <> new.id
      and c.catalogue_status <> 'rejected'
      and lower(btrim(c.name)) = lower(btrim(new.name))
  ) then
    raise exception 'a course named % already exists', new.name using errcode = '23505';
  end if;
  return new;
end;
$$;

revoke execute on function public.courses_reject_duplicate_proposal() from public, anon, authenticated;

create trigger courses_reject_duplicate_proposal
  before insert or update of name, catalogue_status on public.courses
  for each row execute function public.courses_reject_duplicate_proposal();
