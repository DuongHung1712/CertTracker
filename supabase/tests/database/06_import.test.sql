begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

create function pg_temp.login_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

insert into public.dcs (id, name) values ('00000000-0000-0000-0000-0000000000d1', 'Test DC');
insert into public.programs (id, name, dc_id)
  values ('00000000-0000-0000-0000-0000000000f1', 'Program 1', '00000000-0000-0000-0000-0000000000d1');
insert into public.teams (id, name, program_id) values
  ('11111111-1111-1111-1111-111111111111', 'Team A', '00000000-0000-0000-0000-0000000000f1');
insert into public.members (id, full_name, email, team_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Member A', 'a@test.local', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Member B', 'b@test.local', '11111111-1111-1111-1111-111111111111');
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'admin@test.local'),
  ('a0000000-0000-0000-0000-00000000000b', 'manager@test.local'),
  ('a0000000-0000-0000-0000-00000000000c', 'a@test.local');
update public.profiles set role = 'admin' where user_id = 'a0000000-0000-0000-0000-00000000000a';
update public.profiles set role = 'manager' where user_id = 'a0000000-0000-0000-0000-00000000000b';
insert into public.team_managers (team_id, user_id)
  values ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-00000000000b');
insert into public.providers (id, name) values ('dddddddd-0000-0000-0000-000000000001', 'Prov One');
insert into public.courses (id, name, provider_id, validity_months)
  values ('cccccccc-0000-0000-0000-000000000001', 'Course One', 'dddddddd-0000-0000-0000-000000000001', 12);
insert into public.training_records (member_id, course_id, status, progress, planned_exam_date, notes)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
          'in_progress', 40, '2026-12-01', 'keep me');

-- Batch 1: update, two creates sharing one new course, one skipped error row
insert into public.import_batches (id, file_name, expected_rows) values ('b1000000-0000-0000-0000-000000000001', 'legacy.xlsx', 4);
insert into public.import_rows (batch_id, row_no, raw, action, normalized, errors) values
  ('b1000000-0000-0000-0000-000000000001', 2, '{}', 'update',
   '{"member":{"id":"aaaaaaaa-0000-0000-0000-000000000001"},"course":{"id":"cccccccc-0000-0000-0000-000000000001"},
     "record":{"status":"in_progress","progress":60,"plannedExamDate":null,"issuedDate":null,"certificateUrl":null,
               "viaCompany":null,"refundStatus":null,"notes":null}}', '[]'),
  ('b1000000-0000-0000-0000-000000000001', 3, '{}', 'create',
   '{"member":{"email":"new@test.local","fullName":"New Person","teamId":"11111111-1111-1111-1111-111111111111"},
     "course":{"name":"Course Two","provider":{"name":"Prov Two"},"certType":{"name":"Type Two"},"validityMonths":24},
     "record":{"status":"done","progress":100,"plannedExamDate":null,"issuedDate":"2025-01-15","certificateUrl":null,
               "viaCompany":null,"refundStatus":null,"notes":null}}', '[]'),
  ('b1000000-0000-0000-0000-000000000001', 4, '{}', 'create',
   '{"member":{"id":"bbbbbbbb-0000-0000-0000-000000000002"},
     "course":{"name":"Course Two","provider":{"name":"Prov Two"},"certType":{"name":"Type Two"},"validityMonths":24},
     "record":{"status":"in_progress","progress":10,"plannedExamDate":null,"issuedDate":null,"certificateUrl":null,
               "viaCompany":null,"refundStatus":null,"notes":null}}', '[]'),
  ('b1000000-0000-0000-0000-000000000001', 5, '{}', 'skip', null, '["Không nhận ra trạng thái"]');

-- Batch 2: discarded
insert into public.import_batches (id, file_name, status, expected_rows) values ('b2000000-0000-0000-0000-000000000002', 'old.xlsx', 'discarded', 0);

