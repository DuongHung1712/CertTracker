begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

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

-- Start from an empty learning picture so org-wide counts are exact.
delete from public.learning_items;
delete from public.training_records;
update public.members set is_active = false;

insert into public.dcs (id, name) values ('00000000-0000-0000-0000-0000000034d1', 'DL DC') on conflict do nothing;
insert into public.programs (id, name, dc_id)
  values ('00000000-0000-0000-0000-0000000034f1', 'DL Program', '00000000-0000-0000-0000-0000000034d1') on conflict do nothing;
insert into public.teams (id, name, program_id)
  values ('34343434-0000-0000-0000-00000000000a', 'DL Team', '00000000-0000-0000-0000-0000000034f1') on conflict do nothing;
insert into public.members (id, full_name, email, team_id, is_active) values
  ('34000000-0000-0000-0000-000000000001', 'DL Certified', 'dl1@test.local', '34343434-0000-0000-0000-00000000000a', true),
  ('34000000-0000-0000-0000-000000000002', 'DL Learner', 'dl2@test.local', '34343434-0000-0000-0000-00000000000a', true)
  on conflict (id) do update set is_active = true;
insert into auth.users (id, email) values ('34a00000-0000-0000-0000-00000000000a', 'dladmin@test.local') on conflict do nothing;
update public.profiles set role = 'admin' where user_id = '34a00000-0000-0000-0000-00000000000a';
insert into public.providers (id, name) values ('00000000-0000-0000-0000-000000003401', 'DL Provider') on conflict do nothing;
insert into public.certificates (id, name, kind, provider_id, validity_months) values
  ('34e00000-0000-0000-0000-000000000001', 'DL Exam', 'exam', '00000000-0000-0000-0000-000000003401', 36) on conflict do nothing;
insert into public.courses (id, name, provider_id)
  values ('34c00000-0000-0000-0000-000000000001', 'DL Course', '00000000-0000-0000-0000-000000003401') on conflict do nothing;

-- Member 1: one approved exam certificate. Member 2: only learning items.
insert into public.training_records (member_id, certificate_id, status, progress, issued_date, approval)
  values ('34000000-0000-0000-0000-000000000001', '34e00000-0000-0000-0000-000000000001', 'done', 100, public.vn_today() - 30, 'approved');
insert into public.learning_items (id, member_id, course_id, status, progress) values
  ('34b00000-0000-0000-0000-000000000001', '34000000-0000-0000-0000-000000000002', '34c00000-0000-0000-0000-000000000001', 'in_progress', 50);
insert into public.learning_items (id, member_id, target_certificate_id, status, planned_date) values
  ('34b00000-0000-0000-0000-000000000002', '34000000-0000-0000-0000-000000000002', '34e00000-0000-0000-0000-000000000001',
   'not_started', public.vn_today() - 1);

select pg_temp.login_as('34a00000-0000-0000-0000-00000000000a');
select is((select in_progress_records from public.dashboard_kpis()), 1, 'in progress counts learning items');
select is((select not_started_records from public.dashboard_kpis()), 1, 'not started counts learning items');
select is((select completion_in_progress_records from public.dashboard_kpis()), 1, 'course items not done count as completions in progress');
select is((select total_records from public.dashboard_kpis()), 1, 'total records = certificates only');
select is((select active_certs from public.dashboard_kpis()), 1, 'kpis ignore learning items: one valid certificate');
select is(
  (select in_progress from public.dashboard_ranking() where member_id = '34000000-0000-0000-0000-000000000002'), 1,
  'ranking in progress counts learning items');
select is(
  (select valid_certs from public.dashboard_ranking() where member_id = '34000000-0000-0000-0000-000000000002'), 0,
  'a learner with only learning items holds no certificate');
select is(
  (select in_progress + not_started from public.dashboard_breakdown('team') where group_label = 'DL Team'), 2,
  'team breakdown counts learning items');
select is(
  (select count(*)::int from public.v_data_quality_issues
    where issue_type = 'overdue_exam' and record_id = '34b00000-0000-0000-0000-000000000002'), 1,
  'an overdue planned exam on a learning item is flagged');
select pg_temp.logout();

select * from finish();
rollback;
