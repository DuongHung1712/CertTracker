-- A user edits only their own display name (owner, 2026-11-10). The e-mail stays admin-only because the
-- account is linked to the member by e-mail (decision #60). Same shape as set_my_career_start.
create function public.set_my_full_name(p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := public.my_member_id();
  v_name text := btrim(p_name);
begin
  if v_member_id is null then
    raise exception 'no member profile for this user' using errcode = 'P0001';
  end if;
  if v_name is null or v_name = '' then
    raise exception 'name is required' using errcode = 'P0001';
  end if;
  if char_length(v_name) > 200 then
    raise exception 'name is too long' using errcode = 'P0001';
  end if;
  update public.members set full_name = v_name where id = v_member_id;
end;
$$;
revoke execute on function public.set_my_full_name(text) from public, anon;
grant execute on function public.set_my_full_name(text) to authenticated;
