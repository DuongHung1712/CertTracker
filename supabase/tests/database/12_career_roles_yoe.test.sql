begin;
create extension if not exists pgtap with schema extensions;
select plan(48);

create function pg_temp.login_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

-- Back to postgres with no JWT (reset role alone would leave the claims behind).
create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- First day of the current Vietnam month, N months back (keeps the YoE asserts date-independent).
create function pg_temp.vn_month_back(n int) returns date language sql as $$
  select (date_trunc('month', now() at time zone 'Asia/Ho_Chi_Minh')::date - make_interval(months => n))::date;
$$;

-- Fixtures (as postgres; RLS bypassed). Team A is managed by the manager; team B is not.
insert into public.dcs (id, name) values ('c1000000-0000-0000-0000-0000000000d1', 'CR DC');
insert into public.programs (id, name, dc_id)
  values ('c1000000-0000-0000-0000-0000000000f1', 'CR Program', 'c1000000-0000-0000-0000-0000000000d1');
insert into public.teams (id, name, program_id) values
  ('c1000000-0000-0000-0000-00000000a001', 'CR Team A', 'c1000000-0000-0000-0000-0000000000f1'),
  ('c1000000-0000-0000-0000-00000000a002', 'CR Team B', 'c1000000-0000-0000-0000-0000000000f1');
insert into public.members (id, full_name, email, team_id) values
  ('c1000000-0000-0000-0000-00000000c001', 'CR Member A', 'cr-a@test.local', 'c1000000-0000-0000-0000-00000000a001'),
  ('c1000000-0000-0000-0000-00000000c002', 'CR Member B', 'cr-b@test.local', 'c1000000-0000-0000-0000-00000000a002');

insert into auth.users (id, email, email_confirmed_at) values
  ('c1000000-0000-0000-0000-00000000f00a', 'cr-admin@test.local', now()),
  ('c1000000-0000-0000-0000-00000000f001', 'cr-mgr@test.local', now()),
  ('c1000000-0000-0000-0000-00000000f00c', 'cr-user@test.local', now()),
  ('c1000000-0000-0000-0000-00000000f00d', 'cr-nolink@test.local', now());
update public.profiles set role = 'admin' where user_id = 'c1000000-0000-0000-0000-00000000f00a';
update public.profiles set role = 'manager' where user_id = 'c1000000-0000-0000-0000-00000000f001';
update public.profiles set member_id = 'c1000000-0000-0000-0000-00000000c001'
  where user_id = 'c1000000-0000-0000-0000-00000000f00c';
insert into public.manager_scopes (user_id, team_id)
  values ('c1000000-0000-0000-0000-00000000f001', 'c1000000-0000-0000-0000-00000000a001');

-- ===== seeded roles =====
select is(
  (select array_agg(name order by sort_order) from public.career_roles),
  array['Engineer', 'Senior Engineer', 'Team Lead', 'Project Manager'],
  'the four career roles are seeded in order');
select is((select array_agg(sort_order order by sort_order) from public.career_roles),
  array[1, 2, 3, 4], 'sort order runs 1 to 4');
select is((select career_role_id from public.members where id = 'c1000000-0000-0000-0000-00000000c001'),
  null, 'existing members have no role by default');

-- ===== constraints (as postgres) =====
select throws_ok(
  $$update public.members set career_start = '2020-03-17' where id = 'c1000000-0000-0000-0000-00000000c001'$$,
  '23514', null, 'career_start must be the first day of a month');
select throws_ok(
  $$insert into public.career_roles (name, sort_order) values ('Engineer', 9)$$,
  '23505', null, 'role names are unique');
select throws_ok(
  $$insert into public.career_roles (name, sort_order) values ('   ', 9)$$,
  '23514', null, 'role names cannot be blank');

-- ===== role in use cannot be deleted =====
update public.members set career_role_id = (select id from public.career_roles where name = 'Engineer')
  where id = 'c1000000-0000-0000-0000-00000000c002';
select throws_ok(
  $$delete from public.career_roles where name = 'Engineer'$$,
  '23503', null, 'deleting a role in use is restricted');
update public.members set career_role_id = null where id = 'c1000000-0000-0000-0000-00000000c002';

-- ===== manager: other columns yes, career fields no =====
select pg_temp.login_as('c1000000-0000-0000-0000-00000000f001');
select lives_ok(
  $$update public.members set full_name = 'CR Member A Renamed' where id = 'c1000000-0000-0000-0000-00000000c001'$$,
  'a manager can still update full_name of a member in scope');
select throws_ok(
  $$update public.members set career_role_id = (select id from public.career_roles where name = 'Team Lead')
    where id = 'c1000000-0000-0000-0000-00000000c001'$$,
  'P0001', 'only the admin can change this field', 'a manager cannot change career_role_id');
