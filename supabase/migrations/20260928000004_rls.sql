-- Role helpers (SECURITY DEFINER so policies can read profiles/team_managers without recursion)
create function public.app_role()
returns public.user_role
language sql stable security definer set search_path = ''
as $$
  select p.role from public.profiles p where p.user_id = auth.uid();
$$;

create function public.my_member_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.member_id from public.profiles p where p.user_id = auth.uid();
$$;

create function public.managed_team_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select tm.team_id from public.team_managers tm where tm.user_id = auth.uid();
$$;

create function public.managed_member_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select m.id
  from public.members m
  join public.team_managers tm on tm.team_id = m.team_id
  where tm.user_id = auth.uid();
$$;

alter table public.dcs enable row level security;
alter table public.programs enable row level security;
alter table public.teams enable row level security;
alter table public.team_managers enable row level security;
alter table public.profiles enable row level security;
alter table public.members enable row level security;
alter table public.cert_types enable row level security;
alter table public.providers enable row level security;
alter table public.courses enable row level security;
alter table public.training_records enable row level security;

-- Reference data: everyone signed in reads, admin writes
create policy "dcs: authenticated read" on public.dcs
  for select to authenticated using (true);
create policy "dcs: admin write" on public.dcs
  for all to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');

create policy "programs: authenticated read" on public.programs
  for select to authenticated using (true);
create policy "programs: admin write" on public.programs
  for all to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');

create policy "teams: authenticated read" on public.teams
  for select to authenticated using (true);
create policy "teams: admin write" on public.teams
  for all to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');

create policy "cert_types: authenticated read" on public.cert_types
  for select to authenticated using (true);
create policy "cert_types: admin write" on public.cert_types
  for all to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');

create policy "providers: authenticated read" on public.providers
  for select to authenticated using (true);
create policy "providers: admin write" on public.providers
  for all to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');

create policy "courses: authenticated read" on public.courses
  for select to authenticated using (true);
create policy "courses: admin write" on public.courses
  for all to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');

-- Profiles & team managers: own row, admin all
create policy "profiles: read own" on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "profiles: admin all" on public.profiles
  for all to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');

create policy "team_managers: read own" on public.team_managers
  for select to authenticated using (user_id = (select auth.uid()));
create policy "team_managers: admin all" on public.team_managers
  for all to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');

-- Members
create policy "members: admin all" on public.members
  for all to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');
create policy "members: read self or managed team" on public.members
  for select to authenticated
  using (
    id = (select public.my_member_id())
    or team_id in (select public.managed_team_ids())
  );
create policy "members: manager update managed team" on public.members
  for update to authenticated
  using (team_id in (select public.managed_team_ids()))
  with check (team_id in (select public.managed_team_ids()));

-- Training records
create policy "training_records: admin all" on public.training_records
  for all to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');
create policy "training_records: read own or managed" on public.training_records
  for select to authenticated
  using (
    member_id = (select public.my_member_id())
    or member_id in (select public.managed_member_ids())
  );
create policy "training_records: insert own or managed" on public.training_records
  for insert to authenticated
  with check (
    member_id = (select public.my_member_id())
    or member_id in (select public.managed_member_ids())
  );
create policy "training_records: update own or managed" on public.training_records
  for update to authenticated
  using (
    member_id = (select public.my_member_id())
    or member_id in (select public.managed_member_ids())
  )
  with check (
    member_id = (select public.my_member_id())
    or member_id in (select public.managed_member_ids())
  );
create policy "training_records: manager delete managed" on public.training_records
  for delete to authenticated
  using (member_id in (select public.managed_member_ids()));

-- Column guard: members cannot touch company-controlled fields
create function public.guard_record_member_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.app_role() is distinct from 'member' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.refund_status := 'n_a';
    new.via_company := false;
  elsif new.member_id is distinct from old.member_id
     or new.refund_status is distinct from old.refund_status
     or new.via_company is distinct from old.via_company then
    raise exception 'members cannot change member_id, refund_status or via_company'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger training_records_guard_member_fields
  before insert or update on public.training_records
  for each row execute function public.guard_record_member_fields();
