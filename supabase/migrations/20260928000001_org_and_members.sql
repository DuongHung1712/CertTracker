create extension if not exists citext with schema extensions;

create type public.user_role as enum ('admin', 'manager', 'member');

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.dcs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  dc_id uuid not null references public.dcs (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dc_id, name)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  program_id uuid not null references public.programs (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, name)
);

create sequence public.member_code_seq;

create table public.members (
  id uuid primary key default gen_random_uuid(),
  code text not null unique
    default ('M' || lpad(nextval('public.member_code_seq')::text, 3, '0')),
  full_name text not null check (length(trim(full_name)) > 0),
  email extensions.citext not null unique,
  team_id uuid references public.teams (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index members_team_id_idx on public.members (team_id);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'member',
  member_id uuid unique references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.team_managers (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (team_id, user_id)
);
create index team_managers_user_id_idx on public.team_managers (user_id);

create trigger dcs_set_updated_at before update on public.dcs
  for each row execute function public.set_updated_at();
create trigger programs_set_updated_at before update on public.programs
  for each row execute function public.set_updated_at();
create trigger teams_set_updated_at before update on public.teams
  for each row execute function public.set_updated_at();
create trigger members_set_updated_at before update on public.members
  for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Every new auth user gets a profile; link to the member with the same email.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into public.profiles (user_id, member_id)
  values (
    new.id,
    (select m.id from public.members m where m.email = new.email::extensions.citext)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
