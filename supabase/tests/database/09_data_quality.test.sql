begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

create function pg_temp.login_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

-- Fixtures (as postgres; RLS bypassed). Seed rows exist too, so every assertion filters to these ids.
insert into public.dcs (id, name) values ('d9000000-0000-0000-0000-0000000000d1', 'DQ DC');
insert into public.programs (id, name, dc_id)
  values ('d9000000-0000-0000-0000-0000000000f1', 'DQ Program', 'd9000000-0000-0000-0000-0000000000d1');
insert into public.teams (id, name, program_id) values
  ('d9000000-0000-0000-0000-00000000a001', 'DQ Team A', 'd9000000-0000-0000-0000-0000000000f1'),
  ('d9000000-0000-0000-0000-00000000a002', 'DQ Team B', 'd9000000-0000-0000-0000-0000000000f1');
insert into public.members (id, full_name, email, team_id, is_active) values
  ('d9000000-0000-0000-0000-00000000b001', 'DQ A1', 'dq-a1@test.local', 'd9000000-0000-0000-0000-00000000a001', true),
  ('d9000000-0000-0000-0000-00000000b002', 'DQ B1', 'dq-b1@test.local', 'd9000000-0000-0000-0000-00000000a002', true),
  ('d9000000-0000-0000-0000-00000000b003', 'DQ No Team', 'dq-nt@test.local', null, true),
  ('d9000000-0000-0000-0000-00000000b004', 'DQ Inactive', 'dq-in@test.local', null, false);
insert into auth.users (id, email) values
  ('d9000000-0000-0000-0000-00000000f00a', 'dq-admin@test.local'),
  ('d9000000-0000-0000-0000-00000000f00b', 'dq-manager@test.local'),
  ('d9000000-0000-0000-0000-00000000f00c', 'dq-a1@test.local');  -- profile trigger links it to member DQ A1
update public.profiles set role = 'admin' where user_id = 'd9000000-0000-0000-0000-00000000f00a';
update public.profiles set role = 'manager' where user_id = 'd9000000-0000-0000-0000-00000000f00b';
insert into public.team_managers (team_id, user_id)
  values ('d9000000-0000-0000-0000-00000000a001', 'd9000000-0000-0000-0000-00000000f00b');

insert into public.courses (id, name, validity_months) values
  ('d9000000-0000-0000-0000-00000000e001', 'DQ with validity', 12),
  ('d9000000-0000-0000-0000-00000000e002', 'DQ no validity (has records)', null),
  ('d9000000-0000-0000-0000-00000000e003', 'DQ no validity (no records)', null),
  ('d9000000-0000-0000-0000-00000000e004', 'DQ second with validity', 6);

-- r1: overdue 3 days (A1)            r2: planned today -> NOT overdue (A1)
-- r3: overdue 1 day (B1)             r4: overdue but member inactive
-- r5: done, no evidence, no link (No Team)          r6: done with link only (B1)  -> fine
-- r7: done with evidence file (No Team)             r8: done with whitespace-only link (A1) -> flagged
-- r9: done + overdue planned date (A1)              -> NOT overdue (done)
insert into public.training_records (id, member_id, course_id, status, progress, planned_exam_date, issued_date, certificate_url, evidence_path) values
  ('d9000000-0000-0000-0000-0000000000e1', 'd9000000-0000-0000-0000-00000000b001', 'd9000000-0000-0000-0000-00000000e001', 'in_progress', 50, public.vn_today() - 3, null, null, null),
  ('d9000000-0000-0000-0000-0000000000e2', 'd9000000-0000-0000-0000-00000000b001', 'd9000000-0000-0000-0000-00000000e002', 'not_started', 0, public.vn_today(), null, null, null),
  ('d9000000-0000-0000-0000-0000000000e3', 'd9000000-0000-0000-0000-00000000b002', 'd9000000-0000-0000-0000-00000000e001', 'not_started', 0, public.vn_today() - 1, null, null, null),
  ('d9000000-0000-0000-0000-0000000000e4', 'd9000000-0000-0000-0000-00000000b004', 'd9000000-0000-0000-0000-00000000e001', 'in_progress', 10, public.vn_today() - 9, null, null, null),
  ('d9000000-0000-0000-0000-0000000000e5', 'd9000000-0000-0000-0000-00000000b003', 'd9000000-0000-0000-0000-00000000e001', 'done', 100, null, public.vn_today() - 10, null, null),
  ('d9000000-0000-0000-0000-0000000000e6', 'd9000000-0000-0000-0000-00000000b002', 'd9000000-0000-0000-0000-00000000e002', 'done', 100, null, public.vn_today() - 5, 'https://example.test/cert', null),
  ('d9000000-0000-0000-0000-0000000000e7', 'd9000000-0000-0000-0000-00000000b003', 'd9000000-0000-0000-0000-00000000e002', 'done', 100, null, public.vn_today() - 5, null, 'certificates/x/y/z.pdf'),
  ('d9000000-0000-0000-0000-0000000000e8', 'd9000000-0000-0000-0000-00000000b001', 'd9000000-0000-0000-0000-00000000e004', 'done', 100, null, public.vn_today() - 1, '   ', null),
  ('d9000000-0000-0000-0000-0000000000e9', 'd9000000-0000-0000-0000-00000000b002', 'd9000000-0000-0000-0000-00000000e004', 'done', 100, public.vn_today() - 30, public.vn_today() - 2, 'https://example.test/c2', null);

