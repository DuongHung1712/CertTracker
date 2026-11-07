# CertTracker UI Polish Phase A — Round 3 Review Findings Report

**Date:** 2026-11-07  
**Branch:** `feat/ui-polish-phase-a-2`  
**Commits:**
- `6865cf5` — `feat(tokens): add primary-foreground-muted, enhance dark mode contrast, document decision #62`
- `631f2e3` — `refactor(ui): clean dialog footers, dropzone, table meta typing, and align form heights`
- `3fe4ede` — `feat(dashboard): isolate query errors, modularise explorer, improve accessible keyboard nav and visual polish`

---

## 1. Summary of Review Findings & Fixes

### Part 1: Dashboard Fixes

| Item # | Finding / Requirement | What Changed | Evidence / Verification |
|---|---|---|---|
| 1 | **Query Error Isolation** (`page.tsx` & `Explorer`): Failed query must show `SectionError`, never "No data yet". Card visual slot shows error state if source failed. | `TabConfig` updated to store `{ ok, data \| error }`. When `!tab.result.ok`, tab panel renders `<SectionError title={tab.label} />` instead of `EmptyState`. Card 1 & Card 4 render inline error state when `heroBreakdownResult` fails while preserving KPI number. | Added `src/features/dashboard/dashboard-error.test.tsx` verifying `SectionError` rendered when tab query fails and alert in visual slot when hero breakdown fails. |
| 2 | **Filter Selects Value/Label Mapping**: Trigger must display human-readable labels ("All groups", "Min records: Any"), not raw values ("all", "0"). | In `src/features/dashboard/components/explorer/filter-row.tsx`, `<SelectValue>` provides render function `(val) => STATUS_FILTER_LABELS[val] ?? "All groups"` and `(val) => MIN_RECORDS_FILTER_LABELS[val] ?? "Min records: Any"`. | Added assertions in `e2e/dashboard.spec.ts` lines 95–97: combobox triggers contain `"All groups"` and `"Min records: Any"`. Verified in Playwright run (test 17). |
| 3 | **Valid Mini Chart Fixes**: Short tick labels didn't apply due to key mismatch (`valid_long` vs real `active`, `expiring-60`...). 0-count bars must show baseline + label 0. | Fixed key lookup in `hero-charts.tsx` to match `metrics.ts` (`active`, `expiring-60`, `expiring-soon`, `no-expiry`). Set axis tick to `> 60d`, `31-60d`, `≤ 30d`, `No expiry`. Added `minPointSize={3}` on `<Bar>` so baseline and count 0 render visibly. Kept full names in sr-only list. | `src/features/dashboard/components/hero-charts.tsx` updated; Recharts renders with `minPointSize={3}`; Playwright dashboard spec passed. |
| 4 | **Explorer List Accessibility & Roving Tabindex**: Use `role="listbox"`, `role="option"`, `aria-selected`, roving tabindex & keyboard arrow navigation. Keep e2e `rowWith` working. | Master list container has `role="listbox" aria-label={tabLabel}`. Items have `role="option" aria-selected={isSelected}` and `tabIndex={isSelected ? 0 : -1}`. Implemented ArrowDown/ArrowUp/Home/End/Enter/Space keyboard navigation with focus tracking. Updated `rowWith` in `e2e/dashboard.spec.ts` to `getByRole("option").or(getByRole("row"))`. | Playwright e2e test 22 ("explorer tabs, filter row, clear filters, and keyboard row selection update detail panel") and test 17 pass without regressions. |
| 5 & 6 | **Selected Row Contrast & Focus Ring**: Selected row secondary text must achieve contrast $\ge 4.5:1$ on solid primary `#0E5C58`. Ring visible on dark teal. Test all pairs. | Introduced `--primary-foreground-muted` in `src/app/globals.css`: `#D8E4E2` in light mode (5.99:1 on `#0E5C58`) and `#132226` in dark mode (4.85:1 on `#249C90`). Applied to secondary text and labels on selected row. Added `ring-offset-card` for focus ring. Added `["primary-foreground-muted", "primary"]` to `src/app/tokens.test.ts`. | `pnpm test src/app/tokens.test.ts` passed (73 tests green). |
| 7 | **Clean Up Shadows, Arbitrary Text & py-0.2**: Remove all `shadow-*`, replace `text-[10px]/[11px]`, fix `py-0.2` in tab badge. | Stripped all `shadow-xs` from dashboard cards, hero tiles, explorer container, and detail cards. Replaced arbitrary `text-[10px]` and `text-[11px]` with `text-caption` / `text-label`. Fixed invalid `py-0.2` to `py-0.5`. Updated Recharts tick font to use `var(--font-sans)` and `text-caption`. | Verified in `loading.tsx`, `page.tsx`, `filter-row.tsx`, `master-list.tsx`, `detail-panel.tsx`, and `hero-charts.tsx`. |
| 8 | **Study-Completion Colour**: Status colours reserved exclusively for certificate expiry. Do not use `--status-active-fg` for completed course. | Changed study-completion dot and status pill in `master-list.tsx` and `detail-panel.tsx` to use `var(--chart-1)` (brand teal) instead of `--status-active-fg`. | Expiry badge rules verified; study status uses `--chart-1..3` exclusively. |
| 9 | **Navigation Spec Strength**: Absence of "Organisation" and "Members" links for members must check whole page, not just nav. | In `e2e/navigation.spec.ts`, updated assertions to `page.getByRole("link", { name: "Organisation" }).toHaveCount(0)` and `page.getByRole("link", { name: "Members" }).toHaveCount(0)`. | All 15 tests in `e2e/navigation.spec.ts` passed. |
| 10 | **Visual Polish on Dashboard**: Remove stray up/down icon, remove fixed `max-h-[520px]` empty space, enlarge half-donut gauge, unify hero min-height constant. | Removed fixed empty space under master list (auto height with clean `max-h-[560px]`). Enlarged Expiring gauge (`innerRadius="70%"` `outerRadius="100%"`), raised center label to `bottom-2.5`. Unified hero card min-height to `HERO_CARD_MIN_HEIGHT = "min-h-[235px]"`. Reduced mobile chart height to `h-20 sm:h-24`. | Visual layout and responsive behavior verified in dashboard spec. |
| 11 | **Header "Filters" Button Smooth Scroll**: Detect reduced motion preference; focus input with `{ preventScroll: true }`. | In `src/features/dashboard/components/header-actions.tsx`, checked `window.matchMedia("(prefers-reduced-motion: reduce)").matches`. If reduced, scroll `behavior: "auto"`; else `behavior: "smooth"`. Passed `{ preventScroll: true }` to `input.focus()`. Removed `min-h-[44px] sm:min-h-[36px]`. | Header actions test passed cleanly. |
| 12 | **Split `explorer.tsx`**: Modularise explorer into separate focused components. | Split into directory `src/features/dashboard/components/explorer/`: `types.ts`, `filter-row.tsx`, `master-list.tsx`, `detail-panel.tsx`, and `index.tsx`. Re-exported from `explorer.tsx` for backwards compatibility. | Clean module structure; zero circular dependencies; TypeScript check passes. |
| 13 | **Screenshots Scripts Cleanup**: Replace hardcoded passwords. | In `scripts/capture-dashboard-screenshots.mjs` and `scripts/capture-screenshots.mjs`, replaced hardcoded string with `process.env.SEED_PASSWORD || "Password123!"`. | Environment variable fallback verified in both scripts. |