select throws_ok(
  $$update public.members set career_start = '2020-03-01' where id = 'c1000000-0000-0000-0000-00000000c001'$$,
  'P0001', 'only the admin can change this field', 'a manager cannot change career_start');
-- The self flag alone never opens the career fields: not the role, and not another member's start.
select set_config('app.career_start_self', 'on', true);
select throws_ok(
  $$update public.members set career_role_id = (select id from public.career_roles where name = 'Team Lead')
    where id = 'c1000000-0000-0000-0000-00000000c001'$$,
  'P0001', 'only the admin can change this field', 'the self flag does not let a manager change career_role_id');
select throws_ok(
  $$update public.members set career_start = '2020-03-01' where id = 'c1000000-0000-0000-0000-00000000c001'$$,
  'P0001', 'only the admin can change this field', 'the self flag does not cover a row that is not the caller''s own');
select set_config('app.career_start_self', 'off', true);
select is((select count(*) from public.career_roles), 4::bigint, 'a manager reads the roles');
select throws_ok(
  $$insert into public.career_roles (name, sort_order) values ('Architect', 5)$$,
  '42501', null, 'a manager cannot add a role');
select pg_temp.logout();

-- ===== admin sets role and start; manages roles =====
select pg_temp.login_as('c1000000-0000-0000-0000-00000000f00a');
select lives_ok(
  $$update public.members
    set career_role_id = (select id from public.career_roles where name = 'Senior Engineer'),
        career_start = '2019-01-01'
    where id = 'c1000000-0000-0000-0000-00000000c001'$$,
  'the admin can set the role and the career start');
select lives_ok(
  $$insert into public.career_roles (name, sort_order) values ('Architect', 5)$$,
  'the admin can add a role');
select lives_ok(
  $$delete from public.career_roles where name = 'Architect'$$,
  'the admin can delete an unused role');
select throws_ok(
  format($$update public.members set career_start = %L where id = 'c1000000-0000-0000-0000-00000000c001'$$,
    pg_temp.vn_month_back(-1)),
  'P0001', 'career start is in the future', 'the admin cannot set next month either');
select lives_ok(
  format($$update public.members set career_start = %L where id = 'c1000000-0000-0000-0000-00000000c001'$$,
    pg_temp.vn_month_back(0)),
  'the admin can set the current month');
select pg_temp.logout();
select throws_ok(
  format($$update public.members set career_start = %L where id = 'c1000000-0000-0000-0000-00000000c001'$$,
    pg_temp.vn_month_back(-1)),
  'P0001', 'career start is in the future', 'a JWT-less caller (service role) cannot set a future month');
select throws_ok(
  format($$insert into public.members (full_name, email, career_start) values ('CR Future', 'cr-f@test.local', %L)$$,
    pg_temp.vn_month_back(-2)),
  'P0001', 'career start is in the future', 'an insert with a future career start is rejected');
update public.members set career_role_id = (select id from public.career_roles where name = 'Team Lead'),
  career_start = null
  where id = 'c1000000-0000-0000-0000-00000000c001';
-- Snapshot of every other row, compared after the member's calls.
create temp table cr_snap as
  select id, career_start, career_role_id from public.members where id <> 'c1000000-0000-0000-0000-00000000c001';

-- ===== member sets their own career start =====
select pg_temp.login_as('c1000000-0000-0000-0000-00000000f00c');
select lives_ok($$select public.set_my_career_start('2020-03-17')$$, 'a member sets their career start');
select is((select career_start from public.members where id = 'c1000000-0000-0000-0000-00000000c001'),
  '2020-03-01'::date, 'the date is normalised to the first of the month');
select is(
  (select career_role_id from public.members where id = 'c1000000-0000-0000-0000-00000000c001'),
  (select id from public.career_roles where name = 'Team Lead'),
  'set_my_career_start leaves career_role_id untouched');
-- No update policy for members: a direct update matches no row.
update public.members set career_start = '2021-01-01' where id = 'c1000000-0000-0000-0000-00000000c001';
select is(
  (select career_start from public.members where id = 'c1000000-0000-0000-0000-00000000c001'),
  '2020-03-01'::date, 'a direct update of career_start by the member changes nothing');
update public.members set career_role_id = (select id from public.career_roles where name = 'Engineer')
  where id = 'c1000000-0000-0000-0000-00000000c001';
select is(
  (select career_role_id from public.members where id = 'c1000000-0000-0000-0000-00000000c001'),
  (select id from public.career_roles where name = 'Team Lead'),
  'a direct update of career_role_id by the member changes nothing');
select throws_ok(
  format($$select public.set_my_career_start(%L)$$, pg_temp.vn_month_back(-1)),
  'P0001', 'career start is in the future', 'next month is rejected');
