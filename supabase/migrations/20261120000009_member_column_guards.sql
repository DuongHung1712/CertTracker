-- Column guards for rows members may write (rule .claude/rules/database.md: column limits by BEFORE trigger).

-- A member proposes a course by name and provider only; catalogue fields and review stamps are the admin's.
create function public.courses_member_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.app_role() is not distinct from 'admin' or auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.provider_id is not null or new.prepares_for_id is not null or new.cost is not null
       or new.cost_currency is not null or new.est_hours is not null or new.url is not null
       or new.refundable or new.refund_conditions is not null
       or new.reviewed_by is not null or new.reviewed_at is not null then
      raise exception 'only an admin can set catalogue fields on a course' using errcode = '42501';
    end if;
  elsif (new.provider_id, new.prepares_for_id, new.cost, new.cost_currency, new.est_hours, new.url,
         new.refundable, new.refund_conditions, new.reviewed_by, new.reviewed_at, new.proposed_by)
        is distinct from
        (old.provider_id, old.prepares_for_id, old.cost, old.cost_currency, old.est_hours, old.url,
         old.refundable, old.refund_conditions, old.reviewed_by, old.reviewed_at, old.proposed_by) then
    raise exception 'only an admin can change catalogue fields on a course' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger courses_member_columns
  before insert or update on public.courses
  for each row execute function public.courses_member_columns();

-- A member rates their own skills; "certified" and the review stamps come from their manager or an admin.
create function public.member_skills_review_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.app_role() is not distinct from 'admin' or auth.uid() is null
     or new.member_id is distinct from public.my_member_id() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.verification_status = 'certified' or new.reviewed_by is not null or new.reviewed_at is not null then
      raise exception 'you cannot certify your own skill' using errcode = '42501';
    end if;
  elsif (new.verification_status = 'certified' and old.verification_status <> 'certified')
        or (new.reviewed_by, new.reviewed_at) is distinct from (old.reviewed_by, old.reviewed_at) then
    raise exception 'you cannot certify your own skill' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger member_skills_review_columns
  before insert or update on public.member_skills
  for each row execute function public.member_skills_review_columns();
