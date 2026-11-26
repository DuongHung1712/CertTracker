# My Skills (`/skills`) Database Persistence & Review Flow — Design

**Date:** 2026-11-26 · **Branch:** `feat/my-skills` · **Status:** Implemented on `feat/my-skills` (uncommitted), reviewed 2026-11-26; this document describes the shipped behaviour · **Updates:** `docs/skills-design-spec.md`, `docs/decisions.md` (#59, #65, #66, #70, #72)

---

## 1. Why

`/skills` currently renders in-memory mock data (`SEED_SKILLS`, `SEED_ROLE_BENCHMARK`, `ENTERPRISE_SKILL_CATALOG`) in `src/features/skills/components/skills-view.tsx`. Every reload loses edits, freshly created or imported members see Lê Minh Châu's fake ratings, Level 5 requests show `"Preview only: not saved or sent yet"`, and Managers/Admins cannot view a member's skill profile or approve/return Level 5 requests.

Meanwhile, the base schema (`supabase/migrations/20261119000001_skills_matrix.sql` and `20261120000009_member_column_guards.sql`) is already applied locally, with several concrete gaps discovered during audit:

1. **Empty catalogue in non-seeded environments & missing domains:** Only 7 of 9 domains and 16 of 182 skills were placed in `supabase/seed.sql` (none in migrations), and `mobile` and `embedded` do not exist in `skill_domains` at all.
2. **`skills.code` check constraint rejects `DC34-*`:** `skills_code_check` currently requires `^SKL-[A-Z]{2,4}-[0-9]{2}$`, blocking all 117 `DC34-001`..`DC34-209` codes.
3. **`years_of_experience` column type mismatch:** `member_skills.years_of_experience` is `smallint`, while `SkillAssessmentDialog` steps by `0.5`.
4. **Incomplete `member_skills` RLS & trigger guards:**
   - `"member_skills: update own or managed"` lacks an explicit `WITH CHECK` clause.
   - No `DELETE` policy exists for members or managers (`admin all` only).
   - `member_skills_review_columns()` does not block `member_id` or `skill_id` mutation on `UPDATE` (allowing a manager on their own row to reassign `member_id` and self-certify!).
   - No `review_note` column or `'returned'` status exists to support Manager/Admin returning a Level 5 request with actionable feedback, nor a clean path for members to downgrade an endorsed Level 5 or resubmit a returned Level 5 without tripping the `reviewed_by`/`reviewed_at` guard.
   - `member_skills` is not in `supabase_realtime`.
5. **Batch dialog lock-out for real users:** `SkillBatchAssessDialog` currently blocks `"Save ratings"` unless *every* skill in the catalogue has `currentLevel > 0`. With 182 real catalogue skills and 0 initial rows for new members, a user could never save 3 backend skills without rating 179 unrelated skills (and could never save `0 · None`).

---

## 2. Goals, Non-Goals, Anti-Goals

### Goals
- Persist all `/skills` reads and writes in Postgres via RLS-enforced queries and Server Actions (`quickRateSkill`, `saveSkillAssessment`, `batchSaveSkillAssessments`, `removeMemberSkill`, `reviewMemberSkill`).
- Seed the full 9-domain, 182-skill catalogue idempotently via migration while preserving the 16 seeded `a201..a216` UUIDs in `supabase/seed.sql`.
- Derive `certifiedProof` live from real `training_records` (`status = 'done'`, `approval = 'approved'`, `renewed = false`, non-expired for exams) joined with `skill_certificate_links`, `certificates`, and `providers`.
- Support Manager (in scope) and Admin viewing `/skills?memberId=<id>`, linked from `/members` (`"View skills"`) and from a pending Level 5 review queue on `/skills`, and approving or returning Level 5 requests.
- Display a clean `EmptyState` with `"Update skill rate"` CTA for freshly created/imported members with 0 `member_skills` rows.
- Replace the stale unused `SkillsMatrixCard` `"Coming soon"` placeholder with a live summary card on the Member Dashboard.

### Non-Goals
- Re-introducing per-skill role targets or gap scores (removed in Decision #70).
- Admin UI for editing `skill_certificate_links` or adding custom skills in `/courses` (separate catalogue follow-up).
- Separate file upload on `/skills` (certificates in `/me` remain the sole file-backed proof, per `docs/skills-design-spec.md` §6).
- Removing `skills.benchmark_level` (kept untouched with `default 3` because `supabase/tests/database/30_skills_matrix.test.sql:53` inserts it explicitly; UI never reads or renders it).

### Anti-Goals
- A member certifying their own skill (`42501` in DB trigger) or approving/returning their own Level 5 when acting as a manager on their own row.
- Counting unapproved (`waiting`/`returned`), `renewed`, or expired exam certificates as `certifiedProof`.
- Falling back to `SEED_SKILLS`, `SEED_ROLE_BENCHMARK`, or fake `recommendedCourses` in production UI when DB rows are empty.
- Using `service_role` in any query or Server Action (all operations use `createClient()` with the caller's JWT).

---

## 3. Data Model & Migrations (`supabase/migrations/20261126000001_my_skills_persistence.sql`, `20261126000002_my_skills_review_guards.sql`, `20261126000003_my_skills_level5_reviewed.sql`)

### 3.1 `skill_domains` (9 domains)
Upsert/insert all 9 domains matching `SKILL_CATEGORIES` in `src/features/skills/schema.ts`, preserving existing UUIDs (`5eed0000-0000-0000-0000-00000000d001`..`d009`):

| `id` (`5eed0000-0000-0000-0000-00000000...`) | `slug` | `name` | `sort_order` |
|---|---|---|---|
| `d001` | `cloud` | `Cloud & Infrastructure` | 1 |
| `d002` | `backend` | `Backend & Systems` | 2 |
| `d003` | `frontend` | `Frontend & Web` | 3 |
| `d004` | `devops` | `DevOps & SRE` | 4 |
| `d005` | `security` | `Security & Compliance` | 5 |
| `d006` | `data_ai` | `Data & AI` | 6 |
| `d007` | `leadership` | `Leadership & Collaboration` | 7 |
| `d008` | `mobile` | `Mobile & Native` | 8 |
| `d009` | `embedded` | `Embedded & IoT` | 9 |

- Use `ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name` so existing seeded DBs align `leadership` (`'Leadership & Architecture'` → `'Leadership & Collaboration'`) cleanly and `mobile`/`embedded` are added without violating `name` or `sort_order` uniqueness.

### 3.2 `skills` Constraint & Full 182-Skill Catalogue
1. Drop `skills_code_check` if exists and add:
   ```sql
   alter table public.skills
     add constraint skills_code_check
     check (code ~ '^(SKL-[A-Z]{2,4}-[0-9]{2}|DC34-[0-9]{3})$');
   ```
   (`INVALID_CODE` in `30_skills_matrix.test.sql` still fails with SQLSTATE `23514`.)
2. Idempotently insert all **182** catalogue skills in deterministic `sort_order`:
   - `1..16` (`skl-01`..`skl-16`): preserve exact UUIDs `5eed0000-0000-0000-0000-00000000a201`..`a216`.
   - `17..65` (`skl-17`..`skl-65`, 49 skills): deterministic UUIDs `5eed0000-0000-0000-0000-00000000a217`..`a265`.
   - `66..182` (`DC34-001`..`DC34-209`, 117 deduplicated DC34 skills): deterministic UUIDs `5eed0000-0000-0000-0000-0000dc340001`..`dc340209` (matching the 3-digit `DC34-NNN` suffix).
   - Resolve `domain_id` by `(select id from public.skill_domains where slug = v.domain_slug)`.
   - Use bare `ON CONFLICT DO NOTHING` (handling conflicts across `id`, `code`, and `name` uniformly).
   - The SQL `VALUES` were generated once from the former mock files `seed-data.ts` / `dc34-matrix.ts`; both were deleted after the review; unit tests use the six-skill fixture `src/features/skills/__fixtures__/skills.ts`, and duplicate names are blocked by the `skills` unique constraints.

### 3.3 `member_skills` Schema Updates
1. **`years_of_experience` precision:**
   ```sql
   alter table public.member_skills
     drop constraint if exists member_skills_years_of_experience_check,
     alter column years_of_experience type numeric(4, 1) using years_of_experience::numeric(4, 1),
     alter column years_of_experience set default 0,
     add constraint member_skills_years_of_experience_check
       check (years_of_experience >= 0 and years_of_experience <= 50);
   ```
2. **Level 5 return state & `review_note`:**
   - Extend `verification_status` CHECK to `('certified', 'self_assessed', 'pending_review', 'returned')`.
   - Add `review_note text check (review_note is null or length(review_note) <= 1000)`.
   - Add check constraint `member_skills_review_note_rules`:
     ```sql
     check (
       (verification_status = 'returned' and coalesce(btrim(review_note), '') <> '')
       or (verification_status is distinct from 'returned' and review_note is null)
     )
     ```
   - Keep `reviewed_by uuid references public.members(id) on delete set null` (consistent with `30_skills_matrix.test.sql:74`; nullable when an unlinked Admin or unlinked Manager reviews).

### 3.4 `member_skills` RLS, Column Guards & Realtime
1. **Explicit `WITH CHECK` on UPDATE & new DELETE policy:**
   - Replace `"member_skills: update own or managed"` with explicit `USING` and `WITH CHECK` matching `member_id = (select public.my_member_id()) or member_id in (select public.managed_member_ids())`.
   - Add `"member_skills: delete own or managed"` (`FOR DELETE TO authenticated`) with the same predicate.
   - Ensure explicit `grant select, insert, update, delete on public.member_skills to authenticated;` and `grant select on public.skill_domains, public.skills, public.skill_certificate_links to authenticated;`.
2. **Trigger `public.member_skills_review_columns()` (`BEFORE INSERT OR UPDATE`, `security definer set search_path = ''`):**
   - Bypass when `auth.uid() is null` (migrations, `seed.sql`, pgTAP superuser).
   - **Immutability on `UPDATE`:** Reject any change to `member_id` or `skill_id` (`errcode = '42501'`) for all non-admin callers (and even better, reject `skill_id` changes for everyone since `(member_id, skill_id)` is the row's identity).
   - **Self-rating branch** (`v_role = 'member'` or `v_role = 'manager' and new.member_id is not distinct from public.my_member_id()`):
     - `INSERT`: forbid `verification_status in ('certified', 'returned')`, `reviewed_by is not null`, `reviewed_at is not null`, `review_note is not null` (`errcode = '42501'`). Enforce `verification_status = 'pending_review'` and `manager_endorsement_requested = true` when `current_level = 5`, else `'self_assessed'` and `false`.
     - `UPDATE`:
       - Forbid transitioning into `'certified'` or `'returned'` (`42501`).
       - Forbid caller-supplied changes to `reviewed_by`, `reviewed_at`, or `review_note` (`42501`).
       - If `current_level` changed OR `old.verification_status = 'returned'` (member resubmitting or lowering rating): automatically clear `reviewed_by := null; reviewed_at := null; review_note := null;`, and set `verification_status := case when new.current_level = 5 then 'pending_review' else 'self_assessed' end` and `manager_endorsement_requested := (new.current_level = 5)`.
       - If `current_level` did not change and `old.verification_status = 'certified'`: preserve `'certified'`, `reviewed_by`, `reviewed_at` (e.g., member updates `evidence_note` or `years_of_experience` on an endorsed Level 5, preserving `30_skills_matrix.test.sql:94`).
   - **Reviewer branch** (`v_role = 'admin'` — including an admin on their own row, as for certificates in decision #66 — or `v_role = 'manager' and new.member_id is distinct from public.my_member_id()`). The final function body is the one in `20261126000002` (it replaces the `20261126000001` version):
     - `certified` or `returned`: `manager_endorsement_requested := false`; `certified` clears `review_note`; `returned` clamps `current_level := least(..., 4)` so returned skills never inflate Level 5 metrics (`member_skills_review_note_rules` requires a non-empty note, `23514`).
     - Reviewer stamps are **never taken from the caller**: on INSERT, or when the status or the note changes, `reviewed_by := public.my_member_id()` (null for an unlinked admin) and `reviewed_at := now()`; otherwise the old stamps are kept. A forged `reviewed_by` is silently replaced (pgTAP 58–60).
     - Any other status: review fields are cleared, `pending_review` below Level 5 is normalised to `self_assessed`, and `manager_endorsement_requested` follows `pending_review and level = 5`.
   - **Level/status invariants (CHECK):** `pending_review` only at Level 5 (`member_skills_pending_review_level_check`, migration `…02`), and Level 5 only as `pending_review` or `certified` (`member_skills_level5_reviewed_check`, migration `…03`, added in review because the reviewer branch let a manager store a managed member's Level 5 as `self_assessed`). Both migrations normalise existing rows first.
3. **Realtime:** Guarded `alter publication supabase_realtime add table public.member_skills;`.

### 3.5 `supabase/seed.sql` Consistency
- Update `d007` name to `'Leadership & Collaboration'`, add `d008` (`mobile`) and `d009` (`embedded`) with `on conflict (slug) do nothing`.
- Keep `a201..a216` UUIDs for the 16 seeded skills (`on conflict (code) do nothing`).
- Keep `b003` (Lê Minh Châu) with **zero** `training_records` so `e2e/dashboard.spec.ts` and `e2e/approval.spec.ts` remain untouched; set `b003`'s non-Level-5 `member_skills` rows to `'self_assessed'` and `a213` to `current_level = 5, verification_status = 'pending_review', manager_endorsement_requested = true`.
- Add 1 `member_skills` row for `b001` (Nguyễn Văn An, who holds `e001` AWS SAA in `training_records`) on `a201` (`current_level = 4, verification_status = 'self_assessed'`) so real certificate-backed `"Certified"` derivation is visible out of the box.

---

## 4. Backend Queries & Server Actions (`src/features/skills/`)

### 4.1 Proof Derivation & Status Resolution Rules
- **Source of `certifiedProof`:** Join `v_training_records` (`member_id = targetId`, `status = 'done'`, `approval = 'approved'`, `renewed = false`, `expiry_status in ('Active', 'Expiring in 60d', 'Expiring Soon', 'No Expiry')`) with `skill_certificate_links` (`skill_id`, `certificate_id`, `proves_level`) and `certificates` (`level`).
- For each `skill_id`, choose the highest-priority valid proof (highest `proves_level`, then latest `issued_date`, then `record.id`).
- Build `CertifiedProof`:
  - `certificateName`: `record.certificate_name`
  - `certificateCode`: `certificate.level ?? ""` (UI filters empty strings when joining metadata)
  - `issuer`: `record.provider_name ?? "—"`
  - `verifiedDate`: `record.issued_date`
  - `expiryDate`: `record.expiry_date`
  - `credentialUrl`: `record.evidence_path ? "/api/records/" + record.id + "/evidence" : (record.certificate_url ?? undefined)`
  - `recordId`: `record.id`
- **Effective UI `verification` (`VerificationStatus`):**
  - `"returned"` if `row.verification_status === "returned"`
  - `"pending_review"` if `row.verification_status === "pending_review"` (including `currentLevel === 5` awaiting review)
  - `"certified"` if `(row.current_level === 5 && row.verification_status === "certified")` (manager/admin endorsed Level 5) OR `(row.current_level > 0 && certifiedProof !== undefined)` (backed by a valid approved certificate)
  - `"self_assessed"` otherwise.
- Notice: For levels 1–4, `"Certified"` is **never** trusted from a raw DB flag alone if no valid certificate exists; it updates automatically when a certificate is approved, renewed, deleted, or expires.

### 4.2 Queries (`src/features/skills/queries.ts`)
- `loadSkillsWorkspace({ viewer, targetMemberId })`:
  - Resolves `targetId = targetMemberId ?? viewer.memberId`.
  - Reads `members` + `teams(name)` + `v_member_profiles` under caller RLS; if missing/inaccessible, returns `{ status: "not_found" }`.
  - Reads `skill_domains` (ordered by `sort_order`), all `skills` via `fetchAllRows` (ordered by `sort_order, id`), `member_skills` for `targetId` (with reviewer name via `members!member_skills_reviewed_by_fkey(full_name)`), `v_training_records`, and `skill_certificate_links`.
  - Produces `profileSkills` (only skills saved in `member_skills`), `catalogSkills` (all 182 skills overlaid with `member_skills` + `certifiedProof`), `benchmark` (`roleName`, `teamName`, `experienceLevel`, `description`), `canEdit` (`targetId === viewer.memberId`), `canReview` (`viewer.role === "admin" || (viewer.role === "manager" && targetId !== viewer.memberId)`), and `pendingReviews` (when viewer is Manager/Admin).
- `listPendingSkillReviews(viewerMemberId: string | null)`:
  - Queries `member_skills` where `verification_status = 'pending_review'` (excluding `viewerMemberId` if non-null so a Manager never sees their own Level 5 in their approval queue). RLS limits to managed teams for Manager, all for Admin.
- `listPendingSkillReviewCounts(viewerMemberId)`:
  - Lightweight helper for `/members` to display pending Level 5 review counts per member (`Map<string, number>`), excluding the viewer's own rows like the queue.
- `loadMemberSkillSummary(memberId: string)`:
  - Lightweight helper for Member Dashboard `SkillsMatrixCard`: returns `{ totalSkills, certifiedCount, pendingReviewCount, returnedCount, averageLevel }` using the same live proof logic.

### 4.3 Server Actions (`src/features/skills/actions.ts`) & Schemas (`src/features/skills/schema.ts`)
All Server Actions validate inputs with Zod (`z.guid()` for UUIDs, matching `src/features/records/schema.ts`), use `createClient()` (caller JWT), map errors with `mapPostgresError`, verify affected rows with `assertAffected` on updates/deletes, and revalidate `/skills`, `/dashboard`, `/members`:

- Single-skill writes (`quickRateSkill`, `saveSkillAssessment`) read the existing row first: an existing row is **updated** by id (`assertAffected`), a missing row is **inserted** with an upsert on `(member_id, skill_id)`. The status sent is only a hint; the trigger decides.
- `quickRateSkill({ skillId, level })` → writes `(member_id, skill_id)` preserving `years_of_experience` and `evidence_note`; sets `pending_review` for level 5 (unless already `certified` at level 5) and `self_assessed` for levels 0–4.
- `saveSkillAssessment({ skillId, newLevel, yearsOfExperience, evidenceNote })` → validates `yearsOfExperience` in `[0..50]` (rounded to 1 decimal place) and `evidenceNote` max 1000 chars (empty string saved as `null`). Preserves `certified` only if already `certified` at level 5 and level stays 5.
- `batchSaveSkillAssessments({ items: [{ skillId, level }] })` → deduplicated batch (1..300 items); fetches existing `member_skills` rows for `user.memberId` to preserve `years_of_experience`, `evidence_note`, skips rows that are already endorsed at Level 5 and stay at 5, then performs a single `.upsert(..., { onConflict: "member_id,skill_id" })`. The returned `count` is the number of items received (skipped endorsed rows included). The client sends only the rows whose level changed in the dialog.
- `removeMemberSkill({ skillId })` → deletes `(user.memberId, skillId)` via new `DELETE` RLS policy and checks `assertAffected`.
- `reviewMemberSkill({ memberId, skillId, decision, note })` → Manager/Admin approves (`verification_status = 'certified'`) or returns (`current_level = 4`, `verification_status = 'returned'`, required non-empty `note`) a `current_level = 5, verification_status = 'pending_review'` row; maps `42501` cleanly.

---

## 5. Frontend, Dashboard & Members Integration

### 5.1 `/skills` Route (`src/app/(app)/skills/page.tsx`) & `SkillsView`
- Supports `?memberId=<uuid>`:
  - Member requesting someone else's `memberId` redirects to `/skills`.
  - Unlinked member (`!user.memberId`) keeps existing `EmptyState` (`"Your account is not linked to a member"`).
  - Unlinked Admin/Manager without `?memberId`: renders pending Level 5 review queue (if any) + `EmptyState` linking to `/members` (`"Choose a member in Members to view their skills"`).
  - Out-of-scope or missing `memberId`: renders `EmptyState` (`"Member not found"`) with link back to `/members`.
- Adds `<SkillsRealtime />` subscribing to `member_skills` and `training_records` (unsubscribes on unmount).
- Removes all `SEED_SKILLS`, `SEED_ROLE_BENCHMARK`, `ENTERPRISE_SKILL_CATALOG` imports from `SkillsView` and `"Preview only: not saved or sent yet"` copy.
- **Empty profile state:** When `mySkills.length === 0`, renders an `EmptyState` (`"No skills rated yet"`) with CTA button `"Update skill rate"` (when `canEdit`) instead of showing `"No skills match these filters"`.
- **Optimistic & error handling:** Quick-rate updates optimistically and rolls back on failure; dialog saves show `"Saving…"` and keep the dialog open on error. Every failed mutation triggers `toast.error(result.error, { duration: Infinity })` per `docs/design-system.md` §3.
- **Batch dialog (`SkillBatchAssessDialog`):** Tracks `changedIds` (skills whose level changed from initial state). `"Save ratings"` is disabled when `!dirty` and submits **only changed skills** (allowing users to rate 3 skills or set a skill to `0 · None` without blocking on all 182 skills).
- **Review UX:**
  - When `pendingReviews.length > 0` (Manager/Admin on `/skills` without `?memberId`), shows a `"Waiting for your review (N)"` section listing member name (link to `/skills?memberId=...`), team, skill name, evidence note, and `Approve` / `Return` buttons.
  - When viewing `/skills?memberId=...` (`canReview`), `pending_review` cards/rows/detail dialog display `Approve` (one-click) and `Return` (opens `SkillReviewDialog` using `ConfirmDialog` + required `Textarea` `"What should the member fix?"`).
  - Returned skills show `SkillStatus` (`"Returned"`, `Undo2` icon, `text-destructive`) plus the manager's `reviewNote` on the card, detail dialog, and edit dialog.
  - Edit dialog (`SkillAssessmentDialog`) offers a secondary/destructive `"Remove"` option (with `ConfirmDialog`) for already-saved skills.

### 5.2 Member Dashboard `SkillsMatrixCard` Decision
- **Decision:** Upgrade `src/features/dashboard/components/member/skills-matrix-card.tsx` from an unused `ComingSoonCard` into a live summary card rendered in the left column of `MemberDashboardView` below `MemberProfileCard`, and update `src/features/dashboard/components/member/member-cards.test.tsx` (remove `SkillsMatrixCard` from the `ComingSoonCard` test array `CARDS` and add unit tests for the live card).
- **Playwright selector safety:** `e2e/dashboard.spec.ts:185` asserts `page.getByRole("link", { name: "My skills" })` (substring match on sidebar link). Therefore, the card's `<Link href="/skills">` text MUST be `"View skills"` / `"Rate skills"` (never containing `"My skills"`), keeping strict-mode link resolution unique to the sidebar.
- **Error isolation:** `loadMemberDashboard` settles `loadMemberSkillSummary(memberId)` independently (`settle()`), rendering `<SectionError title="My skills" />` on query failure.

### 5.3 Members Table Integration (`/members`)
- Add `"View skills"` (`<DropdownMenuItem render={<Link href={"/skills?memberId=" + row.original.id} />} />`, Base UI `render` prop) to the row actions menu in `src/features/members/components/members-table.tsx`.
- Pass pending Level 5 review counts from `src/app/(app)/members/page.tsx` to surface a subtle count badge/indicator on members who have Level 5 requests awaiting review.

### 5.4 Copy & Design-System Compliance
- Zero `"record"` / `"records"` in any string literal with spaces (`src/lib/ui-copy.test.ts`).
- Zero Vietnamese letters (`src/lib/english-ui.test.ts`).
- Zero contractions (`cannot`, `do not`, `is not`), zero `"credential"` (update `"Check credential"` in `SkillDetailDialog` to `"View certificate"`), tokens only, `formatDate` (`dd/MM/yyyy`), `pluralize()`, and Base UI `render` prop everywhere.

---

## 6. Verification & Parallel Swarm Slice Split

| Slice | Worker | Strictly Owned Files (Zero Overlap) | Verification |
|---|---|---|---|
| **1. DB & pgTAP** | `db-skills` | `supabase/migrations/20261126000001_my_skills_persistence.sql`, `supabase/seed.sql`, `supabase/tests/database/30_skills_matrix.test.sql`, `src/types/database.ts` | `supabase migration up` (never `db reset`), `pnpm db:types`, `pnpm test:db` |
| **2. Backend** | `backend-skills` | `src/features/skills/{types.ts,schema.ts,metrics.ts,metrics.test.ts,queries.ts,queries.test.ts,actions.ts,actions.test.ts}` | `pnpm typecheck`, `pnpm vitest run src/features/skills/` |
| **3. UI, Dashboard, Members, E2E** | `ui-skills` | `src/app/(app)/skills/**`, `src/features/skills/components/**`, `src/features/dashboard/load.ts`, `src/features/dashboard/components/member/{skills-matrix-card.tsx,member-dashboard-view.tsx,member-cards.test.tsx}`, `src/app/(app)/members/page.tsx`, `src/features/members/components/members-table.tsx`, `e2e/skills.spec.ts`, `docs/decisions.md` | `pnpm vitest run`, `pnpm lint`, `pnpm typecheck` |
| **4. Review & Full QA** | `reviewer`, `qa-verifier` | Read-only review + full suite & Playwright E2E (`e2e/skills.spec.ts`, `e2e/dashboard.spec.ts`, `e2e/approval.spec.ts`); findings route back to owning slice worker for fix cycles | `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db && pnpm test:e2e e2e/skills.spec.ts e2e/dashboard.spec.ts` |

---

## 7. Review findings (2026-11-26)

Checked against the code in the worktree; status after the review:

| # | Finding | Outcome |
|---|---|---|
| 1 | Reviewer branch let a manager (in scope) or admin store Level 5 as `self_assessed` through a direct API update, bypassing review | **Fixed:** CHECK `member_skills_level5_reviewed_check` (migration `20261126000003`), pgTAP 68 |
| 2 | `requestManagerReview` in `updateSkillAssessmentSchema` was never read (the trigger decides the status) | **Removed** from schema, action signature and `SkillsView` |
| 3 | Two copies of the status narrowing helper (`actions.ts`, `queries.ts`) | **Merged** into `toVerificationStatus()` in `metrics.ts`, unit-tested |
| 4 | `loadMemberDashboard` loaded the skills summary through a dynamic `import()` | **Static import** like the other queries; `dashboard/page.test.tsx` mocks `@/features/skills/queries` instead |
| 5 | Self-certification, forged `reviewed_by`, member editing a returned row, `member_id`/`skill_id` change | Already blocked by the trigger; covered by pgTAP 7–15, 23–32, 54–63 |
| 6 | `?memberId=` access | Member is redirected to `/skills`; members RLS (`read self or managed team`) makes an out-of-scope member `not_found` for managers; `member_skills` RLS limits rows the same way |
| 7 | Certified proof | `v_training_records` filtered `done` + `approved` + `renewed = false` + expiry in Active / Expiring in 60d / Expiring Soon / No Expiry (`N/A` and `Expired` excluded), filters repeated in code |
| 8 | Mock files `seed-data.ts`, `dc34-matrix.ts` (+ `seed-data.test.ts`) only fed tests | **Deleted**; tests use `__fixtures__/skills.ts` (owner request) |

Open, for the owner (not changed):

- **Admin approves own Level 5.** The trigger treats an admin's own row as a reviewer row (same rule as certificates, decision #66), so `canReview` is true on the admin's own page; the queue hides it. Keep, or require another admin?
- **Managers can edit a managed member's ratings (levels 0–4, notes, years)** through the API: the base `update own or managed` policy allows it and the UI never offers it. Keep (manager corrections) or narrow the policy to review-only?
- **`Skill.recommendedCourses`** is never filled from the DB, so the "Recommended courses" block in `SkillDetailDialog` never shows in the app. Drop it, or link courses later (catalogue follow-up).
- **Realtime on `/skills`** (`SkillsRealtime`) goes against `.claude/rules/frontend.md` ("realtime only on the record list and Dashboard"). Keep and update the rule, or drop it (the page already refreshes after each Server Action)?
- Migrations `20261126000001`–`3` are applied locally only, **not `db push`**.
