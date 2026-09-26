-- Local development seed. Test-only credentials; never used outside local Supabase.
-- UUIDs use the 5eed prefix so they never collide with pgTAP fixtures (tests run on the seeded DB).
insert into public.dcs (id, name) values ('5eed0000-0000-0000-0000-0000000000d1', 'DC34');
insert into public.programs (id, name, dc_id)
  values ('5eed0000-0000-0000-0000-0000000000f1', 'Digital Delivery', '5eed0000-0000-0000-0000-0000000000d1');
insert into public.teams (id, name, program_id) values
  ('5eed0000-0000-0000-0000-00000000a001', 'Team Cloud', '5eed0000-0000-0000-0000-0000000000f1'),
  ('5eed0000-0000-0000-0000-00000000a002', 'Team AI', '5eed0000-0000-0000-0000-0000000000f1');

insert into public.members (id, full_name, email, team_id) values
  ('5eed0000-0000-0000-0000-00000000b001', 'Nguyễn Văn An', 'an@certtracker.test', '5eed0000-0000-0000-0000-00000000a001'),
  ('5eed0000-0000-0000-0000-00000000b002', 'Trần Thị Bình', 'binh@certtracker.test', '5eed0000-0000-0000-0000-00000000a002'),
  ('5eed0000-0000-0000-0000-00000000b003', 'Lê Minh Châu', 'member@certtracker.test', '5eed0000-0000-0000-0000-00000000a001');

insert into public.cert_types (id, name) values
  ('5eed0000-0000-0000-0000-00000000c001', 'Cloud'),
  ('5eed0000-0000-0000-0000-00000000c002', 'AI');
insert into public.providers (id, name) values
  ('5eed0000-0000-0000-0000-00000000c101', 'AWS'),
  ('5eed0000-0000-0000-0000-00000000c102', 'NVIDIA');
insert into public.courses (id, name, cert_type_id, provider_id, level, validity_months, refundable, url) values
  ('5eed0000-0000-0000-0000-00000000e001', 'AWS Solutions Architect Associate',
   '5eed0000-0000-0000-0000-00000000c001', '5eed0000-0000-0000-0000-00000000c101', 'Associate', 36, true,
   'https://aws.amazon.com/certification/certified-solutions-architect-associate/'),
  ('5eed0000-0000-0000-0000-00000000e002', 'NVIDIA Generative AI LLMs',
   '5eed0000-0000-0000-0000-00000000c002', '5eed0000-0000-0000-0000-00000000c102', 'Associate', 24, false, null);

insert into public.training_records (member_id, course_id, status, progress, issued_date, planned_exam_date) values
  ('5eed0000-0000-0000-0000-00000000b001', '5eed0000-0000-0000-0000-00000000e001', 'done', 100, public.vn_today() - 1070, null),
  ('5eed0000-0000-0000-0000-00000000b002', '5eed0000-0000-0000-0000-00000000e002', 'in_progress', 40, null, public.vn_today() + 20),
  ('5eed0000-0000-0000-0000-00000000b003', '5eed0000-0000-0000-0000-00000000e001', 'not_started', 0, null, null);

-- Login users (email + password). Members must exist first so the profile trigger links them.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(),
  '', '', '', ''
from (values
  ('5eed0000-0000-0000-0000-00000000f00a'::uuid, 'admin@certtracker.test'),
  ('5eed0000-0000-0000-0000-00000000f00b'::uuid, 'manager@certtracker.test'),
  ('5eed0000-0000-0000-0000-00000000f00c'::uuid, 'member@certtracker.test')
) as u (id, email);

insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id, u.id::text, json_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now(), now()
from auth.users u
where u.email like '%@certtracker.test';

update public.profiles set role = 'admin' where user_id = '5eed0000-0000-0000-0000-00000000f00a';
update public.profiles set role = 'manager' where user_id = '5eed0000-0000-0000-0000-00000000f00b';
insert into public.team_managers (team_id, user_id)
  values ('5eed0000-0000-0000-0000-00000000a001', '5eed0000-0000-0000-0000-00000000f00b');
