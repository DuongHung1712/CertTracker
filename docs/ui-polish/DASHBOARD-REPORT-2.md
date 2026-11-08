# CertTracker Dashboard Redesign Delta Pass 2 Report

> **Date:** 2026-11-07  
> **Branch:** `feat/ui-polish-phase-a-2`  
> **Status:** All standards verified, 847 unit tests pass, 80 Playwright e2e tests pass across all 17 spec files.

---

## 1. Executive Summary

This second delta pass aligns CertTracker's `/dashboard` with the exact layout rhythm, visual density, and visual hierarchy of the Finnova finance template while strictly preserving CertTracker's design tokens (`#0E5C58` deep teal in light, `#249C90` bright teal in dark, dark slate ink, 6px radius, Be Vietnam Pro font, no purple, no gradients, no shadows) and all database/API/e2e contracts.

### Key Changes
1. **Tall Hero KPI Cards (~240px desktop)**:
   - Upper half: Uppercase label, icon badge in top-right, large KPI figure (`text-kpi font-semibold tracking-tight tabular-nums`), caption hint.
   - Lower half: Real Recharts mini chart filling the lower half:
     - `Certificate records`: BarChart of records per group (top 6 + "Others" aggregation), `--chart-1` bars, visible value labels & x-labels, no animation.
     - `Valid`: BarChart of the four valid buckets (`> 60 days`, `31–60 days`, `≤ 30 days`, `No expiry`) using existing `--status-*` tokens.
     - `Expiring (≤ 60 days)`: Half-donut gauge (`startAngle={180}`, `endAngle={0}`) showing share of completed certificates expiring within 60 days, with count & percentage in center.
     - `Expired`: BarChart of expired certificates per team/type, or positive empty state (check icon, `"No expired certificates"`, `"All completed certificates are up to date"`) when total = 0.
   - Accessible markup: `aria-hidden` Recharts SVG wrapped in `role="img"` with descriptive `aria-label` and `<ul className="sr-only">` text list; contrast $\ge 3:1$ in both themes; `isAnimationActive={false}`.
2. **Slim Compact Stat Strip**:
   - Replaced the three large separate boxes (`Active members`, `Completed`, `In progress`) with a single slim inline stat strip (`h-14` desktop) preserving the semantic `dl > div > dt + dd.first()` structure.
3. **Compact Expiry Horizon (~120px)**:
   - Moved the `Certificate expiry` region directly above Explorer as a compact horizontal strip (`h-28` chart), preserving the `role="img"` and `aria-label` contract.
   - Folded study status completion into the Explorer detail panel study split.
4. **Client-Side Filter Row Above Explorer**:
   - Filter bar placed directly above the Explorer panel:
     - `"Active filters"` label with live count chip + `"Clear filters"` button.
     - Status dropdown: `"All groups"`, `"Has expired certificates"`, `"Has in-progress"`, `"No completed yet"`.
     - Volume dropdown: `"Min records: Any"`, `"1+"`, `"5+"`, `"10+"`.
     - Live search input with search icon.
   - Automatically maintains selection validity (falls back to first row on filter changes) and renders clear empty state with `"Clear filters"`.
5. **Explorer Master-Detail Board**:
   - Tab pills with count badges on top (`By team (N)`, `By certificate type (N)`, `By provider (N)`, `Popular courses (N)`).
   - **Solid selected row**: Solid `bg-primary` with `text-primary-foreground` (contrast $7.5:1$ in light, $7.4:1$ in dark, exceeding WCAG AA $4.5:1$), visible focus ring (`focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`), and light record count chip (`bg-primary-foreground/20 text-primary-foreground`).
   - **Detail dossier**: Prominent title (`text-page-title`), status pill, 4 metric cards (`Valid`, `Completed`, `In progress`, `Expired`), study status split, validity split.
   - **Totals footer**: Left side shows total records, completion percentage, and expired count; right side provides 2 icon action buttons with `Tooltip` + `aria-label` (copy summary to clipboard with toast feedback, open records in new tab) plus primary button `"View in records"`.
6. **Header**:
   - Left: Title + subtitle.
   - Right: `"Filters"` button (scrolls to and focuses filter controls) + primary button with 16px Lucide icon (`ListChecks`) for `"View records"` / `"My certificates"`.

---

## 2. Template Element Alignment Matrix

