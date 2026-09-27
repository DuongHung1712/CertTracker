# Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `docs/design-system.md` into working code — tokens, shadcn primitives, CertTracker status components, a role-filtered app shell, data-table building blocks and a `/design` showcase — so week 2 screens are assembled from ready parts.

**Architecture:** Tokens live as CSS variables in `src/app/globals.css` and are exposed to Tailwind v4 through `@theme inline`; a Vitest test parses that file and enforces WCAG contrast. Pure logic (labels, formatting, navigation rules) lives in small `.ts` modules with unit tests; React components are thin wrappers over them and are checked visually on `/design` and by Playwright.

**Tech Stack:** Next.js 16.3.6, Tailwind CSS v4, shadcn/ui style `base-nova` (Base UI primitives), lucide-react, @tanstack/react-table, sonner, Vitest, Playwright.

**Spec:** `docs/design-system.md` (and `docs/decisions.md` #14)

## Global Constraints

- Components use **token classes only** (`bg-primary`, `text-muted-foreground`, `text-table`, `rounded-lg`). No hex, no `bg-teal-700`, no `text-[13px]` in components. (Exception: `/design` swatches read `var(--token)` to display tokens.)
- Base UI composition uses the **`render` prop**, not Radix `asChild`: `<SidebarMenuButton render={<Link href="/x" />}>`, `<TooltipTrigger render={<span />}>`.
- UI text is Vietnamese; code, identifiers, comments and commits are English.
- Icons: `lucide-react` only, 16px (`size-4`) in tables/buttons, 20px (`size-5`) in the sidebar; decorative icons get `aria-hidden`.
- Light theme only; do not add `.dark` rules.
- Dates display `dd/MM/yyyy`; money `Intl.NumberFormat("vi-VN")`.
- `cn` is imported from `@/lib/utils`.
- Never overwrite existing files when `shadcn add` asks; never let it rewrite `src/app/globals.css` (Task 2 checks this).
- No `any`. Conventional Commits.

## Deferred (not in this plan — built in the week that first needs them)

`Combobox` (command + popover), `DatePicker` (calendar), `FileDropzone` (week 3), `KpiTile` (week 5), `DataTable` row selection (first bulk action), chart palette (week 5).

## File map

```
src/app/globals.css                         tokens (rewrite)
src/app/tokens.test.ts                      contrast test over globals.css
src/lib/design/contrast.ts (+ .test.ts)     WCAG contrast math
src/lib/format.ts (+ .test.ts)              date / money / number / percent formatting
src/components/ui/*                         shadcn primitives (generated) — card.tsx, button.tsx tweaked
src/components/status/expiry.ts (+ .test.ts)   expiry status → tone, label, detail text
src/components/status/labels.ts (+ .test.ts)   record-status / role labels, clampPercent
src/components/status/expiry-badge.tsx
src/components/status/record-status.tsx
src/components/status/progress-inline.tsx
src/components/status/role-badge.tsx
src/components/status/member-code.tsx
src/components/app-shell/nav.ts (+ .test.ts)   nav items, role filter, active path, breadcrumb label
src/components/app-shell/app-sidebar.tsx
src/components/app-shell/topbar.tsx
src/components/app-shell/user-menu.tsx
src/components/app-shell/page-header.tsx
src/components/app-shell/placeholder-page.tsx
src/components/data/pagination.ts (+ .test.ts)
src/components/data/data-table.tsx
src/components/data/filter-bar.tsx
src/components/data/empty-state.tsx
src/components/confirm-dialog.tsx
src/app/(app)/layout.tsx                    app shell (rewrite)
src/app/(app)/dashboard/page.tsx            uses PageHeader (rewrite)
src/app/(app)/{me,members,records,courses,org,import,settings}/page.tsx   placeholders
src/app/(dev)/design/page.tsx               showcase (404 in production)
src/app/(dev)/design/demos.tsx              client demos for the showcase
e2e/auth.spec.ts                            updated for the new shell
e2e/navigation.spec.ts, e2e/design.spec.ts
docs/design-system.md, .claude/rules/frontend.md, CLAUDE.md
```

---

### Task 1: Tokens and contrast test

**Files:**
- Create: `src/lib/design/contrast.ts`, `src/lib/design/contrast.test.ts`, `src/app/tokens.test.ts`
- Modify: `src/app/globals.css` (full rewrite), `src/components/ui/card.tsx`, `src/components/ui/button.tsx`, `docs/design-system.md` (§2.4 radius table)

**Interfaces:**
- Produces: `relativeLuminance(hex: string): number`, `contrastRatio(a: string, b: string): number` from `@/lib/design/contrast`.
- Produces Tailwind classes used by later tasks: colors `bg|text|border-{background,foreground,card,popover,muted,muted-foreground,secondary,primary,primary-foreground,primary-hover,accent,accent-foreground,destructive,border,input,ring,sidebar-*}`, status `bg|text|border-status-{active,expiring-60,expiring-soon,expired,no-expiry,na}-{bg,fg,border}`; text styles `text-{page-title,section-title,body,table,label,caption,kpi}`; radii `rounded-sm` 4px, `rounded-md` 4px, `rounded-lg` 6px, `rounded-xl`+ 8px.

- [ ] **Step 1: Write the failing contrast-math test**

Create `src/lib/design/contrast.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { contrastRatio, relativeLuminance } from "@/lib/design/contrast";

describe("contrastRatio", () => {
  it("is 21 for black on white", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
  });

  it("is 1 for identical colours and symmetric", () => {
    expect(contrastRatio("#0E5C58", "#0E5C58")).toBe(1);
    expect(contrastRatio("#15212B", "#F6F7F5")).toBeCloseTo(contrastRatio("#F6F7F5", "#15212B"), 10);
  });

  it("rejects values that are not #rrggbb", () => {
    expect(() => relativeLuminance("oklch(1 0 0)")).toThrow("Expected #rrggbb");
  });
});
```

- [ ] **Step 2: Write the failing token test**

Create `src/app/tokens.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/design/contrast";

function readRootTokens(): Record<string, string> {
  const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
  const root = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  return Object.fromEntries(
    [...root.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]),
  );
}

const tokens = readRootTokens();

function hex(name: string): string {
  const value = tokens[name];
  if (!value) throw new Error(`Token --${name} is missing or not #rrggbb in :root`);
  return value;
}

const STATUS_IDS = ["active", "expiring-60", "expiring-soon", "expired", "no-expiry", "na"];

// Text must reach 4.5:1 (WCAG 1.4.3).
const TEXT_PAIRS: Array<[string, string]> = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["muted-foreground", "background"],
  ["muted-foreground", "muted"],
  ["muted-foreground", "card"],
  ["secondary-foreground", "secondary"],
  ["primary-foreground", "primary"],
  ["primary-foreground", "primary-hover"],
  ["primary", "background"],
  ["primary", "card"],
  ["accent-foreground", "accent"],
  ["destructive", "card"],
  ["sidebar-foreground", "sidebar"],
  ["sidebar-accent-foreground", "sidebar-accent"],
  ["sidebar-primary-foreground", "sidebar-primary"],
  ...STATUS_IDS.map((id): [string, string] => [`status-${id}-fg`, `status-${id}-bg`]),
];

// Control boundaries and focus indicators must reach 3:1 (WCAG 1.4.11).
const UI_PAIRS: Array<[string, string]> = [
  ["input", "card"],
  ["input", "background"],
  ["ring", "background"],
  ["ring", "card"],
];

