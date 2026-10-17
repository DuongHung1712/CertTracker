begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

create function pg_temp.login_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

-- The seeded DB has its own members and records; clear them (rolled back at the end) so the
-- org-wide counts below are exactly this fixture.
delete from public.training_records;
delete from public.members;

insert into public.dcs (id, name) values ('00000000-0000-0000-0000-0000000000d1', 'Dash DC');
insert into public.programs (id, name, dc_id)
  values ('00000000-0000-0000-0000-0000000000f1', 'Dash Program', '00000000-0000-0000-0000-0000000000d1');
insert into public.teams (id, name, program_id) values
  ('11111111-1111-1111-1111-111111111111', 'Team A', '00000000-0000-0000-0000-0000000000f1'),
  ('22222222-2222-2222-2222-222222222222', 'Team B', '00000000-0000-0000-0000-0000000000f1'),
  ('33333333-3333-3333-3333-333333333333', 'Team C', '00000000-0000-0000-0000-0000000000f1');
insert into public.members (id, full_name, email, team_id, is_active) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'A One',    'a1@test.local', '11111111-1111-1111-1111-111111111111', true),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'A Two',    'a2@test.local', '11111111-1111-1111-1111-111111111111', true),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'A Three',  'a3@test.local', '11111111-1111-1111-1111-111111111111', true),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'B One',    'b1@test.local', '22222222-2222-2222-2222-222222222222', true),
  ('cccccccc-0000-0000-0000-000000000001', 'No Team',  'n1@test.local', null, true),
  ('dddddddd-0000-0000-0000-000000000001', 'Inactive', 'i1@test.local', '11111111-1111-1111-1111-111111111111', false);
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'admin@test.local'),
  ('a0000000-0000-0000-0000-00000000000b', 'manager@test.local'),
  ('a0000000-0000-0000-0000-00000000000c', 'a1@test.local');           -- linked to member "A One" by email
update public.profiles set role = 'admin'   where user_id = 'a0000000-0000-0000-0000-00000000000a';
update public.profiles set role = 'manager' where user_id = 'a0000000-0000-0000-0000-00000000000b';
insert into public.team_managers (team_id, user_id)
  values ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-00000000000b');

insert into public.providers (id, name) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'Provider One'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'Provider Two');
insert into public.cert_types (id, name) values ('ffffffff-0000-0000-0000-000000000001', 'Type One');
insert into public.courses (id, name, cert_type_id, provider_id, validity_months) values
  ('99999999-0000-0000-0000-000000000001', 'Course One',   'ffffffff-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001', 12),
  ('99999999-0000-0000-0000-000000000002', 'Course Two',   null,                                   'eeeeeeee-0000-0000-0000-000000000001', 6),
  ('99999999-0000-0000-0000-000000000003', 'Course Three', 'ffffffff-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000002', null);

-- C1 = Course One (12 months), C2 = Course Two (6 months), C3 = Course Three (never expires)
insert into public.training_records (member_id, course_id, status, progress, issued_date) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000001', 'done', 100, public.vn_today() - 30),   -- A One C1: Active
  ('aaaaaaaa-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000003', 'done', 100, public.vn_today() - 30),   -- A One C3: No Expiry
  ('aaaaaaaa-0000-0000-0000-000000000002', '99999999-0000-0000-0000-000000000001', 'done', 100, public.vn_today() - 400),  -- A Two C1: Expired
  ('aaaaaaaa-0000-0000-0000-000000000002', '99999999-0000-0000-0000-000000000002', 'done', 100, public.vn_today() - 300),  -- A Two C2: Expired (more done, fewer valid than B One / No Team: ranking key order)
  ('aaaaaaaa-0000-0000-0000-000000000003', '99999999-0000-0000-0000-000000000001', 'in_progress', 50, null),
  ('aaaaaaaa-0000-0000-0000-000000000003', '99999999-0000-0000-0000-000000000003', 'not_started', 0, null),
  ('aaaaaaaa-0000-0000-0000-000000000003', '99999999-0000-0000-0000-000000000002', 'done', 100, public.vn_today() - 130),  -- A Three C2: Expiring in 60d (~52 days left, the 31-60 bucket)
  ('bbbbbbbb-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000001', 'done', 100, public.vn_today() - 340),  -- B One C1: Expiring Soon (~25 days)
  ('cccccccc-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000002', 'done', 100, public.vn_today() - 10),   -- No Team C2: Active
  ('dddddddd-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000001', 'done', 100, public.vn_today() - 5);    -- Inactive: must never be counted

