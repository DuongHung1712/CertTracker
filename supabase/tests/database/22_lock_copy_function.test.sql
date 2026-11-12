-- The one-shot copy function is closed to every API role (20261111000003).
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select ok(not has_function_privilege('anon', 'public.copy_courses_to_certificates()', 'execute'), 'anon cannot run the copy function');
select ok(not has_function_privilege('authenticated', 'public.copy_courses_to_certificates()', 'execute'), 'authenticated cannot run it');
select ok(not has_function_privilege('service_role', 'public.copy_courses_to_certificates()', 'execute'), 'service_role cannot run it');
select has_function('public', 'copy_courses_to_certificates', 'the function is kept for pgTAP 20');

select * from finish();
rollback;
