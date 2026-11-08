# Manager Dashboard Verification & Implementation Report

**Branch:** `feat/implement-manager-dashboard`  
**Figma Canvas:** `https://www.figma.com/design/l46n1GeFs7BvNrxVCy8NY4/CertTracker?node-id=4-1936`  
**Date:** 2026-11-08  

---

## 1. Design Block Mapping & Built Components

After the clean-up (branch `refactor/manager-dashboard-cleanup`): each fact appears once, and nothing is invented. All components live in `src/features/dashboard/components/manager/`.

| Figma Design Block (Node 4:1936) | Implementation Component | Contract & Evidence |
|---|---|---|
| **Subheader Scope Filter** | `TeamScopeFilter` | Pills "All teams" and one per managed team, no member counts, no period selector, no second download link. |
| **Team Readiness Circular Donut** | `TeamReadinessDonutCard` (`{kpis, noCertCount}`) | SVG donut with the valid share, `{valid} of {completed} completed certificates`, one legend row `Members without a completed certificate`; an em dash when nothing is completed. Contains `dl > div` with `<dt>Team readiness</dt>` for `tileValue(page, "Team readiness")`. |
| **Top KPI Cards** | `TopKpiRow` | `Expiring within 60 days` (caption `{urgentCount} with 30 days or less`), `Expired` (`Past due:` names the most overdue certificate), `Waiting for approval` (dashed, Soon chip, value `—`). |
| **Needs Attention** | `NeedsAttentionFeed` | Region "Needs attention": expired certificates only, most overdue first, `Resolve` link to `/records?search=`. No approvals placeholder. |
| **Allocated Scope Card** | `AllocatedScopeCard` | Team names with member counts. |
| **Quick Actions Card** | `QuickActionsCard` (no props) | `Add certificate` (`/records`) and `View team data quality` (`/data-quality`). Export lives once, in the page header. |
| **Certificates Earned (6 Months)** | `MonthlyEarnedChart` | Recharts bars with the real total; no growth percentage. |
| **Manager Tab Strip** | `ManagerTabStrip` | `Overview` (current), `Approvals Soon`, `Skills Soon`, `Goals Soon` (disabled). |
| **Next to Expire** | `NextToExpireTable` | Completed certificates with 0-60 days left, soonest first, `View` link to `/records?search=`. |
| **Team Readiness** | `TeamReadinessDossier` | Master-detail: ranked members (`#1`, valid / in progress, segmented bar) and details of the selected member with the link `View member certificates`. The only ranking on the page. |
| **People Without Certificates Yet** | `PeopleWithoutCertsCard` | Names, team and count only. |
| **Automated Reminders** | `AutomatedRemindersCard` (no props) | Two facts from `vercel.json`: Monday 08:00 (Vietnam time) expiry email, monthly report on the 1st. No links. |
| **Ask about my team** | `AskAboutMyTeamComingSoon` | One merged `ComingSoonCard` (also covers risk alerts), static text ending "Not available yet.", no input, chips or buttons. |
| **Org-Wide Aggregates** | `DepartmentSummaryCard` | Section `Across the department`. |

Removed in the clean-up: `ManagerKpiCards` and `TeamReadinessLeague` (no importers), the Individual ranking section and `getRanking` in `loadManagerDashboard` (the admin loader keeps it), the Approvals queue, Goals, Skills and Risk alerts cards, the period selector, the second and third export links, the reminders Preview link, and the invented values (Program DAS, +28%, Last sent, fallback `Team Cloud`, `Team member`, `Suggest certification`, `Assign goal`, `Approvals (2)`). Guard tests: `manager-copy.test.ts`, `manager-dashboard-view.test.tsx`, `manager-cards.test.tsx`.

---

## 2. Real Verification Outputs

> The outputs below were captured before the clean-up (earlier page with the duplicated sections). After the clean-up the checks were re-run; see `.superpowers/sdd/ui-polish-review/manager-cleanup-impl-report.md`.

### 2.1 TypeScript Typecheck (`pnpm typecheck`)

```
$ tsc --noEmit
```
*(Exited with code 0. 0 errors).*

---

### 2.2 ESLint (`pnpm lint`)