-- ============ KPIs: the same org-wide numbers for every signed-in role ============
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000a');
select results_eq(
  $$select total_members, total_records, done_records, in_progress_records, not_started_records,
           active_certs, expiring_60_certs, expiring_soon_certs, expired_certs, no_expiry_certs
      from public.dashboard_kpis()$$,
  $$values (5, 9, 7, 1, 1, 2, 1, 1, 2, 1)$$,
  'admin: KPIs count active members only and partition done certificates into expiry buckets');
select is((select expiring_60_certs from public.dashboard_kpis()), 1,
  'a done certificate with 31-60 days left lands in the Expiring in 60d bucket (not Active, not Expiring Soon)');
reset role;

select pg_temp.login_as('a0000000-0000-0000-0000-00000000000b');
select results_eq(
  $$select total_members, total_records, done_records from public.dashboard_kpis()$$,
  $$values (5, 9, 7)$$, 'manager: KPIs are org-wide, not limited to the managed team');
reset role;

select pg_temp.login_as('a0000000-0000-0000-0000-00000000000c');
select results_eq(
  $$select total_members, total_records, done_records from public.dashboard_kpis()$$,
  $$values (5, 9, 7)$$, 'member: sees the same org-wide aggregates (RLS would show them one row)');
reset role;

select pg_temp.login_as('a0000000-0000-0000-0000-0000000000ff');   -- signed in but has no profile
select throws_ok($$select * from public.dashboard_kpis()$$, '42501', null, 'a user without a profile is refused');
reset role;

select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok($$select * from public.dashboard_kpis()$$, '42501', null, 'anon cannot call dashboard_kpis');
reset role;

-- ============ Breakdown as admin ============
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000a');
select results_eq(
  $$select headcount, people, records, done, in_progress, not_started, valid, expired
      from public.dashboard_breakdown('team') where group_label = 'Team A'$$,
  $$values (3, 3, 7, 5, 1, 1, 3, 2)$$, 'team A: 3 active members (the inactive one is excluded), expired certs are not valid');
select results_eq(
  $$select headcount, people, records, done, in_progress, not_started, valid, expired
      from public.dashboard_breakdown('team') where group_label = 'Chưa có team'$$,
  $$values (1, 1, 1, 1, 0, 0, 1, 0)$$, 'members without a team form one "Chưa có team" group');
select results_eq(
  $$select headcount, people, records, done, in_progress, not_started, valid, expired
      from public.dashboard_breakdown('team') where group_label = 'Team B'$$,
  $$values (1, 1, 1, 1, 0, 0, 1, 0)$$, 'team B: an expiring-soon certificate is still valid');
select is((select count(*) from public.dashboard_breakdown('team')), 3::bigint,
  'a team with no active members (Team C) does not appear');
select is((select group_label from public.dashboard_breakdown('team', 1)), 'Team A',
  'ordered by records desc and p_limit applies');
select results_eq(
  $$select people, records, done, in_progress, not_started, valid, expired
      from public.dashboard_breakdown('provider') where group_label = 'Provider One'$$,
  $$values (5, 7, 6, 1, 0, 4, 2)$$, 'provider one: people are distinct learners across its courses');
select results_eq(
  $$select people, records, done, in_progress, not_started, valid, expired
      from public.dashboard_breakdown('provider') where group_label = 'Provider Two'$$,
  $$values (2, 2, 1, 0, 1, 1, 0)$$, 'provider two');
select results_eq(
  $$select people, records, done, in_progress, not_started, valid, expired
      from public.dashboard_breakdown('cert_type') where group_label = 'Type One'$$,
  $$values (4, 6, 4, 1, 1, 3, 1)$$, 'cert type one');
select results_eq(
  $$select people, records, done, in_progress, not_started, valid, expired
      from public.dashboard_breakdown('cert_type') where group_label = 'Chưa phân loại'$$,
  $$values (3, 3, 3, 0, 0, 2, 1)$$, 'a course without a cert type lands in "Chưa phân loại"');
select results_eq(
  $$select people, records, done, in_progress, not_started, valid, expired
      from public.dashboard_breakdown('course') where group_label = 'Course One'$$,
  $$values (4, 4, 3, 1, 0, 2, 1)$$, 'course one');
