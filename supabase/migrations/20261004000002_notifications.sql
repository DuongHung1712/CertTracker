-- One row per (kind, period, recipient). See docs/decisions.md #36: the row is a claim that moves
-- pending -> sent | failed, so a failed send can be retried while a sent one never repeats.
create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('expiry-alert', 'monthly-report')),
  period text not null,
  recipient_email extensions.citext not null check (position('@' in recipient_email::text) > 1),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts int not null default 1 check (attempts >= 1),
  error text,
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  provider_message_id text,
  created_at timestamptz not null default now(),
  unique (kind, period, recipient_email),
  constraint period_matches_kind check (
    (kind = 'expiry-alert' and period ~ '^\d{4}-W\d{2}$')
    or (kind = 'monthly-report' and period ~ '^\d{4}-\d{2}$')
  ),
  constraint sent_at_iff_sent check ((status = 'sent') = (sent_at is not null))
);
create index notification_log_period_idx on public.notification_log (kind, period);

alter table public.notification_log enable row level security;

-- Admin reads the history (Settings page). Nobody writes through the API: the cron uses the service role,
-- which bypasses RLS. Managers and members have no policy, i.e. no access.
create policy "notification_log: admin read" on public.notification_log
  for select to authenticated
  using ((select public.app_role()) = 'admin');

-- Supabase's default privileges grant everything to anon/authenticated; RLS would block writes, but take them away.
revoke all on public.notification_log from anon, authenticated;
grant select on public.notification_log to authenticated;

-- Atomically claim the right to send. Returns claimed = true when this caller must send; otherwise the
-- existing row's status tells why (sent: done already; pending: another worker holds it).
-- A claim is taken over when the previous attempt failed, or was left pending for more than 15 minutes
-- (the worker died). ON CONFLICT DO UPDATE ... WHERE locks the row, so two callers never both win.
create function public.claim_notification(p_kind text, p_period text, p_email text)
returns table (claimed boolean, log_id uuid, log_status text)
language plpgsql
set search_path = ''
as $$
declare
  v_email extensions.citext := lower(btrim(p_email));
  v_id uuid;
begin
  insert into public.notification_log as n (kind, period, recipient_email)
  values (p_kind, p_period, v_email)
  on conflict (kind, period, recipient_email) do update
    set status = 'pending', attempts = n.attempts + 1, claimed_at = now(), error = null
    where n.status = 'failed'
       or (n.status = 'pending' and n.claimed_at < now() - interval '15 minutes')
  returning n.id into v_id;

  if v_id is not null then
    return query select true, v_id, 'pending'::text;
    return;
  end if;

  return query
    select false, n.id, n.status
    from public.notification_log n
    where n.kind = p_kind and n.period = p_period and n.recipient_email = v_email;
end;
$$;

-- The people who may receive mail as staff: admins and managers with a usable login. Returns e-mail addresses,
-- which is why it is callable by the service role ONLY (decisions #35). The allow-list on role keeps any
-- future role (e.g. a pending sign-up) out by default.
create function public.notification_staff()
returns table (user_id uuid, email text, role public.user_role, member_id uuid, team_ids uuid[])
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.user_id,
    u.email::text,
    p.role,
    p.member_id,
    array(select tm.team_id from public.team_managers tm where tm.user_id = p.user_id order by tm.team_id)
  from public.profiles p
  join auth.users u on u.id = p.user_id
  where p.role in ('admin', 'manager')
    and u.email is not null
    and u.email_confirmed_at is not null
    and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= now());
$$;

revoke execute on function public.claim_notification(text, text, text) from public, anon, authenticated;
revoke execute on function public.notification_staff() from public, anon, authenticated;
grant execute on function public.claim_notification(text, text, text) to service_role;
grant execute on function public.notification_staff() to service_role;
