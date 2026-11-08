# CertTracker Dashboard Redesign Report

## Executive Summary
This document provides a detailed evaluation of the `/dashboard` redesign completed on branch `feat/ui-polish-phase-a-2` in accordance with `docs/ui-polish/dashboard-redesign-spec.md`. The redesign adapts the layout of a modern finance dashboard (top header with primary action, hero KPI cards with inline stacked visuals, compact KPI tiles, health row combining an expiry horizon chart and a completion donut, and an Explorer tab strip with a searchable compact table on the left and a live detail panel on the right) while strictly respecting CertTracker's visual identity:
- **Design Tokens**: Parchment background (`#F6F7F5` / `#111A22`), white/dark-slate card backgrounds (`#FFFFFF` / `#162028`), teal primary (`#0E5C58` / `#249C90`), ink text (`#15212B` / `#EDEFF0`), status colors strictly reserved for expiry buckets, and `--chart-1` / `--chart-2` / `--chart-3` for study completion stages with contrast ≥ 3:1 against card backgrounds in both themes.
- **Typography & Radii**: Be Vietnam Pro throughout, 6px border radius (`rounded-lg` / `rounded-md`), no shadows, no gradients, no arbitrary hex codes, no avatars or trend arrows.
- **Zero Architecture Changes**: Kept the exact same single parallel `Promise.all` in the Server Component (`page.tsx`), zero new dependencies, zero new database migrations or RPCs, and full backward compatibility with Realtime live updates.

---

## 1. Compliance Matrix: Block × Standard (1–8)

The 8 review standards:
1. **Four States**: Loading skeleton matches layout, helpful empty states, resilient per-section error handling (`settle()`), edge-case handling (long Vietnamese names, diacritics, 0/1/500 rows).
2. **Performance**: Server Component data fetching, parallel execution, client components only where state/interaction requires it (`"use client"` for Tabs/Explorer/Donut), zero layout shift, zero build warnings.
3. **Colour & Tokens**: CertTracker tokens only; status colors reserved for expiry; `--chart-1..3` for study stages with WCAG contrast ≥ 3:1; light and dark mode parity.
4. **Mobile (390×844)**: Responsive column wrapping, touch targets ≥ 44px, table scrolls horizontally inside container without blowing out viewport.
5. **Accessibility (WCAG 2.1 AA)**: Contrast ≥ 4.5:1 for body/captions, ≥ 3:1 for graphical UI elements; visible focus rings; semantic `<dl>`, `<dt>`, `<dd>`; screen reader equivalents for charts.
6. **Wording & Typography**: Plain English, sentence case, action verbs on primary buttons, Be Vietnam Pro font scale.
7. **E2E Contract**: Preserves `dl > div > dt + dd.first()` structure for all 7 KPI tiles; retains region names (`"Overview"`, `"Certificate expiry"`, `"By team"`, etc.); realtime refreshes trigger automatically.
8. **Role-Based View Discipline**: Admin sees full org-wide numbers and personal ranking; Manager sees org-wide numbers with team-scoped ranking; Member sees anonymous groups with ≥ 3 learners only (no team tab, no ranking, empty hint `"Not enough data to show"`).