select results_eq(
  $$select people, records, done, in_progress, not_started, valid, expired
      from public.dashboard_breakdown('course') where group_label = 'Course Two'$$,
  $$values (3, 3, 3, 0, 0, 2, 1)$$, 'course two');
select is((select count(*) from public.dashboard_breakdown('course', 2)), 2::bigint, 'p_limit caps the rows');
select throws_ok($$select * from public.dashboard_breakdown('galaxy')$$, '22023', null, 'an unknown dimension is refused');
select throws_ok($$select * from public.dashboard_breakdown('course', 0)$$, '22023', null, 'p_limit below 1 is refused');
reset role;

-- ============ Breakdown as member: no teams, groups under 3 learners hidden ============
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000c');
select is((select count(*) from public.dashboard_breakdown('team')), 0::bigint, 'member: no per-team numbers at all');
select results_eq(
  $$select group_label from public.dashboard_breakdown('provider')$$,
  $$values ('Provider One')$$, 'member: only the provider with at least 3 learners');
select results_eq(
  $$select group_label from public.dashboard_breakdown('cert_type')$$,
  $$values ('Type One'), ('Chưa phân loại')$$, 'member: a group with exactly 3 learners ("Chưa phân loại") is shown');
select results_eq(
  $$select group_label from public.dashboard_breakdown('course')$$,
  $$values ('Course One'), ('Course Two')$$, 'member: Course Two (exactly 3 learners) is shown, Course Three (2 learners) is hidden');
reset role;

select pg_temp.login_as('a0000000-0000-0000-0000-00000000000b');
select is((select count(*) from public.dashboard_breakdown('team')), 3::bigint, 'manager: sees every team, unsuppressed');
reset role;

-- ============ Ranking: admin = everyone, manager = their team, member/anon refused ============
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000a');
select results_eq(
  $$select full_name, rank from public.dashboard_ranking() order by rank, full_name$$,
  $$values ('A One'::text, 1), ('A Three', 2), ('B One', 2), ('No Team', 2), ('A Two', 3)$$,
  'admin: dense rank by valid then done certificates; inactive members excluded');
select is((select rank from public.dashboard_ranking() where full_name = 'A Two'), 3,
  'valid certificates outrank done ones: A Two (2 done, 0 valid) ranks below the members with 1 valid');
reset role;

select pg_temp.login_as('a0000000-0000-0000-0000-00000000000b');
select results_eq(
  $$select full_name, rank from public.dashboard_ranking() order by rank, full_name$$,
  $$values ('A One'::text, 1), ('A Three', 2), ('A Two', 3)$$,
  'manager: only the managed team, ranked within what they can see');
reset role;

select pg_temp.login_as('a0000000-0000-0000-0000-00000000000c');
select throws_ok($$select * from public.dashboard_ranking()$$, '42501', null, 'member cannot call the ranking');
reset role;

select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok($$select * from public.dashboard_ranking()$$, '42501', null, 'anon cannot call the ranking');
reset role;

-- ============ Structure ============
select ok(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('dashboard_kpis', 'dashboard_breakdown')
     and p.proargnames && array['full_name', 'email', 'member_code', 'member_id', 'user_id']),
  'the definer functions expose no identity column');
select is((select bool_and(prosecdef) from pg_proc where proname in ('dashboard_kpis', 'dashboard_breakdown')),
  true, 'kpis and breakdown are SECURITY DEFINER');
select is((select prosecdef from pg_proc where proname = 'dashboard_ranking'), false,
  'the ranking is SECURITY INVOKER (RLS scopes it)');
select ok(not has_function_privilege('anon', 'public.dashboard_kpis()', 'execute'), 'anon has no EXECUTE on kpis');
select ok(not has_function_privilege('anon', 'public.dashboard_breakdown(text, integer)', 'execute'), 'anon has no EXECUTE on breakdown');
select ok(not has_function_privilege('anon', 'public.dashboard_ranking()', 'execute'), 'anon has no EXECUTE on ranking');
select ok(
  has_function_privilege('authenticated', 'public.dashboard_kpis()', 'execute')
  and has_function_privilege('authenticated', 'public.dashboard_breakdown(text, integer)', 'execute')
  and has_function_privilege('authenticated', 'public.dashboard_ranking()', 'execute'),
  'authenticated may execute all three');

select * from finish();
rollback;
