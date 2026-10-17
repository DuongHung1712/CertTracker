begin;
create extension if not exists pgtap with schema extensions;
select plan(51);

create function pg_temp.login_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

-- Fixtures (as postgres; RLS bypassed). Seed rows exist too, so assertions on staff filter to these ids.
insert into public.dcs (id, name) values ('d1000000-0000-0000-0000-0000000000d1', 'NT DC');
insert into public.programs (id, name, dc_id)
  values ('d1000000-0000-0000-0000-0000000000f1', 'NT Program', 'd1000000-0000-0000-0000-0000000000d1');
insert into public.teams (id, name, program_id) values
  ('d1000000-0000-0000-0000-00000000a001', 'NT Team A', 'd1000000-0000-0000-0000-0000000000f1'),
  ('d1000000-0000-0000-0000-00000000a002', 'NT Team B', 'd1000000-0000-0000-0000-0000000000f1');

-- email_confirmed_at is set explicitly everywhere: notification_staff() filters on it and the column defaults to null.
insert into auth.users (id, email, email_confirmed_at, banned_until, deleted_at) values
  ('d1000000-0000-0000-0000-00000000f001', 'n-admin@test.local',       now(), null, null),
  ('d1000000-0000-0000-0000-00000000f002', 'n-manager@test.local',     now(), null, null),
  ('d1000000-0000-0000-0000-00000000f003', 'n-unconfirmed@test.local', null,  null, null),
  ('d1000000-0000-0000-0000-00000000f004', 'n-banned@test.local',      now(), now() + interval '1 day', null),
  ('d1000000-0000-0000-0000-00000000f005', 'n-deleted@test.local',     now(), null, now()),
  ('d1000000-0000-0000-0000-00000000f006', 'n-member@test.local',      now(), null, null),
  ('d1000000-0000-0000-0000-00000000f007', 'n-expiredban@test.local',  now(), now() - interval '1 day', null);
update public.profiles set role = 'admin' where user_id = 'd1000000-0000-0000-0000-00000000f001';
update public.profiles set role = 'manager'
  where user_id in ('d1000000-0000-0000-0000-00000000f002', 'd1000000-0000-0000-0000-00000000f003',
                    'd1000000-0000-0000-0000-00000000f004', 'd1000000-0000-0000-0000-00000000f005',
                    'd1000000-0000-0000-0000-00000000f007');
insert into public.team_managers (team_id, user_id) values
  ('d1000000-0000-0000-0000-00000000a001', 'd1000000-0000-0000-0000-00000000f002'),
  ('d1000000-0000-0000-0000-00000000a002', 'd1000000-0000-0000-0000-00000000f002'),
  ('d1000000-0000-0000-0000-00000000a001', 'd1000000-0000-0000-0000-00000000f007');

-- ===== claim_notification (as postgres) =====
-- 1-2: first claim wins; the e-mail is trimmed and case-insensitive, so the repeat hits the same row.
select results_eq(
  $$select claimed, log_status from public.claim_notification('expiry-alert', '2026-W41', 'A@Test.Local ')$$,
  $$values (true, 'pending'::text)$$,
  'first claim wins and is pending');
select is(
  (select recipient_email::text from public.notification_log where kind = 'expiry-alert' and period = '2026-W41'),
  'a@test.local', 'recipient e-mail is stored trimmed and lowercased');
select results_eq(
  $$select claimed, log_status, log_id = (select id from public.notification_log
        where kind = 'expiry-alert' and period = '2026-W41' and recipient_email = 'a@test.local')
      from public.claim_notification('expiry-alert', '2026-W41', 'a@test.local')$$,
  $$values (false, 'pending'::text, true)$$,
  'a second claim for the same row is refused and points at the existing row');
select is(
  (select count(*) from public.notification_log where kind = 'expiry-alert' and period = '2026-W41'),
  1::bigint, 'trim + citext: both spellings are one row');

-- sent is final, even when claimed_at is ancient
update public.notification_log set status = 'sent', sent_at = now(), claimed_at = now() - interval '2 days'
  where recipient_email = 'a@test.local' and kind = 'expiry-alert';
select results_eq(
  $$select claimed, log_status from public.claim_notification('expiry-alert', '2026-W41', 'a@test.local')$$,
  $$values (false, 'sent'::text)$$,
  'a sent row is never reclaimed');
select is(
  (select attempts from public.notification_log where recipient_email = 'a@test.local' and kind = 'expiry-alert'),
  1, 'a refused claim does not bump attempts');