describe("design tokens", () => {
  it.each(TEXT_PAIRS)("text --%s on --%s reaches 4.5:1", (fg, bg) => {
    expect(contrastRatio(hex(fg), hex(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(UI_PAIRS)("control --%s on --%s reaches 3:1", (fg, bg) => {
    expect(contrastRatio(hex(fg), hex(bg))).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — `contrast.test.ts` cannot resolve `@/lib/design/contrast`; `tokens.test.ts` fails the same way (and would otherwise throw "Token --foreground is missing" because the current tokens are `oklch()`).

- [ ] **Step 4: Implement the contrast math**

Create `src/lib/design/contrast.ts`:

```ts
function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance of a `#rrggbb` colour. */
export function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`Expected #rrggbb, got ${hex}`);
  const n = Number.parseInt(match[1], 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** WCAG contrast ratio between two `#rrggbb` colours (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}
```

- [ ] **Step 5: Rewrite `src/app/globals.css`**

Replace the whole file with:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

/* Tokens are documented in docs/design-system.md §2 — change both together. */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary-hover: var(--primary-hover);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  --color-status-active-fg: var(--status-active-fg);
  --color-status-active-bg: var(--status-active-bg);
  --color-status-active-border: var(--status-active-border);
  --color-status-expiring-60-fg: var(--status-expiring-60-fg);
  --color-status-expiring-60-bg: var(--status-expiring-60-bg);
  --color-status-expiring-60-border: var(--status-expiring-60-border);
  --color-status-expiring-soon-fg: var(--status-expiring-soon-fg);
  --color-status-expiring-soon-bg: var(--status-expiring-soon-bg);
  --color-status-expiring-soon-border: var(--status-expiring-soon-border);
  --color-status-expired-fg: var(--status-expired-fg);
  --color-status-expired-bg: var(--status-expired-bg);
  --color-status-expired-border: var(--status-expired-border);
  --color-status-no-expiry-fg: var(--status-no-expiry-fg);
  --color-status-no-expiry-bg: var(--status-no-expiry-bg);
  --color-status-no-expiry-border: var(--status-no-expiry-border);
  --color-status-na-fg: var(--status-na-fg);
  --color-status-na-bg: var(--status-na-bg);
  --color-status-na-border: var(--status-na-border);

  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --font-heading: var(--font-sans);

  --radius-sm: 4px;
  --radius-md: 4px;
  --radius-lg: 6px;
  --radius-xl: 8px;
  --radius-2xl: 8px;
  --radius-3xl: 8px;
  --radius-4xl: 8px;

  --text-page-title: 20px;
  --text-page-title--line-height: 28px;
  --text-page-title--font-weight: 600;
  --text-section-title: 15px;
  --text-section-title--line-height: 22px;
  --text-section-title--font-weight: 600;
  --text-body: 14px;
  --text-body--line-height: 20px;
  --text-table: 13px;
  --text-table--line-height: 18px;
  --text-label: 12px;
  --text-label--line-height: 16px;
  --text-label--font-weight: 500;
  --text-label--letter-spacing: 0.04em;
  --text-caption: 12px;
  --text-caption--line-height: 16px;
  --text-kpi: 28px;
  --text-kpi--line-height: 32px;
  --text-kpi--font-weight: 600;
}

:root {
  --radius: 6px;

  --background: #F6F7F5;
  --foreground: #15212B;
  --card: #FFFFFF;
  --card-foreground: #15212B;
  --popover: #FFFFFF;
  --popover-foreground: #15212B;
  --primary: #0E5C58;
  --primary-foreground: #FFFFFF;
  --primary-hover: #0A4744;
  --secondary: #EDF0EE;
  --secondary-foreground: #15212B;
  --muted: #EDF0EE;
  --muted-foreground: #56636C;
  --accent: #E2EFEC;
  --accent-foreground: #0E5C58;
  --destructive: #B42318;
  --border: #D8DEDB;
  --input: #83908C;
  --ring: #1C7C75;

  /* Chart palette is designed in week 5 (docs/design-system.md §10). */
  --chart-1: #0E5C58;
  --chart-2: #56636C;
  --chart-3: #83908C;
  --chart-4: #D8DEDB;
  --chart-5: #15212B;

  --sidebar: #FFFFFF;
  --sidebar-foreground: #15212B;
  --sidebar-primary: #0E5C58;
  --sidebar-primary-foreground: #FFFFFF;
  --sidebar-accent: #E2EFEC;
  --sidebar-accent-foreground: #0E5C58;
  --sidebar-border: #D8DEDB;
  --sidebar-ring: #1C7C75;

  --status-active-fg: #1D6636;
  --status-active-bg: #E7F3EB;
  --status-active-border: #A8D2B4;
  --status-expiring-60-fg: #7A5200;
  --status-expiring-60-bg: #FFF5DC;
  --status-expiring-60-border: #EDCB7E;
  --status-expiring-soon-fg: #9A3D0B;
  --status-expiring-soon-bg: #FDEADD;
  --status-expiring-soon-border: #EFB189;
  --status-expired-fg: #B42318;
  --status-expired-bg: #FDE8E6;
  --status-expired-border: #F0ADA7;
  --status-no-expiry-fg: #4A5560;
  --status-no-expiry-bg: #EEF1F0;
  --status-no-expiry-border: #D3D9D6;
  --status-na-fg: #4A5560;
  --status-na-bg: #EEF1F0;
  --status-na-border: #D3D9D6;
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  html {
    @apply font-sans;
  }
  body {
    @apply bg-background text-body text-foreground;
  }
}

/*
 * Unlayered on purpose: it must beat the `outline-none` utility that shadcn
 * components ship, so every keyboard focus shows a 2px ring at ≥ 3:1.
 */
:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 6: Align shadcn primitives with the tokens**

In `src/components/ui/card.tsx` replace every `rounded-xl` with `rounded-lg`, `rounded-t-xl` with `rounded-t-lg`, and `rounded-b-xl` with `rounded-b-lg` (cards are 6px).

In `src/components/ui/button.tsx`, in the `default` variant replace `hover:bg-primary/80` with `hover:bg-primary-hover`.

- [ ] **Step 7: Record the radius mapping in the spec**

In `docs/design-system.md` §2.4 replace the radius table with:

```markdown
| Bo góc | Giá trị | Class Tailwind | Dùng cho |
|---|---|---|---|
| nhỏ | 4px | `rounded-sm`, `rounded-md` | Badge, checkbox |
| vừa | 6px | `rounded-lg` | Nút, ô nhập, thẻ, menu (mặc định của shadcn `base-nova`) |
| lớn | 8px | `rounded-xl` trở lên | Hộp thoại, sheet |
```

(Inputs share the 6px of buttons because shadcn `base-nova` styles both with `rounded-lg`; one radius for all controls keeps rows of controls aligned.)

- [ ] **Step 8: Run tests and checks**

Run: `pnpm test && pnpm lint && pnpm typecheck && pnpm build`
Expected: all PASS — contrast math 3 tests, token test 27 cases (23 text pairs + 4 control pairs), plus the 5 existing tests (35 total).

- [ ] **Step 9: Commit**

```bash
git add src/app/globals.css src/app/tokens.test.ts src/lib/design src/components/ui/card.tsx src/components/ui/button.tsx docs/design-system.md
git commit -m "feat(ui): add design tokens with enforced contrast"
```

---

### Task 2: shadcn primitives

**Files:**
- Create (generated): `src/components/ui/{sidebar,table,dialog,alert-dialog,sheet,dropdown-menu,sonner,tooltip,skeleton,badge,alert,textarea,checkbox,switch,field,breadcrumb,separator}.tsx`, `src/hooks/use-mobile.ts` (then rewritten, Step 3)
- Modify: `src/app/layout.tsx` (Toaster, TooltipProvider), `package.json`, `pnpm-lock.yaml`

**Interfaces:**
- Consumes: tokens from Task 1.
- Produces: shadcn components at `@/components/ui/<name>`; a mounted `<Toaster />` so `toast()` from `sonner` works anywhere.

- [ ] **Step 1: Add the components without overwriting anything**

```bash
pnpm dlx shadcn@latest add sidebar table dialog alert-dialog sheet dropdown-menu sonner tooltip skeleton badge alert textarea checkbox switch field breadcrumb separator
```

When asked to overwrite an existing file (`button.tsx`, `input.tsx`, `label.tsx`, `card.tsx`), answer **No**.

Use `field`, not `form`: the `base-nova` registry has no `form` item and the CLI skips it silently. Expected result (reviewer dry-run): 18 new files under `src/components/ui/` plus `src/hooks/use-mobile.ts`; `package.json` gains `sonner` and `next-themes`; `globals.css` is **not** modified.

- [ ] **Step 2: Undo any change the CLI made to the tokens**

Run: `git diff --stat -- src/app/globals.css`
If it shows changes (the `sidebar` item ships its own CSS variables), restore Task 1's file: `git checkout -- src/app/globals.css`.
Then run `pnpm test` — the token test must still PASS.

- [ ] **Step 3: Replace the generated `use-mobile` hook**

The generated hook fails `pnpm lint` (`react-hooks/set-state-in-effect`) and uses shadcn's 768px breakpoint, while the spec (§7) switches the sidebar to a drawer below 1024px. Replace `src/hooks/use-mobile.ts` with:

```ts
import * as React from "react"

// docs/design-system.md §7: the sidebar becomes a drawer below 1024px.
const MOBILE_BREAKPOINT = 1024
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  )
}
```

- [ ] **Step 3b: Mount the toaster and tooltip provider**

In `src/app/layout.tsx` import `Toaster` from `@/components/ui/sonner` and render it last inside `<body>`:

```tsx
<body className="min-h-full flex flex-col">
  {children}
  <Toaster theme="light" position="bottom-right" />
</body>
```

`theme="light"` is required: the generated wrapper reads `next-themes`, which would otherwise follow the OS and show dark toasts.

Also wrap `{children}` with `TooltipProvider` from `@/components/ui/tooltip` (it is exported; its default `delay` is 0):

```tsx
<body className="min-h-full flex flex-col">
  <TooltipProvider delay={200}>{children}</TooltipProvider>
  <Toaster theme="light" position="bottom-right" />
</body>
```

- [ ] **Step 4: Verify**

Run: `pnpm test && pnpm lint && pnpm typecheck && pnpm build`
Expected: all PASS (35 unit tests; lint clean after Step 3). If lint fails in another generated file, fix the minimum and list it in the commit body — do not disable rules.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui src/hooks src/app/layout.tsx package.json pnpm-lock.yaml components.json
git status --short   # globals.css must NOT be listed
git commit -m "feat(ui): add shadcn primitives for the app shell and data views"
```

---

### Task 3: Status components

**Files:**
- Create: `src/lib/format.ts`, `src/lib/format.test.ts`, `src/components/status/expiry.ts`, `src/components/status/expiry.test.ts`, `src/components/status/labels.ts`, `src/components/status/labels.test.ts`, `src/components/status/{expiry-badge,record-status,progress-inline,role-badge,member-code}.tsx`

**Interfaces:**
- Consumes: `Database` from `@/types/database`; `Tooltip`, `TooltipTrigger`, `TooltipContent`, `Badge` from Task 2; token classes from Task 1.
- Produces:
  - `formatDate(isoDate: string): string`, `formatVnd(amount: number): string`, `formatNumber(value: number): string`, `formatPercent(value: number): string` from `@/lib/format`
  - `EXPIRY_STATUSES`, `type ExpiryStatus`, `type ExpiryTone`, `toExpiryStatus(value: string | null | undefined): ExpiryStatus`, `expiryMeta(status: ExpiryStatus): { tone: ExpiryTone; label: string }`, `expiryDetail(input: { status: ExpiryStatus; daysToExpiry: number | null; expiryDate: string | null }): string` from `@/components/status/expiry`
  - `type RecordStatus`, `type Role`, `RECORD_STATUS_LABEL: Record<RecordStatus, string>`, `ROLE_LABEL: Record<Role, string>`, `clampPercent(value: number): number` from `@/components/status/labels`
  - Components: `<ExpiryBadge status daysToExpiry expiryDate className? />`, `<RecordStatusLabel status />`, `<ProgressInline value />`, `<RoleBadge role />`, `<MemberCode code />`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatDate, formatNumber, formatPercent, formatVnd } from "@/lib/format";

describe("format", () => {
  it("formats ISO dates as dd/MM/yyyy", () => {
    expect(formatDate("2026-10-19")).toBe("19/10/2026");
  });

  it("rejects non-ISO dates", () => {
    expect(() => formatDate("19/10/2026")).toThrow("Expected YYYY-MM-DD");
  });

  it("formats VND with Vietnamese grouping", () => {
    expect(formatVnd(1250000)).toBe("1.250.000 ₫");
  });

  it("formats plain numbers and percents", () => {
    expect(formatNumber(1250000)).toBe("1.250.000");
    expect(formatPercent(74.6)).toBe("75%");
  });
});
```

Create `src/components/status/expiry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { EXPIRY_STATUSES, expiryDetail, expiryMeta, toExpiryStatus } from "@/components/status/expiry";

describe("toExpiryStatus", () => {
  it("keeps known statuses", () => {
    for (const status of EXPIRY_STATUSES) expect(toExpiryStatus(status)).toBe(status);
  });

  it("falls back to N/A for null or unknown values", () => {
    expect(toExpiryStatus(null)).toBe("N/A");
    expect(toExpiryStatus("Expiring")).toBe("N/A");
  });
});

describe("expiryMeta", () => {
  it("maps every status to a tone and a Vietnamese label", () => {
    expect(expiryMeta("Active")).toEqual({ tone: "active", label: "Còn hiệu lực" });
    expect(expiryMeta("Expiring in 60d")).toEqual({ tone: "expiring-60", label: "Hết hạn trong 60 ngày" });
    expect(expiryMeta("Expiring Soon")).toEqual({ tone: "expiring-soon", label: "Sắp hết hạn" });
    expect(expiryMeta("Expired")).toEqual({ tone: "expired", label: "Đã hết hạn" });
    expect(expiryMeta("No Expiry")).toEqual({ tone: "no-expiry", label: "Không thời hạn" });
    expect(expiryMeta("N/A")).toEqual({ tone: "na", label: "Chưa cấp" });
  });
});

describe("expiryDetail", () => {
  it("counts days left", () => {
    expect(expiryDetail({ status: "Expiring Soon", daysToExpiry: 23, expiryDate: "2026-10-19" })).toBe(
      "Còn 23 ngày · hết hạn 19/10/2026",
    );
  });

  it("says today on the expiry day", () => {
    expect(expiryDetail({ status: "Expiring Soon", daysToExpiry: 0, expiryDate: "2026-10-19" })).toBe(
      "Hết hạn hôm nay · 19/10/2026",
    );
  });

  it("counts days since expiry", () => {
    expect(expiryDetail({ status: "Expired", daysToExpiry: -5, expiryDate: "2026-10-19" })).toBe(
      "Đã hết hạn 5 ngày · 19/10/2026",
    );
  });

  it("explains missing dates", () => {
    expect(expiryDetail({ status: "No Expiry", daysToExpiry: null, expiryDate: null })).toBe(
      "Chứng chỉ không có thời hạn",
    );
    expect(expiryDetail({ status: "N/A", daysToExpiry: null, expiryDate: null })).toBe("Chưa có ngày cấp");
  });
});
```

Create `src/components/status/labels.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { RECORD_STATUS_LABEL, ROLE_LABEL, clampPercent } from "@/components/status/labels";

describe("labels", () => {
  it("labels record statuses in Vietnamese", () => {
    expect(RECORD_STATUS_LABEL).toEqual({
      done: "Hoàn thành",
      in_progress: "Đang học",
      not_started: "Chưa bắt đầu",
    });
  });

  it("labels roles in Vietnamese", () => {
    expect(ROLE_LABEL).toEqual({ admin: "Quản trị", manager: "Quản lý", member: "Thành viên" });
  });

  it("clamps and rounds progress", () => {
    expect(clampPercent(-3)).toBe(0);
    expect(clampPercent(47.6)).toBe(48);
    expect(clampPercent(140)).toBe(100);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test`
Expected: FAIL — cannot resolve `@/lib/format`, `@/components/status/expiry`, `@/components/status/labels`.

- [ ] **Step 3: Implement the logic modules**

Create `src/lib/format.ts`:

```ts
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `2026-10-19` → `19/10/2026`. Takes a calendar date (as returned by Postgres `date`), not a timestamp. */
export function formatDate(isoDate: string): string {
  const match = ISO_DATE.exec(isoDate);
  if (!match) throw new Error(`Expected YYYY-MM-DD, got ${isoDate}`);
  return `${match[3]}/${match[2]}/${match[1]}`;
}

const vndFormatter = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
const numberFormatter = new Intl.NumberFormat("vi-VN");

export function formatVnd(amount: number): string {
  return vndFormatter.format(amount);
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}
```

Create `src/components/status/expiry.ts`:

```ts
import { formatDate } from "@/lib/format";

export const EXPIRY_STATUSES = ["Active", "Expiring in 60d", "Expiring Soon", "Expired", "No Expiry", "N/A"] as const;

export type ExpiryStatus = (typeof EXPIRY_STATUSES)[number];
export type ExpiryTone = "active" | "expiring-60" | "expiring-soon" | "expired" | "no-expiry" | "na";

const META: Record<ExpiryStatus, { tone: ExpiryTone; label: string }> = {
  Active: { tone: "active", label: "Còn hiệu lực" },
  "Expiring in 60d": { tone: "expiring-60", label: "Hết hạn trong 60 ngày" },
  "Expiring Soon": { tone: "expiring-soon", label: "Sắp hết hạn" },
  Expired: { tone: "expired", label: "Đã hết hạn" },
  "No Expiry": { tone: "no-expiry", label: "Không thời hạn" },
  "N/A": { tone: "na", label: "Chưa cấp" },
};

/** Narrows the `expiry_status` text column of `v_training_records`. */
export function toExpiryStatus(value: string | null | undefined): ExpiryStatus {
  return (EXPIRY_STATUSES as readonly string[]).includes(value ?? "") ? (value as ExpiryStatus) : "N/A";
}

export function expiryMeta(status: ExpiryStatus): { tone: ExpiryTone; label: string } {
  return META[status];
}

export function expiryDetail({
  status,
  daysToExpiry,
  expiryDate,
}: {
  status: ExpiryStatus;
  daysToExpiry: number | null;
  expiryDate: string | null;
}): string {
  if (status === "No Expiry") return "Chứng chỉ không có thời hạn";
  if (status === "N/A" || daysToExpiry === null || expiryDate === null) return "Chưa có ngày cấp";
  const date = formatDate(expiryDate);
  if (daysToExpiry < 0) return `Đã hết hạn ${-daysToExpiry} ngày · ${date}`;
  if (daysToExpiry === 0) return `Hết hạn hôm nay · ${date}`;
  return `Còn ${daysToExpiry} ngày · hết hạn ${date}`;
}
```

Create `src/components/status/labels.ts`:

```ts
import type { Database } from "@/types/database";

export type RecordStatus = Database["public"]["Enums"]["record_status"];
export type Role = Database["public"]["Enums"]["user_role"];

export const RECORD_STATUS_LABEL: Record<RecordStatus, string> = {
  done: "Hoàn thành",
  in_progress: "Đang học",
  not_started: "Chưa bắt đầu",
};

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Quản trị",
  manager: "Quản lý",
  member: "Thành viên",
};

export function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS (format 4, expiry 7, labels 3, plus earlier tests).

- [ ] **Step 5: Implement the components**

Create `src/components/status/expiry-badge.tsx`:

```tsx
import {
  CircleCheck,
  CircleX,
  Clock,
  Infinity as InfinityIcon,
  Minus,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { expiryDetail, expiryMeta, toExpiryStatus, type ExpiryTone } from "@/components/status/expiry";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<ExpiryTone, string> = {
  active: "border-status-active-border bg-status-active-bg text-status-active-fg",
  "expiring-60": "border-status-expiring-60-border bg-status-expiring-60-bg text-status-expiring-60-fg",
  "expiring-soon": "border-status-expiring-soon-border bg-status-expiring-soon-bg text-status-expiring-soon-fg",
  expired: "border-status-expired-border bg-status-expired-bg text-status-expired-fg",
  "no-expiry": "border-status-no-expiry-border bg-status-no-expiry-bg text-status-no-expiry-fg",
  na: "border-status-na-border bg-status-na-bg text-status-na-fg",
};

const TONE_ICON: Record<ExpiryTone, LucideIcon> = {
  active: CircleCheck,
  "expiring-60": Clock,
  "expiring-soon": TriangleAlert,
  expired: CircleX,
  "no-expiry": InfinityIcon,
  na: Minus,
};

export function ExpiryBadge({
  status,
  daysToExpiry,
  expiryDate,
  className,
}: {
  status: string | null;
  daysToExpiry: number | null;
  expiryDate: string | null;
  className?: string;
}) {
  const expiryStatus = toExpiryStatus(status);
  const { tone, label } = expiryMeta(expiryStatus);
  const Icon = TONE_ICON[tone];

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded-sm border px-1.5 text-caption font-medium whitespace-nowrap",
              TONE_CLASS[tone],
              className,
            )}
          />
        }
      >
        <Icon aria-hidden className="size-3.5" />
        {label}
      </TooltipTrigger>
      <TooltipContent>{expiryDetail({ status: expiryStatus, daysToExpiry, expiryDate })}</TooltipContent>
    </Tooltip>
  );
}
```

Create `src/components/status/record-status.tsx`:

```tsx
import { CircleCheck, CircleDashed, LoaderCircle, type LucideIcon } from "lucide-react";
import { RECORD_STATUS_LABEL, type RecordStatus } from "@/components/status/labels";

const ICON: Record<RecordStatus, LucideIcon> = {
  done: CircleCheck,
  in_progress: LoaderCircle,
  not_started: CircleDashed,
};

export function RecordStatusLabel({ status }: { status: RecordStatus }) {
  const Icon = ICON[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-table text-foreground">
      <Icon aria-hidden className="size-4 text-muted-foreground" />
      {RECORD_STATUS_LABEL[status]}
    </span>
  );
}
```

Create `src/components/status/progress-inline.tsx`:

```tsx
import { clampPercent } from "@/components/status/labels";

export function ProgressInline({ value }: { value: number }) {
  const percent = clampPercent(value);
  return (
    <div className="flex items-center gap-2">
      <div
        role="progressbar"
        aria-label="Tiến độ học"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1 w-16 overflow-hidden rounded-sm bg-muted"
      >
        <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <span className="w-9 text-right text-table tabular-nums text-muted-foreground">{percent}%</span>
    </div>
  );
}
```

Create `src/components/status/role-badge.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";
import { ROLE_LABEL, type Role } from "@/components/status/labels";

export function RoleBadge({ role }: { role: Role }) {
  return <Badge variant="secondary">{ROLE_LABEL[role]}</Badge>;
}
```

Create `src/components/status/member-code.tsx`:

```tsx
export function MemberCode({ code }: { code: string }) {
  return <span className="font-mono text-caption text-muted-foreground">{code}</span>;
}
```

- [ ] **Step 6: Verify**

Run: `pnpm test && pnpm lint && pnpm typecheck && pnpm build`
Expected: all PASS. (Components are exercised visually in Task 5's `/design` page.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts src/components/status
git commit -m "feat(ui): add expiry, record status, progress, role and member code components"
```

---

### Task 4: App shell with role-filtered sidebar

**Files:**
- Create: `src/components/app-shell/{nav.ts,nav.test.ts,app-sidebar.tsx,topbar.tsx,user-menu.tsx,page-header.tsx,placeholder-page.tsx}`, `src/app/(app)/{me,members,records,courses,org,import,settings}/page.tsx`, `e2e/navigation.spec.ts`
- Modify: `src/app/(app)/layout.tsx`, `src/app/(app)/dashboard/page.tsx`, `e2e/auth.spec.ts`

**Interfaces:**
- Consumes: `Role`, `RoleBadge` (Task 3); `Sidebar*`, `DropdownMenu*`, `Breadcrumb*`, `Separator` (Task 2); `signOut` from `@/features/auth/actions`; `createClient` from `@/lib/supabase/server`.
- Produces:
  - `type NavItem = { href: string; label: string; icon: LucideIcon; roles: Role[]; requiresMember?: boolean }`, `NAV_ITEMS: NavItem[]`, `navForUser(role: Role, hasMember: boolean): NavItem[]`, `isActivePath(pathname: string, href: string): boolean`, `labelForPath(pathname: string): string` from `@/components/app-shell/nav`
  - `<PageHeader title description? actions? />`, `<PlaceholderPage title description week />`
  - Every page under `(app)` renders inside the shell; pages render only their content.

- [ ] **Step 1: Write the failing navigation test**

Create `src/components/app-shell/nav.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isActivePath, labelForPath, navForUser } from "@/components/app-shell/nav";

const hrefs = (role: "admin" | "manager" | "member", hasMember: boolean) =>
  navForUser(role, hasMember).map((item) => item.href);

describe("navForUser (docs/design-system.md §4.5)", () => {
  it("gives admins everything; 'my certificates' only when linked to a member", () => {
    expect(hrefs("admin", false)).toEqual([
      "/dashboard",
      "/members",
      "/records",
      "/courses",
      "/org",
      "/import",
      "/settings",
    ]);
    expect(hrefs("admin", true)).toContain("/me");
  });

  it("gives managers team views but no org, import or settings", () => {
    expect(hrefs("manager", true)).toEqual(["/dashboard", "/me", "/members", "/records", "/courses"]);
  });

  it("gives members only their own views and the catalogue", () => {
    expect(hrefs("member", true)).toEqual(["/dashboard", "/me", "/courses"]);
  });
});

describe("isActivePath", () => {
  it("matches the item and its sub-pages only", () => {
    expect(isActivePath("/members", "/members")).toBe(true);
    expect(isActivePath("/members/42", "/members")).toBe(true);
    expect(isActivePath("/members-archive", "/members")).toBe(false);
  });
});

describe("labelForPath", () => {
  it("names the current section", () => {
    expect(labelForPath("/members/42")).toBe("Thành viên");
    expect(labelForPath("/unknown")).toBe("CertTracker");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot resolve `@/components/app-shell/nav`.

- [ ] **Step 3: Implement the navigation rules**

Create `src/components/app-shell/nav.ts`:

```ts
import {
  Award,
  BookOpen,
  Building2,
  FileSpreadsheet,
  LayoutDashboard,
  ListChecks,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/components/status/labels";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  requiresMember?: boolean;
};

const ALL: Role[] = ["admin", "manager", "member"];

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ALL },
  { href: "/me", label: "Chứng chỉ của tôi", icon: Award, roles: ALL, requiresMember: true },
  { href: "/members", label: "Thành viên", icon: Users, roles: ["admin", "manager"] },
  { href: "/records", label: "Chứng chỉ theo người", icon: ListChecks, roles: ["admin", "manager"] },
  { href: "/courses", label: "Khóa học", icon: BookOpen, roles: ALL },
  { href: "/org", label: "Tổ chức", icon: Building2, roles: ["admin"] },
  { href: "/import", label: "Import / Export", icon: FileSpreadsheet, roles: ["admin"] },
  { href: "/settings", label: "Cài đặt", icon: Settings, roles: ["admin"] },
];

/** UX filter only — access is enforced by RLS. */
export function navForUser(role: Role, hasMember: boolean): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role) && (!item.requiresMember || hasMember));
}

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function labelForPath(pathname: string): string {
  return NAV_ITEMS.find((item) => isActivePath(pathname, item.href))?.label ?? "CertTracker";
}
```

Run: `pnpm test` → nav tests PASS.

- [ ] **Step 4: Page header and placeholder**

Create `src/components/app-shell/page-header.tsx`:

```tsx
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-page-title text-balance">{title}</h1>
        {description && <p className="text-body text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
```

Create `src/components/app-shell/placeholder-page.tsx`:

```tsx
import { PageHeader } from "@/components/app-shell/page-header";

export function PlaceholderPage({ title, description, week }: { title: string; description: string; week: number }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} description={description} />
      <p className="rounded-lg border bg-card p-6 text-body text-muted-foreground">
        Màn hình này sẽ có ở tuần {week}.
      </p>
    </div>
  );
}
```

Create the seven placeholder pages, each exactly like this (values from the table):

```tsx
// src/app/(app)/members/page.tsx
import { PlaceholderPage } from "@/components/app-shell/placeholder-page";

export default function Page() {
  return <PlaceholderPage title="Thành viên" description="Danh sách thành viên và team của họ." week={2} />;
}
```

| File | title | description | week |
|---|---|---|---|
| `me/page.tsx` | Chứng chỉ của tôi | Chứng chỉ bạn đã có và đang học. | 3 |
| `members/page.tsx` | Thành viên | Danh sách thành viên và team của họ. | 2 |
| `records/page.tsx` | Chứng chỉ theo người | Ai đang có, đang học chứng chỉ nào. | 3 |
| `courses/page.tsx` | Khóa học | Danh mục chứng chỉ, provider và thời hạn. | 2 |
| `org/page.tsx` | Tổ chức | DC, program và team. | 2 |
| `import/page.tsx` | Import / Export | Nhập dữ liệu từ Excel cũ, xuất CSV/Excel. | 4 |
| `settings/page.tsx` | Cài đặt | Tài khoản và phân quyền. | 6 |

- [ ] **Step 5: Sidebar, topbar, user menu**

Create `src/components/app-shell/app-sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { isActivePath, navForUser } from "@/components/app-shell/nav";
import type { Role } from "@/components/status/labels";

export function AppSidebar({ role, hasMember }: { role: Role; hasMember: boolean }) {
  const pathname = usePathname();
  const items = navForUser(role, hasMember);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <span className="flex h-8 items-center px-2 text-section-title text-sidebar-foreground group-data-[collapsible=icon]:hidden">
          CertTracker
        </span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {items.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  render={<Link href={item.href} />}
                  isActive={isActivePath(pathname, item.href)}
                  tooltip={item.label}
                >
                  <item.icon aria-hidden className="size-5" />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
```

Create `src/components/app-shell/user-menu.tsx`:

```tsx
"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RoleBadge } from "@/components/status/role-badge";
import type { Role } from "@/components/status/labels";
import { signOut } from "@/features/auth/actions";

export function UserMenu({ email, role }: { email: string; role: Role }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" aria-label="Tài khoản" />}>
        <span className="hidden max-w-48 truncate sm:inline">{email}</span>
        <RoleBadge role={role} />
        <ChevronDown aria-hidden className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-caption text-muted-foreground">{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void signOut()}>Đăng xuất</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

If the generated `dropdown-menu.tsx` has no `DropdownMenuLabel` export, use a `<div className="px-2 py-1.5 text-caption text-muted-foreground">` instead and note it.

Create `src/components/app-shell/topbar.tsx`:

```tsx
"use client";

import { usePathname } from "next/navigation";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { labelForPath } from "@/components/app-shell/nav";
import { UserMenu } from "@/components/app-shell/user-menu";
import type { Role } from "@/components/status/labels";

export function Topbar({ email, role }: { email: string; role: Role }) {
  const pathname = usePathname();
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-card px-4">
      <SidebarTrigger aria-label="Mở hoặc thu gọn menu" />
      <Separator orientation="vertical" className="h-5" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>{labelForPath(pathname)}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto">
        <UserMenu email={email} role={role} />
      </div>
    </header>
  );
}
```

- [ ] **Step 6: Wire the shell into the layout and dashboard**

Replace `src/app/(app)/layout.tsx`:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, member_id")
    .eq("user_id", user.id)
    .single();

  const role = profile?.role ?? "member";
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar role={role} hasMember={profile?.member_id != null} />
      <SidebarInset>
        <Topbar email={user.email ?? ""} role={role} />
        <div className="flex-1 p-4 sm:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

(`sidebar_state` is the cookie name used by the generated `sidebar.tsx`; confirm it there.)

Replace `src/app/(app)/dashboard/page.tsx`:

```tsx
import { PageHeader } from "@/components/app-shell/page-header";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" description="Tổng quan chứng chỉ của đơn vị." />
      <p className="rounded-lg border bg-card p-6 text-body text-muted-foreground">
        KPI và thống kê sẽ có ở tuần 5.
      </p>
    </div>
  );
}
```

- [ ] **Step 7: Update and add e2e tests**

In `e2e/auth.spec.ts`, replace the body of `"admin signs in, sees dashboard, and signs out"` after the click on "Đăng nhập" with:

```ts
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Quản trị")).toBeVisible();

  await page.getByRole("button", { name: "Tài khoản" }).click();
  await page.getByRole("menuitem", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/login$/);
```

Create `e2e/navigation.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";

// Credentials come from supabase/seed.sql (local test users only).
const SEED_PASSWORD = "Password123!";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

test("admin sees admin-only sections", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await expect(page.getByRole("link", { name: "Tổ chức" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Import / Export" })).toBeVisible();
});

test("member sees only personal sections", async ({ page }) => {
  await signIn(page, "member@certtracker.test");
  await expect(page.getByRole("link", { name: "Chứng chỉ của tôi" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Tổ chức" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Thành viên" })).toHaveCount(0);
});

test("sidebar link navigates and marks the breadcrumb", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await page.getByRole("link", { name: "Khóa học" }).click();
  await expect(page).toHaveURL(/\/courses$/);
  await expect(page.getByRole("heading", { name: "Khóa học" })).toBeVisible();
});
```

- [ ] **Step 8: Verify**

Run: `pnpm test && pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e`
Expected: all PASS (e2e: 3 auth + 3 navigation). Supabase local must be running with seed.

- [ ] **Step 9: Commit**

```bash
git add src/components/app-shell "src/app/(app)" e2e
git commit -m "feat(ui): add app shell with role-filtered sidebar"
```

---

### Task 5: Data building blocks and `/design` showcase

**Files:**
- Create: `src/lib/utils.test.ts`, `src/components/data/{pagination.ts,pagination.test.ts,data-table.tsx,filter-bar.tsx,empty-state.tsx}`, `src/components/confirm-dialog.tsx`, `src/app/(dev)/design/page.tsx`, `src/app/(dev)/design/demos.tsx`, `e2e/design.spec.ts`
- Modify: `src/lib/utils.ts`, the `cn` import line of every `src/components/ui/*.tsx`, `package.json`, `pnpm-lock.yaml`

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces:
  - `cn` from `@/lib/utils` that understands the design-system text sizes (used by every component, including shadcn primitives)
  - `pageRangeLabel(pageIndex: number, pageSize: number, total: number): string` from `@/components/data/pagination`
  - `<DataTable columns data isLoading? error? empty? pageSize? getRowId? />` (`DataTableProps<TData, TValue>` with `columns: ColumnDef<TData, TValue>[]`)
  - `<FilterBar search onSearchChange searchPlaceholder? hasActiveFilters onClear>{filters}</FilterBar>`
  - `<EmptyState title description? action? />`
  - `<ConfirmDialog open onOpenChange title description confirmLabel onConfirm pending? />`

- [ ] **Step 0: Make `cn` understand the design-system text sizes**

Found in the reviewer's dry run: `cn` (the `cn` package) does not know `text-caption`, `text-label`… are font sizes, treats them as colours, and drops them next to a colour class — `ExpiryBadge` rendered at 14px instead of 12px and table headers lost `text-label`.

Create `src/lib/utils.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("keeps a design-system text size next to a text colour", () => {
    expect(cn("text-caption", "text-status-active-fg")).toBe("text-caption text-status-active-fg");
    expect(cn("text-label uppercase", "text-muted-foreground")).toBe("text-label uppercase text-muted-foreground");
  });

  it("still lets a later text size win over an earlier one", () => {
    expect(cn("text-table", "text-caption")).toBe("text-caption");
    expect(cn("text-sm", "text-body")).toBe("text-body");
  });
});
```

Run `pnpm test` → the 2 new tests FAIL (e.g. `Expected: "text-caption text-status-active-fg"`, `Received: "text-status-active-fg"`).

Replace `src/lib/utils.ts` with:

```ts
import { createCn } from "cn/config"

// Teach class merging the design-system text styles (`--text-*` in globals.css).
// Without this, `text-caption` looks like a colour and is dropped next to `text-foreground`.
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [{ text: ["page-title", "section-title", "body", "table", "label", "caption", "kpi"] }],
    },
  },
})
```

Point every shadcn primitive at this single `cn` (they import the package directly): in each `src/components/ui/*.tsx` change `import { cn } from "cn"` to `import { cn } from "@/lib/utils"` (Git Bash: `sed -i 's|from "cn"$|from "@/lib/utils"|' src/components/ui/*.tsx`). Check: `grep -l 'from "cn"' src/components/ui/*.tsx` prints nothing.

Run `pnpm test` → **56 passed**; `pnpm typecheck` passes.

- [ ] **Step 1: Write the failing pagination test**

Create `src/components/data/pagination.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pageRangeLabel } from "@/components/data/pagination";

describe("pageRangeLabel", () => {
  it("shows the visible range and total", () => {
    expect(pageRangeLabel(0, 25, 42)).toBe("1–25 / 42");
    expect(pageRangeLabel(1, 25, 42)).toBe("26–42 / 42");
  });

  it("handles an empty table", () => {
    expect(pageRangeLabel(0, 25, 0)).toBe("0 kết quả");
  });
});
```

- [ ] **Step 2: Run to verify it fails, then implement**

Run: `pnpm test` → FAIL (cannot resolve `@/components/data/pagination`).

Create `src/components/data/pagination.ts`:

```ts
export function pageRangeLabel(pageIndex: number, pageSize: number, total: number): string {
  if (total === 0) return "0 kết quả";
  const start = pageIndex * pageSize + 1;
  const end = Math.min(total, (pageIndex + 1) * pageSize);
  return `${start}–${end} / ${total}`;
}
```

Run: `pnpm test` → PASS (58).

- [ ] **Step 3: Empty state, filter bar, confirm dialog**

```bash
pnpm add @tanstack/react-table@^8
```

Pin v8: the unpinned install now resolves v9, whose API is different (`createCoreRowModel`, `TableFeatures`) and does not compile with the code below.

Create `src/components/data/empty-state.tsx`:

```tsx
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <p className="text-section-title">{title}</p>
      {description && <p className="max-w-prose text-body text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
```

Create `src/components/data/filter-bar.tsx`:

```tsx
"use client";

import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Tìm kiếm…",
  hasActiveFilters,
  onClear,
  children,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  hasActiveFilters: boolean;
  onClear: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-72">
        <Search aria-hidden className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="h-8 pl-8"
        />
      </div>
      {children}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          Xóa lọc
        </Button>
      )}
    </div>
  );
}
```

Create `src/components/confirm-dialog.tsx`:

```tsx
"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/** Destructive confirmation. The title names the object; the button names the action. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  pending = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  pending?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Hủy</AlertDialogCancel>
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending ? "Đang xử lý…" : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 4: DataTable**

Create `src/components/data/data-table.tsx`:

```tsx
"use client";

import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/data/empty-state";
import { pageRangeLabel } from "@/components/data/pagination";

export type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  error?: string | null;
  empty?: React.ReactNode;
  pageSize?: number;
  getRowId?: (row: TData, index: number) => string;
};

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading = false,
  error = null,
  empty,
  pageSize = 25,
  getRowId,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    data,
    columns,
    getRowId,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageIndex: 0, pageSize } },
  });

  const columnCount = table.getVisibleLeafColumns().length;
  const rows = table.getRowModel().rows;
  const { pageIndex } = table.getState().pagination;

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table className="text-table tabular-nums">
          <TableHeader className="sticky top-0 z-10 bg-muted">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const SortIcon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                      className="h-8 bg-muted px-2.5 text-label uppercase text-muted-foreground first:sticky first:left-0"
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 uppercase"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <SortIcon aria-hidden className="size-3.5" />
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {error ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="px-2.5 py-6 text-center text-destructive">
                  {error}
                </TableCell>
              </TableRow>
            ) : isLoading ? (
              Array.from({ length: 5 }, (_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  <TableCell colSpan={columnCount} className="h-8 px-2.5 py-1">
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columnCount}>{empty ?? <EmptyState title="Không có dữ liệu" />}</TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} className="h-8">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="bg-card px-2.5 py-1 first:sticky first:left-0">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end gap-2 text-caption text-muted-foreground">
        <span className="tabular-nums">{pageRangeLabel(pageIndex, pageSize, data.length)}</span>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Trang trước"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Trang sau"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: `/design` showcase**

Create `src/app/(dev)/design/demos.tsx`:

```tsx
"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { FilterBar } from "@/components/data/filter-bar";
import { ExpiryBadge } from "@/components/status/expiry-badge";
import { MemberCode } from "@/components/status/member-code";
import { ProgressInline } from "@/components/status/progress-inline";
import { RecordStatusLabel } from "@/components/status/record-status";
import type { RecordStatus } from "@/components/status/labels";
import { Button } from "@/components/ui/button";

type SampleRow = {
  id: string;
  code: string;
  name: string;
  course: string;
  status: RecordStatus;
  progress: number;
  expiryStatus: string;
  daysToExpiry: number | null;
  expiryDate: string | null;
};

// Example rows for the showcase only.
const SAMPLE_ROWS: SampleRow[] = [
  { id: "1", code: "M001", name: "Nguyễn Văn An", course: "AWS Solutions Architect Associate", status: "done", progress: 100, expiryStatus: "Expiring Soon", daysToExpiry: 23, expiryDate: "2026-10-19" },
  { id: "2", code: "M002", name: "Trần Thị Bình", course: "NVIDIA Generative AI LLMs", status: "in_progress", progress: 40, expiryStatus: "N/A", daysToExpiry: null, expiryDate: null },
  { id: "3", code: "M003", name: "Lê Minh Châu", course: "Azure Fundamentals AZ-900", status: "done", progress: 100, expiryStatus: "No Expiry", daysToExpiry: null, expiryDate: null },
  { id: "4", code: "M004", name: "Phạm Quốc Dũng", course: "CCNA", status: "done", progress: 100, expiryStatus: "Expired", daysToExpiry: -5, expiryDate: "2026-09-21" },
  { id: "5", code: "M005", name: "Võ Thị Én", course: "Google Cloud Digital Leader", status: "done", progress: 100, expiryStatus: "Expiring in 60d", daysToExpiry: 48, expiryDate: "2026-11-13" },
  { id: "6", code: "M006", name: "Đặng Gia Huy", course: "IBM Data Science", status: "not_started", progress: 0, expiryStatus: "Active", daysToExpiry: 400, expiryDate: "2027-10-31" },
];

const COLUMNS: ColumnDef<SampleRow, unknown>[] = [
  { accessorKey: "code", header: "Mã", cell: ({ row }) => <MemberCode code={row.original.code} /> },
  { accessorKey: "name", header: "Họ tên" },
  { accessorKey: "course", header: "Khóa học" },
  { accessorKey: "status", header: "Trạng thái", cell: ({ row }) => <RecordStatusLabel status={row.original.status} /> },
  { accessorKey: "progress", header: "Tiến độ", cell: ({ row }) => <ProgressInline value={row.original.progress} /> },
  {
    accessorKey: "expiryStatus",
    header: "Hạn",
    cell: ({ row }) => (
      <ExpiryBadge
        status={row.original.expiryStatus}
        daysToExpiry={row.original.daysToExpiry}
        expiryDate={row.original.expiryDate}
      />
    ),
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) => (
      <Button variant="ghost" size="icon-xs" aria-label={`Thao tác cho ${row.original.name}`}>
        <MoreHorizontal aria-hidden />
      </Button>
    ),
  },
];

export function TableDemo() {
  const [search, setSearch] = useState("");
  const rows = useMemo(
    () => SAMPLE_ROWS.filter((row) => `${row.code} ${row.name} ${row.course}`.toLowerCase().includes(search.toLowerCase())),
    [search],
  );
  return (
    <div className="flex flex-col gap-3">
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm theo tên, mã, khóa học…"
        hasActiveFilters={search.length > 0}
        onClear={() => setSearch("")}
      />
      <DataTable
        columns={COLUMNS}
        data={rows}
        getRowId={(row) => row.id}
        empty={<EmptyState title="Không tìm thấy kết quả" description="Thử từ khóa khác hoặc xóa bộ lọc." />}
      />
    </div>
  );
}

export function LoadingTableDemo() {
  return <DataTable columns={COLUMNS} data={[]} isLoading />;
}

export function ConfirmDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Mở hộp thoại xác nhận
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Xóa thành viên M004 · Phạm Quốc Dũng?"
        description="5 bản ghi chứng chỉ của người này cũng sẽ bị xóa. Không thể hoàn tác."
        confirmLabel="Xóa thành viên"
        onConfirm={() => {
          setOpen(false);
          toast.success("Đã xóa thành viên M004");
        }}
      />
    </>
  );
}

export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => toast.success("Đã thêm thành viên M007")}>
        Toast thành công
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.error("Không lưu được do mất kết nối. Kiểm tra mạng rồi thử lại.", { duration: Infinity })}
      >
        Toast lỗi
      </Button>
    </div>
  );
}
```

Create `src/app/(dev)/design/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { EXPIRY_STATUSES } from "@/components/status/expiry";
import { ExpiryBadge } from "@/components/status/expiry-badge";
import { MemberCode } from "@/components/status/member-code";
import { ProgressInline } from "@/components/status/progress-inline";
import { RecordStatusLabel } from "@/components/status/record-status";
import { RoleBadge } from "@/components/status/role-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDemo, LoadingTableDemo, TableDemo, ToastDemo } from "./demos";

const COLOR_TOKENS = [
  "background", "card", "foreground", "muted", "muted-foreground", "primary",
  "primary-hover", "accent", "destructive", "border", "input", "ring",
];

const TEXT_STYLES = [
  ["text-page-title", "Tiêu đề trang · 20/28"],
  ["text-section-title", "Tiêu đề khối · 15/22"],
  ["text-body", "Nội dung · 14/20"],
  ["text-table", "Ô bảng · 13/18"],
  ["text-label uppercase", "Nhãn cột · 12/16"],
  ["text-caption", "Chú thích · 12/16"],
  ["text-kpi tabular-nums", "1.248"],
] as const;

const SAMPLE_DAYS: Record<(typeof EXPIRY_STATUSES)[number], [number | null, string | null]> = {
  Active: [400, "2027-10-31"],
  "Expiring in 60d": [48, "2026-11-13"],
  "Expiring Soon": [23, "2026-10-19"],
  Expired: [-5, "2026-09-21"],
  "No Expiry": [null, null],
  "N/A": [null, null],
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-section-title">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-8 sm:px-6">
      <PageHeader title="Design system" description="Trang trưng bày token và component. Chỉ có ở môi trường dev." />

      <Section title="Màu">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {COLOR_TOKENS.map((name) => (
            <div key={name} className="flex flex-col gap-1">
              <div className="h-12 rounded-lg border" style={{ background: `var(--${name})` }} />
              <span className="font-mono text-caption text-muted-foreground">{name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Chữ">
        <div className="flex flex-col gap-2 rounded-lg border bg-card p-4">
          {TEXT_STYLES.map(([className, sample]) => (
            <p key={className} className={className}>
              {sample}
            </p>
          ))}
        </div>
      </Section>

      <Section title="Trạng thái hết hạn">
        <div className="flex flex-wrap gap-2">
          {EXPIRY_STATUSES.map((status) => (
            <ExpiryBadge
              key={status}
              status={status}
              daysToExpiry={SAMPLE_DAYS[status][0]}
              expiryDate={SAMPLE_DAYS[status][1]}
            />
          ))}
        </div>
      </Section>

      <Section title="Trạng thái học, tiến độ, vai trò">
        <div className="flex flex-wrap items-center gap-6">
          <RecordStatusLabel status="done" />
          <RecordStatusLabel status="in_progress" />
          <RecordStatusLabel status="not_started" />
          <ProgressInline value={40} />
          <RoleBadge role="admin" />
          <RoleBadge role="manager" />
          <RoleBadge role="member" />
          <MemberCode code="M001" />
        </div>
      </Section>

      <Section title="Nút">
        <div className="flex flex-wrap gap-2">
          <Button>Thêm thành viên</Button>
          <Button variant="secondary">Xuất Excel</Button>
          <Button variant="outline">Hủy</Button>
          <Button variant="ghost">Xóa lọc</Button>
          <Button variant="destructive">Xóa khóa học</Button>
          <Button disabled>Đang lưu…</Button>
        </div>
      </Section>

      <Section title="Form">
        <div className="flex max-w-md flex-col gap-2">
          <Label htmlFor="design-email">Email</Label>
          <Input id="design-email" type="email" placeholder="ten@congty.com" />
          <p className="text-caption text-muted-foreground">Dùng email công ty.</p>
        </div>
      </Section>

      <Section title="Bảng">
        <TableDemo />
      </Section>

      <Section title="Bảng đang tải">
        <LoadingTableDemo />
      </Section>

      <Section title="Hộp thoại và thông báo">
        <div className="flex flex-wrap gap-2">
          <ConfirmDemo />
          <ToastDemo />
        </div>
      </Section>
    </main>
  );
}
```

- [ ] **Step 6: e2e for the showcase**

Create `e2e/design.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

// Credentials come from supabase/seed.sql (local test users only).
const SEED_PASSWORD = "Password123!";

test("design showcase renders tokens and components", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@certtracker.test");
  await page.getByLabel("Mật khẩu").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.goto("/design");
  await expect(page.getByRole("heading", { name: "Trạng thái hết hạn" })).toBeVisible();
  await expect(page.getByText("Đã hết hạn").first()).toBeVisible();

  const table = page.getByRole("table").first();
  await expect(table.getByRole("row")).toHaveCount(7); // header + 6 sample rows
  await page.getByLabel("Tìm theo tên, mã, khóa học…").fill("Châu");
  await expect(table.getByRole("row")).toHaveCount(2);

  await page.getByRole("button", { name: "Mở hộp thoại xác nhận" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
});
```

- [ ] **Step 7: Verify**

Run: `pnpm test && pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e`
Expected: all PASS — 58 unit tests; e2e 7 (3 auth + 3 navigation + 1 design). The production build must list `/design`; opening it with `pnpm start` returns 404.

`pnpm lint` reports exactly **one warning** and no errors: `react-hooks/incompatible-library` on `useReactTable` in `data-table.tsx` (TanStack Table returns functions the React Compiler cannot memoize; the compiler is not enabled in this project). This is expected — do not disable the rule.

Visual check on `/design` (dev): expiry badges 12px/16px/500 and 24px tall; table header 12px with 0.04em letter-spacing; body rows 32px (+1px border).

- [ ] **Step 8: Commit**

```bash
git add src/lib/utils.ts src/lib/utils.test.ts src/components/ui src/components/data src/components/confirm-dialog.tsx "src/app/(dev)" e2e/design.spec.ts package.json pnpm-lock.yaml
git commit -m "feat(ui): add data table, filter bar, empty state, confirm dialog and /design showcase"
```

---

### Task 6: Docs, rules and the claude.ai Design System (done by Claude)

**Files:**
- Modify: `docs/design-system.md`, `.claude/rules/frontend.md`, `CLAUDE.md`
- External: the Design System artifact `https://claude.ai/artifact/FYX63bY4jqzxuo3s6GYfu9`

- [ ] **Step 1: Bring the spec in line with the code**

In `docs/design-system.md`:
- §3: add a column "Trạng thái" to the component table — "✓" for everything built in Tasks 2–5, "tuần N" for `Combobox`, `DatePicker` (tuần 2), `FileDropzone` (tuần 3), `KpiTile` (tuần 5); note that `DataTable` row selection arrives with the first bulk action.
- §9 step 3: `/design` exists at `src/app/(dev)/design/page.tsx`.
- §2.4: table cell padding is `4px 10px` (a 24px badge or icon button + 8px = 32px row); form inputs use `h-9` (36px) — the default `Input` is 32px for toolbars.
- §3: note that all components (shadcn included) import `cn` from `@/lib/utils`, which knows the `text-*` styles.

- [ ] **Step 2: Rules for future sessions**

Append to `.claude/rules/frontend.md`:

```markdown
- Trước khi dựng UI: đọc `docs/design-system.md`. Chỉ dùng token (class `bg-primary`, `text-table`, `rounded-lg`…); không hex, không `bg-teal-*`, không `text-[13px]`.
- Ưu tiên component có sẵn: `src/components/app-shell` (PageHeader), `src/components/data` (DataTable, FilterBar, EmptyState), `src/components/status` (ExpiryBadge, RecordStatusLabel, ProgressInline, RoleBadge, MemberCode), `src/components/confirm-dialog.tsx`.
- shadcn `base-nova` dùng Base UI: ghép component bằng prop `render`, không phải `asChild`.
- Thêm/sửa token: sửa `src/app/globals.css` + bảng trong `docs/design-system.md` cùng commit; `pnpm test` kiểm tra tương phản.
- Xem trực quan ở `/design` (dev).
```

In `CLAUDE.md`, add a row to "Nguồn sự thật":

```markdown
| Token, component, pattern UI | `docs/design-system.md` (xem trực quan: `/design` khi chạy dev) |
```

- [ ] **Step 3: Verify and commit**

Run: `pnpm test && pnpm lint && pnpm typecheck`

```bash
git add docs/design-system.md .claude/rules/frontend.md CLAUDE.md
git commit -m "docs: point future sessions at the design system"
```

- [ ] **Step 4: Publish the claude.ai Design System**

Built from the committed code (the artifact type's `from-code` guidance), into the existing empty artifact, renamed "CertTracker":
- `project/README.md` — brand book: principles (§1), token usage (§2), components and patterns (§3–4), accessibility (§6), copy (§5).
- `project/tokens.json` — colours (incl. 18 status tokens) with usage notes, type scale, spacing, radius, from `globals.css`.
- Component previews: `ExpiryBadge` (all 6), `Button` (variants), compact table row, `Sidebar` item states, form field — rendered with the real token values.
- Cover last.

Then share the link with the user and note what was built from and what remains (deferred components).
