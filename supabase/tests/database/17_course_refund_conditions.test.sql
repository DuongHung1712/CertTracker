begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

create function pg_temp.login_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

insert into auth.users (id, email) values
  ('c6000000-0000-0000-0000-00000000000a', 'rc-admin@test.local'),
  ('c6000000-0000-0000-0000-00000000000b', 'rc-manager@test.local'),
  ('c6000000-0000-0000-0000-00000000000c', 'rc-member@test.local');
update public.profiles set role = 'admin' where user_id = 'c6000000-0000-0000-0000-00000000000a';
update public.profiles set role = 'manager' where user_id = 'c6000000-0000-0000-0000-00000000000b';
insert into public.members (id, full_name, email)
  values ('c6000000-0000-0000-0000-000000000001', 'RC Member', 'rc-member-row@test.local');
insert into public.providers (id, name) values ('c6000000-0000-0000-0000-0000000000d1', 'RC Provider');
insert into public.courses (id, name, provider_id, refundable, refund_conditions)
  values ('c6000000-0000-0000-0000-0000000000c1', 'RC Course', 'c6000000-0000-0000-0000-0000000000d1', true, 'Pass within 6 months');

select has_column('public', 'courses', 'refund_conditions', 'courses has refund_conditions');

select pg_temp.login_as('c6000000-0000-0000-0000-00000000000a');
select throws_ok(
  format($$insert into public.courses (name, provider_id, refund_conditions) values ('Too Long', 'c6000000-0000-0000-0000-0000000000d1', %L)$$, repeat('x', 1001)),
  '23514', null, 'admin: 1001 characters of refund conditions are rejected');
select lives_ok(
  format($$update public.courses set refund_conditions = %L where id = 'c6000000-0000-0000-0000-0000000000c1'$$, repeat('x', 1000)),
  'admin: 1000 characters are accepted');

select pg_temp.login_as('c6000000-0000-0000-0000-00000000000b');
select results_eq(
  $$with u as (update public.courses set refund_conditions = 'hacked' where id = 'c6000000-0000-0000-0000-0000000000c1' returning 1) select count(*)::int from u$$,
  $$values (0)$$, 'manager: updating refund_conditions affects 0 rows');

select pg_temp.login_as('c6000000-0000-0000-0000-00000000000c');
select results_eq(
  $$with u as (update public.courses set refund_conditions = 'hacked' where id = 'c6000000-0000-0000-0000-0000000000c1' returning 1) select count(*)::int from u$$,
  $$values (0)$$, 'member: updating refund_conditions affects 0 rows');

reset role;
select is((select length(refund_conditions) from public.courses where id = 'c6000000-0000-0000-0000-0000000000c1'), 1000,
  'the refused updates left the admin value in place');
select lives_ok($$select * from public.v_training_records limit 1$$, 'v_training_records still selects');

select * from finish();
rollback;
