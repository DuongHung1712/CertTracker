-- Level 5 always needs a review: a Level 5 row is either waiting (pending_review) or endorsed (certified).
-- The self-rating trigger branch already enforces this; the reviewer branch (admin, or a manager on a
-- managed member's row) did not, so a direct API update could store Level 5 as self_assessed.
-- 'returned' is clamped to Level 4 by the trigger, so it never meets this check.

update public.member_skills
set
  verification_status = 'pending_review',
  manager_endorsement_requested = true
where current_level = 5
  and verification_status = 'self_assessed';

alter table public.member_skills
  drop constraint if exists member_skills_level5_reviewed_check,
  add constraint member_skills_level5_reviewed_check
    check (current_level < 5 or verification_status in ('pending_review', 'certified'));
