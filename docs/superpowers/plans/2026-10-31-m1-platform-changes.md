# M1 Platform Changes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give managers team and program scopes, give members a career role and years of experience, store course cost with its currency, switch the interface to English and make every page give loading feedback (WBS 10.1, 10.2, 10.3, 8.2, 8.1).

**Architecture:** Access stays in Postgres RLS: a new `manager_scopes` table feeds the two existing helpers `managed_team_ids()` / `managed_member_ids()`, so existing policies are untouched. Computed values (YoE) live in a `security_invoker` view. UI changes follow `src/features/<feature>/{actions,queries,schema,components}`; strings are rewritten in place (no i18n library).

**Tech Stack:** Next.js (read `node_modules/next/dist/docs/` before touching routing, proxy or loading files), Supabase (Postgres, RLS, pgTAP), Zod, Vitest, Playwright, pnpm.

**Spec:** `docs/superpowers/specs/2026-10-31-m1-platform-changes-design.md` (decisions #51, #53–#55 in `docs/decisions.md`).

**Branch:** `feat/m1-platform`, from `dev` once `main` has been merged into `dev` and the docs PR (`docs/process-pack`) is merged; until then from `docs/process-pack`, which already contains week 6.

## Global Constraints

- RLS is the security layer; user queries go through `src/lib/supabase/server.ts`. Never filter permissions in TypeScript instead of RLS.
- Service role only in `src/lib/supabase/admin.ts`, only for cron.
- Every view: `with (security_invoker = true)`.
- Computed fields (YoE) live in a view, never in a table column.
- Dates use `Asia/Ho_Chi_Minh` (`src/lib/dates.ts`: `VN_TIME_ZONE`, `todayVn()`); never bare `current_date`.
- No `any`; every server action validates input with Zod and returns `Result<T>` (never throws to the UI).
- Schema change = new file in `supabase/migrations/` + pgTAP test + `pnpm db:types`.
- UI text in plain English; buttons say what they do (BRD Appendix B.1). Dates stay `dd/mm/yyyy`; numbers use English format.
- Currencies: exactly `VND` and `USD`. Format: `$150`, `3,500,000 ₫`. Mixed currencies are never summed.
- Career roles seeded in order: Engineer, Senior Engineer, Team Lead, Project Manager.
- YoE = whole months from `career_start` to today (Vietnam time) ÷ 12, rounded **down** to 0.5; `null` without a career start.
- Conventional Commits; one commit per task step marked "Commit".

## Review Focus

1. **A team moved to another program** — the old program's manager loses access to its members and records at once, the new one gains it (test in Task 1).
2. **A manager demoted to member or admin** — their scope rows grant nothing, and they stop receiving manager e-mails (tests in Task 1).
3. **Career start near midnight at a month boundary** — 2026-10-31 17:30 UTC is already 1 November in Vietnam; YoE must use the Vietnam date (test in Task 3).
4. **An exported file re-imported after the English rewrite** — the import accepts the new English headers and still accepts the old Vietnamese ones (decision #26) (test in Task 5 and Task 7).
5. **Cost without currency, or currency without cost** — rejected by Zod with a field message and by the database constraint; existing rows with `cost is null` stay valid (tests in Task 5).

---

### Task 1: `manager_scopes` and scope-aware RLS helpers

**Files:**
- Create: `supabase/migrations/20261031000001_manager_scopes.sql`
- Create: `supabase/tests/database/11_manager_scopes.test.sql`
- Modify: `supabase/seed.sql:57` (insert into `manager_scopes` instead of `team_managers`)
- Modify: every pgTAP test that inserts `team_managers` (`04`, `05`, `06`, `08`, `09`, `10`, `01`): same rows into `manager_scopes (user_id, team_id)`
- Modify: `src/types/database.ts` (regenerate)

**Interfaces:**
- Produces table `public.manager_scopes(id uuid pk, user_id uuid → auth.users on delete cascade, team_id uuid null → teams on delete cascade, program_id uuid null → programs on delete cascade, created_at timestamptz)`; check `num_nonnulls(team_id, program_id) = 1`; unique `(user_id, team_id)` and `(user_id, program_id)`; index on `user_id`.
- Produces `public.managed_team_ids() returns setof uuid` and `public.managed_member_ids() returns setof uuid` (same names, signatures, `security definer`, `search_path = ''`): resolved team scopes ∪ teams of program scopes, empty unless `app_role() = 'manager'`.
- Produces `public.notification_staff()` with the same columns; its team-id array holds the resolved team ids and is empty for non-managers.
- RLS on `manager_scopes`: a user reads their own rows; admin all.
- Trigger `manager_scopes_require_manager` (before insert or update): raises `'scope requires the manager role'` unless the user's profile role is `manager`.
- Migration copies `team_managers` → `manager_scopes(user_id, team_id)`, then drops `team_managers` and its policies.

- [ ] **Step 1: Write the failing pgTAP test `11_manager_scopes.test.sql`**

Fixtures as in `04_rls.test.sql` (`pg_temp.login_as`), with Program 1 {Team A, Team B}, Program 2 {Team C}, one member and one record per team, and users: admin, manager M1 (team scope Team A), manager M2 (program scope Program 1), manager M3 (team A + program 2), member U. Assertions:
- `manager_scopes` rejects a row with both or neither of `team_id`/`program_id` (`throws_ok`, check violation).
- inserting a scope for U raises `scope requires the manager role`.
- as M1: `managed_team_ids()` = {A}; as M2: {A, B}; as M3: {A, C}.
- as M2: a team D inserted into Program 1 after the scope was created appears in `managed_team_ids()`.
- as M2: after `update teams set program_id = Program 2 where id = Team B`, Team B is no longer in M2's set and its member and record are invisible (`is(count(*), 0)` on `members` and `training_records` for Team B).
- as M2: `managed_member_ids()` contains the members of A and B; M2 can select their `training_records`.
- after `update profiles set role = 'member'` for M2: `managed_team_ids()` is empty and `notification_staff()` no longer lists M2's teams.
- as admin: insert/delete on `manager_scopes` works; as M1: insert is denied by RLS.

- [ ] **Step 2: Run it and see it fail**

Run: `supabase db reset && pnpm test:db`
Expected: `11_manager_scopes.test.sql` fails (relation `manager_scopes` does not exist).

- [ ] **Step 3: Write migration `20261031000001_manager_scopes.sql`** with the table, constraints, trigger, RLS, data copy, `create or replace` of the three functions, and `drop table public.team_managers`. Update `seed.sql` and the older pgTAP files to use `manager_scopes`.

- [ ] **Step 4: Run the database tests**

Run: `supabase db reset && pnpm test:db`
Expected: all files pass, including `04_rls` and `10_notifications` unchanged in meaning.

- [ ] **Step 5: Regenerate types and commit**

Run: `pnpm db:types && pnpm typecheck` (typecheck fails only in the files Task 2 changes; note them).
```bash
git add supabase/ src/types/database.ts
git commit -m "feat(db): replace team_managers with team and program manager scopes"
```

### Task 2: Scope management in the app

**Files:**
- Modify: `src/features/organizations/actions.ts:143` (`setTeamManagers` → `setScopeManagers`), `queries.ts:36-55`, `schema.ts`, `components/` (team and program sheets)
- Modify: `src/features/members/queries.ts:23-40` (`listTeamOptionsForCurrentUser` uses `managed_team_ids` via RPC or a query on `teams` filtered by RLS)
- Modify: `src/features/members/components/` (members table: "Manages" column, inactive warning)
- Test: `src/features/organizations/schema.test.ts`, `e2e/org.spec.ts`, `e2e/members.spec.ts`

**Interfaces:**
- Consumes: `manager_scopes`, `managed_team_ids()` (Task 1).
- Produces: `setScopeManagers(input: { scope: { kind: "team" | "program"; id: string }; userIds: string[] }): Promise<Result<null>>` — replaces the manager set of one team or program (diff add/remove, like today); `scopeManagersSchema` in `organizations/schema.ts`; `listScopeManagerIds(scope: { kind: "team" | "program"; id: string }): Promise<string[]>`; `listManagerCandidates()` returns only users with role `manager`; `listMemberScopes(): Promise<Map<string /* user_id */, { label: string; active: boolean }[]>>` for `/members`.

- [ ] **Step 1: Write failing tests**
  - `schema.test.ts`: `scopeManagersSchema` accepts `{ scope: { kind: "program", id: <guid> }, userIds: [] }`; rejects `kind: "dc"` and a non-guid id.
  - `e2e/org.spec.ts`: admin opens Program 1 on `/org`, chooses "Set managers", picks the seeded manager, saves; signs in as that manager; `/members` lists the members of every team in Program 1.
  - `e2e/members.spec.ts`: admin sees "Manages: Program 1" on the manager's row; after changing that user's role to member, the row shows "Scopes inactive: not a manager".
- [ ] **Step 2: Run them and see them fail** — `pnpm test src/features/organizations` and `pnpm test:e2e e2e/org.spec.ts e2e/members.spec.ts`; expected FAIL (missing export / missing button).
- [ ] **Step 3: Implement** the schema, `setScopeManagers`, the queries, the "Set managers" control on program rows (same picker component as teams), and the members-table column. Write all new strings in English.
- [ ] **Step 4: Run** `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e e2e/org.spec.ts e2e/members.spec.ts`; expected PASS.
- [ ] **Step 5: Commit** — `feat(org): let the admin assign managers to programs`.

### Task 3: Career roles, career start and YoE (database)

**Files:**
- Create: `supabase/migrations/20261031000002_career_roles_and_yoe.sql`
- Create: `supabase/tests/database/12_career_roles_yoe.test.sql`
- Modify: `src/types/database.ts`

**Interfaces:**
- Produces table `public.career_roles(id uuid pk, name text unique not empty, sort_order int unique, created_at, updated_at)` seeded with the four roles (sort 1–4); RLS: authenticated read, admin write.
- Produces `members.career_role_id uuid null → career_roles on delete restrict`, `members.career_start date null` with checks `extract(day from career_start) = 1`.
- Produces view `public.v_member_profiles with (security_invoker = true)`: `member_id, career_role_id, career_role_name, career_start, yoe_years numeric` where `yoe_years = floor(months_between / 6) / 2` using the Vietnam date `(now() at time zone 'Asia/Ho_Chi_Minh')::date`.
- Produces `public.set_my_career_start(p_start date) returns void` (`security definer`, `search_path = ''`): normalises to the first of the month, rejects a month after the current Vietnam month with `'career start is in the future'`, updates only `members.id = my_member_id()`.
- Produces trigger `members_guard_career_fields` (before update): if `career_role_id` or `career_start` changes and the caller is not admin, raise `'only the admin can change this field'` — except when called from `set_my_career_start` (use a transaction-local setting, e.g. `set_config('app.career_start_self', 'on', true)`, set inside the function and checked by the trigger).

- [ ] **Step 1: Write the failing pgTAP test** asserting: the four seeded roles in order; a manager in scope updating `career_role_id` raises `only the admin can change this field`; the same for `career_start`; the manager can still update `full_name` of that member; a member calling `set_my_career_start('2020-03-17')` stores `2020-03-01` on their own row and no other row changes; `set_my_career_start` with next month raises `career start is in the future`; `v_member_profiles.yoe_years` = 3.5 for a start 42 months before the current Vietnam month and 3.5 for 47 months (rounded down), null without a start; deleting a role in use fails (restrict).
- [ ] **Step 2: Run** `supabase db reset && pnpm test:db`; expected FAIL on the new file.
- [ ] **Step 3: Write the migration.**
- [ ] **Step 4: Run** `supabase db reset && pnpm test:db`; expected PASS.
- [ ] **Step 5:** `pnpm db:types`; commit `feat(db): add career roles, career start and the YoE view`.

### Task 4: Career role and YoE in the app

**Files:**
- Create: `src/features/career/{schema.ts, schema.test.ts, actions.ts, queries.ts, format.ts, format.test.ts, components/}`
- Modify: `src/app/(app)/me/page.tsx` (career section), `src/features/members/{schema.ts, actions.ts, components/}` (Role column and admin field, YoE column), `src/app/(app)/settings/page.tsx` (admin: career roles list)
- Modify: `src/features/export/records-export.ts` (columns "Career role", "YoE" after "Team"; not import fields)
- Test: `e2e/members.spec.ts`, new `e2e/career.spec.ts`

**Interfaces:**
- Consumes: `career_roles`, `v_member_profiles`, `set_my_career_start` (Task 3).
- Produces: `makeCareerStartSchema(now: Date)` returning `z.object({ year: z.coerce.number().int().min(1970), month: z.coerce.number().int().min(1).max(12).nullable() })` refined against `todayVn(now)` (not in the future); `setMyCareerStart(input): Promise<Result<null>>`; `careerRoleSchema`, `createCareerRole`, `updateCareerRole`, `moveCareerRole(input: { id: string; direction: "up" | "down" })`, `deleteCareerRole`; `formatYoe(years: number | null): string` → `"3.5 years"`, `"1 year"`, `"0 years"`, `"Not set"`.

- [ ] **Step 1: Write failing tests**
  - `format.test.ts`: `formatYoe(3.5)` = `"3.5 years"`, `formatYoe(1)` = `"1 year"`, `formatYoe(0)` = `"0 years"`, `formatYoe(null)` = `"Not set"`.
  - `schema.test.ts`: `{ year: 2020, month: null }` passes; a month after the current Vietnam month fails with `"Career start can't be in the future"`; `year: 1969` fails. Build the schema with `makeCareerStartSchema(now: Date)` (exported; `careerStartSchema = makeCareerStartSchema(new Date())` is a per-request call in the action) so the boundary is testable: with `now = 2026-10-31T17:30:00Z` (already 1 November in Vietnam), `{ year: 2026, month: 11 }` passes and `{ year: 2026, month: 12 }` fails.
  - `e2e/career.spec.ts`: a member opens `/me`, sets "Started working" to March 2020, saves, sees the YoE beside it; the role shows "Not set" and is not editable. The admin sets the member's role to "Senior Engineer" in `/members` and sees Role and YoE columns. A manager opening the same member sees role and career start read-only.
- [ ] **Step 2: Run** `pnpm test src/features/career` and `pnpm test:e2e e2e/career.spec.ts`; expected FAIL.
- [ ] **Step 3: Implement** the feature folder, the `/me` card (month + year inputs, month optional), the members column and admin form field, the admin role list on `/settings` (add, rename, move up/down, delete with the restrict error shown as "This role is in use"), and the two export columns.
- [ ] **Step 4: Run** `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e e2e/career.spec.ts e2e/members.spec.ts e2e/export.spec.ts`; expected PASS.
- [ ] **Step 5: Commit** — `feat(career): career roles, career start and YoE for members`.

### Task 5: Course cost currency and study hours

**Files:**
- Create: `supabase/migrations/20261031000003_course_cost_currency.sql`, `supabase/tests/database/13_course_cost.test.sql`
- Create: `src/lib/money.ts`, `src/lib/money.test.ts`
- Modify: `src/features/courses/{schema.ts:25-37, schema.test.ts, actions.ts:90-100, queries.ts, components/course-sheet.tsx:150, components/courses-table.tsx:83}`
- Modify: import: `src/features/import/{clean.ts (HEADER_ALIASES, fields), plan.ts (CourseRef, defineNewCourse, warnAboutCatalogDifferences), clean.test.ts, plan.test.ts}` and `commit_import` (replaced in the migration to insert `cost`, `cost_currency`, `est_hours` for new courses)
- Modify: `src/features/export/records-export.ts` (columns "Cost", "Currency", "Study hours" after "Validity (months)")

**Interfaces:**
- Produces: `courses.cost_currency text null check (cost_currency in ('VND','USD'))`, check `(cost is null) = (cost_currency is null)`; existing rows with a cost get `'VND'`.
- Produces: `type Currency = "VND" | "USD"`; `formatMoney(amount: number, currency: Currency): string` (`"$150"`, `"$1,234.50"`, `"3,500,000 ₫"`); `formatMoneyTotals(items: { amount: number; currency: Currency }[]): string` (`"$1,200 + 15,000,000 ₫"`, one currency → that amount only, empty → `"—"`).
- Produces: `courseSchema` gains `costCurrency: z.enum(["VND","USD"]).nullable()` with a refine: cost and currency both set or both empty (message `"Choose a currency for the cost"` / `"Enter a cost or clear the currency"`); `estHours` is already there.
- Import fields: `cost`, `costCurrency`, `estHours` with aliases `["cost", "chi phi"]`, `["currency", "loai tien", "tien te"]`, `["study hours", "so gio", "gio hoc"]`. An unknown currency is a row error `Unknown currency "<value>". Use VND or USD.` Values apply only when the row creates a new course, exactly as `validityMonths` does; a difference with an existing course is a warning, like validity.

- [ ] **Step 1: Write failing tests**
  - pgTAP `13_course_cost.test.sql`: cost without currency fails the check; currency without cost fails; `'EUR'` fails; a pre-existing row with cost now has `'VND'` (insert before the migration is not possible, so assert `count(*) where cost is not null and cost_currency is null` = 0 after seed); `commit_import` creates a new course with cost 150, `'USD'`, 40 hours from a staged row.
  - `money.test.ts`: the formats above.
  - `courses/schema.test.ts`: the two refine messages; `{ cost: "", costCurrency: null }` passes.
  - `clean.test.ts` / `plan.test.ts`: header "Currency" maps to `costCurrency`; "EUR" gives the row error text above; a new course row carries cost/currency/hours.
  - `e2e/courses.spec.ts`: save a course with cost 150 USD and 40 study hours; the list shows `$150` and `40`.
- [ ] **Step 2: Run** `pnpm test:db`, `pnpm test src/lib/money.test.ts src/features/courses src/features/import`, `pnpm test:e2e e2e/courses.spec.ts`; expected FAIL.
- [ ] **Step 3: Implement** migration (column, checks, backfill, `create or replace function public.commit_import`), `money.ts`, schema, sheet (amount + currency select + study hours), table, import and export.
- [ ] **Step 4: Run** `supabase db reset && pnpm test:db && pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e e2e/courses.spec.ts e2e/import.spec.ts e2e/export.spec.ts`; expected PASS.
- [ ] **Step 5:** `pnpm db:types`; commit `feat(courses): cost with currency and study hours in forms, import and export`.

### Task 6: English labels from the database

**Files:**
- Create: `supabase/migrations/20261031000004_english_db_labels.sql`
- Modify: `supabase/tests/database/08_dashboard.test.sql` (and `09` if it matches text), dashboard unit/e2e tests that expect the Vietnamese labels

**Interfaces:**
- Produces: `dashboard_breakdown` (and any other function or view found by the scan in Step 1) returning `'No team'`, `'Uncategorised'`, `'Unknown provider'` instead of `'Chưa có team'`, `'Chưa phân loại'`, `'Chưa rõ nhà cung cấp'`; signatures unchanged.

- [ ] **Step 1:** List every user-facing Vietnamese literal still returned by a function or view: `grep -nP "'[^']*[à-ỹđĐ][^']*'" supabase/migrations/*.sql`. Change the expectations in `08_dashboard.test.sql` to the English labels.
- [ ] **Step 2: Run** `pnpm test:db`; expected FAIL on the changed expectations.
- [ ] **Step 3:** Write the migration with `create or replace function` for each function found (copy the latest definition, change only the literals).
- [ ] **Step 4: Run** `supabase db reset && pnpm test:db`; expected PASS.
- [ ] **Step 5: Commit** — `feat(db): return English labels from dashboard functions`.

### Task 7: English interface

**Files:**
- Create: `src/lib/english-ui.test.ts`
- Modify: every non-test `.ts`/`.tsx` under `src/` with Vietnamese UI text (about 155 files with `e2e/`), the e-mail templates in `src/lib/email/templates`, `src/components/status/labels.ts`, Zod messages in every `schema.ts`, export headers in `src/features/export/records-export.ts`, `docs/design-system.md`, the `/design` page, and `e2e/*.spec.ts`

**Interfaces:**
- Consumes: the English strings already written in Tasks 2, 4 and 5.
- Produces: no Vietnamese characters in non-test source; import `HEADER_ALIASES` and `STATUS_ALIASES` gain the English export headers and status labels **and keep** every existing Vietnamese (folded) alias.

- [ ] **Step 1: Write the failing guard test `src/lib/english-ui.test.ts`**: walks `src/**/*.{ts,tsx}`, skips `*.test.ts(x)`, `src/types/database.ts` and `src/features/import/__fixtures__/`, and expects no match for `/[À-ỹĐđ]/u` in any file, reporting the offending file and line. Add a second test in `src/features/import/clean.test.ts`: every header of `RECORD_EXPORT_COLUMNS` that is an import field resolves through `HEADER_ALIASES`, and the old headers `"Khóa học"`, `"Trạng thái"`, `"Tiến độ (%)"` still resolve.
- [ ] **Step 2: Run** `pnpm test src/lib/english-ui.test.ts`; expected FAIL listing the files.
- [ ] **Step 3: Rewrite strings area by area**, running the guard after each and committing per area: (a) app shell, shared components, status labels, auth, `/me`; (b) organisations, members, courses, records; (c) import, export, dashboard, data quality; (d) notifications and e-mail templates (subjects included); (e) `/design` page and `docs/design-system.md`. Use the BRD Appendix B.1 wording where a string exists there. Update the e2e specs of each area in the same commit.
- [ ] **Step 4: Run** `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e`; expected PASS, guard green.
- [ ] **Step 5: Commit** each area — `feat(i18n): English interface for <area>`.

### Task 8: Page speed

**Files:**
- Create: `loading.tsx` for every route in `src/app/(app)/` that lacks one (`courses`, `import`, `import/[batchId]`, `me`, `members`, `org`, `records`, `settings`)
- Create: `src/components/app-shell/navigation-progress.tsx` (top bar, provider, link reporter)
- Modify: `src/components/app-shell/app-sidebar.tsx:55` (sidebar links report pending), `src/app/(app)/layout.tsx` (mount provider and bar)
- Modify: `src/lib/supabase/proxy.ts:33` and/or `src/features/auth/queries.ts:26`
- Modify: `docs/process/04-wbs.md` §4 ("After" column), `e2e/navigation.spec.ts`

**Loading pattern (owner's choice, option C, 2026-10-31):** a thin teal top bar while the link is pending, then the route's `loading.tsx` skeleton (pulse) until the content arrives.
- Bar: fixed to the top of the viewport above the topbar, 3px high, `bg-primary` (`#0E5C58`), `aria-hidden="true"` (the skeleton's `role="status" aria-busy="true"` is what assistive tech hears), `data-testid="nav-progress"`, `data-state="loading" | "idle"`.
- Motion: on start the width eases from 0 to about 80% over about 2 s and holds; on finish it jumps to 100% and fades out in 200 ms. Opacity changes, not mount/unmount, so there is no layout shift.
- `prefers-reduced-motion: reduce`: no width animation; the bar shows at full width while loading and hides when done.
- Skeleton: the existing shadcn `Skeleton` pulse, shaped like each page (header, filter bar, 5 table rows, as in `src/app/(app)/dashboard/loading.tsx`); no full-page spinner.

**Interfaces:**
- Consumes: design-system skeleton components (`docs/design-system.md`); `useLinkStatus` from `next/link` (read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-link-status.md`: it only works inside a `<Link>` and reports `pending` until the history updates).
- Produces: `NavigationProgressProvider({children})`, `NavigationProgressBar()`, `LinkPendingReporter()` (rendered inside a `<Link>`; reports its `pending` to the provider) in `navigation-progress.tsx`. Later tasks that add in-app links put `<LinkPendingReporter />` inside them.
- Produces: `getCurrentUser()` keeps its return type; the request makes at most one call that contacts Supabase Auth per navigation.

- [ ] **Step 1:** Read `node_modules/next/dist/docs/` on `loading.js`, `useLinkStatus`, the proxy and request memoisation. Write failing tests in `e2e/navigation.spec.ts`:
  - for each `(app)` route, clicking its sidebar link shows an element with `aria-busy="true"` or the page heading within 300 ms;
  - with the route response delayed (`page.route` holding the RSC request for 1 s), clicking a sidebar link makes `[data-testid="nav-progress"]` reach `data-state="loading"` within 100 ms, and it returns to `idle` once the page heading shows;
  - with `page.emulateMedia({ reducedMotion: "reduce" })`, the bar's computed `transition-property` / `animation-name` is `none` while loading.

  Add a Vitest for the auth path: with the Supabase client mocked, rendering the layout and a page in one request calls `auth.getUser` (or the verifying call chosen) once.
- [ ] **Step 2: Run** the tests; expected FAIL.
- [ ] **Step 3: Implement** the bar and reporter (pending from any reporting link sets the bar to loading; the last link clicked wins), the skeletons, and remove the duplicate auth round trip without dropping server-side session verification.
- [ ] **Step 4: Run** `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e`; expected PASS. Measure with the spec §6.5 method (production, signed in as a manager, 10 client navigations per page, p75) and fill the "After" column in `04-wbs.md` §4; a page above 1 s is recorded with its cause, not fixed in this task.
- [ ] **Step 5: Commit** — `perf: loading states on every page and one auth call per navigation`.

### Task 9: Close the milestone

**Files:**
- Modify: `docs/process/04-wbs.md` (10.1, 10.2, 10.3, 8.1, 8.2 → `Done` with dates), `CLAUDE.md` (status line: M1 done, next M2), `docs/decisions.md` only if a ruling during the work changed a decision

- [ ] **Step 1: Run the full suite** — `pnpm lint && pnpm typecheck && pnpm test && supabase db reset && pnpm test:db && pnpm test:e2e`; expected all green. Record the counts.
- [ ] **Step 2: Update the docs** listed above; `pnpm test src/lib/process-docs.test.ts` green.
- [ ] **Step 3: Commit** — `docs: close M1 in the WBS and status`.
- [ ] **Step 4:** Remind the owner that the four new migrations must be pushed to the cloud database (`supabase db push`) **before** the release reaches production (PRD-26).
