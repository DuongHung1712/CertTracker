begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

create function pg_temp.login_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

-- Runs a statement and returns how many rows it touched. RLS hides rows from UPDATE/DELETE
-- silently, so "denied" shows up as 0 affected rows rather than an error.
create function pg_temp.affected(q text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute q;
  get diagnostics n = row_count;
  return n;
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

-- Evidence objects, seeded as the table owner (RLS does not apply to it).
insert into storage.objects (bucket_id, name) values
  ('certificates', 'aaaaaaaa-0000-0000-0000-000000000001/eeeeeeee-0000-0000-0000-00000000000a/a.pdf'),
  ('certificates', 'bbbbbbbb-0000-0000-0000-000000000002/eeeeeeee-0000-0000-0000-00000000000b/b.pdf');

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
-- Storage policies, as the manager of Team A (Member A is managed, Member B is not).
-- Direct deletes are blocked by storage.protect_delete() unless this flag is set (the Storage API sets it).
select set_config('storage.allow_delete_query', 'true', true);
select lives_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('certificates', 'aaaaaaaa-0000-0000-0000-000000000001/eeeeeeee-0000-0000-0000-00000000000a/m.pdf')$$,
  'manager can upload evidence for a managed member');
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('certificates', 'bbbbbbbb-0000-0000-0000-000000000002/eeeeeeee-0000-0000-0000-00000000000b/m.pdf')$$,
  '42501', null, 'manager cannot upload evidence for another team''s member');
select results_eq(
  $$select name from storage.objects where bucket_id = 'certificates' order by name$$,
  array['aaaaaaaa-0000-0000-0000-000000000001/eeeeeeee-0000-0000-0000-00000000000a/a.pdf'::text,
        'aaaaaaaa-0000-0000-0000-000000000001/eeeeeeee-0000-0000-0000-00000000000a/m.pdf'],
  'manager sees only the managed member''s evidence');
select is(
  pg_temp.affected($$update storage.objects set metadata = '{"by":"manager"}'
    where name like 'aaaaaaaa-%/m.pdf'$$),
  1::bigint, 'manager can update managed member evidence');
select is(
  pg_temp.affected($$update storage.objects set metadata = '{"by":"manager"}'
    where name like 'bbbbbbbb-%'$$),
  0::bigint, 'manager cannot update another team''s evidence');
select throws_ok(
  $$update storage.objects set name = 'bbbbbbbb-0000-0000-0000-000000000002/eeeeeeee-0000-0000-0000-00000000000b/m.pdf'
    where name like 'aaaaaaaa-%/m.pdf'$$,
  '42501', null, 'manager cannot move evidence into another team''s folder');
select is(
  pg_temp.affected($$delete from storage.objects where name like 'bbbbbbbb-%'$$),
  0::bigint, 'manager cannot delete another team''s evidence');
select is(
  pg_temp.affected($$delete from storage.objects where name like 'aaaaaaaa-%/m.pdf'$$),
  1::bigint, 'manager can delete managed member evidence');
reset role;

-- Member A
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000c');
select results_eq(
  $$select member_name from public.v_training_records$$,
  array['Member A'::text], 'member sees only own row through the extended view');
select ok(public.can_access_evidence('aaaaaaaa-0000-0000-0000-000000000001/x/a.pdf'), 'member can access own evidence');
select ok(not coalesce(public.can_access_evidence('bbbbbbbb-0000-0000-0000-000000000002/x/a.pdf'), false), 'member cannot access someone else''s evidence');
select ok(not coalesce(public.can_access_evidence('not-a-uuid/x/a.pdf'), false), 'a malformed object name is denied, not an error');
-- Storage policies, as Member A.
select set_config('storage.allow_delete_query', 'true', true);
select lives_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('certificates', 'aaaaaaaa-0000-0000-0000-000000000001/eeeeeeee-0000-0000-0000-00000000000a/n.pdf')$$,
  'member can upload evidence into their own folder');
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('certificates', 'bbbbbbbb-0000-0000-0000-000000000002/eeeeeeee-0000-0000-0000-00000000000b/n.pdf')$$,
  '42501', null, 'member cannot upload evidence into another member''s folder');
select results_eq(
  $$select name from storage.objects where bucket_id = 'certificates' order by name$$,
  array['aaaaaaaa-0000-0000-0000-000000000001/eeeeeeee-0000-0000-0000-00000000000a/a.pdf'::text,
        'aaaaaaaa-0000-0000-0000-000000000001/eeeeeeee-0000-0000-0000-00000000000a/n.pdf'],
  'member sees only their own evidence');
select is(
  pg_temp.affected($$update storage.objects set metadata = '{"by":"member"}'
    where name like 'aaaaaaaa-%/n.pdf'$$),
  1::bigint, 'member can update their own evidence');
select is(
  pg_temp.affected($$update storage.objects set metadata = '{"by":"member"}'
    where name like 'bbbbbbbb-%'$$),
  0::bigint, 'member cannot update another member''s evidence');
select throws_ok(
  $$update storage.objects set name = 'bbbbbbbb-0000-0000-0000-000000000002/eeeeeeee-0000-0000-0000-00000000000b/n.pdf'
    where name like 'aaaaaaaa-%/n.pdf'$$,
  '42501', null, 'member cannot move evidence into another member''s folder');
select is(
  pg_temp.affected($$delete from storage.objects where name like 'bbbbbbbb-%'$$),
  0::bigint, 'member cannot delete another member''s evidence');
select is(
  pg_temp.affected($$delete from storage.objects where name like 'aaaaaaaa-%/n.pdf'$$),
  1::bigint, 'member can delete their own evidence');
reset role;

-- Admin
select pg_temp.login_as('a0000000-0000-0000-0000-00000000000a');
select ok(public.can_access_evidence('bbbbbbbb-0000-0000-0000-000000000002/x/a.pdf'), 'admin can access any evidence');
-- Storage policies, as the admin.
select set_config('storage.allow_delete_query', 'true', true);
select lives_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('certificates', 'bbbbbbbb-0000-0000-0000-000000000002/eeeeeeee-0000-0000-0000-00000000000b/z.pdf')$$,
  'admin can upload evidence for any member');
select is(
  (select count(*) from storage.objects where bucket_id = 'certificates'),
  3::bigint, 'admin sees every member''s evidence');
select is(
  pg_temp.affected($$update storage.objects set metadata = '{"by":"admin"}'
    where name like 'bbbbbbbb-%/z.pdf'$$),
  1::bigint, 'admin can update any evidence');
select is(
  pg_temp.affected($$delete from storage.objects where name like 'bbbbbbbb-%/z.pdf'$$),
  1::bigint, 'admin can delete any evidence');
reset role;

-- Denied writes left the other users' objects untouched.
select is(
  (select count(*) from storage.objects
    where bucket_id = 'certificates' and name like 'bbbbbbbb-%/b.pdf' and metadata is null),
  1::bigint, 'denied updates and deletes left the other team''s evidence unchanged');

-- Anonymous (clear the claims left behind by the previous login_as call)
select set_config('request.jwt.claims', '', true);
set local role anon;
select ok(not coalesce(public.can_access_evidence('aaaaaaaa-0000-0000-0000-000000000001/x/a.pdf'), false), 'anon cannot access evidence');
select is(
  (select count(*) from storage.objects where bucket_id = 'certificates'),
  0::bigint, 'anon sees no evidence objects');
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('certificates', 'aaaaaaaa-0000-0000-0000-000000000001/eeeeeeee-0000-0000-0000-00000000000a/anon.pdf')$$,
  '42501', null, 'anon cannot upload evidence');
reset role;

select * from finish();
rollback;