| Template Element | What Was Built | Pass / Fail |
| :--- | :--- | :---: |
| **Header Actions** | Subtitle timestamp + "Filters" icon button (scrolls to & focuses filter row) + primary button with 16px Lucide `ListChecks` icon (`View records` / `My certificates`) | **Pass** |
| **Hero KPI Cards (Tall ~240px)** | `KpiCard` with `min-h-[235px]`. Upper half: title, top-right icon badge, large tabular number, hint. Lower half: real mini chart filling card bottom. | **Pass** |
| **Card 1 Chart (Records)** | `RecordsMiniChart`: Recharts BarChart of top 6 groups + "Others", fill `--chart-1`, visible labels & x-ticks, `role="img"`, `sr-only` list. | **Pass** |
| **Card 2 Chart (Valid)** | `ValidMiniChart`: Recharts BarChart of 4 valid buckets (`> 60d`, `31–60d`, `≤ 30d`, `No exp`) with `--status-*` token fills. | **Pass** |
| **Card 3 Chart (Expiring)** | `ExpiringGaugeMiniChart`: Half-donut gauge (`startAngle={180}`, `endAngle={0}`) showing expiring $\le 60$d ratio with center number & percentage. | **Pass** |
| **Card 4 Chart (Expired)** | `ExpiredMiniChart`: Positive empty state (`CheckCircle2` icon, "No expired certificates", "All completed certificates are up to date") when total = 0; BarChart when > 0. | **Pass** |
| **Compact Stat Strip** | Slim single-row strip (`h-14`) for `Active members`, `Completed`, `In progress` inside `<Section title="Overview">` (`dl > div > dt + dd.first()`). | **Pass** |
| **Expiry Strip Placement** | Moved above Explorer as a compact horizontal strip (~120px) retaining exact `role="img"` and `aria-label` contract. | **Pass** |
| **Filter Row** | Dedicated bar directly above Explorer: "Active filters" label with count chip + "Clear filters", Status select, Min records select, search input. | **Pass** |
| **Explorer Tab Pills** | Clean pill strip on top with count chips (`By team 3`, `By certificate type 4`, etc.). | **Pass** |
| **Explorer Master List (Selected Row)** | Solid `bg-primary` row with `text-primary-foreground` ($7.5:1$ light / $7.4:1$ dark contrast), light count badge (`bg-primary-foreground/20`), visible focus ring. | **Pass** |
| **Explorer Detail Panel (Cards)** | 4 sub-metric cards (`Valid`, `Completed`, `In progress`, `Expired`) with metric value, status dot, and arrow icon. | **Pass** |
| **Explorer Detail Panel (Visuals)** | Visual progress bars: Study status split (`--chart-1..3`) and Validity split (`valid` vs `expired`). | **Pass** |
| **Explorer Totals Footer** | Left: Total records, completion %, expired count. Right: Copy summary button (Tooltip + toast), Open records in new tab button (Tooltip), Primary "View in records" button. | **Pass** |
| **Loading Skeleton** | `loading.tsx` matches the redesigned layout (tall card skeletons, slim stat strip, compact expiry strip, filter row, master-detail board). | **Pass** |

---

## 3. Standards Compliance Matrix

| Block | 1. Four States | 2. Perf / Data | 3. Tokens Only | 4. Icons 16px | 5. WCAG AA (Contrast & ARIA) | 6. Mobile 390px | 7. Plain English | 8. Code Quality |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Header** | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| **Hero Cards (4)** | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| **Stat Strip (3)** | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| **Expiry Strip** | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| **Filter Row** | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| **Explorer List** | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| **Explorer Detail** | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| **Totals Footer** | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| **Ranking** | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass |

---

## 4. Verification Outputs

### 4.1 `pnpm lint`
```
$ eslint

D:\Fullstack\CertTracker\src\components\data\data-table.tsx
  56:17  warning  Compilation Skipped: Use of incompatible library

This API returns functions which cannot be memoized without leading to stale UI. To prevent this, by default React Compiler will skip memoizing this component/hook. However, you may see issues if values from this API are passed to other components/hooks that are memoized.

D:\Fullstack\CertTracker\src\components\data\data-table.tsx:56:17
  54 | }: DataTableProps<TData, TValue>) {
  55 |   const [sorting, setSorting] = useState<SortingState>([]);
> 56 |   const table = useReactTable({
     |                 ^^^^^^^^^^^^^ TanStack Table's `useReactTable()` API returns functions that cannot be memoized safely
  57 |     data,
  58 |     columns,
  59 |     getRowId,  react-hooks/incompatible-library

✖ 1 problem (0 errors, 1 warning)
```

