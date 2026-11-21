# Learning Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split My learning into certificates (results, approved, in `training_records`) and learning items (the journey, new `learning_items` table), and move every "in progress / planned" number to learning items.

**Architecture:** New table `learning_items` + view `v_learning_items` with the same RLS matrix as `training_records`; `training_records` keeps certificates only and its rules are untouched. A one-time migration moves not-done records into learning items. Dashboard RPCs, import, export and the UI read the right table. New TS feature folder `src/features/learning/`.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Supabase Postgres + RLS, pgTAP, Zod, React Hook Form, TanStack Table v8, shadcn base-nova, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-20-learning-items-design.md` (owner approved 2026-11-20).

## Global Constraints

- Branch `feat/skills-ui-refine`. Commit per task; **never push**.
- **Never run `supabase db reset`.** Apply migrations locally with `supabase migration up`; then `pnpm db:types`.
- Every schema change = new file in `supabase/migrations/` (timestamps `20261120000002` onward, in task order) + pgTAP in `supabase/tests/database/` (next numbers `31_…` onward) + `pnpm db:types`.
- RLS is the security layer; user queries go through `lib/supabase/server.ts`. Views `with (security_invoker = true)`. Dates via `lib/dates.ts` / `public.vn_today()` (Asia/Ho_Chi_Minh).
- No `any`; Zod on the server even when the client validated. Server Actions return `Result<T>`.
- UI text English; dates shown `dd/MM/yyyy`; tokens only (no hex, no `text-[13px]`); shadcn base-nova uses `render`, not `asChild`; components add `data-*` hooks, never style-only classes.
- Code by feature: `src/features/learning/{schema.ts, queries.ts, actions.ts, components/}`.
- Before "done": `pnpm lint && pnpm typecheck`, `pnpm test`, `pnpm test:db`, and report real results.
- pgTAP tests follow `supabase/tests/database/28_member_delete_and_propose.test.sql` (`pg_temp.login_as`, `pg_temp.logout`, fixtures with fixed UUIDs, `begin … rollback`).

## Review Focus

1. **A learning item is never counted as a certificate.** After the move, a member with only learning items shows 0 held/valid/expiring and appears in no approval queue. Pinned in Task 4 (`kpis ignore learning items`) and Task 9 (`metrics never count learning rows`).
2. **Member writes another member's learning item / changes `member_id`.** Must be denied. Pinned in Task 1 RLS tests.
3. **Exam passed on a self-study item while the item stays open.** Submitting the certificate marks the item Completed with a finished date of today; it must not leave an open item that still shows as a planned exam. Pinned in Task 8 (`submit certificate completes the item`).
4. **Re-importing an exported file twice.** Learning rows must update the open item, not duplicate. Pinned in Task 5 (`reimport updates open learning item`).
5. **Planned exam date in the past on an open item.** Shown as overdue in Planned exams (as today for records). Pinned in Task 9 (`overdue planned exam from learning item`).

---

### Task 1: Undo the `record_type` migration and create `learning_items`

**Files:**
- Create: `supabase/migrations/20261120000002_learning_items.sql`
- Create: `supabase/tests/database/31_learning_items.test.sql`
- Modify: `src/types/database.ts` (regenerated)

**Interfaces:**
- Produces: table `public.learning_items(id uuid pk default gen_random_uuid(), member_id uuid not null → members on delete cascade, course_id uuid null → courses on delete restrict, target_certificate_id uuid null → certificates on delete restrict, status public.record_status not null default 'not_started', progress int not null default 0 check 0..100, planned_date date, finished_date date, notes text check length ≤ 2000, created_by uuid default auth.uid(), created_at, updated_at, progress_updated_at timestamptz)`; check `course_id is not null or target_certificate_id is not null`.
- Produces: view `public.v_learning_items` (`security_invoker = true`) columns: all table columns + `course_name, provider_name, course_catalogue_status, target_certificate_name, member_code, member_name, member_email, team_id, team_name, is_self_study (course_id is null)`.
- Produces: trigger function `public.learning_items_rules()` (before insert/update): target must be `kind = 'exam'` else `raise … errcode '23514'`; `status = 'done'` → `progress := 100`, `finished_date` required and `<= public.vn_today()` (errcode 23514); members cannot change `member_id` (errcode 42501, like `guard_record_member_fields`).
- Reuses: `public.set_updated_at()`, the progress-touch trigger function used by `training_records_touch_progress`.

- [ ] **Step 1: Write the failing pgTAP test** `31_learning_items.test.sql`, `plan(14)`:
  - `has_table('public','learning_items')`, `has_view('public','v_learning_items')`
  - member inserts own item with only `course_id` → 1 row; with only `target_certificate_id` (exam) → 1 row; with both → 1 row
  - insert with neither → `throws_ok(…, '23514')`
  - target = a completion certificate → `throws_ok(…, '23514')`
  - `status='done'` without `finished_date` → throws 23514; finished tomorrow → throws 23514; done with today → `progress` reads 100
  - member reads another member's item → 0 rows; member updates another member's item → 0 rows changed
  - member changes `member_id` of own item → throws 42501
  - manager in scope reads/updates item → 1; manager outside scope → 0; admin deletes any → 1
- [ ] **Step 2: Run** `pnpm test:db` → FAIL (`learning_items` does not exist).
- [ ] **Step 3: Write the migration.** First undo `20261120000001`: `drop column record_type` from `training_records` (after recreating `v_training_records` exactly as in `20261118000004_renewal_and_proposal_fixes.sql`, i.e. without `record_type`), and restore `training_records_course_matches_certificate()` to its `20261111000001` body (no `record_type` branch). Then create the table, triggers, view, RLS policies named `"learning_items: admin all"`, `"learning_items: read own or managed"`, `"learning_items: insert own or managed"`, `"learning_items: update own or managed"`, `"learning_items: delete own or managed"` (same predicates as the `training_records` policies in `20260928000004_rls.sql`; members may delete their own items), index on `member_id`, and `alter publication supabase_realtime add table public.learning_items` guarded like `20260930000001`.
- [ ] **Step 4: Apply and test:** `supabase migration up && pnpm db:types && pnpm test:db` → all pass.
- [ ] **Step 5: Commit** `feat(db): add learning_items and undo record_type`.

---

### Task 2: Move not-done records into learning items

**Files:**
- Create: `supabase/migrations/20261120000003_move_learning_records.sql`
- Create: `supabase/tests/database/32_move_learning_records.test.sql`

**Interfaces:**
- Consumes: `learning_items` (Task 1).
- Produces: function `public.move_open_records_to_learning() returns int` (security definer, `set search_path = ''`, execute revoked from `public, anon, authenticated` after the migration calls it once), returning the number of moved rows.

- [ ] **Step 1: Failing test** (`plan(7)`), fixtures: exam record `in_progress` 40% planned 2026-12-15 with a course; exam record `not_started` no course; completion record `in_progress` 30%; done approved exam record; then `select public.move_open_records_to_learning()` as superuser:
  - returns 3
  - exam/in_progress → learning item with `target_certificate_id` = its certificate, `course_id` kept, `progress = 40`, `planned_date = '2026-12-15'`
  - exam/not_started → item with target, `course_id` null
  - completion/in_progress → item with `course_id = certificates.course_id`, `target_certificate_id` null, `progress = 30`
  - the three source rows are gone from `training_records`
  - the done record is unchanged (`approval = 'approved'`)
  - second call returns 0 (idempotent)
- [ ] **Step 2: Run** `pnpm test:db` → FAIL.
- [ ] **Step 3: Implement** the function (insert … select from `training_records r join certificates c` where `r.status in ('not_started','in_progress')`, copying `member_id, notes, created_by, created_at`; then delete those ids) and `select public.move_open_records_to_learning();` at the end of the migration, followed by the revoke. `raise notice` the ids of moved rows that had `evidence_path`.
- [ ] **Step 4: Apply and test:** `supabase migration up && pnpm test:db` → pass.
- [ ] **Step 5: Commit** `feat(db): move open records to learning items`.

---

### Task 3: Courses can be proposed by members and approved by admins

**Files:**
- Create: `supabase/migrations/20261120000004_course_proposals.sql`
- Create: `supabase/tests/database/33_course_proposals.test.sql`

**Interfaces:**
- Produces: column `courses.catalogue_status text not null default 'approved' check in ('approved','pending','rejected')`, `courses.proposed_provider text null`, `courses.proposed_by uuid null default auth.uid()`.
- Produces: RLS `"courses: member propose pending"` (insert, role member/manager, `catalogue_status = 'pending'`) and `"courses: member update own pending"`, mirroring the certificate policies in `20261118000003_member_propose_certificate.sql` (this replaces the spec's `propose_course()` function: same rule, existing pattern).
- Produces: `public.approve_course(p_id uuid, p_grants_completion boolean) returns void` (admin only, errcode 42501 otherwise): sets `approved`; when `p_grants_completion` and no certificate has `course_id = p_id`, inserts a `kind = 'completion'` certificate with the course's name and provider. `public.reject_course(p_id uuid) returns void` (admin only).
- Produces: `v_learning_items.course_catalogue_status` now reads the column (view recreated, columns appended at the end).

- [ ] **Step 1: Failing test** (`plan(8)`): member inserts pending course → 1; member inserts `approved` course → RLS error; member sees own pending course, another member does not; learning item on a pending course → 1 row; member calls `approve_course` → 42501; admin `approve_course(id, true)` → course approved and exactly one completion certificate named like the course; second `approve_course(id, true)` creates no second certificate; `reject_course` → status rejected and the learning item still exists.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the migration.
- [ ] **Step 4:** `supabase migration up && pnpm db:types && pnpm test:db` → pass.
- [ ] **Step 5: Commit** `feat(db): member course proposals with admin approval`.

---

### Task 4: Dashboard RPCs count the journey from learning items

**Files:**
- Create: `supabase/migrations/20261120000005_dashboard_learning_counts.sql`
- Create: `supabase/tests/database/34_dashboard_learning_counts.test.sql`
- Modify: `src/features/dashboard/schema.ts` (only if a returned key changes)

**Interfaces:**
- Consumes: latest bodies of `dashboard_kpis()`, `dashboard_breakdown(p_dimension text, p_limit int)`, `dashboard_ranking()` in `20261118000004_renewal_and_proposal_fixes.sql` / `20261114000001_completions_never_expire.sql`.
- Produces: same names and return shapes. Changed fields: `dashboard_kpis().in_progress_records`, `not_started_records` = counts of `learning_items` by status (in caller's RLS scope); `completion_in_progress_records` = learning items with `course_id is not null` and status ≠ done; `total_records` = certificates only. `dashboard_breakdown().in_progress`/`not_started` and `dashboard_ranking().nprogress` from learning items (breakdown dimension `certificate` groups learning items by `target_certificate_id`).

- [ ] **Step 1: Failing test** (`plan(6)`), fixture member with 1 approved exam certificate + 2 learning items (one in progress with a course, one not started with a target exam): as admin `dashboard_kpis()` → `in_progress_records = 1`, `not_started_records = 1`, `completion_in_progress_records = 1`, `total_records = 1`, held/valid counts unchanged (**kpis ignore learning items**: a member with only learning items adds 0 to valid/expiring/expired); `dashboard_ranking()` row → `nprogress = 1`.
- [ ] **Step 2: Run** → FAIL. Update `23_dashboard_kpis_by_kind.test.sql` / `26_count_approved_only.test.sql` expectations that relied on in-progress `training_records` fixtures, keeping their intent.
- [ ] **Step 3: Implement** with `create or replace function` (same signatures).
- [ ] **Step 4:** `supabase migration up && pnpm test:db` → all pass.
- [ ] **Step 5: Commit** `feat(db): dashboard journey counts from learning items`.

---

### Task 5: Import routes rows to certificates or learning items

**Files:**
- Create: `supabase/migrations/20261120000006_import_learning_items.sql`
- Create: `supabase/tests/database/35_import_learning_items.test.sql`
- Modify: `src/features/import/{columns-guide.ts, clean.ts, plan.ts, queries.ts, sample-workbook.ts, workbook.ts}` and their tests; `preparing-course.ts` stops creating `prepares_for` links (owner dropped `prepares_for`; the column stays until a later cleanup migration)

**Interfaces:**
- Produces: import columns `type` (`Certificate` | `Learning`, optional) and `course` (optional) in the staging JSON; `commit_import(p_batch_id uuid)` same signature, new branch: `type = 'Learning'` (or no type and status ≠ Completed) → upsert into `learning_items`, matching an **open** item with the same `member_id`, `course_id`, `target_certificate_id` (null-safe `is not distinct from`); otherwise insert. Certificate rows unchanged.
- Produces (TS): `ImportRowKind = "certificate" | "learning"`; `routeImportRow(row: { type?: string; status: RecordStatus }): ImportRowKind` in `src/features/import/plan.ts`.

- [ ] **Step 1: Failing tests.** pgTAP (`plan(4)`): batch with a Learning row (course only, empty certificate) → 1 learning item; same batch committed again → still 1 item, progress updated (**reimport updates open learning item**); row without type, status In progress, exam certificate → learning item with target; row status Completed → certificate as today. Vitest `plan.test.ts`: `routeImportRow({ type: "Learning", status: "done" })` → `"learning"`; `({ status: "in_progress" })` → `"learning"`; `({ status: "done" })` → `"certificate"`; Certificate cell may be empty only when type is Learning and a course is given (clean error otherwise: `"Certificate or Course is required"`).
- [ ] **Step 2: Run** `pnpm test:db` and `pnpm test src/features/import` → FAIL.
- [ ] **Step 3: Implement** SQL branch and TS parsing/columns guide text: Type — "Certificate for a result, Learning for a course or exam you are preparing. Empty: Completed rows are certificates, others learning."
- [ ] **Step 4:** run both test commands → pass.
- [ ] **Step 5: Commit** `feat(import): route rows to certificates or learning items`.

---

### Task 6: Certificates tab and sheet are certificates only

**Files:**
- Modify: `src/features/records/{kind.ts, queries.ts, schema.ts, actions.ts, __fixtures__/record-row.ts}`
- Modify: `src/features/records/components/{record-sheet.tsx, records-table.tsx}` and their tests
- Modify: `src/features/dashboard/components/member/member-certificates-list.tsx` (renewal no longer presets a not-started record)

**Interfaces:**
- Removes: `recordType` everywhere, `isCourseRecord`, `isCertificateRecord`, `learningTabCounts`, `LEARNING_TABS`, `sheetMode`/`courses` props and course mode of `RecordSheet`, the certificate-as-course fallback.
- Keeps/produces: `RecordSheet` always saves `status: "done"`, `progress: 100`; no status or progress field; title "Add certificate" / "Edit certificate"; type tabs Exam / Course certificate (`ADD_KIND_CHOICES`); `CERTIFICATE_SUBTYPES` filter. `RecordsTable` certificate status cell uses `ApprovalBadge` (Waiting / Approved / Returned) and leaves Expired to `ExpiryBadge` (no second Expired badge).

- [ ] **Step 1: Update tests first:** `record-sheet.test.tsx` — no status combobox, saving calls `createRecord` with `status: "done"`; `records-table.test.tsx` — status column shows `ApprovalBadge` text, an expired approved row shows "Expired" exactly once.
- [ ] **Step 2: Run** `pnpm test src/features/records` → FAIL.
- [ ] **Step 3: Implement**; delete dead code listed above.
- [ ] **Step 4:** `pnpm test src/features/records && pnpm typecheck` → pass.
- [ ] **Step 5: Commit** `refactor(records): certificates only, drop record_type`.

---

### Task 7: Learning feature (schema, queries, actions, table, sheet, tabs)

**Files:**
- Create: `src/features/learning/{schema.ts, schema.test.ts, queries.ts, actions.ts, actions.test.ts}`
- Create: `src/features/learning/components/{learning-table.tsx, learning-table.test.tsx, learning-sheet.tsx, learning-sheet.test.tsx, learning-realtime.tsx}`
- Modify: `src/app/(app)/me/page.tsx`, `src/app/(app)/records/page.tsx` (tabs Certificates / Learning; tab state in `?tab=certificates|learning`)

**Interfaces:**
- Produces `schema.ts`: `learningSchema` (Zod) `{ memberId: guid, courseId: guid|null, targetCertificateId: guid|null, status: enum RECORD_STATUSES, progress: 0..100, plannedDate: date|null, finishedDate: date|null, notes: string ≤ 2000|null }`, refine: course or target required (`path: ["courseId"]`, message `"Choose a course or an exam"`); done → finishedDate required and not after `todayVn()`. `type LearningInput`.
- Produces `queries.ts`: `type LearningRow = { id, memberId, memberCode, memberName, teamId, teamName, courseId: string|null, courseName: string|null, providerName: string|null, courseCatalogueStatus: "approved"|"pending"|"rejected"|null, targetCertificateId: string|null, targetCertificateName: string|null, status: RecordStatus, progress: number, plannedDate: string|null, finishedDate: string|null, notes: string|null, isSelfStudy: boolean }`; `listLearningItems(filter?: { memberId?: string }): Promise<LearningRow[]>` from `v_learning_items`.
- Produces `actions.ts`: `createLearningItem(input: LearningInput): Promise<Result<{ id: string }>>`, `updateLearningItem(input: LearningInput & { id: string }): Promise<Result<null>>`, `deleteLearningItem(input: { id: string }): Promise<Result<null>>`, `proposeCourse(input: { name: string; providerId: string|null; proposedProvider: string|null }): Promise<Result<{ id: string }>>`.
- Produces components: `LearningTable({ rows, mode: "self"|"team", fixedMemberId?, courses, examOptions })`, `LearningSheet({ open, onOpenChange, editing: LearningRow|null, fixedMemberId?, courses, examOptions })`. Table columns: Item (course name or "Self-study"), Exam target, Provider (or "Self-study"), Status + %, Planned date (header "Planned date"; cell label from target: exam → planned exam), Finished, actions. Pending course shows `CatalogueStatusBadge`; rejected shows "Not approved".
- Copy: tab labels `Certificates (N)` / `Learning (N)`; add button "Add learning"; sheet fields "Course", "Exam you are preparing for", hint "Pick a course, an exam, or both."; duplicate warning "You already have an open item for this. Edit it instead."

- [ ] **Step 1: Failing tests:** `schema.test.ts` (neither course nor exam → error on courseId; done without finished date → error; finished tomorrow → error; both set → ok); `learning-sheet.test.tsx` (planned date label switches to "Planned exam date" when an exam is chosen; duplicate open item warning); `learning-table.test.tsx` (self-study row shows "Self-study"; team mode has no approve action); `actions.test.ts` (invalid input returns `{ ok: false }` without calling Supabase).
- [ ] **Step 2: Run** `pnpm test src/features/learning` → FAIL.
- [ ] **Step 3: Implement**, reusing `FilterBar`, `EntityCombobox`, `DateField`, `ProgressInline`, `RecordStatusLabel`, `CatalogueStatusBadge`, `ConfirmDialog`; realtime subscribes to `learning_items` and unsubscribes on unmount.
- [ ] **Step 4:** `pnpm test src/features/learning && pnpm typecheck && pnpm lint` → pass.
- [ ] **Step 5: Commit** `feat(learning): learning items tab, sheet and actions`.

---

### Task 8: Submit certificate from a learning item; propose a course

**Files:**
- Modify: `src/features/learning/components/{learning-table.tsx, learning-sheet.tsx}`
- Create: `src/features/learning/components/{submit-certificate.tsx, submit-certificate.test.tsx, propose-course-dialog.tsx, propose-course-dialog.test.tsx}`
- Modify: `src/features/records/components/record-sheet.tsx` (accept `presetCertificateId`, `onSaved?: (recordId: string) => void`)
- Modify: `src/app/(app)/courses/page.tsx` + `src/features/courses/{actions.ts, components/courses-table.tsx, components/course-sheet.tsx}` (pending courses list for admin with Approve / Reject; course sheet toggle "Grants a completion certificate", default on; remove the "Prepares for" field)

**Interfaces:**
- Consumes: `RecordSheet`, `updateLearningItem`, `proposeCourse`, `approve_course` / `reject_course` RPCs (Task 3).
- Produces: `submitTargets(row: LearningRow, completionCertificateIdByCourse: Map<string, string>): { exam?: string; completion?: string }` in `submit-certificate.tsx`. Behaviour: exam only → open `RecordSheet` preset exam; course with a completion certificate only → preset it; both → small choice ("Exam certificate" / "Course certificate") then preset; course without a completion certificate → open the propose-certificate dialog prefilled with the course name. After the certificate saves, `updateLearningItem` sets the item `done`, `progress 100`, `finishedDate = todayVn()` if not done.
- Produces: `approveCourse({ id, grantsCompletion })`, `rejectCourse({ id })` server actions in `src/features/courses/actions.ts`.

- [ ] **Step 1: Failing tests:** `submitTargets` for the four cases; **submit certificate completes the item** (saving calls `updateLearningItem` with `status: "done"` and today's date); propose-course dialog calls `proposeCourse` and the new course is selected in the sheet; course sheet no longer renders "Prepares for".
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** `pnpm test src/features/learning src/features/courses src/features/records && pnpm typecheck` → pass.
- [ ] **Step 5: Commit** `feat(learning): submit certificate from an item and propose courses`.

---

### Task 9: Dashboards and monthly e-mail read learning items for the journey

**Files:**
- Modify: `src/features/dashboard/{member-metrics.ts, manager-metrics.ts, completion-metrics.ts}` + tests
- Modify: `src/features/dashboard/components/manager/planned-exams-list.tsx`, `components/member/{member-dashboard-view.tsx, member-kpi-cards.tsx, member-certificates-list.tsx}`, `components/explorer/types.ts` (filter "With items in progress" reads learning items)
- Modify: `src/features/notifications/{monthly-plan.ts, types.ts}` + test; the dashboard pages that load data (add `listLearningItems`)

**Interfaces:**
- Consumes: `LearningRow`, `listLearningItems` (Task 7).
- Produces: the "Renew" action in `member-certificates-list.tsx` opens `LearningSheet` preset with `targetCertificateId` = the expiring exam (replaces the old not-started record preset removed in Task 6); test: clicking Renew opens the sheet with that exam selected.
- Produces: `plannedExams(items: LearningRow[], today: string): { memberId, memberName, examName, plannedDate, overdue: boolean }[]` in `manager-metrics.ts` (items with `targetCertificateId`, `plannedDate`, status ≠ done; `overdue = plannedDate < today`), replacing the record-based version at `manager-metrics.ts:237-263`. Member "next planned" uses the same function filtered to the member. `MonthlyPlan` loses `completionRate`; `inProgress` / `notStarted` come from learning items.

- [ ] **Step 1: Failing tests:** **metrics never count learning rows** (member metrics given only learning items → held/valid/expiring 0); **overdue planned exam from learning item** (`plannedExams` with plannedDate yesterday → `overdue: true`; a done item is excluded; an item without target is excluded); monthly plan has no `completionRate` and counts in-progress items.
- [ ] **Step 2: Run** `pnpm test src/features/dashboard src/features/notifications` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** same command + `pnpm typecheck` → pass.
- [ ] **Step 5: Commit** `feat(dashboard): planned exams and progress from learning items`.

---

### Task 10: Export carries Type and Course

**Files:**
- Modify: `src/features/export/records-export.ts` + test, `src/app/api/export/records/route.ts`

**Interfaces:**
- Consumes: `listRecords`, `listLearningItems`, import columns from Task 5.
- Produces: `buildRecordsExport(records: RecordRow[], items: LearningRow[])` → one sheet; columns add `Type` (first business column) and `Course`; certificate rows: Type `Certificate`, no Progress/Planned values; learning rows: Type `Learning`, Certificate = exam target name (or empty), Course, Status, Progress, Planned date (`planned_date`), Issued date empty, Notes. Column order equals the import columns guide.

- [ ] **Step 1: Failing test:** export of 1 certificate + 1 learning item has 2 rows with Types `Certificate`/`Learning`; feeding the produced workbook through `readImportTable` + `routeImportRow` yields one certificate and one learning row (round trip, decision #26).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4:** `pnpm test src/features/export src/features/import` → pass.
- [ ] **Step 5: Commit** `feat(export): type and course columns for learning items`.

---

### Task 11: End-to-end, docs, final verification

**Files:**
- Create: `e2e/learning-items.spec.ts`
- Modify: `docs/decisions.md` (decision #72 summarising the spec; mark #71 superseded), `CLAUDE.md` "Trạng thái hiện tại" (unpushed migrations `20261120000001`–`6`), `docs/process/04-wbs.md` if it lists record statuses

- [ ] **Step 1: Write e2e** with seed accounts from `supabase/seed.sql`: member adds learning item "Self-study" for an exam with planned date → item shows in Learning tab and in member "Planned exams"; member clicks Submit certificate, fills date passed + link, saves → certificate Waiting, item Completed; manager approves → member dashboard held count +1; a course-only item never changes held count.
- [ ] **Step 2: Run** `pnpm test:e2e e2e/learning-items.spec.ts` → pass (dev server + local Supabase).
- [ ] **Step 3: Write docs** (decision #72 in Vietnamese like the others; reason: owner 2026-11-20 review of the two-tab change).
- [ ] **Step 4: Full verification:** `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db` → all pass; report the counts.
- [ ] **Step 5: Commit** `docs: decision #72 learning items` (e2e in the same commit). Do not push.