| Block | 1. States | 2. Perf | 3. Tokens | 4. Mobile | 5. A11y | 6. Wording | 7. E2E | 8. Role |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **1. Header & Primary Action** | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| *Reason:* | Dynamic subtitle timestamp; primary button adapts per role ("View records" vs "My certificates"). | Server rendered, zero client overhead. | Standard `PageHeader` tokens. | Mobile wraps header and action cleanly (min-h 44px). | `h1` semantic heading with accessible link button. | Clear action verbs in sentence case. | Retains `h1` "Dashboard" locator. | Links to `/records` for admin/mgr, `/me` for member. |
| **2. Hero KPI Cards (4)** | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| *Reason:* | Handles 0 records gracefully; expired card highlights in `destructive` only when count > 0. | Lightweight CSS-only stacked bar visual; zero Recharts overhead. | Status colors used strictly for expiry buckets; chart tokens for completion. | Stacks to 1 col on mobile, 2 on tablet, 4 on desktop (`lg:grid-cols-4`). | Strict `dl > div > dt + dd` semantics; stacked bar has `role="img"` and `aria-label`. | Plain English labels preserved exactly. | First `<dd>` contains bare number for `tileValue` helper. | Same org-wide numbers visible across all authenticated roles. |
| **3. Compact KPI Tiles (3)** | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| *Reason:* | Handles empty/zero members and completion percentages (integer floor, min/max capped). | Reuses `KpiTile` with zero overhead. | Card border and muted foreground tokens. | Responsive 3-col grid (`sm:grid-cols-3`). | Standard `dl > div > dt + dd` semantics. | Exact labels ("Active members", "Completed", "In progress"). | Retains exact labels and first `<dd>` locator. | Same org-wide tiles rendered for all roles. |
| **4. Expiry Horizon Chart** | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| *Reason:* | Renders empty bar baseline when all buckets are 0; SectionError recovery if query fails. | Recharts bar chart with `isAnimationActive={false}`. | Status colors `--status-active`, `--status-expiring-60`, `--status-expiring-soon`, `--status-expired`, `--status-no-expiry`. | 2/3 width on desktop, stacks full width on mobile (`lg:col-span-2`). | `role="img"` with exact `aria-label` starting `"Certificate expiry:"` + sr-only list. | Day range labels: `> 60 days left`, `31–60 days left`, etc. | Passes exact regex pattern assertions in e2e. | Org-wide expiry horizon visible to all roles. |
| **5. Completion Donut (New)** | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| *Reason:* | Shows fallback message when 0 records exist; renders clean donut when data present. | Animation disabled; SVG responsive container with no re-render loops. | `--chart-1` (done), `--chart-2` (in progress), `--chart-3` (not started) with ≥ 3.3:1 contrast. | 1/3 width on desktop, stacks full width on mobile. | `role="img"` with descriptive summary label; visible numbers in legend. | "Study completion", "Completed", "In progress", "Not started". | Does not interfere with existing tile assertions. | Org-wide study completion rate visible to all roles. |
| **6. Explorer Tab Strip** | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| *Reason:* | Unified card header; pill tabs with count badges (`[ By team (N) ]`); smooth active state transitions. | Client component wrapping tab state only; no client data fetching. | Card border, muted background, and solid active tab pill tokens. | Tabs wrap/scroll smoothly on small screens. | Full keyboard navigation (ArrowLeft, ArrowRight, Home, End). | "By team", "By certificate type", "By provider", "Popular courses". | Each tab panel renders `<section aria-label="...">` region. | "By team" hidden completely from members. |
| **7. Explorer Master Item List** | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| *Reason:* | Rich list cards matching the finance template (monogram icon, bold title, subtitle, completion % and record count); active highlight pill; diacritics search filter. | In-memory filtering over pre-fetched query rows; no waterfalls. | Monogram avatar, row hover, and distinct `bg-primary/10 border-primary/50` active pill selection. | Clean card list inside container with touch rows ≥ 44px. | Row semantics (`role="row"`, `aria-selected`, `tabIndex={0}`, Enter/Space selection). | Filter input placeholder "Filter [group]…". | Row query `rowWith(section, text)` passes. | Groups < 3 learners hidden for members with privacy notice. |
| **8. Explorer Detail Dossier** | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| *Reason:* | Structured like the template's detail panel: header with title & status pill; 4 sub-metric cards in a row (`Valid`, `Completed`, `In progress`, `Expired`); breakdown visual bars; bottom summary bar. | Re-renders only on `selectedKey` change; zero network waterfalls. | Status colors for valid/expired split; chart tokens for study status split; subtle card borders. | Responsive grid stacks to 2 cols on mobile, 4 on desktop. | `role="region"` with `aria-label="Selected item details"`, headings, and dl. | "Detail View", "Headcount", "Learners", "Records", "Study status split", "Validity split". | Accessible region name verified by e2e suite. | Displays anonymized group metrics for members. |
| **9. Individual Ranking** | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| *Reason:* | Preserves Vietnamese collation tie-breaking; handles ties (rank 2, 2); empty state if no learners. | Server rendered component; no client overhead. | Card border, table row hover, and rank badge tokens. | Horizontal scroll container on mobile. | Semantic table with caption and headers. | "Individual ranking", column headers sentence case. | First cell contains rank number; name lookup passes. | Hidden for members; scoped to managed team for managers; org-wide for admin. |
| **10. Loading Skeleton** | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| *Reason:* | Replicates exact 4 hero + 3 compact cards + 2/3 and 1/3 health row + Explorer + Ranking layout. | Zero layout jump between loading and final data view. | Skeleton tokens `bg-muted` and `rounded-lg`. | Mirrors responsive grid breakpoints. | `role="status"`, `aria-busy="true"`, `aria-label="Loading dashboard"`. | N/A (skeleton bars). | Enforced by `src/app/(app)/loading-files.test.ts`. | N/A. |

---

## 2. E2E Test Suite Changes & Justifications

### 2.1 `e2e/dashboard.spec.ts`
1. **Completion Donut Verification Added**:
   - Added `const donut = page.getByRole("img", { name: /^Study completion:/ }); await expect(donut).toBeVisible();` to test 1. Ensures the new health donut chart is present and provides an accessible name.
