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

-- Fixtures (as postgres; RLS bypassed). One team, managed by the manager.
insert into public.dcs (id, name) values ('e1000000-0000-0000-0000-0000000000d1', 'AL DC');
insert into public.programs (id, name, dc_id)
  values ('e1000000-0000-0000-0000-0000000000f1', 'AL Program', 'e1000000-0000-0000-0000-0000000000d1');
insert into public.teams (id, name, program_id)
  values ('e1000000-0000-0000-0000-00000000a001', 'AL Team', 'e1000000-0000-0000-0000-0000000000f1');
insert into public.courses (id, name, validity_months)
  values ('e1000000-0000-0000-0000-00000000e001', 'AL Course', 12);

-- Members that exist before their login, or never get one through the trigger.
insert into public.members (id, full_name, email, team_id) values
  ('e1000000-0000-0000-0000-00000000c004', 'AL Member Four', 'al-four-old@test.local', 'e1000000-0000-0000-0000-00000000a001'),
  ('e1000000-0000-0000-0000-00000000c005', 'AL Member Five', 'al-five-old@test.local', 'e1000000-0000-0000-0000-00000000a001'),
  ('e1000000-0000-0000-0000-00000000c0d1', 'AL Member Five D', 'al-five-d-old@test.local', 'e1000000-0000-0000-0000-00000000a001'),
  ('e1000000-0000-0000-0000-00000000c0b1', 'AL Linked', 'al-linked@test.local', 'e1000000-0000-0000-0000-00000000a001'),
  ('e1000000-0000-0000-0000-00000000c0b2', 'AL Other', 'al-other@test.local', 'e1000000-0000-0000-0000-00000000a001'),
  ('e1000000-0000-0000-0000-00000000c0c1', 'AL Already Linked', 'al-already@test.local', 'e1000000-0000-0000-0000-00000000a001'),
  ('e1000000-0000-0000-0000-00000000c007', 'AL Colleague', 'al-colleague@test.local', 'e1000000-0000-0000-0000-00000000a001');
insert into public.training_records (id, member_id, course_id, status, progress) values
  ('e1000000-0000-0000-0000-00000000b005', 'e1000000-0000-0000-0000-00000000c005',
   'e1000000-0000-0000-0000-00000000e001', 'in_progress', 50),
  ('e1000000-0000-0000-0000-00000000b0d1', 'e1000000-0000-0000-0000-00000000c0d1',
   'e1000000-0000-0000-0000-00000000e001', 'in_progress', 55),
  ('e1000000-0000-0000-0000-00000000b007', 'e1000000-0000-0000-0000-00000000c007',
   'e1000000-0000-0000-0000-00000000e001', 'in_progress', 70);

-- Logins. None of these addresses has a member yet, so every profile starts unlinked.
insert into auth.users (id, email) values
  ('e1000000-0000-0000-0000-00000000f00a', 'al-admin@test.local'),
  ('e1000000-0000-0000-0000-00000000f00b', 'al-manager@test.local'),
  ('e1000000-0000-0000-0000-00000000f001', 'al-one@test.local'),
  ('e1000000-0000-0000-0000-00000000f002', 'al-import@test.local'),
  ('e1000000-0000-0000-0000-00000000f003', 'e1.mixed.case@test.local'),
  ('e1000000-0000-0000-0000-00000000f033', 'E1.Lower@Test.Local'),
  ('e1000000-0000-0000-0000-00000000f004', 'al-four-new@test.local'),
  ('e1000000-0000-0000-0000-00000000f005', 'al-five-new@test.local'),
  ('e1000000-0000-0000-0000-00000000f0d1', 'al-five-d-new@test.local'),
  ('e1000000-0000-0000-0000-00000000f01b', 'al-no-jwt@test.local'),
  ('e1000000-0000-0000-0000-00000000f0b1', 'al-x@test.local'),
  ('e1000000-0000-0000-0000-00000000f0c1', 'al-already-login@test.local');
update public.profiles set role = 'admin' where user_id = 'e1000000-0000-0000-0000-00000000f00a';
update public.profiles set role = 'manager' where user_id = 'e1000000-0000-0000-0000-00000000f00b';
insert into public.manager_scopes (user_id, team_id)
  values ('e1000000-0000-0000-0000-00000000f00b', 'e1000000-0000-0000-0000-00000000a001');