```
$ eslint

D:\Fullstack\CertTracker\src\components\data\data-table.tsx
  63:17  warning  Compilation Skipped: Use of incompatible library

This API returns functions which cannot be memoized without leading to stale UI. To prevent this, by default React Compiler will skip memoizing this component/hook. However, you may see issues if values from this API are passed to other components/hooks that are memoized.

D:\Fullstack\CertTracker\src\components\data\data-table.tsx:63:17
  61 | }: DataTableProps<TData, TValue>) {
  62 |   const [sorting, setSorting] = useState<SortingState>([]);
> 63 |   const table = useReactTable({
     |                 ^^^^^^^^^^^^^ TanStack Table's `useReactTable()` API returns functions that cannot be memoized safely
  64 |     data,
  65 |     columns,
  66 |     getRowId,  react-hooks/incompatible-library

✖ 1 problem (0 errors, 1 warning)
```

---

### 2.3 Vitest Suite (`pnpm test`)

```
$ vitest run

 RUN  v5.0.2 D:/Fullstack/CertTracker

 ✓ src/lib/process-docs.test.ts (102 tests) 160ms
 ✓ src/features/dashboard/metrics.test.ts (28 tests) 286ms
 ✓ src/lib/supabase/auth-round-trips.test.ts (30 tests) 232ms
 ✓ src/lib/english-ui.test.ts (1 test) 259ms
 ✓ src/features/export/records-export.test.ts (14 tests) 197ms
 ✓ src/features/import/plan.test.ts (42 tests) 191ms
 ✓ src/features/dashboard/components/member/member-cards.test.tsx (20 tests) 111ms
 ✓ src/features/import/sample-workbook.test.ts (15 tests) 279ms
 ✓ src/features/dashboard/components/member/member-kpi-cards.test.tsx (4 tests) 110ms
 ✓ src/lib/email/sender.test.ts (9 tests) 46ms
 ✓ src/features/notifications/emails.test.ts (5 tests) 276ms
 ✓ src/features/dashboard/components/member/member-attention-banner.test.tsx (4 tests) 76ms
 ✓ src/lib/utils.test.ts (2 tests) 61ms
 ✓ src/features/notifications/run.test.ts (11 tests) 430ms
 ✓ src/app/api/export/records/route.test.ts (3 tests) 79ms
 ✓ src/features/notifications/handler.test.ts (23 tests) 731ms
 ✓ src/components/status/coming-soon-card.test.tsx (2 tests) 57ms
 ✓ src/lib/email/templates/templates.test.ts (22 tests) 955ms
 ✓ src/features/notifications/runs.test.ts (15 tests) 34ms
 ✓ src/features/notifications/deliver.test.ts (21 tests) 29ms
 ✓ src/features/auth/schema.test.ts (11 tests) 34ms
 ✓ src/features/notifications/expiry-plan.test.ts (34 tests) 31ms
 ✓ src/features/auth/actions.test.ts (4 tests) 59ms
 ✓ src/features/dashboard/member-metrics.test.ts (54 tests) 35ms
 ✓ src/features/notifications/monthly-plan.test.ts (25 tests) 41ms
 ✓ src/features/import/clean.test.ts (55 tests) 36ms
 ✓ src/features/dashboard/dashboard-error.test.tsx (2 tests) 257ms
 ✓ src/features/courses/schema.test.ts (9 tests) 22ms
 ✓ src/features/dashboard/schema.test.ts (6 tests) 23ms
 ✓ src/features/dashboard/components/explorer/master-list.test.tsx (7 tests) 13ms
 ✓ src/features/organizations/schema.test.ts (8 tests) 19ms
 ✓ src/features/import/cleanup.test.ts (4 tests) 12ms
 ✓ src/features/records/schema.test.ts (10 tests) 22ms
 ✓ src/features/import/run-batch-action.test.ts (5 tests) 14ms
 ✓ src/features/import/schema.test.ts (5 tests) 21ms
 ✓ src/lib/email/resend-sender.test.ts (9 tests) 18ms
 ✓ src/app/tokens.test.ts (75 tests) 18ms
 ✓ src/features/notifications/period.test.ts (15 tests) 14ms
 ✓ src/features/members/schema.test.ts (11 tests) 19ms
 ✓ src/features/career/schema.test.ts (13 tests) 21ms
 ✓ src/features/dashboard/components/member/member-certificates-list.test.tsx (12 tests) 52ms
 ✓ src/components/app-shell/logo.test.ts (3 tests) 15ms
 ✓ src/lib/assert-local-supabase-url.test.ts (18 tests) 16ms
 ✓ src/features/notifications/vercel-cron.test.ts (4 tests) 12ms
 ✓ src/app/(app)/loading-files.test.ts (11 tests) 15ms
 ✓ src/lib/supabase/fetch-all.test.ts (6 tests) 15ms
 ✓ src/features/data-quality/schema.test.ts (4 tests) 16ms
 ✓ src/lib/format.test.ts (6 tests) 10ms
 ✓ src/lib/email/theme.test.ts (13 tests) 10ms
 ✓ src/lib/money.test.ts (8 tests) 14ms
 ✓ src/features/dashboard/settle.test.ts (2 tests) 10ms
 ✓ src/features/import/stored.test.ts (8 tests) 13ms
 ✓ src/features/import/preview.test.ts (7 tests) 11ms
 ✓ src/components/status/expiry.test.ts (8 tests) 11ms
 ✓ src/features/notifications/cron-auth.test.ts (11 tests) 12ms
 ✓ src/features/data-quality/issues.test.ts (6 tests) 12ms
 ✓ src/lib/postgres-error.test.ts (7 tests) 8ms
 ✓ src/lib/design/contrast.test.ts (3 tests) 8ms
 ✓ src/features/dashboard/view-model.test.ts (4 tests) 10ms
 ✓ src/features/dashboard/manager-metrics.test.ts (14 tests) 20ms
 ✓ src/features/members/actions.test.ts (3 tests) 14ms
 ✓ src/components/app-shell/nav.test.ts (5 tests) 13ms
 ✓ src/lib/plural.test.ts (8 tests) 9ms
 ✓ src/lib/dates.test.ts (7 tests) 10ms
 ✓ src/features/import/commit-error.test.ts (8 tests) 9ms
 ✓ src/features/export/csv.test.ts (3 tests) 7ms
 ✓ src/features/career/format.test.ts (7 tests) 8ms
 ✓ src/features/notifications/app-url.test.ts (4 tests) 8ms
 ✓ src/features/dashboard/components/explorer/types.test.ts (9 tests) 9ms
 ✓ src/lib/storage/supabase-storage.test.ts (1 test) 7ms
 ✓ src/lib/storage/evidence.test.ts (4 tests) 10ms
 ✓ src/components/data/pagination.test.ts (2 tests) 6ms
 ✓ src/components/status/labels.test.ts (4 tests) 8ms
 ✓ src/lib/text.test.ts (3 tests) 7ms
 ✓ src/lib/cron-path.test.ts (1 test) 6ms
 ✓ src/lib/assert-affected.test.ts (3 tests) 6ms
 ✓ src/lib/ui-copy.test.ts (6 tests) 23ms
 ✓ src/features/dashboard/components/manager/manager-cards.test.tsx (14 tests) 152ms
 ✓ src/features/dashboard/components/copy.test.tsx (26 tests) 226ms
 ✓ src/app/(app)/dashboard/page.test.tsx (5 tests) 214ms
 ✓ src/features/import/workbook.test.ts (35 tests) 8036ms

 Test Files  81 passed (81)
      Tests  1048 passed (1048)
   Start at  13:07:55
   Duration  9.57s
```

