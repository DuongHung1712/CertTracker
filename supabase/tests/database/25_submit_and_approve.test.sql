begin;
create extension if not exists pgtap with schema extensions;
select plan(84);

create function pg_temp.login_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;
-- Back to the table owner with no JWT, so app_role() is null (a trusted writer).
create function pg_temp.logout() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '{}', true);
end;
$$;
create function pg_temp.rows_changed(q text) returns int language plpgsql as $$
declare n int;
begin
  execute q;
  get diagnostics n = row_count;
  return n;
end;
$$;
create function pg_temp.appr(rid uuid) returns text language sql as $$
  select approval::text from public.training_records where id = rid;
$$;

-- A-6: rows that exist before the test (seed) are already migrated.
select is((select count(*)::int from public.training_records where status = 'done' and approval is distinct from 'approved'), 0,
  'seed Completed rows are Approved (written by the trigger; the migration backfill was proven on a populated scratch database)');
select is((select count(*)::int from public.training_records where status <> 'done' and approval is not null), 0,
  'seed not-completed rows have no approval');

delete from public.training_records;
delete from public.members;

insert into public.dcs (id, name) values ('00000000-0000-0000-0000-0000000000d1', 'Appr DC');
insert into public.programs (id, name, dc_id)
  values ('00000000-0000-0000-0000-0000000000f1', 'Appr Program', '00000000-0000-0000-0000-0000000000d1');
insert into public.teams (id, name, program_id) values
  ('11111111-1111-1111-1111-111111111111', 'Team A', '00000000-0000-0000-0000-0000000000f1'),
  ('22222222-2222-2222-2222-222222222222', 'Team B', '00000000-0000-0000-0000-0000000000f1');
insert into public.members (id, full_name, email, team_id, is_active) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'A One', 'a1@test.local', '11111111-1111-1111-1111-111111111111', true),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'A Two', 'a2@test.local', '11111111-1111-1111-1111-111111111111', true),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'B Three', 'b3@test.local', '22222222-2222-2222-2222-222222222222', true),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Mgr Own B', 'manager@test.local', '22222222-2222-2222-2222-222222222222', true),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Mgr Own A', 'mgr2@test.local', '11111111-1111-1111-1111-111111111111', true),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'Admin Own', 'admin@test.local', '11111111-1111-1111-1111-111111111111', true);
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'admin@test.local'),
  ('a0000000-0000-0000-0000-00000000000b', 'manager@test.local'),
  ('a0000000-0000-0000-0000-00000000000c', 'a1@test.local'),
  ('a0000000-0000-0000-0000-00000000000e', 'mgr2@test.local');
update public.profiles set role = 'admin'   where user_id = 'a0000000-0000-0000-0000-00000000000a';
update public.profiles set role = 'manager' where user_id = 'a0000000-0000-0000-0000-00000000000b';
update public.profiles set role = 'manager' where user_id = 'a0000000-0000-0000-0000-00000000000e';
insert into public.manager_scopes (team_id, user_id) values
  ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-00000000000b'),
  ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-00000000000e');

insert into public.providers (id, name) values ('eeeeeeee-0000-0000-0000-000000000001', 'Provider One');
insert into public.courses (id, name, provider_id)
  values ('c0c0c0c0-0000-0000-0000-000000000001', 'Granting One', 'eeeeeeee-0000-0000-0000-000000000001');
insert into public.certificates (id, name, kind, provider_id, validity_months, course_id) values
  ('99999999-0000-0000-0000-000000000001', 'Exam One',       'exam',       'eeeeeeee-0000-0000-0000-000000000001', 12, null),
  ('99999999-0000-0000-0000-000000000002', 'Completion One', 'completion', 'eeeeeeee-0000-0000-0000-000000000001', null, 'c0c0c0c0-0000-0000-0000-000000000001'),
  ('99999999-0000-0000-0000-000000000003', 'Exam Two',       'exam',       'eeeeeeee-0000-0000-0000-000000000001', 12, null),
  ('99999999-0000-0000-0000-000000000004', 'Exam Three',     'exam',       'eeeeeeee-0000-0000-0000-000000000001', 12, null);
