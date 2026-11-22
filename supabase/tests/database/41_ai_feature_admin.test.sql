begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

create function pg_temp.login_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create function pg_temp.logout() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '{}', true);
end;
$$;

insert into auth.users (id, email) values
  ('41a00000-0000-0000-0000-000000000001', 'aiadm-member@test.local'),
  ('41a00000-0000-0000-0000-00000000000b', 'aiadm-manager@test.local'),
  ('41a00000-0000-0000-0000-00000000000a', 'aiadm-admin@test.local') on conflict do nothing;
update public.profiles set role = 'member' where user_id = '41a00000-0000-0000-0000-000000000001';
update public.profiles set role = 'manager' where user_id = '41a00000-0000-0000-0000-00000000000b';
update public.profiles set role = 'admin' where user_id = '41a00000-0000-0000-0000-00000000000a';

-- Known state: flag off, limit 10, no usage today; one row from yesterday that must not count.
update public.ai_feature_flags set enabled = false, daily_limit = 10 where feature = 'certificate-reader';
delete from public.ai_usage;
insert into public.ai_usage (day, feature, member_code, outcome) values
  ((now() at time zone 'Asia/Ho_Chi_Minh')::date - 1, 'certificate-reader', 'M941', 'ok');

select pg_temp.login_as('41a00000-0000-0000-0000-00000000000a');
select is((select enabled::text || '/' || daily_limit || '/' || calls_today from public.get_ai_feature('certificate-reader')), 'false/10/0',
  'admin reads the flag, the limit and today''s calls (yesterday does not count)');

select pg_temp.logout();
insert into public.ai_usage (day, feature, member_code, outcome) values
  ((now() at time zone 'Asia/Ho_Chi_Minh')::date, 'certificate-reader', 'M941', 'ok'),
  ((now() at time zone 'Asia/Ho_Chi_Minh')::date, 'certificate-reader', 'M942', 'timeout');
select pg_temp.login_as('41a00000-0000-0000-0000-00000000000a');
select is((select calls_today from public.get_ai_feature('certificate-reader')), 2, 'calls_today counts today''s rows of all members');

select lives_ok($q$select public.set_ai_feature('certificate-reader', true, 20)$q$, 'admin can switch the feature on and set the limit');
select is((select enabled::text || '/' || daily_limit from public.get_ai_feature('certificate-reader')), 'true/20', 'the change is stored');
select throws_ok($q$select public.set_ai_feature('no-such-feature', true, 5)$q$, 'P0002', null, 'an unknown feature is refused');
select throws_ok($q$select public.set_ai_feature('certificate-reader', true, 0)$q$, '23514', null, 'a limit of 0 is refused by the CHECK');
select is((select count(*)::int from public.get_ai_feature('no-such-feature')), 0, 'reading an unknown feature returns no row');

select pg_temp.login_as('41a00000-0000-0000-0000-00000000000b');
select throws_ok($q$select public.set_ai_feature('certificate-reader', false, 10)$q$, '42501', null, 'a manager cannot change the feature');
select throws_ok($q$select * from public.get_ai_feature('certificate-reader')$q$, '42501', null, 'a manager cannot read it either');

select pg_temp.login_as('41a00000-0000-0000-0000-000000000001');
select throws_ok($q$select public.set_ai_feature('certificate-reader', false, 10)$q$, '42501', null, 'a member cannot change the feature');
select throws_ok($q$select * from public.get_ai_feature('certificate-reader')$q$, '42501', null, 'a member cannot read it');

select pg_temp.logout();
set local role anon;
select throws_ok($q$select * from public.get_ai_feature('certificate-reader')$q$, '42501', null, 'anon cannot call it');
reset role;

select * from finish();
rollback;
