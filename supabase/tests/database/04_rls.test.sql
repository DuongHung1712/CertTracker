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

-- Fixtures (as postgres; RLS bypassed)
insert into public.dcs (id, name) values ('00000000-0000-0000-0000-0000000000d1', 'Test DC');
insert into public.programs (id, name, dc_id)
  values ('00000000-0000-0000-0000-0000000000f1', 'Program 1', '00000000-0000-0000-0000-0000000000d1');
insert into public.teams (id, name, program_id) values
  ('11111111-1111-1111-1111-111111111111', 'Team A', '00000000-0000-0000-0000-0000000000f1'),
  ('22222222-2222-2222-2222-222222222222', 'Team B', '00000000-0000-0000-0000-0000000000f1');
insert into public.members (id, full_name, email, team_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Member A', 'a@test.local', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Member B', 'b@test.local', '22222222-2222-2222-2222-222222222222');
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'admin@test.local'),
  ('a0000000-0000-0000-0000-00000000000b', 'manager@test.local'),
  ('a0000000-0000-0000-0000-00000000000c', 'a@test.local');
update public.profiles set role = 'admin' where user_id = 'a0000000-0000-0000-0000-00000000000a';
update public.profiles set role = 'manager' where user_id = 'a0000000-0000-0000-0000-00000000000b';
insert into public.team_managers (team_id, user_id)
  values ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-00000000000b');
insert into public.courses (id, name, validity_months)
  values ('cccccccc-0000-0000-0000-000000000001', 'AWS SAA', 36);
insert into public.training_records (id, member_id, course_id, status, progress) values
  ('eeeeeeee-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-000000000001', 'in_progress', 50),
  ('eeeeeeee-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000002',
   'cccccccc-0000-0000-0000-000000000001', 'in_progress', 20);

-- Anonymous
set local role anon;
select is((select count(*) from public.members), 0::bigint, 'anon sees no members');
reset role;

-- Admin
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000a');
select is((select count(*) from public.members where email::text like '%@test.local'), 2::bigint, 'admin sees all members');
select is(
  (select count(*) from public.training_records
    where member_id in ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002')),
  2::bigint, 'admin sees all records');
reset role;

-- Manager of Team A
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000b');
select is((select count(*) from public.members), 1::bigint, 'manager sees only managed-team members');
select results_eq(
  $$select id from public.training_records$$,
  array['eeeeeeee-0000-0000-0000-00000000000a'::uuid],
  'manager sees only managed-team records'
);
select lives_ok(
  $$update public.training_records set progress = 70 where id = 'eeeeeeee-0000-0000-0000-00000000000a'$$,
  'manager can update a managed-team record'
);
select is((select count(*) from public.v_training_records), 1::bigint, 'view respects RLS for manager');
select throws_ok(
  $$insert into public.courses (name) values ('New course')$$,
  '42501', null,
  'manager cannot create courses'
);
update public.training_records set progress = 60 where id = 'eeeeeeee-0000-0000-0000-00000000000b';
reset role;
select is(
  (select progress from public.training_records where id = 'eeeeeeee-0000-0000-0000-00000000000b'),
  20,
  'manager update on another team record has no effect'
);

-- Member A
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000c');
select results_eq(
  $$select id from public.members$$,
  array['aaaaaaaa-0000-0000-0000-000000000001'::uuid],
  'member sees only themself'
);
select results_eq(
  $$select id from public.training_records$$,
  array['eeeeeeee-0000-0000-0000-00000000000a'::uuid],
  'member sees only own records'
);
select ok(
  exists (select 1 from public.courses where id = 'cccccccc-0000-0000-0000-000000000001'),
  'member can read the course catalog');
select lives_ok(
  $$update public.training_records set progress = 80 where id = 'eeeeeeee-0000-0000-0000-00000000000a'$$,
  'member can update own progress'
);
select throws_ok(
  $$update public.training_records set refund_status = 'approved' where id = 'eeeeeeee-0000-0000-0000-00000000000a'$$,
  '42501',
  'members cannot change member_id, refund_status or via_company',
  'member cannot change refund_status'
);
select throws_ok(
  $$insert into public.training_records (member_id, course_id)
    values ('bbbbbbbb-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000001')$$,
  '42501', null,
  'member cannot create a record for someone else'
);
select lives_ok(
  $$insert into public.training_records (id, member_id, course_id, refund_status, via_company)
    values ('eeeeeeee-0000-0000-0000-00000000000c', 'aaaaaaaa-0000-0000-0000-000000000001',
            'cccccccc-0000-0000-0000-000000000001', 'paid', true)$$,
  'member can create an own record'
);
select is(
  (select refund_status::text from public.training_records where id = 'eeeeeeee-0000-0000-0000-00000000000c'),
  'n_a',
  'member-created record has refund_status forced to n_a'
);
select is((select count(*) from public.profiles), 1::bigint, 'member sees only own profile');
reset role;

select * from finish();
rollback;
