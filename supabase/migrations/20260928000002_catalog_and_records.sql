create type public.record_status as enum ('not_started', 'in_progress', 'done');
create type public.refund_status as enum ('n_a', 'pending', 'approved', 'rejected', 'paid');

create table public.cert_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.providers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cert_type_id uuid references public.cert_types (id) on delete restrict,
  provider_id uuid references public.providers (id) on delete restrict,
  level text,
  validity_months int check (validity_months is null or validity_months > 0),
  refundable boolean not null default false,
  cost numeric(12, 2) check (cost is null or cost >= 0),
  est_hours int check (est_hours is null or est_hours > 0),
  url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, name)
);

create table public.training_records (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete restrict,
  status public.record_status not null default 'not_started',
  progress int not null default 0 check (progress between 0 and 100),
  planned_exam_date date,
  issued_date date,
  certificate_url text,
  evidence_path text,
  via_company boolean not null default false,
  refund_status public.refund_status not null default 'n_a',
  notes text,
  progress_updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint done_requires_completion
    check (status <> 'done' or (progress = 100 and issued_date is not null)),
  constraint not_started_has_zero_progress
    check (status <> 'not_started' or progress = 0),
  constraint in_progress_below_100
    check (status <> 'in_progress' or progress <= 99)
);
create index training_records_member_id_idx on public.training_records (member_id);
create index training_records_course_id_idx on public.training_records (course_id);

create function public.touch_progress_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.progress is distinct from old.progress then
    new.progress_updated_at := now();
  end if;
  return new;
end;
$$;

create trigger training_records_touch_progress before update on public.training_records
  for each row execute function public.touch_progress_updated_at();

create trigger cert_types_set_updated_at before update on public.cert_types
  for each row execute function public.set_updated_at();
create trigger providers_set_updated_at before update on public.providers
  for each row execute function public.set_updated_at();
create trigger courses_set_updated_at before update on public.courses
  for each row execute function public.set_updated_at();
create trigger training_records_set_updated_at before update on public.training_records
  for each row execute function public.set_updated_at();
