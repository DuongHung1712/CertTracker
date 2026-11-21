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

delete from public.training_records;
delete from public.members;

insert into public.dcs (id, name) values ('00000000-0000-0000-0000-0000000000d1', 'Renewal DC');
insert into public.programs (id, name, dc_id)
  values ('00000000-0000-0000-0000-0000000000f1', 'Renewal Program', '00000000-0000-0000-0000-0000000000d1');
insert into public.teams (id, name, program_id)
  values ('11111111-1111-1111-1111-111111111111', 'Team Renewal', '00000000-0000-0000-0000-0000000000f1');
insert into public.members (id, full_name, email, team_id, is_active) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Engineer One', 'eng1@test.local', '11111111-1111-1111-1111-111111111111', true);
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'admin@test.local'),
  ('a0000000-0000-0000-0000-00000000000c', 'eng1@test.local');
update public.profiles set role = 'admin' where user_id = 'a0000000-0000-0000-0000-00000000000a';

insert into public.providers (id, name) values ('eeeeeeee-0000-0000-0000-000000000001', 'Provider AWS');
insert into public.certificates (id, name, kind, provider_id, validity_months) values
  ('99999999-0000-0000-0000-000000000001', 'AWS SAA', 'exam', 'eeeeeeee-0000-0000-0000-000000000001', 36);

-- 1. Insert initial completed certification
insert into public.training_records (member_id, certificate_id, status, progress, issued_date, approval)
values ('aaaaaaaa-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000001', 'done', 100, '2023-01-15'::date, 'approved');

select is(
  (select count(*)::int from public.training_records where member_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  1,
  'Initial completed certificate is stored'
);

-- 2. Allow inserting an in_progress renewal record for the same certificate
insert into public.training_records (member_id, certificate_id, status, progress)
values ('aaaaaaaa-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000001', 'in_progress', 30);

select is(
  (select count(*)::int from public.training_records where member_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  2,
  'Engineer can declare in_progress renewal alongside past completed record'
);

-- 3. Reject a second active attempt for the same certificate (active unique index)
select throws_ok(
  $$insert into public.training_records (member_id, certificate_id, status, progress)
    values ('aaaaaaaa-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000001', 'not_started', 0)$$,
  '23505',
  null,
  'Duplicate active attempt for the same certificate is rejected'
);

-- 4. Delete active attempt, insert a second done record with a different issued_date (renewal cycle completion)
delete from public.training_records where status = 'in_progress';
insert into public.training_records (member_id, certificate_id, status, progress, issued_date, approval)
values ('aaaaaaaa-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000001', 'done', 100, '2026-01-15'::date, 'approved');

select is(
  (select count(*)::int from public.training_records where member_id = 'aaaaaaaa-0000-0000-0000-000000000001' and status = 'done'),
  2,
  'Multiple completed renewal cycles with distinct dates are preserved'
);

-- 5. Reject duplicate done record with the EXACT SAME issued date
select throws_ok(
  $$insert into public.training_records (member_id, certificate_id, status, progress, issued_date, approval)
    values ('aaaaaaaa-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000001', 'done', 100, '2026-01-15'::date, 'approved')$$,
  '23505',
  null,
  'Duplicate done record with same issued_date is rejected'
);

-- 6. Verify index existence
select has_index(
  'public', 'training_records', 'training_records_member_cert_active_idx',
  'training_records has partial unique index on active records'
);

select has_index(
  'public', 'training_records', 'training_records_member_cert_done_issued_idx',
  'training_records has partial unique index on done records by issued date'
);

rollback;
