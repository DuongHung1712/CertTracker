create function public.vn_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Ho_Chi_Minh')::date;
$$;

create function public.expiry_status(p_issued date, p_validity_months int, p_today date)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_validity_months is null then 'No Expiry'
    when p_issued is null then 'N/A'
    else (
      select case
        when d.days < 0 then 'Expired'
        when d.days <= 30 then 'Expiring Soon'
        when d.days <= 60 then 'Expiring in 60d'
        else 'Active'
      end
      from (select (p_issued + make_interval(months => p_validity_months))::date - p_today as days) d
    )
  end;
$$;

create view public.v_training_records
with (security_invoker = true)
as
select
  r.*,
  c.name as course_name,
  c.validity_months,
  e.expiry_date,
  e.expiry_date - public.vn_today() as days_to_expiry,
  public.expiry_status(r.issued_date, c.validity_months, public.vn_today()) as expiry_status
from public.training_records r
join public.courses c on c.id = r.course_id
cross join lateral (
  select case
    when r.issued_date is not null and c.validity_months is not null
      then (r.issued_date + make_interval(months => c.validity_months))::date
  end as expiry_date
) e;
