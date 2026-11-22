-- Admin control of the AI feature switch (decision #75). The tables stay closed to every user role; an admin reaches them only
-- through these two functions, which check the role inside and run with the caller's own JWT (no service role).

create function public.get_ai_feature(p_feature text)
returns table (enabled boolean, daily_limit int, calls_today int)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.app_role() is distinct from 'admin'::public.user_role then
    raise exception 'Only an admin can read this' using errcode = '42501';
  end if;
  return query
    select f.enabled, f.daily_limit,
           (select count(*)::int from public.ai_usage u
             where u.feature = f.feature and u.day = (now() at time zone 'Asia/Ho_Chi_Minh')::date)
      from public.ai_feature_flags f
     where f.feature = p_feature;
end;
$$;

create function public.set_ai_feature(p_feature text, p_enabled boolean, p_daily_limit int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.app_role() is distinct from 'admin'::public.user_role then
    raise exception 'Only an admin can change this' using errcode = '42501';
  end if;
  update public.ai_feature_flags set enabled = p_enabled, daily_limit = p_daily_limit where feature = p_feature;
  if not found then
    raise exception 'Unknown feature' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.get_ai_feature(text) from public, anon;
revoke execute on function public.set_ai_feature(text, boolean, int) from public, anon;
grant execute on function public.get_ai_feature(text) to authenticated;
grant execute on function public.set_ai_feature(text, boolean, int) to authenticated;
