-- Access matrix for every role (spec 2026-11-06 §7.2). Only the cells no earlier file covers; the map is
-- docs/superpowers/plans/2026-11-06-access-matrix-map.md. A "cannot" is a refusal, or 0 affected rows plus
-- the value read back unchanged as postgres.
begin;
create extension if not exists pgtap with schema extensions;
select plan(55);

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

-- RLS hides rows from UPDATE/DELETE silently, so "denied" shows up as 0 affected rows.
create function pg_temp.affected(q text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute q;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Fixtures (as postgres; RLS bypassed). The manager holds Team A. Members come before the logins so
-- handle_new_user() links each login to its member by e-mail.
insert into public.dcs (id, name) values ('f1600000-0000-0000-0000-0000000000d1', 'AM DC');
insert into public.programs (id, name, dc_id)
  values ('f1600000-0000-0000-0000-0000000000d2', 'AM Program', 'f1600000-0000-0000-0000-0000000000d1');
insert into public.teams (id, name, program_id) values
  ('f1600000-0000-0000-0000-00000000a001', 'AM Team A', 'f1600000-0000-0000-0000-0000000000d2'),
  ('f1600000-0000-0000-0000-00000000a002', 'AM Team B', 'f1600000-0000-0000-0000-0000000000d2');
insert into public.members (id, full_name, email, team_id) values
  ('f1600000-0000-0000-0000-00000000c001', 'AM Member A', 'am-a@test.local', 'f1600000-0000-0000-0000-00000000a001'),
  ('f1600000-0000-0000-0000-00000000c002', 'AM Member B', 'am-b@test.local', 'f1600000-0000-0000-0000-00000000a002'),
  ('f1600000-0000-0000-0000-00000000c003', 'AM Demoted', 'am-demoted@test.local', 'f1600000-0000-0000-0000-00000000a002'),
  ('f1600000-0000-0000-0000-00000000c009', 'AM No Login', 'am-nologin@test.local', 'f1600000-0000-0000-0000-00000000a001');
insert into auth.users (id, email) values
  ('f1600000-0000-0000-0000-00000000f00a', 'am-admin@test.local'),
  ('f1600000-0000-0000-0000-00000000f001', 'am-manager@test.local'),
  ('f1600000-0000-0000-0000-00000000f002', 'am-demoted@test.local'),
  ('f1600000-0000-0000-0000-00000000f00c', 'am-a@test.local'),
  ('f1600000-0000-0000-0000-00000000f00d', 'am-b@test.local');
update public.profiles set role = 'admin' where user_id = 'f1600000-0000-0000-0000-00000000f00a';
update public.profiles set role = 'manager'
  where user_id in ('f1600000-0000-0000-0000-00000000f001', 'f1600000-0000-0000-0000-00000000f002');
insert into public.manager_scopes (id, user_id, team_id) values
  ('f1600000-0000-0000-0000-000000005001', 'f1600000-0000-0000-0000-00000000f001', 'f1600000-0000-0000-0000-00000000a001'),
  ('f1600000-0000-0000-0000-000000005002', 'f1600000-0000-0000-0000-00000000f002', 'f1600000-0000-0000-0000-00000000a001');
-- The demoted manager keeps the Team A scope row (spec: rows grant nothing).
update public.profiles set role = 'member' where user_id = 'f1600000-0000-0000-0000-00000000f002';

insert into public.certificates (id, name, kind, validity_months) values
  ('f1600000-0000-0000-0000-00000000e001', 'AM Course', 'exam', 12),
  ('f1600000-0000-0000-0000-00000000e002', 'AM Second Course', 'exam', 12);
insert into public.training_records (id, member_id, certificate_id, status, progress) values
  ('f1600000-0000-0000-0000-00000000b001', 'f1600000-0000-0000-0000-00000000c001',
   'f1600000-0000-0000-0000-00000000e001', 'in_progress', 10),
  ('f1600000-0000-0000-0000-00000000b002', 'f1600000-0000-0000-0000-00000000c002',
   'f1600000-0000-0000-0000-00000000e001', 'in_progress', 20),
  ('f1600000-0000-0000-0000-00000000b003', 'f1600000-0000-0000-0000-00000000c003',
   'f1600000-0000-0000-0000-00000000e001', 'in_progress', 30);

-- Proof files under the app's path: {member_id}/{record_id}/{epoch ms}.{ext} (lib/storage/evidence.ts).
insert into storage.objects (bucket_id, name) values
  ('certificates', 'f1600000-0000-0000-0000-00000000c001/f1600000-0000-0000-0000-00000000b001/1762387200000.pdf'),
  ('certificates', 'f1600000-0000-0000-0000-00000000c003/f1600000-0000-0000-0000-00000000b003/1762387200000.pdf');

-- ===== Member (Member A, Team A) =====
select pg_temp.login_as('f1600000-0000-0000-0000-00000000f00c');
select is(
  pg_temp.affected($$update public.members set full_name = 'Hacked' where id = 'f1600000-0000-0000-0000-00000000c001'$$),
  0::bigint, 'members: a member cannot update their own member row');
select is(
  pg_temp.affected($$update public.members set full_name = 'Hacked' where id = 'f1600000-0000-0000-0000-00000000c002'$$),
  0::bigint, 'members: a member cannot update another member''s row');
select is(
  pg_temp.affected($$update public.training_records set progress = 15 where id = 'f1600000-0000-0000-0000-00000000b001'$$),
  1::bigint, 'training_records: a member updates their own record');
select is(
  pg_temp.affected($$update public.training_records set progress = 99 where id = 'f1600000-0000-0000-0000-00000000b002'$$),
  0::bigint, 'training_records: a member cannot update another member''s record');
select is(
  pg_temp.affected($$delete from public.training_records where id = 'f1600000-0000-0000-0000-00000000b002'$$),
  0::bigint, 'training_records: a member cannot delete another member''s record');
select is(
  pg_temp.affected($$update public.profiles set role = 'admin' where user_id = 'f1600000-0000-0000-0000-00000000f00c'$$),
  0::bigint, 'profiles: a member cannot change their own role');
select is(
  pg_temp.affected($$update public.profiles set role = 'admin' where user_id = 'f1600000-0000-0000-0000-00000000f00d'$$),
  0::bigint, 'profiles: a member cannot change another user''s role');
-- user_id names a manager so the scope trigger passes and RLS alone has to refuse.
select throws_ok(
  $$insert into public.manager_scopes (user_id, team_id) values
    ('f1600000-0000-0000-0000-00000000f001', 'f1600000-0000-0000-0000-00000000a002')$$,
  '42501', null, 'manager_scopes: a member cannot add a scope');
select is(
  pg_temp.affected($$delete from public.manager_scopes$$),
  0::bigint, 'manager_scopes: a member cannot delete scopes');
select pg_temp.logout();
select results_eq(
  $$select full_name from public.members
    where id in ('f1600000-0000-0000-0000-00000000c001', 'f1600000-0000-0000-0000-00000000c002') order by full_name$$,
  array['AM Member A', 'AM Member B'],
  'members: the member''s denied updates left both rows unchanged');
select is(
  (select progress from public.training_records where id = 'f1600000-0000-0000-0000-00000000b002'),
  20, 'training_records: the member''s denied update and delete left the other record unchanged');
select is(
  (select role::text from public.profiles where user_id = 'f1600000-0000-0000-0000-00000000f00c'),
  'member', 'profiles: the member''s own role is still member');
select is(
  (select role::text from public.profiles where user_id = 'f1600000-0000-0000-0000-00000000f00d'),
  'member', 'profiles: the other user''s role is still member after the member''s attempt');
select is(
  (select count(*) from public.manager_scopes
    where id in ('f1600000-0000-0000-0000-000000005001', 'f1600000-0000-0000-0000-000000005002')),
  2::bigint, 'manager_scopes: both scopes survived the member''s delete');

-- ===== Manager of Team A (Member A and No Login in scope; Member B and Demoted out of scope) =====
select pg_temp.login_as('f1600000-0000-0000-0000-00000000f001');
select is(
  pg_temp.affected($$update public.members set full_name = 'AM Member A Renamed' where id = 'f1600000-0000-0000-0000-00000000c001'$$),
  1::bigint, 'members: a manager updates a member in scope');
select is(
  pg_temp.affected($$update public.members set full_name = 'Hacked' where id = 'f1600000-0000-0000-0000-00000000c002'$$),
  0::bigint, 'members: a manager cannot update a member out of scope');
select throws_ok(
  $$update public.members set team_id = 'f1600000-0000-0000-0000-00000000a002'
    where id = 'f1600000-0000-0000-0000-00000000c001'$$,
  '42501', null, 'members: a manager cannot move a member out of their scope');
select is(
  pg_temp.affected($$delete from public.members where id = 'f1600000-0000-0000-0000-00000000c009'$$),
  0::bigint, 'members: a manager cannot delete a member in scope');
select is(
  pg_temp.affected($$update public.training_records set progress = 70 where id = 'f1600000-0000-0000-0000-00000000b001'$$),
  1::bigint, 'training_records: a manager updates a record in scope');
select is(
  pg_temp.affected($$insert into public.training_records (id, member_id, certificate_id) values
    ('f1600000-0000-0000-0000-00000000b004', 'f1600000-0000-0000-0000-00000000c001', 'f1600000-0000-0000-0000-00000000e002')$$),
  1::bigint, 'training_records: a manager adds a record in scope');
select throws_ok(
  $$insert into public.training_records (member_id, certificate_id) values
    ('f1600000-0000-0000-0000-00000000c002', 'f1600000-0000-0000-0000-00000000e002')$$,
  '42501', null, 'training_records: a manager cannot add a record out of scope');
select is(
  pg_temp.affected($$delete from public.training_records where id = 'f1600000-0000-0000-0000-00000000b004'$$),
  1::bigint, 'training_records: a manager deletes a record in scope');
select is(
  pg_temp.affected($$delete from public.training_records where id = 'f1600000-0000-0000-0000-00000000b002'$$),
  0::bigint, 'training_records: a manager cannot delete a record out of scope');
select is(
  pg_temp.affected($$update public.profiles set role = 'admin' where user_id = 'f1600000-0000-0000-0000-00000000f001'$$),
  0::bigint, 'profiles: a manager cannot change their own role');
select is(
  pg_temp.affected($$update public.profiles set role = 'admin' where user_id = 'f1600000-0000-0000-0000-00000000f00c'$$),
  0::bigint, 'profiles: a manager cannot change another user''s role');
select is(
  pg_temp.affected($$update public.manager_scopes set team_id = 'f1600000-0000-0000-0000-00000000a002'
    where id = 'f1600000-0000-0000-0000-000000005001'$$),
  0::bigint, 'manager_scopes: a manager cannot retarget their own scope');
select is(
  pg_temp.affected($$delete from public.manager_scopes where id = 'f1600000-0000-0000-0000-000000005001'$$),
  0::bigint, 'manager_scopes: a manager cannot delete their own scope');
select pg_temp.logout();
select is(
  (select full_name from public.members where id = 'f1600000-0000-0000-0000-00000000c002'),
  'AM Member B', 'members: the manager''s denied update left the member out of scope unchanged');
select ok(
  exists (select 1 from public.members where id = 'f1600000-0000-0000-0000-00000000c009'),
  'members: the member in scope survived the manager''s delete');
select is(
  (select progress from public.training_records where id = 'f1600000-0000-0000-0000-00000000b002'),
  20, 'training_records: the record out of scope survived the manager''s delete');
select is(
  (select role::text from public.profiles where user_id = 'f1600000-0000-0000-0000-00000000f001'),
  'manager', 'profiles: the manager''s own role is still manager');
select is(
  (select role::text from public.profiles where user_id = 'f1600000-0000-0000-0000-00000000f00c'),
  'member', 'profiles: the other user''s role is still member after the manager''s attempt');
select is(
  (select team_id from public.manager_scopes where id = 'f1600000-0000-0000-0000-000000005001'),
  'f1600000-0000-0000-0000-00000000a001'::uuid, 'manager_scopes: the manager''s scope still names Team A');

-- ===== Demoted manager (own member in Team B; a kept scope row on Team A) =====
select pg_temp.login_as('f1600000-0000-0000-0000-00000000f002');
-- Direct deletes are blocked by storage.protect_delete() unless this flag is set (the Storage API sets it).
select set_config('storage.allow_delete_query', 'true', true);
select results_eq(
  $$select id from public.members$$,
  array['f1600000-0000-0000-0000-00000000c003'::uuid],
  'members: a demoted manager sees only their own member row');
select is(
  pg_temp.affected($$update public.members set full_name = 'Hacked' where id = 'f1600000-0000-0000-0000-00000000c001'$$),
  0::bigint, 'members: a demoted manager cannot update a member of their former team');
select results_eq(
  $$select id from public.training_records$$,
  array['f1600000-0000-0000-0000-00000000b003'::uuid],
  'training_records: a demoted manager sees only their own records');
select is(
  pg_temp.affected($$update public.training_records set progress = 35 where id = 'f1600000-0000-0000-0000-00000000b003'$$),
  1::bigint, 'training_records: a demoted manager updates their own record');
select is(
  pg_temp.affected($$update public.training_records set progress = 99 where id = 'f1600000-0000-0000-0000-00000000b001'$$),
  0::bigint, 'training_records: a demoted manager cannot update a record of their former team');
select throws_ok(
  $$insert into public.training_records (member_id, certificate_id) values
    ('f1600000-0000-0000-0000-00000000c001', 'f1600000-0000-0000-0000-00000000e002')$$,
  '42501', null, 'training_records: a demoted manager cannot add a record in their former team');
select is(
  pg_temp.affected($$delete from public.training_records where id = 'f1600000-0000-0000-0000-00000000b001'$$),
  0::bigint, 'training_records: a demoted manager cannot delete a record of their former team');
select results_eq(
  $$select name from storage.objects where bucket_id = 'certificates' and name like 'f1600000-%' order by name$$,
  array['f1600000-0000-0000-0000-00000000c003/f1600000-0000-0000-0000-00000000b003/1762387200000.pdf'::text],
  'proof files: a demoted manager sees only their own');
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values
    ('certificates', 'f1600000-0000-0000-0000-00000000c003/f1600000-0000-0000-0000-00000000b003/1762387300000.pdf')$$,
  'proof files: a demoted manager uploads into their own folder');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values
    ('certificates', 'f1600000-0000-0000-0000-00000000c001/f1600000-0000-0000-0000-00000000b001/1762387300000.pdf')$$,
  '42501', null, 'proof files: a demoted manager cannot upload into their former team''s folder');