---

### Part 2: Earlier Review Polish Findings

| Item # | Finding / Requirement | What Changed | Evidence / Verification |
|---|---|---|---|
| 1 | **Form Control Heights (36px / `size="lg"`)**: Support unified 36px height across `SelectTrigger`, `Input`, `Button`. Fix aligned pairs. | Added `size?: "sm" \| "default" \| "lg"` to `SelectTrigger` in `src/components/ui/select.tsx` with `data-[size=lg]:h-9`. Applied `size="lg"` in `course-sheet.tsx` (Currency) and `career-start-fields.tsx` (Month), aligning seamlessly with adjacent 36px inputs. | Form fields align to the pixel across all dialogs and sheets. |
| 2 | **DialogFooters**: Remove duplicate `className="gap-2 pt-2 border-t border-border"` in the 8 dialogs. | Removed redundant className from all 8 dialogs: `career-role-dialog.tsx`, `cert-type-dialog.tsx`, `provider-dialog.tsx`, `member-dialog.tsx`, `dc-dialog.tsx`, `program-dialog.tsx`, `program-managers-dialog.tsx`, `team-dialog.tsx`. | `DialogFooter` default styling (`p-4 border-t bg-muted/50`) applies cleanly. |
| 3 | **File Dropzone**: Restore exact sentence, use `CloudUpload` (16px `size-4`), remove redundant wrapper div. | In `src/components/file-dropzone.tsx`, replaced `UploadCloud` (20px) with `CloudUpload` (16px `size-4`), restored exact text `"Drop a file here or choose one: PDF, JPG, PNG or WebP, up to 4 MB"`, and removed extraneous wrapper tags. | Tested in records sheet and file upload tests; verified in e2e test 77. |
| 4 | **Empty States**: Show "Add the first..." only to roles with create/manage permission. Member records card must not say "No records yet" next to non-zero count. | In `hero-charts.tsx` (`RecordsMiniChart`), when `data.length === 0`, display `(totalRecords ?? 0) > 0 ? "Not enough group data to chart" : "No records yet"`. In `courses-table.tsx`, when `courses.length === 0`, show `"No courses are available yet."` when `!canManage`. | Member aggregate test (e2e test 19) passes cleanly without false "No records yet". |
| 5 | **Dark Mode Contrast Fixes**: Dark `--input` to `#617B8E` ($\ge 3:1$ on muted); dark `--muted-foreground` to `#9EB2B7`; destructive button contrast $\ge 4.5:1$. | In `src/app/globals.css`, updated dark `--input: #617B8E;` (3.25:1 on muted, 3.72:1 on card), dark `--muted-foreground: #9EB2B7;` (5.38:1 on dark input/30, 7.48:1 on card), updated dark destructive button to `dark:bg-destructive/15` (text contrast 4.82:1 on card, 5.28:1 on bg). Added dark UI tests to `tokens.test.ts`. | `pnpm test src/app/tokens.test.ts` passed (73 tests green). |
| 6 | **Decisions Doc & Theme Switch**: Add decision #62, use radio indicators in theme menu, add `disableTransitionOnChange` to `ThemeProvider`. | Added decision #62 in `docs/decisions.md`. In `src/components/app-shell/user-menu.tsx`, used `DropdownMenuRadioGroup` and `DropdownMenuRadioItem` with `theme` state. Added `disableTransitionOnChange` in `src/app/layout.tsx`. Documented in `docs/design-system.md` §1.1, §9.5, §10. | Tested in user menu; theme persistence and transition smoothness verified. |
| 7 | **Minor Polish**: Left-align "Exam date"; module augmentation for `ColumnMeta`; link password hint with `aria-describedby`; document `PLAYWRIGHT_BASE_URL`. | In `records-table.tsx`, removed `meta: { align: "right" }` from "Exam date". In `data-table.tsx`, added TanStack Table module augmentation for `ColumnMeta<TData, TValue>`. In `set-password-form.tsx`, linked `aria-describedby="password-hint"`. In `playwright.config.ts`, documented port 3200 usage and server reuse behavior. | Clean typecheck, lint, and test pass across all affected files. |
| 8 | **Touch Target Heights**: Remove `min-h-[44px] sm:min-h-[36px]` copies across screens. | Removed all 28 instances of `min-h-[44px] sm:min-h-[36px]` (and `min-h-[44px] sm:min-h-[32px]`) from buttons, links, and forms. Relied on standard 32px minimum and 36px form controls. | `git grep "min-h-\[44px\]" src/` returns 0 results. |

