# CertTracker UI Polish Phase A — Admin Dashboard Implementation Report

**Date:** 2026-11-08  
**Branch:** `feat/implement-admin-dashboard`  
**Base:** `dev`  
**Figma Reference:** Node `5-3815` (`https://www.figma.com/design/l46n1GeFs7BvNrxVCy8NY4/CertTracker?node-id=5-3815`)

---

## 1. Summary of Changes

The Admin Dashboard has been redesigned and implemented according to the owner's Figma design (node `5-3815`), adhering strictly to the CertTracker design system (`docs/design-system.md`), existing Supabase schema/queries, and the patterns established in the finished Member and Manager dashboards:
1. **Architecture & Role Separation**: Created dedicated Admin loader `loadAdminDashboard(user)` running all 10 dashboard queries in a single parallel `Promise.all` wrapped in `settle()`. Routed `role === "admin"` in `src/app/(app)/dashboard/page.tsx` directly to `AdminDashboardView`.
2. **Three-Column Independent Layout**: Responsive 3-column independent grid (`lg:grid-cols-12`: Left `lg:col-span-3`, Center `lg:col-span-6`, Right `lg:col-span-3`). Reordered on mobile (<1024px) so Center leads first (`lg:order-2`), followed by Right (`lg:order-3`), then Left (`lg:order-1`), preventing long scrolls before critical KPI and Explorer data.
3. **KPI & Overview Region (`dl > div`)**: 4 tall hero KPI cards with bare numbers in the first `<dd>` and label in `<dt>`:
   - Card 1: "Valid certificates" in solid brand teal (`bg-primary text-primary-foreground`) with an SVG circular progress ring displaying `{valid} of {completed} completed certificates`.
   - Card 2: "Expiring within 60 days" with amber accent, caption `{n} with 30 days or less`, and embedded accessible "Certificate expiry" region (`role="region"` / `aria-label="Certificate expiry"` with `role="img"` bar and screen reader summary).
   - Card 3: "Expired" with rose accent, overdue count, positive empty state ("All up to date"), and `ChartLoadError` query failure isolation.
   - Card 4: "Waiting for approval" dashed placeholder tile with "—" and a single "Soon" chip.
   - Followed by a compact stat strip for e2e contracts: Active members, Certificates, Completed, In progress.
4. **Real Data Feed in Needs Attention**: No invented mock rows. Dynamically computes overdue expired certificates (most overdue first), certificates expiring within 30 days, and data quality issues from `listIssues()`. Real links to `/records?search=...` and `/data-quality`.
5. **No Mock Data / No Dead Controls**: Scanned and verified by `admin-copy.test.ts`. Consolidated upcoming Phase 2 modules ("Compliance assistant", "Monthly summary", "Risk alerts") into a single honest `ComingSoonCard` with description lines ending in "Not available yet." and zero dead buttons.
6. **E2E Contract Preservation**: All 91 Playwright e2e tests pass with zero regressions.

---

## 2. Figma Block Implementation Matrix

