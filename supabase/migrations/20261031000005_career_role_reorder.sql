-- Move a career role one step up or down by swapping sort_order with its neighbour, atomically.
-- sort_order is unique and not deferrable, so the swap goes through a temporary negative value inside one
-- function call (one transaction). security invoker: the admin-only write policy on career_roles applies,
-- and the explicit check gives a non-admin a clear error instead of a silent zero-row update.

create function public.move_career_role(p_id uuid, p_direction text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_order int;
  v_neighbour_id uuid;
  v_neighbour_order int;
begin
  if p_direction not in ('up', 'down') then
    raise exception 'direction must be up or down' using errcode = 'P0001';
  end if;
  if public.app_role() is distinct from 'admin' then
    raise exception 'only the admin can reorder career roles' using errcode = '42501';
  end if;

  select sort_order into v_order from public.career_roles where id = p_id for update;
  if not found then
    raise exception 'career role not found' using errcode = 'P0001';
  end if;

  if p_direction = 'up' then
    select id, sort_order into v_neighbour_id, v_neighbour_order from public.career_roles
      where sort_order < v_order order by sort_order desc limit 1 for update;
  else
    select id, sort_order into v_neighbour_id, v_neighbour_order from public.career_roles
      where sort_order > v_order order by sort_order asc limit 1 for update;
  end if;
  if v_neighbour_id is null then
    return; -- already first / last
  end if;

  update public.career_roles set sort_order = -v_order where id = p_id;
  update public.career_roles set sort_order = v_order where id = v_neighbour_id;
  update public.career_roles set sort_order = v_neighbour_order where id = p_id;
end;
$$;
revoke execute on function public.move_career_role(uuid, text) from public, anon;
grant execute on function public.move_career_role(uuid, text) to authenticated;
