# Review Comments (2026-11-10) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the five review comments: course details (duration, refund conditions), a profile page, member import, and separate certificate and course catalogues; comment 1 needs no code.

**Architecture:** Four independent parts, each on its own branch from `dev` and mergeable on its own: A `feat/course-details`, B `feat/profile-page`, C `feat/import-members`, D `feat/certificate-catalogue`. Part D starts only after the owner confirms Q1 in the spec; A, B and C can start now. Every part follows the repo flow: tests first (red), implement, independent verify.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase Postgres + RLS, Zod, React Hook Form, shadcn/ui (Base UI), SheetJS (`xlsx`), Vitest, pgTAP, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-10-review-comments-design.md` (sections 0–6; owner questions Q1–Q5 and their defaults are in section 0).

## Global Constraints

- RLS is the security layer: user queries only through `src/lib/supabase/server.ts`; no service role outside cron.
- Every view `with (security_invoker = true)`; expiry and days to expiry stay computed in views.
- Dates in `Asia/Ho_Chi_Minh` via `src/lib/dates.ts`; shown as `dd/MM/yyyy`.
- No `any`, no `@ts-ignore`, no `eslint-disable`; Zod validates every Server Action input on the server.
- Server Actions return `Result<T>` (`ok` / `err` from `src/lib/result.ts`); never throw to the UI.
- Schema change = new file in `supabase/migrations/` + pgTAP for admin, manager and member including a refused case + `pnpm db:types`.
- UI text in English, sentence case; design-system tokens only (`docs/design-system.md`); lucide icons 16 px.
- Ports: never 3000 or 3100; e2e on a free port (3200 if it is yours, else 3201).
- Commits: Conventional Commits, one per task at least, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; never `git add .`; no push without the owner.
- Before a part is "done": `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:db`, `pnpm build`, the affected e2e specs, with real output.

## Review Focus

1. An imported email that differs only by case or spaces from an existing member, or from another row in the file → treated as the same email (Skip, or Error for both duplicates). Test in Task C2.
2. Change password with a wrong current password → error "The current password is not correct.", nothing changed, still signed in. Test in Task B1.
3. Turning "Refundable" off on a course that has refund conditions → saved as `null`, not kept hidden. Test in Task A1.
4. Part D migration over a course with a null provider or null cert type (both nullable in the DB today) → its certificate copy is created with the same nulls and no constraint fails. Test in Task D1.
5. A manager with only a program scope, and a manager with none → profile lists the program by name / shows "No teams or programs assigned yet." Test in Task B2.

---

## Part A: course details (branch `feat/course-details`)

### Task A1: refund conditions in the database and the course action

**Files:**
- Create: `supabase/migrations/20261110000001_course_refund_conditions.sql`
- Create: `supabase/tests/database/17_course_refund_conditions.test.sql`
- Modify: `src/features/courses/schema.ts` (`courseFields`)
- Modify: `src/features/courses/actions.ts` (create and update write the column)
- Modify: `src/features/courses/queries.ts` (select it)
- Test: `src/features/courses/schema.test.ts`

**Interfaces:**
- Produces: `courses.refund_conditions text null` with `check (char_length(refund_conditions) <= 1000)`; `courseFields.refundConditions` (string, trimmed, max 1000, blank → `null`); `CourseInput.refundConditions: string | null`; course list rows gain `refundConditions: string | null`.

- [ ] **Step 1: Write the failing tests**
  - pgTAP `17_course_refund_conditions.test.sql`: `has_column('public','courses','refund_conditions')`; inserting 1001 characters as admin throws `23514`; a manager and a member updating `refund_conditions` affect 0 rows (RLS); `v_training_records` still selects.
  - Vitest `schema.test.ts`:
    - `"refund conditions are trimmed and blank becomes null"`: `courseSchema.parse({...valid, refundConditions: "  "}).refundConditions === null`.
    - `"refund conditions are dropped when the course is not refundable"`: `courseSchema.parse({...valid, refundable: false, refundConditions: "Pass within 6 months"}).refundConditions === null` (Review Focus 3).
    - `"refund conditions longer than 1000 characters are rejected"` with message `"Refund conditions can have at most 1000 characters"`.
- [ ] **Step 2: Run and see them fail**: `pnpm test:db` and `pnpm vitest run src/features/courses/schema.test.ts` → FAIL (column / field missing).
- [ ] **Step 3: Implement** the migration, `refundConditions` in `courseFields` (a `.transform` after the object nulls it when `refundable` is false, applied in `courseSchema` and `courseWithIdSchema`), the action column mapping, the query select; run `pnpm db:types`.
- [ ] **Step 4: Run** the same commands → PASS; `pnpm typecheck` clean.
- [ ] **Step 5: Commit** `feat(courses): store refund conditions for refundable courses`.

### Task A2: course form, table, duration label, export header, import aliases

**Files:**
- Modify: `src/features/courses/components/course-sheet.tsx` (labels and the conditional textarea)
- Modify: `src/features/courses/components/courses-table.tsx` (column header and the conditions line)
- Modify: `src/features/export/records-export.ts:53` (header)
- Modify: `src/features/import/clean.ts:34` (`estHours` aliases)
- Modify: `docs/design-system.md` (course form note)
- Test: `e2e/courses.spec.ts`, `src/features/import/clean.test.ts`, `src/features/export/records-export.test.ts`

**Interfaces:**
- Consumes: `CourseInput.refundConditions` and list row `refundConditions` from Task A1.

- [ ] **Step 1: Write the failing tests**
  - e2e `"admin records refund conditions on a refundable course"`: open a course, label `"Duration (hours)"` is visible and `"Study hours (estimate)"` is not; `"Refund conditions"` is absent until the `"Refundable"` switch is on; fill `"Pass the exam within 6 months"`, Save; the table row shows that text; switch Refundable off, Save, reopen: the textarea is absent and switching on again shows it empty.
  - Vitest `clean.test.ts`: the header `"Duration (hours)"` and `"duration"` map to `estHours`.
  - Vitest `records-export.test.ts`: the header list contains `"Duration (hours)"` and not `"Study hours"`.
- [ ] **Step 2: Run and see them fail**: `PLAYWRIGHT_BASE_URL=http://localhost:3200 pnpm exec playwright test e2e/courses.spec.ts -g "refund conditions"` and the two Vitest files → FAIL.
- [ ] **Step 3: Implement**: label `"Duration (hours)"` in the form, table header `"Duration (hours)"`; `Textarea` `"Refund conditions"` rendered only when the `refundable` watch value is true (`useWatch`), `FieldError` under it; table cell shows the text with `truncate` and the full text in a `Tooltip`; export header; aliases `"duration"`, `"duration (hours)"`.
- [ ] **Step 4: Run** the same commands → PASS.
- [ ] **Step 5: Commit** `feat(courses): show duration and refund conditions in the course catalogue`.

