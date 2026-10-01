begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- The formatter pads to three digits and never truncates (lpad would turn 1000 into M100).
select is(public.format_member_code(1), 'M001', 'code 1 is M001');
select is(public.format_member_code(99), 'M099', 'code 99 is M099');
select is(public.format_member_code(999), 'M999', 'code 999 is M999');
select is(public.format_member_code(1000), 'M1000', 'code 1000 is M1000');
select is(public.format_member_code(1001), 'M1001', 'code 1001 is M1001');
select is(public.format_member_code(123456), 'M123456', 'long codes are not truncated');

-- The column default goes through the formatter, end to end.
select matches(
  (select pg_get_expr(d.adbin, d.adrelid)
     from pg_attrdef d
     join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
    where d.adrelid = 'public.members'::regclass and a.attname = 'code'),
  'next_member_code',
  'members.code defaults to next_member_code()');

insert into public.members (id, full_name, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Member A', 'a@test.local'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Member B', 'b@test.local');
select matches(
  (select code from public.members where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  '^M[0-9]{3,}$', 'a generated member code looks like Mnnn');
select isnt(
  (select code from public.members where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  (select code from public.members where id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  'consecutive members get different codes');

-- Bulk insert across the 999 -> 1000 boundary. A temporary sequence and table (dropped on
-- rollback) mirror the real column, so the real member_code_seq is never advanced by this test.
create temp sequence probe_seq;
create temp table probe (
  n int,
  code text not null unique default public.format_member_code(nextval('pg_temp.probe_seq'))
);
select lives_ok(
  $$insert into pg_temp.probe (n) select g from generate_series(1, 1100) g$$,
  '1100 rows in one statement do not violate the unique code');
select is((select count(distinct code) from pg_temp.probe), 1100::bigint, 'all 1100 codes are distinct');
select is((select max(code) from pg_temp.probe where n = 1100), 'M1100', 'the 1100th code is M1100');

select * from finish();
rollback;
