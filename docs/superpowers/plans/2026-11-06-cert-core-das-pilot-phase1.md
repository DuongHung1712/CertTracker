# Cert Core DAS Pilot, Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make CertTracker safe and complete enough for DAS (20 people) to start on Phase 1 next week: land the finished account work, add the few new pieces in spec §5, and put a thorough test suite (spec §7) in CI.

**Architecture:** Two small database triggers link a login to its member; the proxy keeps cookies and logs auth failures; one new Server Action behaviour; a CI job runs the whole Playwright suite. Most of the work is tests: pgTAP for permissions, Vitest for logic, Playwright for journeys. Everything is additive: no table or column is removed.

**Tech Stack:** Next.js 16 (read `node_modules/next/dist/docs/` before touching proxy or routing), Supabase (Postgres, RLS, pgTAP), Zod, Vitest, Playwright, pnpm, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-06-cert-core-das-pilot-design.md` (§3–§9 are in scope; §10 Phase 2 gets its own plan after Phase 1 ships).

**Branch:** `feat/cert-core-accounts`, from `origin/dev` (which already holds M1). Its working tree holds the finished account work, uncommitted (spec §4).

## Roles and who may do what

- **Sonnet 5.5** writes production code and docs. **Opus 5.5** writes and verifies the tests, and reviews every task (owner's instruction, 2026-11-06).
- Test-first, in this order for every task that has both: Opus writes the failing tests and commits them (`test:`); Sonnet makes them pass without editing those tests (if a test looks wrong, Sonnet reports it instead); Opus reviews the diff.
- **Mutation check (Opus):** for each security test marked ⚑, deliberately break the rule it protects (remove the guard, widen the policy), run the suite, and see that exact test fail; then restore. A test that cannot fail does not count. Record each check in the task report.
- The owner's approval of this plan authorises commits on this branch. **No push, merge, `supabase db push`, or `supabase db reset --linked`** without the owner. `supabase db reset` on the local stack is allowed.
- e2e runs through `playwright.local.config.ts` on port 3100 (git-excluded; recreate it from `playwright.config.ts` with `webServer.command = "pnpm dev -p 3100"` and `baseURL` `http://localhost:3100` if missing). Never use or stop the owner's server on :3000. Pass `CRON_SECRET` (24+ random characters), `SUPABASE_SERVICE_ROLE_KEY` (from `npx supabase status -o env`) and `EMAIL_TRANSPORT=console` as process environment, never in a file.

## Global Constraints