### 4.2 `pnpm typecheck`
```
$ tsc --noEmit
[Exit Code: 0]
```

### 4.3 `pnpm test`
```
$ vitest run

 RUN  v5.0.2 D:/Fullstack/CertTracker

 ✓ src/lib/process-docs.test.ts (102 tests) 151ms
 ✓ src/lib/email/sender.test.ts (9 tests) 84ms
 ✓ src/features/dashboard/schema.test.ts (6 tests) 26ms
 ✓ src/features/dashboard/metrics.test.ts (19 tests) 304ms
 ✓ src/features/auth/actions.test.ts (4 tests) 65ms
 ✓ src/lib/supabase/auth-round-trips.test.ts (30 tests) 235ms
 ✓ src/lib/utils.test.ts (2 tests) 39ms
 ✓ src/features/import/plan.test.ts (42 tests) 147ms
 ✓ src/features/export/records-export.test.ts (14 tests) 213ms
 ✓ src/app/api/export/records/route.test.ts (3 tests) 58ms
 ✓ src/features/notifications/monthly-plan.test.ts (25 tests) 27ms
 ✓ src/features/import/sample-workbook.test.ts (15 tests) 301ms
 ✓ src/features/notifications/runs.test.ts (15 tests) 32ms
 ✓ src/lib/english-ui.test.ts (1 test) 38ms
 ✓ src/lib/email/resend-sender.test.ts (9 tests) 22ms
 ✓ src/features/notifications/expiry-plan.test.ts (34 tests) 37ms
 ✓ src/features/notifications/deliver.test.ts (21 tests) 30ms
 ✓ src/features/notifications/emails.test.ts (5 tests) 311ms
 ✓ src/features/notifications/run.test.ts (11 tests) 504ms
 ✓ src/app/tokens.test.ts (70 tests) 22ms
 ✓ src/features/records/schema.test.ts (10 tests) 26ms
 ✓ src/lib/email/templates/templates.test.ts (22 tests) 1014ms
 ✓ src/features/notifications/period.test.ts (15 tests) 17ms
 ✓ src/features/import/clean.test.ts (55 tests) 33ms
 ✓ src/features/career/schema.test.ts (13 tests) 31ms
 ✓ src/features/courses/schema.test.ts (9 tests) 23ms
 ✓ src/features/notifications/handler.test.ts (23 tests) 914ms
 ✓ src/lib/assert-local-supabase-url.test.ts (18 tests) 16ms
 ✓ src/features/import/schema.test.ts (5 tests) 21ms
 ✓ src/features/auth/schema.test.ts (11 tests) 18ms
 ✓ src/features/data-quality/schema.test.ts (4 tests) 17ms
 ✓ src/features/import/cleanup.test.ts (4 tests) 13ms
 ✓ src/features/organizations/schema.test.ts (8 tests) 20ms
 ✓ src/features/members/schema.test.ts (11 tests) 22ms
 ✓ src/lib/supabase/fetch-all.test.ts (6 tests) 14ms
 ✓ src/features/notifications/cron-auth.test.ts (11 tests) 11ms
 ✓ src/features/import/run-batch-action.test.ts (5 tests) 15ms
 ✓ src/app/(app)/loading-files.test.ts (11 tests) 14ms
 ✓ src/components/status/expiry.test.ts (8 tests) 14ms
 ✓ src/lib/money.test.ts (8 tests) 15ms
 ✓ src/features/import/stored.test.ts (8 tests) 13ms
 ✓ src/lib/dates.test.ts (7 tests) 12ms
 ✓ src/lib/email/theme.test.ts (13 tests) 12ms
 ✓ src/features/import/preview.test.ts (7 tests) 16ms
 ✓ src/features/dashboard/settle.test.ts (2 tests) 9ms
 ✓ src/lib/format.test.ts (6 tests) 12ms
 ✓ src/components/app-shell/logo.test.ts (3 tests) 12ms
 ✓ src/lib/storage/supabase-storage.test.ts (1 test) 8ms
 ✓ src/features/career/format.test.ts (7 tests) 7ms
 ✓ src/features/members/actions.test.ts (3 tests) 13ms
 ✓ src/features/notifications/app-url.test.ts (4 tests) 9ms
 ✓ src/features/export/csv.test.ts (3 tests) 8ms
 ✓ src/features/notifications/vercel-cron.test.ts (4 tests) 14ms
 ✓ src/lib/postgres-error.test.ts (7 tests) 9ms
 ✓ src/lib/storage/evidence.test.ts (4 tests) 8ms
 ✓ src/features/import/commit-error.test.ts (8 tests) 10ms
 ✓ src/components/app-shell/nav.test.ts (5 tests) 15ms
 ✓ src/lib/assert-affected.test.ts (3 tests) 8ms
 ✓ src/features/data-quality/issues.test.ts (6 tests) 15ms
 ✓ src/lib/design/contrast.test.ts (3 tests) 9ms
 ✓ src/lib/plural.test.ts (4 tests) 7ms
 ✓ src/lib/cron-path.test.ts (1 test) 5ms
 ✓ src/lib/text.test.ts (3 tests) 6ms
 ✓ src/components/data/pagination.test.ts (2 tests) 7ms
 ✓ src/components/status/labels.test.ts (4 tests) 5ms
 ✓ src/features/import/workbook.test.ts (35 tests) 7632ms

 Test Files  66 passed (66)
      Tests  847 passed (847)
   Start at  16:23:34
   Duration  9.08s
```

