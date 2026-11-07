# Accounts and course catalogue

## One-time setup on production

Do these once in Supabase Dashboard. The local stack gets the same templates from `supabase/config.toml`.

1. **Authentication > SMTP Settings:** turn on custom SMTP, using Resend on the verified sending domain. The built-in sender only reaches your own project team and is heavily rate limited, so invitations to staff would not arrive.
2. **Authentication > URL Configuration:** Site URL is the production address.
3. **Authentication > Email Templates:** paste `supabase/templates/invite.html` into *Invite user* and `supabase/templates/recovery.html` into *Reset password*. Subjects: `Set your CertTracker password`, `Reset your CertTracker password`.
4. **Link lifetime, 24 hours:** Authentication > Email OTP expiry, set to `86400` seconds (the default is 3600, one hour). People do not always open mail within the hour. This one setting governs invitation and recovery links alike. *To confirm:* the exact page name in your Dashboard version; the setting is `otp_expiry` in `supabase/config.toml`.
5. **E-mail rate limit:** look up the "emails sent per hour" limit for Auth and make sure it allows 20 invitations in one sitting, or plan to invite in batches over several hours. *To confirm:* the number and where it is shown in your Dashboard version (the local `supabase/config.toml` sets `email_sent = 2`, which only matters locally).
6. **Password rules must not be stricter than the form.** The set-password form accepts 8 or more characters of any kind (`src/features/auth/schema.ts`). In the Dashboard's password settings keep the minimum length at 8 or less and require no character classes. A stricter rule would make the save fail after the form looked valid, and the person would be signed out and have to ask for a new link. The local equivalents are `minimum_password_length` and `password_requirements` in `supabase/config.toml`.
7. **Sign-up is off:** the project does not allow new users to sign up (`enable_signup = false` locally; *to confirm:* the page and switch name in the Dashboard). Only invited staff may have a login. **Do not turn off the Email provider itself**, only the sign-up switch: switching the provider off also turns off e-mail sign-in for everyone, and all 20 people would be locked out.
8. **Keep "Confirm email" and "Secure email change" ON** (Authentication > Providers > Email and Authentication > Sign In / Providers; *to confirm:* the production values and the exact Dashboard names). Matching is by e-mail, so a login that is still unlinked could otherwise change its own address with `updateUser({ email })` to a colleague's who has no member yet, and be linked to that colleague when they are added. Checked locally on 2026-11-07: with the local default `double_confirm_changes = true` such a call only sets a pending `new_email`, and the address changes after confirmation; the takeover needs these settings OFF. The safer order is also to **add or import members before you invite them**, so no login stays unlinked.

Test it on your own second address before inviting anyone (checks P-1 to P-4 in `pilot-checklist.md`).

## Add a person

1. The admin adds the member at `/members`, or imports them.
2. Dashboard > **Authentication > Users > Invite user**, with the same e-mail.
3. The person clicks the link (valid for 24 hours, works once), sets a password at `/set-password`, then signs in.
4. They start as **Member**, so nothing else is needed. For a manager or admin, open the member at `/members` and change **Access**; for a manager, then assign teams or programs at `/org`.

**Either order works.** E-mail matching ignores case. The only automatic links are these two:

- The admin **adds the member after** the invite (in the member form, or through an import): the existing login is linked.
- The invite is **sent after the member exists**: the new login is linked.

Both link only a login that is not linked yet, and only to a member nobody is linked to yet. A link is never moved or removed automatically.

**Not automatic any more:** a login that already exists for an address a member gets *later* is **not** linked by re-saving the member form with the same e-mail, and a manager's e-mail edit never links anything. (The admin *changing* a member's e-mail to the login's address does link it, if both are unlinked.) To link an existing pair, use the SQL under "Fix a link" below.

**Before inviting an address, check that the member's e-mail is the person's own.** A manager can set an in-scope member's e-mail to an address that has no login yet, and the later invite would link that login to that member. The app keeps no e-mail history, so open the member at `/members` and compare the e-mail with the person's real one before inviting; if you are not sure, ask the person, or check afterwards what `/me` shows for them.

**Forgotten password:** Dashboard > Users > the person > *Send password recovery*. The link works once and lasts 24 hours; send a new one if needed.

**Link expired or used:** the page says "This link has expired or was already used. Ask your admin for a new one." Send a new invitation or a recovery link from the Dashboard.

**Keep at least two admins.** Nothing in the app stops the last admin from losing the role (two admins can demote each other). If it happens, set the role back with SQL: `update public.profiles set role = 'admin' where user_id = '<user id>';`.

## An invited address that does not match a member

The login is created, but unlinked. The person signs in and `/me` shows "Your account is not linked to a member". Fix it as admin:

- If the member does not exist yet, add it at `/members` with the exact e-mail the person was invited with. That links it.
- If the member exists under another e-mail and has no login yet, change the member's e-mail to the login's address in the member form. Because the admin changed it, that links it.
- Otherwise use the SQL under "Fix a link".

