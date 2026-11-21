begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

create function pg_temp.login_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create function pg_temp.logout() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '{}', true);
end;
$$;

create function pg_temp.rows_changed(q text) returns int language plpgsql as $$
declare n int;
begin
  execute q;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Fixtures: team A (managed) with members 1 and 2, team B with member 3.
insert into public.dcs (id, name) values ('00000000-0000-0000-0000-0000000031d1', 'LI DC') on conflict do nothing;
insert into public.programs (id, name, dc_id)
  values ('00000000-0000-0000-0000-0000000031f1', 'LI Program', '00000000-0000-0000-0000-0000000031d1') on conflict do nothing;
insert into public.teams (id, name, program_id) values
  ('31313131-0000-0000-0000-00000000000a', 'LI Team A', '00000000-0000-0000-0000-0000000031f1'),
  ('31313131-0000-0000-0000-00000000000b', 'LI Team B', '00000000-0000-0000-0000-0000000031f1') on conflict do nothing;
insert into public.members (id, full_name, email, team_id, is_active) values
  ('31000000-0000-0000-0000-000000000001', 'LI Member One', 'li1@test.local', '31313131-0000-0000-0000-00000000000a', true),
  ('31000000-0000-0000-0000-000000000002', 'LI Member Two', 'li2@test.local', '31313131-0000-0000-0000-00000000000a', true),
  ('31000000-0000-0000-0000-000000000003', 'LI Member Three', 'li3@test.local', '31313131-0000-0000-0000-00000000000b', true)
  on conflict do nothing;
insert into auth.users (id, email) values
  ('31a00000-0000-0000-0000-000000000001', 'li1@test.local'),
  ('31a00000-0000-0000-0000-000000000002', 'li2@test.local'),
  ('31a00000-0000-0000-0000-00000000000b', 'limgr@test.local'),
  ('31a00000-0000-0000-0000-00000000000a', 'liadmin@test.local') on conflict do nothing;
update public.profiles set role = 'member' where user_id in ('31a00000-0000-0000-0000-000000000001', '31a00000-0000-0000-0000-000000000002');
update public.profiles set role = 'manager' where user_id = '31a00000-0000-0000-0000-00000000000b';
update public.profiles set role = 'admin' where user_id = '31a00000-0000-0000-0000-00000000000a';
insert into public.manager_scopes (team_id, user_id)
  values ('31313131-0000-0000-0000-00000000000a', '31a00000-0000-0000-0000-00000000000b') on conflict do nothing;

insert into public.providers (id, name) values ('00000000-0000-0000-0000-000000003101', 'LI Provider') on conflict do nothing;
insert into public.courses (id, name, provider_id)
  values ('31c00000-0000-0000-0000-000000000001', 'LI Course', '00000000-0000-0000-0000-000000003101') on conflict do nothing;
insert into public.certificates (id, name, kind, provider_id) values
  ('31e00000-0000-0000-0000-000000000001', 'LI Exam', 'exam', '00000000-0000-0000-0000-000000003101') on conflict do nothing;
insert into public.certificates (id, name, kind, provider_id, course_id) values
  ('31e00000-0000-0000-0000-000000000002', 'LI Completion', 'completion', '00000000-0000-0000-0000-000000003101',
   '31c00000-0000-0000-0000-000000000001') on conflict do nothing;

-- Items of member 2 (team A) and member 3 (team B), written as a trusted writer.
insert into public.learning_items (id, member_id, course_id) values
  ('31b00000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000002', '31c00000-0000-0000-0000-000000000001'),
  ('31b00000-0000-0000-0000-000000000003', '31000000-0000-0000-0000-000000000003', '31c00000-0000-0000-0000-000000000001');

select has_table('public', 'learning_items', 'learning_items exists');
select has_view('public', 'v_learning_items', 'v_learning_items exists');

-- Member 1 writes their own items.
select pg_temp.login_as('31a00000-0000-0000-0000-000000000001');
select is(pg_temp.rows_changed($q$insert into public.learning_items (member_id, course_id)
  values ('31000000-0000-0000-0000-000000000001', '31c00000-0000-0000-0000-000000000001')$q$), 1,
  'member adds a course item');
select is(pg_temp.rows_changed($q$insert into public.learning_items (member_id, target_certificate_id, planned_date)
  values ('31000000-0000-0000-0000-000000000001', '31e00000-0000-0000-0000-000000000001', '2027-01-15')$q$), 1,
  'member adds a self-study item for an exam');
select is(pg_temp.rows_changed($q$insert into public.learning_items (id, member_id, course_id, target_certificate_id)
  values ('31b00000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001',
          '31c00000-0000-0000-0000-000000000001', '31e00000-0000-0000-0000-000000000001')$q$), 1,
  'member adds an item with both a course and an exam');
select throws_ok($q$insert into public.learning_items (member_id) values ('31000000-0000-0000-0000-000000000001')$q$,
  '23514', null, 'an item needs a course or an exam');
select throws_ok($q$insert into public.learning_items (member_id, target_certificate_id)
  values ('31000000-0000-0000-0000-000000000001', '31e00000-0000-0000-0000-000000000002')$q$,
  '23514', null, 'the target must be an exam, not a completion');
select throws_ok($q$update public.learning_items set status = 'done' where id = '31b00000-0000-0000-0000-000000000001'$q$,
  '23514', null, 'done needs a finished date');
select throws_ok($q$update public.learning_items set status = 'done', finished_date = public.vn_today() + 1
  where id = '31b00000-0000-0000-0000-000000000001'$q$,
  '23514', null, 'finished date cannot be in the future');
update public.learning_items set status = 'done', finished_date = public.vn_today()
  where id = '31b00000-0000-0000-0000-000000000001';
select is((select progress from public.learning_items where id = '31b00000-0000-0000-0000-000000000001'), 100,
  'done sets progress to 100');
select is((select count(*)::int from public.learning_items where member_id = '31000000-0000-0000-0000-000000000002'), 0,
  'member cannot read another member''s items');
select is(pg_temp.rows_changed($q$update public.learning_items set progress = 50
  where id = '31b00000-0000-0000-0000-000000000002'$q$), 0,
  'member cannot update another member''s item');
select throws_ok($q$update public.learning_items set member_id = '31000000-0000-0000-0000-000000000002'
  where id = '31b00000-0000-0000-0000-000000000001'$q$,
  '42501', null, 'member cannot move an item to another member');
select pg_temp.logout();

-- Manager in scope (team A) but not team B; admin everything.
select pg_temp.login_as('31a00000-0000-0000-0000-00000000000b');
select is(pg_temp.rows_changed($q$update public.learning_items set progress = 40
  where id = '31b00000-0000-0000-0000-000000000002'$q$), 1, 'manager updates an item in scope');
select is(pg_temp.rows_changed($q$update public.learning_items set progress = 40
  where id = '31b00000-0000-0000-0000-000000000003'$q$), 0, 'manager cannot update an item outside scope');
select pg_temp.logout();

select pg_temp.login_as('31a00000-0000-0000-0000-00000000000a');
select is(pg_temp.rows_changed($q$delete from public.learning_items
  where id = '31b00000-0000-0000-0000-000000000003'$q$), 1, 'admin deletes any item');
select pg_temp.logout();

select * from finish();
rollback;
