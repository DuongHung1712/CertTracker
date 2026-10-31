-- Manager scopes (spec 2026-10-31 §6.1, decision #55): a manager is responsible for teams and/or programs.
-- A program scope covers every team whose program_id matches at query time, so a team added to (or moved out
-- of) a program changes access at once. Replaces team_managers.

create table public.manager_scopes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  team_id uuid references public.teams (id) on delete cascade,
  program_id uuid references public.programs (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint manager_scopes_one_target check (num_nonnulls(team_id, program_id) = 1),
  constraint manager_scopes_user_team_key unique (user_id, team_id),
  constraint manager_scopes_user_program_key unique (user_id, program_id)
);
create index manager_scopes_user_id_idx on public.manager_scopes (user_id);

-- Keep every existing assignment, whatever the holder's role today (spec anti-goal: no assignment lost).
-- Rows of a non-manager are kept but grant nothing (the helpers below check app_role()). The trigger is
-- created after this copy on purpose, so such rows do not abort the migration.
insert into public.manager_scopes (user_id, team_id)
select tm.user_id, tm.team_id
from public.team_managers tm;

-- New or changed scope rows must belong to a manager.
create function public.manager_scopes_require_manager()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p where p.user_id = new.user_id and p.role = 'manager'
  ) then
    raise exception 'scope requires the manager role';
  end if;
  return new;
end;
$$;

create trigger manager_scopes_require_manager
  before insert or update on public.manager_scopes
  for each row execute function public.manager_scopes_require_manager();

alter table public.manager_scopes enable row level security;
revoke all on public.manager_scopes from anon;

-- Own rows (manager sees their scopes; member has none), admin all. No write policy for managers/members.
create policy "manager_scopes: read own" on public.manager_scopes
  for select to authenticated using (user_id = (select auth.uid()));
create policy "manager_scopes: admin all" on public.manager_scopes
  for all to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');

-- Same names and signatures as in 20260928000004_rls.sql, so every policy, view, RPC and the evidence storage
-- policy that calls them stays unchanged. Empty unless the caller's role is manager.
create or replace function public.managed_team_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select s.team_id
  from public.manager_scopes s
  where s.user_id = auth.uid()
    and s.team_id is not null
    and public.app_role() = 'manager'
  union
  select t.id
  from public.manager_scopes s
  join public.teams t on t.program_id = s.program_id
  where s.user_id = auth.uid()
    and public.app_role() = 'manager';
$$;

create or replace function public.managed_member_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select m.id
  from public.members m
  where m.team_id in (select public.managed_team_ids());
$$;

-- Same columns as in 20261004000002_notifications.sql; team_ids now holds the resolved teams (team scopes
-- union the teams of program scopes) and is empty for anyone whose role is not manager. CREATE OR REPLACE keeps
-- the service-role-only EXECUTE grant.
create or replace function public.notification_staff()
returns table (user_id uuid, email text, role public.user_role, member_id uuid, team_ids uuid[])
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.user_id,
    u.email::text,
    p.role,
    p.member_id,
    array(
      select r.team_id
      from (
        select s.team_id
        from public.manager_scopes s
        where s.user_id = p.user_id and s.team_id is not null
        union
        select t.id
        from public.manager_scopes s
        join public.teams t on t.program_id = s.program_id
        where s.user_id = p.user_id
      ) r
      where p.role = 'manager'
      order by r.team_id
    )
  from public.profiles p
  join auth.users u on u.id = p.user_id
  where p.role in ('admin', 'manager')
    and u.email is not null
    and u.email_confirmed_at is not null
    and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= now());
$$;

-- Its policies go with it.
drop table public.team_managers;
