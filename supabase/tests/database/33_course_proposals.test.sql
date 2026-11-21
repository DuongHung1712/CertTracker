begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

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

insert into public.dcs (id, name) values ('00000000-0000-0000-0000-0000000033d1', 'CP DC') on conflict do nothing;
insert into public.programs (id, name, dc_id)
  values ('00000000-0000-0000-0000-0000000033f1', 'CP Program', '00000000-0000-0000-0000-0000000033d1') on conflict do nothing;
insert into public.teams (id, name, program_id)
  values ('33333333-0000-0000-0000-00000000000a', 'CP Team', '00000000-0000-0000-0000-0000000033f1') on conflict do nothing;
insert into public.members (id, full_name, email, team_id, is_active) values
  ('33000000-0000-0000-0000-000000000001', 'CP Member One', 'cp1@test.local', '33333333-0000-0000-0000-00000000000a', true),
  ('33000000-0000-0000-0000-000000000002', 'CP Member Two', 'cp2@test.local', '33333333-0000-0000-0000-00000000000a', true)
  on conflict do nothing;
insert into auth.users (id, email) values
  ('33a00000-0000-0000-0000-000000000001', 'cp1@test.local'),
  ('33a00000-0000-0000-0000-000000000002', 'cp2@test.local'),
  ('33a00000-0000-0000-0000-00000000000a', 'cpadmin@test.local') on conflict do nothing;
update public.profiles set role = 'member' where user_id in ('33a00000-0000-0000-0000-000000000001', '33a00000-0000-0000-0000-000000000002');
update public.profiles set role = 'admin' where user_id = '33a00000-0000-0000-0000-00000000000a';

select has_column('public', 'courses', 'catalogue_status', 'courses have a catalogue status');

select pg_temp.login_as('33a00000-0000-0000-0000-000000000001');
select is(pg_temp.rows_changed($q$insert into public.courses (id, name, proposed_provider, catalogue_status, proposed_by)
  values ('33c00000-0000-0000-0000-000000000001', 'CP Proposed Course', 'CP New Provider', 'pending',
          '33000000-0000-0000-0000-000000000001')$q$), 1, 'member proposes a pending course');
select throws_ok($q$insert into public.courses (name, catalogue_status, proposed_by)
  values ('CP Sneaky Course', 'approved', '33000000-0000-0000-0000-000000000001')$q$,
  '42501', null, 'member cannot add an approved course');
select is((select count(*)::int from public.courses where id = '33c00000-0000-0000-0000-000000000001'), 1,
  'member sees their own pending course');
select is(pg_temp.rows_changed($q$insert into public.learning_items (id, member_id, course_id)
  values ('33b00000-0000-0000-0000-000000000001', '33000000-0000-0000-0000-000000000001',
          '33c00000-0000-0000-0000-000000000001')$q$), 1, 'member tracks a pending course right away');
select throws_ok($q$select public.approve_course('33c00000-0000-0000-0000-000000000001', true)$q$,
  '42501', null, 'member cannot approve a course');
select pg_temp.logout();

select pg_temp.login_as('33a00000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.courses where id = '33c00000-0000-0000-0000-000000000001'), 1,
  'another member sees the pending course (shared right away)');
select pg_temp.logout();

select pg_temp.login_as('33a00000-0000-0000-0000-00000000000a');
select public.approve_course('33c00000-0000-0000-0000-000000000001', true);
select is(
  (select count(*)::int from public.certificates
    where course_id = '33c00000-0000-0000-0000-000000000001' and kind = 'completion' and name = 'CP Proposed Course'),
  1, 'approving creates one completion certificate named like the course');
select pg_temp.logout();

-- A second course, rejected: the learning item stays.
insert into public.courses (id, name, catalogue_status, proposed_by)
  values ('33c00000-0000-0000-0000-000000000002', 'CP Rejected Course', 'pending', '33000000-0000-0000-0000-000000000001');
insert into public.learning_items (id, member_id, course_id)
  values ('33b00000-0000-0000-0000-000000000002', '33000000-0000-0000-0000-000000000001', '33c00000-0000-0000-0000-000000000002');
select pg_temp.login_as('33a00000-0000-0000-0000-00000000000a');
select public.reject_course('33c00000-0000-0000-0000-000000000002');
select is((select catalogue_status from public.courses where id = '33c00000-0000-0000-0000-000000000002'), 'rejected',
  'admin rejects a proposal');
select pg_temp.logout();
select is((select count(*)::int from public.learning_items where id = '33b00000-0000-0000-0000-000000000002'), 1,
  'the learning item on a rejected course stays');

select * from finish();
rollback;
