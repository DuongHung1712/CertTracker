begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

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
select pg_temp.logout();
update public.members set career_role_id = null, career_start = null
  where id = 'c1000000-0000-0000-0000-00000000c001';

-- ===== member sets their own career start =====
select pg_temp.login_as('c1000000-0000-0000-0000-00000000f00c');
select lives_ok($$select public.set_my_career_start('2020-03-17')$$, 'a member sets their career start');
select is((select career_start from public.members where id = 'c1000000-0000-0000-0000-00000000c001'),
  '2020-03-01'::date, 'the date is normalised to the first of the month');
-- No update policy for members: a direct update matches no row.
update public.members set career_start = '2021-01-01' where id = 'c1000000-0000-0000-0000-00000000c001';
select is(
  (select career_start from public.members where id = 'c1000000-0000-0000-0000-00000000c001'),
  '2020-03-01'::date, 'a direct update by the member changes nothing');
select throws_ok(
  format($$select public.set_my_career_start(%L)$$, pg_temp.vn_month_back(-1)),
  'P0001', 'career start is in the future', 'next month is rejected');
select lives_ok(
  format($$select public.set_my_career_start(%L)$$, pg_temp.vn_month_back(0) + 14),
  'the current Vietnam month is accepted');
select pg_temp.logout();
select is((select career_start from public.members where id = 'c1000000-0000-0000-0000-00000000c002'),
  null, 'no other member row changed');

select pg_temp.login_as('c1000000-0000-0000-0000-00000000f00d');
select throws_ok($$select public.set_my_career_start('2020-01-01')$$,
  'P0001', null, 'a user without a member row cannot set a career start');
select pg_temp.logout();

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
