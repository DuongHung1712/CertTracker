begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

create function pg_temp.login_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

-- Fixtures (as postgres; RLS bypassed). Program 1 = {Team A, Team B}, Program 2 = {Team C}.
insert into public.dcs (id, name) values ('b1000000-0000-0000-0000-0000000000d1', 'MS DC');
insert into public.programs (id, name, dc_id) values
  ('b1000000-0000-0000-0000-0000000000f1', 'MS Program 1', 'b1000000-0000-0000-0000-0000000000d1'),
  ('b1000000-0000-0000-0000-0000000000f2', 'MS Program 2', 'b1000000-0000-0000-0000-0000000000d1');
insert into public.teams (id, name, program_id) values
  ('b1000000-0000-0000-0000-00000000a001', 'MS Team A', 'b1000000-0000-0000-0000-0000000000f1'),
  ('b1000000-0000-0000-0000-00000000a002', 'MS Team B', 'b1000000-0000-0000-0000-0000000000f1'),
  ('b1000000-0000-0000-0000-00000000a003', 'MS Team C', 'b1000000-0000-0000-0000-0000000000f2');
insert into public.members (id, full_name, email, team_id) values
  ('b1000000-0000-0000-0000-00000000c001', 'MS Member A', 'ms-a@test.local', 'b1000000-0000-0000-0000-00000000a001'),
  ('b1000000-0000-0000-0000-00000000c002', 'MS Member B', 'ms-b@test.local', 'b1000000-0000-0000-0000-00000000a002'),
  ('b1000000-0000-0000-0000-00000000c003', 'MS Member C', 'ms-c@test.local', 'b1000000-0000-0000-0000-00000000a003');
insert into public.courses (id, name, validity_months)
  values ('b1000000-0000-0000-0000-00000000e001', 'MS Course', 12);
insert into public.training_records (id, member_id, course_id, status, progress) values
  ('b1000000-0000-0000-0000-00000000b001', 'b1000000-0000-0000-0000-00000000c001',
   'b1000000-0000-0000-0000-00000000e001', 'in_progress', 10),
  ('b1000000-0000-0000-0000-00000000b002', 'b1000000-0000-0000-0000-00000000c002',
   'b1000000-0000-0000-0000-00000000e001', 'in_progress', 20),
  ('b1000000-0000-0000-0000-00000000b003', 'b1000000-0000-0000-0000-00000000c003',
   'b1000000-0000-0000-0000-00000000e001', 'in_progress', 30);

-- email_confirmed_at is set so the managers show up in notification_staff().
insert into auth.users (id, email, email_confirmed_at) values
  ('b1000000-0000-0000-0000-00000000f00a', 'ms-admin@test.local', now()),
  ('b1000000-0000-0000-0000-00000000f001', 'ms-m1@test.local', now()),
  ('b1000000-0000-0000-0000-00000000f002', 'ms-m2@test.local', now()),
  ('b1000000-0000-0000-0000-00000000f003', 'ms-m3@test.local', now()),
  ('b1000000-0000-0000-0000-00000000f00c', 'ms-user@test.local', now());
update public.profiles set role = 'admin' where user_id = 'b1000000-0000-0000-0000-00000000f00a';
update public.profiles set role = 'manager'
  where user_id in ('b1000000-0000-0000-0000-00000000f001', 'b1000000-0000-0000-0000-00000000f002',
                    'b1000000-0000-0000-0000-00000000f003');

-- M1: team A. M2: program 1. M3: team A + program 2.
insert into public.manager_scopes (id, user_id, team_id, program_id) values
  ('b1000000-0000-0000-0000-000000005001', 'b1000000-0000-0000-0000-00000000f001', 'b1000000-0000-0000-0000-00000000a001', null),
  ('b1000000-0000-0000-0000-000000005002', 'b1000000-0000-0000-0000-00000000f002', null, 'b1000000-0000-0000-0000-0000000000f1'),
  ('b1000000-0000-0000-0000-000000005003', 'b1000000-0000-0000-0000-00000000f003', 'b1000000-0000-0000-0000-00000000a001', null),
  ('b1000000-0000-0000-0000-000000005004', 'b1000000-0000-0000-0000-00000000f003', null, 'b1000000-0000-0000-0000-0000000000f2');

