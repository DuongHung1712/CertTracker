begin;
create extension if not exists pgtap with schema extensions;
select plan(40);

create function pg_temp.login_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

insert into auth.users (id, email) values
  ('c9000000-0000-0000-0000-00000000000a', 'cc-admin@test.local'),
  ('c9000000-0000-0000-0000-00000000000b', 'cc-manager@test.local'),
  ('c9000000-0000-0000-0000-00000000000c', 'cc-member@test.local');
update public.profiles set role = 'admin' where user_id = 'c9000000-0000-0000-0000-00000000000a';
update public.profiles set role = 'manager' where user_id = 'c9000000-0000-0000-0000-00000000000b';
insert into public.members (id, full_name, email) values
  ('c9000000-0000-0000-0000-000000000001', 'CC Member One', 'cc-one@test.local'),
  ('c9000000-0000-0000-0000-000000000002', 'CC Member Two', 'cc-two@test.local');
insert into public.providers (id, name) values ('c9000000-0000-0000-0000-0000000000d1', 'CC Provider');
insert into public.cert_types (id, name) values ('c9000000-0000-0000-0000-0000000000f1', 'CC Type');

-- exam certificates: E1 has validity and a preparing course, E2 has no validity
insert into public.certificates (id, name, kind, provider_id, cert_type_id, validity_months) values
  ('c9000000-0000-0000-0000-0000000000e1', 'CC Exam One', 'exam', 'c9000000-0000-0000-0000-0000000000d1', 'c9000000-0000-0000-0000-0000000000f1', 12),
  ('c9000000-0000-0000-0000-0000000000e2', 'CC Exam Two', 'exam', 'c9000000-0000-0000-0000-0000000000d1', null, null);
insert into public.courses (id, name, provider_id, cost, cost_currency, est_hours, prepares_for_id) values
  ('c9000000-0000-0000-0000-0000000000c1', 'CC Prep One', 'c9000000-0000-0000-0000-0000000000d1', 15, 'USD', 27, 'c9000000-0000-0000-0000-0000000000e1'),
  ('c9000000-0000-0000-0000-0000000000c2', 'CC Unrelated', 'c9000000-0000-0000-0000-0000000000d1', null, null, null, null),
  ('c9000000-0000-0000-0000-0000000000c3', 'CC Granting', 'c9000000-0000-0000-0000-0000000000d1', null, null, null, null);
insert into public.certificates (id, name, kind, provider_id, course_id) values
  ('c9000000-0000-0000-0000-0000000000e3', 'CC Completion', 'completion', 'c9000000-0000-0000-0000-0000000000d1', 'c9000000-0000-0000-0000-0000000000c3');

-- Review focus 1: a null provider and null type are allowed
select lives_ok(
  $$insert into public.certificates (name, kind) values ('CC Bare', 'exam')$$,
  'a certificate with no provider and no type is accepted');

-- Migrated seed rows (same ids as the old courses), Review focus 2 and 7
select is((select kind::text from public.certificates where id = '5eed0000-0000-0000-0000-00000000e001'), 'exam',
  'seed: the old AWS course is an exam certificate with the same id');
select is((select validity_months from public.certificates where id = '5eed0000-0000-0000-0000-00000000e001'), 36,
  'seed: the certificate carries the validity');
select ok((select bool_and(prepares_for_id = id) from public.courses where id in
  ('5eed0000-0000-0000-0000-00000000e001', '5eed0000-0000-0000-0000-00000000e002')),
  'seed: kept courses prepare for the certificate with their own id');
select ok((select bool_and(certificate_id = course_id) from public.training_records
  where member_id in ('5eed0000-0000-0000-0000-00000000b001', '5eed0000-0000-0000-0000-00000000b002', '5eed0000-0000-0000-0000-00000000b003')),
  'seed: every record points at the certificate that had its old course id');
select is(
  (select expiry_date from public.v_training_records where member_id = '5eed0000-0000-0000-0000-00000000b001'),
  (select (issued_date + interval '36 months')::date from public.training_records where member_id = '5eed0000-0000-0000-0000-00000000b001'),
  'seed: An-AWS keeps issued date + 36 months');
select is(
  (select expiry_status from public.v_training_records where member_id = '5eed0000-0000-0000-0000-00000000b001'),
  (select public.expiry_status(issued_date, 36, public.vn_today()) from public.training_records where member_id = '5eed0000-0000-0000-0000-00000000b001'),
  'seed: An-AWS keeps its expiry status');