- RLS is the security layer; user queries go through `src/lib/supabase/server.ts`. Service role only in `src/lib/supabase/admin.ts`, only for cron (CLAUDE.md invariants 1–2). In-app invitations are a non-goal because they would need it.
- Schema change = a new file in `supabase/migrations/` + a pgTAP test + `pnpm db:types`.
- Every view `with (security_invoker = true)`; dates by `Asia/Ho_Chi_Minh`; no `any`; Server Actions validate with Zod and return `Result<T>`.
- UI text in plain English. Commits are Conventional Commits and end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (Sonnet) or `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (Opus).
- "Each rule below must fail if the behaviour breaks; a test that cannot fail does not count." (spec §7). In e2e: wait for dialogs to close before asserting absence; assert something positive first; no fixed sleeps; each test restores the seed.
- No staff names, e-mails or real files in the repository or in fixtures. Invented people use `@example.com`.
- Done means (spec §7.7): lint 0 errors, typecheck, Vitest, pgTAP and the full e2e suite all green on the same commit. A failing test may not be skipped to make the date.
- Baseline before this plan: Vitest 768, pgTAP 335, e2e 67 passing on the seed database.

## Review Focus

The spec's own test tables cover most of the risk. These five are what a person using the app is most likely to hit and no table row names them directly. Each has a test in the task that owns the code.

1. **E-mail case and stray spaces:** `Linh.Tran@Example.com` typed for the member, `linh.tran@example.com` for the login. They must link (Task 1, DB-3 and DB-3b); a leading or trailing space in the member form is trimmed by Zod before it is saved (Task 1, Step 4).
2. **A manager edits an in-scope member's e-mail to someone else's login address:** no link and no data exposed (Task 1, DB-5 ⚑).
3. **Inviting an address that already belongs to a linked member:** the login is created, unlinked, with no error (Task 1, DB-5c).
4. **A session revoked in another browser while this one is open:** `/login` is served, no redirect loop, and the person can sign in again (Task 7, E-6).
5. **A signed-in person whose member record does not exist yet:** `/me` says the account is not linked, and nothing breaks; after the admin adds the member, the next page load works without further steps (Task 7, E-2).

---

### Task 0: Land the finished account work

**Roles:** Sonnet. No Opus tests (they exist). Opus reviews.

**Files:** the working tree as it stands: nothing new is written.

- [ ] **Step 1:** Run `pnpm lint && pnpm typecheck && pnpm test`, `npx supabase db reset && pnpm test:db`, then the whole e2e suite. Expected: lint 0 errors, Vitest 768, pgTAP 335, e2e 67. If anything is red, stop and report; this task never fixes code.
- [ ] **Step 2:** Commit in four commits, staging files by explicit path (never `git add .`; `backup-*.sql`, `exports/`, `.env.local` stay out):
  1. `feat(auth): invite by e-mail with a /set-password page` — `src/features/auth/**`, `src/app/(auth)/**`, `src/lib/supabase/proxy.ts`, `src/lib/supabase/auth-round-trips.test.ts`, `supabase/config.toml`, `supabase/templates/`, `e2e/account-setup.spec.ts`.
  2. `feat(members): change a person's access from the member form` — `src/features/members/**`, `e2e/members.spec.ts`.
  3. `feat(courses): verified course catalogue script` — `supabase/catalog/`.
  4. `docs: re-cut the WBS around Cert Core and add the pilot spec` — `CLAUDE.md`, `docs/decisions.md`, `docs/deploy/`, `docs/process/04-wbs.md`, `src/lib/process-docs.test.ts`, `docs/superpowers/specs/2026-11-06-cert-core-das-pilot-design.md`.
- [ ] **Step 3:** `git status --short` must show only files that were never meant for git. Run the Step 1 commands again on the final commit; same numbers.

### Task 1: Link a login to its member when the member comes later (spec §5.1)

**Roles:** Opus writes the tests; Sonnet writes the migration; Opus reviews and runs the mutation checks.

**Files:**
- Create: `supabase/tests/database/15_account_linking.test.sql`
- Create: `supabase/migrations/20261106000001_link_account_to_member.sql`
- Modify: `src/types/database.ts` (only if `pnpm db:types` changes it)

**Interfaces:**
- Produces `public.link_account_to_member()` (trigger function, `security definer`, `set search_path = ''`) and trigger `members_link_account` on `public.members`, `after insert or update of email`, `for each row`.
- Replaces `public.handle_new_user()` (same name and trigger `on_auth_user_created`).
- Rule: link only when the caller is the admin or has no JWT (`auth.uid() is null or public.app_role() = 'admin'`). Set `profiles.member_id = new.id` for the login whose e-mail equals `new.email` (case-insensitive, `citext`), only when that profile's `member_id is null` and no profile already points at `new.id`. Never move or remove a link.
- `handle_new_user()` links a new login only to a member that no profile points at yet; otherwise it creates the profile with `member_id = null` and does not raise.

- [ ] **Step 1 (Opus): Write `15_account_linking.test.sql`** with the fixture style of `11_manager_scopes.test.sql` (`pg_temp.login_as`, `pg_temp.logout`, fixtures with their own id prefix). Tests, each as an `is`/`throws_ok`/`isnt`:
  - **DB-1** login created first, then `insert into members` as admin → that profile's `member_id` is the new member.
  - **DB-2** same through `commit_import` (stage one new member as `06_import.test.sql` does, commit as admin).
  - **DB-3** matching ignores case: member `Mixed.Case@Test.Local`, login `mixed.case@test.local`. **DB-3b** the reverse: member lower case, login mixed case.
  - **DB-4** admin updates an unlinked-login member's e-mail to match an unlinked login → it links.
  - **DB-5 ⚑** manager in scope updates the member's e-mail to an unlinked login's address → profile `member_id` stays null; then logged in as that login, `select count(*) from members` is 0 and `select count(*) from training_records` is 0.
  - **DB-5b ⚑** login X is linked to member M. As admin, change another member M2's e-mail to X's address: X's profile still points at M, and M2 has no login.
  - **DB-5c** inserting an `auth.users` row whose address belongs to an already-linked member succeeds, and its profile has `member_id is null`.
  - **DB-6** no matching login: insert succeeds, no profile changes (compare a count of linked profiles before and after).
  - **DB-7 ⚑** after DB-1's link, the linked login (a member) sees only its own member row and own records; a second member's row stays invisible.
- [ ] **Step 2 (Opus): Run** `npx supabase db reset && pnpm test:db`. Expected: `15_account_linking.test.sql` fails on DB-1, DB-2, DB-3, DB-3b, DB-4 (no trigger). DB-5, DB-5b, DB-5c, DB-6, DB-7 may pass already; that is why Step 5 exists. Commit `test(db): specify account linking`.
- [ ] **Step 3 (Sonnet): Write the migration** per the Interfaces block. Read the current `handle_new_user` in `20260928000001_org_and_members.sql:83-98` and replace it with `create or replace function`, keeping its `security definer` and `search_path` settings.
- [ ] **Step 4 (Sonnet): Add to `src/features/members/schema.test.ts`** one Vitest `it("trims the e-mail so it can link to a login")`: `memberSchema.parse({ ...valid, email: "  Linh.Tran@Example.com " }).email` equals `"Linh.Tran@Example.com"`.
- [ ] **Step 5 (Opus): Mutation checks.** Run `npx supabase db reset && pnpm test:db` and `pnpm test`: all green, 335 + the new count. Then, one at a time, temporarily (a) delete the `auth.uid() is null or app_role() = 'admin'` guard → DB-5 must fail; (b) delete the `p.member_id is null` condition → DB-5b must fail; (c) delete the `not exists … p.member_id = m.id` condition from `handle_new_user` → DB-5c must fail. Restore after each. Run `pnpm db:types`.
- [ ] **Step 6: Commit** `feat(db): link a login to its member when the member is added later`. Opus reviews against spec §5.1.

### Task 2: Access matrix for every role (spec §7.2)

**Roles:** Opus writes and maps; Sonnet only if a gap needs a fix. Opus reviews.

**Files:**
- Create: `supabase/tests/database/16_access_matrix.test.sql`
- Possibly create a migration `20261106000002_close_access_gap.sql` (only if a test is red against the current policies).

**Interfaces:** consumes the policies in `20260928000004_rls.sql`, `20260930000001_records_list_evidence_realtime.sql` (storage `certificates:*`), `20261031000001_manager_scopes.sql`.

- [ ] **Step 1 (Opus): Map.** Write `docs/superpowers/plans/2026-11-06-access-matrix-map.md` (a table, not code): each cell of spec §7.2 → the existing pgTAP file and assertion that already covers it, or "gap". Cells: five roles (Member, Manager in scope, Manager out of scope, Demoted manager, Admin) × `members`, `training_records`, proof files in `storage.objects`, `profiles` role, `manager_scopes`, for read, insert, update and delete where the spec names them.
- [ ] **Step 2 (Opus): Write `16_access_matrix.test.sql`** for every "gap" cell. Each "cannot" is asserted as a refusal (`throws_ok`) or as zero affected rows **and** an unchanged value read back as postgres. Proof files: use `storage.objects` rows with names under the record's path pattern the app uses (read `src/lib/storage/supabase-storage.ts` and the storage policies to build realistic paths).
- [ ] **Step 3: Run** `npx supabase db reset && pnpm test:db`. Every red cell is a real permission gap: stop and report it to the controller before any fix. Do not weaken a test.
- [ ] **Step 4 (Opus): Mutation checks ⚑** on at least these: widen "members: manager update managed team" to every team; drop the member-only check on proof reads; let a member update `profiles.role`. Each must turn exactly one test red. Restore.
- [ ] **Step 5: Commit** `test(db): access matrix for every role`; if a fix was needed, a separate `fix(db): …` commit with its migration, `pnpm db:types`, and the owner told in the report.

### Task 3: Proxy keeps cookies and logs auth failures (spec §5.2, §5.3)

**Roles:** Opus writes tests; Sonnet implements; Opus reviews.

**Files:**
- Modify: `src/lib/supabase/proxy.ts`, `src/lib/supabase/auth-round-trips.test.ts`

**Interfaces:** `updateSession(request: NextRequest): Promise<NextResponse>` unchanged.

- [ ] **Step 1 (Opus): Extend the mock** in `auth-round-trips.test.ts` so `createServerClient` captures its options and the fake `getUser`/`getClaims` can call `options.cookies.setAll([{ name: "sb-test-auth", value: "rotated", options: {} }])` before returning. Add:
  - **U-1** `GET /dashboard` with no user, after `setAll` ran → the redirect to `/login` carries `set-cookie` with `sb-test-auth=rotated`.
  - **U-2** `GET /login` with a user, after `setAll` ran → the redirect to `/dashboard` carries it.
  - **U-3** a thrown error and a **returned** `{ error: new AuthRetryableFetchError(...) }` each call `console.error` exactly once and still redirect to `/login`; a returned `AuthSessionMissingError` (a normal signed-out visitor) does **not** log; no logged argument contains the cookie value or a token string.
- [ ] **Step 2: Run** `pnpm test src/lib/supabase/auth-round-trips.test.ts`. Expected: U-1, U-2, U-3 fail.
- [ ] **Step 3 (Sonnet): Implement** in `src/lib/supabase/proxy.ts`: a small helper so both `NextResponse.redirect` results copy every cookie from the working `response` (`response.cookies.getAll()`); and log `error.name` and `error.message` for thrown errors and for returned `error` values whose `name` is not `AuthSessionMissingError`. Read how `getUser` and `getClaims` report errors in the installed `@supabase/auth-js` (`node_modules/.pnpm/@supabase+auth-js*/…/GoTrueClient`) before coding; the result stays "signed out".
- [ ] **Step 4: Run** `pnpm test && pnpm lint && pnpm typecheck`. Expected: pass; Vitest 768 + the new tests.
- [ ] **Step 5 (Opus): Mutation checks ⚑:** remove the cookie copy on one redirect → U-1 or U-2 fails; log the token → U-3 fails. Restore.
- [ ] **Step 6: Commit** `fix(auth): keep refreshed cookies on proxy redirects and log auth failures`.

### Task 4: Sign out after a failed password save, and zero-row access changes (spec §5.6, U-4 to U-6)

**Roles:** Opus writes tests; Sonnet implements; Opus reviews.

**Files:**
- Create: `src/features/auth/actions.test.ts`
- Modify: `src/features/auth/actions.ts`, `src/features/members/actions.test.ts`

**Interfaces:** `setPassword(prev, formData)` unchanged in shape.

- [ ] **Step 1 (Opus): Write** (mock `@/lib/supabase/server`'s `createClient` with `auth.verifyOtp`, `auth.updateUser`, `auth.signOut` as `vi.fn`, and `next/navigation`'s `redirect`):
  - **U-4** `verifyOtp` returns an error → result is the "expired or already used" message, `updateUser` was not called, and nothing signed out is needed (`signOut` not called).
  - **U-5 ⚑** `verifyOtp` ok, `updateUser` returns an error → result is the "could not save that password" message and `signOut` was called once with `{ scope: "local" }`.
  - success path: `redirect` called with `/login?passwordSet=1` after `signOut({ scope: "local" })`.
  - **U-6** in `members/actions.test.ts`: when the `profiles` update returns an empty `data` array (a non-admin, filtered by RLS) `setMemberAccess` returns `ok: false`, not success.
- [ ] **Step 2: Run** `pnpm test src/features/auth src/features/members`. Expected: U-5 fails; U-4, U-6 may already pass.
- [ ] **Step 3 (Sonnet): Implement** the sign-out on the `updateUser` failure path in `src/features/auth/actions.ts`.
- [ ] **Step 4:** Run `pnpm test && pnpm lint && pnpm typecheck`. Expected pass. **Step 5 (Opus):** mutation check U-5 (remove the new `signOut`) → red; restore. **Step 6:** commit `fix(auth): sign out when saving the new password fails`.

### Task 5: Say what to do when a course is missing (spec §5.7)

**Roles:** Opus writes the e2e assertion; Sonnet implements; Opus reviews.

**Files:** Modify `src/features/records/components/record-sheet.tsx` (course field, near line 196-211), `e2e/records.spec.ts`.

- [ ] **Step 1 (Opus):** In `e2e/records.spec.ts` add `test("the certificate form says what to do when a course is missing")`: sign in as `member@certtracker.test`, open `/records`, click "Add certificate", and assert `getByText("Can't find your course? Ask your admin to add it.")` is visible inside the dialog; also open the course picker and search "zzzz-no-such-course", assert "No courses found" is visible (positive) and the hint is still visible.
- [ ] **Step 2:** Run it on :3100; expected FAIL. **Step 3 (Sonnet):** add the line as `FieldDescription` under the course picker. **Step 4:** run the spec; expected PASS. **Step 5:** commit `feat(records): tell members to ask the admin for a missing course`.

### Task 6: Import file generator and rehearsal file (spec §7.6)

**Roles:** Opus writes the tests; Sonnet implements; Opus reviews.

**Files:**
- Create: `src/features/import/sample-workbook.ts`, `src/features/import/sample-workbook.test.ts`, `scripts/make-import-file.ts`
- Modify: `package.json` (script `"make:import-file": "node scripts/make-import-file.ts"`), `.gitignore` (`/private/` for generated real files)

**Interfaces:**
- Produces `type CatalogueCourse = { name: string; validityMonths: number | null; provider: string; certType: string }`, `readCatalogueSql(sql: string): CatalogueCourse[]` (pure: parses the `from (values …)` rows of `supabase/catalog/courses.sql`, whose layout is rigid because a script writes it), `type SamplePerson = { fullName: string; email: string; team: string; certificates: { course: string; status: "done" | "in_progress" | "not_started"; progress: number; plannedExamDate?: string; issuedDate?: string }[] }`, `rehearsalPeople(today: string, catalogue: CatalogueCourse[]): SamplePerson[]` (the 20 invented people) and `buildSampleWorkbook(people: SamplePerson[], catalogue: CatalogueCourse[], today: string): Uint8Array`. A certificate whose course is not in the catalogue throws.
- Consumes `recordsToXlsx` and `EXPORT_COLUMNS` from `src/features/export/records-export.ts`, so the file is in the app's own export format and re-imports unchanged (decision #26). Builds `ExportRow` values by filling every `RecordRow` field (see `src/features/records/queries.ts`).
- CLI: `pnpm make:import-file <people.json> <out.xlsx>` and `pnpm make:import-file --rehearsal <out.xlsx>`. The rehearsal makes 20 invented people (`person01@example.com` … `person20@example.com`), teams `Team Alpha`, `Team Beta`, `Team Gamma`, with at least one certificate in each state: valid, expiring within 60 days, expired, no expiry, in progress, not started. It prints the team names to create at `/org` first, because the importer resolves teams by name and does not create them.
- Real files go under `/private/` (git-ignored). The input list for the real file is never committed.

- [ ] **Step 1 (Opus): Write `sample-workbook.test.ts`:** with a fixed `today = "2026-11-09"`, build the rehearsal workbook, read it with `readImportTable`, and run `buildImportPlan` against lookups containing the three teams, no members and the catalogue courses. Assert: 20 distinct people, zero `errors` on every planned row, every row's action is "create", and the counts of expiry states (computed with the app's `expiry` helpers for that `today`) are each at least 1. A second test: a person whose e-mail is invalid produces an error row (the builder does not hide bad input). A third: the workbook's header row equals `EXPORT_COLUMNS.map(c => c.header)`.
- [ ] **Step 2:** Run it; expected FAIL (module missing). **Step 3 (Sonnet):** implement the module and CLI; the CLI reads `supabase/catalog/courses.sql` and passes it to `readCatalogueSql`. The unit test uses a small inline catalogue and one test checks `readCatalogueSql` against the first three rows of the real file. **Step 4:** Run `pnpm test` and `node scripts/make-import-file.ts --rehearsal private/rehearsal.xlsx`; open the result with the app's importer through Task 7's E-9 later. Expected: test passes, file exists, `git status` shows `private/` ignored.
- [ ] **Step 5:** commit `feat(import): generate a sample workbook for rehearsal and for the real team file`.

### Task 7: The end-to-end suite (spec §7.4)

**Roles:** Opus writes all of it and runs it; Sonnet fixes any product bug a test exposes (each fix its own commit, reported). Opus reviews.

**Files:**
- Create: `e2e/pilot-day-one.spec.ts` (E-1, E-2, E-10), `e2e/pilot-access.spec.ts` (E-3 to E-7), `e2e/pilot-data.spec.ts` (E-8, E-9), `e2e/support/accounts.ts`, `e2e/support/pilot-data.ts`
- Modify: `e2e/account-setup.spec.ts` (use `e2e/support/accounts.ts`)
- Modify: `src/lib/email/templates/templates.test.ts` (U-7)

**Interfaces:**
- `e2e/support/accounts.ts` exports `adminApi(): SupabaseClient` and `inviteLink(email: string, type: "invite" | "recovery" = "invite"): Promise<{ userId: string; hash: string }>`, moved out of `account-setup.spec.ts` (DRY); and `deleteAccount(userId: string)`.
- `e2e/support/pilot-data.ts` exports `createPilotTeams(): Promise<() => Promise<void>>` (three teams, returns a cleanup) and `importRehearsalFile(page): Promise<() => Promise<void>>` that reads `supabase/catalog/courses.sql`, builds the file with `readCatalogueSql`, `rehearsalPeople` and `buildSampleWorkbook`, uploads it through `/import` as the seed admin, commits the batch, and returns its cleanup.
- Reuse: `giveSeedManagerAMember` (`e2e/support/manager-scopes.ts`), `signInAsSeedAdmin`/`restoreSeed` (`e2e/support/restore-seed.ts`), `signIn` (`e2e/helpers.ts`).

- [ ] **Step 1 (Opus):** Move the two helpers into `e2e/support/accounts.ts`; `pnpm exec playwright test -c playwright.local.config.ts e2e/account-setup.spec.ts` must still pass (5 tests).
- [ ] **Step 2 (Opus): Write the journeys.** Unique e-mails per run (`pilot-<Date.now()>@example.com`), cleanup in `afterAll`, seed restored.
  - **E-1** admin adds a member at `/members` in Team Cloud, `inviteLink`, the member sets a password at `/set-password` and signs in, adds a certificate at `/records` ("Add certificate") with a small PDF proof, signs out; the seed manager (given a member row in Team Cloud) sees the certificate at `/records` and opens the proof (the evidence request returns a redirect to a signed URL: assert `GET /api/records/<id>/evidence` as the manager is 307); the admin's `/dashboard` "Certificate records" count is one higher than before; the CSV export contains the member's name.
  - **E-2** invite first: `inviteLink` for an address with no member → the person signs in and `/me` shows "Your account is not linked to a member"; then the admin adds the member with that e-mail; the person reloads and `/me` no longer shows that message.
  - **E-3** member A creates a certificate with proof; member B (another invited login) requests `/api/records/<A's id>/evidence`: 404, and the response has no `location` header.
  - **E-4** the same request as an out-of-scope manager: 404.
  - **E-5** signed-out: each app route (`/dashboard`, `/me`, `/members`, `/records`, `/courses`, `/org`, `/import`, `/data-quality`, `/settings`) redirects to `/login`; `/api/export/records`, `/api/import/parse` (POST) and `/api/records/<id>/evidence` do not return data (redirect or 401/404, none 200); `/api/cron/expiry-alerts` and `/api/cron/monthly-report` without the bearer token return 401.
  - **E-6 ⚑** two browser contexts signed in as the same member; context A signs out (global); context B loads `/dashboard` → ends on `/login` within 5 redirects (count responses with status 3xx; the test fails above 5), shows the login form, and signing in again works.
  - **E-7** the add-certificate form: a `.txt` file renamed `.pdf` and a file of 4 MB + 1 byte each show the form's message and nothing is saved (the record list count is unchanged).
  - **E-8** import a workbook built in the test with the Vietnamese name `Nguyễn Thị Hằng`, assert it on `/members`, in the CSV export (with BOM) and in the XLSX export read back with `xlsx`.
  - **E-9** `createPilotTeams` + `importRehearsalFile` (cleanup removes the 20 `person%@example.com` members and the courses, providers and certificate types the import created, tracked by what existed before); run `GET /api/cron/expiry-alerts` and `/api/cron/monthly-report` with the bearer token and `EMAIL_TRANSPORT=console`; assert each recipient appears once in the first response's `recipients` and a second call reports `sent: 0`.
  - **E-10** E-1's member steps with `page.setViewportSize({ width: 390, height: 844 })` and a touch-sized context: password, sign-in, add certificate, upload proof, no horizontal scroll (`scrollWidth <= clientWidth`).
  - **U-7** in `templates.test.ts`: both e-mail templates render `Nguyễn Thị Hằng` unmangled in html and text.
