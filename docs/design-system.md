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
| | `Topbar`, `UserMenu` | `components/app-shell/` | Breadcrumb on the left; user menu on the right (email, `RoleBadge`, Profile, Theme, Sign out) | ✓ |
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
| | `DateField` | `components/date-field.tsx` | Label + one text input (`dd/mm/yyyy`, numeric keypad) that inserts the slashes while typing (`formatDateInput`) + a calendar button (`CalendarDays`, `aria-label` "Choose <label> from calendar") that opens the browser's date picker through a hidden `type="date"` input; optional `max` (`YYYY-MM-DD`) limits the picker only; checked with `toIsoDate` (decisions #16); slashes the user typed are kept, and a day or month of 1-9 is padded once the next part starts; `required` adds the red star and `aria-required` | ✓ |
| | `RequiredMark` | `components/required-mark.tsx` | A red `*` (`text-destructive`, `aria-hidden`) after a required field's label; the control also gets `aria-required` | ✓ |
| | `FileDropzone` | `components/file-dropzone.tsx` | Drag and drop one file; `accept` takes MIME types or extensions (`.xlsx,.csv`), `hint` and `wrongTypeMessage` override the evidence wording. Evidence by default; also the member import dialog | ✓ |
| Navigation | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | `components/ui/tabs.tsx` | shadcn `tabs` (Base UI); keyboard navigation (arrows, Home, End); horizontal scrollable strip on mobile | ✓ |
| | `FormSheet` | `components/form-sheet.tsx` | Right-hand `Sheet` around a form: title, scrolling fields, one root error line, Cancel and Save ("Saving…" while pending); used by the certificate and course forms | ✓ |
| | `OptionSelect` | `components/option-select.tsx` | `Select` over `{ id, name }` options with a placeholder (Provider, Certificate type, Prepares for) | ✓ |
| Overlays | `Dialog`, `Sheet`, `DropdownMenu`, `Tooltip` | shadcn | See §4.2 | ✓ |
| | `ConfirmDialog` | `components/confirm-dialog.tsx` | The title names the object; the description states the consequence; the `destructive` confirm button names the exact action | ✓ |
| Table helpers | `rowActionsColumn`, `useConfirmedDelete`, `AddButton`, `ExternalLinkCell` | `components/data/` | `rowActionsColumn`: trailing "Actions for <row>" menu with Edit and Delete, added only for users who can manage the table. `useConfirmedDelete`: asks first, runs the delete, reports it in a toast. `AddButton`: when the list cannot be added to yet, it is disabled and the reason ("Add a provider first.") shows beside it, tied to the button by `aria-describedby`. `ExternalLinkCell`: the Link column | ✓ |
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

### 4.2b Catalogue (`/courses`)

The page is titled "Catalogue" and has two tabs, **Certificates** and **Courses**. Everyone reads; only the admin sees the add button, the row menu and the Certificate types and Providers sections below the tabs. Both tables have a Link column (`ExternalLinkCell`).

