-- Catalogue proposals join Data Quality (admin only): a member-proposed course or certificate that waits for
-- approval is a row, so the admin sees it in one list and on the Dashboard. Same column contract as before:
-- `certificate_name` carries the proposal's name, `member_*` the proposer, `days` how long it has waited.

create or replace view public.v_data_quality_issues
with (security_invoker = true)
as
select
  'overdue_exam'::text as issue_type,
  'warning'::text as severity,
  li.id as subject_id,
  li.member_id,
  m.code as member_code,
  m.full_name as member_name,
  m.team_id,
  t.name as team_name,
  li.target_certificate_id as certificate_id,
  c.name as certificate_name,
  li.id as record_id,
  li.planned_date as since,
  public.vn_today() - li.planned_date as days
from public.learning_items li
join public.members m on m.id = li.member_id
join public.certificates c on c.id = li.target_certificate_id
left join public.teams t on t.id = m.team_id
where m.is_active
  and li.status <> 'done'
  and li.planned_date < public.vn_today()

union all
select
  'done_no_evidence', 'warning',
  r.id, r.member_id, m.code, m.full_name, m.team_id, t.name,
  r.certificate_id, c.name, r.id,
  r.issued_date,
  public.vn_today() - r.issued_date
from public.training_records r
join public.members m on m.id = r.member_id
join public.certificates c on c.id = r.certificate_id
left join public.teams t on t.id = m.team_id
where m.is_active
  and r.status = 'done'
  and r.evidence_path is null
  and nullif(btrim(r.certificate_url), '') is null

union all
select
  'member_no_team', 'warning',
  m.id, m.id, m.code, m.full_name, null::uuid, null::text,
  null::uuid, null::text, null::uuid,
  (m.created_at at time zone 'Asia/Ho_Chi_Minh')::date,
  public.vn_today() - (m.created_at at time zone 'Asia/Ho_Chi_Minh')::date
from public.members m
where m.is_active
  and m.team_id is null
  and (select public.app_role()) = 'admin'

union all
select
  'certificate_no_validity', 'info',
  c.id, null::uuid, null::text, null::text, null::uuid, null::text,
  c.id, c.name, null::uuid,
  (c.created_at at time zone 'Asia/Ho_Chi_Minh')::date,
  public.vn_today() - (c.created_at at time zone 'Asia/Ho_Chi_Minh')::date
from public.certificates c
where c.kind = 'exam'
  and c.validity_months is null
  and (select public.app_role()) = 'admin'
  and exists (select 1 from public.training_records r where r.certificate_id = c.id)

union all
select
  'course_proposal', 'warning',
  co.id, co.proposed_by, m.code, m.full_name, m.team_id, t.name,
  null::uuid, co.name, null::uuid,
  (co.created_at at time zone 'Asia/Ho_Chi_Minh')::date,
  public.vn_today() - (co.created_at at time zone 'Asia/Ho_Chi_Minh')::date
from public.courses co
left join public.members m on m.id = co.proposed_by
left join public.teams t on t.id = m.team_id
where co.catalogue_status = 'pending'
  and (select public.app_role()) = 'admin'

union all
select
  'certificate_proposal', 'warning',
  c.id, c.proposed_by, m.code, m.full_name, m.team_id, t.name,
  c.id, c.name, null::uuid,
  (c.created_at at time zone 'Asia/Ho_Chi_Minh')::date,
  public.vn_today() - (c.created_at at time zone 'Asia/Ho_Chi_Minh')::date
from public.certificates c
left join public.members m on m.id = c.proposed_by
left join public.teams t on t.id = m.team_id
where c.catalogue_status = 'pending'
  and (select public.app_role()) = 'admin';

-- Reject a certificate proposal (the same shape as reject_course). It stays visible to the proposer; it counts nowhere.
create function public.reject_certificate(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if public.app_role() is distinct from 'admin' then
    raise exception 'only admins can reject a certificate proposal' using errcode = '42501';
  end if;
  update public.certificates
    set catalogue_status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_id and catalogue_status = 'pending';
  if not found then
    raise exception 'proposal not found or already reviewed' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.reject_certificate(uuid) from public, anon;
grant execute on function public.reject_certificate(uuid) to authenticated;
