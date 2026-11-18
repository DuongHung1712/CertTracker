-- WBS 15.4: a Completed item waits for the manager in scope or the admin (spec §10.1, plan 2026-11-17).
create type public.approval_state as enum ('waiting', 'approved', 'returned');

alter table public.training_records
  add column approval public.approval_state,
  add column approval_note text,
  add column reviewed_by uuid references auth.users (id) on delete set null,
  add column reviewed_at timestamptz;

-- Phase 1 data counts as approved (decision #61), so numbers do not drop on release day.
update public.training_records set approval = 'approved' where status = 'done';

alter table public.training_records
  add constraint approval_only_when_done check ((approval is not null) = (status = 'done')),
  add constraint approval_note_rules check (
    (approval = 'returned' and coalesce(btrim(approval_note), '') <> '')
    or (approval is distinct from 'returned' and approval_note is null)
  );

create function public.training_records_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role := public.app_role();
  v_old public.training_records;
  v_touched boolean;
  -- A manager is a member on their own row (in scope or not): they cannot approve themselves.
  v_member_rules boolean := v_role = 'member' or (v_role = 'manager' and new.member_id is not distinct from public.my_member_id());
begin
  -- A record belongs to one member for life; moving it would be a way round the own-row rule.
  if tg_op = 'UPDATE' and new.member_id is distinct from old.member_id and v_role is distinct from 'admin' then
    raise exception 'only an admin can move a record to another member' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    v_old := old;
  end if;

  if v_member_rules then
    -- A member can never approve or return, nor touch the review fields.
    if new.approval in ('approved', 'returned') and new.approval is distinct from v_old.approval
       or new.approval_note is distinct from v_old.approval_note
       or new.reviewed_by is distinct from v_old.reviewed_by
       or new.reviewed_at is distinct from v_old.reviewed_at then
      raise exception 'only a manager in scope or an admin can approve or return an item'
        using errcode = '42501';
    end if;
  end if;

  if new.status <> 'done' then
    new.approval := null;
    new.approval_note := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    return new;
  end if;

  if v_member_rules then
    -- A member cannot clear the state either: null means "keep".
    new.approval := coalesce(new.approval, v_old.approval);
    v_touched := tg_op = 'UPDATE' and v_old.status = 'done' and (
      new.certificate_id is distinct from v_old.certificate_id
      or new.course_id is distinct from v_old.course_id
      or new.issued_date is distinct from v_old.issued_date
      or new.certificate_url is distinct from v_old.certificate_url
      or new.evidence_path is distinct from v_old.evidence_path);
    if new.approval is null or v_old.status is distinct from 'done'
       or v_touched or new.approval = 'waiting' or v_old.approval = 'returned' then
      new.approval := 'waiting';
      new.approval_note := null;
      new.reviewed_by := null;
      new.reviewed_at := null;
    end if;
    return new;
  end if;

  -- Manager in scope, admin, or a trusted writer (imports, seed): an item they save as Completed is
  -- approved unless they explicitly set another state. "Explicit" means the state differs from the old row.
  if tg_op = 'INSERT' or v_old.status is distinct from 'done' then
    new.approval := coalesce(new.approval, 'approved');
  end if;
  if tg_op = 'INSERT' or new.approval is distinct from v_old.approval
     or new.approval_note is distinct from v_old.approval_note then
    if new.approval = 'waiting' then
      new.approval_note := null;
      new.reviewed_by := null;
      new.reviewed_at := null;
    else
      if new.approval = 'approved' then
        new.approval_note := null;
      end if;
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
    end if;
  end if;
  return new;
end;
$$;

-- Same-event BEFORE triggers fire in name order: "z_" runs after training_records_guard_member_fields
-- and training_records_course_matches_certificate, so it sees the final certificate and course.
create trigger training_records_z_approval
  before insert or update on public.training_records
  for each row execute function public.training_records_approval();

-- Columns keep their order; approval and approval_note are appended at the end.
create or replace view public.v_training_records
with (security_invoker = true)
as
select
  r.id, r.member_id, r.course_id, r.status, r.progress, r.planned_exam_date, r.issued_date,
  r.certificate_url, r.evidence_path, r.via_company, r.refund_status, r.notes,
  r.progress_updated_at, r.created_by, r.created_at, r.updated_at, r.certificate_id,
  ce.name as certificate_name,
  ce.kind as certificate_kind,
  co.name as course_name,
  ce.validity_months,
  e.expiry_date,
  e.expiry_date - public.vn_today() as days_to_expiry,
  case when ce.kind = 'completion' then 'No Expiry'
       else public.expiry_status(r.issued_date, ce.validity_months, public.vn_today()) end as expiry_status,
  m.code as member_code,
  m.full_name as member_name,
  m.email::text as member_email,
  m.team_id,
  t.name as team_name,
  ce.cert_type_id,
  ct.name as cert_type_name,
  ce.provider_id,
  p.name as provider_name,
  co.cost,
  co.cost_currency,
  co.est_hours,
  r.approval,
  r.approval_note
from public.training_records r
join public.certificates ce on ce.id = r.certificate_id
left join public.courses co on co.id = r.course_id
join public.members m on m.id = r.member_id
left join public.teams t on t.id = m.team_id
left join public.cert_types ct on ct.id = ce.cert_type_id
left join public.providers p on p.id = ce.provider_id
cross join lateral (
  select case
    when ce.kind = 'exam' and r.issued_date is not null and ce.validity_months is not null
      then (r.issued_date + make_interval(months => ce.validity_months))::date
  end as expiry_date
) e;
