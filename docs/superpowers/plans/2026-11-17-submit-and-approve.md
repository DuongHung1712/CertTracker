# Submit and Approve (WBS 15.4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Status: **draft for the owner's review**; do not start until the owner approves the calls in "Calls to confirm".

**Goal:** A Completed learning item (exam certificate or course completion) waits for the manager in scope or the admin, who approves it or returns it with a note. Only Approved items count in dashboard numbers, breakdowns, ranking, the monthly report and expiry e-mails. Lists and exports show every item with its approval state.

**Spec:** `docs/superpowers/specs/2026-11-06-cert-core-das-pilot-design.md` §10.1 (states, who moves them, what counts, screens) and §10.4 (tests A-1 to A-7, E-11, E-12, E-15). The spec predates decision #65 (exam vs course completion); the owner's answers below fill that gap.

**Tech stack:** Next.js 16 App Router, Supabase Postgres + RLS, Zod, React Hook Form, shadcn/ui (Base UI), Vitest, pgTAP, Playwright.

## Owner decisions (2026-11-17)

1. **15.4 comes before the catalogue proposals feature** (see "Follow-up" at the end).
2. **Course completions need approval too**, exactly like exam certificates: every Completed item waits.
3. **Member's own dashboard:** the Held tile counts Approved items only; its summary line adds "N waiting for approval" so nothing looks lost.
4. **Process:** this plan, owner review, then build (CLAUDE.md: brainstorm, plan, TDD, review).

## Calls to confirm (my defaults; say if any is wrong)

- **C1. Returned note on resubmit:** when the member fixes a Returned item and it goes back to Waiting, the note is cleared (the manager writes a new one if they return it again). No history table in this phase.
- **C2. Proof is not required to submit.** A Completed item without proof still goes to Waiting; the manager sees "No proof" next to the Approve button and decides. Data Quality keeps flagging missing proof.
- **C3. What sends Approved back to Waiting** (member edits only, spec §10.1): the certificate, the course studied, the issue date / date passed, the certificate link or the proof file. Status/progress/notes edits on a not-completed item change nothing; a member changing a Completed item to In progress clears the approval (it is no longer Completed).
- **C4. Where the waiting count shows:** a "Waiting for approval" tile in the admin and manager dashboards (next to the existing groups) and a count on the `/records` filter; no e-mail (spec call).
- **C5. Data Quality** keeps counting Waiting items like any Completed item (it is about data, not approval).

## Global constraints

- RLS is the security layer; the database enforces who may change the state (a member can never approve, even through the API or a function). User queries only through `src/lib/supabase/server.ts`; no service role outside cron.
- Schema change = new migration + pgTAP for admin, manager (in and out of scope) and member including refused cases + `pnpm db:types`.
- Every view keeps `security_invoker = true`; computed fields stay in views.
- Server Actions validate with Zod, return `Result<T>`, never throw to the UI. No `any`, `@ts-ignore`, `eslint-disable`.
- UI English, sentence case, design tokens only; wording rule: a course completion is never called a "certificate" (use "item" or the kind-aware noun from `CERTIFICATE_KIND_NOUN`). `src/lib/ui-copy.test.ts` bans "records" in UI text.
- Never `supabase db reset` locally; apply with `pnpm exec supabase migration up --local`.
- Commits: Conventional Commits; no push without the owner.

## Data model

New enum `approval_state ('waiting', 'approved', 'returned')` and four columns on `training_records`:

| Column | Type | Rule |
|---|---|---|
| `approval` | `approval_state` | null unless `status = 'done'`; not null when `status = 'done'` (CHECK) |
| `approval_note` | `text` | required (non-blank) when `approval = 'returned'` (CHECK), null otherwise |
| `reviewed_by` | `uuid references auth.users (id) on delete set null` | set by the trigger when a manager/admin approves or returns |
| `reviewed_at` | `timestamptz` | same |

One trigger `training_records_approval` (BEFORE INSERT OR UPDATE, `security definer`, `search_path = ''`), run after the existing member-field guard:

- Not Completed: `approval`, `approval_note`, `reviewed_*` become null.
- **Member** (`app_role() = 'member'`): any attempt to set `approval` to `approved` or `returned`, or to change `approval_note`/`reviewed_*`, raises 42501 (A-2). Becoming Completed (insert or update) sets `waiting`. An Approved or Returned item whose certificate, course, issue date, link or proof changes goes back to `waiting`, note cleared (A-5, C1, C3).
- **Manager in scope or admin**: saving a Completed item without an explicit approval sets `approved` (spec call: their own saves and every admin import row are approved). Setting `approved` or `returned` stamps `reviewed_by = auth.uid()`, `reviewed_at = now()`. Out-of-scope managers never reach the row (existing RLS update policy, A-3).
- `commit_import` runs as the admin's JWT (#20), so imported Completed rows become Approved through the same trigger (no change to the function).