insert into public.courses (id, name, provider_id, prepares_for_id)
  values ('c0c0c0c0-0000-0000-0000-000000000002', 'Prep One', 'eeeeeeee-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000001');

-- Trusted writer (no JWT) saving a Completed row: approved, like an admin.
select pg_temp.logout();
insert into public.training_records (id, member_id, certificate_id, status, progress, issued_date) values
  ('d0000000-0000-0000-0000-000000000b01', 'aaaaaaaa-0000-0000-0000-000000000003', '99999999-0000-0000-0000-000000000001', 'done', 100, public.vn_today() - 5);
select is(pg_temp.appr('d0000000-0000-0000-0000-000000000b01'), 'approved', 'a trusted writer saving Completed gives Approved');

-- ===== Member =====
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000c');
select lives_ok($$insert into public.training_records (id, member_id, certificate_id, status, progress, issued_date)
  values ('d0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000001', 'done', 100, public.vn_today() - 5)$$,
  'member: inserts a Completed exam');
select lives_ok($$insert into public.training_records (id, member_id, certificate_id, status, progress, issued_date)
  values ('d0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000002', 'done', 100, public.vn_today() - 5)$$,
  'member: inserts a Completed course completion');
select lives_ok($$insert into public.training_records (id, member_id, certificate_id, status, progress)
  values ('d0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000003', 'in_progress', 40)$$,
  'member: inserts an in-progress item');
select throws_ok($$insert into public.training_records (member_id, certificate_id, status, progress, issued_date, approval)
  values ('aaaaaaaa-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000003', 'done', 100, public.vn_today(), 'approved')$$,
  '42501', null, 'A-2: member cannot insert an Approved row');
select throws_ok($$insert into public.training_records (member_id, certificate_id, status, progress, reviewed_by)
  values ('aaaaaaaa-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000003', 'in_progress', 10, 'a0000000-0000-0000-0000-00000000000b')$$,
  '42501', null, 'A-2: member cannot insert reviewed_by');
select pg_temp.logout();
select is(pg_temp.appr('d0000000-0000-0000-0000-000000000001'), 'waiting', 'A-1: member exam Completed waits');
select is(pg_temp.appr('d0000000-0000-0000-0000-000000000002'), 'waiting', 'A-1: member course completion waits');
select is(pg_temp.appr('d0000000-0000-0000-0000-000000000003'), null, 'a not-completed item has no approval');

