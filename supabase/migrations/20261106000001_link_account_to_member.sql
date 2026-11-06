-- Link a login to its member when the member is added after the login (spec 2026-11-06 §5.1).
-- handle_new_user() only covers the other order (login first). Only the admin (or no JWT: migrations,
-- seed, cron; the import runs with the admin's JWT) may cause a link: a manager editing an in-scope
-- member's e-mail must not hand that member's certificates to an unrelated login.
create function public.link_account_to_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and public.app_role() is distinct from 'admin' then
    return new;
  end if;

  -- A link is never moved: only an unlinked login, and only a member nobody points at yet.
  update public.profiles p
     set member_id = new.id
    from auth.users u
   where u.id = p.user_id
     and lower(u.email) = lower(new.email::text)
     and p.member_id is null
     and not exists (select 1 from public.profiles linked where linked.member_id = new.id);
  return new;
end;
$$;

create trigger members_link_account
  after insert or update of email on public.members
  for each row execute function public.link_account_to_member();

-- Same rule from the login side: skip a member that already has a login instead of failing on
-- profiles_member_id_key (an invite to an already-linked address must still create the profile).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into public.profiles (user_id, member_id)
  values (
    new.id,
    (select m.id from public.members m
      where m.email = new.email::extensions.citext
        and not exists (select 1 from public.profiles p where p.member_id = m.id))
  );
  return new;
end;
$$;
