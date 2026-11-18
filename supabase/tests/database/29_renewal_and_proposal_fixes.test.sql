-- Migration 20261118000004: who sees a proposal, approve_certificate, renewed records count nowhere.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

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

delete from public.training_records;
delete from public.members;
insert into public.dcs (id, name) values ('00000000-0000-0000-0000-0000000000d9', 'Fix DC');
insert into public.programs (id, name, dc_id)
  values ('00000000-0000-0000-0000-0000000000f9', 'Fix Program', '00000000-0000-0000-0000-0000000000d9');
insert into public.teams (id, name, program_id) values
  ('91111111-1111-1111-1111-111111111111', 'Fix Team A', '00000000-0000-0000-0000-0000000000f9'),
  ('92222222-2222-2222-2222-222222222222', 'Fix Team B', '00000000-0000-0000-0000-0000000000f9');
insert into public.members (id, full_name, email, team_id, is_active) values
  ('9aaaaaaa-0000-0000-0000-000000000001', 'Proposer A', 'p1@test.local', '91111111-1111-1111-1111-111111111111', true),
  ('9aaaaaaa-0000-0000-0000-000000000002', 'Other B', 'p2@test.local', '92222222-2222-2222-2222-222222222222', true);
insert into auth.users (id, email) values
  ('90000000-0000-0000-0000-00000000000a', 'fixadmin@test.local'),
  ('90000000-0000-0000-0000-00000000000b', 'fixmgr@test.local'),
  ('90000000-0000-0000-0000-00000000000f', 'fixmgr2@test.local'),
  ('90000000-0000-0000-0000-000000000001', 'p1@test.local'),
  ('90000000-0000-0000-0000-000000000002', 'p2@test.local');
update public.profiles set role = 'admin' where user_id = '90000000-0000-0000-0000-00000000000a';
update public.profiles set role = 'manager'
  where user_id in ('90000000-0000-0000-0000-00000000000b', '90000000-0000-0000-0000-00000000000f');
insert into public.manager_scopes (team_id, user_id) values
  ('91111111-1111-1111-1111-111111111111', '90000000-0000-0000-0000-00000000000b'),
  ('92222222-2222-2222-2222-222222222222', '90000000-0000-0000-0000-00000000000f');

insert into public.providers (id, name) values ('9eeeeeee-0000-0000-0000-000000000001', 'Fix Provider');
insert into public.certificates (id, name, kind, provider_id, validity_months) values
  ('99990000-0000-0000-0000-000000000001', 'Fix Exam', 'exam', '9eeeeeee-0000-0000-0000-000000000001', 12);
insert into public.certificates (id, name, kind, catalogue_status, proposed_by, proposed_provider) values
  ('99990000-0000-0000-0000-000000000002', 'Proposed Completion', 'completion', 'pending',
   '9aaaaaaa-0000-0000-0000-000000000001', 'Brand New Provider');

-- 1. Visibility of a pending proposal
select pg_temp.login_as('90000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.certificates where id = '99990000-0000-0000-0000-000000000002'), 1,
  'the proposer sees their pending proposal');
select pg_temp.login_as('90000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.certificates where id = '99990000-0000-0000-0000-000000000002'), 0,
  'another member does not see it');
select is((select count(*)::int from public.certificates where id = '99990000-0000-0000-0000-000000000001'), 1,
  'every member still sees approved entries');
select pg_temp.login_as('90000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.certificates where id = '99990000-0000-0000-0000-000000000002'), 1,
  'the manager of the proposer sees it');
select pg_temp.login_as('90000000-0000-0000-0000-00000000000f');
select is((select count(*)::int from public.certificates where id = '99990000-0000-0000-0000-000000000002'), 0,
  'a manager out of scope does not see it');

-- 2. approve_certificate
select pg_temp.login_as('90000000-0000-0000-0000-000000000001');
select throws_ok($$select public.approve_certificate('99990000-0000-0000-0000-000000000002')$$, '42501', null,
  'a member cannot approve a proposal');
select pg_temp.login_as('90000000-0000-0000-0000-00000000000b');
select throws_ok($$select public.approve_certificate('99990000-0000-0000-0000-000000000002')$$, '42501', null,
  'a manager cannot approve a proposal');
select pg_temp.login_as('90000000-0000-0000-0000-00000000000a');
select lives_ok($$select public.approve_certificate('99990000-0000-0000-0000-000000000002')$$,
  'the admin approves a proposed course completion');
select pg_temp.logout();
select ok((select catalogue_status = 'approved' and course_id is not null and proposed_provider is null
             from public.certificates where id = '99990000-0000-0000-0000-000000000002'),
  'it is approved with a granting course and no typed provider left');
select is((select p.name from public.certificates c join public.providers p on p.id = c.provider_id
            where c.id = '99990000-0000-0000-0000-000000000002'), 'Brand New Provider',
  'the typed provider became a provider');
select pg_temp.login_as('90000000-0000-0000-0000-00000000000a');
select throws_ok($$select public.approve_certificate('99990000-0000-0000-0000-000000000002')$$, 'P0002', null,
  'approving twice is refused');
select pg_temp.logout();

-- 3. Renewal: the older Completed record counts nowhere once a later one is approved.
insert into public.training_records (member_id, certificate_id, status, progress, issued_date) values
  ('9aaaaaaa-0000-0000-0000-000000000001', '99990000-0000-0000-0000-000000000001', 'done', 100, '2020-01-01'),
  ('9aaaaaaa-0000-0000-0000-000000000001', '99990000-0000-0000-0000-000000000001', 'done', 100, public.vn_today() - 30);
select is((select array_agg(renewed order by issued_date) from public.v_training_records
            where member_id = '9aaaaaaa-0000-0000-0000-000000000001'), array[true, false],
  'the view marks only the older record as renewed');
select pg_temp.login_as('90000000-0000-0000-0000-00000000000a');
select is((select expired_certs from public.dashboard_kpis()), 0, 'the renewed expired record is not counted as expired');
select is((select active_certs from public.dashboard_kpis()), 1, 'the renewal counts as the one active certificate');
select pg_temp.logout();

select * from finish();
rollback;
