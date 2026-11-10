# Certificate and Course Catalogues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Status: **draft for discussion**; do not start until the owner approves the spec's open questions (section 10).

**Goal:** Split today's `courses` into a certificate catalogue (exam or course completion, with validity) and a course catalogue (duration, cost, refund), and make records track a certificate with an optional or implied course studied.

**Architecture:** One migration adds `certificates`, copies every course into it with the same id, moves validity/type/level there, adds `training_records.certificate_id`, and rewrites the view and functions that read courses; triggers enforce the kind rules. The app then gains a certificates feature, a two-tab Catalogue page, a record form that picks a certificate first, and import/export/dashboard wording that follows.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase Postgres + RLS, Zod, React Hook Form, shadcn/ui (Base UI), SheetJS, Vitest, pgTAP, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-10-certificate-catalogue-design.md`

## Global Constraints

- RLS is the security layer: user queries only through `src/lib/supabase/server.ts`; no service role outside cron.
- Every view `with (security_invoker = true)`; expiry and days to expiry stay computed in views, never stored.
- Dates in `Asia/Ho_Chi_Minh` via `src/lib/dates.ts`; shown as `dd/MM/yyyy`.
- No `any`, no `@ts-ignore`, no `eslint-disable`; Zod validates every Server Action input on the server; actions return `Result<T>` and never throw to the UI.
- Schema change = new migration + pgTAP for admin, manager and member including refused cases + `pnpm db:types`.
- UI text in English, sentence case, `pluralize` for counts; design-system tokens only; lucide 16 px.
- Never `supabase db reset` locally (it breaks the storage index); apply with `pnpm exec supabase migration up --local`.
- Ports: never 3000 or 3100; e2e on 3201 started by the task and stopped after.
- Commits: Conventional Commits ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; never `git add .`; no push without the owner.
- Every commit builds: `pnpm typecheck` green at each commit.

## Review Focus

1. A course with a null provider or null cert type (allowed today) migrates into a certificate with the same nulls and no constraint error. Test in D1.
2. Every existing record keeps the exact expiry date and status after the migration. Test in D1.
3. A record for a completion certificate saved with no course (import, old client) still ends up with the granting course. Test in D1.
4. An old workbook without a "Course studied" column imports exactly as before. Test in D5.
5. Deleting a course used as course studied keeps the record and clears the course; deleting a course that grants a completion certificate is refused with the spec's message. Tests in D1 (database) and D3 (UI message).

---

### Task D1: migration, triggers, RLS and pgTAP

**Files:**
- Create: `supabase/migrations/20261111000001_certificate_catalogue.sql`
- Create: `supabase/tests/database/19_certificate_catalogue.test.sql`
- Modify: `supabase/seed.sql` (certificates for the two seed rows; `prepares_for_id`; records with `certificate_id`; one completion example "Machine Learning Specialization" (Coursera, AI, no validity) with its course, no records)
- Modify: older pgTAP files only where they insert into the dropped `courses` columns (list each in the report)
- Modify: `src/types/database.ts` (`pnpm db:types`)

**Interfaces (produces):** enum `certificate_kind ('exam','completion')`; table `certificates` per spec 4.1; `courses.prepares_for_id`; `training_records.certificate_id not null`, `course_id` nullable with FK `on delete set null`; unique `training_records_member_certificate_key (member_id, certificate_id)`; triggers `courses_prepares_for_exam` (23514 "prepares_for must be an exam certificate") and `training_records_course_matches_certificate` (sets the granting course for completions; 23514 "course does not prepare for this certificate" for exams); `v_training_records` per spec 4.3; `dashboard_breakdown` dimensions `team | cert_type | provider | certificate`; `v_data_quality_issues` with `certificate_no_validity` for exams only; import commit upserting on `(member_id, certificate_id)` and creating exam certificates for unknown names; notification functions returning `certificate_name`.

- [ ] **Step 1: Write the failing pgTAP** covering: same-id copy and kind `exam` for every old course; `prepares_for_id = id`; `certificate_id = old course_id` for every record; seeded An–AWS `expiry_date` and `expiry_status` unchanged (Review Focus 2); null provider/type course migrates (Review Focus 1); kind check (23514 both directions); one completion per course (23505); prepares_for to a completion fails (23514); completion record inserted with `course_id` null gets the granting course (Review Focus 3); exam record with a non-preparing course fails (23514); duplicate member+certificate fails (23505); deleting a granting course fails (23503); deleting a course used as course studied sets `course_id` null and keeps the record (Review Focus 5); RLS per spec 4.5 for all three roles; `dashboard_breakdown('certificate')` returns rows, `('course')` raises 22023; `v_data_quality_issues` flags an exam without validity and not a completion without validity.
- [ ] **Step 2: Run** `pnpm test:db` → the new file FAILS.
- [ ] **Step 3: Implement** the migration in the order of spec section 5; update the seed; `pnpm db:types`.
- [ ] **Step 4: Run** `pnpm test:db` → all files PASS.
- [ ] **Step 5: Commit** `feat(db): separate certificates from courses`.

### Task D2: certificates feature, slimmer courses feature

**Files:**
- Create: `src/features/certificates/{schema.ts,actions.ts,queries.ts,schema.test.ts}`
- Modify: `src/features/courses/{schema.ts,actions.ts,queries.ts,schema.test.ts}`; compile-only call sites elsewhere

**Interfaces:**
- `certificateSchema = { kind: enum exam|completion ("Choose a kind"), name ("Enter the certificate name"), certTypeId ("Choose a certificate type"), providerId ("Choose a provider"), level, validityMonths ("Validity must be greater than 0"), url, courseId }`; refinement: completion requires `courseId` ("Choose the course that grants this certificate"); exam forces `courseId` to null.
- `createCertificate`, `updateCertificate`, `deleteCertificate(input) → Result<null>`; `23503` on delete → "This certificate has records. Delete them first."; update that changes kind follows spec Q6 and returns "This certificate has records with another course. Change them first." when it would break a record.
- `listCertificates(): Promise<CertificateRow[]>`, `CertificateRow = { id, name, kind, certTypeId, certTypeName, providerId, providerName, level, validityMonths, url, courseId, courseName }`.
- `courseFields` without `certTypeId`, `level`, `validityMonths`; with `preparesForId: z.guid().nullable()`; course rows gain `preparesForId`, `preparesForName`, `grantsCertificateName`; `deleteCourse` maps the granting-course 23503 to "This course grants the certificate <name>. Delete or change that certificate first."

- [ ] **Step 1:** Vitest for every rule and message above.
- [ ] **Step 2:** `pnpm vitest run src/features/certificates src/features/courses` → FAIL.
- [ ] **Step 3:** Implement; keep `pnpm typecheck` green.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat(catalogue): certificate actions and a slimmer course`.

