begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

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
  ('39a00000-0000-0000-0000-000000000001', 'ai-member@test.local'),
  ('39a00000-0000-0000-0000-00000000000b', 'ai-manager@test.local'),
  ('39a00000-0000-0000-0000-00000000000a', 'ai-admin@test.local') on conflict do nothing;
update public.profiles set role = 'member' where user_id = '39a00000-0000-0000-0000-000000000001';
update public.profiles set role = 'manager' where user_id = '39a00000-0000-0000-0000-00000000000b';
update public.profiles set role = 'admin' where user_id = '39a00000-0000-0000-0000-00000000000a';

-- Calls the claim n times, one statement each: a set-returning call in FROM would be evaluated once and reused.
create function pg_temp.claim_n(n int, code text) returns int language plpgsql as $$
declare ok int := 0; r record;
begin
  for i in 1..n loop
    select * into r from public.claim_ai_call('certificate-reader', code);
    if r.refusal is null then ok := ok + 1; end if;
  end loop;
  return ok;
end;
$$;

-- The seeded flag is off: a claim is refused and leaves no row.
set local role service_role;
select is((select refusal from public.claim_ai_call('certificate-reader', 'M900')), 'disabled', 'a claim is refused while the flag is off');
select is((select count(*)::int from public.ai_usage where member_code = 'M900'), 0, 'a refused claim leaves no row');
select is((select count(*)::int from public.claim_ai_call('no-such-feature', 'M900') where refusal = 'disabled'), 1, 'an unknown feature is refused as disabled');
reset role;

update public.ai_feature_flags set enabled = true where feature = 'certificate-reader';
set local role service_role;

select is(pg_temp.claim_n(10, 'M900'), 10, 'the first 10 claims of one member succeed');
select is((select refusal from public.claim_ai_call('certificate-reader', 'M900')), 'daily_limit', 'the 11th claim is refused with daily_limit');
select is((select count(*)::int from public.ai_usage where member_code = 'M900'), 10, 'the refused claim added no row');
select is((select refusal from public.claim_ai_call('certificate-reader', 'M901')), null, 'another member still succeeds');

-- Yesterday (Ho Chi Minh) does not count today.
insert into public.ai_usage (day, feature, member_code, outcome)
  select (now() at time zone 'Asia/Ho_Chi_Minh')::date - 1, 'certificate-reader', 'M902', 'ok' from generate_series(1, 10);
select is((select refusal from public.claim_ai_call('certificate-reader', 'M902')), null, 'rows from yesterday do not count');

-- finish_ai_call records the result.
create temp table claimed as select usage_id from public.claim_ai_call('certificate-reader', 'M903');
select public.finish_ai_call((select usage_id from claimed), 1450, 120, 579, 'ok');
select is(
  (select input_tokens || '/' || output_tokens || '/' || cost_micro_usd || '/' || outcome from public.ai_usage where id = (select usage_id from claimed)),
  '1450/120/579/ok', 'finish_ai_call stores tokens, cost and outcome');
select throws_ok($q$select public.finish_ai_call((select usage_id from claimed), 1, 1, 1, 'bogus')$q$, '23514', null, 'an unknown outcome is refused by the CHECK');
reset role;

-- Every role is refused: the tables have RLS and no policy, and nothing is granted to users.
select pg_temp.login_as('39a00000-0000-0000-0000-00000000000a');
select throws_ok($q$select * from public.ai_usage$q$, '42501', null, 'admin cannot read ai_usage');
select pg_temp.login_as('39a00000-0000-0000-0000-00000000000b');
select throws_ok($q$update public.ai_feature_flags set enabled = false$q$, '42501', null, 'manager cannot change the flag');
select pg_temp.login_as('39a00000-0000-0000-0000-000000000001');
select throws_ok($q$select * from public.claim_ai_call('certificate-reader', 'M904')$q$, '42501', null, 'a member cannot call claim_ai_call');
select pg_temp.logout();
set local role anon;
select throws_ok($q$select * from public.ai_feature_flags$q$, '42501', null, 'anon cannot read the flags');
reset role;

select * from finish();
rollback;
