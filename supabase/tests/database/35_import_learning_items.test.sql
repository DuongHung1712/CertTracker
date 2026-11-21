begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

create function pg_temp.login_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

insert into auth.users (id, email) values ('35000000-0000-0000-0000-00000000000a', 'il-admin@test.local');
update public.profiles set role = 'admin' where user_id = '35000000-0000-0000-0000-00000000000a';
insert into public.members (id, full_name, email) values ('35000000-0000-0000-0000-000000000001', 'IL Member', 'il-member@test.local');
insert into public.providers (id, name) values ('35000000-0000-0000-0000-0000000000d1', 'IL Provider');
insert into public.certificates (id, name, kind, provider_id)
  values ('35000000-0000-0000-0000-0000000000e1', 'IL Exam', 'exam', '35000000-0000-0000-0000-0000000000d1');
insert into public.courses (id, name, provider_id)
  values ('35000000-0000-0000-0000-0000000000c1', 'IL Course', '35000000-0000-0000-0000-0000000000d1');

create function pg_temp.import_one(batch uuid, payload jsonb) returns jsonb language plpgsql as $$
begin
  insert into public.import_batches (id, file_name, expected_rows) values (batch, 'learning.xlsx', 1);
  insert into public.import_rows (batch_id, row_no, raw, action, normalized) values (batch, 2, '{}', 'create', payload);
  perform pg_temp.login_as('35000000-0000-0000-0000-00000000000a');
  return public.commit_import(batch);
end;
$$;

-- A course-only learning row (no certificate).
create function pg_temp.course_row(progress int) returns jsonb language sql as $$
  select jsonb_build_object(
    'kind', 'learning',
    'member', jsonb_build_object('id', '35000000-0000-0000-0000-000000000001'),
    'course', null,
    'courseStudied', jsonb_build_object('id', '35000000-0000-0000-0000-0000000000c1'),
    'record', jsonb_build_object('status', 'in_progress', 'progress', progress, 'plannedExamDate', '2027-03-01'));
$$;

select lives_ok($$select pg_temp.import_one('35b00000-0000-0000-0000-000000000001', pg_temp.course_row(20))$$,
  'a course-only learning row commits');
reset role;
select results_eq(
  $$select course_id, target_certificate_id, progress, planned_date from public.learning_items
    where member_id = '35000000-0000-0000-0000-000000000001'$$,
  $$values ('35000000-0000-0000-0000-0000000000c1'::uuid, null::uuid, 20, '2027-03-01'::date)$$,
  'it becomes one learning item on the course');

select lives_ok($$select pg_temp.import_one('35b00000-0000-0000-0000-000000000002', pg_temp.course_row(60))$$,
  'the same row imported again commits');
reset role;
select results_eq(
  $$select count(*)::int, max(progress) from public.learning_items where member_id = '35000000-0000-0000-0000-000000000001'$$,
  $$values (1, 60)$$,
  'reimport updates the open learning item instead of adding one');

-- An exam-target learning row (existing certificate by id).
select lives_ok($$select pg_temp.import_one('35b00000-0000-0000-0000-000000000003', jsonb_build_object(
    'kind', 'learning',
    'member', jsonb_build_object('id', '35000000-0000-0000-0000-000000000001'),
    'course', jsonb_build_object('id', '35000000-0000-0000-0000-0000000000e1'),
    'record', jsonb_build_object('status', 'not_started', 'progress', 0)))$$,
  'an exam-target learning row commits');
reset role;
select is(
  (select count(*)::int from public.learning_items
    where member_id = '35000000-0000-0000-0000-000000000001' and target_certificate_id = '35000000-0000-0000-0000-0000000000e1'
      and course_id is null),
  1, 'it becomes a self-study item for that exam, and no certificate record is written');

select * from finish();
rollback;
