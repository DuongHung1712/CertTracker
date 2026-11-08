# CertTracker Design System

Reference for every CertTracker screen. People and AI read this file **before building UI**.

- **Source of truth:** the code (`src/app/globals.css`, `src/components/**`). This file describes it and sets the rules; the Design System page on claude.ai is a viewing copy, synced from the code.
- **Foundational decision:** `docs/decisions.md` #14.

---

## 1. Principles

1. **A certificate record, not a spreadsheet.** Warm paper-white background, blue-black ink text, one deep teal accent: serious and trustworthy, because this is HR data.
2. **Dense data, quick to read.** Compact tables (32px rows, 13px text), numbers aligned in columns; white space is for grouping, not decoration.
3. **Status never relies on colour alone.** Every status has text and an icon; colour only speeds up recognition.
4. **Tokens only.** No hard-coded colours, font sizes or corner radii in components, so dark mode can be added later without touching components.
5. **One frame, filtered by role.** The same app shell for every role; items a role cannot use are hidden. Real permissions are decided by RLS.

---

## 2. Tokens

Token names follow the **role** a colour plays, as in shadcn/ui. Both light and dark themes are supported via semantic CSS variables in `src/app/globals.css`. Component styling never hard-codes colors; tokens adapt to the active theme. Choice is persisted in localStorage via `next-themes` with `disableTransitionOnChange` and indicated with radio indicators in the User Menu.

### 2.1 Interface colours

| Token | Light value | Dark value | Used for | Contrast (Light / Dark) |
|---|---|---|---|---|
| `background` | `#F6F7F5` | `#10171D` | Page background | — |
| `foreground` | `#15212B` | `#EBF0EE` | Main text | 15.2:1 / 15.7:1 |
| `card`, `popover` | `#FFFFFF` | `#162028` | Tables, cards, dialogs, menus | — |
| `card-foreground`, `popover-foreground` | `#15212B` | `#EBF0EE` | Text on cards | 16.4:1 / 14.3:1 |
| `muted`, `secondary` | `#EDF0EE` | `#1F2B35` | Table header, secondary background, secondary button | — |
| `muted-foreground` | `#56636C` | `#9EB2B7` | Secondary text, labels, placeholders | 5.4:1 / 7.5:1 |
| `secondary-foreground` | `#15212B` | `#EBF0EE` | Text on the secondary button | 14.2:1 / 11.2:1 |
| `primary` | `#0E5C58` | `#249C90` | Primary button, links, selected item, progress bar | 7.3:1 / 5.4:1 |
| `primary-foreground` | `#FFFFFF` | `#0D151C` | Text on `primary` | 7.8:1 / 5.5:1 |
| `primary-foreground-muted` | `#D8E4E2` | `#132226` | Muted text on the selected Explorer row | 6.0:1 / 4.9:1 |
| `primary-hover` | `#0A4744` | `#2DB4A6` | Primary button hover | 10.5:1 / 7.2:1 |
| `accent` | `#E2EFEC` | `#163332` | Selected table row, active sidebar item, row hover | — |
| `accent-foreground` | `#0E5C58` | `#48D1C1` | Text on `accent` | 6.6:1 / 7.3:1 |
| `destructive` | `#B42318` | `#F87171` | Delete button, form error text | 6.6:1 / 6.0:1 |
| `border` | `#D8DEDB` | `#253440` | Table rules, card borders, separators (decorative) | — |
| `input` | `#83908C` | `#617B8E` | Input, checkbox and select borders | 3.3:1 / 3.7:1 |
| `ring` | `#1C7C75` | `#38B2A3` | Focus ring (2px, offset 2px) | 4.7:1 / 6.9:1 |

The sidebar uses shadcn's own set, mapped to the tokens above:

| Token | Light value | Dark value |
|---|---|---|
| `sidebar` | `#FFFFFF` | `#121B22` |
| `sidebar-foreground` | `#15212B` | `#EBF0EE` |
| `sidebar-border` | `#D8DEDB` | `#253440` |
| `sidebar-accent` / `sidebar-accent-foreground` | `#E2EFEC` / `#0E5C58` | `#163332` / `#48D1C1` |
| `sidebar-primary` / `sidebar-primary-foreground` | `#0E5C58` / `#FFFFFF` | `#249C90` / `#0D151C` |
| `sidebar-ring` | `#1C7C75` | `#38B2A3` |

