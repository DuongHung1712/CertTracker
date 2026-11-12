-- copy_courses_to_certificates() was the data step of 20261111000001. After that migration it reads
-- courses columns that no longer exist, so it can only fail; service_role still held the default
-- execute grant. Nobody may call it any more. It stays because pgTAP 20 runs it on synthetic old-shape data.
revoke execute on function public.copy_courses_to_certificates() from public, anon, authenticated, service_role;