Migration: every existing `status = 'done'` row gets `approval = 'approved'` (A-6, decision #61: Phase 1 data counts as approved). `v_training_records` gains `approval` and `approval_note` (same column order otherwise; `create or replace` like `20261114000001`).

## What counts (A-7)

Everywhere a "done" item is counted, count only `approval = 'approved'`:

- SQL: `dashboard_kpis`, `dashboard_breakdown`, `dashboard_ranking` (latest definitions in `20261112000001` and `20261114000001`); add `waiting_records` to `dashboard_kpis` for the waiting tile.
- TS metrics: `src/features/dashboard/{metrics,admin-metrics,manager-metrics,completion-metrics,member-metrics}.ts` (the shared `isDone` helpers become "done and approved" for counting; lists still show every item).
- E-mails: `src/features/notifications/{expiry-plan,monthly-plan,snapshot}.ts` select `approval` and use Approved items only.
- Not counted-filtered: lists, `/me`, `/records`, exports, Data Quality (C5).

## Tasks

### Task 1: migration, trigger, RLS and pgTAP
**Files:** create `supabase/migrations/20261117000001_submit_and_approve.sql`, `supabase/tests/database/25_submit_and_approve.test.sql`; update `src/types/database.ts` (`pnpm db:types`); adjust older pgTAP files only where they insert Completed rows and now see `approval` (list them in the report).
- [ ] pgTAP first (A-1 to A-6): member insert/update to Completed gives `waiting`; manager in scope and admin give `approved`; member setting `approved`/`returned` (direct update and through every SECURITY DEFINER function that writes `training_records`) is refused 42501; out-of-scope manager cannot update; `returned` without a note is refused (23514); member edit of each C3 field sends Approved back to Waiting, a progress/notes edit on a not-completed item does not; migration leaves every old Completed row Approved and the rest null; `reviewed_by/at` stamped; course completions behave like exams.
- [ ] Run, see red; implement the migration in the order: enum, columns (nullable), backfill, CHECKs, trigger, view; `pnpm db:types`; green.

### Task 2: counting only Approved items (A-7)
**Files:** new migration `20261117000002_count_approved_only.sql` (recreate the three dashboard functions with the approved filter and `waiting_records`), pgTAP `26_count_approved_only.test.sql`; the TS metrics and notification files listed above with their tests.
- [ ] pgTAP: a Waiting item does not count in kpis/breakdown/ranking but counts in `waiting_records`; manager scope still applies.
- [ ] Vitest: each metric ignores Waiting/Returned items; expiry and monthly plans skip them.

### Task 3: review action and member screens
**Files:** `src/features/records/{schema,actions,queries}.ts` (+ tests), `src/features/records/components/{records-table,record-sheet,evidence-cell}.tsx`, `src/components/status/*` (an `ApprovalBadge` next to the status), member dashboard (`member-kpi-cards.tsx` Held summary, `member-certificates-list.tsx`).
- [ ] `reviewRecord({ id, decision: "approve" | "return", note })`: Zod (note required and trimmed for return), updates through RLS, maps 42501 to "Only the member's manager or an admin can approve this.", returns `Result<null>`, revalidates `/records`, `/me`, `/dashboard`.
- [ ] Status cell shows Completed plus "Waiting for approval" / "Returned" (tokens, not colour alone); the sheet shows the return note to the member above the fields with what to fix; Held summary adds "N waiting for approval".
- [ ] Vitest: state labels and which actions each role sees (spec §10.4 unit).

### Task 4: manager and admin screens
**Files:** `records-table.tsx` (approval filter with count, row-menu Approve / Return next to "View evidence", Return dialog with a required note), dashboards (waiting tile in admin and manager views).
- [ ] `/records`: filter "Waiting for approval (N)" (keeps the `?view`-style URL param pattern if cheap: `?approval=waiting`), Approve in one click, Return opens a dialog requiring a note; actions only for rows the viewer may review; a member never sees them (E-12).
- [ ] Dashboard waiting tile links to `/records?approval=waiting`.

### Task 5: export, import, docs
**Files:** `src/features/export/records-export.ts` (+ test), import mapping (ignore the Approval column on import so an exported file imports unchanged, decision #26), `docs/decisions.md` (#66: this feature and the owner decisions above), `docs/process/04-wbs.md` (15.4 status), `docs/design-system.md` (approval badge), `CLAUDE.md` status line.
- [ ] Export gets an "Approval" column (Waiting / Approved / Returned / empty when not Completed); round-trip test (E-15).

### Task 6: e2e and full gate
**Files:** `e2e/approval.spec.ts` (new).
- [ ] E-11: member completes with proof, sees Waiting; manager sees it in the waiting filter, returns with a note; member sees the note, fixes the date, resubmits; manager approves; the member's Held and the manager dashboard rise only then.
- [ ] E-12: a member has no Approve/Return and a direct `reviewRecord` call is refused.
- [ ] E-15: export has the Approval column and re-imports unchanged.
- [ ] Full gate: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:db`, `pnpm build`, whole e2e suite.

## Rollout

Two migrations to `db push` with the release (after the backup), listed in `docs/deploy/accounts-and-catalogue.md`. Every existing Completed item becomes Approved, so the numbers do not drop on release day.

## Follow-up (after 15.4): catalogue proposals

From the owner's review of the "Custom Certificate Proposal" plan (2026-11-17), to be specced after 15.4:
- Members propose a missing exam certificate **or course completion** (name and provider); approving a completion also creates its granting course in the same transaction.
- Pending proposals show in a separate "Your requests" block on `/me` (not mixed into the learning list, KPIs or exports); the member sees Pending / Added / Declined with the reason and can cancel a pending one.
- Outcome is visible on `/me` only (realtime), no e-mail.
- Corrections to that draft: `reviewed_by` must reference `auth.users` (profiles has no `id`); the insert policy must stop a member inserting a reviewed or approved row; approval must be one SQL function (a single transaction, like `commit_import`) with pgTAP; the admin's approve form must collect certificate type and validity (exam) and allow "use an existing certificate" to avoid duplicates; add a per-member cap and duplicate check against the catalogue and pending proposals; do not copy record fields (status, dates, proof) into the request.
