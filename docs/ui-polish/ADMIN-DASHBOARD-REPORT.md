# CertTracker UI Polish Phase A: Admin Dashboard Report

**Date:** 2026-11-08
**Branch:** `refactor/admin-dashboard-cleanup` (builds on `feat/implement-admin-dashboard`)
**Figma reference:** node `5-3815` (`https://www.figma.com/design/l46n1GeFs7BvNrxVCy8NY4/CertTracker?node-id=5-3815`)
**Review inputs:** `.superpowers/sdd/ui-polish-review/admin-code-review.md`, `admin-ux-copy-audit.md`, `admin-fix-brief.md`

---

## 1. What the page is now

1. **Loader and route.** `loadAdminDashboard(user)` runs the dashboard queries in one `Promise.all`, each wrapped in `settle()`, through the signed-in user's client (RLS does the scoping). `page.tsx` renders `<AdminDashboardView {...(await loadAdminDashboard(user))} />`. The loader returns `profileError` when the members or career query failed. There is no placeholder e-mail.
2. **Layout B.** Header, then the Overview (3 KPI cards and a stat strip) at full width, then three independent columns, then Individual ranking at full width. Centre (tab strip and Explorer) is first in the markup so a phone reads Overview, Explorer, Needs attention, Planned features, profile, Quick actions, chart, ranking; from `lg` up `lg:order-2/3/1` shows Left, Centre, Right.
3. **Overview.** `ValidCard`, `ExpiringCard` and `ExpiredCard` share the `KpiTile` frame; `StatStrip` follows. Copy is plain ("Valid certificates", "<n>% valid", "of <n> completed", "Expiry", "30 days or less", "31–60 days", "Expired", "Action needed", "No expired certificates"). Status colours come from `--status-*` tokens and captions on the teal card use `text-primary-foreground-muted`.
4. **Needs attention.** Real items only: expired certificates, then certificates expiring within 30 days, cut at `ADMIN_ATTENTION_LIMIT` (10), then one "Data quality" row that the cut never drops. A cut list ends with "Showing 10 of N. View all certificates". One `AttentionRow` with a tone map; links have a focus ring.
5. **One Planned features card** (Approvals, Goals, Skills, Focus area, Ask about certificates, Monthly summary, Risk alerts), each ending "Not available yet.", no controls. The "Waiting for approval" tile and the profile's embedded Coming soon card are gone.
6. **Failures are honest.** A failed query shows its own region's `SectionError` or an honest row. It is never shown as "All clear", "None issued", "System administrator" or a zero. The Expired card does not use the teams query. With no certificates the Explorer is replaced by the "No certificates yet" empty state.
7. **Shared code.** `getInitials` lives once in `src/lib/initials.ts`; `DashboardTabStrip` is shared with the manager page. Dead code deleted: `admin-dashboard.tsx`, `header-actions.tsx`, `overview-section.tsx`, `chart-load-error.tsx`, `admin-tab-strip.tsx` and the unused `admin-metrics` exports.

---

## 2. Figma block matrix

| Figma block | What was built (or why omitted) | Evidence |
|---|---|---|
| Header actions | `AdminHeader`: greeting in `Asia/Ho_Chi_Minh`, "Filter groups" (scroll and focus to the search box of `#dashboard-filters`, honours `prefers-reduced-motion`) and "Export CSV". "Add certificate" is in Quick actions only. | `admin-dashboard-view.test.tsx`, `e2e/dashboard.spec.ts` |
| Profile card | `AdminProfileCard` "Your profile": initials, name (or e-mail), "Admin" badge, role/team/experience or "Not linked to a member"; `SectionError` when members or career failed. | `admin-dashboard-view.test.tsx`, `e2e/dashboard.spec.ts` |
| Quick actions | "Add certificate", "Add member", "Import from Excel". No shortcut chips. | `admin-dashboard-view.test.tsx` |
| KPI: Valid certificates | `ValidCard` with a progress ring (dash = 2πr), "<n>% valid", issued-this-month caption. | `admin-dashboard-view.test.tsx` |
| KPI: Expiry | `ExpiringCard` with the `Certificate expiry` region (one image summary). | `e2e/dashboard.spec.ts` |
| KPI: Expired | `ExpiredCard`: count, "Action needed", positive empty state. | `admin-dashboard-view.test.tsx` |
| Waiting for approval tile | Removed; Approvals is listed in Planned features and in the tab strip. | `admin-dashboard-view.test.tsx` |
| Stat strip | `StatStrip`: Active members, Certificates, Completed, In progress. | `e2e/dashboard.spec.ts` |
| Tab strip | Shared `DashboardTabStrip`: live `Overview` and disabled `Approvals`, `Goals`, `Skills` chips marked "Soon". | `admin-dashboard-view.test.tsx` |
| Explorer, Ranking | Existing `Explorer` and `RankingTable`; ranking is full width below the columns. | `e2e/dashboard.spec.ts` |
| Needs attention | `AdminNeedsAttention`, live data only (see section 1). | `admin-metrics.test.ts`, `e2e/dashboard.spec.ts` |
| Assistant, Monthly summary, Risk alerts | Merged into "Planned features" (section 1, item 5). | `e2e/dashboard.spec.ts` |

