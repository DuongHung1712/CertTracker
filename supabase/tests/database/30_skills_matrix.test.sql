begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

create function pg_temp.login_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- 1. Table existence checks
select has_table('public', 'skill_domains', 'skill_domains table exists');
select has_table('public', 'skills', 'skills table exists');
select has_table('public', 'skill_certificate_links', 'skill_certificate_links table exists');
select has_table('public', 'member_skills', 'member_skills table exists');

-- 2. Domain seed checks
select isnt_empty('select 1 from public.skill_domains where slug = ''cloud''', 'cloud domain exists');
select isnt_empty('select 1 from public.skill_domains where slug = ''devops''', 'devops domain exists');
select isnt_empty('select 1 from public.skill_domains where slug = ''backend''', 'backend domain exists');
select isnt_empty('select 1 from public.skill_domains where slug = ''frontend''', 'frontend domain exists');
select isnt_empty('select 1 from public.skill_domains where slug = ''security''', 'security domain exists');
select isnt_empty('select 1 from public.skill_domains where slug = ''data_ai''', 'data_ai domain exists');
select isnt_empty('select 1 from public.skill_domains where slug = ''leadership''', 'leadership domain exists');

-- 3. Skills seed checks
select isnt_empty('select 1 from public.skills where code = ''SKL-CLD-01''', 'AWS architecture skill exists');
select isnt_empty('select 1 from public.skills where code = ''SKL-OPS-01''', 'Kubernetes skill exists');
select isnt_empty('select 1 from public.skills where code = ''SKL-CLD-02''', 'Terraform skill exists');
select isnt_empty('select 1 from public.skills where code = ''SKL-FED-01''', 'Next.js skill exists');
select isnt_empty('select 1 from public.skills where code = ''SKL-FED-02''', 'TypeScript skill exists');
select isnt_empty('select 1 from public.skills where code = ''SKL-BED-02''', 'PostgreSQL skill exists');
select isnt_empty('select 1 from public.skills where code = ''SKL-SEC-01''', 'Security / CISSP skill exists');
select isnt_empty('select 1 from public.skills where code = ''SKL-OPS-02''', 'CI/CD skill exists');

-- 4. Constraint checks
select throws_ok(
  $$insert into public.skills (code, name, domain_id, benchmark_level)
    values ('INVALID_CODE', 'Bad Skill', '5eed0000-0000-0000-0000-00000000d001', 3)$$,
  '23514',
  null,
  'rejects invalid skill code pattern'
);

select throws_ok(
  $$insert into public.member_skills (member_id, skill_id, current_level)
    values ('5eed0000-0000-0000-0000-00000000b001', '5eed0000-0000-0000-0000-00000000s001', 6)$$,
  '23514',
  null,
  'rejects skill level > 5'
);

-- 5. RLS checks for authenticated user
perform pg_temp.login_as('5eed0000-0000-0000-0000-00000000f00c'); -- member@certtracker.test
select is(
  (select count(*)::int from public.skill_domains),
  7,
  'member can read all skill domains'
);

select is(
  (select count(*)::int from public.skills),
  16,
  'member can read all seeded skills'
);

select isnt_empty(
  'select 1 from public.member_skills where member_id = ''5eed0000-0000-0000-0000-00000000b003''',
  'member can read own member skills'
);

select * from finish();
rollback;
