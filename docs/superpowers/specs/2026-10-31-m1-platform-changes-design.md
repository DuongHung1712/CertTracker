# M1 — Platform changes (design)

- **Date:** 2026-10-31
- **Milestone:** M1 of Release 1 ([04-wbs.md](../../process/04-wbs.md)): work packages 10.1, 10.2, 10.3, 8.2, 8.1
- **Sources:** BRD v3.0 (`exports/CertTracker-BRD-v3.0-2026-10-31.docx`, not in git: §3, §4.1 "Manager scope", FR-02, FR-03, FR-04, NFR-03, NFR-04), [decisions](../../decisions.md) #51, #53, #54, owner Q&A on 2026-10-31
- **Status:** Draft for the owner's review

## 1. Why

Everything after M1 depends on it. The Skill Matrix (M2), quarterly goals (M3) and AI (M4) all need to know **who a manager is responsible for**, each member's **career role and experience**, and the **cost** of a course. The owner also decided the app speaks **English first** (decision #51), and the pilot depends on pages that feel fast (NFR-03). M1 changes the platform under the existing certificate features. It adds no new business feature.

## 2. Goals

1. A manager can be responsible for one or more **teams** and one or more **programs**. A program covers its teams, including teams added later.
2. Each member has a **career role** (set by the admin) and a **career start** (set by the member), from which the app works out **years of experience (YoE)**.
3. Each course has a **cost with its currency** (VND or USD) and **estimated study hours**, visible in the course form and list, in the import and in the export.
4. Every screen and e-mail is in **English**.
5. Every page gives feedback at once when a link is clicked, and most pages load in under 1 second.

## 3. Non-goals