---

### 2.4 Next.js Production Build (`pnpm build`)

```
$ next build
▲ Next.js 16.3.6 (Turbopack)
- Environments: .env.local
✓ Running next.config.ts took 101ms
- Experiments (use with caution):
  · serverActions

  Creating an optimized production build ...
✓ Compiled successfully in 4.1s
  Running TypeScript ...
  Finished TypeScript in 6.0s ...
  Collecting page data using 15 workers ...
  Generating static pages using 15 workers (0/19) ...
  Generating static pages using 15 workers (4/19) 
  Generating static pages using 15 workers (9/19) 
  Generating static pages using 15 workers (14/19) 
✓ Generating static pages using 15 workers (19/19) in 931ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/cron/expiry-alerts
├ ƒ /api/cron/monthly-report
├ ƒ /api/export/records
├ ƒ /api/import/parse
├ ƒ /api/records/[id]/evidence
├ ƒ /courses
├ ƒ /dashboard
├ ƒ /data-quality
├ ○ /design
├ ○ /icon.svg
├ ƒ /import
├ ƒ /import/[batchId]
├ ƒ /login
├ ƒ /me
├ ƒ /members
├ ƒ /org
├ ƒ /records
├ ƒ /set-password
└ ƒ /settings

ƒ Proxy (Middleware)
○ (Static) prerendered as static content
ƒ (Dynamic) server-rendered on demand
```