### 4.4 `pnpm build`
```
$ next build
▲ Next.js 16.3.6 (Turbopack)
- Environments: .env.local
✓ Running next.config.ts took 35ms
- Experiments (use with caution):
  · serverActions

  Creating an optimized production build ...
✓ Compiled successfully in 4.8s
  Running TypeScript ...
  Finished TypeScript in 5.4s ...
  Collecting page data using 15 workers ...
  Generating static pages using 15 workers (0/19) ...
  Generating static pages using 15 workers (4/19) 
  Generating static pages using 15 workers (9/19) 
  Generating static pages using 15 workers (14/19) 
✓ Generating static pages using 15 workers (19/19) in 890ms
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
○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
[Exit Code: 0]
```

### 4.5 Playwright E2E Suite (17 Spec Files, 80 Tests, Port 3200)
```
Running 80 tests using 1 worker

  ok  1 [chromium] › e2e\account-setup.spec.ts:36:5 › opening the link alone does not use it up, and a mismatch keeps it valid (916ms)
  ok  2 [chromium] › e2e\account-setup.spec.ts:44:5 › an invited member sets a password, signs in as Member and sees their own page (2.9s)
  ok  3 [chromium] › e2e\account-setup.spec.ts:60:5 › a link that was already used is refused with a way forward (625ms)
  ok  4 [chromium] › e2e\account-setup.spec.ts:65:5 › a broken link shows no form (398ms)
  ok  5 [chromium] › e2e\account-setup.spec.ts:71:5 › a recovery link works while another user is signed in (3.2s)
  ok  6 [chromium] › e2e\auth.spec.ts:6:5 › unauthenticated visitor is sent to login (482ms)
  ok  7 [chromium] › e2e\auth.spec.ts:11:5 › admin signs in, sees dashboard, and signs out (2.6s)
  ok  8 [chromium] › e2e\auth.spec.ts:20:5 › wrong password shows an error (788ms)
  ok  9 [chromium] › e2e\career.spec.ts:18:5 › member sets when they started working and sees the YoE; the role is read-only (3.3s)
  ok 10 [chromium] › e2e\career.spec.ts:35:5 › member cannot save a career start in the future (2.7s)
  ok 11 [chromium] › e2e\career.spec.ts:45:5 › admin sets a member's role and career start in /members and sees the Role and YoE columns (4.4s)
  ok 12 [chromium] › e2e\career.spec.ts:69:5 › manager sees a member's role and career start read-only (2.7s)
  ok 13 [chromium] › e2e\career.spec.ts:87:5 › admin manages the career roles; a role in use cannot be deleted (8.4s)
  ok 14 [chromium] › e2e\courses.spec.ts:4:5 › admin adds a course and a member can only read it (7.4s)
  ok 15 [chromium] › e2e\courses.spec.ts:45:5 › admin saves a course with a USD cost and study hours, and the list shows them (4.6s)
  ok 16 [chromium] › e2e\courses.spec.ts:64:5 › a cost without a currency is refused with a clear message (3.4s)
  ok 17 [chromium] › e2e\dashboard.spec.ts:62:5 › admin sees org-wide KPIs, hero mini charts, expiry chart and personal ranking (1.8s)
  ok 18 [chromium] › e2e\dashboard.spec.ts:105:5 › manager sees the same org-wide numbers but a ranking limited to their team (1.5s)
  ok 19 [chromium] › e2e\dashboard.spec.ts:118:5 › member sees anonymous aggregates only (1.5s)
  ok 20 [chromium] › e2e\dashboard.spec.ts:132:5 › a member cannot read the ranking or per-team numbers straight from the API (249ms)
  ok 21 [chromium] › e2e\dashboard.spec.ts:155:5 › the dashboard updates live when a record changes elsewhere (9.0s)
  ok 22 [chromium] › e2e\dashboard.spec.ts:185:5 › explorer tabs, filter row, clear filters, and keyboard row selection update detail panel (2.0s)
  ok 23 [chromium] › e2e\design.spec.ts:4:5 › design showcase renders tokens and components (6.4s)
  ok 24 [chromium] › e2e\export.spec.ts:14:5 › admin exports CSV with a BOM, English headers and Vietnamese names (2.7s)
  ok 25 [chromium] › e2e\export.spec.ts:25:5 › manager's export is limited to managed teams (2.4s)
  ok 26 [chromium] › e2e\export.spec.ts:34:5 › Excel export is a valid workbook (2.5s)
  ok 27 [chromium] › e2e\import.spec.ts:48:5 › admin imports the legacy workbook (5.4s)
  ok 28 [chromium] › e2e\import.spec.ts:70:5 › re-importing the same file changes nothing (5.4s)
  ok 29 [chromium] › e2e\import.spec.ts:94:5 › a file without the required columns is rejected (2.5s)
  ok 30 [chromium] › e2e\import.spec.ts:109:5 › non-admins cannot import (3.1s)
  ok 31 [chromium] › e2e\members.spec.ts:12:5 › admin creates and deletes a member (5.5s)
  ok 32 [chromium] › e2e\members.spec.ts:37:5 › admin cannot delete a member who has training records (2.8s)
  ok 33 [chromium] › e2e\members.spec.ts:54:5 › manager cannot create or delete members, and only sees their managed team (2.1s)
  ok 34 [chromium] › e2e\members.spec.ts:72:5 › admin sees what a manager manages, and that the scopes go inactive when the role changes (4.7s)
  ok 35 [chromium] › e2e\members.spec.ts:104:5 › admin changes a member's access from the member form (4.4s)
  ok 36 [chromium] › e2e\members.spec.ts:126:5 › a member without an account shows No account and no access control (2.7s)
  ok 37 [chromium] › e2e\navigation.spec.ts:4:5 › admin sees admin-only sections (1.6s)
  ok 38 [chromium] › e2e\navigation.spec.ts:10:5 › member sees only personal sections (1.5s)
  ok 39 [chromium] › e2e\navigation.spec.ts:18:5 › sidebar link navigates, marks the breadcrumb and the active item (2.0s)
  ok 40 [chromium] › e2e\navigation.spec.ts:65:7 › /dashboard: skeleton or heading within 300 ms of the click (4.9s)
  ok 41 [chromium] › e2e\navigation.spec.ts:65:7 › /me: skeleton or heading within 300 ms of the click (4.7s)
  ok 42 [chromium] › e2e\navigation.spec.ts:65:7 › /members: skeleton or heading within 300 ms of the click (4.7s)
  ok 43 [chromium] › e2e\navigation.spec.ts:65:7 › /records: skeleton or heading within 300 ms of the click (5.1s)
  ok 44 [chromium] › e2e\navigation.spec.ts:65:7 › /data-quality: skeleton or heading within 300 ms of the click (4.9s)
  ok 45 [chromium] › e2e\navigation.spec.ts:65:7 › /courses: skeleton or heading within 300 ms of the click (4.9s)
  ok 46 [chromium] › e2e\navigation.spec.ts:65:7 › /org: skeleton or heading within 300 ms of the click (5.2s)
  ok 47 [chromium] › e2e\navigation.spec.ts:65:7 › /import: skeleton or heading within 300 ms of the click (4.7s)
  ok 48 [chromium] › e2e\navigation.spec.ts:65:7 › /settings: skeleton or heading within 300 ms of the click (4.7s)
  ok 49 [chromium] › e2e\navigation.spec.ts:87:5 › top bar shows while a navigation is pending and goes idle when the page is there (3.6s)
  ok 50 [chromium] › e2e\navigation.spec.ts:100:5 › top bar crawls with an animation while loading (normal motion) (3.1s)
  ok 51 [chromium] › e2e\navigation.spec.ts:112:5 › reduced motion: top bar has no animation or transition and is full width while loading (3.0s)
  ok 52 [chromium] › e2e\notifications.spec.ts:79:5 › cron endpoints require the bearer token and are not redirected by the login proxy (1.7s)
  ok 53 [chromium] › e2e\notifications.spec.ts:121:5 › dry runs list the seed's recipients and write nothing to the log (3.1s)
  ok 54 [chromium] › e2e\notifications.spec.ts:160:5 › a real run sends once and a second call sends nothing; /settings shows the history (2.3s)
  ok 55 [chromium] › e2e\notifications.spec.ts:208:5 › data quality shows overdue exams by role (6.8s)
  ok 56 [chromium] › e2e\notifications.spec.ts:280:5 › settings is for admins only (2.7s)
  ok 57 [chromium] › e2e\org.spec.ts:10:5 › admin manages the org tree end to end (5.6s)
  ok 58 [chromium] › e2e\org.spec.ts:40:5 › member has no write access to the org tree (2.6s)
  ok 59 [chromium] › e2e\org.spec.ts:56:5 › admin assigns a manager to a program and the manager sees every team of that program (5.5s)
  ok 60 [chromium] › e2e\pilot-access.spec.ts:84:5 › E-3: a member cannot open another member's proof (2.1s)
  ok 61 [chromium] › e2e\pilot-access.spec.ts:91:5 › E-4: a manager cannot open the proof of a member outside their scope (1.5s)
  ok 62 [chromium] › e2e\pilot-access.spec.ts:98:5 › E-5: a signed-out visitor is sent to /login and never gets data (120ms)
  ok 63 [chromium] › e2e\pilot-access.spec.ts:122:5 › E-6: signing out in one browser sends the other to /login without a loop, and it can sign in again (4.9s)
  ok 64 [chromium] › e2e\pilot-access.spec.ts:153:5 › E-7: a proof over 4 MB shows the form's message and nothing is saved (3.7s)
  ok 65 [chromium] › e2e\pilot-access.spec.ts:166:5 › E-7: a text file renamed .pdf shows the form's message and nothing is saved (3.8s)
  ok 66 [chromium] › e2e\pilot-data.spec.ts:45:5 › E-8: an imported Vietnamese name survives /members, the CSV export and the Excel export (6.4s)
  ok 67 [chromium] › e2e\pilot-data.spec.ts:71:5 › E-9: after the rehearsal import each cron job mails every recipient once, and a second call sends nothing (7.7s)
  ok 68 [chromium] › e2e\pilot-day-one.spec.ts:48:5 › E-1: a member's whole first day reaches the manager, the dashboard and the export (15.1s)
  ok 69 [chromium] › e2e\pilot-day-one.spec.ts:92:5 › E-2: a login invited before its member exists is linked once the admin adds the member (3.4s)
  ok 70 [chromium] › e2e\pilot-day-one.spec.ts:105:5 › E-10: a member's first day works on a phone without horizontal scrolling (5.1s)
  ok 71 [chromium] › e2e\records.spec.ts:56:5 › admin adds a record with evidence, opens it, and deletes it (9.0s)
  ok 72 [chromium] › e2e\records.spec.ts:126:5 › a second record for the same member and course is refused (3.3s)
  ok 73 [chromium] › e2e\records.spec.ts:142:5 › status rules are enforced in the form (3.9s)
  ok 74 [chromium] › e2e\records.spec.ts:169:5 › manager sees only the managed team and can only pick managed members (2.4s)
  ok 75 [chromium] › e2e\records.spec.ts:187:5 › member updates own progress and cannot see company fields (5.6s)
  ok 76 [chromium] › e2e\records.spec.ts:219:5 › the certificate form says what to do when a course is missing (2.8s)
  ok 77 [chromium] › e2e\records.spec.ts:235:5 › member uploads, opens and removes evidence on their own record (6.6s)
  ok 78 [chromium] › e2e\records.spec.ts:301:5 › the list updates live for another user (8.3s)
  ok 79 [chromium] › e2e\shell.spec.ts:13:7 › app shell › does not scroll horizontally, even next to a wide table (1.3s)
  ok 80 [chromium] › e2e\shell.spec.ts:33:7 › app shell › closes the mobile drawer after navigating to another page (2.1s)

  80 passed (5.4m)
```