| Figma Block | What Was Built (or Why Omitted) | Evidence / Verification |
|---|---|---|
| **Header Actions** | Built `AdminHeader`: Server greeting in `Asia/Ho_Chi_Minh` ("Good morning, <name>"), "Filters" button with smooth scroll & focus to `#dashboard-filters` (respecting `prefers-reduced-motion`), "Download data" dropdown (`ExportLinks`), and "+ Add certificate" link. | `e2e/dashboard.spec.ts`, `src/features/dashboard/components/admin/admin-header.tsx` |
| **Workspace Ledger / Admin Profile Card** | Built `AdminProfileCard`: Initials avatar, full name (or email if unlinked), "Admin" role badge, tenure / email, and Phase 2 Specialization focus preview card. | `admin-dashboard-view.test.tsx`, `e2e/dashboard.spec.ts` test 31 |
| **Quick Actions Card** | Built `AdminQuickActionsCard`: 4 real actions ("Add certificate" -> `/records`, "Invite member" -> `/members`, "Import Excel" -> `/import`, "Export CSV" -> triggers CSV export). Omitted fake shortcut chips (`⌘N`, `INV`, `XLS`, `CSV`). | `admin-quick-actions-card.tsx`, `admin-copy.test.ts` |
| **KPI Card 1: Valid Certificates** | Built inverted solid-teal highlight card with SVG circular progress ring showing percentage and `{valid} of {completed} completed certificates`. Formatted with `dl > div > dt/dd`. | `e2e/dashboard.spec.ts` test 18, `admin-kpi-cards.tsx` |
| **KPI Card 2: Expiring within 60 days** | Built card with amber accent and embedded accessible "Certificate expiry" region (`role="region"` / `aria-label="Certificate expiry"` with `role="img"` segmented bar and `aria-label` summary). | `e2e/dashboard.spec.ts` test 18, `admin-kpi-cards.tsx` |
| **KPI Card 3: Expired Certificates** | Built card with rose accent, overdue count, and positive empty state ("All up to date" with check icon). Displays `<ChartLoadError />` inside footer if source query fails. | `src/app/(app)/dashboard/page.test.tsx`, `admin-kpi-cards.tsx` |
| **KPI Card 4: Waiting for Approval** | Built dashed placeholder tile with "—" and a single "Soon" chip. | `admin-kpi-cards.tsx`, `admin-copy.test.ts` |
| **Stat Strip** | Built compact strip for Active members, Certificates, Completed, In progress (`dl > div > dt/dd`). | `e2e/dashboard.spec.ts` test 18 |
| **Tab Strip** | Built `AdminTabStrip`: View switcher with active `Overview` tab and disabled upcoming tabs `Approvals`, `Goals`, `Skills` with single "Soon" chips. | `admin-tab-strip.tsx`, `admin-dashboard-view.test.tsx` |
| **Explorer & Ranking Table** | Reused existing modular `Explorer` (`By team`, `By provider` regions with client-side filter bar `#dashboard-filters`, master list, and detail panel) and `RankingTable` (`Individual ranking` region). | `e2e/dashboard.spec.ts` test 18, test 28 |
| **Needs Attention** | Built `AdminNeedsAttention` with real live seed data: overdue expired certificates (most overdue first with days overdue), urgent expiring certificates (<= 30 days), and data quality issue count. Real links to `/records?search=...` and `/data-quality`. | `e2e/dashboard.spec.ts` test 29, `admin-metrics.test.ts` |
| **Compliance Assistant, Monthly Summary, Risk Alerts** | Merged into a single honest `ComingSoonCard` titled "Compliance assistant and insights". Previews all 3 features with description ending in "Not available yet." Zero dead buttons or textboxes. | `e2e/dashboard.spec.ts` test 30, `admin-coming-soon-card.tsx` |

---

## 3. List of Figma Elements Removed (Not Real)

The following elements from the Figma design were deliberately excluded because they are not backed by real application data, functionality, or the CertTracker design system:

1. **Header Date Range / Period Selector**: (e.g., "Q1 2024", "This Month", "Last 30 days" dropdown). Removed because CertTracker presents live real-time database state; artificial date slicing does not exist in the backend.
2. **Keyboard Shortcut Badges on Quick Actions**: (`⌘N`, `INV`, `XLS`, `CSV`). Removed because web browsers do not have these hotkeys bound; fake shortcut badges mislead users.
3. **Fake Audit Hash / Cryptographic Ledger String**: (`"Audit Hash #0E5C-TC9"`). Removed because CertTracker is a relational application, not a blockchain ledger.
4. **Hardcoded Lead Auditor / Department Code**: (`"Lead: Minh Pham"`, `"Lead Auditor"`, `"DC34"`, `"AUDIT READY"`). Removed; replaced with the real logged-in admin email/name and "System administrator" title.
5. **Fake Compliance & Policy Badges**: (`"Legal Expiration Guard"`, `"Audit ready: SOC2 Type II"`, `"ISO 27001"`). Removed because no compliance auditing backend exists.
6. **Fake Attention Feed Items & Action Buttons**: (`"HRIS sync error"`, `"4 pending proofs"`, `"Review submissions"`, `"Send reminder"` buttons). Replaced with real dynamic feed items calculated from seed records and data quality checks.
7. **Dead Interactive Controls in Coming Soon Cards**: Fake buttons ("Generate report", "Ask AI") and search/input fields inside upcoming modules were removed in favor of a static, honest `ComingSoonCard`.
8. **Fake Delta / Growth Percentages**: (e.g., `+14% vs last month`, `▲ 8.2%`). Removed because there is no snapshot history backend.