## Fix a link

Run in the Dashboard SQL Editor. First find the ids:

```sql
select id from public.members where email = '<member e-mail>';
select id from auth.users where email = '<login e-mail>';
```

Look at the login's current profile first, so you know what you are changing:

```sql
select user_id, member_id, role from public.profiles where user_id = '<user id>';
```

Link an **unlinked** login to a member. The `member_id is null` condition makes the statement do nothing (0 rows updated) if the login is already linked, so it cannot silently move a link. A member can have only one login, so it also fails if that member is already linked to another login; remove that link first.

```sql
update public.profiles set member_id = '<member id>' where user_id = '<user id>' and member_id is null;
```

To **move** an existing link deliberately (a wrong link), remove it first, then set the right one. This is a deliberate two-step so that no single statement moves a login from one person's certificates to another's.

```sql
update public.profiles set member_id = null where user_id = '<user id>';
update public.profiles set member_id = '<right member id>' where user_id = '<user id>' and member_id is null;
```

Check the result at `/me` for that person. The link decides whose certificates and proof files the login can read, so double-check both ids.

## When someone leaves

1. **If they are a manager or an admin, first set their Access to Member** in the member form at `/members` (for yourself, ask another admin). The database reads the role live from the profile, so this removes their manager or admin rights at once, before anything else.
2. Open the member at `/members` and turn **Active** off. This stops their e-mails and takes them out of the dashboard numbers.
3. Dashboard > **Authentication > Users** > the person > **Ban**. Marking the member inactive does not stop them from signing in; the ban does. *To confirm:* the exact wording of the ban action in your Dashboard version.

**An open session keeps working for a while.** The ban stops new sign-ins and token refreshes, but the access token the leaver already holds keeps working until it expires: 1 hour by default (`jwt_expiry = 3600` in `supabase/config.toml`; *to confirm* the production project's value in the Dashboard). During that time they can still read and edit their own certificates. That is why step 1 comes first for a manager or admin.

Nothing is deleted: the member, their certificates and proof stay. This is manual on purpose (`shortcut: manual ban for leavers, automate if the admin does it more than a few times`).

## When a certificate is not in the course list

Only the admin adds courses. The certificate form tells members: "Can't find your course? Ask your admin to add it."

As admin: open `/courses`, add the course. Fill in the type, the provider and the validity in months where you know them, because the expiry date comes from the validity. Then tell the member to choose it in their certificate.

## Load the course catalogue

`supabase/catalog/courses.sql` adds 10 certificate types, 23 providers and 55 courses. It matches by name, reuses what exists, and running it again changes nothing. It never overwrites a course the admin edited. Every value and gap is sourced in `supabase/catalog/SOURCES.md`; fill the empty costs at `/courses` as you confirm them.

```bash
pnpm supabase db query --linked -f supabase/catalog/courses.sql
```

Then compare the inserted count with **55** courses. On a database that had no courses, this must return 55:

```sql
select count(*) from public.courses;
```

If the database already had courses, the file reuses them by name, so expect 55 plus any course added by hand.

Then check `/courses`. Delete the leftover test types `AWS`, `TOEIC`, `IELTS` and the provider `IIG` there if they are unused; they clutter the course form.

## Required checks

So that nothing merges without the tests: GitHub > **Settings > Branches**, add a branch protection rule for `dev` and for `main`, turn on "Require status checks to pass before merging" and require `check` and `e2e` (the two jobs of `.github/workflows/ci.yml`). *To confirm:* a check appears in GitHub's list only after it has run once, so push the branch and let CI run before setting this.

## After the first deploy: check the Auth calls per page view

The rule in `docs/process/04-wbs.md` §4: more than 2 Auth calls (`/auth/v1/user`) per page view means setting `prefetch={false}` on the sidebar links. `scripts/count-auth-calls.mjs` **cannot count the server's calls against production**: only a counting proxy in front of Supabase sees them, and production has none. Without `UPSTREAM` the script prints browser calls only, which are always 0. So check production one of two ways:

- Signing keys: Supabase Dashboard, Project Settings, JWT keys (page name to confirm). Asymmetric keys: 1 call per page view, the local number (§4). An HS256 (symmetric) project: 2 per page view (the layout's `getUser()` plus the proxy's fallback), still within the rule.
- Auth logs: open the page once, then count the `/auth/v1/user` requests in the project's Auth logs for that moment (Dashboard, Logs, Auth; names to confirm).

To repeat the local measurement: build with the counting proxy's URL, then run the script (it overwrites `.next`, so run a normal `pnpm build` afterwards):

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 pnpm build
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 pnpm exec next start -p 3101   # in another terminal
BASE_URL=http://localhost:3101 EMAIL=admin@certtracker.test PASSWORD=<local seed password> UPSTREAM=http://127.0.0.1:54321 node scripts/count-auth-calls.mjs
```