select is(
  pg_temp.affected($$update storage.objects set metadata = '{"by":"demoted"}'
    where name like 'f1600000-0000-0000-0000-00000000c001/%'$$),
  0::bigint, 'proof files: a demoted manager cannot update a file of their former team');
select is(
  pg_temp.affected($$delete from storage.objects where name like 'f1600000-0000-0000-0000-00000000c001/%'$$),
  0::bigint, 'proof files: a demoted manager cannot delete a file of their former team');
select pg_temp.logout();
select is(
  (select full_name from public.members where id = 'f1600000-0000-0000-0000-00000000c001'),
  'AM Member A Renamed', 'members: the demoted manager''s denied update left the member unchanged');
select is(
  (select progress from public.training_records where id = 'f1600000-0000-0000-0000-00000000b001'),
  70, 'training_records: the demoted manager''s denied update and delete left the former team''s record unchanged');
select is(
  (select count(*) from storage.objects
    where name like 'f1600000-0000-0000-0000-00000000c001/%' and metadata is null),
  1::bigint, 'proof files: the demoted manager''s denied update and delete left the former team''s file unchanged');

-- ===== Admin =====
select pg_temp.login_as('f1600000-0000-0000-0000-00000000f00a');
select is(
  pg_temp.affected($$update public.profiles set role = 'manager' where user_id = 'f1600000-0000-0000-0000-00000000f00d'$$),
  1::bigint, 'profiles: the admin changes another user''s role');
