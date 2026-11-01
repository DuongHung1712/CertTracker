-- Career roles, career start and YoE (spec 2026-10-31 §6.2).
-- YoE is worked out in a view, never stored. Only the admin sets a member's role and start; a member sets
-- their own start through set_my_career_start().

create table public.career_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  sort_order int not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger career_roles_set_updated_at before update on public.career_roles
  for each row execute function public.set_updated_at();

-- The career path the managers gave in October 2026.
insert into public.career_roles (name, sort_order) values
  ('Engineer', 1),
  ('Senior Engineer', 2),
  ('Team Lead', 3),
  ('Project Manager', 4);

alter table public.career_roles enable row level security;
revoke all on public.career_roles from anon;
create policy "career_roles: authenticated read" on public.career_roles
  for select to authenticated using (true);
create policy "career_roles: admin write" on public.career_roles
  for all to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');

-- No default role for existing members: a wrong default is worse than an empty cell.
alter table public.members
  add column career_role_id uuid references public.career_roles (id) on delete restrict,
  add column career_start date,
  add constraint members_career_start_first_of_month
    check (career_start is null or extract(day from career_start) = 1);
create index members_career_role_id_idx on public.members (career_role_id);

-- Only the admin changes career_role_id / career_start. Exceptions: no JWT (postgres / service role:
-- migrations, seed, import, cron) and set_my_career_start(), which raises a transaction-local flag.
-- Managers may still update the other columns of members in their scope (existing RLS policy).
create function public.guard_member_career_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.career_role_id is not distinct from old.career_role_id
     and new.career_start is not distinct from old.career_start then
    return new;
  end if;

  if auth.uid() is not null
     and public.app_role() is distinct from 'admin'
     and coalesce(current_setting('app.career_start_self', true), '') <> 'on' then
    raise exception 'only the admin can change this field' using errcode = 'P0001';
  end if;

  -- The flag covers career_start only; it never lets a member touch the role.
  if new.career_role_id is distinct from old.career_role_id
     and auth.uid() is not null
     and public.app_role() is distinct from 'admin' then
    raise exception 'only the admin can change this field' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger members_guard_career_fields
  before update on public.members
  for each row execute function public.guard_member_career_fields();

-- A member sets only their own career start. Any date is normalised to the first of its month; a month
-- after the current Vietnam month is rejected.
create function public.set_my_career_start(p_start date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := public.my_member_id();
  v_month date := date_trunc('month', p_start)::date;
  v_this_month date := date_trunc('month', now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  if v_member_id is null then
    raise exception 'no member profile for this user' using errcode = 'P0001';
  end if;
  if p_start is null then
    raise exception 'career start is required' using errcode = 'P0001';
  end if;
  if v_month > v_this_month then
    raise exception 'career start is in the future' using errcode = 'P0001';
  end if;

  perform set_config('app.career_start_self', 'on', true);
  update public.members set career_start = v_month where id = v_member_id;
  perform set_config('app.career_start_self', 'off', true);
end;
$$;
revoke execute on function public.set_my_career_start(date) from public, anon;
grant execute on function public.set_my_career_start(date) to authenticated;

-- YoE = whole months from career_start to the current Vietnam month, in years rounded down to 0.5.
-- Null without a career start. security_invoker: members RLS applies to the caller.
create view public.v_member_profiles
with (security_invoker = true)
as
select
  m.id as member_id,
  m.career_role_id,
  cr.name as career_role_name,
  m.career_start,
  case
    when m.career_start is null then null
    else floor(
      greatest(
        0,
        (extract(year from vn.today) - extract(year from m.career_start)) * 12
          + (extract(month from vn.today) - extract(month from m.career_start))
      ) / 6
    ) / 2
  end::numeric as yoe_years
from public.members m
left join public.career_roles cr on cr.id = m.career_role_id
cross join (select (now() at time zone 'Asia/Ho_Chi_Minh')::date as today) vn;

revoke all on public.v_member_profiles from anon;
grant select on public.v_member_profiles to authenticated;