-- ===== shape and constraints (as postgres) =====
select has_table('public', 'team_managers', 'team_managers stays for one release so the app can roll back (decision #58)');
select throws_ok(
  $$insert into public.manager_scopes (user_id, team_id, program_id) values
    ('b1000000-0000-0000-0000-00000000f001', 'b1000000-0000-0000-0000-00000000a002', 'b1000000-0000-0000-0000-0000000000f2')$$,
  '23514', null, 'a scope cannot name both a team and a program');
select throws_ok(
  $$insert into public.manager_scopes (user_id) values ('b1000000-0000-0000-0000-00000000f001')$$,
  '23514', null, 'a scope must name a team or a program');
select throws_ok(
  $$insert into public.manager_scopes (user_id, team_id) values
    ('b1000000-0000-0000-0000-00000000f001', 'b1000000-0000-0000-0000-00000000a001')$$,
  '23505', null, 'a user holds a team scope at most once');
select throws_ok(
  $$insert into public.manager_scopes (user_id, team_id) values
    ('b1000000-0000-0000-0000-00000000f00c', 'b1000000-0000-0000-0000-00000000a001')$$,
  'P0001', 'scope requires the manager role', 'a scope for a non-manager is rejected on insert');
select throws_ok(
  $$update public.manager_scopes set user_id = 'b1000000-0000-0000-0000-00000000f00c'
    where id = 'b1000000-0000-0000-0000-000000005001'$$,
  'P0001', 'scope requires the manager role', 'a scope cannot be moved to a non-manager');

-- ===== resolved teams per manager =====
select pg_temp.login_as('b1000000-0000-0000-0000-00000000f001');
select set_eq($$select public.managed_team_ids()$$,
  array['b1000000-0000-0000-0000-00000000a001']::uuid[], 'M1 (team A) manages {A}');
select is((select count(*) from public.manager_scopes), 1::bigint, 'M1 reads only their own scope rows');
select throws_ok(
  $$insert into public.manager_scopes (user_id, team_id) values
    ('b1000000-0000-0000-0000-00000000f001', 'b1000000-0000-0000-0000-00000000a002')$$,
  '42501', null, 'a manager cannot add scopes (RLS)');
reset role;

select pg_temp.login_as('b1000000-0000-0000-0000-00000000f002');
select set_eq($$select public.managed_team_ids()$$,
  array['b1000000-0000-0000-0000-00000000a001', 'b1000000-0000-0000-0000-00000000a002']::uuid[],
  'M2 (program 1) manages {A, B}');
select set_eq($$select public.managed_member_ids()$$,
  array['b1000000-0000-0000-0000-00000000c001', 'b1000000-0000-0000-0000-00000000c002']::uuid[],
  'M2 manages the members of A and B');
select set_eq($$select id from public.training_records$$,
  array['b1000000-0000-0000-0000-00000000b001', 'b1000000-0000-0000-0000-00000000b002']::uuid[],
  'M2 reads the records of A and B only');
reset role;

select pg_temp.login_as('b1000000-0000-0000-0000-00000000f003');
select set_eq($$select public.managed_team_ids()$$,
  array['b1000000-0000-0000-0000-00000000a001', 'b1000000-0000-0000-0000-00000000a003']::uuid[],
  'M3 (team A + program 2) manages {A, C}');
reset role;

select pg_temp.login_as('b1000000-0000-0000-0000-00000000f00c');
select is_empty($$select public.managed_team_ids()$$, 'a member manages no team');
select is((select count(*) from public.manager_scopes), 0::bigint, 'a member reads no scope rows');
reset role;

-- ===== program scope follows the teams of the program =====
insert into public.teams (id, name, program_id)
  values ('b1000000-0000-0000-0000-00000000a004', 'MS Team D', 'b1000000-0000-0000-0000-0000000000f1');
select pg_temp.login_as('b1000000-0000-0000-0000-00000000f002');
select set_eq($$select public.managed_team_ids()$$,
  array['b1000000-0000-0000-0000-00000000a001', 'b1000000-0000-0000-0000-00000000a002',
        'b1000000-0000-0000-0000-00000000a004']::uuid[],
  'a team added to program 1 later is covered by M2 at once');
