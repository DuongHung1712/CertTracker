# Learning items vs certificates — design

**Date:** 2026-11-20 · **Owner decisions:** conversation of 2026-11-20 (recorded as decision #72 when approved) · **Replaces:** the `record_type` approach of commit `5650448` and migration `20261120000001_learning_record_type.sql` (not `db push`ed; deleted and replaced).

## 1. Why

My learning mixes two different things in one row: *the journey* (I am studying, 40%, exam planned 15/12) and *the result* (I passed, here is the PDF, please approve). Forcing both into `training_records`, where `certificate_id` is required, made the Gemini change attach a random certificate to a plain course, so a finished Udemy course counted as an AWS certificate on dashboards. The owner wants them apart:

- **Certificate** = something achieved. Two kinds: **exam** (passed an exam) and **course completion** (credential for finishing a course). Submitted with evidence, approved by a manager or admin. No progress %.
- **Learning item** ("quá trình học của mình") = the journey: a **course** from a provider (AWS, Udemy, Coursera…), **self-study for an exam** (e.g. HSK 3, no provider), or **both in one item** ("AWS SAA course on Udemy, exam planned 15/12", owner 2026-11-20). Progress %, planned date, no approval, no evidence.

## 2. Goals, non-goals, anti-goals

**Goals**
- Two independent lists per member: certificates and learning items. Finishing a course keeps the learning item (status *Completed*, history) and the member separately submits the completion certificate, which waits for approval.
- Managers still see who plans which exam when ("Planned exams" KPI, overdue warnings, monthly plan e-mail).
- A member can track a course or self-study that has no certificate, and can submit a certificate without any learning item.

**Non-goals (later)**
- Linking certificates to skills (admin decides per certificate in the catalogue, owner 2026-11-20). Skills stay self-rated.
- `courses.prepares_for_id` (owner: not needed). Dropped from the UI and import; column removal is a follow-up migration once nothing reads it.

**Anti-goals (failure even if it "works")**
- Any learning item counted as a held/valid/expiring certificate anywhere (dashboards, export, held counts, expiry cron).
- A learning item asking for approval or evidence.
- Losing an existing record's data during the move.

## 3. Approaches considered

| | Approach | Trade-off | Decision |
|---|---|---|---|
| A | **Two tables:** `training_records` holds certificates only; new `learning_items` holds the journey | New RLS, realtime, and moving "Planned exams"/overdue/monthly plan to the new table; certificate rules, KPIs, export and approval stay untouched | **Chosen** (owner) |
| B | One table with `record_type`, `certificate_id` nullable for learning rows | Every certificate query (KPIs, held, expiry, export, import, approval trigger) must remember to filter; one miss = wrong numbers (the bug we just found) | Rejected |
| C | One row for both journey and result | Owner chose "two rows" | Rejected |

## 4. Data model

### 4.1 `learning_items` (new)

| Column | Type | Rule |
|---|---|---|
| `id` | uuid pk | |
| `member_id` | uuid → members, not null | RLS like `training_records` |
| `course_id` | uuid → courses, null | the course followed |
| `target_certificate_id` | uuid → certificates, null | must be `kind = 'exam'` (self-study for an exam) |
| `status` | `record_status` (`not_started` / `in_progress` / `done`) | reuse the enum; UI label for `done` is "Completed" |
| `progress` | int 0–100, default 0 | `done` → 100 |
| `planned_date` | date, null | label "Planned exam date" when `target_certificate_id` is set, else "Planned finish date" |
| `finished_date` | date, null | required when `done`, not in the future (Asia/Ho_Chi_Minh, `vn_today()`) |
| `notes` | text ≤ 2000, null | |
| `created_by`, `created_at`, `updated_at`, `progress_updated_at` | | same triggers as `training_records` |

Checks: `course_id is not null or target_certificate_id is not null` (both may be set, owner 2026-11-20); `target_certificate_id` references an exam (trigger, errcode 23514). No unique key: a member may retake a course or an exam. *My call:* the form warns when the member already has an **open** (not done) item with the same course and target exam.

View `v_learning_items` (`security_invoker = true`) adds course name, provider name, target certificate name, member code/name/team, and `is_self_study = course_id is null`.

RLS (same matrix as `training_records`, pgTAP under all three roles, including denials): member reads/writes own rows (cannot change `member_id`); manager reads/writes in scope; admin all. Realtime publication on.

### 4.2 `training_records` (certificates only)

- Holds exam and completion certificates only. `certificate_id` stays not null.
- A certificate row is a *result*: `status = 'done'` always for new rows, `progress` no longer shown or edited (column kept, set to 100; removal later). `planned_exam_date` no longer written (kept for the move, removal later).
- Approval flow unchanged (decision #66): saving a certificate as a member puts it in *Waiting*; manager/admin Approve / Return. UI states: Waiting for approval, Approved, Returned, Expired (approved exam past expiry).
- Renewal (decision of 2026-11-18): planning a renewal becomes a learning item targeting that exam; the new certificate row is added when passed. The partial unique index on `(member_id, certificate_id) where status in ('not_started','in_progress')` becomes unused.

### 4.3 Catalogue

- **Course** keeps name + provider. No provider = shown as "Self-study" (owner: "provider không có thì là self study").
- **Completion certificate** is created automatically with the course's name when an admin adds a course that grants one (today: `certificates.course_id` unique, check `completion ⇔ course_id`). Builder: a "Grants a completion certificate" toggle on the course sheet, default on.
- **Member proposes a course** when it is missing (owner: "không có khóa học thì thôi cho user propose add") and **can track it right away** (owner 2026-11-20). New column `courses.catalogue_status` (`approved` default / `pending` / `rejected`), like `certificates.catalogue_status`. A security-definer `propose_course(name, provider)` lets a member insert a pending course (members still cannot write `courses` directly). Admin approves or rejects; approving also creates its completion certificate when "Grants a completion certificate" is on. A learning item on a rejected course stays, shown with a "Not approved" badge. The existing "propose a completion certificate" path stays as it is.
- *My call:* existing courses get **no** backfilled completion certificate (most were created as exam-prep courses). "Submit certificate" on a course without one opens the propose-certificate dialog prefilled with the course name.
- Self-study for an exam needs no course: the member picks (or proposes) the exam.

### 4.4 Moving existing data (one migration, idempotent, run once)

| Existing `training_records` row | Becomes |
|---|---|
| `status = 'done'` | stays a certificate row, unchanged (approval kept) |
| `status in ('not_started','in_progress')`, kind exam | learning item: `target_certificate_id = certificate_id`, `course_id` kept if set (both in one item), `progress`, `planned_date = planned_exam_date`, notes; source row deleted |
| `status in ('not_started','in_progress')`, kind completion | learning item: `course_id = certificates.course_id` (granting course), progress, `planned_date`, notes; source row deleted |

Rows with evidence but not done: keep as learning item and leave the evidence file in storage; builder logs their ids in the migration output (expected: none in production, which has no real data yet per CLAUDE.md).

## 5. Screens

### 5.1 My learning (`/me`)
Two tabs, no "All":
- **Certificates (N)** — table: Certificate (+ Exam / Course certificate badge, provider), Status (Waiting / Approved / Returned / Expired), Expiry (`ExpiryBadge`), Issued, Evidence, actions. Filters: search, type (All / Exam / Course certificate), status, expiry. Button **Add certificate** → sheet: type tabs (Exam / Course certificate), certificate combobox (+ propose), date passed / issue date, evidence PDF or link, notes. No progress, no status picker.
- **Learning (N)** (owner wording "quá trình học"; tab label "Learning" is the builder's call, English UI) — table: Item (course name, or "Self-study"), Exam target (if any), Provider (or "Self-study"), Status + %, Planned date, Finished date, actions. Filters: search, status. Button **Add learning** → sheet: course combobox (optional, + propose course) and exam target combobox (optional, + propose exam), at least one required; status, progress, planned date ("Planned exam date" when an exam is set), finished date when Completed, notes.
- Row action on a learning item: **Submit certificate** — opens Add certificate prefilled: with the exam when only an exam is set; with the course's completion certificate when only a course is set; when both are set, the sheet asks which one (exam or course completion). Marks the learning item Completed if it is not.

### 5.2 Team pages (`/records`, manager/admin)
Same two tabs. Approval actions only on the Certificates tab. Existing "Kind" filter stays on Certificates.

### 5.3 Dashboards, e-mails (*my calls*, from the builder check)
After the move `training_records` only holds results, so every number that mixed "in progress / not started" with "done" changes:
- **Planned exams** (`planned-exams-list.tsx`, member "next planned", manager metrics, overdue) read **learning items with a target exam and a planned date, not done**.
- **In progress / Not started** counts (`dashboard_kpis()` `in_progress_records`, `not_started_records`, `completion_in_progress_records`; `dashboard_breakdown()` and `dashboard_ranking()` `in_progress`; explorer filter "With items in progress"; member dashboard in-progress tab; monthly e-mail `inProgress` / `notStarted`) read **learning items** (all of them; "completion in progress" = items with a course, not done).
- **total_records** = certificates only. **Completion rate** (done ÷ all, monthly e-mail) is removed: it no longer means anything.
- The monthly e-mail keeps its current content (KPIs + upcoming expiries); only its in-progress numbers switch source. (Correction: it never listed planned exams.)
- Everything that counts certificates (held, valid, expiring, expired, earned per month, approval queue, expiry cron) keeps reading `training_records` unchanged.
- Changed RPC signatures are new migrations with pgTAP; the TS callers and Zod schemas in `features/dashboard/schema.ts` follow.

### 5.4 Export / import (*my calls*)
- **One sheet**, as today, plus a **Type** column (`Certificate` / `Learning`) and a **Course** column; Certificate stays the column for the certificate or the exam target. `readImportTable` keeps finding the sheet by Email + Certificate; a course-only learning row has an empty Certificate cell, which import accepts when Type = Learning.
- Routing: Type = Certificate → `training_records`; Type = Learning → `learning_items`. A file without a Type column (older files) routes by status: Completed → certificate, otherwise learning item (exam → target exam; completion → its course).
- Re-import matching for learning items: same member + course + target exam with an **open** (not done) item → update it; otherwise insert. Certificates keep today's matching.
- Round-trip of an export must still import cleanly (decision #26); `commit_import` gains the learning branch (new migration + pgTAP).

## 6. Removed from the Gemini change
Migration `20261120000001_learning_record_type.sql` is already applied to the local database, so it stays in history and a **new migration undoes it** (drop `record_type`, restore `training_records_course_matches_certificate` and `v_training_records`); never `db reset`. Local rows it mislabelled are test data and move by the §4.4 rules. Remove `record_type` in types/queries/schema/actions, `isCourseRecord`/`isCertificateRecord`/`learningTabCounts` heuristics, the course mode of `record-sheet.tsx` (random certificate fallback), and the certificate-ids-as-courses fallback. Keep from it: two tabs, contextual add button, "Course certificate" wording, certificate status cell without progress (reusing `ApprovalBadge`, no duplicate Expired badge).

## 7. Testing
- pgTAP (`supabase/tests/database/`): `learning_items` RLS for member / manager (in and out of scope) / admin, including denials (member writes another member's item, manager outside scope, member changes `member_id`); check constraints (no course and no exam; target is a completion → 23514; finished date required when done, not in the future); data move on a fixture (each row type in §4.4); dashboard KPI functions count learning items for planned exams and never as certificates.
- Vitest: learning schema (Zod), both tabs, Submit certificate prefill, team tabs, export sheets, import routing, dashboard metrics.
- Playwright: member adds a self-study item for an exam → marks done → submits certificate → manager approves → it shows as held; a course item never appears in held counts.

## 8. Rollout
Local only until the owner approves: `supabase migration up` locally (never `supabase db reset`), `pnpm db:types`, tests. Production follows the existing order (backup, `supabase db push`, merge), together with the other unpushed migrations.

## 9. Left to the builder
Exact column names in the view, component split between `features/records` and a new `features/learning`, the duplicate-item warning wording, tab label wording within English-first UI, and how the propose-course dialog reuses the propose-certificate one.