-- Batch 3: second row violates a CHECK -> nothing from row 1 may persist
insert into public.import_batches (id, file_name, expected_rows) values ('b3000000-0000-0000-0000-000000000003', 'bad.xlsx', 2);
insert into public.import_rows (batch_id, row_no, raw, action, normalized) values
  ('b3000000-0000-0000-0000-000000000003', 2, '{}', 'create',
   '{"member":{"id":"bbbbbbbb-0000-0000-0000-000000000002"},"course":{"id":"cccccccc-0000-0000-0000-000000000001"},
     "record":{"status":"not_started","progress":0,"plannedExamDate":null,"issuedDate":null,"certificateUrl":null,
               "viaCompany":null,"refundStatus":null,"notes":null}}'),
  ('b3000000-0000-0000-0000-000000000003', 3, '{}', 'create',
   '{"member":{"id":"aaaaaaaa-0000-0000-0000-000000000001"},
     "course":{"name":"Course Three","provider":{"id":"dddddddd-0000-0000-0000-000000000001"},"certType":null,"validityMonths":null},
     "record":{"status":"done","progress":100,"plannedExamDate":null,"issuedDate":null,"certificateUrl":null,
               "viaCompany":null,"refundStatus":null,"notes":null}}');

-- Batch 4: "new" member whose email now exists (created after the preview)
insert into public.import_batches (id, file_name, expected_rows) values ('b4000000-0000-0000-0000-000000000004', 'stale.xlsx', 1);
insert into public.import_rows (batch_id, row_no, raw, action, normalized) values
  ('b4000000-0000-0000-0000-000000000004', 2, '{}', 'create',
   '{"member":{"email":"B@TEST.LOCAL","fullName":"Someone Else","teamId":null},"course":{"id":"cccccccc-0000-0000-0000-000000000001"},
     "record":{"status":"not_started","progress":0,"plannedExamDate":null,"issuedDate":null,"certificateUrl":null,
               "viaCompany":null,"refundStatus":null,"notes":null}}');

-- Batch 5: the upload died after one of three rows. Batch 6: more rows stored than expected.
insert into public.import_batches (id, file_name, expected_rows) values
  ('b5000000-0000-0000-0000-000000000005', 'partial.xlsx', 3),
  ('b6000000-0000-0000-0000-000000000006', 'extra.xlsx', 0);
insert into public.import_rows (batch_id, row_no, raw, action, normalized) values
  ('b5000000-0000-0000-0000-000000000005', 2, '{}', 'create',
   '{"member":{"email":"partial@test.local","fullName":"Partial Person","teamId":null},"course":{"id":"cccccccc-0000-0000-0000-000000000001"},
     "record":{"status":"not_started","progress":0,"plannedExamDate":null,"issuedDate":null,"certificateUrl":null,
               "viaCompany":null,"refundStatus":null,"notes":null}}');
insert into public.import_rows (batch_id, row_no, raw, action, normalized, errors)
  values ('b6000000-0000-0000-0000-000000000006', 2, '{}', 'skip', null, '["x"]');

-- Non-admins
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000b');
select is((select count(*) from public.import_batches), 0::bigint, 'manager sees no import batches');
select is((select count(*) from public.import_rows), 0::bigint, 'manager sees no import rows');
select throws_ok($$insert into public.import_batches (file_name, expected_rows) values ('x.xlsx', 0)$$, '42501', null, 'manager cannot create a batch');
select throws_ok($$select public.commit_import('b1000000-0000-0000-0000-000000000001')$$, '42501', null, 'manager cannot commit');
reset role;
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000c');
select throws_ok($$select public.commit_import('b1000000-0000-0000-0000-000000000001')$$, '42501', null, 'member cannot commit');
reset role;

-- Admin commit
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000a');
select is(
  public.commit_import('b1000000-0000-0000-0000-000000000001'),
  '{"created":2,"updated":1,"skipped":1,"newMembers":1,"newCourses":1}'::jsonb,
  'commit returns the summary');
