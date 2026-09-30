begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

create function pg_temp.login_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

insert into public.dcs (id, name) values ('00000000-0000-0000-0000-0000000000d1', 'Test DC');
insert into public.programs (id, name, dc_id)
  values ('00000000-0000-0000-0000-0000000000f1', 'Program 1', '00000000-0000-0000-0000-0000000000d1');
insert into public.teams (id, name, program_id) values
  ('11111111-1111-1111-1111-111111111111', 'Team A', '00000000-0000-0000-0000-0000000000f1'),
  ('22222222-2222-2222-2222-222222222222', 'Team B', '00000000-0000-0000-0000-0000000000f1');
insert into public.members (id, full_name, email, team_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Member A', 'a@test.local', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Member B', 'b@test.local', '22222222-2222-2222-2222-222222222222');
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'admin@test.local'),
  ('a0000000-0000-0000-0000-00000000000b', 'manager@test.local'),
  ('a0000000-0000-0000-0000-00000000000c', 'a@test.local');
update public.profiles set role = 'admin' where user_id = 'a0000000-0000-0000-0000-00000000000a';
update public.profiles set role = 'manager' where user_id = 'a0000000-0000-0000-0000-00000000000b';
insert into public.team_managers (team_id, user_id)
  values ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-00000000000b');
insert into public.providers (id, name) values ('dddddddd-0000-0000-0000-000000000001', 'Test Provider');
insert into public.cert_types (id, name) values ('dddddddd-0000-0000-0000-000000000002', 'Test Type');
insert into public.courses (id, name, validity_months, provider_id, cert_type_id) values
  ('cccccccc-0000-0000-0000-000000000001', 'Course 1', 36,
   'dddddddd-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000002');
insert into public.training_records (id, member_id, course_id, status, progress) values
  ('eeeeeeee-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-000000000001', 'in_progress', 50),
  ('eeeeeeee-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000002',
   'cccccccc-0000-0000-0000-000000000001', 'in_progress', 20);

-- Uniqueness
select throws_ok(
  $$insert into public.training_records (member_id, course_id)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001')$$,
  '23505', null, 'a member cannot have two records for the same course');

-- View columns
select is(
  (select member_name || '|' || team_name || '|' || provider_name || '|' || cert_type_name
     from public.v_training_records where id = 'eeeeeeee-0000-0000-0000-00000000000a'),
  'Member A|Team A|Test Provider|Test Type', 'view exposes member, team, provider and cert type names');
select ok(
  (select 'security_invoker=true' = any (reloptions) from pg_class
    where oid = 'public.v_training_records'::regclass),
  'view is still security_invoker after the replace');

-- Bucket, policies, realtime
select is((select public from storage.buckets where id = 'certificates'), false, 'certificates bucket is private');
select is((select file_size_limit from storage.buckets where id = 'certificates'), 4194304::bigint, 'bucket caps files at 4 MB');
select is(
  (select count(*) from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname like 'certificates:%'),
  4::bigint, 'four storage policies guard the certificates bucket');
select ok(
  exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'training_records'),
  'training_records is published to realtime');

-- Manager of Team A
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000b');
select results_eq(
  $$select member_name from public.v_training_records$$,
  array['Member A'::text], 'manager sees only managed-team rows through the extended view');
select ok(public.can_access_evidence('aaaaaaaa-0000-0000-0000-000000000001/x/a.pdf'), 'manager can access managed member evidence');
select ok(not coalesce(public.can_access_evidence('bbbbbbbb-0000-0000-0000-000000000002/x/a.pdf'), false), 'manager cannot access another team''s evidence');
reset role;

-- Member A
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000c');
select results_eq(
  $$select member_name from public.v_training_records$$,
  array['Member A'::text], 'member sees only own row through the extended view');
select ok(public.can_access_evidence('aaaaaaaa-0000-0000-0000-000000000001/x/a.pdf'), 'member can access own evidence');
select ok(not coalesce(public.can_access_evidence('bbbbbbbb-0000-0000-0000-000000000002/x/a.pdf'), false), 'member cannot access someone else''s evidence');
select ok(not coalesce(public.can_access_evidence('not-a-uuid/x/a.pdf'), false), 'a malformed object name is denied, not an error');
reset role;

-- Admin
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000a');
select ok(public.can_access_evidence('bbbbbbbb-0000-0000-0000-000000000002/x/a.pdf'), 'admin can access any evidence');
reset role;

-- Anonymous (clear the claims left behind by the previous login_as call)
select set_config('request.jwt.claims', '', true);
set local role anon;
select ok(not coalesce(public.can_access_evidence('aaaaaaaa-0000-0000-0000-000000000001/x/a.pdf'), false), 'anon cannot access evidence');
reset role;

select * from finish();
rollback;