---

## 4. E2E Assertions Changed

### 4.1 `e2e/auth.spec.ts`
- **Location:** Line 13
- **Old:** `await expect(page.getByText("Admin", { exact: true })).toBeVisible();`
- **New:** `await expect(page.getByText("Admin", { exact: true }).first()).toBeVisible();`
- **Reason:** In `AdminProfileCard`, the user's role is displayed with a `<RoleBadge role="admin" />` which renders the text "Admin". The header user menu button also renders "Admin". Adding `.first()` resolves Playwright strict-mode locator ambiguity while preserving the authentication assertion.

### 4.2 New Tests Added to `e2e/dashboard.spec.ts`
1. `admin Needs attention lists only real items computed from seed data`:
   - Verifies An's urgent certificate expiring in ~25 days is listed with course and days left.
   - Verifies real data quality issues summary is listed with singular/plural grammar ("1 issue requires attention").
   - Asserts absence of fake Figma strings: `"Send reminder"`, `"HRIS sync"`, `"Review submissions"`, `"4 pending proofs"`, `"Minh Pham"`, `"PMP"`.
2. `admin merged Coming soon card has no interactive controls`:
   - Verifies section `"Compliance assistant and insights (Coming soon)"` is rendered.
   - Verifies 3 preview items each end with `"Not available yet."`.
   - Asserts 0 buttons and 0 textboxes inside the card (`toHaveCount(0)`).
3. `admin profile card renders correctly for admin without a member record`:
   - Verifies section `"Workspace ledger"` renders `admin@certtracker.test` and role badge `"Admin"`.
   - Verifies title falls back to `"System administrator"` when no member record exists (and never renders `"Role not set"`).
   - Asserts absence of fake Figma badges (`"DC34"`, `"Lead Auditor"`, `"AUDIT READY"`).

---

## 5. Measured Column Heights at 1440px Viewport

Measured via Playwright (`e2e/column-heights.spec.ts`) with viewport 1440x900:

| Measurement | Left Column | Center Column | Right Column | Difference |
|---|---|---|---|---|
| **Grid Item Height (Stretched)** | `1474.0px` | `1474.0px` | `1474.0px` | `0.0px` |
| **Inner Content Height** | `697.0px` | `1474.0px` | `618.0px` | `856.0px` |

### Plain Explanation:
- In CSS Grid (`lg:grid-cols-12`), all column containers stretch to the full row height (`1474.0px`).
- The actual content height inside each column differs:
  - **Center Column (`1474.0px`)**: Contains the 4 tall hero KPI cards, the stat strip, the tab strip, the filter row, the full Master-Detail Explorer (tabs, master list, and detail panel), and the organization-wide Individual Ranking table.
  - **Left Column (`697.0px`)**: Contains the Workspace Ledger / Profile card, Quick Actions card, and Scope Summary.
  - **Right Column (`618.0px`)**: Contains the Needs Attention card and the consolidated Coming Soon card.
- The difference between the tallest inner content (Center: 1474.0px) and shortest (Right: 618.0px) is **856.0px**. This difference is expected and natural: the Center column is the primary analytical workspace holding two full master-detail datasets, whereas Left and Right serve as auxiliary context and feed columns.

---

## 6. Raw Verification Terminal Outputs

### 6.1 ESLint (`pnpm lint`)
```
$ pnpm lint

> certtracker@0.1.0 lint D:\Fullstack\CertTracker
> eslint

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

### 6.2 TypeScript Typecheck (`pnpm typecheck`)
```
$ pnpm typecheck

> certtracker@0.1.0 typecheck D:\Fullstack\CertTracker
> tsc --noEmit

Exit code: 0
```

### 6.3 Vitest Suite (`pnpm test`)
```
$ pnpm test

