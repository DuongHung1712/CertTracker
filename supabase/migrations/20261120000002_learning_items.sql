-- Learning items (decision #72, spec docs/superpowers/specs/2026-11-20-learning-items-design.md).
-- training_records keeps certificates (results); learning_items holds the journey (course and/or exam target).

-- 1. learning_items
create table public.learning_items (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  course_id uuid references public.courses (id) on delete restrict,
  target_certificate_id uuid references public.certificates (id) on delete restrict,
  status public.record_status not null default 'not_started',
  progress int not null default 0 check (progress between 0 and 100),
  planned_date date,
  finished_date date,
  notes text check (notes is null or length(notes) <= 2000),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  progress_updated_at timestamptz,
  constraint learning_items_course_or_exam check (course_id is not null or target_certificate_id is not null)
);
create index learning_items_member_id_idx on public.learning_items (member_id);
create index learning_items_course_id_idx on public.learning_items (course_id);
create index learning_items_target_idx on public.learning_items (target_certificate_id);

create trigger learning_items_set_updated_at before update on public.learning_items
  for each row execute function public.set_updated_at();
create trigger learning_items_touch_progress before update on public.learning_items
  for each row execute function public.touch_progress_updated_at();

-- Rules the form also checks; the database is the authority.
create function public.learning_items_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and public.app_role() = 'member' and new.member_id is distinct from old.member_id then
    raise exception 'members cannot change member_id' using errcode = '42501';
  end if;
  if new.target_certificate_id is not null and not exists (
    select 1 from public.certificates where id = new.target_certificate_id and kind = 'exam'
  ) then
    raise exception 'the target must be an exam certificate' using errcode = '23514';
  end if;
  if new.status = 'done' then
    if new.finished_date is null then
      raise exception 'a completed item needs a finished date' using errcode = '23514';
    end if;
    if new.finished_date > public.vn_today() then
      raise exception 'the finished date cannot be in the future' using errcode = '23514';
    end if;
    new.progress := 100;
  end if;
  return new;
end;
$$;
create trigger learning_items_rules before insert or update on public.learning_items
  for each row execute function public.learning_items_rules();

alter table public.learning_items enable row level security;
create policy "learning_items: admin all" on public.learning_items
  for all to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');
create policy "learning_items: read own or managed" on public.learning_items
  for select to authenticated
  using (member_id = (select public.my_member_id()) or member_id in (select public.managed_member_ids()));
create policy "learning_items: insert own or managed" on public.learning_items
  for insert to authenticated
  with check (member_id = (select public.my_member_id()) or member_id in (select public.managed_member_ids()));
create policy "learning_items: update own or managed" on public.learning_items
  for update to authenticated
  using (member_id = (select public.my_member_id()) or member_id in (select public.managed_member_ids()))
  with check (member_id = (select public.my_member_id()) or member_id in (select public.managed_member_ids()));
create policy "learning_items: delete own or managed" on public.learning_items
  for delete to authenticated
  using (member_id = (select public.my_member_id()) or member_id in (select public.managed_member_ids()));

revoke all on public.learning_items from anon;
grant select, insert, update, delete on public.learning_items to authenticated;

create view public.v_learning_items
with (security_invoker = true)
as
select
  li.id, li.member_id, li.course_id, li.target_certificate_id, li.status, li.progress,
  li.planned_date, li.finished_date, li.notes, li.created_by, li.created_at, li.updated_at,
  li.progress_updated_at,
  co.name as course_name,
  p.name as provider_name,
  tc.name as target_certificate_name,
  m.code as member_code,
  m.full_name as member_name,
  m.email::text as member_email,
  m.team_id,
  t.name as team_name,
  (li.course_id is null) as is_self_study
from public.learning_items li
left join public.courses co on co.id = li.course_id
left join public.providers p on p.id = co.provider_id
left join public.certificates tc on tc.id = li.target_certificate_id
join public.members m on m.id = li.member_id
left join public.teams t on t.id = m.team_id;
revoke all on public.v_learning_items from anon;
grant select on public.v_learning_items to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.learning_items;
  end if;
end;
$$;
