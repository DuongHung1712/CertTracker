begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into public.dcs (id, name) values ('00000000-0000-0000-0000-0000000036d1', 'CL DC') on conflict do nothing;
insert into public.programs (id, name, dc_id)
  values ('00000000-0000-0000-0000-0000000036f1', 'CL Program', '00000000-0000-0000-0000-0000000036d1') on conflict do nothing;
insert into public.teams (id, name, program_id)
  values ('36363636-0000-0000-0000-00000000000a', 'CL Team', '00000000-0000-0000-0000-0000000036f1') on conflict do nothing;
insert into public.members (id, full_name, email, team_id, is_active) values
  ('36000000-0000-0000-0000-000000000001', 'CL Member', 'cl1@test.local', '36363636-0000-0000-0000-00000000000a', true),
  ('36000000-0000-0000-0000-000000000002', 'CL Other', 'cl2@test.local', '36363636-0000-0000-0000-00000000000a', true)
  on conflict do nothing;
insert into public.providers (id, name) values ('00000000-0000-0000-0000-000000003601', 'CL Provider') on conflict do nothing;
insert into public.courses (id, name, provider_id)
  values ('36c00000-0000-0000-0000-000000000001', 'CL Course', '00000000-0000-0000-0000-000000003601') on conflict do nothing;
insert into public.certificates (id, name, kind, provider_id) values
  ('36e00000-0000-0000-0000-000000000001', 'CL Exam', 'exam', '00000000-0000-0000-0000-000000003601') on conflict do nothing;
insert into public.certificates (id, name, kind, provider_id, course_id) values
  ('36e00000-0000-0000-0000-000000000002', 'CL Completion', 'completion', '00000000-0000-0000-0000-000000003601',
   '36c00000-0000-0000-0000-000000000001') on conflict do nothing;

insert into public.learning_items (id, member_id, target_certificate_id, status, progress, planned_date) values
  ('36b00000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000001', '36e00000-0000-0000-0000-000000000001', 'in_progress', 60, public.vn_today() + 5),
  ('36b00000-0000-0000-0000-000000000003', '36000000-0000-0000-0000-000000000002', '36e00000-0000-0000-0000-000000000001', 'in_progress', 20, null);
insert into public.learning_items (id, member_id, course_id, status, progress) values
  ('36b00000-0000-0000-0000-000000000002', '36000000-0000-0000-0000-000000000001', '36c00000-0000-0000-0000-000000000001', 'in_progress', 80);

-- The member records the exam certificate (any path: Add certificate, renewal, import).
insert into public.training_records (member_id, certificate_id, status, progress, issued_date)
  values ('36000000-0000-0000-0000-000000000001', '36e00000-0000-0000-0000-000000000001', 'done', 100, public.vn_today() - 1);
select results_eq(
  $$select status::text, progress, finished_date from public.learning_items where id = '36b00000-0000-0000-0000-000000000001'$$,
  $$values ('done', 100, public.vn_today() - 1)$$,
  'a new exam certificate closes the open item that aims for that exam, finished on the issue date');
select is((select status::text from public.learning_items where id = '36b00000-0000-0000-0000-000000000003'), 'in_progress',
  'another member''s item for the same exam stays open');

-- The course certificate closes the open item on its granting course.
insert into public.training_records (member_id, certificate_id, status, progress, issued_date)
  values ('36000000-0000-0000-0000-000000000001', '36e00000-0000-0000-0000-000000000002', 'done', 100, public.vn_today() - 1);
select is((select status::text from public.learning_items where id = '36b00000-0000-0000-0000-000000000002'), 'done',
  'a course certificate closes the open item on its course');
select is((select count(*)::int from public.learning_items where member_id = '36000000-0000-0000-0000-000000000001' and status <> 'done'), 0,
  'no planned exam lingers for the member');

select * from finish();
rollback;
