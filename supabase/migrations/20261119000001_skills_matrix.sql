-- Skills Matrix schema and realistic seed data (WBS 11.1–11.3, BRD §4.1).
-- Provides domains, skills catalogue, certificate-to-skill linkages, and member competency ratings.

create table if not exists public.skill_domains (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  slug text not null unique check (length(trim(slug)) > 0),
  sort_order int not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger skill_domains_set_updated_at before update on public.skill_domains
  for each row execute function public.set_updated_at();

alter table public.skill_domains enable row level security;
revoke all on public.skill_domains from anon;
create policy "skill_domains: authenticated read" on public.skill_domains
  for select to authenticated using (true);
create policy "skill_domains: admin write" on public.skill_domains
  for all to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^SKL-[A-Z]{2,4}-[0-9]{2}$'),
  name text not null unique check (length(trim(name)) > 0),
  domain_id uuid not null references public.skill_domains (id) on delete restrict,
  description text not null default '',
  benchmark_level smallint not null default 3 check (benchmark_level between 0 and 5),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists skills_domain_id_idx on public.skills (domain_id);
create trigger skills_set_updated_at before update on public.skills
  for each row execute function public.set_updated_at();

alter table public.skills enable row level security;
revoke all on public.skills from anon;
create policy "skills: authenticated read" on public.skills
  for select to authenticated using (true);
create policy "skills: admin write" on public.skills
  for all to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');

create table if not exists public.skill_certificate_links (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.skills (id) on delete cascade,
  certificate_id uuid not null references public.certificates (id) on delete cascade,
  proves_level smallint not null default 3 check (proves_level between 1 and 5),
  created_at timestamptz not null default now(),
  unique (skill_id, certificate_id)
);

create index if not exists skill_certificate_links_skill_idx on public.skill_certificate_links (skill_id);
create index if not exists skill_certificate_links_cert_idx on public.skill_certificate_links (certificate_id);

alter table public.skill_certificate_links enable row level security;
revoke all on public.skill_certificate_links from anon;
create policy "skill_certificate_links: authenticated read" on public.skill_certificate_links
  for select to authenticated using (true);
create policy "skill_certificate_links: admin write" on public.skill_certificate_links
  for all to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');

create table if not exists public.member_skills (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  current_level smallint not null default 0 check (current_level between 0 and 5),
  years_of_experience smallint not null default 0 check (years_of_experience >= 0),
  verification_status text not null default 'self_assessed'
    check (verification_status in ('certified', 'self_assessed', 'pending_review')),
  evidence_note text,
  last_evaluated_at date not null default public.vn_today(),
  manager_endorsement_requested boolean not null default false,
  reviewed_by uuid references public.members (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, skill_id)
);

create index if not exists member_skills_member_idx on public.member_skills (member_id);
create index if not exists member_skills_skill_idx on public.member_skills (skill_id);
create trigger member_skills_set_updated_at before update on public.member_skills
  for each row execute function public.set_updated_at();

alter table public.member_skills enable row level security;
revoke all on public.member_skills from anon;

create policy "member_skills: admin all" on public.member_skills
  for all to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');

create policy "member_skills: read own or managed" on public.member_skills
  for select to authenticated
  using (
    member_id = (select public.my_member_id())
    or member_id in (select public.managed_member_ids())
  );

create policy "member_skills: insert own or managed" on public.member_skills
  for insert to authenticated
  with check (
    member_id = (select public.my_member_id())
    or member_id in (select public.managed_member_ids())
  );

create policy "member_skills: update own or managed" on public.member_skills
  for update to authenticated
  using (
    member_id = (select public.my_member_id())
    or member_id in (select public.managed_member_ids())
  );