### Task A3: close comment 1 and finish the part

**Files:**
- Modify: `docs/decisions.md` (no new decision; nothing to add for comment 1)
- Modify: `docs/superpowers/specs/2026-11-10-review-comments-design.md` only if a reviewer's finding changes it

- [ ] **Step 1:** Post the resolution text from spec section 1 on comment 1 (owner action; report it as ready to paste).
- [ ] **Step 2:** Run the full gate from Global Constraints; record counts in the PR description.
- [ ] **Step 3: Commit** any doc touch-ups `docs: course details`.

---

## Part B: profile page (branch `feat/profile-page`)

### Task B1: change-password action

**Files:**
- Modify: `src/features/auth/schema.ts` (add `changePasswordSchema`)
- Modify: `src/features/auth/actions.ts` (add `changePassword`)
- Test: `src/features/auth/schema.test.ts`

**Interfaces:**
- Produces: `changePasswordSchema` = `{ currentPassword: string min 1, password, confirmPassword }` reusing the password rules and the match refinement of `setPasswordSchema` (extract them into a shared `passwordFields` object in the same file, no behaviour change); `changePassword(_prev: Result<null> | null, formData: FormData): Promise<Result<null> | null>`.

- [ ] **Step 1: Write the failing tests**
  - Vitest: `changePasswordSchema` rejects an empty current password (`"Enter your current password"`), rejects mismatch with the same message `setPasswordSchema` uses, accepts a valid triple.
  - Vitest (existing set-password tests) stay green after extracting `passwordFields`.
