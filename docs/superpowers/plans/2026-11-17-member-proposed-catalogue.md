# Member-Proposed Certificates and Course Completions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Status: **draft for the owner's review**; do not start until the owner approves "Calls to confirm".

**Goal:** A member who cannot find their exam certificate or course completion in the Catalogue types its name and provider in the record form and saves the learning item as usual (status, dates, proof). The new name is a **pending** catalogue entry: it shows on the member's list as "New, waiting for admin" and counts nowhere until the admin completes it (type, validity, link, granting course) and approves it, merges it into an existing entry, or rejects it.

**Builds on:** decision #65 (certificates vs courses, kinds), #66 / WBS 15.4 (approval of Completed items). This replaces the earlier "Custom Certificate Proposal" draft (separate request table) reviewed on 2026-11-17.

## Owner decisions (2026-11-17)

1. Members can propose an **exam certificate or a course completion**.
2. The member enters **only the name and the provider**; everything else of the catalogue entry is filled in by the admin later.
3. The learning item is **saved immediately** and waits ("vẫn cho lưu nhưng ở chế độ chờ duyệt").
4. **Only the admin** approves, edits or merges new catalogue entries. Managers keep approving Completed items (15.4).
5. The outcome is visible on `/me` only (no e-mail).

## Calls to confirm (my defaults)

- **P1. One table, a status column.** A proposal is a row in `certificates` with `catalogue_status = 'pending'` plus the typed provider name; no separate request table. The member's record points at it like any certificate, so nothing has to be copied or re-entered after approval.
- **P2. Provider:** the member picks an existing provider or types a new name; a typed name is stored on the pending certificate (`proposed_provider`) and the admin turns it into a provider on approval (pick existing or create).
- **P3. Who sees a pending entry:** the member who proposed it, managers in scope of that member (so their `/records` row has a name), and the admin. It never appears in other members' pickers or the Catalogue tables (except the admin's "New from members" tab).
- **P4. Counting:** an item whose certificate is pending or rejected counts nowhere (dashboards, ranking, report, e-mails), even if it is Completed and approved under 15.4. Lists and exports show it with its label.
- **P5. Admin actions** on a pending entry, in a "New from members (N)" tab of `/courses`:
  - **Approve:** opens the certificate sheet prefilled with the name and kind; the admin chooses the provider and type, sets validity (exam) or the granting course (completion: pick an existing course or create it in the same step), then saves. The entry joins the Catalogue for everyone.
  - **Merge into existing:** pick an existing certificate of the same kind; every record pointing at the pending entry moves to it (a member who already has that certificate keeps their existing record and the duplicate is removed, with a message to the admin), then the pending entry is deleted.
  - **Reject:** a required note; the entry becomes `rejected`, the member sees "Rejected: <note>" on the item and can delete it. It still counts nowhere.
- **P6. Anti-spam:** at most 5 pending entries per member; a name that matches an approved entry of the same kind and provider (case- and space-insensitive) is refused with "This is already in the Catalogue: choose it from the list."; a member cannot propose the same name twice while it is pending.
- **P7. The member can edit the pending name or provider** (typo) while it is pending, from the record sheet; after approval only the admin can.

## Global constraints

Same as the 15.4 plan: RLS is the security layer; new migration + pgTAP for admin, manager in and out of scope, member, including refused cases; `pnpm db:types`; views `security_invoker`; Zod at every Server Action; `Result<T>`; no `any`; UI English, tokens only; a course completion is never called a "certificate"; no "records" in UI text; never `supabase db reset`; no commit without the owner.

## Data model

- `certificates`: add `catalogue_status` (`'approved' | 'pending' | 'rejected'`, default `'approved'`, existing rows approved), `proposed_by` (member id, null for admin-created), `proposed_provider` (text, only while pending), `review_note` (required when rejected), `reviewed_at`.
- Relax for pending rows only: `provider_id` and `cert_type_id` may be null (already nullable for type), a pending completion may have no `course_id` (the course-granting CHECK and `training_records_course_matches_certificate` skip pending entries).
- Unique name rule (provider, name) applies to approved rows; pending rows are checked by the proposal function (P6).
- One SQL function `propose_certificate(kind, name, provider_id, proposed_provider)` (security invoker, member or manager on own behalf) inserts the pending row with the guards of P6 and returns its id; the record insert then uses it. Or a single `create_record_with_proposal(...)` doing both in one transaction: chosen during implementation, whichever keeps the record trigger and RLS path unchanged.
- Admin functions in one transaction each: `approve_certificate(id, fields...)`, `merge_certificate(pending_id, target_id)` (moves records, resolves duplicates), `reject_certificate(id, note)`.
- RLS on `certificates`: select approved for everyone; pending/rejected for the proposer, managers of the proposer, admin; insert pending only through the function; update/delete of pending only admin (plus P7 rename by the proposer).
- `v_training_records` exposes `certificate_catalogue_status` (appended).
- Counting (P4): `dashboard_kpis`, `dashboard_breakdown`, `dashboard_ranking`, the TS metrics (`isCounted`/`isApprovedDone` in `src/features/records/kind.ts`) and the e-mail plans also require `catalogue_status = 'approved'`.

## Tasks

1. **Migration, RLS, functions, pgTAP:** columns, relaxed checks for pending, proposal function with P6 guards, approve/merge/reject functions, RLS for all roles incl. refused cases, view column, counting change in the three dashboard functions.
2. **Member form:** in the record sheet, "Can't find yours? Add it as new" switches the certificate picker to two fields (name, provider picker with "New provider…" free text); kind follows the form's kind tabs; saving creates the pending entry and the record together; the item shows a "New, waiting for admin" badge (and "Rejected: <note>" with delete when rejected); P7 rename while pending. Vitest/RTL.
3. **Counting in TS:** extend the shared helpers once; e-mails and member Held follow. Vitest.
4. **Admin tab:** "New from members (N)" on `/courses` (admin only): name, kind, provider as typed, proposer, items using it, date; Approve (certificate sheet prefilled, granting course for a completion), Merge into existing (picker of same kind), Reject (note). Count badge on the tab; a dashboard tile is not needed (the tab count is the prompt). Vitest.
5. **Export, docs:** export shows the label; decision #67; WBS row (new item under 15); runbook migration list; design-system line.
6. **e2e and gate:** member proposes an exam with a new provider and saves Completed with proof → admin approves with type and validity → manager approves the item (15.4) → counts rise; member proposes a completion → admin merges it into an existing one; member's proposal rejected → note shown, item deletable; a member cannot see another member's pending entry; cap and duplicate guards. Full gate.
