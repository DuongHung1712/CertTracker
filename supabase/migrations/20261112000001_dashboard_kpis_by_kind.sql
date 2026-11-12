-- The dashboard separates exam certificates from course completions (decision #65 addendum).
-- total_records and the done / in progress / not started columns still count every kind, so they reconcile:
--   done_records        = (active + expiring_60 + expiring_soon + expired + no_expiry) + completion_done_records
--   in_progress_records = exam in progress + completion_in_progress_records
-- The five expiry columns now hold exam certificates only: a completion never enters expiring or expired.
-- The return type gains two columns, which create or replace cannot do, so the function is dropped and
-- created again with the same security definer, search_path and grants.
drop function public.dashboard_kpis();

create function public.dashboard_kpis()
returns table (
  total_members int,
  total_records int,
  done_records int,
  in_progress_records int,
  not_started_records int,
  active_certs int,
  expiring_60_certs int,
  expiring_soon_certs int,
  expired_certs int,
  no_expiry_certs int,
  completion_done_records int,
  completion_in_progress_records int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if public.app_role() is null then
    raise exception 'the dashboard needs a signed-in user with a profile' using errcode = '42501';
  end if;

  return query
  with base as (
    select r.status,
           c.kind,
           public.expiry_status(r.issued_date, c.validity_months, public.vn_today()) as expiry
    from public.training_records r
    join public.members m on m.id = r.member_id and m.is_active
    join public.certificates c on c.id = r.certificate_id
  )
  select
    (select count(*) from public.members where is_active)::int,
    count(*)::int,
    (count(*) filter (where status = 'done'))::int,
    (count(*) filter (where status = 'in_progress'))::int,
    (count(*) filter (where status = 'not_started'))::int,
    (count(*) filter (where kind = 'exam' and status = 'done' and expiry = 'Active'))::int,
    (count(*) filter (where kind = 'exam' and status = 'done' and expiry = 'Expiring in 60d'))::int,
    (count(*) filter (where kind = 'exam' and status = 'done' and expiry = 'Expiring Soon'))::int,
    (count(*) filter (where kind = 'exam' and status = 'done' and expiry = 'Expired'))::int,
    (count(*) filter (where kind = 'exam' and status = 'done' and expiry = 'No Expiry'))::int,
    (count(*) filter (where kind = 'completion' and status = 'done'))::int,
    (count(*) filter (where kind = 'completion' and status = 'in_progress'))::int
  from base;
end;
$$;

-- Supabase grants EXECUTE on new functions to anon by default: take it away explicitly.
revoke execute on function public.dashboard_kpis() from public, anon;
grant execute on function public.dashboard_kpis() to authenticated;
