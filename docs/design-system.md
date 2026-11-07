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

Token names follow the **role** a colour plays, as in shadcn/ui. Only a light theme exists; dark mode is added later by redeclaring the same token names (no component changes).

### 2.1 Interface colours

| Token | Light value | Dark value | Used for | Contrast (Light / Dark) |
|---|---|---|---|---|
| `background` | `#F6F7F5` | `#10171D` | Page background | — |
| `foreground` | `#15212B` | `#EBF0EE` | Main text | 15.2:1 / 15.7:1 |
| `card`, `popover` | `#FFFFFF` | `#162028` | Tables, cards, dialogs, menus | — |
| `card-foreground`, `popover-foreground` | `#15212B` | `#EBF0EE` | Text on cards | 16.4:1 / 14.3:1 |
| `muted`, `secondary` | `#EDF0EE` | `#1F2B35` | Table header, secondary background, secondary button | — |
| `muted-foreground` | `#56636C` | `#94A3A8` | Secondary text, labels, placeholders | 5.4:1 / 6.3:1 |
| `secondary-foreground` | `#15212B` | `#EBF0EE` | Text on the secondary button | 14.2:1 / 11.2:1 |
| `primary` | `#0E5C58` | `#249C90` | Primary button, links, selected item, progress bar | 7.3:1 / 5.4:1 |
| `primary-foreground` | `#FFFFFF` | `#0D151C` | Text on `primary` | 7.8:1 / 5.5:1 |
| `primary-hover` | `#0A4744` | `#2DB4A6` | Primary button hover | 10.5:1 / 7.2:1 |
| `accent` | `#E2EFEC` | `#163332` | Selected table row, active sidebar item, row hover | — |
| `accent-foreground` | `#0E5C58` | `#48D1C1` | Text on `accent` | 6.6:1 / 7.3:1 |
| `destructive` | `#B42318` | `#F87171` | Delete button, form error text | 6.6:1 / 6.0:1 |
| `border` | `#D8DEDB` | `#253440` | Table rules, card borders, separators (decorative) | — |
| `input` | `#83908C` | `#5A7385` | Input, checkbox and select borders | 3.3:1 / 3.3:1 |
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
> This member's 5 certificate records will be deleted too. This cannot be undone.
> [Cancel] [Delete member]

When the database **blocks** the delete (for example a course that certificate records still use, `on delete restrict`), do not open a `ConfirmDialog`: show an `Alert` that gives the reason and what to do (*"This course is used by 3 records. Move the records to another course before deleting it."*).

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

### 4.6 Dashboard
- **Header:** Title, subtitle timestamp, and action buttons: "Filters" button (scrolls to/focuses filter controls) and primary action with 16px icon ("View records" for admin/manager, "My certificates" for member).
- **Overview:** 4 tall hero KPI cards (~240px, `KpiCard`) with numbers in the upper half and real mini charts in the lower half (`RecordsMiniChart`, `ValidMiniChart`, `ExpiringGaugeMiniChart`, and positive empty state `ExpiredMiniChart`), followed by a slim compact stat strip (Active members, Completed, In progress). All inside region "Overview", `dl > div` with bare number in the first `dd`.
- **Certificate Expiry:** Compact horizontal strip (~120px) positioned directly above Explorer, with exact `role="img"` and `aria-label` contract.
- **Filter Row:** Client-side filter bar directly above Explorer with "Active filters" count chip, "Clear filters" action, status filter dropdown, volume filter dropdown, and live search.
- **Explorer:** Master-Detail board with tab pills and count chips on top, solid `bg-primary` row for selected item (contrast ≥ 4.5:1, visible focus ring), and live detail dossier on the right with sub-metric cards, study status split, validity split, and a totals footer with action buttons (copy summary, open in records).
- **Ranking:** Individual leaderboard (admin/manager only).

---

## 5. Wording and formats

- The interface is in **English** (English first; a bilingual English–Vietnamese interface comes after Release 1, decision #51). Data (course names, providers, people's names) stays exactly as entered.
- Sentence case. Buttons are a verb plus the object, and an action keeps one name through the whole flow: "Add member", "Save changes", "Delete course". Never "Submit", "OK" or a bare "Confirm".
- Name things the way users recognise them: "Certificates expiring soon", not "expiry_status".
- Dates: `dd/MM/yyyy` ("today" is taken in `Asia/Ho_Chi_Minh`, `src/lib/dates.ts`).
- Numbers and money in the English format: `1,250,000`, `3,500,000 ₫`, `$150` (`src/lib/format.ts`, `src/lib/money.ts`); percentages `75%`. Mixed currencies are never summed.
- No emoji in the interface.

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
5. Big decisions (changing the accent colour, adding dark mode) get an entry in `docs/decisions.md`.

## 10. Themes

- **Light theme**: Warm paper-white (`#F6F7F5`) background, blue-black ink text (`#15212B`), deep teal accent (`#0E5C58`).
- **Dark theme**: Dark slate paper (`#10171D`) background, pale ink text (`#EBF0EE`), luminous teal accent (`#249C90`). Both themes meet WCAG 2.1 AA text (>= 4.5:1) and UI boundaries/focus (>= 3:1). Controlled via `.dark` class on the root.
