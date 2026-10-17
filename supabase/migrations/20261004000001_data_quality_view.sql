-- Findings that CHECK/FK constraints cannot express (spec §6.4). One row per finding; the four
-- branches share one column contract so the app can render them in a single table.
--
-- security_invoker: RLS decides which rows each caller can read from the underlying tables.
-- The two non-record branches additionally require admin: a Manager cannot fix members without a
-- team or the course catalogue, and RLS alone would show catalogue findings to every role.
create view public.v_data_quality_issues
with (security_invoker = true)
as
-- Exam date passed and the record is not done.
select
  'overdue_exam'::text as issue_type,
  'warning'::text as severity,
  r.id as subject_id,
  r.member_id,
  m.code as member_code,
  m.full_name as member_name,
  m.team_id,
  t.name as team_name,
  r.course_id,
  c.name as course_name,
  r.id as record_id,
  r.planned_exam_date as since,
  public.vn_today() - r.planned_exam_date as days
from public.training_records r
join public.members m on m.id = r.member_id
join public.courses c on c.id = r.course_id
left join public.teams t on t.id = m.team_id
where m.is_active
  and r.status <> 'done'
  and r.planned_exam_date < public.vn_today()

union all
-- Done, but neither an evidence file nor a certificate link: nothing proves the certificate.
select
  'done_no_evidence', 'warning',
  r.id, r.member_id, m.code, m.full_name, m.team_id, t.name,
  r.course_id, c.name, r.id,
  r.issued_date,
  public.vn_today() - r.issued_date
from public.training_records r
join public.members m on m.id = r.member_id
join public.courses c on c.id = r.course_id
left join public.teams t on t.id = m.team_id
where m.is_active
  and r.status = 'done'
  and r.evidence_path is null
  and nullif(btrim(r.certificate_url), '') is null

union all
-- Active member that belongs to no team: invisible to every Manager.
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
-- Course without a validity period that people actually hold or study. NULL is a legitimate value
-- ("never expires"), so this is information, not an error — and unused catalogue entries are ignored.
select
  'course_no_validity', 'info',
  c.id, null::uuid, null::text, null::text, null::uuid, null::text,
  c.id, c.name, null::uuid,
  (c.created_at at time zone 'Asia/Ho_Chi_Minh')::date,
  public.vn_today() - (c.created_at at time zone 'Asia/Ho_Chi_Minh')::date
from public.courses c
where c.validity_months is null
  and (select public.app_role()) = 'admin'
  and exists (select 1 from public.training_records r where r.course_id = c.id);

-- Supabase's default privileges would let `anon` select; RLS would return no rows, but deny outright.
revoke all on public.v_data_quality_issues from anon;
grant select on public.v_data_quality_issues to authenticated;
