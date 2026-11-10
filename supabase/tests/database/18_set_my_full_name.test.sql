begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

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

-- Fixtures (as postgres). Two members; one linked user, one user with no member.
insert into public.dcs (id, name) values ('f1000000-0000-0000-0000-0000000000d1', 'FN DC');
insert into public.programs (id, name, dc_id)
  values ('f1000000-0000-0000-0000-0000000000f1', 'FN Program', 'f1000000-0000-0000-0000-0000000000d1');
insert into public.teams (id, name, program_id)
  values ('f1000000-0000-0000-0000-00000000a001', 'FN Team', 'f1000000-0000-0000-0000-0000000000f1');
insert into public.members (id, full_name, email, team_id) values
  ('f1000000-0000-0000-0000-00000000c001', 'FN Member A', 'fn-a@test.local', 'f1000000-0000-0000-0000-00000000a001'),
  ('f1000000-0000-0000-0000-00000000c002', 'FN Member B', 'fn-b@test.local', 'f1000000-0000-0000-0000-00000000a001');
insert into auth.users (id, email, email_confirmed_at) values
  ('f1000000-0000-0000-0000-00000000f00c', 'fn-user@test.local', now()),
  ('f1000000-0000-0000-0000-00000000f00d', 'fn-nolink@test.local', now());
update public.profiles set member_id = 'f1000000-0000-0000-0000-00000000c001'
  where user_id = 'f1000000-0000-0000-0000-00000000f00c';

select pg_temp.login_as('f1000000-0000-0000-0000-00000000f00c');
select public.set_my_full_name('  New Name  ');
select pg_temp.logout();

select is((select full_name from public.members where id = 'f1000000-0000-0000-0000-00000000c001'),
  'New Name', 'the name is trimmed and stored on the caller''s own row');
select is((select full_name from public.members where id = 'f1000000-0000-0000-0000-00000000c002'),
  'FN Member B', 'another member''s name is unchanged');
select is(
  (select row(email, team_id, career_role_id)::text from public.members where id = 'f1000000-0000-0000-0000-00000000c001'),
  row('fn-a@test.local'::extensions.citext, 'f1000000-0000-0000-0000-00000000a001'::uuid, null::uuid)::text,
  'email, team and career role are unchanged');

select pg_temp.login_as('f1000000-0000-0000-0000-00000000f00c');
select throws_ok($$select public.set_my_full_name('')$$, 'P0001', 'name is required', 'an empty name is refused');
select throws_ok($$select public.set_my_full_name('   ')$$, 'P0001', 'name is required', 'a blank name is refused');
select throws_ok($$select public.set_my_full_name(repeat('x', 201))$$, 'P0001', 'name is too long', '201 characters are refused');
select lives_ok($$select public.set_my_full_name(repeat('x', 200))$$, '200 characters are accepted');

select pg_temp.login_as('f1000000-0000-0000-0000-00000000f00d');
select throws_ok($$select public.set_my_full_name('Anyone')$$, 'P0001', 'no member profile for this user',
  'a user with no member is refused');

select pg_temp.logout();
set local role anon;
select throws_ok($$select public.set_my_full_name('Anon')$$, '42501', null, 'anon cannot execute it');

select * from finish();
rollback;
