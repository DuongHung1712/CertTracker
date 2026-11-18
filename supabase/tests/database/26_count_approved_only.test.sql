begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

create function pg_temp.login_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

delete from public.training_records;
delete from public.members;

insert into public.dcs (id, name) values ('00000000-0000-0000-0000-0000000000d1', 'Kind DC');
insert into public.programs (id, name, dc_id)
  values ('00000000-0000-0000-0000-0000000000f1', 'Kind Program', '00000000-0000-0000-0000-0000000000d1');
insert into public.teams (id, name, program_id)
  values ('11111111-1111-1111-1111-111111111111', 'Team A', '00000000-0000-0000-0000-0000000000f1');
insert into public.teams (id, name, program_id)
  values ('22222222-2222-2222-2222-222222222222', 'Team B', '00000000-0000-0000-0000-0000000000f1');
insert into public.members (id, full_name, email, team_id, is_active) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'A One', 'a1@test.local', '11111111-1111-1111-1111-111111111111', true),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'A Two', 'a2@test.local', '11111111-1111-1111-1111-111111111111', true),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'B Three', 'b3@test.local', '22222222-2222-2222-2222-222222222222', true);
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'admin@test.local'),
  ('a0000000-0000-0000-0000-00000000000b', 'manager@test.local'),
  ('a0000000-0000-0000-0000-00000000000c', 'a1@test.local');
update public.profiles set role = 'admin'   where user_id = 'a0000000-0000-0000-0000-00000000000a';
update public.profiles set role = 'manager' where user_id = 'a0000000-0000-0000-0000-00000000000b';
insert into public.manager_scopes (team_id, user_id)
  values ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-00000000000b');

insert into public.providers (id, name) values ('eeeeeeee-0000-0000-0000-000000000001', 'Provider One');
insert into public.courses (id, name, provider_id)
  values ('c0c0c0c0-0000-0000-0000-000000000001', 'Granting One', 'eeeeeeee-0000-0000-0000-000000000001');
insert into public.certificates (id, name, kind, provider_id, validity_months, course_id) values
  ('99999999-0000-0000-0000-000000000001', 'Exam One',       'exam',       'eeeeeeee-0000-0000-0000-000000000001', 12, null),
  -- A completion that carries a validity anyway: it must never expire.
  ('99999999-0000-0000-0000-000000000002', 'Completion One', 'completion', 'eeeeeeee-0000-0000-0000-000000000001', 12, 'c0c0c0c0-0000-0000-0000-000000000001');

insert into public.training_records (member_id, certificate_id, status, progress, issued_date, approval, approval_note) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000001', 'done', 100, public.vn_today() - 30,  'approved', null),       -- exam, counts
  ('aaaaaaaa-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000002', 'done', 100, public.vn_today() - 30,  'waiting',  null),       -- completion, waiting
  ('aaaaaaaa-0000-0000-0000-000000000002', '99999999-0000-0000-0000-000000000001', 'done', 100, public.vn_today() - 30,  'waiting',  null),       -- exam, waiting
  ('aaaaaaaa-0000-0000-0000-000000000002', '99999999-0000-0000-0000-000000000002', 'done', 100, public.vn_today() - 30,  'returned', 'Wrong date'), -- completion, returned
  ('aaaaaaaa-0000-0000-0000-000000000003', '99999999-0000-0000-0000-000000000001', 'done', 100, public.vn_today() - 400, 'approved', null),       -- exam, Expired (Team B)
  ('aaaaaaaa-0000-0000-0000-000000000003', '99999999-0000-0000-0000-000000000002', 'done', 100, public.vn_today() - 30,  'approved', null);       -- completion (Team B)

select pg_temp.login_as('a0000000-0000-0000-0000-00000000000a');
select results_eq(
  $$select total_records, done_records, active_certs, expired_certs, completion_done_records, waiting_records
    from public.dashboard_kpis()$$,
  $$values (3, 3, 1, 1, 1, 2)$$,
  'admin: kpis count Approved only; both Waiting items (exam and completion) are in waiting_records, Returned nowhere');
select results_eq(
  $$select group_label, records, done, valid, expired from public.dashboard_breakdown('team') order by group_label$$,
  $$values ('Team A'::text, 1, 1, 1, 0), ('Team B', 2, 2, 0, 1)$$,
  'admin: team breakdown ignores Waiting and Returned items');
select results_eq(
  $$select group_label, records, done, valid, expired from public.dashboard_breakdown('certificate') order by group_label$$,
  $$values ('Completion One'::text, 1, 1, 0, 0), ('Exam One', 2, 2, 1, 1)$$,
  'admin: certificate breakdown ignores Waiting and Returned items');
select results_eq(
  $$select group_label from public.dashboard_breakdown('team')$$,
  $$values ('Team B'::text), ('Team A')$$,
  'admin: teams sort by counted items (B has 2, A has 4 rows but 1 counted)');
select results_eq(
  $$select group_label, people from public.dashboard_breakdown('team') order by group_label$$,
  $$values ('Team A'::text, 1), ('Team B', 1)$$,
  'admin: team people counts learners with a counted item only (A Two has none)');
select results_eq(
  $$select group_label, people from public.dashboard_breakdown('certificate') order by group_label$$,
  $$values ('Completion One'::text, 1), ('Exam One', 2)$$,
  'admin: certificate people ignores learners whose only item waits or was returned');
select results_eq(
  $$select full_name, valid_certs, done_certs, rank from public.dashboard_ranking() order by rank, full_name$$,
  $$values ('A One'::text, 1, 1, 1), ('B Three', 0, 1, 2), ('A Two', 0, 0, 3)$$,
  'admin: ranking ignores Waiting and Returned items');
reset role;

select pg_temp.login_as('a0000000-0000-0000-0000-00000000000b');
select results_eq(
  $$select full_name, valid_certs, done_certs from public.dashboard_ranking() order by full_name$$,
  $$values ('A One'::text, 1, 1), ('A Two', 0, 0)$$,
  'manager: ranking stays limited to the managed team and ignores unapproved items');
select results_eq(
  $$select group_label, records, done, valid from public.dashboard_breakdown('team') where group_label = 'Team A'$$,
  $$values ('Team A'::text, 1, 1, 1)$$, 'manager: team A breakdown ignores unapproved items');
reset role;

select pg_temp.login_as('a0000000-0000-0000-0000-00000000000c');
select results_eq(
  $$select done_records, waiting_records from public.dashboard_kpis()$$,
  $$values (3, 2)$$, 'member: kpis use the same rules');
select is((select count(*)::int from public.dashboard_breakdown('certificate')), 0,
  'member: no group reaches the 3-people privacy threshold once unapproved learners are not counted');
select is((select count(*)::int from public.v_training_records), 2,
  'member: the list still shows every own item (Approved and Waiting)');
reset role;

select * from finish();
rollback;
