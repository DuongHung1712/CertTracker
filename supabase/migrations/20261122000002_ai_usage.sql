-- AI gateway state (decision #75): per-feature switch and daily limit, plus one usage row per provider call.
-- Plain Postgres on purpose: no auth.uid(), no role checks inside. Only service_role may touch these objects, so the
-- same tables can later sit behind a separate service. RLS is on with no policy: admin, manager and member are all refused.

create table public.ai_feature_flags (
  feature text primary key,
  enabled boolean not null default false,
  daily_limit int not null check (daily_limit > 0)
);

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  feature text not null,
  -- The member code is a pseudonym and the key of the limit. Never a name, e-mail, file or prompt text.
  member_code text not null,
  input_tokens int,
  output_tokens int,
  cost_micro_usd bigint,
  outcome text not null check (outcome in ('pending', 'ok', 'unreadable', 'timeout', 'provider_error', 'invalid_output')),
  created_at timestamptz not null default now()
);
create index ai_usage_limit_idx on public.ai_usage (feature, member_code, day);

alter table public.ai_feature_flags enable row level security;
alter table public.ai_usage enable row level security;

revoke all on table public.ai_feature_flags, public.ai_usage from public, anon, authenticated;
grant select on table public.ai_feature_flags, public.ai_usage to service_role;

insert into public.ai_feature_flags (feature, enabled, daily_limit) values ('certificate-reader', false, 10);

-- Check the switch and the limit and record the call in one transaction. The advisory lock serialises one member's
-- parallel requests, so two of them cannot both pass the limit. A 'pending' row counts at once, so a crashed call still counts.
create function public.claim_ai_call(p_feature text, p_member_code text)
returns table (usage_id uuid, refusal text)
language plpgsql
set search_path = ''
as $$
declare
  v_enabled boolean;
  v_limit int;
  v_day date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_used int;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_feature || ':' || p_member_code));

  select f.enabled, f.daily_limit into v_enabled, v_limit from public.ai_feature_flags f where f.feature = p_feature;
  if not found or not v_enabled then
    return query select null::uuid, 'disabled'::text;
    return;
  end if;

  select count(*) into v_used from public.ai_usage u
    where u.feature = p_feature and u.member_code = p_member_code and u.day = v_day;
  if v_used >= v_limit then
    return query select null::uuid, 'daily_limit'::text;
    return;
  end if;

  insert into public.ai_usage (day, feature, member_code, outcome) values (v_day, p_feature, p_member_code, 'pending')
    returning id into v_id;
  return query select v_id, null::text;
end;
$$;

create function public.finish_ai_call(p_id uuid, p_input int, p_output int, p_cost bigint, p_outcome text)
returns void
language sql
set search_path = ''
as $$
  update public.ai_usage
     set input_tokens = p_input, output_tokens = p_output, cost_micro_usd = p_cost, outcome = p_outcome
   where id = p_id;
$$;

revoke execute on function public.claim_ai_call(text, text) from public, anon, authenticated;
revoke execute on function public.finish_ai_call(uuid, int, int, bigint, text) from public, anon, authenticated;
grant execute on function public.claim_ai_call(text, text) to service_role;
grant execute on function public.finish_ai_call(uuid, int, int, bigint, text) to service_role;