reset role;

update public.teams set program_id = 'b1000000-0000-0000-0000-0000000000f2'
  where id = 'b1000000-0000-0000-0000-00000000a002';
select pg_temp.login_as('b1000000-0000-0000-0000-00000000f002');
select set_eq($$select public.managed_team_ids()$$,
  array['b1000000-0000-0000-0000-00000000a001', 'b1000000-0000-0000-0000-00000000a004']::uuid[],
  'team B moved to program 2 leaves M2''s set');
select is((select count(*) from public.members where team_id = 'b1000000-0000-0000-0000-00000000a002'),
  0::bigint, 'M2 no longer sees team B''s member');
select is((select count(*) from public.training_records where member_id = 'b1000000-0000-0000-0000-00000000c002'),
  0::bigint, 'M2 no longer sees team B''s record');
reset role;

select pg_temp.login_as('b1000000-0000-0000-0000-00000000f003');
select set_eq($$select public.managed_team_ids()$$,
  array['b1000000-0000-0000-0000-00000000a001', 'b1000000-0000-0000-0000-00000000a002',
        'b1000000-0000-0000-0000-00000000a003']::uuid[],
  'team B moved to program 2 joins M3''s set');
reset role;

-- ===== notification_staff resolves scopes (service role) =====
set local role service_role;
select is((select team_ids from public.notification_staff() where user_id = 'b1000000-0000-0000-0000-00000000f002'),
  array['b1000000-0000-0000-0000-00000000a001', 'b1000000-0000-0000-0000-00000000a004']::uuid[],
  'notification_staff lists the teams resolved from M2''s program scope');
select is((select team_ids from public.notification_staff() where user_id = 'b1000000-0000-0000-0000-00000000f003'),
  array['b1000000-0000-0000-0000-00000000a001', 'b1000000-0000-0000-0000-00000000a002',
        'b1000000-0000-0000-0000-00000000a003']::uuid[],
  'notification_staff merges team and program scopes, without duplicates');
reset role;

-- ===== a demoted manager keeps the rows but they grant nothing =====
update public.profiles set role = 'member' where user_id = 'b1000000-0000-0000-0000-00000000f002';
update public.profiles set role = 'admin' where user_id = 'b1000000-0000-0000-0000-00000000f003';
select is((select count(*) from public.manager_scopes where user_id = 'b1000000-0000-0000-0000-00000000f002'),
  1::bigint, 'demotion keeps the scope rows');
select pg_temp.login_as('b1000000-0000-0000-0000-00000000f002');
select is_empty($$select public.managed_team_ids()$$, 'a demoted manager manages no team');
select is_empty($$select public.managed_member_ids()$$, 'a demoted manager manages no member');
select is((select count(*) from public.training_records where member_id = 'b1000000-0000-0000-0000-00000000c001'),
  0::bigint, 'a demoted manager no longer reads team A''s record');
reset role;

set local role service_role;
select is(
  (select count(*) from public.notification_staff()
    where user_id = 'b1000000-0000-0000-0000-00000000f002' and cardinality(team_ids) > 0),
  0::bigint, 'notification_staff no longer lists M2''s teams');
select is(
  (select cardinality(team_ids) from public.notification_staff() where user_id = 'b1000000-0000-0000-0000-00000000f003'),
  0, 'a manager turned admin has no team ids in notification_staff');
reset role;

-- ===== admin manages scopes =====
select pg_temp.login_as('b1000000-0000-0000-0000-00000000f00a');
select lives_ok(
  $$insert into public.manager_scopes (id, user_id, program_id) values
    ('b1000000-0000-0000-0000-000000005009', 'b1000000-0000-0000-0000-00000000f001', 'b1000000-0000-0000-0000-0000000000f2')$$,
  'admin can add a program scope');
select lives_ok(
  $$delete from public.manager_scopes where id = 'b1000000-0000-0000-0000-000000005009'$$,
  'admin can delete a scope');
reset role;
select is((select count(*) from public.manager_scopes where id = 'b1000000-0000-0000-0000-000000005009'),
  0::bigint, 'the deleted scope is gone');

select * from finish();
rollback;
