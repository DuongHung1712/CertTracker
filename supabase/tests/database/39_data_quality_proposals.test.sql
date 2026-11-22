-- Migration 20261122000001: pending course and certificate proposals are Data Quality rows (admin only),
-- and reject_certificate works for the admin alone.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

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

create function pg_temp.rows_of(kind text, subject uuid) returns int language sql as $$
  select count(*)::int from public.v_data_quality_issues where issue_type = kind and subject_id = subject
$$;

insert into public.dcs (id, name) values ('00000000-0000-0000-0000-0000000038d1', 'DQP DC') on conflict do nothing;
insert into public.programs (id, name, dc_id)
  values ('00000000-0000-0000-0000-0000000038f1', 'DQP Program', '00000000-0000-0000-0000-0000000038d1') on conflict do nothing;
insert into public.teams (id, name, program_id)
  values ('38383838-0000-0000-0000-00000000000a', 'DQP Team', '00000000-0000-0000-0000-0000000038f1') on conflict do nothing;
insert into public.members (id, full_name, email, team_id, is_active)
  values ('38000000-0000-0000-0000-000000000001', 'DQP Proposer', 'dqp1@test.local', '38383838-0000-0000-0000-00000000000a', true)
  on conflict do nothing;
insert into auth.users (id, email) values
  ('38a00000-0000-0000-0000-000000000001', 'dqp1@test.local'),
  ('38a00000-0000-0000-0000-00000000000b', 'dqpmanager@test.local'),
  ('38a00000-0000-0000-0000-00000000000a', 'dqpadmin@test.local') on conflict do nothing;
update public.profiles set role = 'member' where user_id = '38a00000-0000-0000-0000-000000000001';
update public.profiles set role = 'manager' where user_id = '38a00000-0000-0000-0000-00000000000b';
update public.profiles set role = 'admin' where user_id = '38a00000-0000-0000-0000-00000000000a';
insert into public.manager_scopes (team_id, user_id)
  values ('38383838-0000-0000-0000-00000000000a', '38a00000-0000-0000-0000-00000000000b') on conflict do nothing;

insert into public.courses (id, name, catalogue_status, proposed_by, proposed_provider) values
  ('38c00000-0000-0000-0000-000000000001', 'DQP Pending Course', 'pending', '38000000-0000-0000-0000-000000000001', 'New Provider'),
  ('38c00000-0000-0000-0000-000000000002', 'DQP Rejected Course', 'rejected', '38000000-0000-0000-0000-000000000001', 'New Provider'),
  ('38c00000-0000-0000-0000-000000000003', 'DQP Approved Course', 'approved', null, null);
insert into public.certificates (id, name, kind, catalogue_status, proposed_by, proposed_provider)
  values ('38e00000-0000-0000-0000-000000000001', 'DQP Pending Certificate', 'exam', 'pending',
          '38000000-0000-0000-0000-000000000001', 'New Provider');

-- Admin sees both proposals, with the proposer, and nothing for approved or rejected ones.
select pg_temp.login_as('38a00000-0000-0000-0000-00000000000a');
select is(pg_temp.rows_of('course_proposal', '38c00000-0000-0000-0000-000000000001'), 1, 'admin sees the pending course proposal');
select is(pg_temp.rows_of('certificate_proposal', '38e00000-0000-0000-0000-000000000001'), 1, 'admin sees the pending certificate proposal');
select is((select member_name from public.v_data_quality_issues
            where issue_type = 'course_proposal' and subject_id = '38c00000-0000-0000-0000-000000000001'),
  'DQP Proposer', 'the row names the proposer');
select is(pg_temp.rows_of('course_proposal', '38c00000-0000-0000-0000-000000000002')
        + pg_temp.rows_of('course_proposal', '38c00000-0000-0000-0000-000000000003'), 0,
  'a rejected or approved course is no row');

-- Manager in scope of the proposer and the proposer see none: only the admin reviews proposals.
select pg_temp.login_as('38a00000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.v_data_quality_issues where issue_type in ('course_proposal', 'certificate_proposal')), 0,
  'a manager sees no proposal rows');
select pg_temp.login_as('38a00000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.v_data_quality_issues where issue_type in ('course_proposal', 'certificate_proposal')), 0,
  'the proposer sees no proposal rows');

-- reject_certificate: admin only.
select throws_ok($$select public.reject_certificate('38e00000-0000-0000-0000-000000000001')$$, '42501', null,
  'a member cannot reject a certificate proposal');
select pg_temp.login_as('38a00000-0000-0000-0000-00000000000b');
select throws_ok($$select public.reject_certificate('38e00000-0000-0000-0000-000000000001')$$, '42501', null,
  'a manager cannot reject a certificate proposal');
select pg_temp.login_as('38a00000-0000-0000-0000-00000000000a');
select lives_ok($$select public.reject_certificate('38e00000-0000-0000-0000-000000000001')$$, 'the admin rejects it');
select is(pg_temp.rows_of('certificate_proposal', '38e00000-0000-0000-0000-000000000001'), 0, 'a rejected proposal leaves the list');
select throws_ok($$select public.reject_certificate('38e00000-0000-0000-0000-000000000001')$$, 'P0002', null,
  'rejecting it again is refused');
select pg_temp.logout();
select ok((select catalogue_status = 'rejected' and reviewed_at is not null from public.certificates
            where id = '38e00000-0000-0000-0000-000000000001'), 'it is rejected and the review time is kept');

-- Approving a course removes its row too.
select pg_temp.login_as('38a00000-0000-0000-0000-00000000000a');
select public.approve_course('38c00000-0000-0000-0000-000000000001', false);
select is(pg_temp.rows_of('course_proposal', '38c00000-0000-0000-0000-000000000001'), 0, 'an approved course leaves the list');

select * from finish();
rollback;