---

## 3. Figma elements removed (not real)

1. **Header date range selector** ("Q1 2024", "Last 30 days"): the app shows the live database state.
2. **Keyboard shortcut badges on Quick actions** (`⌘N`, `INV`, `XLS`, `CSV`): no such hotkeys exist.
3. **Audit hash string** (`"Audit Hash #0E5C-TC9"`): not a ledger application.
4. **Hardcoded lead and department code** (`"Lead: Minh Pham"`, `"Lead Auditor"`, `"DC34"`, `"AUDIT READY"`): replaced by the signed-in admin's own details.
5. **Compliance badges** (`"Legal Expiration Guard"`, `"ISO 27001"`): no compliance backend.
6. **Fake attention items and buttons** (`"HRIS sync error"`, `"4 pending proofs"`, `"Review submissions"`, `"Send reminder"`): replaced by items computed from the records.
7. **Controls in Coming soon cards** (fake buttons and inputs): the Planned features card is static text.
8. **Delta percentages** (`+14% vs last month`): there is no history to compute them from.
9. **Figma decoration words** (Audit status, pool, Timeline, Workflow, Flagged, Workspace ledger, "key-person risk"): the app has no such concept; `admin-copy.test.ts` bans them.

---

## 4. Tests that pin this page

- `admin-dashboard-view.test.tsx`: composition (each region once, column order, `lg:order-*`), Planned features, actions, KPI copy, one test per failing query (no "All clear", no "None issued", no "System administrator"), the empty state, an expired record (the seed has none), truncation with the data quality row, ring geometry, valid `dl`, one summary per chart.
- `admin-metrics.test.ts`: window boundaries (-1, 0, 30, 31, 60, 61 days), `ADMIN_ATTENTION_LIMIT`, the data quality row surviving the cut.
- `admin-copy.test.ts`: banned strings, dead buttons, design tokens (no `amber-`/`rose-`, no text `opacity-<n>`, no `uppercase`, no literal circumference) and the cleanup checks (deleted files, one `getInitials`, no placeholder e-mail).
- `e2e/column-heights.spec.ts`: column balance at 1440px with a real `expect`.
- `e2e/auth.spec.ts`: the role "Admin" is looked up on the account button in the shell, not on the profile badge.

---

## 5. Column heights at 1440px

Measured with `e2e/column-heights.spec.ts` (viewport 1440x900, content height from the column top to the bottom of its last child, seed data):

| | Left | Centre | Right | Max - min |
|---|---|---|---|---|
| Before (3 columns holding everything) | 697 | 1474 | 618 | 856 |
| After (layout B) | 555 | 897 | 808 | 342 |

The guard allows at most 350px. The 856px gap of the first version was a defect, not an accepted trade-off: the Overview and the ranking now span the full width, so the columns hold only widgets and the Explorer. The Centre column is still the tallest because the Explorer detail panel is tall; the guard keeps it from drifting.

---

## 6. Verification

Run from `.worktrees/m1-platform` on `refactor/admin-dashboard-cleanup`:

- `pnpm lint`: 0 errors (1 existing warning in `data-table.tsx`).
- `pnpm typecheck`: clean.
- `pnpm test`: 85 files pass; `src/app/(app)/dashboard/page.test.tsx` has one stale assertion (hero breakdown fails, expects "Could not load chart.") that contradicts the rule that the Expired card never depends on teams.
- `pnpm build`: compiles.
- Playwright on port 3201 (`dashboard`, `column-heights`, `auth`, `pilot-day-one`): see `.superpowers/sdd/ui-polish-review/admin-fix-impl-report.md`.
