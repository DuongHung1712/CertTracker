-- One record per member per course; a renewal updates issued_date on the same row (decisions.md #15).
alter table public.training_records
  add constraint training_records_member_course_key unique (member_id, course_id);

-- Columns may only be appended to an existing view; the first columns must stay exactly as they were.
create or replace view public.v_training_records
with (security_invoker = true)
as
select
  r.*,
  c.name as course_name,
  c.validity_months,
  e.expiry_date,
  e.expiry_date - public.vn_today() as days_to_expiry,
  public.expiry_status(r.issued_date, c.validity_months, public.vn_today()) as expiry_status,
  m.code as member_code,
  m.full_name as member_name,
  m.email::text as member_email,
  m.team_id,
  t.name as team_name,
  c.cert_type_id,
  ct.name as cert_type_name,
  c.provider_id,
  p.name as provider_name
from public.training_records r
join public.courses c on c.id = r.course_id
join public.members m on m.id = r.member_id
left join public.teams t on t.id = m.team_id
left join public.cert_types ct on ct.id = c.cert_type_id
left join public.providers p on p.id = c.provider_id
cross join lateral (
  select case
    when r.issued_date is not null and c.validity_months is not null
      then (r.issued_date + make_interval(months => c.validity_months))::date
  end as expiry_date
) e;

-- Evidence files: certificates/{member_id}/{record_id}/{file}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('certificates', 'certificates', false, 4194304,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Text comparison on purpose: casting a malformed first path segment to uuid would raise
-- instead of denying.
create function public.can_access_evidence(object_name text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select
    public.app_role() = 'admin'
    or split_part(object_name, '/', 1) = public.my_member_id()::text
    or split_part(object_name, '/', 1) in (select ids::text from public.managed_member_ids() as ids);
$$;

create policy "certificates: read" on storage.objects
  for select to authenticated
  using (bucket_id = 'certificates' and public.can_access_evidence(name));
create policy "certificates: insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'certificates' and public.can_access_evidence(name));
create policy "certificates: update" on storage.objects
  for update to authenticated
  using (bucket_id = 'certificates' and public.can_access_evidence(name))
  with check (bucket_id = 'certificates' and public.can_access_evidence(name));
create policy "certificates: delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'certificates' and public.can_access_evidence(name));

-- Realtime: the records list refreshes on change. Guarded so the migration also runs where the
-- publication does not exist.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.training_records;
  end if;
end
$$;