- [ ] **Step 2: Run**: `pnpm vitest run src/features/auth` → FAIL (schema missing).
- [ ] **Step 3: Implement** `changePassword`: parse; `getCurrentUser()` (null → `err("Sign in again to change your password.")`); `signInWithPassword({ email: user.email, password: currentPassword })` on the server client, error → `err("The current password is not correct.")`; then `updateUser({ password })`, error → `err("We could not save that password. Choose a different one.")`; success → `ok(null)`. Never log either password.
- [ ] **Step 4: Run** → PASS; `pnpm typecheck` clean.
- [ ] **Step 5: Commit** `feat(auth): let a signed-in user change their password`.

### Task B2: `/profile` page, user-menu entry, career card move

**Files:**
- Create: `src/app/(app)/profile/page.tsx`, `src/app/(app)/profile/loading.tsx`
- Create: `src/features/auth/components/change-password-form.tsx`
- Create: `src/features/profile/queries.ts` (`getMyProfile`), `src/features/profile/components/account-card.tsx`, `src/features/profile/components/scope-card.tsx`
- Modify: `src/components/app-shell/user-menu.tsx` (Profile item)
- Modify: `src/app/(app)/me/page.tsx` (remove `CareerCard`)
- Modify: `docs/design-system.md`, `docs/decisions.md` (decision #63: profile name and email read-only, Q5)
- Test: `e2e/profile.spec.ts` (new), `e2e/career.spec.ts` (career card now on `/profile`), `src/app/(app)/loading-files.test.ts` (must cover the new `loading.tsx`)

**Interfaces:**
- Consumes: `changePassword` from Task B1; `getCurrentUser()`; `getMemberCareer(memberId)` and `CareerCard` (unchanged).
- Produces: `getMyProfile(user: CurrentUser): Promise<Result<MyProfile>>` with `MyProfile = { fullName: string | null; email: string; role: Role; memberCode: string | null; teamName: string | null; scopes: { kind: "team" | "program"; name: string }[] }` (scopes empty unless role is manager; read through RLS only).

- [ ] **Step 1: Write the failing tests** (`e2e/profile.spec.ts`)
  - `"the user menu opens the profile page"`: member opens the menu, clicks `"Profile"`, URL `/profile`, `h1` `"Profile"`.
  - `"a member sees their account read-only"`: name, email, `"Member"` badge, member code, team; text `"Ask your admin to change your name or email."`; no textbox for name or email.
  - `"a manager sees their scope"`: seed manager shows `"Team Cloud"`; a manager with only a program scope (created in the test, cleaned up after) shows the program name; a manager with none shows `"No teams or programs assigned yet."` (Review Focus 5).
  - `"an unlinked admin sees Not linked to a member"`.
  - `"the career card lives on the profile page"`: `/profile` has the career region; `/me` does not.
  - `"change password: wrong current password"`: error `"The current password is not correct."`, still on `/profile` and signed in (Review Focus 2).
  - `"change password: success"` on a pilot-style throwaway member (reuse `e2e/support/pilot-member.ts` helpers), toast `"Password changed"`, sign out, sign in with the new password works.
  - Update `e2e/career.spec.ts` to open `/profile` instead of `/me`.
- [ ] **Step 2: Run** `PLAYWRIGHT_BASE_URL=http://localhost:3200 pnpm exec playwright test e2e/profile.spec.ts e2e/career.spec.ts` → FAIL (route missing).
- [ ] **Step 3: Implement**: page = `PageHeader` `"Profile"` / `"Your account, scope and career."`, then `AccountCard`, `ScopeCard` (manager only), `CareerCard` (only when linked), `ChangePasswordForm` (`useActionState(changePassword)`, fields `"Current password"`, `"New password"`, `"Confirm new password"`, `autoComplete` current-password / new-password, resets on success, toast `"Password changed"`); each region its own `SectionError` on failure; user menu item `"Profile"` as a `Link` above `"Sign out"`; `loading.tsx` with `role="status"`, `aria-busy="true"`, `aria-label="Loading profile"`.
- [ ] **Step 4: Run** the same e2e plus `pnpm vitest run src/app` → PASS.
- [ ] **Step 5: Commit** `feat(profile): add the profile page with account, scope, career and password`.

---

## Part C: import members (branch `feat/import-members`)

### Task C1: one safe sheet reader for xlsx and csv

**Files:**
- Modify: `src/features/import/workbook.ts` (extract `readFirstSheet`, keep `readImportTable` on top of it)
- Test: `src/features/import/workbook.test.ts`

**Interfaces:**
- Produces: `readFirstSheet(bytes: Uint8Array): Cleaned<{ rows: Cell[][]; date1904: boolean }>` with the existing size, zip-bomb and cell-count guards for xlsx, and a CSV path: when `isExcelFile(bytes)` is false, decode as UTF-8 (BOM removed) and read with `XLSX.read(text, { type: "string" })`; same 4 MB and row limits.

- [ ] **Step 1: Write the failing tests**: `readFirstSheet` on a CSV `"Full name,Email,Team\nAn,an@x.test,Team Cloud"` returns 2 rows; a UTF-8 BOM CSV with Vietnamese names keeps the accents; a file over `MAX_IMPORT_BYTES` returns the existing "larger than 4 MB" error; all existing `workbook.test.ts` and `import` tests still pass.
- [ ] **Step 2: Run** `pnpm vitest run src/features/import` → new tests FAIL.
- [ ] **Step 3: Implement** the extraction; `readImportTable` keeps its output and messages.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `refactor(import): share a guarded first-sheet reader that also reads CSV`.

### Task C2: member import planner (pure)

**Files:**
- Create: `src/features/members/import-plan.ts`
- Test: `src/features/members/import-plan.test.ts`

**Interfaces:**
- Consumes: `readFirstSheet` rows from Task C1; `normalizeEmail`, `cellText`, `findHeaderRow` from `src/features/import/clean.ts`.
- Produces:
  - `MEMBER_IMPORT_HEADERS = { fullName: ["full name","name","ho ten"], email: ["email","e-mail"], team: ["team","nhom"], careerRole: ["career role","role"] }` (matched after the existing accent and case folding).
  - `type MemberImportRow = { line: number; fullName: string | null; email: string | null; teamName: string | null; careerRoleName: string | null; action: "create" | "skip" | "error"; messages: string[]; teamId: string | null; careerRoleId: string | null }`.
  - `planMemberImport(rows: Cell[][], lookups: { memberEmails: string[]; teams: { id: string; name: string }[]; careerRoles: { id: string; name: string }[] }): Cleaned<{ rows: MemberImportRow[]; counts: { create: number; skip: number; error: number } }>` — error result when no header row has both Full name and Email, or more than 500 data rows.

- [ ] **Step 1: Write the failing tests**
  - creates a valid row with a known team (team match case-insensitive, `"team cloud"` → Team Cloud's id).
  - skips an email that exists, comparing lower-cased and trimmed (`" AN@CertTracker.test "` vs `an@certtracker.test`) (Review Focus 1).
  - errors: missing name (`"Full name is missing"`), bad email (message from `normalizeEmail`), unknown team (`"Team \"X\" does not exist"`), unknown career role (`"Career role \"X\" does not exist"`), duplicate email in the file marks **both** rows (`"This email appears more than once in the file"`), including case-only duplicates (Review Focus 1).
  - empty career role is allowed (`careerRoleId: null`).
  - header row found when a title row sits above it; missing Email header → error `"The file needs the columns Full name and Email."`; 501 data rows → error `"The file has more than 500 rows. Split it and import it in parts."`.
  - counts add up to the number of data rows; blank lines are ignored.
- [ ] **Step 2: Run** `pnpm vitest run src/features/members/import-plan.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** `planMemberImport` as a pure function.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(members): plan a member import from a sheet`.

### Task C3: preview and import actions, dialog, template

**Files:**
- Create: `src/features/members/import-actions.ts`
- Create: `src/features/members/components/import-members-dialog.tsx`
- Create: `public/templates/members-import.csv` (exactly `Full name,Email,Team,Career role` and one example line `Nguyen Van A,a.nguyen@example.com,Team Cloud,`)
- Modify: `src/app/(app)/members/page.tsx` (button for admin only)
- Modify: `docs/decisions.md` (decision #64: member import creates members only, no invitations, Q3), `docs/design-system.md`
- Test: `e2e/members.spec.ts` (new tests)

**Interfaces:**
- Consumes: `readFirstSheet` (C1), `planMemberImport` (C2).
- Produces:
  - `previewMemberImport(formData: FormData): Promise<Result<{ rows: MemberImportRow[]; counts: { create: number; skip: number; error: number } }>>` — reads `file`, checks admin (`getCurrentUser().role === "admin"`, else `err("Only an admin can import members.")`), loads lookups through the user's client, returns the plan; saves nothing.
  - `importMembers(formData: FormData): Promise<Result<{ created: number }>>` — re-reads and re-plans the same file on the server, inserts all `create` rows in **one** `insert([...])` call (`full_name`, `email`, `team_id`, `is_active: true`, `career_role_id`), `revalidatePath("/members")`; duplicate-key error → `err("Some emails were added by someone else meanwhile. Preview again.")`, nothing saved.

- [ ] **Step 1: Write the failing tests** (`e2e/members.spec.ts`)
  - `"admin imports members from a CSV"`: button `"Import members"`; link `"Download template"` points to `/templates/members-import.csv`; upload a CSV built in the test with 2 new members, 1 existing seed email, 1 unknown team; preview shows `"2 to create, 1 skipped, 1 with errors"` and each row's message; click `"Import 2 members"`; text `"Imported 2 members."`; both appear in the members table; cleanup deletes them.
  - `"import button is disabled when nothing can be created"`.
  - `"a manager and a member do not see Import members"`.
  - `"importing twice skips the members already created"` (second preview shows them as skipped).
- [ ] **Step 2: Run** `PLAYWRIGHT_BASE_URL=http://localhost:3200 pnpm exec playwright test e2e/members.spec.ts -g "import"` → FAIL.
- [ ] **Step 3: Implement** the two actions, the dialog (`FileDropzone` with `.xlsx,.csv`, preview table with line, name, email, team, result, messages; counts line; `"Import N members"` primary button disabled when N = 0; `"Choose another file"`), the template file, the admin-only button.
- [ ] **Step 4: Run** the same e2e plus `pnpm vitest run src/features/members` → PASS.
- [ ] **Step 5: Commit** `feat(members): import members from Excel or CSV`.

---

## Part D: certificate and course catalogues (branch `feat/certificate-catalogue`)

> Superseded by `docs/superpowers/plans/2026-11-10-certificate-catalogue.md`. The tasks below are kept for history.

**Gate:** Q1 answered 2026-11-10 (spec section 0); the model is spec section 5 (two kinds of certificate: exam and course completion). Base: `origin/dev` with Parts A–C merged (migrations up to `20261110000003`).

### Task D1: migration, RLS and pgTAP

**Files:**
- Create: `supabase/migrations/20261111000001_certificate_catalogue.sql`
- Create: `supabase/tests/database/19_certificate_catalogue.test.sql`
- Modify: `supabase/seed.sql` (certificates; courses with `prepares_for_id`; records with `certificate_id`; one completion example: a course "Machine Learning Specialization" granting a completion certificate, no validity, no records)
- Modify: `src/types/database.ts` (`pnpm db:types`)

**Interfaces:**
- Produces:
  - Type `public.certificate_kind` enum `('exam', 'completion')`.
  - Table `certificates (id, name, kind, cert_type_id, provider_id, level, validity_months, url, course_id, created_at, updated_at)`; unique `(provider_id, name)`; unique `course_id`; check `(kind = 'completion') = (course_id is not null)`; `validity_months is null or > 0`; `set_updated_at` trigger.
  - `courses.prepares_for_id uuid null references certificates on delete set null`; trigger `courses_prepares_for_exam` rejects a non-exam target (`errcode 23514`, message `prepares_for must be an exam certificate`); `courses` without `cert_type_id`, `level`, `validity_months`.
  - `training_records.certificate_id uuid not null references certificates on delete restrict`; `course_id` nullable; unique `(member_id, certificate_id)` (constraint `training_records_member_certificate_key`); trigger `training_records_course_matches_certificate`: for a completion certificate it sets `course_id` to the granting course; for an exam certificate a non-null `course_id` must have `prepares_for_id = certificate_id` (else `23514`, `course does not prepare for this certificate`).
  - `v_training_records` (security_invoker) with `certificate_id`, `certificate_name`, `certificate_kind`, nullable `course_name`, and expiry from the certificate's validity; existing column names kept where the meaning is unchanged.
  - `dashboard_breakdown(p_dimension)` accepts `team | cert_type | provider | certificate`; `'course'` raises `22023`.
  - Import commit function uses `on conflict (member_id, certificate_id)`.

- [ ] **Step 1: Write the failing pgTAP** (`19_certificate_catalogue.test.sql`):
  - every pre-existing course has a certificate with the same id, `kind = 'exam'`, same name, type, provider, level, validity; `courses.prepares_for_id = id` for each;
  - every record's `certificate_id` equals its old `course_id`; the seeded done record's `expiry_date` and `expiry_status` equal the values computed before the migration (captured from known seed values: issue date `vn_today() - 1070`, validity 36);
  - a course with null provider and null cert type migrates without error (Review Focus 4);
  - kind rules: an exam certificate with a `course_id` fails `23514`; a completion certificate without one fails `23514`; two completion certificates for one course fail `23505`;
  - `courses.prepares_for_id` pointing to a completion certificate fails `23514`;
  - a record for a completion certificate gets `course_id` set to the granting course even when inserted with null; a record for an exam certificate with a course that does not prepare for it fails `23514`;
  - duplicate `(member_id, certificate_id)` fails `23505`;
  - RLS: admin inserts a certificate; manager and member insert or update 0 rows / `42501`; all three roles read certificates;
  - `dashboard_breakdown('certificate')` returns rows and `('course')` raises `22023`.
- [ ] **Step 2: Run** the new file against a database at `20261110000003` (apply with `pnpm exec supabase migration up --local`, never `supabase db reset`) → FAIL.
- [ ] **Step 3: Implement** the migration in the order of spec 5.3 (copy with the same ids, backfill, swap the unique constraint, triggers, recreate the view and functions with `security_invoker`, RLS, drop the moved columns last); update the seed; `pnpm db:types`.
- [ ] **Step 4: Run** `pnpm test:db` → all files PASS (older files updated only where they insert into the dropped `courses` columns; list each change).
- [ ] **Step 5: Commit** `feat(db): separate certificates from courses`.

### Task D2: certificates feature and slimmed courses feature

**Files:**
- Create: `src/features/certificates/{schema.ts,actions.ts,queries.ts}`, `src/features/certificates/schema.test.ts`
- Modify: `src/features/courses/{schema.ts,actions.ts,queries.ts}`, `src/features/courses/schema.test.ts`

**Interfaces:**
- Consumes: D1 tables and types.
- Produces:
  - `certificateSchema` = `{ name, kind: z.enum(["exam","completion"]), certTypeId, providerId, level, validityMonths, url, courseId }` with the rules moved from `courseFields` (messages kept: "Choose a certificate type", "Choose a provider", "Validity must be greater than 0") and a refinement: completion requires `courseId` ("Choose the course that grants this certificate"), exam forces `courseId` to null.
  - `createCertificate`, `updateCertificate`, `deleteCertificate` → `Result<null>` (delete of a certificate with records maps `23503` to "This certificate has records. Delete them first.").
  - `listCertificates(): Promise<CertificateRow[]>` with `CertificateRow = { id, name, kind, certTypeId, certTypeName, providerId, providerName, level, validityMonths, url, courseId, courseName }`.
  - `courseFields` loses `certTypeId`, `level`, `validityMonths`; gains `preparesForId: z.guid().nullable()`; list rows gain `preparesForId`, `preparesForName`, `grantsCertificateName`.

- [ ] **Step 1:** Vitest for the schema rules above (moved messages unchanged; completion without course; exam with course → null; course accepts `preparesForId: null`).
- [ ] **Step 2:** Run `pnpm vitest run src/features/certificates src/features/courses` → FAIL.
- [ ] **Step 3:** Implement; fix compile-only breaks elsewhere minimally (typecheck must stay green at this commit).
- [ ] **Step 4:** Run → PASS; `pnpm typecheck`.
- [ ] **Step 5: Commit** `feat(catalogue): certificate actions and a slimmer course`.

### Task D3: Catalogue page with two tabs

**Files:**
- Modify: `src/app/(app)/courses/page.tsx` (title "Catalogue", `Tabs` Certificates | Courses), `src/components/app-shell/nav.ts` (`NAV_ITEMS` label "Catalogue")
- Create: `src/features/certificates/components/{certificates-table.tsx,certificate-sheet.tsx}`
- Modify: `src/features/courses/components/{courses-table.tsx,course-sheet.tsx}`
- Test: `e2e/courses.spec.ts`

- [ ] **Step 1:** e2e:
  - admin adds an exam certificate (name, type, provider, validity 36) and a course that prepares for it; both tables show them and the course row shows "Prepares for <certificate>";
  - admin adds a course, then a "Course completion" certificate granted by it; choosing "Course completion" shows a required "Course" picker; the course row shows the certificate it grants;
  - a member sees both tabs read-only; the sidebar says "Catalogue".
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat(catalogue): certificates and courses tabs`.

### Task D4: certificate form picks a certificate; course studied optional or implied

**Files:**
- Modify: `src/features/records/{schema.ts,actions.ts,queries.ts}` (`certificateId` required, `courseId` nullable)
- Modify: `src/features/records/components/record-sheet.tsx`, `records-table.tsx`
- Test: `src/features/records/schema.test.ts`, `e2e/record-form.spec.ts`, `e2e/records.spec.ts`, `e2e/support/pilot-member.ts`

- [ ] **Step 1:** Tests:
  - schema requires `certificateId` ("Choose a certificate") and accepts `courseId: null`;
  - e2e: the first field is "Certificate"; each option shows its kind; for an exam certificate "Course studied" lists only courses that prepare for it and is optional; for a completion certificate the granting course is shown read-only and saved; hint "Can't find your certificate? Ask your admin to add it."; a second record for the same certificate shows the existing duplicate message (wording updated to "certificate").
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS (all record specs).
- [ ] **Step 5: Commit** `feat(records): track the certificate, with the course studied`.

### Task D5: import, export, dashboards and data quality

**Files:**
- Modify: `src/features/import/{clean.ts,plan.ts,queries.ts,sample-workbook.ts}` ("Course" column → certificate by name; new optional "Course studied")
- Modify: `src/features/export/records-export.ts` ("Certificate", "Kind", "Course studied"; validity from the certificate)
- Modify: `src/features/dashboard/**` ("Popular certificates", dimension `certificate`), `src/features/data-quality/**`
- Test: the matching `*.test.ts`, `e2e/import.spec.ts`, `e2e/export.spec.ts`, `e2e/dashboard.spec.ts`

- [ ] **Step 1:** Tests: an old-format workbook (no "Course studied") imports with certificates matched by name; the export headers round-trip through the import (existing round-trip test); the Explorer tab reads "Popular certificates"; breakdowns by type and provider come from the certificate.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat(catalogue): import, export and dashboards use certificates`.

### Task D6: docs, decision, full gate

**Files:**
- Modify: `docs/decisions.md` (decision #65: certificates and courses are separate catalogues; two kinds of certificate; the member tracks the certificate, the course studied is optional or implied), `docs/design-system.md`, `docs/superpowers/specs/2026-09-26-certtracker-design.md` (data model section)
- Modify: `docs/deploy/` runbook (cloud rollout: backup, `supabase db push`, counts of certificates, courses and records before and after)

- [ ] **Step 1:** Write the docs and the rollout steps.
- [ ] **Step 2:** Full gate from Global Constraints, e2e twice.
- [ ] **Step 3: Commit** `docs: certificate and course catalogues`.