### 2.2 Expiry status colours

Badges look like stamps: pale background, strong text, 1px border. Each status has 3 tokens, `--status-<id>-fg | -bg | -border`. The first column is the stored `expiry_status` key; the badge shows its English label (Valid, Expiring in 60 days, Expiring soon, Expired, No expiry, Not issued).

| Status (`expiry_status` key) | id | Light fg / bg / border | Dark fg / bg / border | Icon (lucide) | Contrast fg/bg (Light / Dark) |
|---|---|---|---|---|---|
| Active | `active` | `#1D6636` / `#E7F3EB` / `#A8D2B4` | `#4ADE80` / `#132E1F` / `#235E39` | `circle-check` | 6.1:1 / 8.4:1 |
| Expiring in 60d | `expiring-60` | `#7A5200` / `#FFF5DC` / `#EDCB7E` | `#FACC15` / `#2D260D` / `#635118` | `clock` | 6.4:1 / 9.8:1 |
| Expiring Soon | `expiring-soon` | `#9A3D0B` / `#FDEADD` / `#EFB189` | `#FB923C` / `#321D12` / `#6B3B20` | `triangle-alert` | 5.9:1 / 7.0:1 |
| Expired | `expired` | `#B42318` / `#FDE8E6` / `#F0ADA7` | `#F87171` / `#321415` / `#6C282B` | `circle-x` | 5.6:1 / 6.1:1 |
| No Expiry | `no-expiry` | `#4A5560` / `#EEF1F0` / `#D3D9D6` | `#94A3B8` / `#1A232F` / `#334155` | `infinity` | 6.7:1 / 6.2:1 |
| N/A | `na` | `#4A5560` / `#EEF1F0` / `#D3D9D6` | `#94A3B8` / `#1A232F` / `#334155` | `minus` | 6.7:1 / 6.2:1 |

Status colours are used **only** for certificate expiry. Never for buttons, study status or roles.

The six tones have fairly similar lightness (hard to tell apart quickly for people with red-green colour blindness). `expired` alone is set heavier (`font-semibold` instead of `font-medium`): the status that needs the most attention gets one more cue besides colour and icon.

### 2.3 Typography

| Role | Font | Notes |
|---|---|---|
| Interface | **Be Vietnam Pro** 400/500/600/700 (`latin`, `vietnamese`) | Variable `--font-sans`; the Vietnamese subset stays because member names and course data contain Vietnamese letters; figures use `tabular-nums` |
| Codes | **Geist Mono** | Only for member codes such as `M001` and course codes |

| Style | Size / line / weight | Used for |
|---|---|---|
| `page-title` | 20 / 28 / 600 | Page title (one `h1` per page) |
| `section-title` | 15 / 22 / 600 | Section titles, dialog titles |
| `body` | 14 / 20 / 400 | Body text, forms |
| `table` | 13 / 18 / 400 | Table cells |
| `label` | 12 / 16 / 500, uppercase, `letter-spacing: 0.04em` | Column headers, group labels |
| `caption` | 12 / 16 / 400 | Captions, hints under inputs |
| `kpi` | 28 / 32 / 600, `tabular-nums` | Large figures on the Dashboard |

### 2.4 Spacing, sizes, radii, shadows

- **4px grid:** `4 · 8 · 12 · 16 · 24 · 32` (Tailwind `1 · 2 · 3 · 4 · 6 · 8`). Group elements with `gap`, not odd margins.
- **Tables:** 32px rows, cell padding `4px 10px` (a badge or an icon button is 24px + 8px); the header sits in the same horizontal scroll frame as the body and is not fixed on vertical scroll (a scroll frame with unlimited height cannot stick; not needed at the current table sizes); row action buttons use `size="icon-xs"`.
- **Controls:** 32px high in tables, filters and toolbars (the default of `Input` and `Button`); 36px in forms (`h-9` / `size="lg"`).
- **Page content:** 24px padding (16px below 640px); forms are at most 640px wide.

