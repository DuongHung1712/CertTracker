-- Hardens member_skills review stamping, enforces pending_review level=5 invariant,
-- and safely normalizes pre-existing local seed/stale rows without requiring db reset.

-- 1. Normalize any pre-existing invalid pending_review rows (level < 5) safely.
update public.member_skills
set
  verification_status = 'self_assessed',
  manager_endorsement_requested = false
where verification_status = 'pending_review'
  and current_level < 5;

-- 2. Sync seed demo rows on already-seeded local DBs (no-op when seed members are absent).
update public.member_skills
set
  verification_status = 'self_assessed',
  manager_endorsement_requested = false
where member_id = '5eed0000-0000-0000-0000-00000000b003'
  and skill_id <> '5eed0000-0000-0000-0000-00000000a213'
  and verification_status = 'certified'
  and reviewed_by is null;

update public.member_skills
set
  current_level = 5,
  verification_status = 'pending_review',
  manager_endorsement_requested = true,
  evidence_note = 'Submitted RFC for asynchronous export worker queue. Endorsement review requested from DC Manager for Level 5 DC Master.'
where member_id = '5eed0000-0000-0000-0000-00000000b003'
  and skill_id = '5eed0000-0000-0000-0000-00000000a213'
  and current_level = 3
  and reviewed_by is null;

insert into public.member_skills (
  member_id, skill_id, current_level, years_of_experience,
  verification_status, manager_endorsement_requested, evidence_note, last_evaluated_at
)
select
  '5eed0000-0000-0000-0000-00000000b001',
  '5eed0000-0000-0000-0000-00000000a201',
  4,
  4.0,
  'self_assessed',
  false,
  'Designed and operated multi-AZ AWS production workloads backed by AWS SAA certification.',
  '2026-10-15'
where exists (select 1 from public.members where id = '5eed0000-0000-0000-0000-00000000b001')
  and exists (select 1 from public.skills where id = '5eed0000-0000-0000-0000-00000000a201')
on conflict (member_id, skill_id) do nothing;

-- 3. Enforce invariant: pending_review only applies to Level 5 requests.
alter table public.member_skills
  drop constraint if exists member_skills_pending_review_level_check,
  add constraint member_skills_pending_review_level_check
    check (verification_status is distinct from 'pending_review' or current_level = 5);

-- 4. Harden reviewer stamping (prevent reviewed_by spoofing; match submit_and_approve pattern)
--    and normalize reviewer-saved pending_review below Level 5.
create or replace function public.member_skills_review_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role := public.app_role();
  v_my_member_id uuid := public.my_member_id();
  v_old public.member_skills;
begin
  -- Migrations, seed.sql, and superuser / pgTAP trusted setup have no auth.uid().
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_old := old;
    if new.member_id is distinct from v_old.member_id
       or new.skill_id is distinct from v_old.skill_id then
      raise exception 'member_id and skill_id cannot be changed' using errcode = '42501';
    end if;
  end if;

  -- Self-rating branch: members, or managers acting on their own row.
  if v_role is distinct from 'admin'
     and (v_role is distinct from 'manager' or new.member_id is not distinct from v_my_member_id) then
    if tg_op = 'INSERT' then
      if new.verification_status in ('certified', 'returned')
         or new.reviewed_by is not null
         or new.reviewed_at is not null
         or new.review_note is not null then
        raise exception 'you cannot certify or review your own skill' using errcode = '42501';
      end if;

      if new.current_level = 5 then
        new.verification_status := 'pending_review';
        new.manager_endorsement_requested := true;
      else
        new.verification_status := 'self_assessed';
        new.manager_endorsement_requested := false;
      end if;

      return new;
    end if;

    -- UPDATE in self-rating branch
    if new.verification_status in ('certified', 'returned')
       and new.verification_status is distinct from v_old.verification_status then
      raise exception 'you cannot certify or review your own skill' using errcode = '42501';
    end if;

    if new.reviewed_by is distinct from v_old.reviewed_by
       or new.reviewed_at is distinct from v_old.reviewed_at
       or new.review_note is distinct from v_old.review_note then
      raise exception 'you cannot modify review fields on your own skill' using errcode = '42501';
    end if;

    if new.current_level is distinct from v_old.current_level
       or v_old.verification_status = 'returned' then
      new.reviewed_by := null;
      new.reviewed_at := null;
      new.review_note := null;
      if new.current_level = 5 then
        new.verification_status := 'pending_review';
        new.manager_endorsement_requested := true;
      else
        new.verification_status := 'self_assessed';
        new.manager_endorsement_requested := false;
      end if;
    elsif v_old.verification_status = 'certified' then
      -- Preserve an already-endorsed status when editing notes or YoE without changing level.
      new.verification_status := 'certified';
      new.manager_endorsement_requested := false;
    elsif new.current_level = 5 then
      new.verification_status := 'pending_review';
      new.manager_endorsement_requested := true;
    else
      new.verification_status := 'self_assessed';
      new.manager_endorsement_requested := false;
    end if;

    return new;
  end if;

  -- Reviewer branch: admin, or manager acting on another member's row in scope.
  if new.verification_status in ('certified', 'returned') then
    new.manager_endorsement_requested := false;
    if new.verification_status = 'certified' then
      new.review_note := null;
    else
      new.current_level := least(coalesce(new.current_level, v_old.current_level, 4), 4);
    end if;

    if tg_op = 'INSERT'
       or new.verification_status is distinct from v_old.verification_status
       or new.review_note is distinct from v_old.review_note then
      new.reviewed_by := v_my_member_id;
      new.reviewed_at := now();
    else
      new.reviewed_by := v_old.reviewed_by;
      new.reviewed_at := v_old.reviewed_at;
    end if;
  else
    if new.verification_status = 'pending_review' and new.current_level <> 5 then
      new.verification_status := 'self_assessed';
    end if;
    new.review_note := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.manager_endorsement_requested := (new.verification_status = 'pending_review' and new.current_level = 5);
  end if;

  return new;
end;
$$;