---

### 2.5 Full Playwright Test Suite (`pnpm exec playwright test` on Port 3200)

```
Running 85 tests using 1 worker

  ok  1 [chromium] › e2e\account-setup.spec.ts:36:5 › opening the link alone does not use it up, and a mismatch keeps it valid (711ms)
  ok  2 [chromium] › e2e\account-setup.spec.ts:44:5 › an invited member sets a password, signs in as Member and sees their own page (3.1s)
  ok  3 [chromium] › e2e\account-setup.spec.ts:60:5 › a link that was already used is refused with a way forward (567ms)
  ok  4 [chromium] › e2e\account-setup.spec.ts:65:5 › a broken link shows no form (342ms)
  ok  5 [chromium] › e2e\account-setup.spec.ts:71:5 › a recovery link works while another user is signed in (2.5s)
  ok  6 [chromium] › e2e\auth.spec.ts:6:5 › unauthenticated visitor is sent to login (373ms)
  ok  7 [chromium] › e2e\auth.spec.ts:11:5 › admin signs in, sees dashboard, and signs out (2.1s)
  ok  8 [chromium] › e2e\auth.spec.ts:20:5 › wrong password shows an error (608ms)
  ok  9 [chromium] › e2e\career.spec.ts:18:5 › member sets when they started working and sees the YoE; the role is read-only (2.6s)
  ok 10 [chromium] › e2e\career.spec.ts:35:5 › member cannot save a career start in the future (2.6s)
  ok 11 [chromium] › e2e\career.spec.ts:45:5 › admin sets a member's role and career start in /members and sees the Role and YoE columns (3.7s)
  ok 12 [chromium] › e2e\career.spec.ts:69:5 › manager sees a member's role and career start read-only (2.3s)
  ok 13 [chromium] › e2e\career.spec.ts:87:5 › admin manages the career roles; a role in use cannot be deleted (7.0s)
  ok 14 [chromium] › e2e\courses.spec.ts:4:5 › admin adds a course and a member can only read it (6.0s)
  ok 15 [chromium] › e2e\courses.spec.ts:45:5 › admin saves a course with a USD cost and study hours, and the list shows them (4.2s)
  ok 16 [chromium] › e2e\courses.spec.ts:64:5 › a cost without a currency is refused with a clear message (2.8s)
  ok 17 [chromium] › e2e\dashboard.spec.ts:64:5 › admin sees org-wide KPIs, hero mini charts, expiry chart and personal ranking (1.4s)
  ok 18 [chromium] › e2e\dashboard.spec.ts:111:5 › manager sees the same org-wide numbers but a ranking limited to their team (1.3s)
  ok 19 [chromium] › e2e\dashboard.spec.ts:135:5 › manager next-to-expire displays urgent renewals ordered soonest first (1.3s)
  ok 20 [chromium] › e2e\dashboard.spec.ts:144:5 › manager team readiness league displays member status breakdown numbers (1.4s)
  ok 21 [chromium] › e2e\dashboard.spec.ts:153:5 › manager coming soon cards and tab strip are present and controls are disabled (1.4s)
  ok 22 [chromium] › e2e\dashboard.spec.ts:185:5 › a manager with no teams sees the empty state (1.6s)
  ok 23 [chromium] › e2e\dashboard.spec.ts:203:5 › member sees anonymous aggregates only (1.5s)
  ok 24 [chromium] › e2e\dashboard.spec.ts:262:5 › unlinked member account shows guidance empty state on dashboard (2.5s)
  ok 25 [chromium] › e2e\dashboard.spec.ts:274:5 › a member cannot read the ranking or per-team numbers straight from the API (225ms)
  ok 26 [chromium] › e2e\dashboard.spec.ts:297:5 › the dashboard updates live when a record changes elsewhere (8.9s)
  ok 27 [chromium] › e2e\dashboard.spec.ts:327:5 › explorer tabs, filter row, clear filters, and keyboard row selection update detail panel (1.6s)
  ok 28 [chromium] › e2e\design.spec.ts:4:5 › design showcase renders tokens and components (2.5s)
  ok 29 [chromium] › e2e\export.spec.ts:14:5 › admin exports CSV with a BOM, English headers and Vietnamese names (2.4s)
  ok 30 [chromium] › e2e\export.spec.ts:25:5 › manager's export is limited to managed teams (2.1s)
  ok 31 [chromium] › e2e\export.spec.ts:34:5 › Excel export is a valid workbook (2.2s)
  ok 32 [chromium] › e2e\import.spec.ts:48:5 › admin imports the legacy workbook (4.2s)
  ok 33 [chromium] › e2e\import.spec.ts:70:5 › re-importing the same file changes nothing (4.3s)
  ok 34 [chromium] › e2e\import.spec.ts:94:5 › a file without the required columns is rejected (2.3s)
  ok 35 [chromium] › e2e\import.spec.ts:109:5 › non-admins cannot import (2.3s)
  ok 36 [chromium] › e2e\members.spec.ts:12:5 › admin creates and deletes a member (4.2s)
  ok 37 [chromium] › e2e\members.spec.ts:37:5 › admin cannot delete a member who has training records (2.4s)
  ok 38 [chromium] › e2e\members.spec.ts:54:5 › manager cannot create or delete members, and only sees their managed team (2.4s)
  ok 39 [chromium] › e2e\members.spec.ts:72:5 › admin sees what a manager manages, and that the scopes go inactive when the role changes (4.4s)
  ok 40 [chromium] › e2e\members.spec.ts:104:5 › admin changes a member's access from the member form (4.0s)
  ok 41 [chromium] › e2e\members.spec.ts:126:5 › a member without an account shows No account and no access control (2.6s)
  ok 42 [chromium] › e2e\navigation.spec.ts:4:5 › admin sees admin-only sections (1.3s)
  ok 43 [chromium] › e2e\navigation.spec.ts:10:5 › member sees only personal sections (1.3s)
  ok 44 [chromium] › e2e\navigation.spec.ts:18:5 › sidebar link navigates, marks the breadcrumb and the active item (1.8s)
  ok 45 [chromium] › e2e\navigation.spec.ts:65:7 › /dashboard: skeleton or heading within 300 ms of the click (4.4s)
  ok 46 [chromium] › e2e\navigation.spec.ts:65:7 › /me: skeleton or heading within 300 ms of the click (4.3s)
  ok 47 [chromium] › e2e\navigation.spec.ts:65:7 › /members: skeleton or heading within 300 ms of the click (4.4s)
  ok 48 [chromium] › e2e\navigation.spec.ts:65:7 › /records: skeleton or heading within 300 ms of the click (4.4s)
  ok 49 [chromium] › e2e\navigation.spec.ts:65:7 › /data-quality: skeleton or heading within 300 ms of the click (4.3s)
  ok 50 [chromium] › e2e\navigation.spec.ts:65:7 › /courses: skeleton or heading within 300 ms of the click (4.4s)
  ok 51 [chromium] › e2e\navigation.spec.ts:65:7 › /org: skeleton or heading within 300 ms of the click (4.4s)
  ok 52 [chromium] › e2e\navigation.spec.ts:65:7 › /import: skeleton or heading within 300 ms of the click (4.4s)
  ok 53 [chromium] › e2e\navigation.spec.ts:65:7 › /settings: skeleton or heading within 300 ms of the click (4.5s)
  ok 54 [chromium] › e2e\navigation.spec.ts:87:5 › top bar shows while a navigation is pending and goes idle when the page is there (3.3s)
  ok 55 [chromium] › e2e\navigation.spec.ts:100:5 › top bar crawls with an animation while loading (normal motion) (2.7s)
  ok 56 [chromium] › e2e\navigation.spec.ts:112:5 › reduced motion: top bar has no animation or transition and is full width while loading (2.7s)
  ok 57 [chromium] › e2e\notifications.spec.ts:79:5 › cron endpoints require the bearer token and are not redirected by the login proxy (1.4s)
  ok 58 [chromium] › e2e\notifications.spec.ts:121:5 › dry runs list the seed's recipients and write nothing to the log (2.3s)
  ok 59 [chromium] › e2e\notifications.spec.ts:160:5 › a real run sends once and a second call sends nothing; /settings shows the history (2.1s)
  ok 60 [chromium] › e2e\notifications.spec.ts:208:5 › data quality shows overdue exams by role (6.2s)
  ok 61 [chromium] › e2e\notifications.spec.ts:280:5 › settings is for admins only (2.6s)
  ok 62 [chromium] › e2e\org.spec.ts:10:5 › admin manages the org tree end to end (4.7s)
  ok 63 [chromium] › e2e\org.spec.ts:40:5 › member has no write access to the org tree (2.8s)
  ok 64 [chromium] › e2e\org.spec.ts:56:5 › admin assigns a manager to a program and the manager sees every team of that program (5.1s)
  ok 65 [chromium] › e2e\pilot-access.spec.ts:84:5 › E-3: a member cannot open another member's proof (1.4s)
  ok 66 [chromium] › e2e\pilot-access.spec.ts:91:5 › E-4: a manager cannot open the proof of a member outside their scope (1.5s)
  ok 67 [chromium] › e2e\pilot-access.spec.ts:98:5 › E-5: a signed-out visitor is sent to /login and never gets data (118ms)
  ok 68 [chromium] › e2e\pilot-access.spec.ts:122:5 › E-6: signing out in one browser sends the other to /login without a loop, and it can sign in again (4.6s)
  ok 69 [chromium] › e2e\pilot-access.spec.ts:153:5 › E-7: a proof over 4 MB shows the form's message and nothing is saved (3.5s)
  ok 70 [chromium] › e2e\pilot-access.spec.ts:166:5 › E-7: a text file renamed .pdf shows the form's message and nothing is saved (3.2s)
  ok 71 [chromium] › e2e\pilot-data.spec.ts:45:5 › E-8: an imported Vietnamese name survives /members, the CSV export and the Excel export (5.2s)
  ok 72 [chromium] › e2e\pilot-data.spec.ts:71:5 › E-9: after the rehearsal import each cron job mails every recipient once, and a second call sends nothing (5.7s)
  ok 73 [chromium] › e2e\pilot-day-one.spec.ts:48:5 › E-1: a member's whole first day reaches the manager, the dashboard and the export (14.3s)
  ok 74 [chromium] › e2e\pilot-day-one.spec.ts:92:5 › E-2: a login invited before its member exists is linked once the admin adds the member (3.4s)
  ok 75 [chromium] › e2e\pilot-day-one.spec.ts:105:5 › E-10: a member's first day works on a phone without horizontal scrolling (4.7s)
  ok 76 [chromium] › e2e\records.spec.ts:56:5 › admin adds a record with evidence, opens it, and deletes it (7.1s)
  ok 77 [chromium] › e2e\records.spec.ts:126:5 › a second record for the same member and course is refused (3.0s)
  ok 78 [chromium] › e2e\records.spec.ts:142:5 › status rules are enforced in the form (3.5s)
  ok 79 [chromium] › e2e\records.spec.ts:169:5 › manager sees only the managed team and can only pick managed members (2.4s)
  ok 80 [chromium] › e2e\records.spec.ts:187:5 › member updates own progress and cannot see company fields (5.6s)
  ok 81 [chromium] › e2e\records.spec.ts:219:5 › the certificate form says what to do when a course is missing (2.6s)
  ok 82 [chromium] › e2e\records.spec.ts:235:5 › member uploads, opens and removes evidence on their own record (6.4s)
  ok 83 [chromium] › e2e\records.spec.ts:301:5 › the list updates live for another user (8.0s)
  ok 84 [chromium] › e2e\shell.spec.ts:13:7 › app shell › does not scroll horizontally, even next to a wide table (1.5s)
  ok 85 [chromium] › e2e\shell.spec.ts:33:7 › app shell › closes the mobile drawer after navigating to another page (2.0s)

  85 passed (4.8m)
```
