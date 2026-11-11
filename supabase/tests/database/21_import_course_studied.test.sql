begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

create function pg_temp.login_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

-- Row JSON: an existing certificate (by id), optionally naming the course studied.
create function pg_temp.row_json(cert uuid, studied uuid, status text, progress int) returns jsonb language sql as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'member', jsonb_build_object('id', 'c6000000-0000-0000-0000-000000000001'),
    'course', jsonb_build_object('id', cert),
    'courseStudied', case when studied is null then null else jsonb_build_object('id', studied) end,
    'record', jsonb_build_object('status', status, 'progress', progress)
  ));
$$;

insert into auth.users (id, email) values ('c6000000-0000-0000-0000-00000000000a', 'studied-admin@test.local');
insert into auth.users (id, email) values
  ('c6000000-0000-0000-0000-00000000000b', 'studied-manager@test.local'),
  ('c6000000-0000-0000-0000-00000000000c', 'studied-viewer@test.local');
update public.profiles set role = 'admin' where user_id = 'c6000000-0000-0000-0000-00000000000a';
update public.profiles set role = 'manager' where user_id = 'c6000000-0000-0000-0000-00000000000b';
insert into public.members (id, full_name, email) values ('c6000000-0000-0000-0000-000000000001', 'Studied Member', 'studied-member@test.local');
insert into public.providers (id, name) values ('c6000000-0000-0000-0000-0000000000d1', 'Studied Provider');
insert into public.certificates (id, name, kind, provider_id) values
  ('c6000000-0000-0000-0000-0000000000e1', 'Exam One', 'exam', 'c6000000-0000-0000-0000-0000000000d1'),
  ('c6000000-0000-0000-0000-0000000000e2', 'Exam Two', 'exam', 'c6000000-0000-0000-0000-0000000000d1'),
  ('c6000000-0000-0000-0000-0000000000e3', 'Exam Three', 'exam', 'c6000000-0000-0000-0000-0000000000d1');
insert into public.courses (id, name, provider_id, prepares_for_id) values
  ('c6000000-0000-0000-0000-0000000000c1', 'Course One', 'c6000000-0000-0000-0000-0000000000d1', 'c6000000-0000-0000-0000-0000000000e1'),
  ('c6000000-0000-0000-0000-0000000000c2', 'Course One B', 'c6000000-0000-0000-0000-0000000000d1', 'c6000000-0000-0000-0000-0000000000e1'),
  ('c6000000-0000-0000-0000-0000000000c3', 'Course Three', 'c6000000-0000-0000-0000-0000000000d1', 'c6000000-0000-0000-0000-0000000000e3');

create function pg_temp.import_one(batch uuid, payload jsonb) returns jsonb language plpgsql as $$
begin
  insert into public.import_batches (id, file_name, expected_rows) values (batch, 'studied.xlsx', 1);
  insert into public.import_rows (batch_id, row_no, raw, action, normalized) values (batch, 2, '{}', 'create', payload);
  perform pg_temp.login_as('c6000000-0000-0000-0000-00000000000a');
  return public.commit_import(batch);
end;
$$;

-- 1. A named course is saved on insert.
select lives_ok(
  $$select pg_temp.import_one('c6b00000-0000-0000-0000-000000000001',
      pg_temp.row_json('c6000000-0000-0000-0000-0000000000e1', 'c6000000-0000-0000-0000-0000000000c1', 'not_started', 0))$$,
  'a row naming a course that prepares for the certificate commits');
reset role;
select is((select course_id from public.training_records where certificate_id = 'c6000000-0000-0000-0000-0000000000e1'),
  'c6000000-0000-0000-0000-0000000000c1'::uuid, 'the named course is saved on insert');

-- 2. An unnamed row leaves the course alone on update.
select lives_ok(
  $$select pg_temp.import_one('c6b00000-0000-0000-0000-000000000002',
      pg_temp.row_json('c6000000-0000-0000-0000-0000000000e1', null, 'in_progress', 30))$$,
  'an update without a course studied commits');
reset role;
select results_eq(
  $$select course_id, progress from public.training_records where certificate_id = 'c6000000-0000-0000-0000-0000000000e1'$$,
  $$values ('c6000000-0000-0000-0000-0000000000c1'::uuid, 30)$$,
  'the update changed the progress and kept the course');

