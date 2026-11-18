-- Allow members to delete their own training records when not started, in progress, or returned.
create policy "training_records: member delete draft or returned own" on public.training_records
  for delete to authenticated
  using (
    member_id = (select public.my_member_id())
    and (status in ('not_started', 'in_progress') or approval = 'returned')
  );