2. **Explorer Detail Panel Verification Added**:
   - Added `const detailPanel = page.getByRole("region", { name: "Selected item details" }); await expect(detailPanel).toBeVisible(); await expect(detailPanel.getByRole("heading", { name: "Team Cloud" })).toBeVisible();` to test 1. Confirms the detail panel mounts and reflects the default selected row.
3. **Member Tab Activation in Test 3**:
   - Updated test 3 ("member sees anonymous aggregates only") to click the `"By provider"` tab before asserting its empty state:
     ```ts
     await page.getByRole("tab", { name: "By provider" }).click();
     await expect(section(page, "By provider").getByText("Not enough data to show")).toBeVisible();
     ```
   - *Why*: Base UI `Tabs` unmounts inactive tab panels from the DOM. Because a member's default tab is `"cert_type"` ("By certificate type"), the `"By provider"` panel must be activated before asserting its contents.
   - Also added assertion that the `"By team"` tab is not visible to members: `await expect(page.getByRole("tab", { name: /^By team$/ })).toHaveCount(0);`.
4. **New Explorer Interactive Test Added (Test 6)**:
   - Added `test("explorer tabs, filtering, and keyboard row selection update the detail panel")` verifying:
     - Switching tabs to `"Popular courses"`.
     - Detail panel updates to show first course (`AWS Solutions Architect Associate`).
     - Typing in the filter textbox (`"NVIDIA"`) filters the table rows.
     - Clearing the filter restores the course list.
     - Keyboard navigation (focusing row and pressing Enter) selects the row, sets `aria-selected="true"`, and updates the detail panel heading to `NVIDIA`.

### 2.2 `e2e/navigation.spec.ts`
1. **Scoped Member Navigation Assertion**:
   - In test 2 ("member sees only personal sections"), updated:
     ```ts
     const nav = page.getByRole("navigation", { name: "Main navigation" });
     await expect(nav.getByRole("link", { name: "My certificates" })).toBeVisible();
     ```
   - *Why*: In the redesign, the member's primary action button in the `/dashboard` PageHeader is also a link to `/me` with the text `"My certificates"`. An unscoped query `page.getByRole("link", { name: "My certificates" })` triggered Playwright's strict mode violation (2 elements found). Scoping to the sidebar navigation (`Main navigation`) tests the intended requirement ("member sees only personal sections in the navigation") while allowing the page header action to use the exact requested label.

---

## 3. Real Verification Logs

### 3.1 `pnpm lint`
```text
$ eslint

D:\Fullstack\CertTracker\src\components\data\data-table.tsx
  56:17  warning  Compilation Skipped: Use of incompatible library

✖ 1 problem (0 errors, 1 warning)
```

### 3.2 `pnpm typecheck`
```text
$ tsc --noEmit
# Exit code 0
```

### 3.3 `pnpm test` (Vitest Unit Suite)
```text
Test Files  66 passed (66)
     Tests  847 passed (847)
  Duration  7.46s
```

### 3.4 `pnpm build` (Next.js 16 Production Build)
```text
▲ Next.js 16.3.6 (Turbopack)
- Environments: .env.local
✓ Running next.config.ts took 28ms
✓ Compiled successfully in 2.4s
  Running TypeScript ...
  Finished TypeScript in 3.7s ...
✓ Generating static pages using 15 workers (19/19) in 762ms
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
```

