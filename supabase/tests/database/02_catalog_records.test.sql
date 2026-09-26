begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

select has_table('public', 'cert_types', 'cert_types table exists');
select has_table('public', 'providers', 'providers table exists');
select has_table('public', 'courses', 'courses table exists');
select has_table('public', 'training_records', 'training_records table exists');

insert into public.members (id, full_name, email)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Member A', 'a@test.local');
insert into public.courses (id, name, validity_months)
values ('cccccccc-0000-0000-0000-000000000001', 'AWS SAA', 36);

select throws_ok(
  $$insert into public.training_records (member_id, course_id, status, progress)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'done', 100)$$,
  '23514', null,
  'done requires issued_date'
);

select throws_ok(
  $$insert into public.training_records (member_id, course_id, status, progress, issued_date)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'done', 80, '2026-01-01')$$,
  '23514', null,
  'done requires progress 100'
);

select throws_ok(
  $$insert into public.training_records (member_id, course_id, status, progress)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'not_started', 10)$$,
  '23514', null,
  'not_started requires progress 0'
);

select throws_ok(
  $$insert into public.training_records (member_id, course_id, status, progress)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'in_progress', 100)$$,
  '23514', null,
  'in_progress requires progress below 100'
);

select lives_ok(
  $$insert into public.training_records (id, member_id, course_id, status, progress)
    values ('eeeeeeee-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001',
            'cccccccc-0000-0000-0000-000000000001', 'in_progress', 20)$$,
  'valid in_progress record is accepted'
);

update public.training_records set progress_updated_at = '2020-01-01'
  where id = 'eeeeeeee-0000-0000-0000-00000000000a';
update public.training_records set progress = 40
  where id = 'eeeeeeee-0000-0000-0000-00000000000a';

select ok(
  (select progress_updated_at > '2020-01-01' from public.training_records
    where id = 'eeeeeeee-0000-0000-0000-00000000000a'),
  'changing progress bumps progress_updated_at'
);

update public.training_records set progress_updated_at = '2020-01-01'
  where id = 'eeeeeeee-0000-0000-0000-00000000000a';
update public.training_records set notes = 'studying'
  where id = 'eeeeeeee-0000-0000-0000-00000000000a';

select ok(
  (select progress_updated_at = '2020-01-01' from public.training_records
    where id = 'eeeeeeee-0000-0000-0000-00000000000a'),
  'non-progress update keeps progress_updated_at'
);

select * from finish();
rollback;
