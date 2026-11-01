begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

create function pg_temp.login_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

insert into auth.users (id, email) values ('c5000000-0000-0000-0000-00000000000a', 'cost-admin@test.local');
update public.profiles set role = 'admin' where user_id = 'c5000000-0000-0000-0000-00000000000a';
insert into public.members (id, full_name, email)
  values ('c5000000-0000-0000-0000-000000000001', 'Cost Member', 'cost-member@test.local');
insert into public.providers (id, name) values ('c5000000-0000-0000-0000-0000000000d1', 'Cost Provider');

-- Every cost already in the database has a currency (the migration backfills VND); the seed has none without one.
select is(
  (select count(*) from public.courses where cost is not null and cost_currency is null),
  0::bigint, 'no course has a cost without a currency');

-- Check constraints
select throws_ok(
  $$insert into public.courses (name, provider_id, cost) values ('No Currency', 'c5000000-0000-0000-0000-0000000000d1', 100)$$,
  '23514', null, 'a cost without a currency is rejected');
select throws_ok(
  $$insert into public.courses (name, provider_id, cost_currency) values ('No Cost', 'c5000000-0000-0000-0000-0000000000d1', 'USD')$$,
  '23514', null, 'a currency without a cost is rejected');
select throws_ok(
  $$insert into public.courses (name, provider_id, cost, cost_currency) values ('Euro', 'c5000000-0000-0000-0000-0000000000d1', 100, 'EUR')$$,
  '23514', null, 'a currency other than VND or USD is rejected');
select lives_ok(
  $$insert into public.courses (id, name, provider_id, cost, cost_currency, est_hours)
    values ('c5000000-0000-0000-0000-0000000000c1', 'Priced', 'c5000000-0000-0000-0000-0000000000d1', 150, 'USD', 40)$$,
  'a cost with USD is accepted');
select lives_ok(
  $$insert into public.courses (id, name, provider_id) values ('c5000000-0000-0000-0000-0000000000c2', 'Free', 'c5000000-0000-0000-0000-0000000000d1')$$,
  'no cost and no currency is accepted');
select lives_ok(
  $$update public.courses set cost = null, cost_currency = null where id = 'c5000000-0000-0000-0000-0000000000c1'$$,
  'clearing both is accepted');
select throws_ok(
  $$update public.courses set cost = 5 where id = 'c5000000-0000-0000-0000-0000000000c1'$$,
  '23514', null, 'setting a cost on a course without a currency is rejected');

-- The record list view carries the course cost, currency and hours (the export reads them)
insert into public.courses (id, name, provider_id, cost, cost_currency, est_hours)
  values ('c5000000-0000-0000-0000-0000000000c3', 'Viewed', 'c5000000-0000-0000-0000-0000000000d1', 3500000, 'VND', 12);
insert into public.training_records (member_id, course_id, status, progress)
  values ('c5000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-0000000000c3', 'not_started', 0);
select results_eq(
  $$select cost, cost_currency, est_hours from public.v_training_records where course_id = 'c5000000-0000-0000-0000-0000000000c3'$$,
  $$values (3500000.00::numeric, 'VND'::text, 12)$$,
  'v_training_records exposes cost, cost_currency and est_hours');

-- commit_import: a new course carries cost, currency and hours; one without them stays empty
insert into public.import_batches (id, file_name, expected_rows) values ('c5b00000-0000-0000-0000-000000000001', 'cost.xlsx', 2);
insert into public.import_rows (batch_id, row_no, raw, action, normalized) values
  ('c5b00000-0000-0000-0000-000000000001', 2, '{}', 'create',
   '{"member":{"id":"c5000000-0000-0000-0000-000000000001"},
     "course":{"name":"Imported Priced","provider":{"name":"Cost Provider"},"certType":null,"validityMonths":12,
               "cost":150,"costCurrency":"USD","estHours":40},
     "record":{"status":"not_started","progress":0,"plannedExamDate":null,"issuedDate":null,"certificateUrl":null,
               "viaCompany":null,"refundStatus":null,"notes":null}}'),
  ('c5b00000-0000-0000-0000-000000000001', 3, '{}', 'create',
   '{"member":{"id":"c5000000-0000-0000-0000-000000000001"},
     "course":{"name":"Imported Plain","provider":{"name":"Cost Provider"},"certType":null,"validityMonths":null},
     "record":{"status":"not_started","progress":0,"plannedExamDate":null,"issuedDate":null,"certificateUrl":null,
               "viaCompany":null,"refundStatus":null,"notes":null}}');
select pg_temp.login_as('c5000000-0000-0000-0000-00000000000a');
select lives_ok($$select public.commit_import('c5b00000-0000-0000-0000-000000000001')$$, 'the import commits');
reset role;
select results_eq(
  $$select cost, cost_currency, est_hours from public.courses where name = 'Imported Priced'$$,
  $$values (150.00::numeric, 'USD'::text, 40)$$,
  'a new course from the import has cost 150, USD and 40 hours');
select results_eq(
  $$select cost, cost_currency, est_hours from public.courses where name = 'Imported Plain'$$,
  $$values (null::numeric, null::text, null::int)$$,
  'a new course without those columns has no cost, currency or hours');

select * from finish();
rollback;