- A Vietnamese/English language switch: after Release 1 (decision #51).
- Translating data people typed (team names, course names, notes). They stay as entered.
- Currency conversion or exchange rates.
- Role criteria and the "next role" view: M5 (WBS 14.1–14.2). M1 only creates the role list and assigns a role to each member.
- Any change to who can see what for members and admins, other than adding program scope for managers.

## 4. Anti-goals (failure even if it "works")

- A manager sees or edits people **outside** their teams and programs. Scope is enforced by RLS (CLAUDE.md rule 1), never by filtering in code.
- A manager can change a member's **career role**. Only the admin sets roles.
- Existing manager assignments are lost or changed by the migration.
- Mixed currencies are added into one number.
- The English rewrite breaks the tested flows (e2e) or leaves a mix of English and Vietnamese on one screen.

## 5. Decisions taken with the owner (2026-10-31)

| Topic | Decision |
|---|---|
| Scopes | A person can hold several scopes at once (for example team lead of team A **and** program manager of program P). |
| DC scope | There is no "DC manager". The **admin is the DC lead** and covers the whole DC. Wherever BRD v3.0 says "DC manager approves", read **admin (DC lead)**; the BRD wording is fixed at its next revision. |
| Manager role | The Manager role has two kinds of scope only: **team** and **program**. |
| Currency | Cost is stored with its currency, **VND or USD**, depending on the provider. |
| YoE | The member enters the **year (and optionally month) they started working**; the app works out YoE. |

These replace the "DC scope" wording of decisions #53 and #54; recorded as decision #55.

## 6. Design

### 6.1 Manager scope (WBS 10.1)

**Data.** Replace `team_managers` with one table of scopes:

- `manager_scopes(id, user_id → auth.users, team_id → teams null, program_id → programs null, created_at)`
- Exactly one of `team_id` / `program_id` is set (check constraint).
- Unique per (`user_id`, `team_id`) and per (`user_id`, `program_id`); deleting a team or program deletes its scope rows (cascade), as `team_managers` does today.

**Migration.** One new migration copies every `team_managers` row into `manager_scopes` as a team scope, then drops `team_managers`. The pgTAP test checks that the copied rows equal the old ones (seed data) before the drop.

**Access.** Two helpers in `20260928000004_rls.sql` read `team_managers` today: `managed_team_ids()` and `managed_member_ids()` (the second feeds the `training_records` policies and the evidence storage policy). Both keep their names and signatures, so the policies, views and RPCs that call them stay unchanged, and both are rewritten to resolve scopes:

- the teams in the user's team scopes **union** the teams whose `program_id` is in the user's program scopes; members are the members of those teams;
- **only when the user's role is `manager`** (`app_role() = 'manager'`). Scope rows of a user who is not a manager grant nothing (my call: today any `team_managers` row grants access whatever the role; this closes that gap).

Because the helpers read `teams` at query time, a team added to a program is covered at once. A trigger rejects a new scope row for a user whose role is not `manager`. When a manager is changed to member or admin, their scope rows are kept but grant nothing, and `/members` shows "Scopes inactive: not a manager" so the admin can remove them (my call: keeping them makes an accidental demotion easy to undo).

Code that reads `team_managers` directly moves to the new table or to `managed_team_ids()`:

- `src/features/members/queries.ts` (managed teams of the current user)
- `src/features/organizations/actions.ts` and `queries.ts` (admin sets a team's managers)
- the notification recipients function in `20261004000002_notifications.sql`, which lists each manager's team ids. A program manager must get the expiry and monthly e-mails for all teams in the program, so it returns the resolved team ids, not only the team scopes, and only for users whose role is `manager`.
- `supabase/seed.sql` and the pgTAP tests that insert `team_managers` rows.

**Admin screen.** On `/org`, the admin sets managers on a **team** (as today) and also on a **program**, with the same picker, which lists only users with the Manager role. A person's scopes are listed on their row in `/members` ("Manages: Team A, Program P").

**Admin and DC.** The admin already sees and edits everything (`app_role() = 'admin'`). No change.

### 6.2 Career role and YoE (WBS 10.2)

**Data.**

- `career_roles(id, name unique, sort_order unique, created_at, updated_at)`, seeded in order: Engineer, Senior Engineer, Team Lead, Project Manager (the career path the managers gave in October 2026, BRD FR-03). The admin can add, rename and reorder roles. M5 attaches criteria to this table.
- Existing members have no role until the admin sets one; the UI shows "Not set". No bulk default (my call: a wrong default is worse than an empty cell). The admin sets roles in `/members`; a bulk import of roles comes with the Skill Matrix import (WBS 11.7).
- `members.career_role_id → career_roles null` (on delete restrict).
- `members.career_start date null`: always the first day of a month. If the member gives only a year, it is stored as January of that year.

**YoE.** Worked out in a view, never stored (CLAUDE.md rule 4): months between `career_start` and today in `Asia/Ho_Chi_Minh` (`lib/dates.ts` on the TypeScript side), shown in years rounded down to 0.5 (for example "3.5 years"), `null` when there is no career start. The view uses `security_invoker = true` (rule 3). A career start in the future is rejected.

**Who changes what.**

| Field | Admin | Manager (in scope) | Member (self) |
|---|---|---|---|
| Career role | Set | Read | Read |
| Career start | Set | Read | Set |

Today managers may update member rows in their teams (`members: manager update managed team`), and members cannot update their own row. Both rules need narrowing:

- A manager must not change `career_role_id` or `career_start` (the table above: Read only). Enforce it in the database, for example with a trigger that rejects a change of either column unless the caller is the admin or the member's own `career_start` function below, or with column privileges. The manager's member form shows both as read-only.
- A member sets only their own `career_start`, through a narrow server action that calls a `security definer` function updating that one column for `my_member_id()`. No broad update policy on `members` for members.

**Screens.** `/me`: "Career role" (read-only) and "Started working" (month + year picker, month optional), with the YoE beside it. `/members`: Role and YoE columns, with the role set in the admin's member form. `/settings` or `/org` (builder's choice, admin only): the list of career roles. Export: Role and YoE columns.

### 6.3 Course cost and study hours (WBS 10.3)

`courses.cost numeric(12,2)` and `courses.est_hours int` already exist. The form shows cost as "Chi phí (VNĐ)" and does not show hours.

- Add `courses.cost_currency` with two allowed values, `VND` and `USD`. It is required when `cost` is set and must be empty when `cost` is empty (check constraint). Existing rows with a cost get `VND`, because that is what the form has said so far.
- Course form: Cost (amount + currency select) and "Study hours (estimate)". Course list: cost formatted by currency ("$150", "3,500,000 ₫") and hours.
- Import: optional columns for cost, currency and hours. An unknown currency is a row error in the preview, like other bad values. Export: the same three columns.
- Any total shown later (goal plans, M4) is given **per currency**, for example "$1,200 + 15,000,000 ₫".

### 6.4 English-first interface (WBS 8.2)

- Rewrite every user-facing string to plain English: screens, toasts, validation messages (Zod), empty states, dialogs, e-mail templates and subjects (`src/lib/email/templates`), and the CSV/Excel export headers. About 155 files under `src/` and `e2e/` contain Vietnamese text today.
- Strings produced by the database count too. The dashboard RPC (`20261003000001_dashboard_rpc.sql`) returns labels such as "Chưa có team", "Chưa phân loại", "Chưa rõ nhà cung cấp". A new migration replaces those functions with English labels ("No team", "Uncategorised", "Unknown provider"); check every other function and view (for example the data-quality view) for user-facing literals and treat them the same way. Update the pgTAP and e2e tests that match them.
- Use the wording rules of BRD Appendix B.1: buttons say what they do, the same words everywhere.
- Strings stay in the components. No i18n library is added in M1 (builder's call, recorded here: the switch comes after Release 1 and can introduce a message catalogue then).
- Dates stay `dd/mm/yyyy`. Numbers use the English format ("1,234.5"). Vietnamese names and accents in data must still work everywhere, including import and export (UTF-8 with BOM for CSV, as today).
- Import still **accepts** the old Vietnamese column headers and status words of the legacy spreadsheet, because the real file is Vietnamese. Only what the app writes is English.
- e2e tests and unit tests that match on text are updated in the same change.
- Update `docs/design-system.md` and the `/design` page where they show Vietnamese copy.

### 6.5 Page speed (WBS 8.1)

The function region is already Tokyo (`hnd1`), next to the database. Remaining work:

- A `loading.tsx` (skeleton matching the page) for every route in `(app)`. Today only `/dashboard` and `/data-quality` have one.
- At most one auth round trip per navigation. Today the proxy (`src/lib/supabase/proxy.ts`) and the layout (`src/features/auth/queries.ts`) both call `auth.getUser()`. Read the Next.js docs in `node_modules/next/dist/docs/` before changing this (CLAUDE.md), and keep the security property: the server must still verify the session before reading data.
- Measure before and after with the method in [04 §4](../../process/04-wbs.md), plus signed-in pages, and add the "after" column there. Signed-in method (my call, matching PRD-28 in [08](../../process/08-production-readiness.md)): the production URL from Vietnam, signed in as a manager, each page in `(app)` opened 10 times by client navigation, 75th percentile of the time until the page content shows.
- The 1-second target is recorded, not a gate for M1: loading feedback on every page and a single auth round trip are the acceptance criteria. If a page still misses 1 second, the result and its cause go into 04 §4 as follow-up work.

## 7. Testing

- **pgTAP:** scope resolution (team scope, program scope, both, a team added to a program later, a team moved out of a program); a manager cannot read or update members outside scope; a manager cannot change `career_role_id`; a member can set only their own `career_start`; the migration keeps every former `team_managers` assignment; `cost_currency` constraints; the YoE view in the Vietnam time zone at a month boundary.
- **Vitest:** Zod schemas (cost + currency, career start not in the future), YoE rounding, currency formatting.
- **Playwright:** admin gives a program scope and the manager sees that program's members; a member sets their career start and sees their YoE; a course saved with a USD cost shows "$"; smoke run of each page in English.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db && pnpm test:e2e` green; `pnpm db:types` after the migrations.

## 8. Order of work (for the plan)

1. 10.1 manager scope: it changes access rules, so it lands first and alone.
2. 10.2 career role and YoE; 10.3 cost and currency. Independent of each other.
3. 8.2 English interface: after 10.1–10.3, so the new screens are written in English once.
4. 8.1 page speed: last, measured on the finished screens.

## 9. Left to the builder

- The exact UI of the scope picker on `/org` and where the career-role list is edited.
- Trigger or column privileges to stop managers changing `career_role_id`.
- Skeleton design for each `loading.tsx`, using the design-system components.
- How to remove the second `getUser()` call without weakening the session check.

## 10. Open points

- None from the owner. BRD v3.0 wording "DC manager" → "admin (DC lead)" is to be fixed in the next BRD revision (decision #55).

## 11. Calls made by the author (not discussed with the owner)

- Scope rows grant access only to users with the Manager role; demoted managers keep inert rows (§6.1).
- Managers cannot change career role or career start (§6.2).
- No default career role for existing members (§6.2).
- Totals with mixed currencies are shown per currency; existing costs are taken as VND (§6.3).
- No i18n library in M1; the import still accepts Vietnamese headers (§6.4).
- Database labels are translated by a new migration (§6.4).
- The 1-second target is measured and recorded, not a gate (§6.5).
