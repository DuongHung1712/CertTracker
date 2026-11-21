-- Members propose a missing course and track it right away (decision #72, spec §4.3).
-- Same pattern as certificate proposals (20261118000003/4).
alter table public.courses
  add column catalogue_status text not null default 'approved'
    check (catalogue_status in ('approved', 'pending', 'rejected')),
  add column proposed_by uuid references public.members (id) on delete set null,
  add column proposed_provider text,
  add column reviewed_by uuid,
  add column reviewed_at timestamptz;

drop policy "courses: authenticated read" on public.courses;
create policy "courses: read approved or own proposals" on public.courses
  for select to authenticated
  using (
    catalogue_status = 'approved'
    or (select public.app_role()) = 'admin'
    or proposed_by = (select public.my_member_id())
    or proposed_by in (select public.managed_member_ids())
  );
create policy "courses: member propose pending" on public.courses
  for insert to authenticated
  with check (catalogue_status = 'pending' and proposed_by = (select public.my_member_id()));
create policy "courses: member update own pending" on public.courses
  for update to authenticated
  using (catalogue_status = 'pending' and proposed_by = (select public.my_member_id()))
  with check (catalogue_status = 'pending' and proposed_by = (select public.my_member_id()));
grant insert, update on public.courses to authenticated;

-- Approve: resolve the typed provider, optionally create the completion certificate the course grants.
create function public.approve_course(p_id uuid, p_grants_completion boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_course public.courses;
  v_provider_id uuid;
begin
  if public.app_role() is distinct from 'admin' then
    raise exception 'only admins can approve a course' using errcode = '42501';
  end if;
  select * into v_course from public.courses where id = p_id for update;
  if not found then
    raise exception 'course not found' using errcode = 'P0002';
  end if;

  v_provider_id := v_course.provider_id;
  if v_provider_id is null and nullif(btrim(v_course.proposed_provider), '') is not null then
    insert into public.providers (name) values (btrim(v_course.proposed_provider))
    on conflict (name) do nothing
    returning id into v_provider_id;
    if v_provider_id is null then
      select id into v_provider_id from public.providers where name = btrim(v_course.proposed_provider);
    end if;
  end if;

  update public.courses set
    provider_id = v_provider_id,
    proposed_provider = null,
    catalogue_status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = now()
  where id = p_id;

  if p_grants_completion and not exists (select 1 from public.certificates where course_id = p_id) then
    insert into public.certificates (name, kind, provider_id, course_id)
    values (v_course.name, 'completion', v_provider_id, p_id);
  end if;
end;
$$;

create function public.reject_course(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if public.app_role() is distinct from 'admin' then
    raise exception 'only admins can reject a course' using errcode = '42501';
  end if;
  update public.courses set catalogue_status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_id;
  if not found then
    raise exception 'course not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.approve_course(uuid, boolean) from public, anon;
grant execute on function public.approve_course(uuid, boolean) to authenticated;
revoke execute on function public.reject_course(uuid) from public, anon;
grant execute on function public.reject_course(uuid) to authenticated;

-- v_learning_items: append the course's catalogue status (columns only added at the end).
create or replace view public.v_learning_items
with (security_invoker = true)
as
select
  li.id, li.member_id, li.course_id, li.target_certificate_id, li.status, li.progress,
  li.planned_date, li.finished_date, li.notes, li.created_by, li.created_at, li.updated_at,
  li.progress_updated_at,
  co.name as course_name,
  coalesce(p.name, co.proposed_provider) as provider_name,
  tc.name as target_certificate_name,
  m.code as member_code,
  m.full_name as member_name,
  m.email::text as member_email,
  m.team_id,
  t.name as team_name,
  (li.course_id is null) as is_self_study,
  co.catalogue_status as course_catalogue_status
from public.learning_items li
left join public.courses co on co.id = li.course_id
left join public.providers p on p.id = co.provider_id
left join public.certificates tc on tc.id = li.target_certificate_id
join public.members m on m.id = li.member_id
left join public.teams t on t.id = m.team_id;