### 3.5 Core Playwright E2E Suite (`dashboard.spec.ts`, `navigation.spec.ts`, `pilot-day-one.spec.ts`)
```text
Running 24 tests using 1 worker

  ok  1 [chromium] › e2e\dashboard.spec.ts:62:5 › admin sees org-wide KPIs, the expiry chart and the personal ranking (1.4s)
  ok  2 [chromium] › e2e\dashboard.spec.ts:95:5 › manager sees the same org-wide numbers but a ranking limited to their team (1.3s)
  ok  3 [chromium] › e2e\dashboard.spec.ts:108:5 › member sees anonymous aggregates only (1.3s)
  ok  4 [chromium] › e2e\dashboard.spec.ts:122:5 › a member cannot read the ranking or per-team numbers straight from the API (215ms)
  ok  5 [chromium] › e2e\dashboard.spec.ts:145:5 › the dashboard updates live when a record changes elsewhere (8.0s)
  ok  6 [chromium] › e2e\dashboard.spec.ts:175:5 › explorer tabs, filtering, and keyboard row selection update the detail panel (1.5s)
  ok  7 [chromium] › e2e\navigation.spec.ts:4:5 › admin sees admin-only sections (1.3s)
  ok  8 [chromium] › e2e\navigation.spec.ts:10:5 › member sees only personal sections (1.3s)
  ok  9 [chromium] › e2e\navigation.spec.ts:18:5 › sidebar link navigates, marks the breadcrumb and the active item (1.8s)
  ok 10 [chromium] › e2e\navigation.spec.ts:65:7 › /dashboard: skeleton or heading within 300 ms of the click (4.5s)
  ok 11 [chromium] › e2e\navigation.spec.ts:65:7 › /me: skeleton or heading within 300 ms of the click (4.4s)
  ok 12 [chromium] › e2e\navigation.spec.ts:65:7 › /members: skeleton or heading within 300 ms of the click (4.3s)
  ok 13 [chromium] › e2e\navigation.spec.ts:65:7 › /records: skeleton or heading within 300 ms of the click (4.4s)
  ok 14 [chromium] › e2e\navigation.spec.ts:65:7 › /data-quality: skeleton or heading within 300 ms of the click (4.5s)
  ok 15 [chromium] › e2e\navigation.spec.ts:65:7 › /courses: skeleton or heading within 300 ms of the click (4.0s)
  ok 16 [chromium] › e2e\navigation.spec.ts:65:7 › /org: skeleton or heading within 300 ms of the click (4.5s)
  ok 17 [chromium] › e2e\navigation.spec.ts:65:7 › /import: skeleton or heading within 300 ms of the click (4.5s)
  ok 18 [chromium] › e2e\navigation.spec.ts:65:7 › /settings: skeleton or heading within 300 ms of the click (4.4s)
  ok 19 [chromium] › e2e\navigation.spec.ts:87:5 › top bar shows while a navigation is pending and goes idle when the page is there (2.8s)
  ok 20 [chromium] › e2e\navigation.spec.ts:100:5 › top bar crawls with an animation while loading (normal motion) (2.8s)
  ok 21 [chromium] › e2e\navigation.spec.ts:112:5 › reduced motion: top bar has no animation or transition and is full width while loading (2.8s)
  ok 22 [chromium] › e2e\pilot-day-one.spec.ts:48:5 › E-1: a member's whole first day reaches the manager, the dashboard and the export (13.9s)
  ok 23 [chromium] › e2e\pilot-day-one.spec.ts:92:5 › E-2: a login invited before its member exists is linked once the admin adds the member (3.5s)
  ok 24 [chromium] › e2e\pilot-day-one.spec.ts:105:5 › E-10: a member's first day works on a phone without horizontal scrolling (4.9s)

  24 passed (1.5m)
```

---

## 4. Visual Artifacts (Screenshots Captured)

The following screenshot files have been generated at 1280×900 (desktop) and 390×844 (mobile) in both light and dark modes:
- `docs/ui-polish/dashboard-after-desktop-light.png`
- `docs/ui-polish/dashboard-after-desktop-dark.png`
- `docs/ui-polish/dashboard-after-mobile-light.png`
- `docs/ui-polish/dashboard-after-mobile-dark.png`
- `docs/ui-polish/dashboard-manager-after-desktop-light.png`
- `docs/ui-polish/dashboard-manager-after-desktop-dark.png`
- `docs/ui-polish/dashboard-manager-after-mobile-light.png`
- `docs/ui-polish/dashboard-manager-after-mobile-dark.png`
- `docs/ui-polish/dashboard-member-after-desktop-light.png`
- `docs/ui-polish/dashboard-member-after-desktop-dark.png`
- `docs/ui-polish/dashboard-member-after-mobile-light.png`
- `docs/ui-polish/dashboard-member-after-mobile-dark.png`
- `docs/ui-polish/dashboard-courses-tab-after-desktop-light.png`
- `docs/ui-polish/dashboard-courses-tab-after-desktop-dark.png`
- `docs/ui-polish/dashboard-courses-tab-after-mobile-light.png`
- `docs/ui-polish/dashboard-courses-tab-after-mobile-dark.png`
- `docs/ui-polish/dashboard-design-demo-desktop-light.png`
- `docs/ui-polish/dashboard-design-demo-desktop-dark.png`

---

## 5. Future Proposals (Phase 2 Ideas)

1. **Export Selected Explorer Breakdown as CSV**:
   - Provide an optional "Export table" button in the Explorer tab toolbar allowing managers and admins to download the currently filtered dimension breakdown as a CSV for reporting.
2. **Remember Last-Selected Explorer Tab**:
   - Store the user's active tab in `localStorage` or URL query params (e.g. `?tab=provider`) so refreshing or navigating back preserves their workflow context.
3. **Direct Navigation from Detail Panel to Filtered Records**:
   - When viewing a course or provider in the Explorer detail panel, provide a button linking to `/records?courseId=...` or `/records?providerId=...` for instant deep dive.