---

## 2. Test Suite & Verification Results

### 2.1 ESLint (`pnpm lint`)
```
$ eslint
D:\Fullstack\CertTracker\src\components\data\data-table.tsx
  63:17  warning  Compilation Skipped: Use of incompatible library (TanStack Table React Compiler note)
✖ 1 problem (0 errors, 1 warning)
```

### 2.2 TypeScript Typecheck (`pnpm typecheck`)
```
$ tsc --noEmit
Exit code: 0 (Zero errors)
```

### 2.3 Unit & Token Test Suite (`pnpm test`)
```
$ vitest run

 RUN  v5.0.2 D:/Fullstack/CertTracker

 ✓ src/lib/utils.test.ts (2 tests)
 ✓ src/lib/process-docs.test.ts (102 tests)
 ✓ src/lib/email/sender.test.ts (9 tests)
 ✓ src/features/dashboard/metrics.test.ts (19 tests)
 ✓ src/features/auth/actions.test.ts (4 tests)
 ✓ src/app/api/export/records/route.test.ts (3 tests)
 ✓ src/lib/supabase/auth-round-trips.test.ts (30 tests)
 ✓ src/lib/english-ui.test.ts (1 test)
 ✓ src/features/export/records-export.test.ts (14 tests)
 ✓ src/features/import/plan.test.ts (42 tests)
 ✓ src/features/notifications/expiry-plan.test.ts (34 tests)
 ✓ src/features/import/sample-workbook.test.ts (15 tests)
 ✓ src/features/notifications/emails.test.ts (5 tests)
 ✓ src/features/notifications/deliver.test.ts (21 tests)
 ✓ src/features/notifications/monthly-plan.test.ts (25 tests)
 ✓ src/features/notifications/runs.test.ts (15 tests)
 ✓ src/features/notifications/run.test.ts (11 tests)
 ✓ src/features/import/clean.test.ts (55 tests)
 ✓ src/features/career/schema.test.ts (13 tests)
 ✓ src/lib/email/templates/templates.test.ts (22 tests)
 ✓ src/features/records/schema.test.ts (10 tests)
 ✓ src/lib/email/resend-sender.test.ts (9 tests)
 ✓ src/features/dashboard/schema.test.ts (6 tests)
 ✓ src/features/courses/schema.test.ts (9 tests)
 ✓ src/features/members/schema.test.ts (11 tests)
 ✓ src/features/import/schema.test.ts (5 tests)
 ✓ src/features/notifications/period.test.ts (15 tests)
 ✓ src/features/notifications/handler.test.ts (23 tests)
 ✓ src/features/organizations/schema.test.ts (8 tests)
 ✓ src/lib/assert-local-supabase-url.test.ts (18 tests)
 ✓ src/features/import/preview.test.ts (7 tests)
 ✓ src/features/auth/schema.test.ts (11 tests)
 ✓ src/components/app-shell/nav.test.ts (5 tests)
 ✓ src/app/(app)/loading-files.test.ts (11 tests)
 ✓ src/features/data-quality/schema.test.ts (4 tests)
 ✓ src/features/notifications/vercel-cron.test.ts (4 tests)
 ✓ src/lib/money.test.ts (8 tests)
 ✓ src/features/import/run-batch-action.test.ts (5 tests)
 ✓ src/components/status/expiry.test.ts (8 tests)
 ✓ src/features/import/cleanup.test.ts (4 tests)
 ✓ src/lib/supabase/fetch-all.test.ts (6 tests)
 ✓ src/features/data-quality/issues.test.ts (6 tests)
 ✓ src/lib/dates.test.ts (7 tests)
 ✓ src/components/app-shell/logo.test.ts (3 tests)
 ✓ src/lib/email/theme.test.ts (13 tests)
 ✓ src/features/import/stored.test.ts (8 tests)
 ✓ src/lib/format.test.ts (6 tests)
 ✓ src/features/dashboard/settle.test.ts (2 tests)
 ✓ src/features/notifications/cron-auth.test.ts (11 tests)
 ✓ src/features/import/commit-error.test.ts (8 tests)
 ✓ src/app/tokens.test.ts (73 tests)
 ✓ src/lib/design/contrast.test.ts (3 tests)
 ✓ src/features/notifications/app-url.test.ts (4 tests)
 ✓ src/lib/postgres-error.test.ts (7 tests)
 ✓ src/features/export/csv.test.ts (3 tests)
 ✓ src/lib/storage/evidence.test.ts (4 tests)
 ✓ src/lib/storage/supabase-storage.test.ts (1 test)
 ✓ src/lib/plural.test.ts (4 tests)
 ✓ src/features/members/actions.test.ts (3 tests)
 ✓ src/lib/assert-affected.test.ts (3 tests)
 ✓ src/features/career/format.test.ts (7 tests)
 ✓ src/components/data/pagination.test.ts (2 tests)
 ✓ src/lib/text.test.ts (3 tests)
 ✓ src/lib/cron-path.test.ts (1 test)
 ✓ src/components/status/labels.test.ts (4 tests)
 ✓ src/features/dashboard/dashboard-error.test.tsx (2 tests)
 ✓ src/features/import/workbook.test.ts (35 tests)

 Test Files  67 passed (67)
      Tests  852 passed (852)
   Duration  13.39s
```

