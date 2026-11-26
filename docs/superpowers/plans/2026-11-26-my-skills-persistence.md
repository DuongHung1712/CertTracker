# My Skills Database Persistence & Review Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist `/skills` ratings, experience, notes, and Level 5 manager reviews in Supabase Postgres (`skill_domains`, `skills`, `member_skills`, `skill_certificate_links`), derive real certificate proof from approved valid `training_records`, wire `/members` and the Member Dashboard `SkillsMatrixCard`, and remove all mock/preview fallbacks.

**Architecture:** One additive SQL migration extends `skill_domains` (9 domains), widens `skills.code` for `DC34-*`, seeds all 182 skills idempotently preserving `a201..a216`, changes `member_skills.years_of_experience` to `numeric(4,1)`, adds `review_note` + `'returned'` state + `DELETE` RLS + `BEFORE UPDATE` immutability/review guards, and joins `supabase_realtime`. A new server-only `src/features/skills/queries.ts` and `"use server"` `src/features/skills/actions.ts` enforce caller JWT RLS and Zod validation (`z.guid()`). `SkillsView`, `SkillsMatrixCard`, and `MembersTable` consume real DB state with optimistic quick-rate rollback and `duration: Infinity` error toasts.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Supabase Postgres + RLS + Realtime, pgTAP, Zod, TanStack Table v8, shadcn `base-nova` (`render` prop), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-26-my-skills-persistence-design.md`

---

## Global Constraints

- **Workspace rule:** Operate STRICTLY inside `D:/Fullstack/CertTracker/.worktrees/feat-my-skills` (branch `feat/my-skills`). Never touch `D:/Fullstack/CertTracker` root. Do NOT run `git commit` unless explicitly instructed by the coordinator, and **NEVER run `supabase db reset`**.
- **Migrations:** Apply locally with `supabase migration up`; regenerate types with `pnpm db:types`; run pgTAP with `pnpm test:db`.
- **RLS & Security:** Zero `service_role` in `src/features/skills/` or `src/app/(app)/skills/`. Views/queries run under caller JWT (`createClient()`). All updates/deletes chain `.select("id")` and check `assertAffected()`. All errors use `mapPostgresError()`.
- **Copy & Tokens:** English UI only (`src/lib/english-ui.test.ts`). Never write the word `record`/`records` in any string literal containing whitespace (`src/lib/ui-copy.test.ts`). No contractions (`cannot`, `do not`). No `"credential"`. Use design tokens only (`src/app/tokens.test.ts`), `formatDate` (`dd/MM/yyyy`), `pluralize()`, and Base UI `render` prop.
- **File Ownership:** Each worker edits ONLY its listed files.

---

### Slice 1 (`db-skills`): Database Migration, Seed Parity & pgTAP Tests

**Files (strictly owned by `db-skills`):**
- Create: `supabase/migrations/20261126000001_my_skills_persistence.sql`
- Modify: `supabase/seed.sql`
- Modify: `supabase/tests/database/30_skills_matrix.test.sql`
- Modify: `src/types/database.ts` (regenerated via `pnpm db:types`)

**Interfaces:**
- `public.skill_domains`: 9 rows (`cloud`, `backend`, `frontend`, `devops`, `security`, `data_ai`, `leadership`, `mobile`, `embedded`) with `sort_order` 1..9 and UUIDs `5eed0000-0000-0000-0000-00000000d001`..`d009`.
- `public.skills`: `skills_code_check` accepts `^(SKL-[A-Z]{2,4}-[0-9]{2}|DC34-[0-9]{3})$`; 182 rows (`sort_order` 1..182): 16 `skl-01..16` (`a201..a216`), 49 `skl-17..65` (`a217..a265`), 117 `DC34-*` (`dc340001..dc340209`).
- `public.member_skills`: `years_of_experience numeric(4,1) not null default 0 check (years_of_experience >= 0 and years_of_experience <= 50)`; `verification_status check (verification_status in ('certified', 'self_assessed', 'pending_review', 'returned'))`; `review_note text check (review_note is null or length(review_note) <= 1000)`; constraint `member_skills_review_note_rules`.
- RLS on `member_skills`: `"member_skills: update own or managed"` has explicit `WITH CHECK`; new `"member_skills: delete own or managed"`; explicit `GRANT`s to `authenticated`.
- Trigger `public.member_skills_review_columns()`: immutability of `member_id` and `skill_id` on `UPDATE`, member/own-row self-certify/self-review block (`42501`), automatic clearing of review stamps/notes when member changes `current_level` or resubmits from `'returned'`, reviewer stamping on `'certified'`/`'returned'`, level clamping `<= 4` on `'returned'`.
- `supabase_realtime` publication includes `public.member_skills`.

#### Task 1.1: Expand `30_skills_matrix.test.sql` with failing DB assertions (TDD)

- [ ] **Step 1:** Update `supabase/tests/database/30_skills_matrix.test.sql` (preserving all 15 existing assertions and adding new assertions, updating `select plan(N)`):
  - `skill_domains` contains `'mobile'` and `'embedded'`.
  - `skills` accepts `'DC34-001'` (`lives_ok`) and still rejects `'INVALID_CODE'` (`23514`).
  - `skills` holds at least 182 seeded catalogue skills (`skl-01..65` + `DC34-*`) and preserves `a201..a216`.
  - `member_skills.years_of_experience` accepts `2.5` (`lives_ok`), rejects `-0.5` and `50.5` (`23514`).
  - Member cannot mutate `member_id` or `skill_id` on `UPDATE` (`42501`).
  - Manager on their own `member_skills` row cannot certify themselves or change `member_id` to escape own-row check (`42501`).
  - Member can delete their own `member_skills` row (`lives_ok`); member cannot delete another member's row (0 affected).
  - Manager in scope can return a Level 5 `pending_review` row (`verification_status = 'returned', review_note = 'Add architecture RFC'`) → level clamps to `4`, `reviewed_at` stamped; returning without `review_note` fails (`23514`); member editing returned row back to Level 5 clears `review_note`/`reviewed_at` and sets `pending_review`.
  - `member_skills` is present in `pg_publication_tables` for `supabase_realtime` (guarded if publication exists).
- [ ] **Step 2:** Run `pnpm test:db` inside `D:/Fullstack/CertTracker/.worktrees/feat-my-skills` and verify the new assertions fail as expected.

#### Task 1.2: Author `supabase/migrations/20261126000001_my_skills_persistence.sql` & update `supabase/seed.sql`

- [ ] **Step 1:** Write a temporary Node helper (deleted before finishing, or run inline `node -e` reading `src/features/skills/seed-data.ts` + `src/features/skills/dc34-matrix.ts`) to emit exact, SQL-escaped `VALUES` for all 182 skills (`sort_order` 1..182, deterministic UUIDs `5eed0000-0000-0000-0000-00000000a201`..`a265` and `5eed0000-0000-0000-0000-0000dc340001`..`dc340209`) into `supabase/migrations/20261126000001_my_skills_persistence.sql`.
- [ ] **Step 2:** Complete `supabase/migrations/20261126000001_my_skills_persistence.sql` with:
  1. Upsert 9 `skill_domains` (`ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name`).
  2. Replace `skills_code_check` constraint + idempotent `INSERT INTO public.skills ... ON CONFLICT DO NOTHING`.
  3. Alter `member_skills.years_of_experience` to `numeric(4,1)` with `[0..50]` check; extend `verification_status` check to include `'returned'`; add `review_note` + `member_skills_review_note_rules`.
  4. Recreate `"member_skills: update own or managed"` with explicit `WITH CHECK`, add `"member_skills: delete own or managed"`, and add `GRANT`s for `authenticated`.
  5. `CREATE OR REPLACE FUNCTION public.member_skills_review_columns()` implementing all guards in §3.4 of the spec.
  6. Idempotent `alter publication supabase_realtime add table public.member_skills`.
- [ ] **Step 3:** Update `supabase/seed.sql`:
  - Update `d007` name to `'Leadership & Collaboration'`, add `d008` (`mobile`) and `d009` (`embedded`).
  - Keep `b003` (Lê Minh Châu) with zero `training_records`; set `b003`'s non-Level-5 `member_skills` rows to `'self_assessed'` and `a213` to `current_level = 5, verification_status = 'pending_review', manager_endorsement_requested = true`.
  - Add one `member_skills` row for `b001` (Nguyễn Văn An) on `a201` (`current_level = 4, years_of_experience = 4.0, verification_status = 'self_assessed'`) so An's `e001` AWS certificate automatically backs `a201` as `Certified`.
- [ ] **Step 4:** Apply migration & regenerate types (DO NOT run `supabase db reset`):
  - `supabase migration up`
  - `pnpm db:types`
  - `pnpm test:db`
  Verify 100% of pgTAP tests pass and `src/types/database.ts` reflects `numeric` (`number`), `review_note: string | null`.

---

### Slice 2 (`backend-skills`): Schema, Metrics, Queries, Server Actions & Unit Tests

**Files (strictly owned by `backend-skills`):**
- Modify: `src/features/skills/types.ts`
- Modify: `src/features/skills/schema.ts`
- Modify: `src/features/skills/metrics.ts`
- Modify: `src/features/skills/metrics.test.ts`
- Create: `src/features/skills/queries.ts`
- Create: `src/features/skills/queries.test.ts`
- Create: `src/features/skills/actions.ts`
- Create: `src/features/skills/actions.test.ts`

**Interfaces:**
- `VerificationStatus = "certified" | "self_assessed" | "pending_review" | "returned"`.
- `Skill` adds optional `reviewNote?: string; reviewedByName?: string; reviewedAt?: string; isSaved?: boolean;`.
- `PendingSkillReview = { id: string; memberId: string; memberCode: string; memberName: string; teamName: string | null; skillId: string; skillCode: string; skillName: string; category: SkillCategory; evidenceNote: string | null; yearsOfExperience: number; lastEvaluatedAt: string }`.
- `MemberSkillSummary = { totalSkills: number; certifiedCount: number; pendingReviewCount: number; returnedCount: number; averageLevel: number }`.
- `SkillsWorkspaceData = { status: "ok"; targetMember: { id: string; code: string; fullName: string; teamName: string | null }; benchmark: RoleBenchmark; profileSkills: Skill[]; catalogSkills: Skill[]; canEdit: boolean; canReview: boolean; isOwnProfile: boolean; pendingReviews: PendingSkillReview[] } | { status: "not_found" }`.
- Schemas (all UUIDs validated with `z.guid()`): `quickRateSkillSchema`, `updateSkillAssessmentSchema`, `batchSaveSkillAssessmentsSchema`, `removeMemberSkillSchema`, `reviewMemberSkillSchema`.
- Queries (`import "server-only"`): `loadSkillsWorkspace`, `listPendingSkillReviews`, `listPendingSkillReviewCounts`, `loadMemberSkillSummary`.
- Actions (`"use server"`): `quickRateSkill`, `saveSkillAssessment`, `batchSaveSkillAssessments`, `removeMemberSkill`, `reviewMemberSkill` — all returning `Promise<Result<...>>`.

#### Task 2.1: Update `types.ts`, `schema.ts`, and `metrics.ts` + tests

- [ ] **Step 1:** Update `src/features/skills/types.ts` with `"returned"`, review metadata (`reviewNote`, `reviewedByName`, `reviewedAt`, `isSaved`), `PendingSkillReview`, `MemberSkillSummary`, and `SkillsWorkspaceData`. Keep `SkillVerificationFilter` supporting `"all" | VerificationStatus`.
- [ ] **Step 2:** Update `src/features/skills/schema.ts`:
  - Change `updateSkillAssessmentSchema.skillId` to `z.guid("Skill ID is required")`, trim `evidenceNote` (max 1000), validate `yearsOfExperience` in `[0..50]`.
  - Add `quickRateSkillSchema`, `batchSaveSkillAssessmentsSchema` (dedupes or checks unique `skillId`s, 1..300 items), `removeMemberSkillSchema`, `reviewMemberSkillSchema` (requires non-empty `note` when `decision === "return"`).
- [ ] **Step 3:** Update `src/features/skills/metrics.ts`:
  - `rateSkill(skill, level, today)`: clears `reviewNote` when re-rating (`level === 5 ? "pending_review" : skill.certifiedProof ? "certified" : "self_assessed"`).
  - `filterSkills`: handle `"returned"` in `verification` filter.
  - `calculateSkillStats`: keep existing fields exact (`totalSkills`, `certifiedCount`, `selfAssessedCount`, `pendingReviewCount`, `averageLevel`, `strongCount`, `certifiedPercentage`; optionally add `returnedCount` if helpful).
- [ ] **Step 4:** Update `src/features/skills/metrics.test.ts` to use valid GUIDs (`5eed0000-0000-0000-0000-00000000a201`), test invalid non-GUID rejection, test `"returned"` filtering, and test `reviewMemberSkillSchema` / `batchSaveSkillAssessmentsSchema`.
- [ ] **Step 5:** Run `pnpm vitest run src/features/skills/metrics.test.ts` → pass.

#### Task 2.2: Implement `queries.ts` & `queries.test.ts` (TDD)

- [ ] **Step 1:** Write `src/features/skills/queries.test.ts` mocking `@/lib/supabase/server`:
  - Returns `{ status: "not_found" }` when `members` returns `null` (out-of-scope or unknown `memberId`).
  - Returns empty `profileSkills` (`[]`) and full `catalogSkills` for a freshly created member with 0 `member_skills` rows (zero fake Chauhan/Chau data).
  - Derives `certifiedProof` ONLY from `status = 'done'`, `approval = 'approved'`, `renewed = false`, non-expired `v_training_records` joined with `skill_certificate_links`; excludes expired exams, `waiting`/`returned` records, and `renewed = true` rows.
  - Keeps Level 5 as `"pending_review"` even when a linked certificate exists (`proves_level = 3`), and marks Level 5 as `"certified"` when DB `verification_status === "certified"` (manager endorsed).
  - Marks levels 1–4 as `"self_assessed"` if DB says `"certified"` without any valid linked certificate.
  - `listPendingSkillReviews` excludes `viewerMemberId` when caller is a Manager (`role === 'manager'`).
- [ ] **Step 2:** Run `pnpm vitest run src/features/skills/queries.test.ts` → FAIL.
- [ ] **Step 3:** Implement `src/features/skills/queries.ts` using `createClient()`, `fetchAllRows()`, `formatYoe()`, and real DB joins (`skill_domains`, `skills`, `member_skills`, `v_training_records`, `skill_certificate_links`, `certificates`).
- [ ] **Step 4:** Run `pnpm vitest run src/features/skills/queries.test.ts` → PASS.

#### Task 2.3: Implement `actions.ts` & `actions.test.ts` (TDD)

- [ ] **Step 1:** Write `src/features/skills/actions.test.ts` mocking `next/cache`, `@/features/auth/queries`, `@/lib/supabase/server`:
  - Rejects unlinked user (`memberId: null`) without calling Supabase writes.
  - Rejects invalid GUID / level `< 0` or `> 5` / `yearsOfExperience > 50` / return without `note`.
  - `quickRateSkill` sends `"self_assessed"` for levels 0–4 (never `"certified"`), `"pending_review"` for level 5, preserves `"certified"` when clicking `5` on an already-endorsed Level 5, maps `42501` and `23514` via `mapPostgresError`, and revalidates `/skills`, `/dashboard`, `/members`.
  - `saveSkillAssessment` passes `null` when `evidenceNote` is cleared, supports `0.5` years.
  - `batchSaveSkillAssessments` upserts all changed items in one query preserving existing `years_of_experience` / `evidence_note`.
  - `removeMemberSkill` calls `assertAffected` and returns error when 0 rows deleted.
  - `reviewMemberSkill` approves (`verification_status: "certified"`) or returns (`current_level: 4, verification_status: "returned", review_note`), maps `42501`, and returns clean error when 0 rows updated (no longer `pending_review`).
- [ ] **Step 2:** Run `pnpm vitest run src/features/skills/actions.test.ts` → FAIL.
- [ ] **Step 3:** Implement `src/features/skills/actions.ts`.
- [ ] **Step 4:** Run `pnpm vitest run src/features/skills/ && pnpm typecheck` → PASS.

---

### Slice 3 (`ui-skills`): Skills UI, Dashboard Card, Members Integration, E2E & Docs

**Files (strictly owned by `ui-skills`):**
- Modify: `src/app/(app)/skills/page.tsx` & `src/app/(app)/skills/page.test.tsx`
- Create: `src/features/skills/components/skills-realtime.tsx`
- Create: `src/features/skills/components/skill-review-dialog.tsx`
- Modify: `src/features/skills/components/skills-view.tsx` & `skills-view.test.tsx`
- Modify: `src/features/skills/components/skills-header.tsx`
- Modify: `src/features/skills/components/skill-status.tsx`
- Modify: `src/features/skills/components/skill-card.tsx`
- Modify: `src/features/skills/components/skill-table.tsx`
- Modify: `src/features/skills/components/skill-detail-dialog.tsx`
- Modify: `src/features/skills/components/skill-assessment-dialog.tsx`
- Modify: `src/features/skills/components/skill-batch-assess-dialog.tsx` & `skill-batch-assess-dialog.test.tsx`
- Modify: `src/features/dashboard/load.ts`
- Modify: `src/features/dashboard/components/member/skills-matrix-card.tsx`
- Modify: `src/features/dashboard/components/member/member-dashboard-view.tsx`
- Modify: `src/features/dashboard/components/member/member-cards.test.tsx`
- Modify: `src/app/(app)/members/page.tsx`
- Modify: `src/features/members/components/members-table.tsx`
- Create: `e2e/skills.spec.ts`
- Modify: `docs/decisions.md` (append Decision #76)

#### Task 3.1: Skills UI Components (`skill-status`, `skill-review-dialog`, `skill-card`, `skill-table`, `skill-detail-dialog`, `skill-assessment-dialog`, `skill-batch-assess-dialog`)

- [ ] **Step 1:** Update `skill-status.tsx` to include `returned: { icon: Undo2, tone: "expired", text: "text-destructive" }`, label `"Returned"`, `data-stamp="returned"`.
- [ ] **Step 2:** Create `skill-review-dialog.tsx` (using `ConfirmDialog`, `Field`, `FieldLabel`, `Textarea`, `FieldError`, `reviewMemberSkillSchema`) for returning a Level 5 skill with required note (`"What should the member fix?"`).
- [ ] **Step 3:** Update `skill-card.tsx` & `skill-table.tsx`:
  - Support `canEdit` (when `false`, quick-rate pills are non-interactive/disabled or omitted and `Edit` button is hidden; clicking skill name still opens `SkillDetailDialog`).
  - Support `canReview`: when `skill.verification === "pending_review"` and `canReview`, render `Approve` and `Return` buttons cleanly (`size="sm"`).
  - When `skill.verification === "returned"` and `skill.reviewNote`, show `"Returned: <note>"` cleanly.
- [ ] **Step 4:** Update `skill-detail-dialog.tsx`:
  - Change `"Check credential"` link text to `"View certificate"`.
  - Filter empty `certificateCode` from metadata dot-join.
  - When `skill.verification === "certified"` without `certifiedProof` (manager-endorsed Level 5), display `"Endorsed at Level 5 by <reviewedByName ?? 'your manager'> on <formatDate(...)>"`.
  - When `skill.verification === "returned"` and `skill.reviewNote`, display the returned feedback alert/callout.
  - Show `Edit rating` only when `canEdit`, and `Approve` / `Return` when `canReview && skill.verification === "pending_review"`.
- [ ] **Step 5:** Update `skill-assessment-dialog.tsx`:
  - Show `skill.reviewNote` banner if `skill.verification === "returned"`.
  - Add async `pending` state (`Saving…` disabled buttons) and keep dialog open if `onSave` returns `false`/error.
  - Accept optional `onRemove?: (skillId: string) => Promise<boolean>` for already-saved skills (`isSaved`), confirmed via `ConfirmDialog` (`"Remove <skill> from your skills?"`).
- [ ] **Step 6:** Update `skill-batch-assess-dialog.tsx` & `skill-batch-assess-dialog.test.tsx`:
  - Track `changedIds` (`Set<string>`) whenever a skill's level differs from its initial `skills` prop.
  - Remove the all-182-skills `currentLevel === 0` block; disable `"Save ratings"` while `!dirty || pending`, show `"Saving…"`, and pass only changed skills (`draft.filter(s => changedIds.has(s.id))`) to `onSave` (async `Promise<boolean>`).
  - Keep `Reset`, `DiscardChangesDialog`, search, category tabs, and Level 5 `Waiting for review` badge working.
  - Update `skill-batch-assess-dialog.test.tsx` to verify partial subset saving, disabled Save when clean, Reset, search, and discard confirmation.

#### Task 3.2: `SkillsHeader`, `SkillsRealtime`, `SkillsView`, and `/skills/page.tsx`

- [ ] **Step 1:** Create `src/features/skills/components/skills-realtime.tsx` subscribing to `member_skills` and `training_records` (debounced `router.refresh()`, `supabase.realtime.setAuth()`, unmount cleanup).
- [ ] **Step 2:** Update `skills-header.tsx`:
  - Render real member name + code (when viewing another member, with `"Back to Members"` / `"View my skills"` link), role + team + experience (`formatYoe`), and clean copy (no mock description).
  - Hide `"Update skill rate"` when `!canEdit`.
  - When `pendingReviews.length > 0`, show a compact `"Waiting for your review (N)"` section with member links (`/skills?memberId=...`) and inline `Approve` / `Return` buttons.
- [ ] **Step 3:** Update `skills-view.tsx` & `skills-view.test.tsx`:
  - Remove all `SEED_SKILLS`, `SEED_ROLE_BENCHMARK`, `ENTERPRISE_SKILL_CATALOG` imports and `"Preview only..."` copy.
  - Wire `quickRateSkill`, `saveSkillAssessment`, `batchSaveSkillAssessments`, `removeMemberSkill`, `reviewMemberSkill`.
  - Implement optimistic quick-rate with rollback + `toast.error(result.error, { duration: Infinity })` on error.
  - Render `"No skills rated yet"` + `"Update skill rate"` CTA when `mySkills.length === 0` (distinct from filtered empty `"No skills match these filters"` + `"Clear all filters"`).
  - Update `skills-view.test.tsx` mocking `@/features/skills/actions` and testing: empty member CTA, quick-rate optimistic + rollback + `duration: Infinity` error toast, Level 5 review request, batch partial save, Manager/Admin approve & return flows, and removal.
- [ ] **Step 4:** Update `src/app/(app)/skills/page.tsx` & `src/app/(app)/skills/page.test.tsx`:
  - Read `searchParams` (`memberId`), enforce member self-only redirect, handle unlinked member vs unlinked admin/manager vs `"not_found"`, render `<SkillsRealtime />` + `<SkillsView />`.
  - Update `page.test.tsx` mocking `loadSkillsWorkspace` and `listPendingSkillReviews` (test unauthenticated redirect, unlinked member empty state, unlinked admin pending queue, member view, manager `?memberId=...`, out-of-scope not_found).

#### Task 3.3: Member Dashboard `SkillsMatrixCard` & `/members` Link

- [ ] **Step 1:** Update `src/features/dashboard/load.ts` (`loadMemberDashboard`) to `settle(loadMemberSkillSummary(memberId))` and pass `skillSummary` + `skillsError` to `MemberDashboardView`.
- [ ] **Step 2:** Replace `src/features/dashboard/components/member/skills-matrix-card.tsx` with a live summary card showing rated count, average level, certified count, pending review count (or `"No skills rated yet"`), and `<Link href="/skills">` labeled **`"View skills"`** / **`"Rate skills"`** (never containing `"My skills"` in link text so `e2e/dashboard.spec.ts:185` remains unambiguous).
- [ ] **Step 3:** Render `<SkillsMatrixCard>` in `MemberDashboardView` under `MemberProfileCard` (guarded by `skillsError ? <SectionError title="My skills" /> : ...`, optional prop so existing unit tests stay compatible).
- [ ] **Step 4:** Update `src/features/dashboard/components/member/member-cards.test.tsx` removing `SkillsMatrixCard` from `CARDS` (`ComingSoonCard` list) and adding unit tests for live `SkillsMatrixCard` empty, populated, and link href states.
- [ ] **Step 5:** Update `src/app/(app)/members/page.tsx` and `src/features/members/components/members-table.tsx`:
  - Fetch `listPendingSkillReviewCounts()` for Admin/Manager and pass `pendingSkillReviews` map to `MembersTable`.
  - Add `<DropdownMenuItem render={<Link href={"/skills?memberId=" + row.original.id} />}>View skills</DropdownMenuItem>` in `MembersTable` row menu, plus subtle indicator if `pendingSkillReviews[row.original.id] > 0`.

#### Task 3.4: E2E Tests (`e2e/skills.spec.ts`) & Decision Log (`docs/decisions.md`)

- [ ] **Step 1:** Write `e2e/skills.spec.ts` using seed accounts (and restoring/cleaning up pilot or test `member_skills` mutations in `try/finally` so `seed.sql` state stays clean for other specs):
  1. Empty/newly linked member visits `/skills` → sees `"No skills rated yet"` + `"Update skill rate"` CTA (no fake Chau data) → opens `"Update skill rate"`, rates 2 skills (e.g., `Python` and `PostgreSQL`), saves → reloads page → ratings persist; quick-rate & edit `0.5` years + note → reloads → persists.
  2. Member holding an approved certificate (`an@certtracker.test` or newly approved cert) sees `Certified` backed by real certificate proof.
  3. Member requests Level 5 on a skill → sees `Waiting for review` → Manager signs in, navigates via `/members` `"View skills"` (or `/skills` pending queue) → clicks `Return` with a note → Member sees `Returned` + note → Member edits to Level 5 again → Manager clicks `Approve` → Level 5 shows `Certified` across reload.
- [ ] **Step 2:** Append Decision #76 in `docs/decisions.md` summarizing My Skills persistence, live certificate proof derivation, `numeric(4,1)` YoE, Level 5 approve/return flow, and `SkillsMatrixCard` graduation from Coming Soon.

---

### Cycle 4 (`reviewer` & `qa-verifier`): Review, Full Verification & Fix Loop

- [ ] **Step 1 (`reviewer`):** Audit all SQL, RLS policies, BEFORE triggers, Server Actions, queries, copy tests, and `base-nova` / design-token rules against `docs/superpowers/specs/2026-11-26-my-skills-persistence-design.md`. Report any P0/P1 findings to the owning slice worker.
- [ ] **Step 2 (`qa-verifier`):** Run full verification inside `D:/Fullstack/CertTracker/.worktrees/feat-my-skills`:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test` (including `src/lib/ui-copy.test.ts`, `src/lib/english-ui.test.ts`, `src/app/tokens.test.ts`, `src/features/dashboard/components/copy.test.tsx`)
  - `pnpm test:db`
  - `pnpm test:e2e e2e/skills.spec.ts e2e/dashboard.spec.ts e2e/approval.spec.ts`
- [ ] **Step 3:** Route any failures back to the owning slice (`db-skills`, `backend-skills`, or `ui-skills`) and re-verify until every check passes with 0 errors.