-- Constraints on certificates and prepares_for
select throws_ok(
  $$insert into public.certificates (name, kind) values ('CC Bad Completion', 'completion')$$,
  '23514', null, 'a completion without a course is refused');
select throws_ok(
  $$insert into public.certificates (name, kind, course_id) values ('CC Bad Exam', 'exam', 'c9000000-0000-0000-0000-0000000000c2')$$,
  '23514', null, 'an exam with a course is refused');
select throws_ok(
  $$insert into public.certificates (name, kind, course_id) values ('CC Second', 'completion', 'c9000000-0000-0000-0000-0000000000c3')$$,
  '23505', null, 'a course grants at most one completion');
select throws_ok(
  $$insert into public.courses (name, prepares_for_id) values ('CC Prep Completion', 'c9000000-0000-0000-0000-0000000000e3')$$,
  '23514', 'prepares_for must be an exam certificate', 'a new course cannot prepare for a completion');
select throws_ok(
  $$update public.courses set prepares_for_id = 'c9000000-0000-0000-0000-0000000000e3' where id = 'c9000000-0000-0000-0000-0000000000c2'$$,
  '23514', 'prepares_for must be an exam certificate', 'a course cannot be changed to prepare for a completion');

-- Record trigger
insert into public.training_records (id, member_id, certificate_id, course_id, status, progress) values
  ('c9000000-0000-0000-0000-0000000000a1', 'c9000000-0000-0000-0000-000000000001', 'c9000000-0000-0000-0000-0000000000e1', 'c9000000-0000-0000-0000-0000000000c1', 'not_started', 0);
select is((select course_id from public.training_records where id = 'c9000000-0000-0000-0000-0000000000a1'),
  'c9000000-0000-0000-0000-0000000000c1'::uuid, 'an exam record keeps a course that prepares for it');

-- Review focus 6: after "Prepares for" changes, status and progress stay editable; a new course is validated
update public.courses set prepares_for_id = null where id = 'c9000000-0000-0000-0000-0000000000c1';
select lives_ok(
  $$update public.training_records set status = 'in_progress', progress = 10 where id = 'c9000000-0000-0000-0000-0000000000a1'$$,
  'status and progress change although the course no longer prepares for the certificate');
select lives_ok(
  $$update public.training_records set course_id = 'c9000000-0000-0000-0000-0000000000c1' where id = 'c9000000-0000-0000-0000-0000000000a1'$$,
  'setting the same course again is not re-validated');
select throws_ok(
  $$update public.training_records set course_id = 'c9000000-0000-0000-0000-0000000000c2' where id = 'c9000000-0000-0000-0000-0000000000a1'$$,
  '23514', 'course does not prepare for this certificate', 'changing to a non-preparing course is refused');
update public.courses set prepares_for_id = 'c9000000-0000-0000-0000-0000000000e1' where id = 'c9000000-0000-0000-0000-0000000000c1';

-- Review focus 3: a completion record saved with no course gets the granting course
insert into public.training_records (id, member_id, certificate_id, status, progress) values
  ('c9000000-0000-0000-0000-0000000000a2', 'c9000000-0000-0000-0000-000000000002', 'c9000000-0000-0000-0000-0000000000e3', 'not_started', 0);
select is((select course_id from public.training_records where id = 'c9000000-0000-0000-0000-0000000000a2'),
  'c9000000-0000-0000-0000-0000000000c3'::uuid, 'a completion record gets the granting course');
select throws_ok(
  $$insert into public.training_records (member_id, certificate_id, course_id) values ('c9000000-0000-0000-0000-000000000002', 'c9000000-0000-0000-0000-0000000000e2', 'c9000000-0000-0000-0000-0000000000c2')$$,
  '23514', 'course does not prepare for this certificate', 'an exam record with a non-preparing course is refused');
select throws_ok(
  $$insert into public.training_records (member_id, certificate_id) values ('c9000000-0000-0000-0000-000000000001', 'c9000000-0000-0000-0000-0000000000e1')$$,
  '23505', null, 'one record per member and certificate');

-- Review focus 5: deleting courses
select throws_ok(
  $$delete from public.courses where id = 'c9000000-0000-0000-0000-0000000000c3'$$,
  '23503', null, 'a course that grants a completion cannot be deleted');