- [ ] **Step 3: Run** the three new specs on :3100 (env per Roles). Expected on first run: some may fail because of product bugs; every failure is reported with its cause. A failure caused by a flaky wait is fixed in the test; a failure caused by the product goes to Sonnet as its own task, with a regression test already in place.
- [ ] **Step 4 (Opus): Mutation checks ⚑:** break the evidence route's permission (return the signed URL without the RLS-filtered select) → E-3 and E-4 fail; remove the proxy `getUser` on `/login` → E-6 fails. Restore.
- [ ] **Step 5:** Run the whole suite twice in a row; expected 67 + the new tests, no flake across both runs. Commit per spec file: `test(e2e): <what>`.

### Task 8: Run e2e in CI (spec §5.4)

**Roles:** Sonnet implements; Opus reviews and checks the first CI run.

**Files:** Modify `.github/workflows/ci.yml`; `docs/deploy/accounts-and-catalogue.md` gets a "Required checks" note in Task 10.

- [ ] **Step 1 (Sonnet): Add a job `e2e`** (`runs-on: ubuntu-latest`, Node 24, pnpm cache like `check`): install, `pnpm supabase start`, write `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the local key, not the placeholder), `SUPABASE_SERVICE_ROLE_KEY` from `pnpm supabase status -o env` into `$GITHUB_ENV`, add `CRON_SECRET` (generated with `openssl rand -hex 16` in the job), `EMAIL_TRANSPORT=console`; `pnpm exec playwright install --with-deps chromium`; `pnpm test:e2e` (default config, port 3000); on failure upload `playwright-report/` and `test-results/` with `actions/upload-artifact@v4`. Same triggers as `check`. Do not print secrets (`::add-mask::` for each).
- [ ] **Step 2:** Validate the YAML locally with `python -c "import yaml;yaml.safe_load(open('.github/workflows/ci.yml'))"` (install PyYAML if missing), and read the file once for secret leaks.
- [ ] **Step 3 (owner):** after the owner pushes the branch, the PR's `e2e` job must go green. Opus reads the run log and reports the duration and any failure. A red CI job is fixed here, not by weakening a test.
- [ ] **Step 4:** commit `ci: run the Playwright suite on every pull request`.

### Task 9: Count Auth calls per page view; fix only if needed (spec §5.5)

**Roles:** Sonnet runs it; Opus reviews the decision.

**Files:** Create `scripts/count-auth-calls.mjs`; possibly modify `src/components/app-shell/app-sidebar.tsx` (line ~55).

- [ ] **Step 1 (Sonnet): Write** `scripts/count-auth-calls.mjs`: with env `BASE_URL`, `EMAIL`, `PASSWORD`, it signs in with Playwright, then for `/dashboard`, `/records`, `/members` loads the page and counts requests whose URL contains `/auth/v1/user`, and prints one line per page.
- [ ] **Step 2:** On a production build (`pnpm build`, `pnpm start -p 3101`, local Supabase, seed admin) run it. Record the numbers in `docs/process/04-wbs.md` §4.
- [ ] **Step 3: Decision rule.** If any page view costs more than 2 Auth calls, set `prefetch={false}` on the sidebar `Link`s, re-run, and run `e2e/navigation.spec.ts`; otherwise change nothing. Either way keep the script. Also record this as a task in `docs/deploy/accounts-and-catalogue.md`: "run the script against production after the first deploy".
- [ ] **Step 4:** commit `chore: script to count Auth calls per page view` (and `perf(nav): …` if a fix was made).

### Task 10: Runbooks, checklist and records (spec §5.9, §7.5, §8, §11)

**Roles:** Sonnet writes; Opus reviews for accuracy against the code.

**Files:**
- Modify: `docs/deploy/accounts-and-catalogue.md`, `docs/decisions.md`, `docs/process/04-wbs.md`, `CLAUDE.md`
- Create: `docs/deploy/backup-and-restore.md`, `docs/deploy/pilot-checklist.md`

- [ ] **Step 1: `accounts-and-catalogue.md`:** remove the "Do this first" wording, the one-hour link note and the "account created before the member" SQL (§5.1 makes them wrong). Add: the 24-hour link setting (Authentication > Email OTP expiry), checking the Auth e-mail rate limit for 20 invitations, leavers (mark the member inactive, then ban the login: Dashboard > Users > the person > Ban), fixing a wrong link (`update public.profiles set member_id = null where user_id = '<id>'`, then the right one), an invited address that does not match a member, a missing course (admin adds it at `/courses`), and "Required checks": GitHub > Settings > Branches > require `check` and `e2e` on `dev` and `main`.
- [ ] **Step 2: `backup-and-restore.md`:** `pnpm supabase db dump --linked -f <file>` (schema) and `--data-only`; copying the `certificates` bucket (Dashboard > Storage or `supabase storage cp -r ss:///certificates <local dir> --linked`; check the flag on the installed CLI with `--help` first); when to run (before inviting, every Friday); restoring into a separate project and checking a row count and one proof file. Files go outside the repository.
- [ ] **Step 3: `pilot-checklist.md`:** a table of P-1 to P-8 from the spec with columns Check, Pass, Result, Date; plus the §8 owner items 1–12 as a tick list. Empty results.
- [ ] **Step 4: `docs/decisions.md` #61** (Vietnamese like its neighbours, one line): phase order, section A before section B, Phase 1 for DAS then Phase 2 during the pilot. `04-wbs.md`: add Phase 2's three features as work packages 15.4 (submit and approve), 15.5 (chosen field), 15.6 (numbers by month or quarter) in milestone C1, status Not started, depends on 15.1, with requirement ids copied from existing rows; move the pilot work packages 9.1 and 9.2 before C2; keep `pnpm test src/lib/process-docs.test.ts` green. `CLAUDE.md`: update the status line (pilot DAS next, Phase 2 after).
- [ ] **Step 5:** Run `pnpm test`; commit `docs: pilot runbooks, checklist and decision #61`.

### Task 11: Close Phase 1

**Roles:** Opus runs and reviews; Sonnet fixes.

- [ ] **Step 1:** Run, on the final commit: `pnpm lint && pnpm typecheck && pnpm test`, `npx supabase db reset && pnpm test:db`, the full e2e suite (twice). Record the counts. Expected: lint 0 errors, typecheck clean, Vitest 768 plus the new unit tests, pgTAP 335 plus the new files, e2e 67 plus the new specs, no flake.
- [ ] **Step 2 (Opus): Whole-branch review** (`git diff origin/dev...HEAD`) with this brief: permission leaks first (the trigger, the matrix, the proxy), then each test's ability to fail, then wording. Findings Critical/Important are fixed before the owner sees the PR.
- [ ] **Step 3:** Write `docs/superpowers/plans/2026-11-06-phase1-result.md`: the counts, the mutation checks and their results, every ruling, what the owner must still do (spec §8 and §7.5), and the open list for Phase 2.
- [ ] **Step 4:** Stop. The plan ends at a green pull request to `dev`: the owner pushes, reviews and merges, runs the production steps in spec §8 (release order: backup, then `supabase db push` of the one migration, then merge `dev` to `main`), then §7.5.
