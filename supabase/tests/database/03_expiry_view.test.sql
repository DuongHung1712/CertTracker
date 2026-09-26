begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- issued 2026-01-01 + 12 months => expires 2027-01-01
select is(public.expiry_status('2026-01-01', null, '2026-06-01'), 'No Expiry', 'null validity => No Expiry');
select is(public.expiry_status(null, 12, '2026-06-01'), 'N/A', 'null issued_date => N/A');
select is(public.expiry_status('2026-01-01', 12, date '2027-01-01' + 1), 'Expired', '-1 day => Expired');
select is(public.expiry_status('2026-01-01', 12, date '2027-01-01'), 'Expiring Soon', '0 days => Expiring Soon');
select is(public.expiry_status('2026-01-01', 12, date '2027-01-01' - 30), 'Expiring Soon', '30 days => Expiring Soon');
select is(public.expiry_status('2026-01-01', 12, date '2027-01-01' - 31), 'Expiring in 60d', '31 days => Expiring in 60d');
select is(public.expiry_status('2026-01-01', 12, date '2027-01-01' - 60), 'Expiring in 60d', '60 days => Expiring in 60d');
select is(public.expiry_status('2026-01-01', 12, date '2027-01-01' - 61), 'Active', '61 days => Active');

insert into public.members (id, full_name, email)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Member A', 'a@test.local');
insert into public.courses (id, name, validity_months) values
  ('cccccccc-0000-0000-0000-000000000001', 'Short cert', 1),
  ('cccccccc-0000-0000-0000-000000000002', 'Lifetime cert', null);
insert into public.training_records (id, member_id, course_id, status, progress, issued_date) values
  ('eeeeeeee-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-000000000001', 'done', 100, public.vn_today() - 10),
  ('eeeeeeee-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-000000000002', 'done', 100, public.vn_today() - 10);

select is(
  (select expiry_date from public.v_training_records where id = 'eeeeeeee-0000-0000-0000-00000000000a'),
  (public.vn_today() - 10 + interval '1 month')::date,
  'view computes expiry_date = issued_date + validity_months'
);

select is(
  (select expiry_status from public.v_training_records where id = 'eeeeeeee-0000-0000-0000-00000000000a'),
  'Expiring Soon',
  'view computes expiry_status against VN today'
);

select is(
  (select expiry_date from public.v_training_records where id = 'eeeeeeee-0000-0000-0000-00000000000b'),
  null,
  'no-expiry course has null expiry_date'
);

select ok(
  (select 'security_invoker=true' = any (reloptions) from pg_class
    where oid = 'public.v_training_records'::regclass),
  'v_training_records uses security_invoker'
);

select * from finish();
rollback;