select pg_temp.login_as('a0000000-0000-0000-0000-00000000000c');
select throws_ok($$update public.training_records set approval = 'approved' where id = 'd0000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'A-2: member cannot approve');
select throws_ok($$update public.training_records set approval = 'returned', approval_note = 'x' where id = 'd0000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'A-2: member cannot return');
select throws_ok($$update public.training_records set approval_note = 'self note' where id = 'd0000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'A-2: member cannot write the note');
select throws_ok($$update public.training_records set reviewed_by = 'a0000000-0000-0000-0000-00000000000c' where id = 'd0000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'A-2: member cannot set reviewed_by');
select throws_ok($$update public.training_records set reviewed_at = now() where id = 'd0000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'A-2: member cannot set reviewed_at');
-- Through the import function (admin only) and the locked copy function.
select throws_ok($$select public.commit_import('c6b00000-0000-0000-0000-0000000000a1')$$, '42501', null,
  'A-2: member cannot write records through commit_import');
select throws_ok($$select public.copy_courses_to_certificates()$$, '42501', null,
  'A-2: member cannot write records through copy_courses_to_certificates');
select pg_temp.logout();
select is(pg_temp.appr('d0000000-0000-0000-0000-000000000001'), 'waiting', 'the refused edits changed nothing');

-- ===== Manager in scope =====
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000b');
select lives_ok($$insert into public.training_records (id, member_id, certificate_id, status, progress, issued_date)
  values ('d0000000-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000002', '99999999-0000-0000-0000-000000000001', 'done', 100, public.vn_today() - 5),
         ('d0000000-0000-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000002', '99999999-0000-0000-0000-000000000002', 'done', 100, public.vn_today() - 5)$$,
  'manager in scope: saves Completed items');
select lives_ok($$update public.training_records set approval = 'approved' where id = 'd0000000-0000-0000-0000-000000000001'$$,
  'A-1: manager in scope approves a waiting exam');
select lives_ok($$update public.training_records set approval = 'approved' where id = 'd0000000-0000-0000-0000-000000000002'$$,
  'A-1: manager in scope approves a waiting course completion');
select pg_temp.logout();
select is(pg_temp.appr('d0000000-0000-0000-0000-000000000011'), 'approved', 'A-1: manager own exam save is Approved');
select is(pg_temp.appr('d0000000-0000-0000-0000-000000000012'), 'approved', 'A-1: manager own completion save is Approved');
select results_eq($$select approval::text, reviewed_by, reviewed_at is not null from public.training_records where id = 'd0000000-0000-0000-0000-000000000001'$$,
  $$values ('approved', 'a0000000-0000-0000-0000-00000000000b'::uuid, true)$$, 'approve stamps reviewed_by and reviewed_at');

select pg_temp.login_as('a0000000-0000-0000-0000-00000000000b');
select throws_ok($$update public.training_records set approval = 'returned' where id = 'd0000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'A-4: returned without a note is refused');
select throws_ok($$update public.training_records set approval = 'returned', approval_note = '   ' where id = 'd0000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'A-4: returned with a blank note is refused');
select lives_ok($$update public.training_records set approval = 'returned', approval_note = 'Wrong date' where id = 'd0000000-0000-0000-0000-000000000001'$$,
  'manager in scope returns with a note');
select pg_temp.logout();
select results_eq($$select approval::text, approval_note, reviewed_by from public.training_records where id = 'd0000000-0000-0000-0000-000000000001'$$,
  $$values ('returned', 'Wrong date', 'a0000000-0000-0000-0000-00000000000b'::uuid)$$, 'return stamps the note and the reviewer');

-- ===== Manager out of scope (A-3) =====
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000b');
select is(pg_temp.rows_changed($$update public.training_records set approval = 'returned', approval_note = 'no' where id = 'd0000000-0000-0000-0000-000000000b01'$$),
  0, 'A-3: out-of-scope manager cannot return');
select is(pg_temp.rows_changed($$update public.training_records set approval = 'approved' where id = 'd0000000-0000-0000-0000-000000000b01'$$),
  0, 'A-3: out-of-scope manager cannot approve');
select throws_ok($$insert into public.training_records (member_id, certificate_id, status, progress, issued_date)
  values ('aaaaaaaa-0000-0000-0000-000000000003', '99999999-0000-0000-0000-000000000003', 'done', 100, public.vn_today())$$,
  '42501', null, 'A-3: out-of-scope manager cannot insert for another team');
select pg_temp.logout();
select is(pg_temp.appr('d0000000-0000-0000-0000-000000000b01'), 'approved', 'A-3: the out-of-scope row is untouched');

-- ===== A-5: member edits send an Approved or Returned item back to waiting =====
-- Row 1 is Returned (note). A returned item fixed by the member resubmits and loses the note.
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000c');
select lives_ok($$update public.training_records set issued_date = public.vn_today() - 6 where id = 'd0000000-0000-0000-0000-000000000001'$$,
  'member fixes a returned item');
select pg_temp.logout();
select results_eq($$select approval::text, approval_note, reviewed_by, reviewed_at from public.training_records where id = 'd0000000-0000-0000-0000-000000000001'$$,
  $$values ('waiting', null::text, null::uuid, null::timestamptz)$$, 'A-5: returned goes to waiting with the note and reviewer cleared');

-- Each C3 field on an Approved item.
update public.training_records set approval = 'approved' where id = 'd0000000-0000-0000-0000-000000000002';
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000c');
update public.training_records set notes = 'just a note' where id = 'd0000000-0000-0000-0000-000000000002';
select pg_temp.logout();
select is(pg_temp.appr('d0000000-0000-0000-0000-000000000002'), 'approved', 'A-5: a notes edit does not reset Approved');

select pg_temp.login_as('a0000000-0000-0000-0000-00000000000c');
update public.training_records set issued_date = public.vn_today() - 7 where id = 'd0000000-0000-0000-0000-000000000002';
select pg_temp.logout();
select is(pg_temp.appr('d0000000-0000-0000-0000-000000000002'), 'waiting', 'A-5: issued date edit resets Approved');

update public.training_records set approval = 'approved' where id = 'd0000000-0000-0000-0000-000000000002';
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000c');
update public.training_records set certificate_url = 'https://example.test/c' where id = 'd0000000-0000-0000-0000-000000000002';
select pg_temp.logout();
select is(pg_temp.appr('d0000000-0000-0000-0000-000000000002'), 'waiting', 'A-5: certificate link edit resets Approved');

update public.training_records set approval = 'approved' where id = 'd0000000-0000-0000-0000-000000000002';
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000c');
update public.training_records set evidence_path = 'a/proof.pdf' where id = 'd0000000-0000-0000-0000-000000000002';
select pg_temp.logout();
select is(pg_temp.appr('d0000000-0000-0000-0000-000000000002'), 'waiting', 'A-5: proof edit resets Approved');

update public.training_records set approval = 'approved' where id = 'd0000000-0000-0000-0000-000000000001';
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000c');
update public.training_records set course_id = 'c0c0c0c0-0000-0000-0000-000000000002' where id = 'd0000000-0000-0000-0000-000000000001';
select pg_temp.logout();
select is(pg_temp.appr('d0000000-0000-0000-0000-000000000001'), 'waiting', 'A-5: course studied edit resets Approved');

update public.training_records set approval = 'approved' where id = 'd0000000-0000-0000-0000-000000000001';
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000c');
update public.training_records set certificate_id = '99999999-0000-0000-0000-000000000004', course_id = null where id = 'd0000000-0000-0000-0000-000000000001';
select pg_temp.logout();
select is(pg_temp.appr('d0000000-0000-0000-0000-000000000001'), 'waiting', 'A-5: certificate edit resets Approved');

-- Not-completed items: progress and notes edits change nothing; leaving Completed clears; returning to Completed waits.
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000c');
update public.training_records set progress = 60, notes = 'more' where id = 'd0000000-0000-0000-0000-000000000003';
select pg_temp.logout();
select is(pg_temp.appr('d0000000-0000-0000-0000-000000000003'), null, 'A-5: progress and notes on a not-completed item keep approval null');

update public.training_records set approval = 'approved' where id = 'd0000000-0000-0000-0000-000000000001';
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000c');
update public.training_records set status = 'in_progress', progress = 50 where id = 'd0000000-0000-0000-0000-000000000001';
select pg_temp.logout();
select results_eq($$select approval::text, approval_note, reviewed_by from public.training_records where id = 'd0000000-0000-0000-0000-000000000001'$$,
  $$values (null::text, null::text, null::uuid)$$, 'A-5: Completed to In progress clears the approval');
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000c');
update public.training_records set status = 'done', progress = 100, issued_date = public.vn_today() where id = 'd0000000-0000-0000-0000-000000000001';
select pg_temp.logout();
select is(pg_temp.appr('d0000000-0000-0000-0000-000000000001'), 'waiting', 'In progress back to Completed waits');

-- ===== Extra pins =====
-- A member sending approval = null on an Approved item keeps it Approved.
update public.training_records set approval = 'approved' where id = 'd0000000-0000-0000-0000-000000000002';
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000c');
update public.training_records set approval = null where id = 'd0000000-0000-0000-0000-000000000002';
select pg_temp.logout();
select is(pg_temp.appr('d0000000-0000-0000-0000-000000000002'), 'approved', 'member: approval = null keeps Approved');
-- Returned: a notes-only member edit stays Returned; setting waiting resubmits and clears the note.
update public.training_records set approval = 'returned', approval_note = 'Fix it' where id = 'd0000000-0000-0000-0000-000000000002';
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000c');
update public.training_records set notes = 'working on it' where id = 'd0000000-0000-0000-0000-000000000002';
select pg_temp.logout();
select results_eq($$select approval::text, approval_note from public.training_records where id = 'd0000000-0000-0000-0000-000000000002'$$,
  $$values ('waiting', null::text)$$, 'member: any save of a Returned item resubmits it and clears the note');
update public.training_records set approval = 'returned', approval_note = 'Fix it again' where id = 'd0000000-0000-0000-0000-000000000002';
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000b');
update public.training_records set notes = 'reviewer note edit' where id = 'd0000000-0000-0000-0000-000000000002';
select pg_temp.logout();
select is(pg_temp.appr('d0000000-0000-0000-0000-000000000002'), 'returned', 'manager in scope: editing notes on a Returned item keeps it Returned');
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000a');
update public.training_records set notes = 'admin note edit' where id = 'd0000000-0000-0000-0000-000000000002';
select pg_temp.logout();
select is(pg_temp.appr('d0000000-0000-0000-0000-000000000002'), 'returned', 'admin: editing notes on a Returned item keeps it Returned');
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000c');
update public.training_records set approval = 'waiting' where id = 'd0000000-0000-0000-0000-000000000002';
select pg_temp.logout();
select results_eq($$select approval::text, approval_note from public.training_records where id = 'd0000000-0000-0000-0000-000000000002'$$,
  $$values ('waiting', null::text)$$, 'member: setting waiting resubmits a Returned item and clears the note');
-- Manager in scope: editing a Waiting item keeps it Waiting; In progress to Completed gives Approved.
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000b');
update public.training_records set issued_date = public.vn_today() - 9 where id = 'd0000000-0000-0000-0000-000000000002';
select pg_temp.logout();
select is(pg_temp.appr('d0000000-0000-0000-0000-000000000002'), 'waiting', 'manager in scope: editing a Waiting item keeps it Waiting');
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000b');
update public.training_records set status = 'done', progress = 100, issued_date = public.vn_today() - 2 where id = 'd0000000-0000-0000-0000-000000000003';
select pg_temp.logout();
select is(pg_temp.appr('d0000000-0000-0000-0000-000000000003'), 'approved', 'manager in scope: In progress to Completed gives Approved');
-- Member: status and approval in one statement is refused.
insert into public.training_records (id, member_id, certificate_id, status, progress)
  values ('d0000000-0000-0000-0000-000000000041', 'aaaaaaaa-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000001', 'in_progress', 10);
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000c');
select throws_ok($$update public.training_records set status = 'done', progress = 100, issued_date = public.vn_today(), approval = 'approved'
  where id = 'd0000000-0000-0000-0000-000000000041'$$, '42501', null, 'A-2: member cannot complete and approve in one statement');
select pg_temp.logout();

-- ===== A manager is a member on their own row =====
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000b');
select lives_ok($$insert into public.training_records (id, member_id, certificate_id, status, progress, issued_date)
  values ('d0000000-0000-0000-0000-000000000031', 'aaaaaaaa-0000-0000-0000-000000000004', '99999999-0000-0000-0000-000000000001', 'done', 100, public.vn_today() - 5)$$,
  'manager (own team out of scope): inserts their own Completed item');
select pg_temp.logout();
select is(pg_temp.appr('d0000000-0000-0000-0000-000000000031'), 'waiting', 'manager own Completed item waits (out of scope)');
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000b');
select throws_ok($$update public.training_records set approval = 'approved' where id = 'd0000000-0000-0000-0000-000000000031'$$,
  '42501', null, 'manager cannot approve their own item (out of scope)');
select throws_ok($$update public.training_records set approval = 'returned', approval_note = 'x' where id = 'd0000000-0000-0000-0000-000000000031'$$,
  '42501', null, 'manager cannot return their own item (out of scope)');
select pg_temp.logout();
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000e');
select lives_ok($$insert into public.training_records (id, member_id, certificate_id, status, progress, issued_date)
  values ('d0000000-0000-0000-0000-000000000032', 'aaaaaaaa-0000-0000-0000-000000000005', '99999999-0000-0000-0000-000000000001', 'done', 100, public.vn_today() - 5)$$,
  'manager (own team in scope): inserts their own Completed item');
select pg_temp.logout();
select is(pg_temp.appr('d0000000-0000-0000-0000-000000000032'), 'waiting', 'manager own Completed item waits (in scope)');
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000e');
select throws_ok($$update public.training_records set approval = 'approved' where id = 'd0000000-0000-0000-0000-000000000032'$$,
  '42501', null, 'manager cannot approve their own item (in scope)');
select pg_temp.logout();
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000a');
select lives_ok($$insert into public.training_records (id, member_id, certificate_id, status, progress, issued_date)
  values ('d0000000-0000-0000-0000-000000000033', 'aaaaaaaa-0000-0000-0000-000000000006', '99999999-0000-0000-0000-000000000001', 'done', 100, public.vn_today() - 5)$$,
  'admin: inserts their own Completed item');
select pg_temp.logout();
select is(pg_temp.appr('d0000000-0000-0000-0000-000000000033'), 'approved', 'admin own item is Approved');
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000a');
select lives_ok($$update public.training_records set approval = 'returned', approval_note = 'self check' where id = 'd0000000-0000-0000-0000-000000000033'$$,
  'admin may review their own item');
select pg_temp.logout();

-- A manager is a member on their own Returned row: any save resubmits it.
update public.training_records set approval = 'returned', approval_note = 'Explain in notes' where id = 'd0000000-0000-0000-0000-000000000031';
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000b');
update public.training_records set notes = 'explained' where id = 'd0000000-0000-0000-0000-000000000031';
select pg_temp.logout();
select results_eq($$select approval::text, approval_note from public.training_records where id = 'd0000000-0000-0000-0000-000000000031'$$,
  $$values ('waiting', null::text)$$, 'manager own Returned row: any save resubmits it and clears the note');

-- ===== Nobody but an admin moves a record to another member =====
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000b');
select throws_ok($$update public.training_records set member_id = 'aaaaaaaa-0000-0000-0000-000000000004' where id = 'd0000000-0000-0000-0000-000000000011'$$,
  '42501', null, 'manager cannot move a managed item to their own row');
select throws_ok($$update public.training_records set member_id = 'aaaaaaaa-0000-0000-0000-000000000002' where id = 'd0000000-0000-0000-0000-000000000031'$$,
  '42501', null, 'manager cannot move their own item to a managed member');
select throws_ok($$update public.training_records set member_id = 'aaaaaaaa-0000-0000-0000-000000000001' where id = 'd0000000-0000-0000-0000-000000000011'$$,
  '42501', null, 'manager cannot move an item between two managed members');
select lives_ok($$insert into public.training_records (id, member_id, certificate_id, status, progress, issued_date)
  values ('d0000000-0000-0000-0000-000000000051', 'aaaaaaaa-0000-0000-0000-000000000002', '99999999-0000-0000-0000-000000000004', 'done', 100, public.vn_today() - 5)$$,
  'manager: saves an auto-approved item on a managed member');
select throws_ok($$update public.training_records set member_id = 'aaaaaaaa-0000-0000-0000-000000000004' where id = 'd0000000-0000-0000-0000-000000000051'$$,
  '42501', null, 'self-approval by moving the item to the manager own row is refused');
select pg_temp.logout();
select is((select member_id from public.training_records where id = 'd0000000-0000-0000-0000-000000000051'),
  'aaaaaaaa-0000-0000-0000-000000000002'::uuid, 'the item stays with the managed member');
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000c');
select throws_ok($$update public.training_records set member_id = 'aaaaaaaa-0000-0000-0000-000000000002' where id = 'd0000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'member cannot move an item');
select pg_temp.logout();
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000a');
select lives_ok($$update public.training_records set member_id = 'aaaaaaaa-0000-0000-0000-000000000003' where id = 'd0000000-0000-0000-0000-000000000051'$$,
  'admin can move an item to another member');
select pg_temp.logout();
select is((select member_id from public.training_records where id = 'd0000000-0000-0000-0000-000000000051'),
  'aaaaaaaa-0000-0000-0000-000000000003'::uuid, 'the admin move took effect');

-- ===== Admin =====

select pg_temp.login_as('a0000000-0000-0000-0000-00000000000a');
select lives_ok($$insert into public.training_records (id, member_id, certificate_id, status, progress, issued_date)
  values ('d0000000-0000-0000-0000-000000000021', 'aaaaaaaa-0000-0000-0000-000000000003', '99999999-0000-0000-0000-000000000003', 'done', 100, public.vn_today() - 5)$$,
  'admin: saves a Completed item');
select lives_ok($$update public.training_records set approval = 'returned', approval_note = 'Add proof' where id = 'd0000000-0000-0000-0000-000000000b01'$$,
  'admin: returns any item');
select lives_ok($$update public.training_records set approval = 'approved' where id = 'd0000000-0000-0000-0000-000000000b01'$$,
  'admin: approves it again');
select pg_temp.logout();
select is(pg_temp.appr('d0000000-0000-0000-0000-000000000021'), 'approved', 'A-1: admin save is Approved');
select results_eq($$select approval::text, approval_note, reviewed_by from public.training_records where id = 'd0000000-0000-0000-0000-000000000b01'$$,
  $$values ('approved', null::text, 'a0000000-0000-0000-0000-00000000000a'::uuid)$$, 'approving clears the note and stamps the admin');

-- Admin import path: commit_import yields Approved.
insert into public.import_batches (id, file_name, expected_rows) values ('c6b00000-0000-0000-0000-0000000000a2', 'a.xlsx', 1);
insert into public.import_rows (batch_id, row_no, raw, action, normalized) values
  ('c6b00000-0000-0000-0000-0000000000a2', 2, '{}', 'create', jsonb_build_object(
    'member', jsonb_build_object('id', 'aaaaaaaa-0000-0000-0000-000000000002'),
    'course', jsonb_build_object('id', '99999999-0000-0000-0000-000000000003'),
    'record', jsonb_build_object('status', 'done', 'progress', 100, 'issuedDate', (public.vn_today() - 3)::text)));
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000a');
select lives_ok($$select public.commit_import('c6b00000-0000-0000-0000-0000000000a2')$$, 'admin: commit_import commits a Completed row');
select pg_temp.logout();
select is((select approval::text from public.training_records
  where member_id = 'aaaaaaaa-0000-0000-0000-000000000002' and certificate_id = '99999999-0000-0000-0000-000000000003'),
  'approved', 'an imported Completed row is Approved');

-- ===== Constraints (A-6): bypass the trigger to hit the CHECKs directly =====
set session_replication_role = replica;
select throws_ok($$insert into public.training_records (member_id, certificate_id, status, progress, issued_date)
  values ('aaaaaaaa-0000-0000-0000-000000000002', '99999999-0000-0000-0000-000000000001', 'done', 100, public.vn_today())$$,
  '23514', null, 'CHECK: a Completed row needs an approval');
select throws_ok($$insert into public.training_records (member_id, certificate_id, status, progress, approval)
  values ('aaaaaaaa-0000-0000-0000-000000000002', '99999999-0000-0000-0000-000000000001', 'in_progress', 10, 'waiting')$$,
  '23514', null, 'CHECK: a not-completed row has no approval');
select throws_ok($$insert into public.training_records (member_id, certificate_id, status, progress, issued_date, approval, approval_note)
  values ('aaaaaaaa-0000-0000-0000-000000000002', '99999999-0000-0000-0000-000000000001', 'done', 100, public.vn_today(), 'approved', 'stray')$$,
  '23514', null, 'CHECK: only a returned item carries a note');
set session_replication_role = origin;

select is((select reloptions::text from pg_class where relname = 'v_training_records'), '{security_invoker=true}',
  'the view stays security_invoker');
select is((select string_agg(attname, ',' order by attnum) from pg_attribute
  where attrelid = 'public.v_training_records'::regclass and attnum > 0 and attname in ('est_hours', 'approval', 'approval_note')),
  'est_hours,approval,approval_note', 'approval columns are appended after the existing ones');

select * from finish();
rollback;