> certtracker@0.1.0 test D:\Fullstack\CertTracker
> vitest run

 RUN  v5.0.2 D:/Fullstack/CertTracker

 ✓ src/lib/process-docs.test.ts (102 tests) 132ms
 ✓ src/features/dashboard/metrics.test.ts (28 tests) 234ms
 ✓ src/lib/supabase/auth-round-trips.test.ts (30 tests) 205ms
 ✓ src/lib/english-ui.test.ts (1 test) 123ms
 ✓ src/features/export/records-export.test.ts (14 tests) 137ms
 ✓ src/features/import/sample-workbook.test.ts (15 tests) 323ms
 ✓ src/features/notifications/emails.test.ts (5 tests) 268ms
 ✓ src/features/notifications/run.test.ts (11 tests) 333ms
 ✓ src/features/import/plan.test.ts (42 tests) 137ms
 ✓ src/features/dashboard/components/member/member-kpi-cards.test.tsx (4 tests) 67ms
 ✓ src/features/dashboard/components/manager/manager-copy.test.ts (5 tests) 125ms
 ✓ src/features/notifications/handler.test.ts (23 tests) 695ms
 ✓ src/features/dashboard/components/member/member-cards.test.tsx (20 tests) 124ms
 ✓ src/lib/email/templates/templates.test.ts (22 tests) 1010ms
 ✓ src/lib/email/sender.test.ts (9 tests) 97ms
 ✓ src/features/dashboard/components/member/member-attention-banner.test.tsx (4 tests) 56ms
 ✓ src/lib/money.test.ts (8 tests) 11ms
 ✓ src/lib/assert-local-supabase-url.test.ts (18 tests) 13ms
 ✓ src/components/status/coming-soon-card.test.tsx (2 tests) 54ms
 ✓ src/features/auth/actions.test.ts (4 tests) 60ms
 ✓ src/app/api/export/records/route.test.ts (3 tests) 60ms
 ✓ src/features/dashboard/manager-metrics.test.ts (15 tests) 24ms
 ✓ src/features/notifications/monthly-plan.test.ts (25 tests) 26ms
 ✓ src/lib/utils.test.ts (2 tests) 39ms
 ✓ src/features/dashboard/components/admin/admin-copy.test.ts (4 tests) 45ms
 ✓ src/features/dashboard/member-metrics.test.ts (54 tests) 28ms
 ✓ src/features/notifications/runs.test.ts (15 tests) 32ms
 ✓ src/features/dashboard/dashboard-error.test.tsx (2 tests) 120ms
 ✓ src/features/notifications/deliver.test.ts (21 tests) 27ms
 ✓ src/features/notifications/expiry-plan.test.ts (34 tests) 29ms
 ✓ src/app/(app)/loading-files.test.ts (11 tests) 13ms
 ✓ src/features/import/clean.test.ts (55 tests) 31ms
 ✓ src/features/dashboard/schema.test.ts (6 tests) 23ms
 ✓ src/app/tokens.test.ts (75 tests) 17ms
 ✓ src/features/import/schema.test.ts (5 tests) 20ms
 ✓ src/features/records/schema.test.ts (10 tests) 23ms
 ✓ src/features/dashboard/components/explorer/master-list.test.tsx (7 tests) 15ms
 ✓ src/features/auth/schema.test.ts (11 tests) 22ms
 ✓ src/features/members/schema.test.ts (11 tests) 17ms
 ✓ src/features/dashboard/components/manager/manager-cards.test.tsx (22 tests) 168ms
 ✓ src/features/notifications/period.test.ts (15 tests) 18ms
 ✓ src/features/dashboard/components/member/member-certificates-list.test.tsx (12 tests) 47ms
 ✓ src/lib/email/resend-sender.test.ts (9 tests) 17ms
 ✓ src/lib/supabase/fetch-all.test.ts (6 tests) 13ms
 ✓ src/features/career/schema.test.ts (13 tests) 18ms
 ✓ src/features/courses/schema.test.ts (9 tests) 20ms
 ✓ src/features/organizations/schema.test.ts (8 tests) 16ms
 ✓ src/features/data-quality/schema.test.ts (4 tests) 15ms
 ✓ src/features/import/run-batch-action.test.ts (5 tests) 14ms
 ✓ src/components/app-shell/logo.test.ts (3 tests) 12ms
 ✓ src/features/notifications/vercel-cron.test.ts (4 tests) 11ms
 ✓ src/features/import/cleanup.test.ts (4 tests) 12ms
 ✓ src/features/import/stored.test.ts (8 tests) 13ms
 ✓ src/lib/storage/supabase-storage.test.ts (1 test) 8ms
 ✓ src/features/dashboard/components/manager/manager-dashboard-view.test.tsx (12 tests) 548ms
 ✓ src/features/dashboard/components/copy.test.tsx (25 tests) 318ms
 ✓ src/components/status/expiry.test.ts (8 tests) 11ms
 ✓ src/lib/ui-copy.test.ts (6 tests) 28ms
 ✓ src/features/import/preview.test.ts (7 tests) 10ms
 ✓ src/lib/format.test.ts (6 tests) 10ms
 ✓ src/features/notifications/cron-auth.test.ts (11 tests) 10ms
 ✓ src/features/dashboard/settle.test.ts (2 tests) 9ms
 ✓ src/features/data-quality/issues.test.ts (6 tests) 9ms
 ✓ src/lib/postgres-error.test.ts (7 tests) 8ms
 ✓ src/features/members/actions.test.ts (3 tests) 11ms
 ✓ src/lib/dates.test.ts (7 tests) 8ms
 ✓ src/features/dashboard/view-model.test.ts (4 tests) 8ms
 ✓ src/components/app-shell/nav.test.ts (5 tests) 9ms
 ✓ src/lib/email/theme.test.ts (13 tests) 8ms
 ✓ src/lib/plural.test.ts (8 tests) 9ms
 ✓ src/lib/design/contrast.test.ts (3 tests) 7ms
 ✓ src/features/dashboard/components/admin/admin-dashboard-view.test.tsx (4 tests) 395ms
 ✓ src/features/career/format.test.ts (7 tests) 8ms
 ✓ src/features/import/commit-error.test.ts (8 tests) 9ms
 ✓ src/features/notifications/app-url.test.ts (4 tests) 8ms
 ✓ src/lib/storage/evidence.test.ts (4 tests) 7ms
 ✓ src/features/dashboard/admin-metrics.test.ts (14 tests) 15ms
 ✓ src/features/dashboard/components/explorer/types.test.ts (9 tests) 7ms
 ✓ src/lib/text.test.ts (3 tests) 6ms
 ✓ src/lib/assert-affected.test.ts (3 tests) 6ms
 ✓ src/components/data/pagination.test.ts (2 tests) 5ms
 ✓ src/features/export/csv.test.ts (3 tests) 4ms
 ✓ src/lib/cron-path.test.ts (1 test) 3ms
 ✓ src/components/status/labels.test.ts (4 tests) 4ms
 ✓ src/app/(app)/dashboard/page.test.tsx (6 tests) 216ms
 ✓ src/features/import/workbook.test.ts (35 tests) 7977ms

 Test Files  86 passed (86)
      Tests  1096 passed (1096)
   Start at  16:08:35
   Duration  9.00s (import 66%, tests 20%, transform 12%, worker 1%)