select lives_ok(
  format($$select public.set_my_career_start(%L)$$, pg_temp.vn_month_back(0) + 14),
  'the current Vietnam month is accepted');
select pg_temp.logout();
select is(
  (select count(*) from public.members m join cr_snap s using (id)
   where m.career_start is distinct from s.career_start or m.career_role_id is distinct from s.career_role_id),
  0::bigint, 'no other member row changed (career_start and career_role_id compared on every row)');

select pg_temp.login_as('c1000000-0000-0000-0000-00000000f00d');
select throws_ok($$select public.set_my_career_start('2020-01-01')$$,
  'P0001', 'no member profile for this user', 'a user without a member row cannot set a career start');
select pg_temp.logout();

-- ===== vn_today and the pure YoE function =====
select is(public.vn_today(), (now() at time zone 'Asia/Ho_Chi_Minh')::date,
  'vn_today() is the Vietnam date');
set local timezone = 'Etc/GMT-14';
select is(public.vn_today(), (now() at time zone 'Asia/Ho_Chi_Minh')::date,
  'vn_today() ignores the session time zone (UTC+14)');
set local timezone = 'Etc/GMT+12';
select is(public.vn_today(), (now() at time zone 'Asia/Ho_Chi_Minh')::date,
  'vn_today() ignores the session time zone (UTC-12)');
reset timezone;
select is(public.yoe_years('2020-03-01', '2026-10-31'), 6.5::numeric, 'March 2020 to 31 Oct 2026 is 6.5 years');
select is(public.yoe_years('2020-03-01', '2026-11-01'), 6.5::numeric, 'March 2020 to 1 Nov 2026 is 6.5 years');
select is(public.yoe_years('2020-05-01', '2026-10-31'), 6.0::numeric, 'May 2020 to 31 Oct 2026 is 6.0 years');
select is(public.yoe_years('2020-04-01', '2026-09-30'), 6.0::numeric, 'April 2020 to 30 Sep 2026 is 6.0 years');
select is(public.yoe_years('2020-04-01', '2026-10-01'), 6.5::numeric,
  'one day later, across the month boundary, April 2020 to 1 Oct 2026 is 6.5 years');
select is(public.yoe_years(null, '2026-10-01'), null, 'no start gives null');
select is(public.yoe_years('2020-03-01', null), null, 'no today gives null');
select is(public.yoe_years('2026-12-01', '2026-10-01'), 0::numeric, 'a start after today never goes negative');

-- ===== YoE view =====
update public.members set career_start = pg_temp.vn_month_back(42) where id = 'c1000000-0000-0000-0000-00000000c001';
update public.members set career_start = pg_temp.vn_month_back(47) where id = 'c1000000-0000-0000-0000-00000000c002';
select is((select yoe_years from public.v_member_profiles where member_id = 'c1000000-0000-0000-0000-00000000c001'),
  3.5::numeric, '42 months is 3.5 years');
select is((select yoe_years from public.v_member_profiles where member_id = 'c1000000-0000-0000-0000-00000000c002'),
  3.5::numeric, '47 months rounds down to 3.5 years');
update public.members set career_start = pg_temp.vn_month_back(48) where id = 'c1000000-0000-0000-0000-00000000c001';
select is((select yoe_years from public.v_member_profiles where member_id = 'c1000000-0000-0000-0000-00000000c001'),
  4.0::numeric, '48 months is 4.0 years');
update public.members set career_start = pg_temp.vn_month_back(5) where id = 'c1000000-0000-0000-0000-00000000c001';
select is((select yoe_years from public.v_member_profiles where member_id = 'c1000000-0000-0000-0000-00000000c001'),
  0::numeric, '5 months is 0 years');
update public.members set career_start = pg_temp.vn_month_back(0) where id = 'c1000000-0000-0000-0000-00000000c001';
select is((select yoe_years from public.v_member_profiles where member_id = 'c1000000-0000-0000-0000-00000000c001'),
  0::numeric, '0 months is 0 years');
update public.members set career_start = null where id = 'c1000000-0000-0000-0000-00000000c001';
select is((select yoe_years from public.v_member_profiles where member_id = 'c1000000-0000-0000-0000-00000000c001'),
  null, 'no career start gives null');

-- ===== view follows RLS =====
select pg_temp.login_as('c1000000-0000-0000-0000-00000000f001');
select is((select count(*) from public.v_member_profiles where member_id in
  ('c1000000-0000-0000-0000-00000000c001', 'c1000000-0000-0000-0000-00000000c002')), 1::bigint,
  'a manager sees the profile of a member in scope only');
select pg_temp.logout();

select * from finish();
rollback;
