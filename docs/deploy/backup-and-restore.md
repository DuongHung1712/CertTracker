# Backup and restore (free tier)

Supabase Free has **no automatic backup** (and pauses a project after 7 days without use, see `task9-free-tier.md`), so during the proof of concept the owner takes the backup by hand. This is spec 2026-11-06 §8 items 1 and 9 and checklist items `PRD-04`, `PRD-05` in `docs/process/08-production-readiness.md`.

## What this gives you, and what it does not

- **Gives you:** a copy of the data (members, certificates, courses, logins) and a copy of the proof files, as of the moment you took it.
- **Loses up to a week.** With a Friday backup, anything entered after it is gone if the database is lost. There is no point-in-time recovery on the free tier. Take one extra backup after a large import.
- **Not in the dump:** the proof files themselves (the database dump only knows their names), and the Dashboard and hosting settings (SMTP, e-mail templates, link lifetime, Site URL, Vercel variables, Resend). Those are recorded in `accounts-and-catalogue.md` and `cron-email.md` and must be set again by hand.
- **Manual means it can be forgotten.** If the owner skips a Friday, nothing warns anyone. A paid plan with automatic backups (`PRD-05`) is the real fix, decided after the proof of concept (`docs/process/04-wbs.md` 9.3).
- **A restore is only proven once you have done one** (check P-8 in `pilot-checklist.md`). Until then treat this procedure as untested.

## When

1. **Before inviting anyone** (and before the first real import).
2. **Every Friday of the pilot.**
3. After any large import, and before any `supabase db push` to production.

## Where the files go

A dated folder **outside the repository**, for example `<backups folder>/<YYYY-MM-DD>/`. Never inside the repo: the files hold names, work e-mails, password hashes of every login and the proof documents, and `git add` must never see them. Keep them on an encrypted disk, do not e-mail them or paste them anywhere, and delete old copies (suggestion: keep the last four Fridays). The data owner's written agreement (`PRD-15`) covers where staff data may be stored.

## Take a backup

You need the Supabase CLI linked to the production project and its database password. The password goes in with `--password` / `-p` on the dump commands (the flag exists; whether the CLI also asks for it, or reads an environment variable, is *to confirm* on the first run). Do not leave it in a file or in the shell history.

```bash
# 1. Schema (public only: the dump leaves out Supabase's own auth and storage schemas)
pnpm supabase db dump --linked -f <backup folder>/schema.sql

# 2. Data: public tables plus logins (auth.users). The proof-file bookkeeping in storage.* is left out
#    because step 3 copies the files themselves.
pnpm supabase db dump --linked --data-only -x storage.buckets,storage.objects -f <backup folder>/data.sql

# 3. Proof files (the certificates bucket); Dashboard > Storage can also download them one by one
pnpm supabase storage cp -r ss:///certificates <backup folder>/certificates --linked
```

The flags were checked against `supabase db dump --help` and `supabase storage cp --help` (CLI 2.117.0). `--dry-run` on the dump prints the `pg_dump` script without running it.

Then check the backup is complete:

- `schema.sql` and `data.sql` are not empty, and `data.sql` has rows for your members (search for `INSERT INTO "public"."members"`).
- The number of proof files in the folder equals the number in the bucket: `pnpm supabase storage ls -r ss:///certificates --linked` against the files under `<backup folder>/certificates`. *To confirm on the first run:* that `storage cp -r` keeps the `<member id>/<record id>/<file>` folder layout.

Write the date and the counts in the pilot log.

## Restore into a separate project

> [!WARNING]
> **Every statement in this section is for the new, EMPTY restore project only.** Several of them delete or load rows. Before you run anything in the SQL Editor or paste a connection string, check the project name and ref shown in the Dashboard header (and the host in the connection string) and make sure it is the restore project, not production. The free tier has no point-in-time recovery, so a statement run in production cannot be undone.

