begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into public.dcs (id, name) values ('00000000-0000-0000-0000-0000000038d1', 'OE DC') on conflict do nothing;
insert into public.programs (id, name, dc_id)
  values ('00000000-0000-0000-0000-0000000038f1', 'OE Program', '00000000-0000-0000-0000-0000000038d1') on conflict do nothing;
insert into public.teams (id, name, program_id)
  values ('38383838-0000-0000-0000-00000000000a', 'OE Team', '00000000-0000-0000-0000-0000000038f1') on conflict do nothing;
insert into public.members (id, full_name, email, team_id, is_active) values
  ('38000000-0000-0000-0000-000000000001', 'OE Member One', 'oe1@test.local', '38383838-0000-0000-0000-00000000000a', true),
  ('38000000-0000-0000-0000-000000000002', 'OE Member Two', 'oe2@test.local', '38383838-0000-0000-0000-00000000000a', true)
  on conflict do nothing;
insert into public.providers (id, name) values ('00000000-0000-0000-0000-000000003801', 'OE Provider') on conflict do nothing;
insert into public.courses (id, name, provider_id)
  values ('38c00000-0000-0000-0000-000000000001', 'OE Course', '00000000-0000-0000-0000-000000003801') on conflict do nothing;
insert into public.certificates (id, name, kind, provider_id)
  values ('38e00000-0000-0000-0000-000000000001', 'OE Exam', 'exam', '00000000-0000-0000-0000-000000003801') on conflict do nothing;

-- Member one prepares for the exam by self-study.
insert into public.learning_items (id, member_id, target_certificate_id)
  values ('38b00000-0000-0000-0000-000000000001', '38000000-0000-0000-0000-000000000001', '38e00000-0000-0000-0000-000000000001');

select throws_ok($q$insert into public.learning_items (member_id, course_id, target_certificate_id)
  values ('38000000-0000-0000-0000-000000000001', '38c00000-0000-0000-0000-000000000001', '38e00000-0000-0000-0000-000000000001')$q$,
  '23505', null, 'a second open item for the same exam is refused, even with a course');
select lives_ok($q$insert into public.learning_items (member_id, target_certificate_id)
  values ('38000000-0000-0000-0000-000000000002', '38e00000-0000-0000-0000-000000000001')$q$,
  'another member may prepare for the same exam');
select lives_ok($q$insert into public.learning_items (member_id, course_id) values
  ('38000000-0000-0000-0000-000000000001', '38c00000-0000-0000-0000-000000000001')$q$,
  'a course-only item for the course that prepares for the exam is allowed (both certificates)');

update public.learning_items set status = 'done', progress = 100, finished_date = public.vn_today()
  where id = '38b00000-0000-0000-0000-000000000001';
select lives_ok($q$insert into public.learning_items (id, member_id, target_certificate_id)
  values ('38b00000-0000-0000-0000-000000000002', '38000000-0000-0000-0000-000000000001', '38e00000-0000-0000-0000-000000000001')$q$,
  'a retake opens a new item once the first one is done');
select throws_ok($q$update public.learning_items set status = 'in_progress', progress = 10, finished_date = null
  where id = '38b00000-0000-0000-0000-000000000001'$q$,
  '23505', null, 'reopening a finished item clashes with the open retake');

select * from finish();
rollback;
