begin;
create extension if not exists pgtap with schema extensions;
select plan(68);

create function pg_temp.login_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
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

-- Own fixtures: isolated from seed.sql rows (plus catalogue assertions against seeded 9 domains & 182 skills).
insert into public.dcs (id, name) values ('00000000-0000-0000-0000-0000000030d1', 'SK DC') on conflict do nothing;
insert into public.programs (id, name, dc_id)
  values ('00000000-0000-0000-0000-0000000030f1', 'SK Program', '00000000-0000-0000-0000-0000000030d1') on conflict do nothing;
insert into public.teams (id, name, program_id) values
  ('30303030-0000-0000-0000-00000000000a', 'SK Team', '00000000-0000-0000-0000-0000000030f1'),
  ('30303030-0000-0000-0000-00000000000b', 'SK Team B', '00000000-0000-0000-0000-0000000030f1')
  on conflict do nothing;
insert into public.members (id, full_name, email, team_id, is_active) values
  ('30000000-0000-0000-0000-000000000001', 'SK Member', 'sk1@test.local', '30303030-0000-0000-0000-00000000000a', true),
  ('30000000-0000-0000-0000-000000000002', 'SK Other', 'sk2@test.local', '30303030-0000-0000-0000-00000000000a', true),
  ('30000000-0000-0000-0000-000000000003', 'SK Linked Manager', 'skmgr2@test.local', '30303030-0000-0000-0000-00000000000a', true),
  ('30000000-0000-0000-0000-000000000004', 'SK Out Of Scope', 'sk4@test.local', '30303030-0000-0000-0000-00000000000b', true)
  on conflict do nothing;
insert into auth.users (id, email) values
  ('30a00000-0000-0000-0000-000000000001', 'sk1@test.local'),
  ('30a00000-0000-0000-0000-00000000000b', 'skmanager@test.local'),
  ('30a00000-0000-0000-0000-00000000000c', 'skmgr2@test.local'),
  ('30a00000-0000-0000-0000-00000000000a', 'skadmin@test.local')
  on conflict do nothing;
update public.profiles set role = 'member' where user_id = '30a00000-0000-0000-0000-000000000001';
update public.profiles set role = 'manager'
  where user_id in ('30a00000-0000-0000-0000-00000000000b', '30a00000-0000-0000-0000-00000000000c');
update public.profiles set role = 'admin' where user_id = '30a00000-0000-0000-0000-00000000000a';
insert into public.manager_scopes (team_id, user_id) values
  ('30303030-0000-0000-0000-00000000000a', '30a00000-0000-0000-0000-00000000000b'),
  ('30303030-0000-0000-0000-00000000000a', '30a00000-0000-0000-0000-00000000000c')
  on conflict do nothing;
insert into public.skill_domains (id, name, slug, sort_order)
  values ('30d00000-0000-0000-0000-000000000001', 'SK Domain', 'sk-domain', 3001);
insert into public.skills (id, code, name, domain_id) values
  ('30500000-0000-0000-0000-000000000001', 'SKL-SKT-01', 'SK Skill One', '30d00000-0000-0000-0000-000000000001'),
  ('30500000-0000-0000-0000-000000000002', 'SKL-SKT-02', 'SK Skill Two', '30d00000-0000-0000-0000-000000000001'),
  ('30500000-0000-0000-0000-000000000003', 'SKL-SKT-03', 'SK Skill Three', '30d00000-0000-0000-0000-000000000001');