select is(
  pg_temp.affected($$delete from public.members where id = 'f1600000-0000-0000-0000-00000000c009'$$),
  1::bigint, 'members: the admin deletes a member');
select is(
  pg_temp.affected($$update public.training_records set progress = 90 where id = 'f1600000-0000-0000-0000-00000000b002'$$),
  1::bigint, 'training_records: the admin updates any record');
select is(
  pg_temp.affected($$delete from public.training_records where id = 'f1600000-0000-0000-0000-00000000b002'$$),
  1::bigint, 'training_records: the admin deletes any record');
select is(
  (select count(*) from public.manager_scopes
    where id in ('f1600000-0000-0000-0000-000000005001', 'f1600000-0000-0000-0000-000000005002')),
  2::bigint, 'manager_scopes: the admin reads every scope');
select is(
  pg_temp.affected($$update public.manager_scopes set team_id = 'f1600000-0000-0000-0000-00000000a002'
    where id = 'f1600000-0000-0000-0000-000000005001'$$),
  1::bigint, 'manager_scopes: the admin retargets a scope');
select pg_temp.logout();
select is(
  (select role::text from public.profiles where user_id = 'f1600000-0000-0000-0000-00000000f00d'),
  'manager', 'profiles: the admin''s role change was saved');

select * from finish();
rollback;
