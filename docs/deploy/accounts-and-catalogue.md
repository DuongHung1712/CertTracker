# Accounts and course catalogue

## One-time setup on production

Do these once in Supabase Dashboard. The local stack gets the same templates from `supabase/config.toml`.

1. **Authentication > SMTP Settings:** turn on custom SMTP, using Resend on the verified sending domain. The built-in sender only reaches your own project team and is heavily rate limited, so invitations to staff would not arrive.
2. **Authentication > URL Configuration:** Site URL is the production address.
3. **Authentication > Email Templates:** paste `supabase/templates/invite.html` into *Invite user* and `supabase/templates/recovery.html` into *Reset password*. Subjects: `Set your CertTracker password`, `Reset your CertTracker password`.

Test it on your own second address before inviting anyone.

## Add a person

1. The admin adds the member at `/members`, or imports them. **Do this first:** the account links to the member by e-mail only when the account is created.
2. Dashboard > **Authentication > Users > Invite user**, with the same e-mail.
3. The person clicks the link, sets a password at `/set-password`, then signs in.
4. They start as **Member**, so nothing else is needed. For a manager or admin, open the member at `/members` and change **Access**; for a manager, then assign teams or programs at `/org`.

**Forgotten password:** Dashboard > Users > the person > *Send password recovery*. Links expire after one hour by default and work once; send a new one if needed.

**Account created before the member:** the account is not linked. Run this in the SQL Editor:

```sql
update public.profiles p
set member_id = m.id
from auth.users u
join public.members m on m.email = u.email::extensions.citext
where p.user_id = u.id and u.email = '<email>';
```

## Load the course catalogue

`supabase/catalog/courses.sql` adds 10 certificate types, 23 providers and 55 courses. It matches by name, reuses what exists, and running it again changes nothing. It never overwrites a course the admin edited. Every value and gap is sourced in `supabase/catalog/SOURCES.md`; fill the empty costs at `/courses` as you confirm them.

```bash
pnpm supabase db query --linked -f supabase/catalog/courses.sql
```

Then check `/courses`. Types and providers left over from earlier testing stay; delete them at `/courses` if they are unused.

## After the first deploy: count Auth calls

Run `scripts/count-auth-calls.mjs` against production once, as an existing user, and compare with the numbers in `docs/process/04-wbs.md` §4 (more than 2 Auth calls per page view means setting `prefetch={false}` on the sidebar links). Production has no counting proxy, so omit `UPSTREAM`: only browser-visible calls are printed (the server column needs the proxy, see the script header).

```bash
BASE_URL=https://<production-host> EMAIL=<your e-mail> PASSWORD=<your password> node scripts/count-auth-calls.mjs
```