insert into public.member_skills (id, member_id, skill_id, current_level)
  values ('30600000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '30500000-0000-0000-0000-000000000001', 2);
insert into public.member_skills (member_id, skill_id, current_level)
  values ('30000000-0000-0000-0000-000000000002', '30500000-0000-0000-0000-000000000001', 3);
insert into public.member_skills (id, member_id, skill_id, current_level, verification_status)
  values ('30600000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', '30500000-0000-0000-0000-000000000001', 3, 'self_assessed');
insert into public.member_skills (id, member_id, skill_id, current_level, verification_status, manager_endorsement_requested)
  values ('30600000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000004', '30500000-0000-0000-0000-000000000001', 5, 'pending_review', true);

-- 1..6: Base tables and constraints
select has_table('public', 'skill_domains', 'skill_domains table exists');
select has_table('public', 'skills', 'skills table exists');
select has_table('public', 'skill_certificate_links', 'skill_certificate_links table exists');
select has_table('public', 'member_skills', 'member_skills table exists');

select throws_ok(
  $$insert into public.skills (code, name, domain_id, benchmark_level)
    values ('INVALID_CODE', 'Bad Skill', '30d00000-0000-0000-0000-000000000001', 3)$$,
  '23514', null, 'rejects invalid skill code pattern');
select throws_ok(
  $$insert into public.member_skills (member_id, skill_id, current_level)
    values ('30000000-0000-0000-0000-000000000001', '30500000-0000-0000-0000-000000000002', 6)$$,
  '23514', null, 'rejects skill level > 5');

-- 7..15: Original member + manager review matrix
select pg_temp.login_as('30a00000-0000-0000-0000-000000000001');
select isnt_empty('select 1 from public.skills where id = ''30500000-0000-0000-0000-000000000001''',
  'member reads the skills catalogue');
select is((select count(*)::int from public.member_skills where skill_id = '30500000-0000-0000-0000-000000000001'), 1,
  'member reads only their own skill ratings');
select lives_ok(
  $$update public.member_skills set current_level = 3, verification_status = 'pending_review'
    where id = '30600000-0000-0000-0000-000000000001'$$,
  'member rates their own skill and asks for review');
select throws_ok(
  $$update public.member_skills set verification_status = 'certified' where id = '30600000-0000-0000-0000-000000000001'$$,
  '42501', null, 'member cannot certify their own skill');
select throws_ok(
  $$update public.member_skills set reviewed_by = '30000000-0000-0000-0000-000000000002', reviewed_at = now()
    where id = '30600000-0000-0000-0000-000000000001'$$,
  '42501', null, 'member cannot stamp their own review');
select throws_ok(
  $$insert into public.member_skills (member_id, skill_id, current_level, verification_status)
    values ('30000000-0000-0000-0000-000000000001', '30500000-0000-0000-0000-000000000002', 4, 'certified')$$,
  '42501', null, 'member cannot add a skill already certified');
select pg_temp.logout();

select pg_temp.login_as('30a00000-0000-0000-0000-00000000000b');
select lives_ok(
  $$update public.member_skills set verification_status = 'certified', reviewed_at = now()
    where id = '30600000-0000-0000-0000-000000000001'$$,
  'manager certifies a skill in scope');
select is((select verification_status from public.member_skills where id = '30600000-0000-0000-0000-000000000001'),
  'certified', 'the certification is saved');
select pg_temp.logout();

select pg_temp.login_as('30a00000-0000-0000-0000-000000000001');
select lives_ok(
  $$update public.member_skills set evidence_note = 'updated' where id = '30600000-0000-0000-0000-000000000001'$$,
  'member edits a note on a certified skill without touching the review');
select pg_temp.logout();

-- 16..22: Full 9 domains & 182 skills catalogue + DC34 code check
select is(
  (select count(*)::int from public.skill_domains
    where slug in ('cloud', 'backend', 'frontend', 'devops', 'security', 'data_ai', 'leadership', 'mobile', 'embedded')),
  9, 'all 9 skill_domains exist');
select is(
  (select name from public.skill_domains where slug = 'leadership'),
  'Leadership & Collaboration', 'leadership domain uses updated name');
select ok(
  (select count(*)::int from public.skills where id::text like '5eed0000-0000-0000-0000-0000%') >= 182,
  'at least 182 seeded catalogue skills exist');
select is(
  (select count(*)::int from public.skills
    where id between '5eed0000-0000-0000-0000-00000000a201'::uuid and '5eed0000-0000-0000-0000-00000000a216'::uuid),
  16, 'original 16 a201..a216 skill UUIDs are preserved');
select is(
  (select count(*)::int from public.skills where code like 'DC34-%'),
  117, 'all 117 DC34 skills are seeded');
select ok(
  exists (select 1 from public.skills where code = 'DC34-001'),
  'DC34-001 exists in seeded skills');
select lives_ok(
  $$insert into public.skills (id, code, name, domain_id)
    values ('30500000-0000-0000-0000-000000000004', 'DC34-999', 'SK DC34 Allowed', '30d00000-0000-0000-0000-000000000001')$$,
  'skills_code_check allows DC34-NNN codes');

-- 23..32: Member numeric(4,1) YoE, explicit self_assessed L4 guard, immutability, delete
select pg_temp.login_as('30a00000-0000-0000-0000-000000000001');
select lives_ok(
  $$insert into public.member_skills (id, member_id, skill_id, current_level, years_of_experience, verification_status)
    values ('30600000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '30500000-0000-0000-0000-000000000002', 4, 2.5, 'self_assessed')$$,
  'member inserts level 4 self_assessed skill with 2.5 years of experience');
select is(
  (select years_of_experience::numeric from public.member_skills where id = '30600000-0000-0000-0000-000000000002'),
  2.5::numeric, 'years_of_experience preserves 0.5 decimal precision');
select throws_ok(
  $$update public.member_skills set years_of_experience = -0.5 where id = '30600000-0000-0000-0000-000000000002'$$,
  '23514', null, 'rejects negative years_of_experience (-0.5)');
select throws_ok(
  $$update public.member_skills set years_of_experience = 50.5 where id = '30600000-0000-0000-0000-000000000002'$$,
  '23514', null, 'rejects years_of_experience > 50 (50.5)');
select throws_ok(
  $$update public.member_skills set verification_status = 'certified' where id = '30600000-0000-0000-0000-000000000002'$$,
  '42501', null, 'explicit self_assessed level 4 cannot self-certify');
select throws_ok(
  $$update public.member_skills set member_id = '30000000-0000-0000-0000-000000000002' where id = '30600000-0000-0000-0000-000000000002'$$,
  '42501', null, 'member cannot mutate member_id');
select throws_ok(
  $$update public.member_skills set skill_id = '30500000-0000-0000-0000-000000000003' where id = '30600000-0000-0000-0000-000000000002'$$,
  '42501', null, 'member cannot mutate skill_id');
select throws_ok(
  $$update public.member_skills set verification_status = 'returned', review_note = 'Nope' where id = '30600000-0000-0000-0000-000000000002'$$,
  '42501', null, 'member cannot mark their own skill returned');
select is(
  pg_temp.rows_changed($$delete from public.member_skills where member_id = '30000000-0000-0000-0000-000000000002'$$),
  0, 'member cannot delete another member''s skill row');
insert into public.member_skills (member_id, skill_id, current_level, verification_status)
  values ('30000000-0000-0000-0000-000000000001', '30500000-0000-0000-0000-000000000003', 2, 'self_assessed');
select is(
  pg_temp.rows_changed($$delete from public.member_skills where member_id = '30000000-0000-0000-0000-000000000001' and skill_id = '30500000-0000-0000-0000-000000000003'$$),
  1, 'member can delete their own skill row');
select pg_temp.logout();

-- 33..36: Manager own-row guard & out-of-scope checks
select pg_temp.login_as('30a00000-0000-0000-0000-00000000000c');
select throws_ok(
  $$update public.member_skills set verification_status = 'certified' where id = '30600000-0000-0000-0000-000000000003'$$,
  '42501', null, 'manager cannot self-certify their own skill row');
select throws_ok(
  $$update public.member_skills set member_id = '30000000-0000-0000-0000-000000000002', verification_status = 'certified' where id = '30600000-0000-0000-0000-000000000003'$$,
  '42501', null, 'manager on own row cannot swap member_id to escape self-certify check');
select is(
  pg_temp.rows_changed($$update public.member_skills set verification_status = 'certified' where id = '30600000-0000-0000-0000-000000000004'$$),
  0, 'manager cannot review an out-of-scope member');
select is(
  pg_temp.rows_changed($$delete from public.member_skills where id = '30600000-0000-0000-0000-000000000004'$$),
  0, 'manager cannot delete an out-of-scope member skill');
select pg_temp.logout();

-- 37..46: Level 5 request -> Manager return -> Member resubmit -> Manager approve -> Member downgrade
select pg_temp.login_as('30a00000-0000-0000-0000-000000000001');
update public.member_skills
  set current_level = 5, verification_status = 'self_assessed', manager_endorsement_requested = false
  where id = '30600000-0000-0000-0000-000000000002';
select ok(
  (select verification_status = 'pending_review' and manager_endorsement_requested = true
    from public.member_skills where id = '30600000-0000-0000-0000-000000000002'),
  'member level 5 request forces pending_review and manager_endorsement_requested');
select pg_temp.logout();

select pg_temp.login_as('30a00000-0000-0000-0000-00000000000c');
select throws_ok(
  $$update public.member_skills set verification_status = 'returned' where id = '30600000-0000-0000-0000-000000000002'$$,
  '23514', null, 'returning L5 without review_note fails');
select throws_ok(
  $$update public.member_skills set verification_status = 'returned', review_note = '   ' where id = '30600000-0000-0000-0000-000000000002'$$,
  '23514', null, 'returning L5 with blank review_note fails');
select lives_ok(
  $$update public.member_skills set verification_status = 'returned', review_note = 'Add architecture RFC'
    where id = '30600000-0000-0000-0000-000000000002'$$,
  'manager returns L5 in scope with review_note');
select is(
  (select current_level::int from public.member_skills where id = '30600000-0000-0000-0000-000000000002'),
  4, 'returning L5 clamps current_level to 4');
select ok(
  (select verification_status = 'returned'
      and review_note = 'Add architecture RFC'
      and manager_endorsement_requested = false
      and reviewed_by = '30000000-0000-0000-0000-000000000003'::uuid
      and reviewed_at is not null
    from public.member_skills where id = '30600000-0000-0000-0000-000000000002'),
  'returned L5 stores status, note, reviewer, and reviewed_at');
select pg_temp.logout();

select pg_temp.login_as('30a00000-0000-0000-0000-000000000001');
select lives_ok(
  $$update public.member_skills set current_level = 5, evidence_note = 'Added RFC'
    where id = '30600000-0000-0000-0000-000000000002'$$,
  'member resubmits returned row to level 5');
select ok(
  (select verification_status = 'pending_review'
      and manager_endorsement_requested = true
      and review_note is null
      and reviewed_by is null
      and reviewed_at is null
    from public.member_skills where id = '30600000-0000-0000-0000-000000000002'),
  'resubmitting returned row clears review stamps/note and restores pending_review');
select pg_temp.logout();

select pg_temp.login_as('30a00000-0000-0000-0000-00000000000c');
update public.member_skills set verification_status = 'certified'
  where id = '30600000-0000-0000-0000-000000000002';
select pg_temp.logout();

select pg_temp.login_as('30a00000-0000-0000-0000-000000000001');
select lives_ok(
  $$update public.member_skills set current_level = 4
    where id = '30600000-0000-0000-0000-000000000002'$$,
  'member downgrades an endorsed level 5 row to level 4');
select ok(
  (select verification_status = 'self_assessed'
      and manager_endorsement_requested = false
      and reviewed_by is null
      and reviewed_at is null
    from public.member_skills where id = '30600000-0000-0000-0000-000000000002'),
  'downgrading an endorsed level 5 sets self_assessed and clears review stamps');
select pg_temp.logout();

-- 47..48: Admin returns out-of-scope L5 (unlinked admin) & deletes any row
select pg_temp.login_as('30a00000-0000-0000-0000-00000000000a');
select lives_ok(
  $$update public.member_skills set verification_status = 'returned', review_note = 'Needs prod metrics'
    where id = '30600000-0000-0000-0000-000000000004'$$,
  'unlinked admin returns out-of-scope L5 row');
select is(
  pg_temp.rows_changed($$delete from public.member_skills where id = '30600000-0000-0000-0000-000000000004'$$),
  1, 'admin deletes any member_skills row');
select pg_temp.logout();

-- 49: Realtime publication
select ok(
  not exists (select 1 from pg_publication where pubname = 'supabase_realtime')
  or exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'member_skills'
  ),
  'member_skills is in supabase_realtime publication');

-- 50..53: INSERT RLS WITH CHECK and member review_note / returned insert blocks
select pg_temp.login_as('30a00000-0000-0000-0000-000000000001');
select throws_ok(
  $$insert into public.member_skills (member_id, skill_id, current_level)
    values ('30000000-0000-0000-0000-000000000002', '30500000-0000-0000-0000-000000000003', 3)$$,
  '42501', null, 'member cannot insert a skill row for another member');
select throws_ok(
  $$insert into public.member_skills (member_id, skill_id, current_level, verification_status, review_note)
    values ('30000000-0000-0000-0000-000000000001', '30500000-0000-0000-0000-000000000003', 4, 'returned', 'Self return')$$,
  '42501', null, 'member cannot insert a skill row as returned');
select throws_ok(
  $$insert into public.member_skills (member_id, skill_id, current_level, verification_status, review_note)
    values ('30000000-0000-0000-0000-000000000001', '30500000-0000-0000-0000-000000000003', 4, 'self_assessed', 'Injected note')$$,
  '42501', null, 'member cannot insert a skill row with review_note');
select pg_temp.logout();

select pg_temp.login_as('30a00000-0000-0000-0000-00000000000c');
select throws_ok(
  $$insert into public.member_skills (member_id, skill_id, current_level)
    values ('30000000-0000-0000-0000-000000000004', '30500000-0000-0000-0000-000000000002', 3)$$,
  '42501', null, 'manager cannot insert a skill row for an out-of-scope member');

-- 54..60: Manager immutability on subordinate, own-row return block, reviewed_by spoofing guards
select throws_ok(
  $$update public.member_skills set member_id = '30000000-0000-0000-0000-000000000002'
    where id = '30600000-0000-0000-0000-000000000001'$$,
  '42501', null, 'manager cannot mutate member_id on subordinate row');
select throws_ok(
  $$update public.member_skills set skill_id = '30500000-0000-0000-0000-000000000003'
    where id = '30600000-0000-0000-0000-000000000001'$$,
  '42501', null, 'manager cannot mutate skill_id on subordinate row');
select throws_ok(
  $$update public.member_skills set verification_status = 'returned', review_note = 'Self return'
    where id = '30600000-0000-0000-0000-000000000003'$$,
  '42501', null, 'manager cannot return their own skill row');

insert into public.member_skills (id, member_id, skill_id, current_level, verification_status, reviewed_by)
  values ('30600000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000002', '30500000-0000-0000-0000-000000000002', 5, 'certified', '30000000-0000-0000-0000-000000000002');
select is(
  (select reviewed_by from public.member_skills where id = '30600000-0000-0000-0000-000000000005'),
  '30000000-0000-0000-0000-000000000003'::uuid,
  'manager insert cannot spoof reviewed_by');

update public.member_skills
  set verification_status = 'returned', review_note = 'Need RFC', reviewed_by = '30000000-0000-0000-0000-000000000001'
  where id = '30600000-0000-0000-0000-000000000005';
select is(
  (select reviewed_by from public.member_skills where id = '30600000-0000-0000-0000-000000000005'),
  '30000000-0000-0000-0000-000000000003'::uuid,
  'manager update to returned cannot spoof reviewed_by');

update public.member_skills
  set verification_status = 'certified', reviewed_by = '30000000-0000-0000-0000-000000000002'
  where id = '30600000-0000-0000-0000-000000000005';
select is(
  (select reviewed_by from public.member_skills where id = '30600000-0000-0000-0000-000000000005'),
  '30000000-0000-0000-0000-000000000003'::uuid,
  'manager update to certified cannot spoof reviewed_by');

update public.member_skills
  set evidence_note = 'Same status edit', reviewed_by = '30000000-0000-0000-0000-000000000001'
  where id = '30600000-0000-0000-0000-000000000005';
select is(
  (select reviewed_by from public.member_skills where id = '30600000-0000-0000-0000-000000000005'),
  '30000000-0000-0000-0000-000000000003'::uuid,
  'manager same-status update preserves existing reviewed_by instead of accepting spoofed UUID');
select pg_temp.logout();

-- 61..63: Member cannot modify review_note on returned row; editing returned row at level <= 4 clears review_note & resets to self_assessed
select pg_temp.login_as('30a00000-0000-0000-0000-000000000001');
update public.member_skills set current_level = 5 where id = '30600000-0000-0000-0000-000000000002';
select pg_temp.logout();

select pg_temp.login_as('30a00000-0000-0000-0000-00000000000c');
update public.member_skills
  set verification_status = 'returned', review_note = 'Add architecture RFC'
  where id = '30600000-0000-0000-0000-000000000002';
select pg_temp.logout();

select pg_temp.login_as('30a00000-0000-0000-0000-000000000001');
select throws_ok(
  $$update public.member_skills set review_note = 'Tampered note' where id = '30600000-0000-0000-0000-000000000002'$$,
  '42501', null, 'member cannot modify review_note on a returned row');
select lives_ok(
  $$update public.member_skills set evidence_note = 'Keeping level 4 with updated evidence'
    where id = '30600000-0000-0000-0000-000000000002'$$,
  'member edits returned row at level <= 4');
select ok(
  (select current_level = 4
      and verification_status = 'self_assessed'
      and manager_endorsement_requested = false
      and review_note is null
      and reviewed_by is null
      and reviewed_at is null
    from public.member_skills where id = '30600000-0000-0000-0000-000000000002'),
  'editing returned row at level <= 4 resets to self_assessed and clears review stamps/note');
select pg_temp.logout();

-- 64..67: Reviewer pending_review < 5 normalization, review_note rules/length checks, and pending_review level=5 constraint
select pg_temp.login_as('30a00000-0000-0000-0000-00000000000c');
update public.member_skills
  set current_level = 3, verification_status = 'pending_review'
  where id = '30600000-0000-0000-0000-000000000002';
select ok(
  (select verification_status = 'self_assessed' and manager_endorsement_requested = false
    from public.member_skills where id = '30600000-0000-0000-0000-000000000002'),
  'reviewer setting pending_review at level < 5 normalizes to self_assessed');
select throws_ok(
  $$update public.member_skills set verification_status = 'returned', review_note = repeat('a', 1001)
    where id = '30600000-0000-0000-0000-000000000002'$$,
  '23514', null, 'rejects review_note exceeding 1000 characters');
select pg_temp.logout();

select throws_ok(
  $$update public.member_skills set verification_status = 'self_assessed', review_note = 'Stray note'
    where id = '30600000-0000-0000-0000-000000000002'$$,
  '23514', null, 'member_skills_review_note_rules rejects non-null review_note when not returned');
select throws_ok(
  $$update public.member_skills set current_level = 3, verification_status = 'pending_review'
    where id = '30600000-0000-0000-0000-000000000002'$$,
  '23514', null, 'member_skills_pending_review_level_check rejects pending_review below level 5');

-- 68: Level 5 is never stored as self-rated, even by a reviewer writing a managed member's row
select pg_temp.login_as('30a00000-0000-0000-0000-00000000000c');
select throws_ok(
  $$update public.member_skills set current_level = 5, verification_status = 'self_assessed'
    where id = '30600000-0000-0000-0000-000000000002'$$,
  '23514', null, 'member_skills_level5_reviewed_check rejects Level 5 without review');
select pg_temp.logout();

select * from finish();
rollback;
