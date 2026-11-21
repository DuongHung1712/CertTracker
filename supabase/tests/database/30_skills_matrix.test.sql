begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

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

-- Own fixtures: the demo skills live in seed.sql, not in the migration.
insert into public.dcs (id, name) values ('00000000-0000-0000-0000-0000000030d1', 'SK DC') on conflict do nothing;
insert into public.programs (id, name, dc_id)
  values ('00000000-0000-0000-0000-0000000030f1', 'SK Program', '00000000-0000-0000-0000-0000000030d1') on conflict do nothing;
insert into public.teams (id, name, program_id)
  values ('30303030-0000-0000-0000-00000000000a', 'SK Team', '00000000-0000-0000-0000-0000000030f1') on conflict do nothing;
insert into public.members (id, full_name, email, team_id, is_active) values
  ('30000000-0000-0000-0000-000000000001', 'SK Member', 'sk1@test.local', '30303030-0000-0000-0000-00000000000a', true),
  ('30000000-0000-0000-0000-000000000002', 'SK Other', 'sk2@test.local', '30303030-0000-0000-0000-00000000000a', true)
  on conflict do nothing;
insert into auth.users (id, email) values
  ('30a00000-0000-0000-0000-000000000001', 'sk1@test.local'),
  ('30a00000-0000-0000-0000-00000000000b', 'skmanager@test.local') on conflict do nothing;
update public.profiles set role = 'member' where user_id = '30a00000-0000-0000-0000-000000000001';
update public.profiles set role = 'manager' where user_id = '30a00000-0000-0000-0000-00000000000b';
insert into public.manager_scopes (team_id, user_id)
  values ('30303030-0000-0000-0000-00000000000a', '30a00000-0000-0000-0000-00000000000b');
insert into public.skill_domains (id, name, slug, sort_order)
  values ('30d00000-0000-0000-0000-000000000001', 'SK Domain', 'sk-domain', 3001);
insert into public.skills (id, code, name, domain_id) values
  ('30500000-0000-0000-0000-000000000001', 'SKL-SKT-01', 'SK Skill One', '30d00000-0000-0000-0000-000000000001'),
  ('30500000-0000-0000-0000-000000000002', 'SKL-SKT-02', 'SK Skill Two', '30d00000-0000-0000-0000-000000000001');
insert into public.member_skills (id, member_id, skill_id, current_level)
  values ('30600000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '30500000-0000-0000-0000-000000000001', 2);
insert into public.member_skills (member_id, skill_id, current_level)
  values ('30000000-0000-0000-0000-000000000002', '30500000-0000-0000-0000-000000000001', 3);

select has_table('public', 'skill_domains', 'skill_domains table exists');
select has_table('public', 'skills', 'skills table exists');
select has_table('public', 'skill_certificate_links', 'skill_certificate_links table exists');
select has_table('public', 'member_skills', 'member_skills table exists');

select throws_ok(
  $$insert into public.skills (code, name, domain_id, benchmark_level)
    values ('INVALID_CODE', 'Bad Skill', '30d00000-0000-0000-0000-000000000001', 3)$$,
  '23514', null, 'rejects invalid skill code pattern');
select throws_ok(
  $$insert into public.member_skills (member_id, skill_id, current_level)
    values ('30000000-0000-0000-0000-000000000001', '30500000-0000-0000-0000-000000000002', 6)$$,
  '23514', null, 'rejects skill level > 5');

select pg_temp.login_as('30a00000-0000-0000-0000-000000000001');
select isnt_empty('select 1 from public.skills where id = ''30500000-0000-0000-0000-000000000001''',
  'member reads the skills catalogue');
select is((select count(*)::int from public.member_skills where skill_id = '30500000-0000-0000-0000-000000000001'), 1,
  'member reads only their own skill ratings');
select lives_ok(
  $$update public.member_skills set current_level = 3, verification_status = 'pending_review'
    where id = '30600000-0000-0000-0000-000000000001'$$,
  'member rates their own skill and asks for review');
select throws_ok(
  $$update public.member_skills set verification_status = 'certified' where id = '30600000-0000-0000-0000-000000000001'$$,
  '42501', null, 'member cannot certify their own skill');
select throws_ok(
  $$update public.member_skills set reviewed_by = '30000000-0000-0000-0000-000000000002', reviewed_at = now()
    where id = '30600000-0000-0000-0000-000000000001'$$,
  '42501', null, 'member cannot stamp their own review');
select throws_ok(
  $$insert into public.member_skills (member_id, skill_id, current_level, verification_status)
    values ('30000000-0000-0000-0000-000000000001', '30500000-0000-0000-0000-000000000002', 4, 'certified')$$,
  '42501', null, 'member cannot add a skill already certified');
select pg_temp.logout();

select pg_temp.login_as('30a00000-0000-0000-0000-00000000000b');
select lives_ok(
  $$update public.member_skills set verification_status = 'certified', reviewed_at = now()
    where id = '30600000-0000-0000-0000-000000000001'$$,
  'manager certifies a skill in scope');
select is((select verification_status from public.member_skills where id = '30600000-0000-0000-0000-000000000001'),
  'certified', 'the certification is saved');
select pg_temp.logout();

select pg_temp.login_as('30a00000-0000-0000-0000-000000000001');
select lives_ok(
  $$update public.member_skills set evidence_note = 'updated' where id = '30600000-0000-0000-0000-000000000001'$$,
  'member edits a note on a certified skill without touching the review');
select pg_temp.logout();

select * from finish();
rollback;