| Radius | Value | Tailwind class | Used for |
|---|---|---|---|
| small | 4px | `rounded-sm`, `rounded-md` | Badges, checkboxes |
| medium | 6px | `rounded-lg` | Buttons, inputs, cards, menus (the shadcn `base-nova` default) |
| large | 8px | `rounded-xl` and up | Dialogs, sheets |

Shadows are only for floating layers (popovers, menus, dialogs, toasts). Cards and tables are separated by the `border` line.

### 2.5 Charts

- **Chart palette.** Rates (completion) are drawn as a `primary` bar on a `muted` track, with no chart tokens. The expiry distribution chart uses exactly the 5 `--status-*-fg` colours (`active`, `expiring-60`, `expiring-soon`, `expired`, `no-expiry`; the only exception to the rule "status colours are only for expiry"); every bar always carries a text label and a number; a chart must have a text version for screen readers. No animation. Study status (Completed / In progress / Not started) uses `--chart-1` (done, teal), `--chart-2` (in progress, slate), `--chart-3` (not started, grey) with visible numbers and labels beside every segment.
- **Contrast.** Bar and chart graphic colours must be at least 3:1 against `card` (WCAG 1.4.11) in both light and dark modes; `src/app/tokens.test.ts` checks both the status and chart tokens.

---

## 3. Components

Base components come from **shadcn/ui**, style `base-nova` (Base UI), in `src/components/ui`, generated with `pnpm exec shadcn add <name>` (the version pinned in `package.json`, not `dlx shadcn@latest`, to avoid drifting from the lockfile). Compose components with the **`render`** prop (not `asChild`). CertTracker's own components live in the folders below; a component that belongs to a single feature goes in `src/features/<feature>/components/`.

Every component (shadcn ones included) imports `cn` from `@/lib/utils`, the version that knows the font sizes `text-page-title … text-kpi`, so `text-caption` is not stripped when it sits next to a colour class. `shadcn add` always generates `import { cn } from "cn"`: change it to `@/lib/utils` after each added component; ESLint blocks a direct `"cn"` import, so forgetting this step fails right away.

