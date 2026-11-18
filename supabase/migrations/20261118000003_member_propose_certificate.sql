-- Allow members to propose new certificates and course completions.
-- Proposals sit in certificates with catalogue_status = 'pending' until admin reviews them.

alter table public.certificates
  add column if not exists catalogue_status text not null default 'approved'
    check (catalogue_status in ('approved', 'pending', 'rejected')),
  add column if not exists proposed_by uuid references public.members (id) on delete set null,
  add column if not exists proposed_provider text,
  add column if not exists proposal_reason text,
  add column if not exists reviewed_by uuid references auth.users (id) on delete set null,
  add column if not exists reviewed_at timestamptz;

-- Relax course_id requirement for pending completions until an admin reviews & assigns a course.
alter table public.certificates drop constraint if exists certificates_completion_has_course;
alter table public.certificates add constraint certificates_completion_has_course
  check (catalogue_status = 'pending' or (kind = 'completion') = (course_id is not null));

-- Update v_training_records to expose certificate_catalogue_status and coalesce proposed_provider
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
  coalesce(p.name, ce.proposed_provider) as provider_name,
  co.cost,
  co.cost_currency,
  co.est_hours,
  r.approval,
  r.approval_note,
  ce.catalogue_status as certificate_catalogue_status
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

-- RLS: Members can insert their own pending proposals
create policy "certificates: member propose pending" on public.certificates
  for insert to authenticated
  with check (
    catalogue_status = 'pending'
    and proposed_by = (select public.my_member_id())
  );

-- RLS: Members can update their own pending proposals
create policy "certificates: member update own pending" on public.certificates
  for update to authenticated
  using (
    catalogue_status = 'pending'
    and proposed_by = (select public.my_member_id())
  )
  with check (
    catalogue_status = 'pending'
    and proposed_by = (select public.my_member_id())
  );
