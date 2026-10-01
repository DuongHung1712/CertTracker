-- members.code defaulted to 'M' || lpad(nextval(...)::text, 3, '0'). lpad TRUNCATES when the input is
-- longer than the target, so sequence values 1000 and 1001 both became 'M100' and members_code_key
-- failed (a bulk import reaches this, and every failed commit burns sequence values). Pad to at
-- least three digits but never truncate. Existing codes (all <= 999 so far) are untouched.
create function public.format_member_code(n bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'M' || lpad(n::text, greatest(3, length(n::text)), '0')
$$;

create function public.next_member_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select public.format_member_code(nextval('public.member_code_seq'))
$$;

alter table public.members alter column code set default public.next_member_code();

-- next_member_code() is only meant to run as the column default. Keep it off the anonymous RPC
-- surface so it cannot be used to burn sequence values; inserting roles still need EXECUTE.
revoke execute on function public.next_member_code() from public, anon;
grant execute on function public.next_member_code() to authenticated, service_role;