-- failed -> reclaimed
do $$ begin perform public.claim_notification('expiry-alert', '2026-W41', 'failed@test.local'); end $$;
update public.notification_log set status = 'failed', error = 'boom' where recipient_email = 'failed@test.local';
select results_eq(
  $$select claimed, log_status from public.claim_notification('expiry-alert', '2026-W41', 'failed@test.local')$$,
  $$values (true, 'pending'::text)$$,
  'a failed row is reclaimed');
select is(
  (select attempts from public.notification_log where recipient_email = 'failed@test.local'),
  2, 'reclaiming a failed row bumps attempts to 2');
select is(
  (select error from public.notification_log where recipient_email = 'failed@test.local'),
  null, 'reclaiming a failed row clears the error');

-- stale pending (> 15 minutes) -> reclaimed
do $$ begin perform public.claim_notification('expiry-alert', '2026-W41', 'stale@test.local'); end $$;
update public.notification_log set claimed_at = now() - interval '20 minutes' where recipient_email = 'stale@test.local';
select results_eq(
  $$select claimed, log_status from public.claim_notification('expiry-alert', '2026-W41', 'stale@test.local')$$,
  $$values (true, 'pending'::text)$$,
  'a pending row older than 15 minutes is taken over');
select is(
  (select attempts from public.notification_log where recipient_email = 'stale@test.local'),
  2, 'taking over a stale pending row bumps attempts');
select ok(
  (select claimed_at > now() - interval '1 minute' from public.notification_log where recipient_email = 'stale@test.local'),
  'taking over a stale pending row refreshes claimed_at');

-- fresh pending (< 15 minutes) -> not reclaimed
do $$ begin perform public.claim_notification('expiry-alert', '2026-W41', 'fresh@test.local'); end $$;
update public.notification_log set claimed_at = now() - interval '14 minutes' where recipient_email = 'fresh@test.local';
select results_eq(
  $$select claimed, log_status from public.claim_notification('expiry-alert', '2026-W41', 'fresh@test.local')$$,
  $$values (false, 'pending'::text)$$,
  'a pending row younger than 15 minutes is not taken over');
select is(
  (select attempts from public.notification_log where recipient_email = 'fresh@test.local'),
  1, 'a fresh pending row keeps attempts = 1');

-- another kind / period is a separate row
select results_eq(
  $$select claimed, log_status from public.claim_notification('monthly-report', '2026-09', 'a@test.local')$$,
  $$values (true, 'pending'::text)$$,
  'the same e-mail under another kind is claimed independently');
select results_eq(
  $$select claimed, log_status from public.claim_notification('expiry-alert', '2026-W42', 'a@test.local')$$,
  $$values (true, 'pending'::text)$$,
  'the same e-mail in another period is claimed independently');

-- claim token: log_attempts is 1 on the first claim and 2 after a failed reclaim
select results_eq(
  $$select claimed, log_attempts from public.claim_notification('expiry-alert', '2026-W41', 'token@test.local')$$,
  $$values (true, 1)$$,
  'the first claim returns attempts = 1');
update public.notification_log set status = 'failed', error = 'boom' where recipient_email = 'token@test.local';
select results_eq(
  $$select claimed, log_attempts from public.claim_notification('expiry-alert', '2026-W41', 'token@test.local')$$,
  $$values (true, 2)$$,
  'a failed reclaim returns attempts = 2');

-- a row that holds a mixed-case e-mail (Studio edit, backfill, direct insert) is still found, not an empty result
insert into public.notification_log (kind, period, recipient_email, status, sent_at)
  values ('expiry-alert', '2026-W41', 'Mixed@Test.Local', 'sent', now());
select results_eq(
  $$select claimed, log_status, log_attempts from public.claim_notification('expiry-alert', '2026-W41', 'mixed@test.local')$$,
  $$values (false, 'sent'::text, 1)$$,
  'a claim hitting a mixed-case stored e-mail reports the existing sent row');

-- ===== table constraints =====
select throws_ok(
  $$insert into public.notification_log (kind, period, recipient_email) values ('expiry-alert', '2026-09', 'c1@test.local')$$,
  '23514', null, 'expiry-alert needs a week period');
select throws_ok(
  $$insert into public.notification_log (kind, period, recipient_email) values ('monthly-report', '2026-W41', 'c2@test.local')$$,
  '23514', null, 'monthly-report needs a month period');
select throws_ok(
  $$insert into public.notification_log (kind, period, recipient_email) values ('other', '2026-09', 'c3@test.local')$$,
  '23514', null, 'unknown kind is rejected');
select throws_ok(
  $$update public.notification_log set status = 'sent' where recipient_email = 'fresh@test.local'$$,
  '23514', null, 'status sent requires sent_at');
select throws_ok(
  $$update public.notification_log set sent_at = now() where recipient_email = 'fresh@test.local'$$,
  '23514', null, 'sent_at requires status sent');