```

### 6.4 Next.js Production Build (`pnpm build`)
```
$ pnpm build

> certtracker@0.1.0 build D:\Fullstack\CertTracker
> next build

▲ Next.js 16.3.6 (Turbopack)
- Environments: .env.local
✓ Running next.config.ts took 60ms
- Experiments (use with caution):
  · serverActions

  Creating an optimized production build ...
✓ Compiled successfully in 1788ms
  Running TypeScript ...
  Finished TypeScript in 4.4s ...
  Collecting page data using 15 workers ...
  Generating static pages using 15 workers (0/19) ...
  Generating static pages using 15 workers (4/19) 
  Generating static pages using 15 workers (9/19) 
  Generating static pages using 15 workers (14/19) 
✓ Generating static pages using 15 workers (19/19) in 743ms
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
```

### 6.5 Full Playwright Test Suite (`pnpm exec playwright test` on port 3200)
```
$ cmd /c "set PLAYWRIGHT_BASE_URL=http://localhost:3200 && pnpm exec playwright test"

Running 91 tests using 1 worker

  ok  1 [chromium] › e2e\account-setup.spec.ts:36:5 › opening the link alone does not use it up, and a mismatch keeps it valid (548ms)
  ok  2 [chromium] › e2e\account-setup.spec.ts:44:5 › an invited member sets a password, signs in as Member and sees their own page (2.6s)
  ok  3 [chromium] › e2e\account-setup.spec.ts:60:5 › a link that was already used is refused with a way forward (523ms)
  ok  4 [chromium] › e2e\account-setup.spec.ts:65:5 › a broken link shows no form (310ms)
  ok  5 [chromium] › e2e\account-setup.spec.ts:71:5 › a recovery link works while another user is signed in (2.4s)
  ok  6 [chromium] › e2e\auth.spec.ts:6:5 › unauthenticated visitor is sent to login (476ms)
  ok  7 [chromium] › e2e\auth.spec.ts:11:5 › admin signs in, sees dashboard, and signs out (1.8s)
  ok  8 [chromium] › e2e\auth.spec.ts:20:5 › wrong password shows an error (520ms)
  ok  9 [chromium] › e2e\career.spec.ts:18:5 › member sets when they started working and sees the YoE; the role is read-only (2.4s)
  ok 10 [chromium] › e2e\career.spec.ts:35:5 › member cannot save a career start in the future (2.0s)
  ok 11 [chromium] › e2e\career.spec.ts:45:5 › admin sets a member's role and career start in /members and sees the Role and YoE columns (3.2s)
  ok 12 [chromium] › e2e\career.spec.ts:69:5 › manager sees a member's role and career start read-only (2.1s)
  ok 13 [chromium] › e2e\career.spec.ts:87:5 › admin manages the career roles; a role in use cannot be deleted (6.2s)
