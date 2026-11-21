begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

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

create function pg_temp.rows_changed(q text) returns int language plpgsql as $$
declare n int;
begin
  execute q;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Setup test entities
insert into public.dcs (id, name) values ('00000000-0000-0000-0000-0000000000d2', 'Del DC') on conflict do nothing;
insert into public.programs (id, name, dc_id)
  values ('00000000-0000-0000-0000-0000000000f2', 'Del Program', '00000000-0000-0000-0000-0000000000d2') on conflict do nothing;
insert into public.teams (id, name, program_id) values
  ('12121212-1111-1111-1111-111111111111', 'Del Team A', '00000000-0000-0000-0000-0000000000f2') on conflict do nothing;
insert into public.members (id, full_name, email, team_id, is_active) values
  ('bbaaaaaa-0000-0000-0000-000000000001', 'Member One', 'm1@test.local', '12121212-1111-1111-1111-111111111111', true),
  ('bbaaaaaa-0000-0000-0000-000000000002', 'Member Two', 'm2@test.local', '12121212-1111-1111-1111-111111111111', true) on conflict do nothing;
insert into auth.users (id, email) values
  ('b0000000-0000-0000-0000-000000000001', 'm1@test.local'),
  ('b0000000-0000-0000-0000-000000000002', 'm2@test.local') on conflict do nothing;
update public.profiles set role = 'member' where user_id in ('b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002');

insert into public.providers (id, name) values ('00000000-0000-0000-0000-000000000001', 'Provider T') on conflict do nothing;
insert into public.certificates (id, name, kind, provider_id)
  values ('c0000000-0000-0000-0000-000000000001', 'Test Cert A', 'exam', '00000000-0000-0000-0000-000000000001') on conflict do nothing;

-- 1. Test member deleting not_started record
insert into public.training_records (id, member_id, certificate_id, status, progress)
  values ('f1111111-0000-0000-0000-000000000001', 'bbaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'not_started', 0);

select pg_temp.login_as('b0000000-0000-0000-0000-000000000001');
select is(pg_temp.rows_changed('delete from public.training_records where id = ''f1111111-0000-0000-0000-000000000001'''), 1,
  'Member can delete their own not_started record');
select pg_temp.logout();

-- 2. Test member deleting in_progress record
insert into public.training_records (id, member_id, certificate_id, status, progress)
  values ('f1111111-0000-0000-0000-000000000002', 'bbaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'in_progress', 30);

select pg_temp.login_as('b0000000-0000-0000-0000-000000000001');
select is(pg_temp.rows_changed('delete from public.training_records where id = ''f1111111-0000-0000-0000-000000000002'''), 1,
  'Member can delete their own in_progress record');
select pg_temp.logout();

-- 3. Test member deleting returned record
insert into public.training_records (id, member_id, certificate_id, status, progress, issued_date, approval, approval_note)
  values ('f1111111-0000-0000-0000-000000000003', 'bbaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'done', 100, '2026-01-01', 'returned', 'Wrong date');

select pg_temp.login_as('b0000000-0000-0000-0000-000000000001');
select is(pg_temp.rows_changed('delete from public.training_records where id = ''f1111111-0000-0000-0000-000000000003'''), 1,
  'Member can delete their own returned record');
select pg_temp.logout();

-- 4. Test member cannot delete approved record
insert into public.training_records (id, member_id, certificate_id, status, progress, issued_date, approval)
  values ('f1111111-0000-0000-0000-000000000004', 'bbaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'done', 100, '2026-01-01', 'approved');

select pg_temp.login_as('b0000000-0000-0000-0000-000000000001');
select is(pg_temp.rows_changed('delete from public.training_records where id = ''f1111111-0000-0000-0000-000000000004'''), 0,
  'Member cannot delete their own approved record');
select pg_temp.logout();

-- 5. Test member cannot delete waiting record
insert into public.training_records (id, member_id, certificate_id, status, progress, issued_date, approval)
  values ('f1111111-0000-0000-0000-000000000005', 'bbaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'done', 100, '2026-02-01', 'waiting');

select pg_temp.login_as('b0000000-0000-0000-0000-000000000001');
select is(pg_temp.rows_changed('delete from public.training_records where id = ''f1111111-0000-0000-0000-000000000005'''), 0,
  'Member cannot delete their own waiting record');
select pg_temp.logout();

-- 6. Test member cannot delete other member''s draft record
insert into public.training_records (id, member_id, certificate_id, status, progress)
  values ('f1111111-0000-0000-0000-000000000006', 'bbaaaaaa-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'not_started', 0);

select pg_temp.login_as('b0000000-0000-0000-0000-000000000001');
select is(pg_temp.rows_changed('delete from public.training_records where id = ''f1111111-0000-0000-0000-000000000006'''), 0,
  'Member cannot delete other member draft record');
select pg_temp.logout();

-- 7. Test member proposing pending certificate
select pg_temp.login_as('b0000000-0000-0000-0000-000000000001');
select is(pg_temp.rows_changed('insert into public.certificates (id, name, kind, proposed_by, catalogue_status, proposed_provider) values (''c0000000-0000-0000-0000-000000000099'', ''Prop Cert'', ''exam'', ''bbaaaaaa-0000-0000-0000-000000000001'', ''pending'', ''Prop Provider'')'), 1,
  'Member can insert pending certificate proposal');

-- 8. Test member cannot directly insert approved certificate
select throws_ok('insert into public.certificates (name, kind, catalogue_status) values (''Bad Cert'', ''exam'', ''approved'')',
  '42501', null,
  'Member cannot directly insert approved certificate');
select pg_temp.logout();

select * from finish();
rollback;
