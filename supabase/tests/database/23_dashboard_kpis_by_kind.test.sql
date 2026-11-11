begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

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
insert into public.members (id, full_name, email, team_id, is_active) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'A One', 'a1@test.local', '11111111-1111-1111-1111-111111111111', true),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'A Two', 'a2@test.local', '11111111-1111-1111-1111-111111111111', true);
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'admin@test.local'),
  ('a0000000-0000-0000-0000-00000000000b', 'manager@test.local'),
  ('a0000000-0000-0000-0000-00000000000c', 'a1@test.local');
update public.profiles set role = 'admin'   where user_id = 'a0000000-0000-0000-0000-00000000000a';
update public.profiles set role = 'manager' where user_id = 'a0000000-0000-0000-0000-00000000000b';
insert into public.manager_scopes (team_id, user_id)
  values ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-00000000000b');

insert into public.providers (id, name) values ('eeeeeeee-0000-0000-0000-000000000001', 'Provider One');
insert into public.courses (id, name, provider_id) values
  ('c0c0c0c0-0000-0000-0000-000000000001', 'Granting One', 'eeeeeeee-0000-0000-0000-000000000001'),
  ('c0c0c0c0-0000-0000-0000-000000000002', 'Granting Two', 'eeeeeeee-0000-0000-0000-000000000001');
insert into public.certificates (id, name, kind, provider_id, validity_months, course_id) values
  ('99999999-0000-0000-0000-000000000001', 'Exam One',       'exam',       'eeeeeeee-0000-0000-0000-000000000001', 12,   null),
  ('99999999-0000-0000-0000-000000000002', 'Completion One', 'completion', 'eeeeeeee-0000-0000-0000-000000000001', null, 'c0c0c0c0-0000-0000-0000-000000000001'),
  -- A completion that carries a validity anyway: it must still stay out of the expiry buckets.
  ('99999999-0000-0000-0000-000000000003', 'Completion Two', 'completion', 'eeeeeeee-0000-0000-0000-000000000001', 1,    'c0c0c0c0-0000-0000-0000-000000000002');

insert into public.training_records (member_id, certificate_id, status, progress, issued_date) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000001', 'done',        100, public.vn_today() - 30),   -- exam, Active
  ('aaaaaaaa-0000-0000-0000-000000000002', '99999999-0000-0000-0000-000000000001', 'in_progress',  50, null),                     -- exam, in progress
  ('aaaaaaaa-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000002', 'done',        100, public.vn_today() - 10),   -- completion, no validity
  ('aaaaaaaa-0000-0000-0000-000000000002', '99999999-0000-0000-0000-000000000002', 'in_progress',  40, null),                     -- completion, in progress
  ('aaaaaaaa-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000003', 'done',        100, public.vn_today() - 400);  -- completion with validity, long past

-- Totals count every kind; the expiry buckets count exam certificates only; the completion columns add up the rest.
-- done_records (3) = 1 exam in the buckets + 2 completions; in_progress_records (2) = 1 exam + 1 completion.
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000a');
select results_eq(
  $$select total_members, total_records, done_records, in_progress_records, not_started_records,
           active_certs, expiring_60_certs, expiring_soon_certs, expired_certs, no_expiry_certs,
           completion_done_records, completion_in_progress_records
      from public.dashboard_kpis()$$,
  $$values (2, 5, 3, 2, 0, 1, 0, 0, 0, 0, 2, 1)$$,
  'admin: expiry buckets hold exams only, completions have their own columns, nothing is counted twice');
reset role;

select pg_temp.login_as('a0000000-0000-0000-0000-00000000000b');
select results_eq(
  $$select total_records, active_certs, expired_certs, completion_done_records, completion_in_progress_records
      from public.dashboard_kpis()$$,
  $$values (5, 1, 0, 2, 1)$$, 'manager: the same org-wide numbers by kind');
reset role;

select pg_temp.login_as('a0000000-0000-0000-0000-00000000000c');
select results_eq(
  $$select total_records, active_certs, expired_certs, completion_done_records, completion_in_progress_records
      from public.dashboard_kpis()$$,
  $$values (5, 1, 0, 2, 1)$$, 'member: scope unchanged, the same org-wide numbers (RLS would show one row)');
reset role;

select pg_temp.login_as('a0000000-0000-0000-0000-0000000000ff');   -- signed in but has no profile
select throws_ok($$select * from public.dashboard_kpis()$$, '42501', null, 'a user without a profile is refused');
reset role;

select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok($$select * from public.dashboard_kpis()$$, '42501', null, 'anon cannot call dashboard_kpis');
reset role;

select ok(not has_function_privilege('anon', 'public.dashboard_kpis()', 'execute'), 'anon has no EXECUTE');
select ok(has_function_privilege('authenticated', 'public.dashboard_kpis()', 'execute'), 'authenticated may execute');
select is((select prosecdef from pg_proc where proname = 'dashboard_kpis'), true, 'still SECURITY DEFINER');

select * from finish();
rollback;