### Task D3: Catalogue page with two tabs

**Files:**
- Modify: `src/app/(app)/courses/page.tsx` (title "Catalogue", `Tabs` Certificates | Courses), `src/components/app-shell/nav.ts` (`NAV_ITEMS` label "Catalogue"), `src/app/(app)/courses/loading.tsx`
- Create: `src/features/certificates/components/{certificates-table.tsx,certificate-sheet.tsx}`
- Modify: `src/features/courses/components/{courses-table.tsx,course-sheet.tsx}`
- Test: `e2e/courses.spec.ts`

- [ ] **Step 1:** e2e: exam certificate + course that prepares for it (both tables, "Prepares for" shown); completion certificate requires a granting course and the course row shows "Grants"; deleting a granting course shows the spec message; member sees both tabs read-only; sidebar "Catalogue".
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement per spec 6.1. **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat(catalogue): certificates and courses tabs`.

### Task D4: record form picks a certificate first

**Files:**
- Modify: `src/features/records/{schema.ts,actions.ts,queries.ts}`, `src/features/records/components/{record-sheet.tsx,records-table.tsx}`
- Test: `src/features/records/schema.test.ts`, `e2e/record-form.spec.ts`, `e2e/records.spec.ts`, `e2e/support/pilot-member.ts`

- [ ] **Step 1:** Tests per spec 6.2: `certificateId` required ("Choose a certificate"), `courseId` optional; options show the kind; exam → "Course studied" lists only preparing courses plus "None (self-study)"; completion → granting course read-only and saved; hint "Can't find your certificate? Ask your admin to add it."; duplicate message from spec 6.2; records table shows "Certificate" and kind.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS (all record specs).
- [ ] **Step 5: Commit** `feat(records): track the certificate, with the course studied`.

### Task D5: import, export, dashboards, data quality, e-mails

**Files:**
- Modify: `src/features/import/{clean.ts,plan.ts,queries.ts,sample-workbook.ts}`, `src/features/export/records-export.ts`, `src/features/dashboard/**`, `src/features/data-quality/**`, `src/features/notifications/{expiry-plan.ts,snapshot.ts,types.ts}`
- Test: the matching `*.test.ts`, `e2e/import.spec.ts`, `e2e/export.spec.ts`, `e2e/dashboard.spec.ts`, `e2e/notifications.spec.ts`

- [ ] **Step 1:** Tests: export headers per spec 6.4 and round-trip through the import; old workbook imports unchanged (Review Focus 4); "Course studied" that does not prepare for the certificate is a row error with the spec message; Explorer "Popular certificates"; data quality shows `certificate_no_validity` for exams only; expiry e-mail and monthly report use the certificate name.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat(catalogue): import, export, dashboards and e-mails use certificates`.

### Task D6: docs, decision, rollout, full gate

**Files:**
- Modify: `docs/decisions.md` (#65), `docs/design-system.md`, `docs/superpowers/specs/2026-09-26-certtracker-design.md` (data model), `docs/deploy/` runbook (spec section 9)

- [ ] **Step 1:** Write the docs and the rollout steps with the count checks.
- [ ] **Step 2:** Full gate: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:db`, `pnpm build`, whole e2e suite twice on 3201.
- [ ] **Step 3: Commit** `docs: certificate and course catalogues`.