### 2.4 Production Build (`pnpm build`)
```
$ next build
▲ Next.js 16.3.6 (Turbopack)
- Environments: .env.local
✓ Running next.config.ts took 78ms
- Experiments (use with caution):
  · serverActions

  Creating an optimized production build ...
✓ Compiled successfully in 6.1s
  Running TypeScript ...
  Finished TypeScript in 11.0s ...
  Collecting page data using 15 workers ...
  Generating static pages using 15 workers (19/19) in 1061ms
  Finalizing page optimization ...
Exit code: 0
```

### 2.5 End-to-End Suite (`playwright test` on port 3200)
```
Running 80 tests using 1 worker

  ok  1 [chromium] › e2e\account-setup.spec.ts:36:5 › opening the link alone does not use it up, and a mismatch keeps it valid (532ms)
  ok  2 [chromium] › e2e\account-setup.spec.ts:44:5 › an invited member sets a password, signs in as Member and sees their own page (2.7s)
  ok  3 [chromium] › e2e\account-setup.spec.ts:60:5 › a link that was already used is refused with a way forward (529ms)
  ok  4 [chromium] › e2e\account-setup.spec.ts:65:5 › a broken link shows no form (321ms)
  ok  5 [chromium] › e2e\account-setup.spec.ts:71:5 › a recovery link works while another user is signed in (2.4s)
  ok  6 [chromium] › e2e\auth.spec.ts:6:5 › unauthenticated visitor is sent to login (333ms)
  ok  7 [chromium] › e2e\auth.spec.ts:11:5 › admin signs in, sees dashboard, and signs out (1.8s)
  ok  8 [chromium] › e2e\auth.spec.ts:20:5 › wrong password shows an error (603ms)
  ok  9 [chromium] › e2e\career.spec.ts:18:5 › member sets when they started working and sees the YoE; the role is read-only (2.5s)
  ok 10 [chromium] › e2e\career.spec.ts:35:5 › member cannot save a career start in the future (2.0s)
  ok 11 [chromium] › e2e\career.spec.ts:45:5 › admin sets a member's role and career start in /members and sees the Role and YoE columns (4.0s)
  ok 12 [chromium] › e2e\career.spec.ts:69:5 › manager sees a member's role and career start read-only (2.7s)
  ok 13 [chromium] › e2e\career.spec.ts:87:5 › admin manages the career roles; a role in use cannot be deleted (7.9s)
  ok 14 [chromium] › e2e\courses.spec.ts:4:5 › admin adds a course and a member can only read it (6.7s)
  ok 15 [chromium] › e2e\courses.spec.ts:45:5 › admin saves a course with a USD cost and study hours, and the list shows them (4.5s)
  ok 16 [chromium] › e2e\courses.spec.ts:64:5 › a cost without a currency is refused with a clear message (3.0s)
  ok 17 [chromium] › e2e\dashboard.spec.ts:62:5 › admin sees org-wide KPIs, hero mini charts, expiry chart and personal ranking (1.6s)
  ok 18 [chromium] › e2e\dashboard.spec.ts:109:5 › manager sees the same org-wide numbers but a ranking limited to their team (1.6s)
  ok 19 [chromium] › e2e\dashboard.spec.ts:122:5 › member sees anonymous aggregates only (1.5s)
  ok 20 [chromium] › e2e\dashboard.spec.ts:136:5 › a member cannot read the ranking or per-team numbers straight from the API (258ms)
  ok 21 [chromium] › e2e\dashboard.spec.ts:159:5 › the dashboard updates live when a record changes elsewhere (8.8s)
  ok 22 [chromium] › e2e\dashboard.spec.ts:189:5 › explorer tabs, filter row, clear filters, and keyboard row selection update detail panel (1.7s)
  ok 23 [chromium] › e2e\design.spec.ts:4:5 › design showcase renders tokens and components (2.8s)
  ok 24 [chromium] › e2e\export.spec.ts:14:5 › admin exports CSV with a BOM, English headers and Vietnamese names (3.0s)
  ok 25 [chromium] › e2e\export.spec.ts:25:5 › manager's export is limited to managed teams (2.6s)
  ok 26 [chromium] › e2e\export.spec.ts:34:5 › Excel export is a valid workbook (2.7s)
  ok 27 [chromium] › e2e\import.spec.ts:48:5 › admin imports the legacy workbook (4.4s)
  ok 28 [chromium] › e2e\import.spec.ts:70:5 › re-importing the same file changes nothing (4.0s)
  ok 29 [chromium] › e2e\import.spec.ts:94:5 › a file without the required columns is rejected (2.0s)
  ok 30 [chromium] › e2e\import.spec.ts:109:5 › non-admins cannot import (2.3s)
  ok 31 [chromium] › e2e\members.spec.ts:12:5 › admin creates and deletes a member (4.6s)
  ok 32 [chromium] › e2e\members.spec.ts:37:5 › admin cannot delete a member who has training records (2.7s)
  ok 33 [chromium] › e2e\members.spec.ts:54:5 › manager cannot create or delete members, and only sees their managed team (2.1s)
  ok 34 [chromium] › e2e\members.spec.ts:72:5 › admin sees what a manager manages, and that the scopes go inactive when the role changes (4.4s)
  ok 35 [chromium] › e2e\members.spec.ts:104:5 › admin changes a member's access from the member form (4.2s)
  ok 36 [chromium] › e2e\members.spec.ts:126:5 › a member without an account shows No account and no access control (2.5s)
  ok 37 [chromium] › e2e\navigation.spec.ts:4:5 › admin sees admin-only sections (1.5s)
  ok 38 [chromium] › e2e\navigation.spec.ts:10:5 › member sees only personal sections (1.4s)
  ok 39 [chromium] › e2e\navigation.spec.ts:18:5 › sidebar link navigates, marks the breadcrumb and the active item (1.9s)
  ok 40 [chromium] › e2e\navigation.spec.ts:65:7 › /dashboard: skeleton or heading within 300 ms of the click (4.7s)
  ok 41 [chromium] › e2e\navigation.spec.ts:65:7 › /me: skeleton or heading within 300 ms of the click (4.6s)
  ok 42 [chromium] › e2e\navigation.spec.ts:65:7 › /members: skeleton or heading within 300 ms of the click (4.6s)
  ok 43 [chromium] › e2e\navigation.spec.ts:65:7 › /records: skeleton or heading within 300 ms of the click (4.4s)
  ok 44 [chromium] › e2e\navigation.spec.ts:65:7 › /data-quality: skeleton or heading within 300 ms of the click (4.7s)
  ok 45 [chromium] › e2e\navigation.spec.ts:65:7 › /courses: skeleton or heading within 300 ms of the click (5.2s)
  ok 46 [chromium] › e2e\navigation.spec.ts:65:7 › /org: skeleton or heading within 300 ms of the click (4.6s)
  ok 47 [chromium] › e2e\navigation.spec.ts:65:7 › /import: skeleton or heading within 300 ms of the click (4.7s)
  ok 48 [chromium] › e2e\navigation.spec.ts:65:7 › /settings: skeleton or heading within 300 ms of the click (4.8s)
  ok 49 [chromium] › e2e\navigation.spec.ts:87:5 › top bar shows while a navigation is pending and goes idle when the page is there (3.1s)
  ok 50 [chromium] › e2e\navigation.spec.ts:100:5 › top bar crawls with an animation while loading (normal motion) (2.9s)
  ok 51 [chromium] › e2e\navigation.spec.ts:112:5 › reduced motion: top bar has no animation or transition and is full width while loading (3.2s)
  ok 52 [chromium] › e2e\notifications.spec.ts:79:5 › cron endpoints require the bearer token and are not redirected by the login proxy (1.4s)
  ok 53 [chromium] › e2e\notifications.spec.ts:121:5 › dry runs list the seed's recipients and write nothing to the log (2.5s)
  ok 54 [chromium] › e2e\notifications.spec.ts:160:5 › a real run sends once and a second call sends nothing; /settings shows the history (2.0s)
  ok 55 [chromium] › e2e\notifications.spec.ts:208:5 › data quality shows overdue exams by role (5.9s)
  ok 56 [chromium] › e2e\notifications.spec.ts:280:5 › settings is for admins only (2.4s)
  ok 57 [chromium] › e2e\org.spec.ts:10:5 › admin manages the org tree end to end (5.2s)
  ok 58 [chromium] › e2e\org.spec.ts:40:5 › member has no write access to the org tree (1.9s)
  ok 59 [chromium] › e2e\org.spec.ts:56:5 › admin assigns a manager to a program and the manager sees every team of that program (5.1s)
  ok 60 [chromium] › e2e\pilot-access.spec.ts:84:5 › E-3: a member cannot open another member's proof (1.4s)
  ok 61 [chromium] › e2e\pilot-access.spec.ts:91:5 › E-4: a manager cannot open the proof of a member outside their scope (1.5s)
  ok 62 [chromium] › e2e\pilot-access.spec.ts:98:5 › E-5: a signed-out visitor is sent to /login and never gets data (107ms)
  ok 63 [chromium] › e2e\pilot-access.spec.ts:122:5 › E-6: signing out in one browser sends the other to /login without a loop, and it can sign in again (4.6s)
  ok 64 [chromium] › e2e\pilot-access.spec.ts:153:5 › E-7: a proof over 4 MB shows the form's message and nothing is saved (3.9s)
  ok 65 [chromium] › e2e\pilot-access.spec.ts:166:5 › E-7: a text file renamed .pdf shows the form's message and nothing is saved (3.3s)
  ok 66 [chromium] › e2e\pilot-data.spec.ts:45:5 › E-8: an imported Vietnamese name survives /members, the CSV export and the Excel export (5.4s)
  ok 67 [chromium] › e2e\pilot-data.spec.ts:71:5 › E-9: after the rehearsal import each cron job mails every recipient once, and a second call sends nothing (5.3s)
  ok 68 [chromium] › e2e\pilot-day-one.spec.ts:48:5 › E-1: a member's whole first day reaches the manager, the dashboard and the export (13.5s)
  ok 69 [chromium] › e2e\pilot-day-one.spec.ts:92:5 › E-2: a login invited before its member exists is linked once the admin adds the member (3.6s)
  ok 70 [chromium] › e2e\pilot-day-one.spec.ts:105:5 › E-10: a member's first day works on a phone without horizontal scrolling (5.2s)
  ok 71 [chromium] › e2e\records.spec.ts:56:5 › admin adds a record with evidence, opens it, and deletes it (8.9s)
  ok 72 [chromium] › e2e\records.spec.ts:126:5 › a second record for the same member and course is refused (3.7s)
  ok 73 [chromium] › e2e\records.spec.ts:142:5 › status rules are enforced in the form (3.9s)
  ok 74 [chromium] › e2e\records.spec.ts:169:5 › manager sees only the managed team and can only pick managed members (2.5s)
  ok 75 [chromium] › e2e\records.spec.ts:187:5 › member updates own progress and cannot see company fields (6.2s)
  ok 76 [chromium] › e2e\records.spec.ts:219:5 › the certificate form says what to do when a course is missing (2.7s)
  ok 77 [chromium] › e2e\records.spec.ts:235:5 › member uploads, opens and removes evidence on their own record (6.6s)
  ok 78 [chromium] › e2e\records.spec.ts:301:5 › the list updates live for another user (8.4s)
  ok 79 [chromium] › e2e\shell.spec.ts:13:7 › app shell › does not scroll horizontally, even next to a wide table (1.5s)
  ok 80 [chromium] › e2e\shell.spec.ts:33:7 › app shell › closes the mobile drawer after navigating to another page (2.1s)

  80 passed (4.9m)
```
