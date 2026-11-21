begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- Fixtures written as a trusted writer (no JWT), like the migration runs.
insert into public.dcs (id, name) values ('00000000-0000-0000-0000-0000000032d1', 'MV DC') on conflict do nothing;
insert into public.programs (id, name, dc_id)
  values ('00000000-0000-0000-0000-0000000032f1', 'MV Program', '00000000-0000-0000-0000-0000000032d1') on conflict do nothing;
insert into public.teams (id, name, program_id)
  values ('32323232-0000-0000-0000-00000000000a', 'MV Team', '00000000-0000-0000-0000-0000000032f1') on conflict do nothing;
insert into public.members (id, full_name, email, team_id, is_active)
  values ('32000000-0000-0000-0000-000000000001', 'MV Member', 'mv1@test.local', '32323232-0000-0000-0000-00000000000a', true)
  on conflict do nothing;
insert into public.providers (id, name) values ('00000000-0000-0000-0000-000000003201', 'MV Provider') on conflict do nothing;
insert into public.certificates (id, name, kind, provider_id) values
  ('32e00000-0000-0000-0000-000000000001', 'MV Exam A', 'exam', '00000000-0000-0000-0000-000000003201'),
  ('32e00000-0000-0000-0000-000000000002', 'MV Exam B', 'exam', '00000000-0000-0000-0000-000000003201') on conflict do nothing;
insert into public.courses (id, name, provider_id, prepares_for_id) values
  ('32c00000-0000-0000-0000-000000000001', 'MV Prep Course', '00000000-0000-0000-0000-000000003201', '32e00000-0000-0000-0000-000000000001'),
  ('32c00000-0000-0000-0000-000000000002', 'MV Granting Course', '00000000-0000-0000-0000-000000003201', null) on conflict do nothing;
insert into public.certificates (id, name, kind, provider_id, course_id) values
  ('32e00000-0000-0000-0000-000000000003', 'MV Completion', 'completion', '00000000-0000-0000-0000-000000003201',
   '32c00000-0000-0000-0000-000000000002') on conflict do nothing;

insert into public.training_records (id, member_id, certificate_id, course_id, status, progress, planned_exam_date) values
  ('32f00000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '32e00000-0000-0000-0000-000000000001',
   '32c00000-0000-0000-0000-000000000001', 'in_progress', 40, '2026-12-15'),
  ('32f00000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000001', '32e00000-0000-0000-0000-000000000002',
   null, 'not_started', 0, null),
  ('32f00000-0000-0000-0000-000000000003', '32000000-0000-0000-0000-000000000001', '32e00000-0000-0000-0000-000000000003',
   null, 'in_progress', 30, null);
-- A proposed completion certificate with no course yet: nothing to attach a learning item to.
insert into public.certificates (id, name, kind, provider_id, catalogue_status) values
  ('32e00000-0000-0000-0000-000000000004', 'MV Pending Completion', 'completion', '00000000-0000-0000-0000-000000003201', 'pending')
  on conflict do nothing;
insert into public.training_records (id, member_id, certificate_id, status, progress) values
  ('32f00000-0000-0000-0000-000000000005', '32000000-0000-0000-0000-000000000001', '32e00000-0000-0000-0000-000000000004',
   'in_progress', 10);
update public.training_records set via_company = true, refund_status = 'pending', evidence_path = 'mv/evidence.pdf'
  where id = '32f00000-0000-0000-0000-000000000002';
insert into public.training_records (id, member_id, certificate_id, status, progress, issued_date) values
  ('32f00000-0000-0000-0000-000000000004', '32000000-0000-0000-0000-000000000001', '32e00000-0000-0000-0000-000000000002',
   'done', 100, '2026-01-10');

-- Only this member's rows count: other local data may also have open records.
create temp table moved as
  select public.move_open_records_to_learning() as n;

select ok((select n from moved) >= 3, 'moves the open records');
select is(
  (select row(target_certificate_id, course_id, progress, planned_date)::text from public.learning_items
    where member_id = '32000000-0000-0000-0000-000000000001' and target_certificate_id = '32e00000-0000-0000-0000-000000000001'),
  row('32e00000-0000-0000-0000-000000000001'::uuid, '32c00000-0000-0000-0000-000000000001'::uuid, 40, '2026-12-15'::date)::text,
  'exam in progress keeps target, course, progress and planned date');
select is(
  (select course_id from public.learning_items
    where member_id = '32000000-0000-0000-0000-000000000001' and target_certificate_id = '32e00000-0000-0000-0000-000000000002'),
  null::uuid, 'exam not started becomes self-study for that exam');
select is(
  (select row(target_certificate_id, progress)::text from public.learning_items
    where member_id = '32000000-0000-0000-0000-000000000001' and course_id = '32c00000-0000-0000-0000-000000000002'),
  row(null::uuid, 30)::text, 'completion in progress becomes an item on its granting course');
select is(
  (select count(*)::int from public.training_records where id in (
    '32f00000-0000-0000-0000-000000000001', '32f00000-0000-0000-0000-000000000002', '32f00000-0000-0000-0000-000000000003')),
  0, 'moved records are gone from training_records');
select is(
  (select approval::text from public.training_records where id = '32f00000-0000-0000-0000-000000000004'),
  'approved', 'done records stay as certificates');
select is(
  (select status::text from public.training_records where id = '32f00000-0000-0000-0000-000000000005'),
  'in_progress', 'an open record with neither a course nor an exam stays in training_records');
select ok(
  (select notes like '%paid by company%' and notes like '%refund pending%' and notes like '%evidence file mv/evidence.pdf%'
    from public.learning_items where id = '32f00000-0000-0000-0000-000000000002'),
  'company payment, refund and evidence path move into the notes');
select is(
  (select notes from public.learning_items where id = '32f00000-0000-0000-0000-000000000001'),
  null, 'a record with nothing extra gets no notes');
select is(public.move_open_records_to_learning(), 0, 'running it again moves nothing');
select is(
  (select count(*)::int from public.learning_items where member_id = '32000000-0000-0000-0000-000000000001'),
  3, 'no duplicate items');

select * from finish();
rollback;
