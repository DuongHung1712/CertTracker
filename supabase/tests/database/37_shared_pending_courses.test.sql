begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

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

create function pg_temp.visible(course uuid) returns int language sql as $$
  select count(*)::int from public.courses where id = course
$$;

insert into public.dcs (id, name) values ('00000000-0000-0000-0000-0000000037d1', 'SP DC') on conflict do nothing;
insert into public.programs (id, name, dc_id)
  values ('00000000-0000-0000-0000-0000000037f1', 'SP Program', '00000000-0000-0000-0000-0000000037d1') on conflict do nothing;
insert into public.teams (id, name, program_id)
  values ('37373737-0000-0000-0000-00000000000a', 'SP Team', '00000000-0000-0000-0000-0000000037f1') on conflict do nothing;
insert into public.members (id, full_name, email, team_id, is_active) values
  ('37000000-0000-0000-0000-000000000001', 'SP Member One', 'sp1@test.local', '37373737-0000-0000-0000-00000000000a', true),
  ('37000000-0000-0000-0000-000000000002', 'SP Member Two', 'sp2@test.local', '37373737-0000-0000-0000-00000000000a', true)
  on conflict do nothing;
insert into auth.users (id, email) values
  ('37a00000-0000-0000-0000-000000000001', 'sp1@test.local'),
  ('37a00000-0000-0000-0000-000000000002', 'sp2@test.local'),
  ('37a00000-0000-0000-0000-00000000000b', 'spmanager@test.local'),
  ('37a00000-0000-0000-0000-00000000000a', 'spadmin@test.local') on conflict do nothing;
update public.profiles set role = 'member' where user_id in ('37a00000-0000-0000-0000-000000000001', '37a00000-0000-0000-0000-000000000002');
-- A manager with no scope: sees shared pending courses, not other teams' rejected ones.
update public.profiles set role = 'manager' where user_id = '37a00000-0000-0000-0000-00000000000b';
update public.profiles set role = 'admin' where user_id = '37a00000-0000-0000-0000-00000000000a';

insert into public.courses (id, name, catalogue_status, proposed_by) values
  ('37c00000-0000-0000-0000-000000000001', 'SP AWS Cloud Course', 'pending', '37000000-0000-0000-0000-000000000001'),
  ('37c00000-0000-0000-0000-000000000002', 'SP Rejected Course', 'rejected', '37000000-0000-0000-0000-000000000001');

select pg_temp.login_as('37a00000-0000-0000-0000-000000000002');
select is(pg_temp.visible('37c00000-0000-0000-0000-000000000001'), 1, 'member sees a pending course another member proposed');
select is(pg_temp.visible('37c00000-0000-0000-0000-000000000002'), 0, 'member does not see another member''s rejected course');
select lives_ok($q$insert into public.learning_items (member_id, course_id)
  values ('37000000-0000-0000-0000-000000000002', '37c00000-0000-0000-0000-000000000001')$q$,
  'member tracks a course another member proposed');
select throws_ok($q$insert into public.courses (name, catalogue_status, proposed_by)
  values ('  sp aws cloud COURSE ', 'pending', '37000000-0000-0000-0000-000000000002')$q$,
  '23505', null, 'member cannot propose a course that is already pending (case and spaces ignored)');
select lives_ok($q$insert into public.courses (name, catalogue_status, proposed_by)
  values ('SP Rejected Course', 'pending', '37000000-0000-0000-0000-000000000002')$q$,
  'a rejected name can be proposed again');
select pg_temp.logout();

-- Catalogue fields on a proposal are the admin's (column guard).
insert into public.providers (id, name) values ('00000000-0000-0000-0000-000000003701', 'SP Provider') on conflict do nothing;
select pg_temp.login_as('37a00000-0000-0000-0000-000000000001');
select throws_ok($q$insert into public.courses (name, catalogue_status, proposed_by, provider_id)
  values ('SP Sneaky Provider', 'pending', '37000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000003701')$q$,
  '42501', null, 'member cannot set the provider on a proposal');
select throws_ok($q$update public.courses set cost = 100 where id = '37c00000-0000-0000-0000-000000000001'$q$,
  '42501', null, 'member cannot set the cost on their pending course');
select throws_ok($q$update public.courses set reviewed_at = now() where id = '37c00000-0000-0000-0000-000000000001'$q$,
  '42501', null, 'member cannot stamp a review on their pending course');
select lives_ok($q$update public.courses set name = 'SP AWS Cloud Course v2', proposed_provider = 'AWS'
  where id = '37c00000-0000-0000-0000-000000000001'$q$,
  'member renames their pending course and its typed provider');
select pg_temp.logout();

select pg_temp.login_as('37a00000-0000-0000-0000-00000000000b');
select is(pg_temp.visible('37c00000-0000-0000-0000-000000000001'), 1, 'manager sees a pending course');
select is(pg_temp.visible('37c00000-0000-0000-0000-000000000002'), 0, 'manager out of scope does not see a rejected course');
select pg_temp.logout();

select pg_temp.login_as('37a00000-0000-0000-0000-00000000000a');
select is(pg_temp.visible('37c00000-0000-0000-0000-000000000001'), 1, 'admin sees a pending course');
select is(pg_temp.visible('37c00000-0000-0000-0000-000000000002'), 1, 'admin sees a rejected course');
select pg_temp.logout();

select * from finish();
rollback;