-- Links made by hand (the runbook's admin step), so the login's address differs from its member's.
update public.profiles set member_id = 'e1000000-0000-0000-0000-00000000c0b1'
  where user_id = 'e1000000-0000-0000-0000-00000000f0b1';
update public.profiles set member_id = 'e1000000-0000-0000-0000-00000000c0c1'
  where user_id = 'e1000000-0000-0000-0000-00000000f0c1';

-- DB-2 staging: one row that creates a new member for the existing login.
insert into public.import_batches (id, file_name, expected_rows)
  values ('e1000000-0000-0000-0000-000000000b01', 'al.xlsx', 1);
insert into public.import_rows (batch_id, row_no, raw, action, normalized) values
  ('e1000000-0000-0000-0000-000000000b01', 2, '{}', 'create',
   '{"member":{"email":"al-import@test.local","fullName":"AL Imported","teamId":"e1000000-0000-0000-0000-00000000a001"},
     "course":{"id":"e1000000-0000-0000-0000-00000000e001"},
     "record":{"status":"not_started","progress":0,"plannedExamDate":null,"issuedDate":null,"certificateUrl":null,
               "viaCompany":null,"refundStatus":null,"notes":null}}');

-- ===== DB-1: a member added after the login links to it =====
select pg_temp.login_as('e1000000-0000-0000-0000-00000000f00a');
insert into public.members (id, full_name, email, team_id)
  values ('e1000000-0000-0000-0000-00000000c001', 'AL Member One', 'al-one@test.local', 'e1000000-0000-0000-0000-00000000a001');
select pg_temp.logout();
select is((select member_id from public.profiles where user_id = 'e1000000-0000-0000-0000-00000000f001'),
  'e1000000-0000-0000-0000-00000000c001'::uuid,
  'DB-1: an admin adding the member links the login that already exists');

-- ===== DB-1b: a member inserted with no JWT links too =====
select pg_temp.logout();
insert into public.members (id, full_name, email, team_id)
  values ('e1000000-0000-0000-0000-00000000c01b', 'AL No JWT', 'al-no-jwt@test.local', 'e1000000-0000-0000-0000-00000000a001');
select is((select member_id from public.profiles where user_id = 'e1000000-0000-0000-0000-00000000f01b'),
  'e1000000-0000-0000-0000-00000000c01b'::uuid,
  'DB-1b: a member inserted with no JWT links the login that already exists');

-- ===== DB-2: a member created by an import links the same way =====
select pg_temp.login_as('e1000000-0000-0000-0000-00000000f00a');
select lives_ok($$select public.commit_import('e1000000-0000-0000-0000-000000000b01')$$,
  'DB-2: the admin commits the import that creates the member');
select pg_temp.logout();
select is(
  (select count(*) from public.profiles p join public.members m on m.id = p.member_id
    where p.user_id = 'e1000000-0000-0000-0000-00000000f002' and m.email = 'al-import@test.local'),
  1::bigint, 'DB-2: a member created by commit_import links the login that already exists');

-- ===== DB-3: matching ignores case =====
select pg_temp.login_as('e1000000-0000-0000-0000-00000000f00a');
insert into public.members (id, full_name, email, team_id) values
  ('e1000000-0000-0000-0000-00000000c003', 'AL Mixed', 'E1.Mixed.Case@Test.Local', 'e1000000-0000-0000-0000-00000000a001'),
  ('e1000000-0000-0000-0000-00000000c033', 'AL Lower', 'e1.lower@test.local', 'e1000000-0000-0000-0000-00000000a001');
select pg_temp.logout();
select is((select member_id from public.profiles where user_id = 'e1000000-0000-0000-0000-00000000f003'),
  'e1000000-0000-0000-0000-00000000c003'::uuid,
  'DB-3: a mixed-case member address links a lower-case login');
select is((select member_id from public.profiles where user_id = 'e1000000-0000-0000-0000-00000000f033'),
  'e1000000-0000-0000-0000-00000000c033'::uuid,
  'DB-3b: a lower-case member address links a mixed-case login');

-- ===== DB-4: the admin correcting a member's e-mail links the login =====
select pg_temp.login_as('e1000000-0000-0000-0000-00000000f00a');
update public.members set email = 'al-four-new@test.local' where id = 'e1000000-0000-0000-0000-00000000c004';
select pg_temp.logout();
select is((select member_id from public.profiles where user_id = 'e1000000-0000-0000-0000-00000000f004'),
  'e1000000-0000-0000-0000-00000000c004'::uuid,
  'DB-4: an admin changing a member''s e-mail to an unlinked login''s address links it');

-- ===== DB-5: a manager's e-mail edit never links =====
select pg_temp.login_as('e1000000-0000-0000-0000-00000000f00b');
update public.members set email = 'al-five-new@test.local' where id = 'e1000000-0000-0000-0000-00000000c005';
select pg_temp.logout();
select is((select email::text from public.members where id = 'e1000000-0000-0000-0000-00000000c005'),
  'al-five-new@test.local', 'DB-5: the manager''s e-mail edit was saved');
select is((select member_id is null from public.profiles where user_id = 'e1000000-0000-0000-0000-00000000f005'),
  true, 'DB-5: a manager changing a member''s e-mail to an unlinked login''s address does not link it');
select pg_temp.login_as('e1000000-0000-0000-0000-00000000f005');
select is((select count(*) from public.members), 0::bigint,
  'DB-5: that login still sees no member');
select is((select count(*) from public.training_records), 0::bigint,
  'DB-5: that login still sees no training record');
select pg_temp.logout();

-- ===== DB-5d: the admin's later save of an unchanged e-mail never links the manager's edit =====
select pg_temp.login_as('e1000000-0000-0000-0000-00000000f00b');
update public.members set email = 'al-five-d-new@test.local' where id = 'e1000000-0000-0000-0000-00000000c0d1';
select pg_temp.logout();
select is((select email::text from public.members where id = 'e1000000-0000-0000-0000-00000000c0d1'),
  'al-five-d-new@test.local', 'DB-5d: the manager''s e-mail edit was saved');
-- The app's member form always sends email, unchanged or not.
select pg_temp.login_as('e1000000-0000-0000-0000-00000000f00a');
update public.members set full_name = 'AL Member Five D Renamed', email = email
  where id = 'e1000000-0000-0000-0000-00000000c0d1';
select pg_temp.logout();
select is((select member_id is null from public.profiles where user_id = 'e1000000-0000-0000-0000-00000000f0d1'),
  true, 'DB-5d: an admin save that keeps the manager-set e-mail does not link the login');
select pg_temp.login_as('e1000000-0000-0000-0000-00000000f0d1');
select is((select count(*) from public.members), 0::bigint,
  'DB-5d: that login still sees no member');
select is((select count(*) from public.training_records), 0::bigint,
  'DB-5d: that login still sees no training record');
select pg_temp.logout();

-- ===== DB-5b: a link is never moved =====
select pg_temp.login_as('e1000000-0000-0000-0000-00000000f00a');
update public.members set email = 'al-x@test.local' where id = 'e1000000-0000-0000-0000-00000000c0b2';
select pg_temp.logout();
select is((select email::text from public.members where id = 'e1000000-0000-0000-0000-00000000c0b2'),
  'al-x@test.local', 'DB-5b: the admin''s e-mail edit was saved');
select is((select member_id from public.profiles where user_id = 'e1000000-0000-0000-0000-00000000f0b1'),
  'e1000000-0000-0000-0000-00000000c0b1'::uuid,
  'DB-5b: a linked login keeps its member when another member takes its address');
select is((select count(*) from public.profiles where member_id = 'e1000000-0000-0000-0000-00000000c0b2'),
  0::bigint, 'DB-5b: the member that took the address gets no login');

-- ===== DB-5c: a new login for an already-linked member is created unlinked =====
select lives_ok(
  $$insert into auth.users (id, email) values ('e1000000-0000-0000-0000-00000000f0c2', 'al-already@test.local')$$,
  'DB-5c: inviting the address of an already-linked member does not fail');
select is((select member_id is null from public.profiles where user_id = 'e1000000-0000-0000-0000-00000000f0c2'),
  true, 'DB-5c: the new login is created without a member');

-- ===== DB-6: a member with no matching login changes no profile =====
create temp table al_linked_before as
  select count(*) as linked from public.profiles where member_id is not null;
select pg_temp.login_as('e1000000-0000-0000-0000-00000000f00a');
select lives_ok(
  $$insert into public.members (full_name, email, team_id)
    values ('AL Nobody', 'al-nobody@test.local', 'e1000000-0000-0000-0000-00000000a001')$$,
  'DB-6: adding a member with no login succeeds');
select pg_temp.logout();
select is((select count(*) from public.profiles where member_id is not null),
  (select linked from al_linked_before), 'DB-6: adding a member with no login links nobody');

-- ===== DB-7: the login linked in DB-1 sees only its own data =====
insert into public.training_records (id, member_id, course_id, status, progress)
  values ('e1000000-0000-0000-0000-00000000b001', 'e1000000-0000-0000-0000-00000000c001',
          'e1000000-0000-0000-0000-00000000e001', 'in_progress', 10);
select pg_temp.login_as('e1000000-0000-0000-0000-00000000f001');
select set_eq($$select id from public.members$$,
  array['e1000000-0000-0000-0000-00000000c001']::uuid[],
  'DB-7: the linked login sees its own member row and no colleague''s');
select set_eq($$select id from public.training_records$$,
  array['e1000000-0000-0000-0000-00000000b001']::uuid[],
  'DB-7: the linked login sees its own records and no colleague''s');
select pg_temp.logout();

select * from finish();
rollback;