MEASURED CONTENT COLUMN HEIGHTS AT 1440px:
Left Column Content: 697.0px
Center Column Content: 1474.0px
Right Column Content: 618.0px
Height Difference (Max - Min): 856.0px
  ok 14 [chromium] › e2e\column-heights.spec.ts:4:5 › measure column heights at 1440px (2.3s)
  ok 15 [chromium] › e2e\courses.spec.ts:4:5 › admin adds a course and a member can only read it (5.0s)
  ok 16 [chromium] › e2e\courses.spec.ts:45:5 › admin saves a course with a USD cost and study hours, and the list shows them (4.3s)
  ok 17 [chromium] › e2e\courses.spec.ts:64:5 › a cost without a currency is refused with a clear message (2.8s)
  ok 18 [chromium] › e2e\dashboard.spec.ts:64:5 › admin sees org-wide KPIs, hero mini charts, expiry chart and personal ranking (1.3s)
  ok 19 [chromium] › e2e\dashboard.spec.ts:111:5 › manager sees team-scoped numbers and no separate ranking (1.3s)
  ok 20 [chromium] › e2e\dashboard.spec.ts:133:5 › manager next-to-expire displays urgent renewals ordered soonest first (1.3s)
  ok 21 [chromium] › e2e\dashboard.spec.ts:148:5 › manager team readiness list displays member status breakdown numbers (1.2s)
  ok 22 [chromium] › e2e\dashboard.spec.ts:161:5 › manager sees later modules once, as disabled tabs and one Coming soon card, with no mock data (1.3s)
  ok 23 [chromium] › e2e\dashboard.spec.ts:209:5 › a manager with no teams sees the empty state (1.5s)
  ok 24 [chromium] › e2e\dashboard.spec.ts:227:5 › member sees anonymous aggregates only (1.3s)
  ok 25 [chromium] › e2e\dashboard.spec.ts:281:5 › unlinked member account shows guidance empty state on dashboard (2.4s)
  ok 26 [chromium] › e2e\dashboard.spec.ts:293:5 › a member cannot read the ranking or per-team numbers straight from the API (184ms)
  ok 27 [chromium] › e2e\dashboard.spec.ts:316:5 › the dashboard updates live when a record changes elsewhere (7.6s)
  ok 28 [chromium] › e2e\dashboard.spec.ts:346:5 › explorer tabs, filter row, clear filters, and keyboard row selection update detail panel (1.5s)
  ok 29 [chromium] › e2e\dashboard.spec.ts:387:5 › admin Needs attention lists only real items computed from seed data (1.3s)
  ok 30 [chromium] › e2e\dashboard.spec.ts:407:5 › admin merged Coming soon card has no interactive controls (1.3s)
  ok 31 [chromium] › e2e\dashboard.spec.ts:425:5 › admin profile card renders correctly for admin without a member record (1.3s)
  ok 32 [chromium] › e2e\design.spec.ts:4:5 › design showcase renders tokens and components (2.4s)
  ok 33 [chromium] › e2e\export.spec.ts:14:5 › admin exports CSV with a BOM, English headers and Vietnamese names (2.0s)
  ok 34 [chromium] › e2e\export.spec.ts:25:5 › manager's export is limited to managed teams (2.1s)
  ok 35 [chromium] › e2e\export.spec.ts:34:5 › Excel export is a valid workbook (2.0s)
  ok 36 [chromium] › e2e\import.spec.ts:48:5 › admin imports the legacy workbook (3.6s)
  ok 37 [chromium] › e2e\import.spec.ts:70:5 › re-importing the same file changes nothing (3.4s)
  ok 38 [chromium] › e2e\import.spec.ts:94:5 › a file without the required columns is rejected (1.9s)
  ok 39 [chromium] › e2e\import.spec.ts:109:5 › non-admins cannot import (2.0s)
  ok 40 [chromium] › e2e\members.spec.ts:12:5 › admin creates and deletes a member (4.0s)
  ok 41 [chromium] › e2e\members.spec.ts:37:5 › admin cannot delete a member who has training records (2.5s)
  ok 42 [chromium] › e2e\members.spec.ts:54:5 › manager cannot create or delete members, and only sees their managed team (1.7s)
  ok 43 [chromium] › e2e\members.spec.ts:72:5 › admin sees what a manager manages, and that the scopes go inactive when the role changes (3.9s)
  ok 44 [chromium] › e2e\members.spec.ts:104:5 › admin changes a member's access from the member form (4.0s)
  ok 45 [chromium] › e2e\members.spec.ts:126:5 › a member without an account shows No account and no access control (2.2s)
  ok 46 [chromium] › e2e\navigation.spec.ts:4:5 › admin sees admin-only sections (1.2s)
  ok 47 [chromium] › e2e\navigation.spec.ts:10:5 › member sees only personal sections (1.3s)
  ok 48 [chromium] › e2e\navigation.spec.ts:18:5 › sidebar link navigates, marks the breadcrumb and the active item (1.8s)
  ok 49 [chromium] › e2e\navigation.spec.ts:65:7 › /dashboard: skeleton or heading within 300 ms of the click (4.4s)
  ok 50 [chromium] › e2e\navigation.spec.ts:65:7 › /me: skeleton or heading within 300 ms of the click (5.0s)
  ok 51 [chromium] › e2e\navigation.spec.ts:65:7 › /members: skeleton or heading within 300 ms of the click (4.4s)
  ok 52 [chromium] › e2e\navigation.spec.ts:65:7 › /records: skeleton or heading within 300 ms of the click (4.4s)
  ok 53 [chromium] › e2e\navigation.spec.ts:65:7 › /data-quality: skeleton or heading within 300 ms of the click (4.4s)
  ok 54 [chromium] › e2e\navigation.spec.ts:65:7 › /courses: skeleton or heading within 300 ms of the click (4.3s)
  ok 55 [chromium] › e2e\navigation.spec.ts:65:7 › /org: skeleton or heading within 300 ms of the click (4.4s)
  ok 56 [chromium] › e2e\navigation.spec.ts:65:7 › /import: skeleton or heading within 300 ms of the click (4.3s)
  ok 57 [chromium] › e2e\navigation.spec.ts:65:7 › /settings: skeleton or heading within 300 ms of the click (4.3s)
  ok 58 [chromium] › e2e\navigation.spec.ts:87:5 › top bar shows while a navigation is pending and goes idle when the page is there (2.7s)
  ok 59 [chromium] › e2e\navigation.spec.ts:100:5 › top bar crawls with an animation while loading (normal motion) (2.8s)
  ok 60 [chromium] › e2e\navigation.spec.ts:112:5 › reduced motion: top bar has no animation or transition and is full width while loading (2.8s)
  ok 61 [chromium] › e2e\notifications.spec.ts:79:5 › cron endpoints require the bearer token and are not redirected by the login proxy (1.3s)
  ok 62 [chromium] › e2e\notifications.spec.ts:121:5 › dry runs list the seed's recipients and write nothing to the log (2.2s)
  ok 63 [chromium] › e2e\notifications.spec.ts:160:5 › a real run sends once and a second call sends nothing; /settings shows the history (1.9s)
  ok 64 [chromium] › e2e\notifications.spec.ts:208:5 › data quality shows overdue exams by role (5.2s)
  ok 65 [chromium] › e2e\notifications.spec.ts:280:5 › settings is for admins only (2.0s)
  ok 66 [chromium] › e2e\org.spec.ts:10:5 › admin manages the org tree end to end (4.7s)
  ok 67 [chromium] › e2e\org.spec.ts:40:5 › member has no write access to the org tree (2.0s)
  ok 68 [chromium] › e2e\org.spec.ts:56:5 › admin assigns a manager to a program and the manager sees every team of that program (4.5s)
  ok 69 [chromium] › e2e\pilot-access.spec.ts:84:5 › E-3: a member cannot open another member's proof (1.4s)
  ok 70 [chromium] › e2e\pilot-access.spec.ts:91:5 › E-4: a manager cannot open the proof of a member outside their scope (1.4s)
  ok 71 [chromium] › e2e\pilot-access.spec.ts:98:5 › E-5: a signed-out visitor is sent to /login and never gets data (100ms)
  ok 72 [chromium] › e2e\pilot-access.spec.ts:122:5 › E-6: signing out in one browser sends the other to /login without a loop, and it can sign in again (4.4s)
  ok 73 [chromium] › e2e\pilot-access.spec.ts:153:5 › E-7: a proof over 4 MB shows the form's message and nothing is saved (3.3s)
  ok 74 [chromium] › e2e\pilot-access.spec.ts:166:5 › E-7: a text file renamed .pdf shows the form's message and nothing is saved (3.0s)
  ok 75 [chromium] › e2e\pilot-data.spec.ts:45:5 › E-8: an imported Vietnamese name survives /members, the CSV export and the Excel export (5.2s)
  ok 76 [chromium] › e2e\pilot-data.spec.ts:71:5 › E-9: after the rehearsal import each cron job mails every recipient once, and a second call sends nothing (4.8s)
  ok 77 [chromium] › e2e\pilot-day-one.spec.ts:48:5 › E-1: a member's whole first day reaches the manager, the dashboard and the export (14.0s)
  ok 78 [chromium] › e2e\pilot-day-one.spec.ts:92:5 › E-2: a login invited before its member exists is linked once the admin adds the member (3.0s)
  ok 79 [chromium] › e2e\pilot-day-one.spec.ts:105:5 › E-10: a member's first day works on a phone without horizontal scrolling (4.6s)
  ok 80 [chromium] › e2e\records.spec.ts:56:5 › admin adds a record with evidence, opens it, and deletes it (7.3s)
  ok 81 [chromium] › e2e\records.spec.ts:126:5 › a second record for the same member and course is refused (2.7s)
  ok 82 [chromium] › e2e\records.spec.ts:142:5 › status rules are enforced in the form (3.5s)
  ok 83 [chromium] › e2e\records.spec.ts:169:5 › manager sees only the managed team and can only pick managed members (2.2s)
  ok 84 [chromium] › e2e\records.spec.ts:187:5 › /records?search=<member> opens the admin's list already searched (1.6s)
  ok 85 [chromium] › e2e\records.spec.ts:197:5 › /records?search=<member> opens the manager's list already searched (1.6s)
  ok 86 [chromium] › e2e\records.spec.ts:204:5 › member updates own progress and cannot see company fields (4.8s)
  ok 87 [chromium] › e2e\records.spec.ts:236:5 › the certificate form says what to do when a course is missing (2.3s)
  ok 88 [chromium] › e2e\records.spec.ts:252:5 › member uploads, opens and removes evidence on their own record (6.1s)
  ok 89 [chromium] › e2e\records.spec.ts:318:5 › the list updates live for another user (7.3s)
  ok 90 [chromium] › e2e\shell.spec.ts:13:7 › app shell › does not scroll horizontally, even next to a wide table (1.2s)
  ok 91 [chromium] › e2e\shell.spec.ts:33:7 › app shell › closes the mobile drawer after navigating to another page (2.0s)

  91 passed (4.6m)
```
