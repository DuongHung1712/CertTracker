# Dashboard redesign (Phase A): spec and Gemini prompt

## Context

The owner found a dashboard template (finance "Invoices" screen) and wants CertTracker's `/dashboard` to use its **layout** with CertTracker's own colours, typography and design system. Wanted: the most valuable numbers first, charts where they help, and a selector at the bottom for the "By ..." views.

Decisions made with the owner:
- Use **existing data only** (no new SQL, no migration, no pgTAP change). Trends by month or quarter belong to Phase 2 (WBS 15.6) and the design system forbids "change against previous period" tiles until history exists.
- Work **on the current branch** `feat/ui-polish-phase-a-2` (Gemini's polish branch, 14 commits ahead of `main`).
- **Gemini writes the code**; Claude reviews it against the eight standards (below). This file is the spec; the RCTF prompt is in the appendix.

Facts from the code that shape the design (all in `src/features/dashboard/` and `src/app/(app)/dashboard/`):
- The page is one async Server Component; six queries run in one `Promise.all`, each wrapped by `settle()` so one failure shows a `SectionError`, not a broken page.
- Data available: KPIs (7 numbers + 5 expiry buckets), breakdowns by team / certificate type / provider / course (people, records, done, in progress, not started, valid, expired; team also has headcount), ranking by member (admin and manager only).
- No time series, no filters, no period. Manager sees org-wide KPIs and breakdowns; only the ranking is limited to their teams. A member sees anonymous totals; groups with fewer than 3 learners are hidden.
- `recharts` is installed and used only by `ExpiryChart`. There is no `tabs.tsx` and no chart wrapper in `src/components/ui/`. `--chart-1..5` exist in `globals.css` but nothing uses them.
- `RecordsRealtime` calls `router.refresh()` on changes, so selection state in client islands must survive a refresh.

## What we take from the template, and what we do not

| Take (layout) | Do not take (violates the design system) |
|---|---|
| Header: title, subtitle, one primary action on the right | Dark navy panels, purple accent, gradients |
| Row of KPI cards, each with a small visual under the number | Shadows on cards, large radius, photos, avatars, illustrations |
| Filter and tab strip above a two-pane block: ranked list on the left, detail panel on the right | Trend arrows ("+12.5% from last month"): no history exists |
| Donut and bar charts | Template fonts and colours: use Be Vietnam Pro and the tokens in `globals.css` |

## Target layout (desktop 1280, content padding 24 px; mobile 390 stacks every row)

1. **PageHeader** (existing component): `h1` "Dashboard" (kept: e2e looks for it), description "Figures as of ...", and an `actions` slot with one primary `Button`: "View records" (`/records`) for admin and manager, "My certificates" (`/me`) for a member.
2. **Overview** (`<Section>` named "Overview", kept). Two `<dl>` blocks inside it so every KPI stays a `dl > div` with the label in a `dt` and a bare number in the first `dd` (e2e depends on this).
   - Hero row, 4 cards (`lg:grid-cols-4`), most valuable first, each card = label, big number (`text-kpi`), one-line hint, and a small visual **below** the `dd`:
     1. **Certificate records**: stacked bar of Completed / In progress / Not started.
     2. **Valid**: hint "Includes N with no expiry"; stacked bar of the four valid buckets (> 60 days, 31-60 days, <= 30 days, no expiry).
     3. **Expiring (<= 60 days)**: split bar 31-60 days vs <= 30 days; the number gets `text-foreground` normally and the warning tone only through the existing expiry tokens.
     4. **Expired**: number in `destructive` when > 0, hint "Completed certificates past their expiry date".
   - Compact row, 3 smaller tiles: **Active members**, **Completed** (hint "N% of records"), **In progress**.
   - All seven labels keep their exact text.
3. **Health row** (2 columns, `lg:grid-cols-3`):
   - "Certificate expiry" (2/3): the existing `ExpiryChart`, unchanged semantics (region name, `role="img"` with `aria-label` starting "Certificate expiry:", sr-only list).
   - "Completion" (1/3, new): Recharts donut Completed / In progress / Not started with the completion rate (`ratePercent`) in the centre, a legend with numbers, and a text equivalent for screen readers.
4. **Explorer** (the bottom selector): a `Tabs` strip: **By team** (admin and manager only), **By certificate type**, **By provider**, **Popular courses**. Each tab panel is a `<section aria-label="By team">` etc. (region names kept). Inside a panel, two panes:
   - Left: the existing `BreakdownTable` in a compact variant (label, records, completion bar), sorted by records, with a search box above it. Rows are selectable; selection is keyboard-operable (a real button or link in the row, `aria-selected` or `aria-current`).
   - Right: **detail panel** for the selected row, built only from `BreakdownRow` fields: name, people (or headcount for teams), records, completion rate bar, stacked bar Completed / In progress / Not started, Valid vs Expired counts. First row selected by default; if the selected key disappears after a realtime refresh, fall back to the first row.
   - A member opens on "By certificate type", never sees "By team", and keeps the note "Only groups with at least 3 learners are shown." and the text "Not enough data to show".
5. **Individual ranking** stays a full-width `<Section>` at the bottom for admin and manager (e2e asserts its rows and the rank in the first cell). Managers keep the note "Only members of the teams you manage are included."

Empty state (no records), per-section errors and the Realtime refresh behave as today. `loading.tsx` is reshaped to the new layout and keeps `role="status"`, `aria-busy="true"` and `aria-label="Loading dashboard"` (enforced by `src/app/(app)/loading-files.test.ts`).

## Chart and token rules (from `docs/design-system.md` section 2.5 and the rules on status colours)

- Expiry buckets use the `--status-*` tokens (expiry only). Study status (Completed / In progress / Not started) must **not** use status colours: use `--chart-1` (done, teal), `--chart-2` (in progress, grey-blue), `--chart-3` (not started) with a visible number and label next to every segment, so colour is never the only cue.
- Every chart: text label and number per bar, a screen-reader text version, **no animation**, bar colours at least 3:1 against `card` in light and dark. `src/app/tokens.test.ts` only covers the five status colours today: extend it to cover the chart tokens that are used, and change a token only together with `docs/design-system.md`.
- No new hex values, no gradients, no shadows, radius from tokens, icons lucide 16 px with `aria-hidden` when decorative.
- Tiny stacked bars are plain `div`s with `aria-label`; use Recharts only for the donut and the existing expiry chart (smaller client bundle).

## Files expected to change

- `src/app/(app)/dashboard/page.tsx`, `loading.tsx`
- `src/features/dashboard/components/`: new `kpi-card.tsx` (hero card with visual slot), `completion-donut.tsx`, `explorer.tsx` (tabs, list, detail panel; client), `status-bar.tsx` (stacked bar); edit `breakdown-table.tsx` (compact variant, row selection) and `section.tsx` if needed
- `src/features/dashboard/metrics.ts` (+ `metrics.test.ts`): pure helpers such as `statusSplit(row)` and `validBuckets(kpis)`
- `src/components/ui/tabs.tsx` added with the shadcn CLI (`pnpm exec shadcn add tabs`); change the generated `import { cn } from "cn"` to `@/lib/utils` (design system section 3)
- `src/components/data/kpi-tile.tsx`: keep the `dt`/`dd` contract; add an optional visual slot only if it does not break `dl > div` (or build `kpi-card.tsx` instead and leave `KpiTile` untouched)
- `src/app/(dev)/design/demos.tsx`: keep it compiling (it imports `BreakdownTable`, `ExpiryChart`, `RankingTable`); add demos for the new pieces
- `docs/design-system.md` (Tabs in the component table, dashboard pattern, chart token usage), `src/app/tokens.test.ts`
- `e2e/dashboard.spec.ts` (see below)

No server action, query, RPC, migration, RLS, proxy or routing change.

## Tests: what must stay, what changes

Must stay exactly (other specs depend on them): `h1` "Dashboard"; region names "Overview", "Certificate expiry", "By team", "By provider", "Individual ranking"; the seven tile labels with a bare number in the first `dd` of `dl > div` inside region "Overview" (also read by `pilot-day-one.spec.ts`); the expiry chart `aria-label` format; row and cell roles in the team and ranking tables with the rank in the first cell; the member strings above; no horizontal scroll at 390 px (E-10).

Must change, deliberately and reported: `e2e/dashboard.spec.ts` tests 1-3 now click the right tab before asserting the "By team" and "By provider" regions, because only the active panel is in the DOM. Add: the Explorer detail panel shows the selected row's numbers; selecting another row updates it; keyboard selection works; the member has no "By team" tab. Test 4 (RPC only) and test 5 (live update of the "In progress" tile) must pass untouched.

New unit tests: `metrics.test.ts` for the new helpers (percentages add up, zero totals, rounding follows `ratePercent`).

## How Claude will review the result (the eight standards)

1. Four states on every block: loading skeleton matches the layout, empty, per-section error with recovery, edge cases (long Vietnamese names, 0 / 1 / 500 rows, no-expiry only).
2. Performance: still one parallel `Promise.all`; client code only in the Explorer, charts and search; no new waterfall; no layout shift; bundle not worse (compare `pnpm build` output); no new dependency.
3. Colour and tokens: tokens only, status colours only for expiry, light and dark checked, chart contrast at least 3:1.
4. Icons: lucide 16 px, consistent meaning, `aria-hidden` when decorative, icon-only buttons with `aria-label` and Tooltip.
5. Accessibility: contrast, focus ring, tablist keyboard (arrows, Home, End), row selection by keyboard, chart text equivalents, reduced motion, touch targets at least 32 px.
6. Responsive: 390 px without horizontal page scroll; panes stack; tabs scroll inside their own strip.
7. Wording: plain English, same words as before for existing labels.
8. Code quality: small components, no duplicated markup, no magic numbers, no `any`, no dead code; lint, typecheck, Vitest, build and the affected Playwright specs run with real output.

## Verification (what Claude runs after Gemini)

- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- Playwright on a free port (never 3000 or 3100 of the owner and the runner): `e2e/dashboard.spec.ts`, `e2e/pilot-day-one.spec.ts` (E-1 reads the "Certificate records" tile, E-10 checks 390 px), `e2e/navigation.spec.ts`, `e2e/auth.spec.ts`, `src/app/(app)/loading-files.test.ts`
- Screenshots at 1280 and 390, light and dark, for admin, manager and member, with the seeded data, an empty database, and one failing section
- Read the diff against the eight standards and write findings as Critical / Important / Minor

## Out of scope (named so nobody builds them)

Trend arrows or sparklines over time, period or team filters, a month or quarter picker (Phase 2, WBS 15.6), approval counts (Phase 2), new SQL, a dark navy panel, avatars.