| Group | Component | Location | Main behaviour | Status |
|---|---|---|---|---|
| App shell | `AppSidebar` | `components/app-shell/` | shadcn `sidebar`; collapses to an icon column; a drawer below 1024px; items filtered by role (§4.5) | ✓ |
| | `Topbar`, `UserMenu` | `components/app-shell/` | Breadcrumb on the left; user menu on the right (email, `RoleBadge`, Sign out) | ✓ |
| | `PageHeader` | `components/app-shell/` | `page-title`, a one-line description, an action-button area on the right | ✓ |
| | `Logo`, `LogoMark` | `components/app-shell/logo.tsx` | Monogram or seal mark, optionally with the "CertTracker" wordmark (`showText`); used in the sidebar, favicon `src/app/icon.svg`; shown on `/design` | ✓ |
| Data | `DataTable` | `components/data/` | TanStack Table v8; compact; sorting (by default with the Vietnamese collation via `Intl.Collator`, because names are Vietnamese; a column declares its own `sortingFn` when "sorted" means something else, e.g. expiry by days left, not by the status string); 25-row pagination; empty / loading (5-row skeleton, respects `prefers-reduced-motion`) / error states | ✓ (multi-row selection: with the first bulk action) |
| | `FilterBar` | `components/data/` | Search box + filters (children) + "Clear filters" (shown only when a filter is active) | ✓ |
| | `EmptyState` | `components/data/` | One sentence of explanation + one action button; no illustration | ✓ |
| Status | `ExpiryBadge` | `components/status/` | Takes `expiry_status` + `days_to_expiry` + `expiry_date`; tooltip "23 days left · expires 19/10/2026" / "Expired 5 days ago · 19/10/2026" | ✓ |
| | `ComingSoonCard` | `components/status/` | Dashed 1px border `border-border`, small outlined chip with `Clock` icon and "Coming soon" in neutral tokens, title, description, full contrast text, disabled controls | ✓ |
| | `RecordStatusLabel` | `components/status/` | Completed `circle-check` · In progress `loader-circle` · Not started `circle-dashed`; `foreground` text, no status colour | ✓ |
| | `ProgressInline` | `components/status/` | 4px `primary` bar on `muted` + the % on the right | ✓ |
| | `RoleBadge` | `components/status/` | Admin / Manager / Member; `secondary` badge | ✓ |
| | `MemberCode` | `components/status/` | `M001` in the mono font, `muted-foreground` | ✓ |
| Form | `Field`, `FieldLabel`, `FieldError`…, `Input`, `Textarea`, `Checkbox`, `Switch` | shadcn `field` | Label above the input; error below it in `destructive`; shares the Zod schema with the server | ✓ (combined with React Hook Form in week 2) |
| | `EntityCombobox` | `components/entity-combobox.tsx` | Searchable select: member, course, team | ✓ |
| | Date input | `Input` | Typed dd/mm/yyyy, checked with `toIsoDate` (decisions #16) | ✓ |
| | `FileDropzone` | `components/file-dropzone.tsx` | Drag and drop an image or PDF as evidence | ✓ |
| Navigation | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | `components/ui/tabs.tsx` | shadcn `tabs` (Base UI); keyboard navigation (arrows, Home, End); horizontal scrollable strip on mobile | ✓ |
| Overlays | `Dialog`, `Sheet`, `DropdownMenu`, `Tooltip` | shadcn | See §4.2 | ✓ |
| | `ConfirmDialog` | `components/confirm-dialog.tsx` | The title names the object; the description states the consequence; the `destructive` confirm button names the exact action | ✓ |
| Feedback | `Toast` | shadcn `sonner` | Bottom right; success 4s, errors stay until dismissed (`duration: Infinity`) | ✓ |
| | `Alert` | shadcn | In-page message | ✓ |
| Dashboard | `KpiTile` | `components/data/` | `kpi` figure, `label` label, optional caption; no "change against the previous period" (there is no history, spec §11) | ✓ |

Icons: **lucide-react**, 16px (`size-4`) everywhere, the sidebar included. The CSS of shadcn's `Sidebar` sets `[&_svg]:size-4` with a higher priority than a `size-5` passed from outside, so 16px is the size actually used. An icon-only button must have an `aria-label` and a `Tooltip`.

---

## 4. Patterns

### 4.1 List page

```
PageHeader   Members · 42 people in DC34                     [+ Add member]
FilterBar    [Search by name, email, code…] [Team ▾] [Status ▾]      Clear filters
DataTable    Code │ Full name │ Email │ Team │ Certificates │ Expiring soon │ ⋯
             25 rows per page
```

The first column identifies the row (code or name), the last column is the "⋯" menu; that column is declared by the page that calls `DataTable`, it is not a built-in feature of the component. Number columns are right-aligned.

### 4.2 Create, edit, view

| Case | Use |
|---|---|
| A form with up to 6 fields (Team, Course, CertType, Provider) | `Dialog` |
| An object with child data (a member and their certificates) | Detail page `/members/[id]` |
| Quick view / quick edit of one record while keeping the table in view | `Sheet` on the right |

The save button sits at the end of the form, on the right; "Cancel" is the secondary button to its left. While saving, the button reads "Saving…" and is disabled.

### 4.3 Destructive actions

`ConfirmDialog`, for example:

> **Delete member M004 · Nguyen Van An?**
> This member's 5 certificates will be deleted too. This cannot be undone.
> [Cancel] [Delete member]

When the database **blocks** the delete (for example a course that certificates still use, `on delete restrict`), do not open a `ConfirmDialog`: show an `Alert` that gives the reason and what to do (*"This course is used by 3 certificates. Move the certificates to another course before deleting it."*).

### 4.4 Feedback

- Success: a toast that names exactly what happened, *"Added member M004"*.
- Input error: under the field, say what is wrong and how to fix it, *"This email is already used by member M002"*.
- System error: an error toast plus what to do, *"Could not save because the connection was lost. Check your network and try again."*
- Loading: a skeleton shaped like the content; no full-page spinner.
- Navigation (decision #56; decided 2026-10-31, option C): two layers.
  1. **A thin teal bar** at the very top (`NavigationProgressBar`, `components/app-shell/navigation-progress.tsx`): 3px high, `bg-primary`, `aria-hidden`. The bar appears from the click on a link until the URL changes; meanwhile its width grows gradually to about 80%. When done, it runs to 100% and fades out over 200ms. The bar only changes opacity and is never attached to or removed from the DOM, so it never shifts the layout.
  2. **The skeleton pulse** of `loading.tsx` from the moment the URL changes until the content arrives (`role="status" aria-busy="true"`).

  An in-app link must contain `<LinkPendingReporter />` to report the pending state to the bar.

  In a production build links are usually prefetched, which skips the pending state, so the bar mostly shows on navigations that are not prefetched or are slow; otherwise the skeleton takes over straight away.

### 4.5 Menu by role

| Item | Admin | Manager | Member |
|---|---|---|---|
| Dashboard | ✓ | ✓ | ✓ |
| My certificates¹ | ✓ | ✓ | ✓ |
| Members | ✓ | ✓ (own teams) | Hidden |
| Records (by person) | ✓ | ✓ (own teams) | Hidden |
| Data quality | ✓ | ✓ (own teams) | Hidden |
| Courses | ✓ | ✓ (view only) | ✓ (view only) |
| Organisation (DC / Program / Team) | ✓ | Hidden | Hidden |
| Import / Export | ✓ | Hidden | Hidden |
| Settings | ✓ | Hidden | Hidden |

¹ Shown only when the account is linked to a member (`profiles.member_id` is not null).

Hiding is only UX; every permission is still enforced by RLS.

### 4.6 Admin Dashboard
- **Layout:** 3-column independent flow grid on desktop (`lg:grid-cols-12`: Left `lg:col-span-3`, Center `lg:col-span-6`, Right `lg:col-span-3`). On mobile (<1024px), reordered with Center leading first (`lg:order-2`), Right second (`lg:order-3`), and Left third (`lg:order-1`) so high-priority KPI cards and Explorer are immediately visible without long scrolling.
- **Header:** Title "Dashboard", server greeting with time-of-day in `Asia/Ho_Chi_Minh` ("Good morning, <name>"), "Filters" button (smooth scroll & focus to `#dashboard-filters`, honoring `prefers-reduced-motion`), "Download data" (`ExportLinks`), and "+ Add certificate" link.
- **Left Column:**
  - Workspace ledger / Admin profile card (`AdminProfileCard`): Initials avatar, full name (falls back to email and "System administrator" for unlinked admin accounts), "Admin" role badge, tenure / email, and embedded Phase 2 track specialization Coming Soon card.
  - Quick actions card (`AdminQuickActionsCard`): 4 real actions ("Add certificate" -> `/records`, "Invite member" -> `/members`, "Import Excel" -> `/import`, "Export CSV" -> triggers export). No fake keyboard shortcut chips (⌘N, INV, XLS, CSV).
  - Scope summary / Department metrics: active counts.
- **Center Column:**
  - **Overview (`role="region"` / `aria-label="Overview"`):** 4 tall KPI cards with numbers in `dl > div` (`dt` label, bare number in first `dd`):
    1. "Valid certificates": Inverted solid-teal highlight card (`bg-primary text-primary-foreground`) with circular progress ring SVG (`valid` of `total` completed certificates).
    2. "Expiring within 60 days": Amber-accented card with embedded accessible "Certificate expiry" region (`role="region"` / `aria-label="Certificate expiry"` with `role="img"` bar and `aria-label` screen reader summary), showing count with `<= 30` days left.
    3. "Expired": Rose-accented card showing overdue count, positive empty state ("All up to date"), or `ChartLoadError` on query failure.
    4. "Waiting for approval": Dashed placeholder tile with "—" and a single "Soon" chip.
    - Followed by a slim compact stat strip for the e2e contract: Active members, Certificates, Completed, In progress.
  - **Tab Strip:** View switcher tab pills with `Overview` (active), and coming-soon disabled tabs `Approvals`, `Goals`, `Skills` (accessible names "Approvals Soon", "Goals Soon", "Skills Soon").
  - **Filter Row (`#dashboard-filters`):** Client-side filter bar directly above Explorer with "Active filters" count chip, "Clear filters" action, status filter dropdown, volume filter dropdown, and live search.
  - **Explorer (`By team` and `By provider` regions):** Master-Detail board with tab pills and count chips on top, solid `bg-primary` selected row (outlined avatar and count chip, `primary-foreground-muted` subtitle; no permanent ring), keyboard focus shown only by a `focus-visible` ring with a `ring-offset-card` offset (the ring has to reach 3:1 on the card gap, not on the teal; checked in `tokens.test.ts`), and a live detail panel on the right with sub-metric cards, study status split, validity split, and a totals footer with action buttons (copy summary, open the certificates).
  - **Individual ranking (`Individual ranking` region):** Individual leaderboard table with rank in the first cell, member info, counts, and completion.
- **Right Column:**
  - **Needs attention (`role="region"` / `aria-label="Needs attention"`):** Live feed of real issues requiring action (expired certificates most overdue first, certificates expiring within 30 days, data quality issue summary if issues exist) with direct links to `/records?search=...` or `/data-quality`.
  - **Coming Soon Card:** Single consolidated `ComingSoonCard` previewing upcoming modules ("Compliance assistant", "Monthly summary", "Risk alerts"), with honest "Not available yet." descriptions and zero fake buttons or inputs.
- **Real data constraints & banned copy:**
  - No invented mock strings (no "Audit Hash #0E5C-TC9", "Legal Expiration Guard", "HRIS sync", "Lead: Minh Pham", "4 pending proofs").
  - No dead controls or fake shortcut keys.
  - Query failure error isolation via `SectionError` and `ChartLoadError`.

### 4.7 Member Dashboard
- **Header:** Title "Dashboard", greeting with time-of-day in `Asia/Ho_Chi_Minh` ("Good morning, <name>"), Export data links, and primary action with a single `+` icon ("Add certificate" opening the record sheet).
- **Attention Banner:** Expiry palette alert banner for the certificate expiring soonest within 30 days (expiring-soon tokens) or already expired (expired tokens, "Expired on <date>"), with "Upload proof" action button opening the record sheet. Hidden when nothing expires within 60 days.
- **Overview:** 4 personal KPI cards for the member's own records inside region "Overview" (`dl > div` with bare numbers in the first `dd`):
  1. "Recorded certificates": inverted solid-teal highlight card with "N valid of M".
  2. "Expiring soon": the one with the least days left, with the course and "N days left".
  3. "In progress": count plus up to two mini progress bars with course name and percent.
  4. "Expired": count; 0 shows a check icon and "All up to date".
- **Member Profile:** Initials avatar, full name, career role and team, years of experience (`formatYoe`), and embedded "Specialization focus" coming-soon card.
- **My Certificates List:** Table/list view with filter tabs (`All`, `Valid`, `Expiring within 60 days`, `In progress`) with item counts, sort dropdown ("Expiry" default / "Name"), status badge (`ExpiryBadge`), dates, inline progress, edit icon button, and proof link button (`/api/records/${id}/evidence`). Maximum 8 rows with a "View all certificates" link to `/me` when there are more.
- **Coming Soon Cards:** Stack of non-interactive preview cards (`ComingSoonCard` with `disabled` and `aria-disabled="true"`) for upcoming modules: "Ask about certificates" (with a disabled question box), "My skills", "Quarterly goals", "Next career role", "Certificate review" and, inside the profile card, "Focus area". Each has the chip "Coming soon" and a one-line description ending "Not available yet.".
- **Responsive:** Three desktop zones collapse into a single column on mobile (390px) without horizontal scroll.

### 4.8 Manager Dashboard
- **Header:** Title "Dashboard", server-built greeting with time-of-day in `Asia/Ho_Chi_Minh` ("Good morning, <name>"), subtitle "You look after <team names> (<N> members)." (or "No teams assigned yet." if unassigned), primary button "View certificates" (`/records`), and an outlined "Download team data" using `ExportLinks`.
- **Team filter:** Group "Filter by team scope" with pills "All teams" and one per managed team (no counts, no period selector). The only download is the header "Download team data"; the only "View certificates" button is in the header.
- **Overview:** region "Overview" with the readiness donut and three KPI tiles scoped to the manager's teams (`dl > div` with bare numbers in the first `dd`):
  1. "Team readiness" donut: centre percentage (valid share of completed certificates), "{valid} of {completed} completed certificates" under the ring, and one legend row "Members without a completed certificate: {n}". With no completed certificates the centre shows an em dash. Valid and Expired counts are not repeated (the Expired tile shows the latter).
  2. "Expiring within 60 days": count of in-scope completed certificates with 0-60 days left, caption "{n} with 30 days or less".
  3. "Expired": count of in-scope overdue certificates; "Past due: <most overdue member (course)>".
  4. "Waiting for approval": dashed placeholder tile with the value "—" (no number that looks real) and a Soon chip.
- **Needs attention:** region "Needs attention" next to the Overview: expired certificates only, most overdue first, each with a "Resolve" link (no count badge: the rows are the count) to `/records?search=<name>`. Certificates that are still valid are in Next to expire, so no certificate appears in both.
- **Allocated scope / Quick actions:** team names with member counts; links "Add certificate" (`/records`) and "View team data quality" (`/data-quality`) only.
- **Tab Strip:** View switcher tab pills with `Overview` (active), and coming-soon disabled tabs `Approvals`, `Goals`, `Skills` (accessible names "Approvals Soon", "Goals Soon", "Skills Soon"). These and the "Waiting for approval" tile are the only places approvals, goals and skills appear.
- **Next to Expire:** Table of in-scope completed certificates with 0-60 days left (max 8, soonest first) with member initials avatar, course, expiry date, `ExpiryBadge`, and link "View" to `/records`.
- **Team Readiness:** ranked list of in-scope members (rank `#n`, valid / in progress counts, segmented bar) plus the selected member's details and the link "View member certificates" (`/records?search=<name>`). It is the only ranking on this page (the manager loader does not call `getRanking`).
- **People without certificates yet:** names, team and count only.
- **Certificates Earned by Month:** 6-month bar chart (`MonthlyEarnedChart`) with the real total and a screen reader summary, no growth percentage.
- **Planned Exams:** List of upcoming exams scheduled within 60 days with member name, course, formatted date, and days left label.
- **Automated reminders:** region with two facts from `vercel.json`: "Members get an expiry email every Monday at 08:00 (Vietnam time)." and "The monthly report goes out on the 1st of each month." No links (`/settings` is admin only).
- **Coming Soon Card:** one `ComingSoonCard` "Ask about my team" (also covers risk alerts), a static line ending "Not available yet.", no input, chips or buttons.
- **No mock data:** no invented values or strings (no program badge, growth percentage, "last sent" data, fallback team name or job title) and no button without a real link or handler. The test `manager-copy.test.ts` scans the manager folder for this.
- **Responsive:** Multi-column layout collapsing gracefully to a single column on mobile (390px) with zero horizontal scroll.

---

## 5. Wording and formats

- The interface is in **English** (English first; a bilingual English–Vietnamese interface comes after Release 1, decision #51). Data (course names, providers, people's names) stays exactly as entered.
- Sentence case. Buttons are a verb plus the object, and an action keeps one name through the whole flow: "Add member", "Save changes", "Delete course". Never "Submit", "OK" or a bare "Confirm".
- Name things the way users recognise them: "Certificates expiring soon", not "expiry_status".
- Dates: `dd/MM/yyyy` ("today" is taken in `Asia/Ho_Chi_Minh`, `src/lib/dates.ts`).
- Numbers and money in the English format: `1,250,000`, `3,500,000 ₫`, `$150` (`src/lib/format.ts`, `src/lib/money.ts`); percentages `75%`. Mixed currencies are never summed.
- No emoji in the interface.
- **One word per thing**: certificate (not record, credential or badge), member (not learner, person or headcount), course, evidence, valid, expired. "Record" is a database word and stays out of the UI. `src/lib/ui-copy.test.ts` fails on the rejected words.
- Plain, short English: sentences under about 15 words; no symbols or abbreviations in labels ("30 days or less", "years of experience", not "≤ 30d", "YoE", "exp").
- Expiry words come from one place: `expiryMeta` (`src/components/status/expiry.ts`). The aggregate tile is "Expiring within 60 days"; the badge tiers are "Expires in 31–60 days" and "Expires within 30 days".
- Count with `pluralize()` and show time left with `daysLeftLabel()` (`src/lib/plural.ts`); never write `n === 1 ? ... : ...` by hand. 0 days reads "Expires today".
- Delete destroys a thing; Remove takes something off without destroying it (evidence, a file, manager access).
- Errors say what happened, then how to fix it. No "please", no raw database text. Contact line: "Ask your admin".
- No contractions ("cannot", "do not"); British spelling for existing words (organisation, centre, catalogue); "email" without a hyphen.
- **Coming soon** uses `ComingSoonCard`: chip "Coming soon", a plain title, one line ending "Not available yet.", disabled controls only, no dates, no fake status, no numbers that look real.

---

## 6. Accessibility

- Text is at least 4.5:1 on its background; control borders, the focus ring and meaningful icons at least 3:1 (the tables in §2.1 and §2.2 are checked by tests).
- The `ring` focus ring, 2px + 2px offset, is always visible for keyboard users (`focus-visible`), on the `Sidebar` background too. The CSS rule is not in a layer, so it wins over shadcn's default `outline-hidden`.
- Every action works with the keyboard: row menus, dialogs (focus trap, `Esc` to close), comboboxes.
- A status always has text; decorative icons have `aria-hidden`. Detail shown only on hover (such as the tooltip of `ExpiryBadge`) always gets an `sr-only` copy too: a tooltip cannot be opened by touch and not every browser attaches `aria-describedby`.
- Landmarks: `<nav aria-label="Main navigation">` wraps the sidebar menu; `<header>` (Topbar) is a sibling of `<main>`, not nested inside it, because nesting would lose the "banner" role. A "Skip to content" link (skip link) opens every page in the app frame.
- A visible name is never replaced by `aria-label`: if a button already has visible text (such as the name and role in the account menu), add context in front of it with `sr-only` instead of overriding it with `aria-label` (WCAG 2.5.3 Label in Name).
- Respect `prefers-reduced-motion`: stop every animation after 1 loop instead of looping forever (skeleton, spinner) to avoid random flicker; the navigation bar stays still at 100% width and does not run; the slide animation of sheets and the sidebar is turned off and only the opacity change is kept.
- Minimum hit area 32×32px (24×24px for an icon in a table cell with space around it).

---

## 7. Responsive

| Width | Change |
|---|---|
| ≥ 1024px | Fixed sidebar (collapsible) |
| < 1024px | The sidebar becomes a drawer, opened with the menu button on the Topbar; it closes itself when you navigate to another page |
| < 640px | Single-column forms; tables scroll horizontally in their own frame with a sticky first column; `PageHeader` stacks the buttons under the title |

The page never scrolls horizontally; only a table scrolls inside its own frame (`SidebarInset` needs `min-w-0`: by default a flex item does not shrink below its longest inner content, here a `white-space: nowrap` table).

---

## 8. Do not

- Hard-code colours, font sizes or corner radii in CertTracker components (`bg-teal-700`, `#0E5C58`, `text-[13px]`). The generated files in `src/components/ui/` (shadcn) are exempt: their defaults (`text-sm`/`text-xs`…) equal the `body`/`caption` values, so they do not drift visually; edit them only when a value really differs from a token (done in `RoleBadge`: `rounded-4xl` → `rounded-sm`).
- Use status colours for anything other than certificate expiry.
- Emoji as icons; decorative gradients; cards with a coloured left stripe; shadows on cards or tables.
- Corner radii larger than 8px.
- Full-page spinners; illustrations in empty states.
- Show a button and then disable it for lack of permission: hide it.

---

## 9. Changing the design system

1. Change the token in `src/app/globals.css` and the matching table in this file **in the same commit**.
2. Run the contrast tests (`pnpm test`); if a pair falls below the threshold, fix the colour, do not lower the threshold.
3. Check by eye on the `/design` page (`src/app/(dev)/design/page.tsx`, which returns 404 in production).
4. Sync the Design System page on claude.ai.
5. Big decisions (changing the accent colour, adding dark mode) get an entry in `docs/decisions.md` (see #14, #62).

## 10. Themes

- **Light theme**: Warm paper-white (`#F6F7F5`) background, blue-black ink text (`#15212B`), deep teal accent (`#0E5C58`).
- **Dark theme**: Dark slate paper (`#10171D`) background, pale ink text (`#EBF0EE`), luminous teal accent (`#249C90`), muted text (`#9EB2B7`), input borders (`#617B8E`). Both themes meet WCAG 2.1 AA text (>= 4.5:1) and UI boundaries/focus (>= 3:1). Controlled via `.dark` class on the root, persisted in localStorage (`next-themes` with `disableTransitionOnChange`), and switched via user menu radio items.