delete from public.courses where id = 'c9000000-0000-0000-0000-0000000000c1';
select is((select course_id from public.training_records where id = 'c9000000-0000-0000-0000-0000000000a1'), null::uuid,
  'deleting a course studied clears it on the record');
select is((select count(*) from public.training_records where id = 'c9000000-0000-0000-0000-0000000000a1'), 1::bigint,
  'the record is kept');
select throws_ok(
  $$delete from public.certificates where id = 'c9000000-0000-0000-0000-0000000000e1'$$,
  '23503', null, 'a certificate with records cannot be deleted');

-- View, dashboard, data quality (as the owner of the objects)
insert into public.training_records (id, member_id, certificate_id, status, progress) values
  ('c9000000-0000-0000-0000-0000000000a3', 'c9000000-0000-0000-0000-000000000002', 'c9000000-0000-0000-0000-0000000000e2', 'not_started', 0);
select results_eq(
  $$select certificate_name, certificate_kind::text, course_name from public.v_training_records where id = 'c9000000-0000-0000-0000-0000000000a2'$$,
  $$values ('CC Completion'::text, 'completion'::text, 'CC Granting'::text)$$,
  'v_training_records shows the certificate, its kind and the course studied');
select ok(
  (select reloptions @> array['security_invoker=true'] from pg_class where oid = 'public.v_training_records'::regclass),
  'v_training_records keeps security_invoker');

-- RLS, admin
select pg_temp.login_as('c9000000-0000-0000-0000-00000000000a');
select lives_ok(
  $$insert into public.certificates (name, kind) values ('CC By Admin', 'exam')$$, 'admin inserts a certificate');
select lives_ok(
  $$update public.certificates set level = 'Pro' where id = 'c9000000-0000-0000-0000-0000000000e1'$$, 'admin updates a certificate');
select ok((select count(*) from public.dashboard_breakdown('certificate')) > 0, 'dashboard_breakdown(certificate) returns rows');
select throws_ok($$select * from public.dashboard_breakdown('course')$$, '22023', null,
  'dashboard_breakdown(course) is refused');
select is((select count(*) from public.v_data_quality_issues where issue_type = 'certificate_no_validity' and subject_id = 'c9000000-0000-0000-0000-0000000000e2'),
  1::bigint, 'an exam without validity is flagged');
select is((select count(*) from public.v_data_quality_issues where issue_type = 'certificate_no_validity' and subject_id = 'c9000000-0000-0000-0000-0000000000e3'),
  0::bigint, 'a completion without validity is not flagged');

-- RLS, manager
select pg_temp.login_as('c9000000-0000-0000-0000-00000000000b');
select ok((select count(*) from public.certificates) > 0, 'manager reads certificates');
select throws_ok(
  $$insert into public.certificates (name, kind) values ('CC By Manager', 'exam')$$, '42501', null, 'manager cannot insert a certificate');
select results_eq(
  $$with u as (update public.certificates set level = 'Hacked' where id = 'c9000000-0000-0000-0000-0000000000e1' returning 1) select count(*)::int from u$$,
  $$values (0)$$, 'manager: updating a certificate affects 0 rows');

select results_eq(
  $$with d as (delete from public.certificates where id = 'c9000000-0000-0000-0000-0000000000e2' returning 1) select count(*)::int from d$$,
  $$values (0)$$, 'manager: deleting a certificate affects 0 rows');

-- RLS, member
select pg_temp.login_as('c9000000-0000-0000-0000-00000000000c');
select ok((select count(*) from public.certificates) > 0, 'member reads certificates');
select throws_ok(
  $$insert into public.certificates (name, kind) values ('CC By Member', 'exam')$$, '42501', null, 'member cannot insert a certificate');
select results_eq(
  $$with u as (update public.certificates set level = 'Hacked' where id = 'c9000000-0000-0000-0000-0000000000e1' returning 1) select count(*)::int from u$$,
  $$values (0)$$, 'member: updating a certificate affects 0 rows');
select results_eq(
  $$with d as (delete from public.certificates where id = 'c9000000-0000-0000-0000-0000000000e2' returning 1) select count(*)::int from d$$,
  $$values (0)$$, 'member: deleting a certificate affects 0 rows');

reset role;
select is((select level from public.certificates where id = 'c9000000-0000-0000-0000-0000000000e1'), 'Pro',
  'the refused updates left the admin value in place');

select * from finish();
rollback;
