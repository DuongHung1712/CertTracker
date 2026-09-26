begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

select has_table('public', 'dcs', 'dcs table exists');
select has_table('public', 'programs', 'programs table exists');
select has_table('public', 'teams', 'teams table exists');
select has_table('public', 'members', 'members table exists');
select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'team_managers', 'team_managers table exists');

insert into public.members (id, full_name, email)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Member A', 'a@test.local');

select matches(
  (select code from public.members where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  '^M[0-9]{3,}$',
  'member code is auto-generated as Mnnn'
);

select throws_ok(
  $$insert into public.members (full_name, email) values ('Dup', 'A@TEST.LOCAL')$$,
  '23505', null,
  'member email is unique case-insensitively'
);

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000c', 'a@test.local'),
  ('a0000000-0000-0000-0000-00000000000d', 'nobody@test.local');

select is(
  (select member_id from public.profiles where user_id = 'a0000000-0000-0000-0000-00000000000c'),
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'new auth user is linked to the member with the same email'
);

select is(
  (select role::text from public.profiles where user_id = 'a0000000-0000-0000-0000-00000000000c'),
  'member',
  'new auth user defaults to role member'
);

select is(
  (select member_id from public.profiles where user_id = 'a0000000-0000-0000-0000-00000000000d'),
  null,
  'auth user without a matching member gets no member link'
);

select * from finish();
rollback;