-- Admin
select pg_temp.login_as('d9000000-0000-0000-0000-00000000f00a');
select results_eq(
  $$select subject_id from public.v_data_quality_issues
    where issue_type = 'overdue_exam' and member_id::text like 'd9000000-%' order by subject_id$$,
  array['d9000000-0000-0000-0000-0000000000e1'::uuid, 'd9000000-0000-0000-0000-0000000000e3'::uuid],
  'admin: overdue exams are r1 and r3 (not today, not done, not inactive)');
select is(
  (select days from public.v_data_quality_issues where subject_id = 'd9000000-0000-0000-0000-0000000000e1' and issue_type = 'overdue_exam'),
  3, 'overdue days = today - planned date');
select is(
  (select days from public.v_data_quality_issues where subject_id = 'd9000000-0000-0000-0000-0000000000e3' and issue_type = 'overdue_exam'),
  1, 'yesterday is overdue by 1 day');
select is(
  (select count(*) from public.v_data_quality_issues where subject_id = 'd9000000-0000-0000-0000-0000000000e2'),
  0::bigint, 'planned today is not overdue');
select results_eq(
  $$select subject_id from public.v_data_quality_issues
    where issue_type = 'done_no_evidence' and member_id::text like 'd9000000-%' order by subject_id$$,
  array['d9000000-0000-0000-0000-0000000000e5'::uuid, 'd9000000-0000-0000-0000-0000000000e8'::uuid],
  'admin: done without file or link = r5 and r8 (link, file and whitespace-only link handled)');
select results_eq(
  $$select subject_id from public.v_data_quality_issues
    where issue_type = 'member_no_team' and subject_id::text like 'd9000000-%'$$,
  array['d9000000-0000-0000-0000-00000000b003'::uuid],
  'admin: only the ACTIVE member without a team');
select results_eq(
  $$select subject_id from public.v_data_quality_issues
    where issue_type = 'course_no_validity' and subject_id::text like 'd9000000-%'$$,
  array['d9000000-0000-0000-0000-00000000e002'::uuid],
  'admin: course without validity that has records (not the unused one)');
select is(
  (select severity from public.v_data_quality_issues where issue_type = 'course_no_validity' and subject_id = 'd9000000-0000-0000-0000-00000000e002'),
  'info', 'course_no_validity is info severity');
select is(
  (select count(*) from public.v_data_quality_issues where member_id = 'd9000000-0000-0000-0000-00000000b004'),
  0::bigint, 'inactive member has no issues at all');
reset role;

-- Manager of Team A: record-level issues of own team only; no admin-only kinds
select pg_temp.login_as('d9000000-0000-0000-0000-00000000f00b');
select results_eq(
  $$select subject_id from public.v_data_quality_issues
    where issue_type = 'overdue_exam' and member_id::text like 'd9000000-%'$$,
  array['d9000000-0000-0000-0000-0000000000e1'::uuid],
  'manager: sees the overdue exam of Team A, not Team B');
select results_eq(
  $$select subject_id from public.v_data_quality_issues
    where issue_type = 'done_no_evidence' and member_id::text like 'd9000000-%'$$,
  array['d9000000-0000-0000-0000-0000000000e8'::uuid],
  'manager: done-without-evidence only for Team A (r8), not the no-team member');
select is(
  (select count(*) from public.v_data_quality_issues where issue_type in ('member_no_team', 'course_no_validity')),
  0::bigint, 'manager does not see member-level or course-level issues');
reset role;

-- Member linked to DQ A1: only own record-level issues
select pg_temp.login_as('d9000000-0000-0000-0000-00000000f00c');
select results_eq(
  $$select subject_id from public.v_data_quality_issues where subject_id::text like 'd9000000-%' order by subject_id$$,
  array['d9000000-0000-0000-0000-0000000000e1'::uuid, 'd9000000-0000-0000-0000-0000000000e8'::uuid],
  'member: sees only own issues (r1, r8)');
select is(
  (select count(*) from public.v_data_quality_issues where issue_type in ('member_no_team', 'course_no_validity')),
  0::bigint, 'member does not see member-level or course-level issues');
reset role;

-- Anonymous
set local role anon;
select throws_ok($$select count(*) from public.v_data_quality_issues$$, '42501', null, 'anon cannot read the view');
reset role;

-- Shape
select has_view('public', 'v_data_quality_issues', 'view exists');
select is(
  (select array_agg(column_name::text order by ordinal_position) from information_schema.columns
    where table_schema = 'public' and table_name = 'v_data_quality_issues'),
  array['issue_type','severity','subject_id','member_id','member_code','member_name','team_id','team_name',
        'course_id','course_name','record_id','since','days'],
  'columns are the documented contract');
select is(
  (select reloptions::text from pg_class where oid = 'public.v_data_quality_issues'::regclass),
  '{security_invoker=true}', 'view is security_invoker');

select * from finish();
rollback;