Never restore over production. This is the rehearsal in P-8, and also the way out after a real loss (then the "separate project" becomes the new production, and the app's variables are pointed at it).

1. **Create a new, empty Supabase project.** Note its database connection string (Dashboard > Project Settings > Database) and its project ref. *To confirm:* the free-tier direct database host may be IPv6-only; if `psql` or `db push` cannot connect from an IPv4-only network, use the **Session pooler** connection string from the same page (not the transaction pooler on port 6543, which does not keep a `set` for the whole session).
2. **Create the schema from the repository's migrations, not from `schema.sql`.** The proof-file bucket and its access rules live in the `storage` schema, which the dump leaves out, and the migrations create them. Check out the commit that production runs, then:

   ```bash
   pnpm supabase db push --dry-run --db-url "<new project connection string, percent-encoded>"
   pnpm supabase db push --db-url "<new project connection string, percent-encoded>"
   ```

   Use `--db-url` so the CLI stays linked to production and the push cannot go to the wrong project.
3. **Empty the table a migration has seeded.** The migrations insert the career roles, which `data.sql` also holds. Run this in the new project's SQL Editor (after checking the project name and ref, see the warning above). It refuses to run if the project holds any member, so it cannot touch real data by mistake:

   ```sql
   do $$
   begin
     if exists (select 1 from public.members) then
       raise exception 'Not an empty project: stop';
     end if;
     delete from public.career_roles;
   end $$;
   ```

   Do not use `truncate ... cascade` here: `members` points at `career_roles`, so a cascade in the wrong project would delete every member, certificate and login link. If the load later stops on a "duplicate key" error, the table in the message was seeded by a migration: empty it the same way (the guard first, then a plain `delete` of that table) and load again.
4. **Load the data.** `data.sql` starts with `set session_replication_role = replica` (seen in the dump's `--dry-run`), so triggers do not fire and rows land exactly as they were:

   ```bash
   psql "<new project connection string>" --single-transaction -v ON_ERROR_STOP=1 -f <backup folder>/data.sql
   ```

   *To confirm:* that `psql` is installed on the machine (`supabase db query --db-url "<connection string>" -f <backup folder>/data.sql` has the same flags but has not been tried on a full dump), and that the `postgres` role may set `session_replication_role` on the hosted project.
5. **Upload the proof files:**

   ```bash
   pnpm supabase storage cp -r <backup folder>/certificates ss:///certificates --project-ref <new project ref>
   ```

   Then compare `pnpm supabase storage ls -r ss:///certificates --project-ref <new project ref>` with the backup folder.

   **Check the nesting.** The access rule takes the *first* folder of the object name as the member id (`can_access_evidence`). If `storage cp -r` created `certificates/certificates/<member id>/...` inside the bucket, no member can open their own file, although an admin still can. The first object name must start with a member id. *To confirm on the first real restore:* the nesting behaviour in both directions. If the names are nested, delete the uploaded objects in the restore project (Dashboard > Storage) and upload one member folder at a time instead: `pnpm supabase storage cp -r <backup folder>/certificates/<member id> ss:///certificates/<member id> --project-ref <new project ref>`.
6. **Check it** in the new project's SQL Editor and compare with production's numbers (run the same query there, or use the counts you wrote down at backup time):

   ```sql
   select 'members' as what, count(*) from public.members
   union all select 'certificates', count(*) from public.training_records
   union all select 'courses', count(*) from public.courses
   union all select 'profiles', count(*) from public.profiles
   union all select 'logins', count(*) from auth.users
   union all select 'proof files', count(*) from storage.objects where bucket_id = 'certificates';
   ```

   Then check that the proof path in the database equals the object name in Storage, for one file (the `evidence_path` of a record and the `name` of its object must be identical):

   ```sql
   select id, evidence_path from public.training_records where evidence_path is not null limit 1;
   select name from storage.objects where bucket_id = 'certificates' limit 5;
   ```

   `training_records.evidence_path` has the form `<member id>/<record id>/<file>`, and the object name must be exactly that, with the member id first.

   Then open a proof **through the app**, not only in the Dashboard: point a copy of the app at the restore project (a local `pnpm dev` with that project's URL and keys in `.env.local`, never the Vercel production variables), sign in as that member or their manager, and open the proof. The restored logins keep their old passwords, which you do not know; set a new password for the one login you test with in the restore project's Dashboard (restore project only; *to confirm* the Dashboard action), and open the proof as a non-admin, because an admin can open files in a wrong folder. The Dashboard preview opens the file as the project owner and would pass even if every member's link were broken. If you cannot point the app at the restore project, say so in the pilot log and treat P-8 as only partly checked.
7. **Record the result** in `pilot-checklist.md` (P-8): date, the counts, and whether the proof file opened.
8. **Delete the rehearsal project** when done (a rehearsal) so staff data does not stay in a second place; the data owner's agreement names one place.
