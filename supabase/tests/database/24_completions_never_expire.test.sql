begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

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

insert into public.training_records (member_id, certificate_id, status, progress, issued_date) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000001', 'done', 100, public.vn_today() - 400),  -- exam, Expired
  ('aaaaaaaa-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000002', 'done', 100, public.vn_today() - 400),  -- completion, long past
  ('aaaaaaaa-0000-0000-0000-000000000002', '99999999-0000-0000-0000-000000000002', 'done', 100, public.vn_today() - 400),  -- completion only member
  ('aaaaaaaa-0000-0000-0000-000000000003', '99999999-0000-0000-0000-000000000001', 'done', 100, public.vn_today() - 30),   -- exam, Active (Team B)
  ('aaaaaaaa-0000-0000-0000-000000000003', '99999999-0000-0000-0000-000000000002', 'done', 100, public.vn_today() - 400);  -- completion (Team B)

select pg_temp.login_as('a0000000-0000-0000-0000-00000000000a');
select results_eq(
  $$select certificate_kind, expiry_status, expiry_date, days_to_expiry from public.v_training_records
     where certificate_kind = 'completion' order by member_code$$,
  $$values ('completion'::public.certificate_kind, 'No Expiry', null::date, null::int),
           ('completion', 'No Expiry', null, null), ('completion', 'No Expiry', null, null)$$,
  'admin: a completion with a validity has No Expiry and no dates');
select results_eq(
  $$select expiry_status from public.v_training_records
     where certificate_kind = 'exam' order by expiry_status$$,
  $$values ('Active'), ('Expired')$$, 'admin: exams still expire');
select results_eq(
  $$select expiry_date is not null, days_to_expiry < 0 from public.v_training_records
     where certificate_kind = 'exam' and expiry_status = 'Expired'$$,
  $$values (true, true)$$, 'admin: the expired exam keeps its dates');
select results_eq(
  $$select group_label, valid, expired from public.dashboard_breakdown('team') order by group_label$$,
  $$values ('Team A'::text, 0, 1), ('Team B', 1, 0)$$,
  'admin: team valid / expired count exams only');
select results_eq(
  $$select group_label, done, valid, expired from public.dashboard_breakdown('certificate') order by group_label$$,
  $$values ('Completion One'::text, 3, 0, 0), ('Exam One', 2, 1, 1)$$,
  'admin: certificate valid / expired count exams only (a completion is done but neither)');
select results_eq(
  $$select member_code is not null, valid_certs, done_certs, rank from public.dashboard_ranking() order by rank, full_name$$,
  $$values (true, 1, 1, 1), (true, 0, 1, 2), (true, 0, 0, 3)$$,
  'admin: ranking counts exams only, the completion-only member has 0 / 0');
reset role;

select pg_temp.login_as('a0000000-0000-0000-0000-00000000000b');
select results_eq(
  $$select member_name, expiry_status from public.v_training_records order by member_name, certificate_kind$$,
  $$values ('A One'::text, 'Expired'), ('A One', 'No Expiry'), ('A Two', 'No Expiry')$$,
  'manager: only team A rows, completion is No Expiry');
select results_eq(
  $$select full_name, valid_certs, done_certs from public.dashboard_ranking() order by full_name$$,
  $$values ('A One'::text, 0, 1), ('A Two', 0, 0)$$,
  'manager: ranking limited to the managed team, completions not counted');
select results_eq(
  $$select group_label, valid, expired from public.dashboard_breakdown('team') where group_label = 'Team A'$$,
  $$values ('Team A'::text, 0, 1)$$, 'manager: team breakdown excludes the completion');
select is((select count(*)::int from public.v_training_records where member_name = 'B Three'), 0,
  'manager: cannot see team B in the view');
reset role;

select pg_temp.login_as('a0000000-0000-0000-0000-00000000000c');
select results_eq(
  $$select expiry_status, expiry_date, days_to_expiry from public.v_training_records
     where certificate_kind = 'completion'$$,
  $$values ('No Expiry', null::date, null::int)$$, 'member: own completion has No Expiry');
select throws_ok($$select * from public.dashboard_ranking()$$, '42501', null, 'member: ranking still refused');
reset role;

select is((select pg_get_viewdef('public.v_training_records'::regclass) like '%completion%'), true,
  'the view rule mentions the completion kind');
select is((select reloptions::text from pg_class where relname = 'v_training_records'), '{security_invoker=true}',
  'the view stays security_invoker');

select * from finish();
rollback;
