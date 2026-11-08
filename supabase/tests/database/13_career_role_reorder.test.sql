begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

create function pg_temp.login_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

insert into auth.users (id, email, email_confirmed_at) values
  ('c2000000-0000-0000-0000-00000000f00a', 'rr-admin@test.local', now()),
  ('c2000000-0000-0000-0000-00000000f001', 'rr-mgr@test.local', now());
update public.profiles set role = 'admin' where user_id = 'c2000000-0000-0000-0000-00000000f00a';
update public.profiles set role = 'manager' where user_id = 'c2000000-0000-0000-0000-00000000f001';

-- ===== admin =====
select pg_temp.login_as('c2000000-0000-0000-0000-00000000f00a');
select lives_ok(
  $$select public.move_career_role((select id from public.career_roles where name = 'Team Lead'), 'up')$$,
  'admin moves a role up');
select is((select array_agg(name order by sort_order) from public.career_roles),
  array['Engineer', 'Team Lead', 'Senior Engineer', 'Project Manager'],
  'the role swapped places with the one above');
select lives_ok(
  $$select public.move_career_role((select id from public.career_roles where name = 'Team Lead'), 'down')$$,
  'admin moves a role down');
select is((select array_agg(name order by sort_order) from public.career_roles),
  array['Engineer', 'Senior Engineer', 'Team Lead', 'Project Manager'],
  'moving down restores the order');
select lives_ok(
  $$select public.move_career_role((select id from public.career_roles where name = 'Engineer'), 'up')$$,
  'moving the first role up is a no-op, not an error');
select lives_ok(
  $$select public.move_career_role((select id from public.career_roles where name = 'Project Manager'), 'down')$$,
  'moving the last role down is a no-op, not an error');
select is((select array_agg(name order by sort_order) from public.career_roles),
  array['Engineer', 'Senior Engineer', 'Team Lead', 'Project Manager'],
  'no-ops leave the order unchanged');
select throws_ok(
  $$select public.move_career_role((select id from public.career_roles where name = 'Engineer'), 'sideways')$$,
  'P0001', null, 'an unknown direction is rejected');

-- ===== manager =====
select pg_temp.logout();
select pg_temp.login_as('c2000000-0000-0000-0000-00000000f001');
select throws_ok(
  $$select public.move_career_role((select id from public.career_roles where name = 'Team Lead'), 'up')$$,
  '42501', null, 'a manager cannot reorder roles');

-- ===== anon has no execute =====
select pg_temp.logout();
select pg_temp.login_as('c2000000-0000-0000-0000-00000000f001');
select is((select array_agg(name order by sort_order) from public.career_roles),
  array['Engineer', 'Senior Engineer', 'Team Lead', 'Project Manager'],
  'the failed manager call changed nothing');
select pg_temp.logout();
select ok(not has_function_privilege('anon', 'public.move_career_role(uuid, text)', 'execute'),
  'anon cannot execute move_career_role');

select * from finish();
rollback;