- **Approval badge (`ApprovalBadge`, `components/status/record-status.tsx`):** next to the Completed status in the records table and the member list; "Waiting for approval" is a `secondary` badge with an hourglass, "Returned" a `destructive` badge with an undo icon (text plus icon, never colour alone); Approved shows nothing. It uses the badge variants, no `--status-*` tokens (those are for expiry only).
- **Kind badge:** `secondary` badge, `rounded-sm`, with `CERTIFICATE_KIND_LABEL`: "Exam" or "Course completion". It appears in the Certificates table, in the records table next to the certificate name, and in the certificate picker options ("AWS Solutions Architect Associate · Exam"). A credential from finishing a course is a course completion, never a certificate, in text, toasts and dialogs (`CERTIFICATE_KIND_NOUN` picks the noun).
- **Certificate form:** Kind first. The Course picker appears only for a course completion and lists courses that grant nothing yet (plus the edited completion's own). Empty states differ: "No courses yet. Add a course first." and "Every course already grants a completion." The title follows the selected kind.
- **Course form:** Name, Provider, Duration (hours), Cost and Currency, Refundable, Course link, Prepares for (exam certificates only).
- **Courses table:** Name, Provider, Duration, Cost, Refundable, Link, Prepares for, Grants ("Completion: <name>"); Grants is reached by the table's own scroll at 1280 px.
- **Record form, Course studied field:** hidden until a certificate is chosen; for an exam an optional `Select` whose options are the courses that prepare for it, with "None (self-study)"; for a course completion read-only, showing the granting course. A saved course that no longer prepares for the certificate stays listed as "<name> (no longer linked to this certificate)". The records table shows the column from `xl`.

Course form (`Sheet`): the estimated study time is labelled "Duration (hours)". The "Refund conditions" `Textarea` appears only while "Refundable" is on; turning it off clears the text. The courses table shows the conditions truncated under the "Yes" badge, with the full text in a `Tooltip`.

The save button sits at the end of the form, on the right; "Cancel" is the secondary button to its left. While saving, the button reads "Saving…" and is disabled.

### 4.2a Fields that depend on a status

When one field (a status) decides which other inputs make sense, render only the inputs that apply; do not hide the rest with CSS. A hidden input would still be validated and could block Save. Keep the rules as a pure module next to the schema (`features/records/status-fields.ts`: `visibleFields(status)` for what to show, `valuesOnStatusChange(next, current)` for the value to set and the fields to empty). On change, apply the value, empty the listed fields and clear their errors (`form.clearErrors`). The schema and the submitted payload do not change.

In the certificate form, mark the required fields with `RequiredMark` after the label text and `aria-required` on the control, and put one `* Required` line (caption, `muted-foreground`) at the top of the form. Optional fields get no mark and no "(optional)" text. Progress is required when In progress and Issue date when Completed. Notes is shown to Admin and Manager only (a member's save leaves stored notes untouched), and the Evidence upload only when the status is Completed. A field whose rule is not obvious gets a `FieldDescription` (Issue date: the expiry date is worked out from the course). The form has `noValidate`, so the schema shows every error.

### 4.3 Destructive actions

`ConfirmDialog`, for example:

> **Delete member M004 · Nguyen Van An?**
> This member's 5 certificates will be deleted too. This cannot be undone.
> [Cancel] [Delete member]

When the database **blocks** the delete (for example a course that certificates still use, `on delete restrict`), do not open a `ConfirmDialog`: show an `Alert` that gives the reason and what to do (*"This course grants the completion <name>. Delete or change that completion first."*).

### 4.4 Feedback

- Success: a toast that names exactly what happened, *"Added member M004"*.
- Input error: under the field, say what is wrong and how to fix it, *"This email is already used by member M002"*.
- System error: an error toast plus what to do, *"Could not save because the connection was lost. Check your network and try again."*
- Loading: a skeleton shaped like the content; no full-page spinner. The dashboard is the exception: three roles see three layouts, so `dashboard/loading.tsx` is role-neutral (header, one row of four compact cards, two content blocks) and takes only the width the page has.
- Password fields use `PasswordInput` (`components/password-input.tsx`): a ghost icon button (Eye / EyeOff, 16px, 32px target, `aria-pressed`, "Show password" / "Hide password") that never submits the form. Form errors attach `aria-invalid` only to the field that is wrong.
- Navigation (decision #56; decided 2026-10-31, option C): two layers.
  1. **A thin teal bar** at the very top (`NavigationProgressBar`, `components/app-shell/navigation-progress.tsx`): 3px high, `bg-primary`, `aria-hidden`. The bar appears from the click on a link until the URL changes; meanwhile its width grows gradually to about 80%. When done, it runs to 100% and fades out over 200ms. The bar only changes opacity and is never attached to or removed from the DOM, so it never shifts the layout.
  2. **The skeleton pulse** of `loading.tsx` from the moment the URL changes until the content arrives (`role="status" aria-busy="true"`).

  An in-app link must contain `<LinkPendingReporter />` to report the pending state to the bar.

  In a production build links are usually prefetched, which skips the pending state, so the bar mostly shows on navigations that are not prefetched or are slow; otherwise the skeleton takes over straight away.

### 4.5 Menu by role

| Item | Admin | Manager | Member |
|---|---|---|---|
| Dashboard | ✓ | ✓ | ✓ |
| My learning¹ | ✓ | ✓ | ✓ |
| Members | ✓ | ✓ (own teams) | Hidden |
| Learning (by person) | ✓ | ✓ (own teams) | Hidden |
| Data quality | ✓ | ✓ (own teams) | Hidden |
| Courses | ✓ | ✓ (view only) | ✓ (view only) |
| Organisation (DC / Program / Team) | ✓ | Hidden | Hidden |
| Import / Export | ✓ | Hidden | Hidden |
| Settings | ✓ | Hidden | Hidden |

¹ Shown only when the account is linked to a member (`profiles.member_id` is not null).

Hiding is only UX; every permission is still enforced by RLS.

`/profile` opens from the user menu ("Profile"), not the sidebar: `PageHeader`, Account card (the name edits inline with a pencil button, `NameField`; the email is read-only), Your scope (managers only), My career (linked accounts only), Change password (an error is shown under, and marks, only the wrong field). Each region has its own `SectionError`.

### 4.6 Admin Dashboard
An admin approves, renews and fixes, so the page is four numbers, one list and the Explorer; nothing else competes for attention. Single column, `gap-6`.
- **Header:** title "Dashboard", greeting with time-of-day in `Asia/Ho_Chi_Minh` ("Good morning, <name>"), and "Export CSV" (`ExportLinks`).
- **Overview (`aria-label="Overview"`):** four tiles in one row (`grid-cols-2 lg:grid-cols-4`): "Waiting for approval" (`WaitingTile`, link to `/records?approval=waiting`), "Valid certificates" (`SummaryTile`: "of N completed · X%", footer "N active members"), "Expiring in 60 days" ("N within 30 days"), "Expired". `SummaryTile` (`components/summary-tile.tsx`) is one `dl > div` with a label, a bare number, one explaining line and a footer; `tone` colours only the border and the number (`warning`, `danger`, otherwise neutral). Exam certificates only, Approved only. If the KPI query fails the region shows one `SectionError`.
- **Needs attention (`AdminNeedsAttention`):** live feed from the records: expired certificates (most overdue first), then certificates expiring within 30 days (soonest first), at most `ADMIN_ATTENTION_LIMIT` (10), then one "Data quality" row ("<n> issues to check") that the cut never drops. When cut it ends with "Showing 10 of N. View all certificates". Rows are links with a `focus-visible` ring; tone shows in the icon and the hover background, never a side stripe. Empty: "Nothing needs attention". If data quality fails the row says "Data quality could not be loaded".
- **Explorer:** opens on the team tab (tabs By team, By certificate type, By provider, Popular certificates; master list and detail panel; the selected row is solid `bg-primary`). With no certificates the Explorer is replaced by the "No certificates yet" empty state.
- **Individual ranking:** a closed `<details>` at the bottom; one click opens `RankingTable`.
- **Removed on purpose** (they live elsewhere or were not real): profile card, quick actions, planned features, earned-by-month chart, stat strips, course-completion strip, the Soon tabs.
- **Failures:** every query settles on its own and a failure shows in its own region (`SectionError`); a failed query is never shown as "All clear" or a default value.
- **Banned copy:** no invented strings, no audit, pool, department, credential or "verified" wording, no dead controls. `admin-copy.test.ts` scans the admin components.

### 4.7 Member Dashboard
- **Header:** Title "Dashboard", greeting with time-of-day in `Asia/Ho_Chi_Minh` ("Good morning, <name>"), Export data links, and primary action with a single `+` icon ("Add certificate or course completion" opening the record sheet).
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
A manager approves what members submit, chases expiring certificates and sees who is ready: four numbers, one list, the team. Everything else lives in Learning, Members and Data quality.
- **Header:** title "Dashboard", greeting, subtitle "You look after <team names> (<N> members).", primary "View learning" (`/records`) and outlined "Download team data" (`ExportLinks`).
- **Team filter:** pills "All teams" plus one per team, shown only when the manager looks after more than one team (the same condition adds the Team column below).
- **Overview:** four `SummaryTile`s in one row: "Waiting for approval" (the manager's own item is not counted), "Expiring in 60 days", "Expired", "Team ready" (valid share of completed certificates; "—" and "No certificates yet" when none; footer "N members without a certificate").
- **Needs attention (`ManagerAttentionList`):** one list, expired first (most overdue first), then expiring (soonest first), then planned exams within 60 days, then members with no certificate. Six rows, then "Showing 6 of N" and "Open Learning". Each row opens that person in Learning (`/records?search=<name>`).
- **My team (`ManagerTeamTable`):** every member with valid, in-progress and expired counts and one plain status (Ready, Needs renewal, No certificate yet); the name links to their rows in Learning.
- **Removed on purpose:** allocated scope, quick actions, automated reminders, earned-by-month chart, planned exams, next to expire, people without certificates, readiness league, completion strips, Soon tabs, "Ask about my team".
- **No mock data:** no invented values or strings and no button without a real link or handler (`manager-dashboard-view.test.tsx` asserts this).
- **Responsive:** tiles 2 × 2 on a phone, one column at 390px without horizontal scroll.

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

## 10. Logo & Favicon

- **Light theme**: Warm paper-white (`#F6F7F5`) background, blue-black ink text (`#15212B`), deep teal accent (`#0E5C58`).
- **Dark theme**: Dark slate paper (`#10171D`) background, pale ink text (`#EBF0EE`), luminous teal accent (`#249C90`), muted text (`#9EB2B7`), input borders (`#617B8E`). Both themes meet WCAG 2.1 AA text (>= 4.5:1) and UI boundaries/focus (>= 3:1). Controlled via `.dark` class on the root, persisted in localStorage (`next-themes` with `disableTransitionOnChange`), and switched via user menu radio items.

### 10.1 Visual style (decision #68, #69)

A second axis, independent of light/dark: `data-style` on `<html>`: `classic` (Classic Swiss, default), `vault` (Credential Vault), or `nordic` (Nordic Heritage). Switched by the topbar toggle, the user menu or Alt+V; stored in localStorage (`certtracker-style`) and applied before first paint by `STYLE_INIT_SCRIPT` in `src/components/style-provider.tsx`.

| Token | Vault light | Vault dark | Nordic light | Nordic dark |
|---|---|---|---|---|
| `--background` | `#F2F5F4` | `#0A0F13` | `#F7F5EE` | `#151815` |
| `--card`, `--popover` | `#FFFFFF` | `#10171D` | `#FFFFFF` | `#1C201C` |
| `--border` | `#CAD6D3` | `#1E3837` | `#E2DDD0` | `#2C322C` |
| `--input` (field border, >= 3:1 on page, card and field) | `#7A8783` | `#4F7F7B` | `#7D847B` | `#5C705E` |
| `--primary` | `#0E5C58` | `#249C90` | `#0E4D45` | `#339987` |
| `--ring` | `#1C7C75` | `#38B2A3` | `#D95A1E` | `#EA6C2D` |

Text colours stay those of the active style and light/dark theme. `src/app/tokens.test.ts` checks the vault and nordic pairs. The vault rules live in `globals.css` under `html[data-style="vault"]`; the nordic rules live under `html[data-style="nordic"]`; components only add hooks (`data-slot`, `data-verified`, `data-status-tone`), never style classes of their own. `data-verified="true"` marks only an item that counts (approved and not renewed) and is still valid. Pulsing status dots stop under `prefers-reduced-motion`.

What Vault adds on top of the tokens, all from CSS hooks (Classic draws none of it):

- **Status stamps** (`data-stamp` on `RecordStatusLabel`, `ApprovalBadge`, `CatalogueStatusBadge`): one mono uppercase stamp per status, coloured from the status tokens. Not started = N/A, In progress = primary, Completed = active, Waiting and a pending proposal = expiring-soon, Returned and a rejected proposal = expired.
- **Held credential**: an approved, not renewed item gets a sealed icon (`data-sealed`) and a record line (`.vault-credential-strip`: Issued, Valid to, Holder code). Only what really counts looks like a certificate.
- **Live dot**: only on a counted credential (`ExpiryBadge counted`); a Waiting, Returned or renewed item shows its expiry without it.
- **Ledger tables**: mono column heads, 1px column rules, tabular numerals.
- Mono is for labels, codes, dates and measures; KPI figures use the body face with tabular numerals.

What Nordic Heritage adds on top of the tokens, all from CSS hooks:

- **Warm tactile craft & heritage ground**: Warm linen paper (`#F7F5EE` light) and deep roast charcoal (`#151815` dark) with natural pine green (`#0E4D45` / `#339987`) and warm sand / forest borders (`#E2DDD0` / `#2C322C`).
- **Terracotta accents** (`#D95A1E` light, `#EA6C2D` dark): high-visibility keyboard focus rings (skill role targets were removed, decision #70).
- **100% solid, opaque table headers and sticky cells**: (`#EFECE4` light, `#232823` dark) preventing scroll bleed-through.
- **Zero gradients & strict anti-slop**: Solid crisp 1px borders, high-contrast surfaces, and WCAG AA >= 4.5:1 text contrast.