select throws_ok(
  $$update public.notification_log set status = 'weird' where recipient_email = 'fresh@test.local'$$,
  '23514', null, 'unknown status is rejected');
select throws_ok(
  $$insert into public.notification_log (kind, period, recipient_email) values ('monthly-report', '2026-10', 'no-at-sign')$$,
  '23514', null, 'recipient without @ is rejected');
select throws_ok(
  $$insert into public.notification_log (kind, period, recipient_email) values ('monthly-report', '2026-10', '@test.local')$$,
  '23514', null, 'recipient with nothing before @ is rejected');
select throws_ok(
  $$insert into public.notification_log (kind, period, recipient_email) values ('expiry-alert', '2026-W41', 'A@TEST.local')$$,
  '23505', null, 'unique (kind, period, recipient) is case-insensitive');

-- ===== RLS =====
select pg_temp.login_as('d1000000-0000-0000-0000-00000000f001');
select ok((select count(*) from public.notification_log) > 0, 'admin reads the log');
select throws_ok(
  $$insert into public.notification_log (kind, period, recipient_email) values ('monthly-report', '2026-10', 'x@test.local')$$,
  '42501', null, 'admin cannot insert through the API');
select throws_ok(
  $$update public.notification_log set error = 'x'$$,
  '42501', null, 'admin cannot update through the API');
select throws_ok(
  $$delete from public.notification_log$$,
  '42501', null, 'admin cannot delete through the API');
-- ===== function grants: even an admin session may not call them =====
select throws_ok(
  $$select * from public.claim_notification('expiry-alert', '2026-W43', 'g@test.local')$$,
  '42501', null, 'authenticated (admin) cannot call claim_notification');
select throws_ok(
  $$select * from public.notification_staff()$$,
  '42501', null, 'authenticated (admin) cannot call notification_staff');
reset role;

select pg_temp.login_as('d1000000-0000-0000-0000-00000000f002');
select is((select count(*) from public.notification_log), 0::bigint, 'manager sees no log rows');
select throws_ok(
  $$insert into public.notification_log (kind, period, recipient_email) values ('monthly-report', '2026-10', 'x@test.local')$$,
  '42501', null, 'manager cannot insert');
reset role;

select pg_temp.login_as('d1000000-0000-0000-0000-00000000f006');
select is((select count(*) from public.notification_log), 0::bigint, 'member sees no log rows');
reset role;

set local role anon;
select throws_ok($$select count(*) from public.notification_log$$, '42501', null, 'anon cannot read the log');
select throws_ok(
  $$select * from public.claim_notification('expiry-alert', '2026-W43', 'g@test.local')$$,
  '42501', null, 'anon cannot call claim_notification');
select throws_ok(
  $$select * from public.notification_staff()$$,
  '42501', null, 'anon cannot call notification_staff');
reset role;

-- ===== service_role: the only caller of the functions =====
set local role service_role;
select results_eq(
  $$select claimed, log_status from public.claim_notification('expiry-alert', '2026-W43', 'svc@test.local')$$,
  $$values (true, 'pending'::text)$$,
  'service_role can claim');
select results_eq(
  $$select email from public.notification_staff() where user_id::text like 'd1000000-%' order by email$$,
  array['n-admin@test.local', 'n-expiredban@test.local', 'n-manager@test.local'],
  'staff = confirmed, not deleted, not (currently) banned admins and managers');
select is(
  (select count(*) from public.notification_staff() where email = 'n-unconfirmed@test.local'),
  0::bigint, 'staff excludes an unconfirmed e-mail');
select is(
  (select count(*) from public.notification_staff() where email = 'n-banned@test.local'),
  0::bigint, 'staff excludes a banned user');
select is(
  (select count(*) from public.notification_staff() where email = 'n-deleted@test.local'),
  0::bigint, 'staff excludes a deleted user');
select is(
  (select count(*) from public.notification_staff() where email = 'n-member@test.local'),
  0::bigint, 'staff excludes members');
select results_eq(
  $$select role::text, array_length(team_ids, 1) from public.notification_staff() where email = 'n-manager@test.local'$$,
  $$values ('manager', 2)$$,
  'the manager row has role manager and both managed teams');
select is(
  (select cardinality(team_ids) from public.notification_staff() where email = 'n-admin@test.local'),
  0, 'the admin row has no team ids');
select is(
  (select cardinality(team_ids) from public.notification_staff() where email = 'n-expiredban@test.local'),
  1, 'team ids are per user');
reset role;

-- ===== shape =====
select has_table('public', 'notification_log', 'table exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.notification_log'::regclass),
  true, 'RLS is enabled');

select * from finish();
rollback;