-- 3. A named course replaces the old one on update.
select lives_ok(
  $$select pg_temp.import_one('c6b00000-0000-0000-0000-000000000003',
      pg_temp.row_json('c6000000-0000-0000-0000-0000000000e1', 'c6000000-0000-0000-0000-0000000000c2', 'in_progress', 30))$$,
  'an update naming another course commits');
reset role;
select is((select course_id from public.training_records where certificate_id = 'c6000000-0000-0000-0000-0000000000e1'),
  'c6000000-0000-0000-0000-0000000000c2'::uuid, 'the named course is saved on update');

-- 4. A course that does not prepare for the certificate is refused by the record trigger (the plan reports it first).
select throws_ok(
  $$select pg_temp.import_one('c6b00000-0000-0000-0000-000000000004',
      pg_temp.row_json('c6000000-0000-0000-0000-0000000000e2', 'c6000000-0000-0000-0000-0000000000c3', 'not_started', 0))$$,
  '23514', null, 'a course that does not prepare for the certificate is refused');
reset role;

-- 5. Old row shape: no courseStudied, no course on the record.
select lives_ok(
  $$select pg_temp.import_one('c6b00000-0000-0000-0000-000000000005',
      pg_temp.row_json('c6000000-0000-0000-0000-0000000000e3', null, 'not_started', 0))$$,
  'the old row shape commits');
reset role;
select is((select course_id from public.training_records where certificate_id = 'c6000000-0000-0000-0000-0000000000e3'),
  null::uuid, 'the old row shape leaves no course on the record');

-- 6. Only an admin commits, also when the row names a course studied.
insert into public.import_batches (id, file_name, expected_rows) values ('c6b00000-0000-0000-0000-000000000006', 'roles.xlsx', 1);
insert into public.import_rows (batch_id, row_no, raw, action, normalized) values
  ('c6b00000-0000-0000-0000-000000000006', 2, '{}', 'create',
   pg_temp.row_json('c6000000-0000-0000-0000-0000000000e1', 'c6000000-0000-0000-0000-0000000000c2', 'in_progress', 50));
select pg_temp.login_as('c6000000-0000-0000-0000-00000000000b');
select throws_ok($$select public.commit_import('c6b00000-0000-0000-0000-000000000006')$$, '42501', null, 'a manager cannot commit a row naming a course studied');
reset role;
select pg_temp.login_as('c6000000-0000-0000-0000-00000000000c');
select throws_ok($$select public.commit_import('c6b00000-0000-0000-0000-000000000006')$$, '42501', null, 'a member cannot commit a row naming a course studied');
reset role;

-- 7. A new priced certificate plus a crafted courseStudied: the named course wins and the trigger refuses it
-- (nothing prepares for a certificate that does not exist yet; the plan reports it first).
select throws_ok(
  $$select pg_temp.import_one('c6b00000-0000-0000-0000-000000000007', jsonb_build_object(
      'member', jsonb_build_object('id', 'c6000000-0000-0000-0000-000000000001'),
      'course', jsonb_build_object('name', 'Brand New Priced', 'provider', jsonb_build_object('id', 'c6000000-0000-0000-0000-0000000000d1'),
                                   'certType', null, 'validityMonths', null, 'cost', 20, 'costCurrency', 'USD', 'estHours', 5),
      'courseStudied', jsonb_build_object('id', 'c6000000-0000-0000-0000-0000000000c3'),
      'record', jsonb_build_object('status', 'not_started', 'progress', 0)))$$,
  '23514', null, 'a new priced certificate with a crafted course studied is refused by the trigger');
reset role;

-- 8. A malformed id keeps the row prefix of the commit error.
select throws_ok(
  $$select pg_temp.import_one('c6b00000-0000-0000-0000-000000000008', jsonb_build_object(
      'member', jsonb_build_object('id', 'c6000000-0000-0000-0000-000000000001'),
      'course', jsonb_build_object('id', 'c6000000-0000-0000-0000-0000000000e1'),
      'courseStudied', jsonb_build_object('id', 'not-a-uuid'),
      'record', jsonb_build_object('status', 'not_started', 'progress', 0)))$$,
  '22P02', 'import row 2: invalid input syntax for type uuid: "not-a-uuid"', 'a malformed course id is reported with its row number');
reset role;

select * from finish();
rollback;
