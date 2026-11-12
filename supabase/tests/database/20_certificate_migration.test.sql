-- Runs the data part of 20261111000001_certificate_catalogue.sql (copy_courses_to_certificates) on synthetic data
-- in the OLD shape: the transaction puts back the dropped courses columns and a record that has only a course.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

delete from public.training_records;
delete from public.certificates;
delete from public.courses;
alter table public.courses
  add column cert_type_id uuid, add column level text, add column validity_months int;
alter table public.training_records alter column certificate_id drop not null;
-- The record trigger needs "prepares for", which the migration sets as its last step.
alter table public.training_records disable trigger training_records_course_matches_certificate;

insert into public.members (id, full_name, email)
  values ('d2000000-0000-0000-0000-000000000001', 'Migration Member', 'mig-member@test.local');
insert into public.providers (id, name) values ('d2000000-0000-0000-0000-0000000000d1', 'Mig Provider');
insert into public.cert_types (id, name) values ('d2000000-0000-0000-0000-0000000000f1', 'Mig Type');

-- C1 has no provider and no type, only a record; C2 is empty; C3..C6 each carry one kind of course data.
insert into public.courses (id, name, provider_id, cert_type_id, level, validity_months, refundable, cost, cost_currency, est_hours, refund_conditions) values
  ('d2000000-0000-0000-0000-0000000000c1', 'Mig Bare with record', null, null, null, 12, false, null, null, null, null),
  ('d2000000-0000-0000-0000-0000000000c2', 'Mig Empty', 'd2000000-0000-0000-0000-0000000000d1', 'd2000000-0000-0000-0000-0000000000f1', 'Pro', 24, false, null, null, null, null),
  ('d2000000-0000-0000-0000-0000000000c3', 'Mig Costed', 'd2000000-0000-0000-0000-0000000000d1', null, null, null, false, 10, 'USD', null, null),
  ('d2000000-0000-0000-0000-0000000000c4', 'Mig Refundable', 'd2000000-0000-0000-0000-0000000000d1', null, null, 6, true, null, null, null, null),
  ('d2000000-0000-0000-0000-0000000000c5', 'Mig Hours', 'd2000000-0000-0000-0000-0000000000d1', null, null, null, false, null, null, 30, null),
  ('d2000000-0000-0000-0000-0000000000c6', 'Mig Conditions', 'd2000000-0000-0000-0000-0000000000d1', null, null, null, false, null, null, null, 'Pass in 6 months');
insert into public.training_records (id, member_id, course_id, status, progress, issued_date) values
  ('d2000000-0000-0000-0000-0000000000a1', 'd2000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-0000000000c1', 'done', 100, '2026-01-31');

select public.copy_courses_to_certificates();

select is((select count(*) from public.certificates), 6::bigint, 'every old course became a certificate');
select ok((select bool_and(kind = 'exam') from public.certificates), 'all of them are exams');
select results_eq(
  $$select provider_id, cert_type_id, validity_months from public.certificates where id = 'd2000000-0000-0000-0000-0000000000c1'$$,
  $$values (null::uuid, null::uuid, 12)$$,
  'a course with no provider and no type migrates with the same nulls');
select is((select cert_type_id from public.certificates where id = 'd2000000-0000-0000-0000-0000000000c2'),
  'd2000000-0000-0000-0000-0000000000f1'::uuid, 'type, level and validity are copied');
select is((select count(*) from public.courses), 5::bigint, 'courses after = courses before minus the empty one');
select is((select count(*) from public.courses where id = 'd2000000-0000-0000-0000-0000000000c2'), 0::bigint,
  'the empty course is deleted');
select is(
  (select count(*) from public.courses where id in (
    'd2000000-0000-0000-0000-0000000000c1', 'd2000000-0000-0000-0000-0000000000c3', 'd2000000-0000-0000-0000-0000000000c4',
    'd2000000-0000-0000-0000-0000000000c5', 'd2000000-0000-0000-0000-0000000000c6')),
  5::bigint, 'courses with a record, cost, refundable, hours or refund conditions stay');
select ok((select bool_and(prepares_for_id = id) from public.courses), 'each kept course prepares for the certificate with its own id');
select is((select certificate_id from public.training_records where id = 'd2000000-0000-0000-0000-0000000000a1'),
  'd2000000-0000-0000-0000-0000000000c1'::uuid, 'the record points at the certificate with its old course id');
select is((select expiry_date from public.v_training_records where id = 'd2000000-0000-0000-0000-0000000000a1'),
  '2027-01-31'::date, 'the record keeps issued date + validity as its expiry date');

select * from finish();
rollback;