select is((select status::text from public.import_batches where id = 'b1000000-0000-0000-0000-000000000001'), 'committed', 'batch is committed');
select is(
  (select progress from public.training_records
    where member_id = 'aaaaaaaa-0000-0000-0000-000000000001' and course_id = 'cccccccc-0000-0000-0000-000000000001'),
  60, 'update applies the provided progress');
select is(
  (select notes || '|' || planned_exam_date::text from public.training_records
    where member_id = 'aaaaaaaa-0000-0000-0000-000000000001' and course_id = 'cccccccc-0000-0000-0000-000000000001'),
  'keep me|2026-12-01', 'null fields keep the existing values');
select is((select team_id from public.members where email = 'new@test.local'),
  '11111111-1111-1111-1111-111111111111'::uuid, 'new member is created in the resolved team');
select is(
  (select count(*) from public.courses c
     join public.providers p on p.id = c.provider_id
     join public.cert_types t on t.id = c.cert_type_id
    where c.name = 'Course Two' and p.name = 'Prov Two' and t.name = 'Type Two' and c.validity_months = 24),
  1::bigint, 'the new course, provider and cert type are created exactly once');
select is(
  (select r.issued_date from public.training_records r join public.members m on m.id = r.member_id
    where m.email = 'new@test.local'),
  '2025-01-15'::date, 'new member''s record carries the imported issue date');

-- Idempotency
select is(
  public.commit_import('b1000000-0000-0000-0000-000000000001'),
  '{"created":2,"updated":1,"skipped":1,"newMembers":1,"newCourses":1}'::jsonb,
  'a second commit returns the first summary');
select is((select count(*) from public.members where email = 'new@test.local'), 1::bigint, 'a second commit creates nothing');

-- Discarded
select throws_ok($$select public.commit_import('b2000000-0000-0000-0000-000000000002')$$, '55000', null, 'a discarded batch cannot be committed');

-- All-or-nothing
select throws_ok($$select public.commit_import('b3000000-0000-0000-0000-000000000003')$$, '23514', null, 'a CHECK violation aborts the commit');
select is(
  (select count(*) from public.training_records
    where member_id = 'bbbbbbbb-0000-0000-0000-000000000002' and course_id = 'cccccccc-0000-0000-0000-000000000001'),
  0::bigint, 'rows before the failing row are rolled back');
select is((select count(*) from public.courses where name = 'Course Three'), 0::bigint, 'entities created before the failure are rolled back');
select is((select status::text from public.import_batches where id = 'b3000000-0000-0000-0000-000000000003'), 'parsed', 'failed batch stays parsed');

-- Incomplete uploads: refused with their own SQLSTATE (not 55000), and nothing is written
select throws_ok($$select public.commit_import('b5000000-0000-0000-0000-000000000005')$$, '22023', null, 'a batch with fewer rows than expected cannot be committed');
select is((select count(*) from public.members where email = 'partial@test.local'), 0::bigint, 'an incomplete batch writes nothing');
select is((select status::text from public.import_batches where id = 'b5000000-0000-0000-0000-000000000005'), 'parsed', 'an incomplete batch stays parsed');
select throws_ok($$select public.commit_import('b6000000-0000-0000-0000-000000000006')$$, '22023', null, 'a batch with more rows than expected cannot be committed');

-- Stale preview
select is(
  public.commit_import('b4000000-0000-0000-0000-000000000004'),
  '{"created":1,"updated":0,"skipped":0,"newMembers":0,"newCourses":0}'::jsonb,
  'a member created after the preview is reused, not duplicated');
select is(
  (select count(*) from public.training_records
    where member_id = 'bbbbbbbb-0000-0000-0000-000000000002' and course_id = 'cccccccc-0000-0000-0000-000000000001'),
  1::bigint, 'the record lands on the existing member found by case-insensitive email');
reset role;

select * from finish();
rollback;
