# Phase 1 · Week 2 — Organization, Member and Course CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/org`, `/members` and `/courses` placeholder pages with working CRUD screens for DC/Program/Team (+ team manager assignment), Member, and CertType/Provider/Course — the two roadmap items of Phase 1 Week 2 (`docs/superpowers/specs/2026-09-26-certtracker-design.md` §10).

**Architecture:** Server Components (`page.tsx`) read through `features/<x>/queries.ts` with the signed-in user's own Supabase client (RLS-scoped); Client Components render the design-system `DataTable`/`FilterBar` and a `Dialog` (small forms) or `Sheet` (Course — 8 fields) driven by React Hook Form + a Zod schema shared with the Server Action in `features/<x>/actions.ts`. Every action returns `Result<T>` and calls `revalidatePath` on success. RLS (already built in Week 1) stays the only authorization boundary; the UI hides controls a role can't use as UX only.

**Tech Stack:** Next.js Server Actions, React Hook Form + `@hookform/resolvers/zod`, Zod, shadcn `field`/`select`/`dialog`/`sheet`, the design-system `DataTable`/`FilterBar`/`EmptyState`/`ConfirmDialog`/`PageHeader`/`RoleBadge`.

**Spec:** `docs/superpowers/specs/2026-09-26-certtracker-design.md` (§4 data model, §5 RLS, §6.1 CRUD pattern), `docs/design-system.md` (§3 components, §4 patterns)

## Global Constraints

- Code, identifiers, comments, commits in English; UI text in Vietnamese.
- Commits: Conventional Commits (`feat:`, `fix:`, `test:`, `chore:`).
- `src/features/<feature>/{schema.ts, queries.ts, actions.ts, components/}` — reads in Server Components via `queries.ts`, writes via `actions.ts`.
- Server Action signature: `async (input: X): Promise<Result<T>>`, called directly from a React Hook Form submit handler (not `<form action>` / `useActionState` — that pattern is Week 1's login form only; RHF owns client validation + submitting state here). Re-validate with the **same** Zod schema server-side.
- Postgres errors go through `mapPostgresError` (Task 1) — never show a raw Postgres message to a user.
- No `any`. Every list page: `PageHeader` → `FilterBar` → `DataTable`, per `docs/design-system.md` §4.1.
- Role-based UI hiding is UX only — RLS (already in `supabase/migrations/20260928000004_rls.sql`) is the real boundary; do not add app-level permission checks that duplicate it.
- Every new migration-touching change is **out of scope** — Week 2 ships no new migrations; the schema is already in `supabase/migrations/2026092800000{1,2}_*.sql`.

## Facts this plan relies on (from the Week 1 schema + RLS — verified against the migrations, not re-derived per task)

| Table | Who can write | Delete behaviour |
|---|---|---|
| `dcs` | Admin only | Blocked (`23503`) while any `programs` row references it |
| `programs` | Admin only | Blocked (`23503`) while any `teams` row references it |
| `teams` | Admin only | **Allowed** — deleting a team sets `members.team_id` to `NULL` and removes its `team_managers` rows (cascade) |
| `team_managers` | Admin only; a user can `select` only their **own** rows | — |
| `members` | Admin: full CRUD. Manager: `update` only, `team_id` must stay one of their managed teams. Member/no create/delete for Manager. | — |
| `cert_types`, `providers` | Admin only | Blocked (`23503`) while any `courses` row references it |
| `courses` | Admin only (everyone reads) | Blocked (`23503`) while any `training_records` row references it |

`teams`/`programs`/`dcs`/`cert_types`/`providers`/`courses` are readable by **every** authenticated role (`for select using (true)`), including Member — that is how the Courses catalog stays visible to everyone while only Admin can write it.

## Scope decisions (flag if you disagree when reviewing)

1. **Picker widgets use plain `Select`, not the searchable `Combobox`.** Every list a Week 2 form picks from (DCs, Programs, Teams, CertTypes, Providers, manager candidates) is small (a handful to a few dozen rows). `docs/design-system.md` §3 reserves the searchable `Combobox` for pickers that can grow large (member/course pickers) — that lands in Week 3 (Training Records).
2. **DC, Program, Team, CertType, Provider live inside `Dialog`s** (≤3 fields each) on `/org` (DC/Program/Team) and `/courses` (CertType/Provider). **Course uses a `Sheet`**: it has 8 fields, over the design system's "≤6 fields → Dialog" line (§4.2).
3. **Assigning a team's manager(s)** needs to know a candidate's name/email, which only exists via `members` (not on `profiles` or in queryable `auth.users`). A user can become a team manager only once **someone with their email exists in `members`** and their `profiles.role` is `manager`. This is enforced in Task 3's query (candidates = `profiles` joined to `members` by `member_id`, `role = 'manager'`).
4. **`/org` is one page with three stacked sections** (DCs, Programs, Teams), not three routes — each list is tiny and they share one nav item already (`docs/design-system.md` §4.5).

## File map

```
package.json                                       + react-hook-form, @hookform/resolvers
src/components/ui/select.tsx                        shadcn (generated)
src/lib/postgres-error.ts (+ .test.ts)               mapPostgresError()
src/features/organizations/
  schema.ts (+ .test.ts)                             dcSchema, programSchema, teamSchema
  queries.ts                                         listDcs, listPrograms, listTeams,
                                                       listManagerCandidates, listTeamManagerIds
  actions.ts                                         create/update/delete × {Dc,Program,Team},
                                                       setTeamManagers
  components/
    dc-section.tsx, dc-dialog.tsx
    program-section.tsx, program-dialog.tsx
    team-section.tsx, team-dialog.tsx, team-managers-field.tsx
src/app/(app)/org/page.tsx                           rewrite (was a placeholder)
src/features/members/
  schema.ts (+ .test.ts)                             memberSchema
  queries.ts                                         listMembers, listTeamsForCurrentUser
  actions.ts                                         createMember, updateMember, deleteMember
  components/
    members-table.tsx, member-dialog.tsx
src/app/(app)/members/page.tsx                        rewrite
src/features/courses/
  schema.ts (+ .test.ts)                             certTypeSchema, providerSchema, courseSchema
  queries.ts                                          listCertTypes, listProviders, listCourses
  actions.ts                                          create/update/delete × {CertType,Provider,Course}
  components/
    cert-type-section.tsx, cert-type-dialog.tsx
    provider-section.tsx, provider-dialog.tsx
    courses-table.tsx, course-sheet.tsx
src/app/(app)/courses/page.tsx                        rewrite
e2e/org.spec.ts
e2e/members.spec.ts
e2e/courses.spec.ts
```

---

### Task 1: Shared CRUD infrastructure

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`
- Create (generated): `src/components/ui/select.tsx`
- Create: `src/lib/postgres-error.ts`, `src/lib/postgres-error.test.ts`

**Interfaces:**
- Produces: `mapPostgresError(error: { code?: string | null; message: string }, messages?: { duplicate?: string; restricted?: string }): string` from `@/lib/postgres-error`; `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` from `@/components/ui/select`.

- [ ] **Step 1: Install React Hook Form and the shadcn Select**

```bash
pnpm add react-hook-form @hookform/resolvers
pnpm exec shadcn add select
```

If the CLI asks to overwrite an existing file, answer **No**. Confirm `git diff --stat -- src/app/globals.css` is empty afterwards (Task 2 of `docs/superpowers/plans/2026-09-27-design-system.md` found `shadcn add` can touch it); if not, `git checkout -- src/app/globals.css`. Confirm the generated `src/components/ui/select.tsx` imports `cn` from `"@/lib/utils"` — if it says `"cn"`, ESLint will fail (`no-restricted-imports`, `eslint.config.mjs`); fix that one import line.

Read the generated `src/components/ui/select.tsx` and confirm it exports `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, with the root `Select` taking `value`/`onValueChange` (the same controlled-value convention this codebase's `Switch` already uses via `checked`/`onCheckedChange` — `src/components/ui/switch.tsx`). Every later task's code in this plan assumes exactly that shape. If the generated component differs (different prop names, a different item shape), adjust every `<Select>`/`<SelectTrigger>`/`<SelectItem>` usage in Tasks 2–4 to match and note the deviation — do not silently guess.

- [ ] **Step 2: Write the failing test**

Create `src/lib/postgres-error.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mapPostgresError } from "@/lib/postgres-error";

describe("mapPostgresError", () => {
  it("maps a unique violation to a Vietnamese duplicate message", () => {
    expect(mapPostgresError({ code: "23505", message: "duplicate key" })).toBe("Dữ liệu này đã tồn tại.");
  });

  it("prefers a caller-supplied duplicate message", () => {
    expect(
      mapPostgresError({ code: "23505", message: "duplicate key" }, { duplicate: 'Tên trung tâm "HN" đã tồn tại.' }),
    ).toBe('Tên trung tâm "HN" đã tồn tại.');
  });

  it("maps a foreign key violation to a restricted-delete message", () => {
    expect(mapPostgresError({ code: "23503", message: "violates foreign key" })).toBe(
      "Không thể xóa vì đang được dữ liệu khác sử dụng.",
    );
  });

  it("prefers a caller-supplied restricted message", () => {
    expect(
      mapPostgresError(
        { code: "23503", message: "violates foreign key" },
        { restricted: "Trung tâm đang có chương trình sử dụng. Xóa các chương trình trước." },
      ),
    ).toBe("Trung tâm đang có chương trình sử dụng. Xóa các chương trình trước.");
  });

  it("maps an RLS violation to a permission message", () => {
    expect(mapPostgresError({ code: "42501", message: "row-level security" })).toBe(
      "Bạn không có quyền thực hiện thao tác này.",
    );
  });

  it("falls back to a generic message for anything else", () => {
    expect(mapPostgresError({ code: "XX000", message: "boom" })).toBe("Có lỗi xảy ra. Vui lòng thử lại.");
    expect(mapPostgresError({ message: "boom" })).toBe("Có lỗi xảy ra. Vui lòng thử lại.");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test -- postgres-error`
Expected: FAIL — cannot resolve `@/lib/postgres-error`.

- [ ] **Step 4: Implement**

Create `src/lib/postgres-error.ts`:

```ts
/** Postgres SQLSTATE codes this app maps to a Vietnamese message. */
const DUPLICATE = "23505";
const RESTRICTED = "23503";
const FORBIDDEN = "42501";

/** Never show a raw Postgres/PostgREST error message to a user. */
export function mapPostgresError(
  error: { code?: string | null; message: string },
  messages: { duplicate?: string; restricted?: string } = {},
): string {
  switch (error.code) {
    case DUPLICATE:
      return messages.duplicate ?? "Dữ liệu này đã tồn tại.";
    case RESTRICTED:
      return messages.restricted ?? "Không thể xóa vì đang được dữ liệu khác sử dụng.";
    case FORBIDDEN:
      return "Bạn không có quyền thực hiện thao tác này.";
    default:
      return "Có lỗi xảy ra. Vui lòng thử lại.";
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test -- postgres-error`
Expected: PASS (6 tests).

- [ ] **Step 6: Verify and commit**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: all pass (64 tests: 58 existing + 6 new).

```bash
git add package.json pnpm-lock.yaml src/components/ui/select.tsx src/lib/postgres-error.ts src/lib/postgres-error.test.ts
git commit -m "feat: add shared CRUD infra (react-hook-form, shadcn select, postgres error mapping)"
```

---

### Task 2: Organization — DC, Program, Team (`/org`)

**Files:**
- Create: `src/features/organizations/schema.ts`, `src/features/organizations/schema.test.ts`, `src/features/organizations/queries.ts`, `src/features/organizations/actions.ts`
- Create: `src/features/organizations/components/{dc-section.tsx,dc-dialog.tsx,program-section.tsx,program-dialog.tsx,team-section.tsx,team-dialog.tsx}`
- Modify: `src/app/(app)/org/page.tsx`
- Test: `e2e/org.spec.ts`

**Interfaces:**
- Consumes: `Database` (`@/types/database`), `createClient` (`@/lib/supabase/server`), `Result`/`ok`/`err` (`@/lib/result`), `mapPostgresError` (`@/lib/postgres-error`), `PageHeader` (`@/components/app-shell/page-header`), `EmptyState`, `ConfirmDialog`.
- Produces:
  - `dcSchema`, `programSchema`, `teamSchema` (Zod) + `DcInput`, `ProgramInput`, `TeamInput` from `@/features/organizations/schema`
  - `listDcs(): Promise<{ id: string; name: string }[]>`
  - `listPrograms(): Promise<{ id: string; name: string; dcId: string; dcName: string }[]>`
  - `listTeams(): Promise<{ id: string; name: string; programId: string; programName: string }[]>`
  - `createDc/updateDc/deleteDc`, `createProgram/updateProgram/deleteProgram`, `createTeam/updateTeam/deleteTeam` — each `(input) => Promise<Result<null>>` (update/delete take `{ id, ...fields }` / `{ id }`)

- [ ] **Step 1: Write the failing schema test**

Create `src/features/organizations/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { dcSchema, programSchema, teamSchema } from "@/features/organizations/schema";

describe("dcSchema", () => {
  it("trims the name and rejects an empty one", () => {
    expect(dcSchema.safeParse({ name: "  DC34  " }).data).toEqual({ name: "DC34" });
    expect(dcSchema.safeParse({ name: "  " }).success).toBe(false);
  });
});

describe("programSchema", () => {
  it("requires a name and a DC", () => {
    const result = programSchema.safeParse({ name: "Digital Delivery", dcId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid program", () => {
    const result = programSchema.safeParse({
      name: "Digital Delivery",
      dcId: "00000000-0000-0000-0000-000000000000",
    });
    expect(result.success).toBe(true);
  });
});

describe("teamSchema", () => {
  it("requires a name and a program", () => {
    expect(teamSchema.safeParse({ name: "", programId: "00000000-0000-0000-0000-000000000000" }).success).toBe(
      false,
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- organizations/schema`
Expected: FAIL — cannot resolve `@/features/organizations/schema`.

- [ ] **Step 3: Implement the schema**

Create `src/features/organizations/schema.ts`:

```ts
import { z } from "zod";

export const dcSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên trung tâm"),
});
export type DcInput = z.infer<typeof dcSchema>;

export const programSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên chương trình"),
  dcId: z.string().uuid("Vui lòng chọn trung tâm"),
});
export type ProgramInput = z.infer<typeof programSchema>;

export const teamSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên team"),
  programId: z.string().uuid("Vui lòng chọn chương trình"),
});
export type TeamInput = z.infer<typeof teamSchema>;
```

Run: `pnpm test -- organizations/schema` → PASS (4 tests).

- [ ] **Step 4: Queries**

Create `src/features/organizations/queries.ts`:

```ts
import { createClient } from "@/lib/supabase/server";

export async function listDcs() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("dcs").select("id, name").order("name");
  if (error) throw new Error(error.message);
  return data;
}

export async function listPrograms() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("programs")
    .select("id, name, dc_id, dcs(name)")
    .order("name");
  if (error) throw new Error(error.message);
  return data.map((row) => ({ id: row.id, name: row.name, dcId: row.dc_id, dcName: row.dcs?.name ?? "" }));
}

export async function listTeams() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teams")
    .select("id, name, program_id, programs(name)")
    .order("name");
  if (error) throw new Error(error.message);
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    programId: row.program_id,
    programName: row.programs?.name ?? "",
  }));
}

/** Candidates to become a team's manager: signed-up users with role "manager" who also have a member profile (so we have a name/email to show). */
export async function listManagerCandidates() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, members(id, full_name, email)")
    .eq("role", "manager")
    .not("member_id", "is", null);
  if (error) throw new Error(error.message);
  return data
    .filter((row) => row.members)
    .map((row) => ({ userId: row.user_id, fullName: row.members!.full_name, email: row.members!.email }));
}

/** Manager user_ids currently assigned to a team. A user only ever sees their own team_managers row (RLS), so this is Admin-only in practice — called from the Admin-only /org page. */
export async function listTeamManagerIds(teamId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("team_managers").select("user_id").eq("team_id", teamId);
  if (error) throw new Error(error.message);
  return data.map((row) => row.user_id);
}
```

- [ ] **Step 5: Actions**

Create `src/features/organizations/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { dcSchema, programSchema, teamSchema, type DcInput, type ProgramInput, type TeamInput } from "@/features/organizations/schema";
import { err, ok, type Result } from "@/lib/result";
import { mapPostgresError } from "@/lib/postgres-error";
import { createClient } from "@/lib/supabase/server";

export async function createDc(input: DcInput): Promise<Result<null>> {
  const parsed = dcSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { error } = await supabase.from("dcs").insert(parsed.data);
  if (error) return err(mapPostgresError(error, { duplicate: `Trung tâm "${parsed.data.name}" đã tồn tại.` }));
  revalidatePath("/org");
  return ok(null);
}

export async function updateDc(input: DcInput & { id: string }): Promise<Result<null>> {
  const parsed = dcSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { error } = await supabase.from("dcs").update(parsed.data).eq("id", input.id);
  if (error) return err(mapPostgresError(error, { duplicate: `Trung tâm "${parsed.data.name}" đã tồn tại.` }));
  revalidatePath("/org");
  return ok(null);
}

export async function deleteDc(input: { id: string }): Promise<Result<null>> {
  const supabase = await createClient();
  const { error } = await supabase.from("dcs").delete().eq("id", input.id);
  if (error) {
    return err(mapPostgresError(error, { restricted: "Trung tâm đang có chương trình. Xóa các chương trình trước." }));
  }
  revalidatePath("/org");
  return ok(null);
}

export async function createProgram(input: ProgramInput): Promise<Result<null>> {
  const parsed = programSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { error } = await supabase.from("programs").insert({ name: parsed.data.name, dc_id: parsed.data.dcId });
  if (error) return err(mapPostgresError(error, { duplicate: `Chương trình "${parsed.data.name}" đã tồn tại trong trung tâm này.` }));
  revalidatePath("/org");
  return ok(null);
}

export async function updateProgram(input: ProgramInput & { id: string }): Promise<Result<null>> {
  const parsed = programSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { error } = await supabase
    .from("programs")
    .update({ name: parsed.data.name, dc_id: parsed.data.dcId })
    .eq("id", input.id);
  if (error) return err(mapPostgresError(error, { duplicate: `Chương trình "${parsed.data.name}" đã tồn tại trong trung tâm này.` }));
  revalidatePath("/org");
  return ok(null);
}

export async function deleteProgram(input: { id: string }): Promise<Result<null>> {
  const supabase = await createClient();
  const { error } = await supabase.from("programs").delete().eq("id", input.id);
  if (error) {
    return err(mapPostgresError(error, { restricted: "Chương trình đang có team. Xóa các team trước." }));
  }
  revalidatePath("/org");
  return ok(null);
}

export async function createTeam(input: TeamInput): Promise<Result<null>> {
  const parsed = teamSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { error } = await supabase.from("teams").insert({ name: parsed.data.name, program_id: parsed.data.programId });
  if (error) return err(mapPostgresError(error, { duplicate: `Team "${parsed.data.name}" đã tồn tại trong chương trình này.` }));
  revalidatePath("/org");
  return ok(null);
}

export async function updateTeam(input: TeamInput & { id: string }): Promise<Result<null>> {
  const parsed = teamSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { error } = await supabase
    .from("teams")
    .update({ name: parsed.data.name, program_id: parsed.data.programId })
    .eq("id", input.id);
  if (error) return err(mapPostgresError(error, { duplicate: `Team "${parsed.data.name}" đã tồn tại trong chương trình này.` }));
  revalidatePath("/org");
  return ok(null);
}

/** Deleting a team is never blocked (members.team_id → NULL, team_managers cascades) — the ConfirmDialog must say so. */
export async function deleteTeam(input: { id: string }): Promise<Result<null>> {
  const supabase = await createClient();
  const { error } = await supabase.from("teams").delete().eq("id", input.id);
  if (error) return err(mapPostgresError(error));
  revalidatePath("/org");
  return ok(null);
}

/** Replaces a team's manager set with exactly `userIds` (diff of add/remove against team_managers). */
export async function setTeamManagers(input: { teamId: string; userIds: string[] }): Promise<Result<null>> {
  const supabase = await createClient();
  const { data: current, error: readError } = await supabase
    .from("team_managers")
    .select("user_id")
    .eq("team_id", input.teamId);
  if (readError) return err(mapPostgresError(readError));

  const currentIds = new Set(current.map((row) => row.user_id));
  const nextIds = new Set(input.userIds);
  const toAdd = [...nextIds].filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !nextIds.has(id));

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from("team_managers")
      .insert(toAdd.map((userId) => ({ team_id: input.teamId, user_id: userId })));
    if (error) return err(mapPostgresError(error));
  }
  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("team_managers")
      .delete()
      .eq("team_id", input.teamId)
      .in("user_id", toRemove);
    if (error) return err(mapPostgresError(error));
  }
  revalidatePath("/org");
  return ok(null);
}
```

- [ ] **Step 6: DC section (list + create/edit dialog)**

Create `src/features/organizations/components/dc-dialog.tsx`:

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { createDc, updateDc } from "@/features/organizations/actions";
import { dcSchema, type DcInput } from "@/features/organizations/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function DcDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: { id: string; name: string } | null;
}) {
  const form = useForm<DcInput>({ resolver: zodResolver(dcSchema), values: { name: editing?.name ?? "" } });

  async function onSubmit(values: DcInput) {
    const result = editing ? await updateDc({ id: editing.id, ...values }) : await createDc(values);
    if (!result.ok) {
      form.setError("name", { message: result.error });
      return;
    }
    toast.success(editing ? `Đã lưu trung tâm ${values.name}` : `Đã thêm trung tâm ${values.name}`);
    onOpenChange(false);
    form.reset({ name: "" });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-section-title">{editing ? "Sửa trung tâm" : "Thêm trung tâm"}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <Field>
            <FieldLabel htmlFor="dc-name">Tên trung tâm</FieldLabel>
            <Input id="dc-name" {...form.register("name")} aria-invalid={!!form.formState.errors.name} />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Đang lưu…" : "Lưu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

Create `src/features/organizations/components/dc-section.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { Button } from "@/components/ui/button";
import { deleteDc } from "@/features/organizations/actions";
import { DcDialog } from "@/features/organizations/components/dc-dialog";

type Dc = { id: string; name: string };

const COLUMNS: ColumnDef<Dc, unknown>[] = [{ accessorKey: "name", header: "Tên trung tâm" }];

export function DcSection({ dcs }: { dcs: Dc[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Dc | null>(null);
  const [confirming, setConfirming] = useState<Dc | null>(null);
  const [pending, setPending] = useState(false);

  const columnsWithActions: ColumnDef<Dc, unknown>[] = [
    ...COLUMNS,
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(row.original);
              setDialogOpen(true);
            }}
          >
            Sửa
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(row.original)}>
            Xóa
          </Button>
        </div>
      ),
    },
  ];

  async function handleDelete() {
    if (!confirming) return;
    setPending(true);
    const result = await deleteDc({ id: confirming.id });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      setConfirming(null);
      return;
    }
    toast.success(`Đã xóa trung tâm ${confirming.name}`);
    setConfirming(null);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-section-title">Trung tâm (DC)</h2>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus aria-hidden className="size-4" />
          Thêm trung tâm
        </Button>
      </div>
      <DataTable
        columns={columnsWithActions}
        data={dcs}
        getRowId={(row) => row.id}
        empty={<EmptyState title="Chưa có trung tâm nào" description="Thêm trung tâm đầu tiên để bắt đầu." />}
      />
      <DcDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
      <ConfirmDialog
        open={!!confirming}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={`Xóa trung tâm ${confirming?.name}?`}
        description="Chỉ xóa được khi trung tâm chưa có chương trình nào."
        confirmLabel="Xóa trung tâm"
        pendingLabel="Đang xóa…"
        pending={pending}
        onConfirm={handleDelete}
      />
    </section>
  );
}
```

- [ ] **Step 7: Program section (adds the DC `Select`)**

Create `src/features/organizations/components/program-dialog.tsx`:

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { createProgram, updateProgram } from "@/features/organizations/actions";
import { programSchema, type ProgramInput } from "@/features/organizations/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type DcOption = { id: string; name: string };
type Editing = { id: string; name: string; dcId: string } | null;

export function ProgramDialog({
  open,
  onOpenChange,
  editing,
  dcs,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Editing;
  dcs: DcOption[];
}) {
  const form = useForm<ProgramInput>({
    resolver: zodResolver(programSchema),
    values: { name: editing?.name ?? "", dcId: editing?.dcId ?? "" },
  });

  async function onSubmit(values: ProgramInput) {
    const result = editing ? await updateProgram({ id: editing.id, ...values }) : await createProgram(values);
    if (!result.ok) {
      form.setError("root", { message: result.error });
      return;
    }
    toast.success(editing ? `Đã lưu chương trình ${values.name}` : `Đã thêm chương trình ${values.name}`);
    onOpenChange(false);
    form.reset({ name: "", dcId: "" });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-section-title">{editing ? "Sửa chương trình" : "Thêm chương trình"}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <Field>
            <FieldLabel htmlFor="program-name">Tên chương trình</FieldLabel>
            <Input id="program-name" {...form.register("name")} aria-invalid={!!form.formState.errors.name} />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="program-dc">Trung tâm</FieldLabel>
            <Controller
              control={form.control}
              name="dcId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="program-dc" aria-invalid={!!form.formState.errors.dcId}>
                    {/* Base UI's SelectValue renders the raw value by default; map it back to the DC name. */}
                    <SelectValue placeholder="Chọn trung tâm">
                      {(value: string) => dcs.find((dc) => dc.id === value)?.name ?? "Chọn trung tâm"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {dcs.map((dc) => (
                      <SelectItem key={dc.id} value={dc.id}>
                        {dc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError errors={[form.formState.errors.dcId]} />
          </Field>
          {form.formState.errors.root && (
            <p role="alert" className="text-caption text-destructive">
              {form.formState.errors.root.message}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Đang lưu…" : "Lưu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

Create `src/features/organizations/components/program-section.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { Button } from "@/components/ui/button";
import { deleteProgram } from "@/features/organizations/actions";
import { ProgramDialog } from "@/features/organizations/components/program-dialog";

type Program = { id: string; name: string; dcId: string; dcName: string };
type DcOption = { id: string; name: string };

export function ProgramSection({ programs, dcs }: { programs: Program[]; dcs: DcOption[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [confirming, setConfirming] = useState<Program | null>(null);
  const [pending, setPending] = useState(false);

  const columns: ColumnDef<Program, unknown>[] = [
    { accessorKey: "name", header: "Tên chương trình" },
    { accessorKey: "dcName", header: "Trung tâm" },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(row.original);
              setDialogOpen(true);
            }}
          >
            Sửa
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(row.original)}>
            Xóa
          </Button>
        </div>
      ),
    },
  ];

  async function handleDelete() {
    if (!confirming) return;
    setPending(true);
    const result = await deleteProgram({ id: confirming.id });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      setConfirming(null);
      return;
    }
    toast.success(`Đã xóa chương trình ${confirming.name}`);
    setConfirming(null);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-section-title">Chương trình</h2>
        <Button
          size="sm"
          disabled={dcs.length === 0}
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus aria-hidden className="size-4" />
          Thêm chương trình
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={programs}
        getRowId={(row) => row.id}
        empty={
          <EmptyState
            title="Chưa có chương trình nào"
            description={dcs.length === 0 ? "Thêm trung tâm trước." : "Thêm chương trình đầu tiên."}
          />
        }
      />
      <ProgramDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} dcs={dcs} />
      <ConfirmDialog
        open={!!confirming}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={`Xóa chương trình ${confirming?.name}?`}
        description="Chỉ xóa được khi chương trình chưa có team nào."
        confirmLabel="Xóa chương trình"
        pendingLabel="Đang xóa…"
        pending={pending}
        onConfirm={handleDelete}
      />
    </section>
  );
}
```

- [ ] **Step 8: Team section (Program `Select` + manager assignment)**

Create `src/features/organizations/components/team-managers-field.tsx`:

```tsx
"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type Candidate = { userId: string; fullName: string; email: string };

export function TeamManagersField({
  candidates,
  selected,
  onChange,
}: {
  candidates: Candidate[];
  selected: string[];
  onChange: (userIds: string[]) => void;
}) {
  if (candidates.length === 0) {
    return <p className="text-caption text-muted-foreground">Chưa có tài khoản nào mang vai trò Quản lý.</p>;
  }

  return (
    <div className="flex max-h-40 flex-col gap-2 overflow-y-auto">
      {candidates.map((candidate) => {
        const checked = selected.includes(candidate.userId);
        const id = `manager-${candidate.userId}`;
        return (
          <Label key={candidate.userId} htmlFor={id} className="flex items-center gap-2 text-body">
            <Checkbox
              id={id}
              checked={checked}
              onCheckedChange={(next) =>
                onChange(next ? [...selected, candidate.userId] : selected.filter((id) => id !== candidate.userId))
              }
            />
            {candidate.fullName}
            <span className="text-caption text-muted-foreground">{candidate.email}</span>
          </Label>
        );
      })}
    </div>
  );
}
```

Create `src/features/organizations/components/team-dialog.tsx`:

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { createTeam, setTeamManagers, updateTeam } from "@/features/organizations/actions";
import { teamSchema, type TeamInput } from "@/features/organizations/schema";
import { TeamManagersField } from "@/features/organizations/components/team-managers-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ProgramOption = { id: string; name: string };
type Candidate = { userId: string; fullName: string; email: string };
type Editing = { id: string; name: string; programId: string; managerIds: string[] } | null;

export function TeamDialog({
  open,
  onOpenChange,
  editing,
  programs,
  candidates,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Editing;
  programs: ProgramOption[];
  candidates: Candidate[];
}) {
  const form = useForm<TeamInput>({
    resolver: zodResolver(teamSchema),
    values: { name: editing?.name ?? "", programId: editing?.programId ?? "" },
  });
  const [managerIds, setManagerIds] = useState<string[]>(editing?.managerIds ?? []);

  useEffect(() => {
    setManagerIds(editing?.managerIds ?? []);
  }, [editing]);

  async function onSubmit(values: TeamInput) {
    const result = editing ? await updateTeam({ id: editing.id, ...values }) : await createTeam(values);
    if (!result.ok) {
      form.setError("root", { message: result.error });
      return;
    }
    if (editing) {
      const managerResult = await setTeamManagers({ teamId: editing.id, userIds: managerIds });
      if (!managerResult.ok) {
        toast.error(managerResult.error);
        return;
      }
    }
    toast.success(editing ? `Đã lưu team ${values.name}` : `Đã thêm team ${values.name}`);
    onOpenChange(false);
    form.reset({ name: "", programId: "" });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-section-title">{editing ? "Sửa team" : "Thêm team"}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <Field>
            <FieldLabel htmlFor="team-name">Tên team</FieldLabel>
            <Input id="team-name" {...form.register("name")} aria-invalid={!!form.formState.errors.name} />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="team-program">Chương trình</FieldLabel>
            <Controller
              control={form.control}
              name="programId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="team-program" aria-invalid={!!form.formState.errors.programId}>
                    {/* Base UI's SelectValue renders the raw value by default; map it back to the program name. */}
                    <SelectValue placeholder="Chọn chương trình">
                      {(value: string) => programs.find((program) => program.id === value)?.name ?? "Chọn chương trình"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((program) => (
                      <SelectItem key={program.id} value={program.id}>
                        {program.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError errors={[form.formState.errors.programId]} />
          </Field>
          {editing && (
            <Field>
              <FieldLabel>Quản lý team</FieldLabel>
              <TeamManagersField candidates={candidates} selected={managerIds} onChange={setManagerIds} />
            </Field>
          )}
          {!editing && (
            <p className="text-caption text-muted-foreground">Gán quản lý sau khi lưu team.</p>
          )}
          {form.formState.errors.root && (
            <p role="alert" className="text-caption text-destructive">
              {form.formState.errors.root.message}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Đang lưu…" : "Lưu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

Create `src/features/organizations/components/team-section.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { Button } from "@/components/ui/button";
import { deleteTeam } from "@/features/organizations/actions";
import { TeamDialog } from "@/features/organizations/components/team-dialog";

type Team = { id: string; name: string; programId: string; programName: string; managerIds: string[] };
type ProgramOption = { id: string; name: string };
type Candidate = { userId: string; fullName: string; email: string };

export function TeamSection({
  teams,
  programs,
  candidates,
}: {
  teams: Team[];
  programs: ProgramOption[];
  candidates: Candidate[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  const [confirming, setConfirming] = useState<Team | null>(null);
  const [pending, setPending] = useState(false);

  const columns: ColumnDef<Team, unknown>[] = [
    { accessorKey: "name", header: "Tên team" },
    { accessorKey: "programName", header: "Chương trình" },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(row.original);
              setDialogOpen(true);
            }}
          >
            Sửa
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(row.original)}>
            Xóa
          </Button>
        </div>
      ),
    },
  ];

  async function handleDelete() {
    if (!confirming) return;
    setPending(true);
    const result = await deleteTeam({ id: confirming.id });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      setConfirming(null);
      return;
    }
    toast.success(`Đã xóa team ${confirming.name}`);
    setConfirming(null);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-section-title">Team</h2>
        <Button
          size="sm"
          disabled={programs.length === 0}
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus aria-hidden className="size-4" />
          Thêm team
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={teams}
        getRowId={(row) => row.id}
        empty={
          <EmptyState
            title="Chưa có team nào"
            description={programs.length === 0 ? "Thêm chương trình trước." : "Thêm team đầu tiên."}
          />
        }
      />
      <TeamDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} programs={programs} candidates={candidates} />
      <ConfirmDialog
        open={!!confirming}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={`Xóa team ${confirming?.name}?`}
        description="Thành viên trong team sẽ mất gán team (không bị xóa); người quản lý team này sẽ bị gỡ."
        confirmLabel="Xóa team"
        pendingLabel="Đang xóa…"
        pending={pending}
        onConfirm={handleDelete}
      />
    </section>
  );
}
```

- [ ] **Step 9: Wire the page**

Replace `src/app/(app)/org/page.tsx`:

```tsx
import { PageHeader } from "@/components/app-shell/page-header";
import { DcSection } from "@/features/organizations/components/dc-section";
import { ProgramSection } from "@/features/organizations/components/program-section";
import { TeamSection } from "@/features/organizations/components/team-section";
import { listDcs, listManagerCandidates, listPrograms, listTeamManagerIds, listTeams } from "@/features/organizations/queries";

export default async function OrgPage() {
  const [dcs, programs, teamRows, candidates] = await Promise.all([
    listDcs(),
    listPrograms(),
    listTeams(),
    listManagerCandidates(),
  ]);
  const teams = await Promise.all(
    teamRows.map(async (team) => ({ ...team, managerIds: await listTeamManagerIds(team.id) })),
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Tổ chức" description="Trung tâm, chương trình và team." />
      <DcSection dcs={dcs} />
      <ProgramSection programs={programs} dcs={dcs} />
      <TeamSection teams={teams} programs={programs} candidates={candidates} />
    </div>
  );
}
```

- [ ] **Step 10: Verify and commit**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: all pass (64 tests — Task 2 adds none beyond Task 1's since the schema test was already run in Step 3; confirm `pnpm test` still reports 64).

Manual smoke with `pnpm dev` (Docker + `supabase start` running), signed in as `admin@certtracker.test` (password in `supabase/seed.sql`, do not paste it): open `/org`; add a DC; add a Program under it; add a Team under that Program; open the Team again and check a manager candidate (the seed's `manager@certtracker.test` only qualifies if it has `role = 'manager'` **and** a linked `member_id` — check via Supabase Studio `select role, member_id from profiles`; if the seed manager has no `member_id`, the candidates list will legitimately be empty — note this in the report, it is not a bug); delete the DC (must fail with the restricted-delete message while the Program exists); delete the Program then the DC (must succeed).

```bash
git add src/features/organizations src/app/\(app\)/org/page.tsx
git commit -m "feat: add DC, Program, Team CRUD with team manager assignment"
```

---

### Task 3: Members (`/members`, role-aware)

**Files:**
- Create: `src/features/members/schema.ts`, `src/features/members/schema.test.ts`, `src/features/members/queries.ts`, `src/features/members/actions.ts`
- Create: `src/features/members/components/{members-table.tsx,member-dialog.tsx}`
- Modify: `src/app/(app)/members/page.tsx`
- Test: `e2e/members.spec.ts`

**Interfaces:**
- Consumes: `getCurrentUser` (`@/features/auth/queries`), `mapPostgresError`, `Result`/`ok`/`err`, `PageHeader`, `RoleBadge`, `DataTable`, `FilterBar`, `EmptyState`, `ConfirmDialog`.
- Produces:
  - `memberSchema` + `MemberInput` from `@/features/members/schema`
  - `listMembers(): Promise<{ id: string; code: string; fullName: string; email: string; teamId: string | null; teamName: string | null; isActive: boolean }[]>` — RLS already scopes this to "all" for Admin / "managed team" for Manager
  - `listTeamOptionsForCurrentUser(): Promise<{ id: string; name: string }[]>` — all teams for Admin, only managed teams for Manager
  - `createMember/updateMember/deleteMember` — `(input) => Promise<Result<null>>`

- [ ] **Step 1: Write the failing schema test**

Create `src/features/members/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { memberSchema } from "@/features/members/schema";

describe("memberSchema", () => {
  it("requires a name, a valid email and a team", () => {
    const result = memberSchema.safeParse({
      fullName: "Nguyễn Văn An",
      email: "an@certtracker.test",
      teamId: "00000000-0000-0000-0000-000000000000",
      isActive: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(
      memberSchema.safeParse({
        fullName: "An",
        email: "not-an-email",
        teamId: "00000000-0000-0000-0000-000000000000",
        isActive: true,
      }).success,
    ).toBe(false);
  });

  it("defaults isActive to true when omitted", () => {
    const result = memberSchema.safeParse({
      fullName: "An",
      email: "an@certtracker.test",
      teamId: "00000000-0000-0000-0000-000000000000",
    });
    expect(result.data?.isActive).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- members/schema`
Expected: FAIL — cannot resolve `@/features/members/schema`.

- [ ] **Step 3: Implement the schema**

Create `src/features/members/schema.ts`:

```ts
import { z } from "zod";

export const memberSchema = z.object({
  fullName: z.string().trim().min(1, "Vui lòng nhập họ tên"),
  email: z.string().trim().email("Email không hợp lệ"),
  teamId: z.string().uuid("Vui lòng chọn team"),
  isActive: z.boolean().default(true),
});
export type MemberInput = z.infer<typeof memberSchema>;
```

Run: `pnpm test -- members/schema` → PASS (3 tests).

- [ ] **Step 4: Queries**

Create `src/features/members/queries.ts`:

```ts
import { getCurrentUser } from "@/features/auth/queries";
import { createClient } from "@/lib/supabase/server";

export async function listMembers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .select("id, code, full_name, email, team_id, is_active, teams(name)")
    .order("full_name");
  if (error) throw new Error(error.message);
  return data.map((row) => ({
    id: row.id,
    code: row.code,
    fullName: row.full_name,
    email: row.email,
    teamId: row.team_id,
    teamName: row.teams?.name ?? null,
    isActive: row.is_active,
  }));
}

/** All teams for Admin; only the teams this user manages for Manager. `teams` itself has no role restriction (spec §5), so the filtering here is for form UX, not security. */
export async function listTeamOptionsForCurrentUser() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  if (user?.role === "admin") {
    const { data, error } = await supabase.from("teams").select("id, name").order("name");
    if (error) throw new Error(error.message);
    return data;
  }

  const { data: managed, error: managedError } = await supabase.from("team_managers").select("team_id");
  if (managedError) throw new Error(managedError.message);
  const teamIds = managed.map((row) => row.team_id);
  if (teamIds.length === 0) return [];

  const { data, error } = await supabase.from("teams").select("id, name").in("id", teamIds).order("name");
  if (error) throw new Error(error.message);
  return data;
}
```

- [ ] **Step 5: Actions**

Create `src/features/members/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { memberSchema, type MemberInput } from "@/features/members/schema";
import { err, ok, type Result } from "@/lib/result";
import { mapPostgresError } from "@/lib/postgres-error";
import { createClient } from "@/lib/supabase/server";

/** Admin only — RLS has no insert policy for members for Manager (supabase/migrations/20260928000004_rls.sql). */
export async function createMember(input: MemberInput): Promise<Result<null>> {
  const parsed = memberSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { error } = await supabase.from("members").insert({
    full_name: parsed.data.fullName,
    email: parsed.data.email,
    team_id: parsed.data.teamId,
    is_active: parsed.data.isActive,
  });
  if (error) return err(mapPostgresError(error, { duplicate: `Email "${parsed.data.email}" đã được dùng.` }));
  revalidatePath("/members");
  return ok(null);
}

/** Admin: any member. Manager: members in a team they manage — and `teamId` must stay one of those teams (RLS with-check). */
export async function updateMember(input: MemberInput & { id: string }): Promise<Result<null>> {
  const parsed = memberSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { error } = await supabase
    .from("members")
    .update({
      full_name: parsed.data.fullName,
      email: parsed.data.email,
      team_id: parsed.data.teamId,
      is_active: parsed.data.isActive,
    })
    .eq("id", input.id);
  if (error) return err(mapPostgresError(error, { duplicate: `Email "${parsed.data.email}" đã được dùng.` }));
  revalidatePath("/members");
  return ok(null);
}

/** Admin only. */
export async function deleteMember(input: { id: string }): Promise<Result<null>> {
  const supabase = await createClient();
  const { error } = await supabase.from("members").delete().eq("id", input.id);
  if (error) {
    return err(mapPostgresError(error, { restricted: "Thành viên đang có chứng chỉ. Xóa các bản ghi chứng chỉ trước." }));
  }
  revalidatePath("/members");
  return ok(null);
}
```

- [ ] **Step 6: Member dialog**

Create `src/features/members/components/member-dialog.tsx`:

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { createMember, updateMember } from "@/features/members/actions";
import { memberSchema, type MemberInput } from "@/features/members/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type TeamOption = { id: string; name: string };
type Editing = { id: string; fullName: string; email: string; teamId: string | null; isActive: boolean } | null;

export function MemberDialog({
  open,
  onOpenChange,
  editing,
  teams,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Editing;
  teams: TeamOption[];
}) {
  const form = useForm<MemberInput>({
    resolver: zodResolver(memberSchema),
    values: {
      fullName: editing?.fullName ?? "",
      email: editing?.email ?? "",
      teamId: editing?.teamId ?? "",
      isActive: editing?.isActive ?? true,
    },
  });

  async function onSubmit(values: MemberInput) {
    const result = editing ? await updateMember({ id: editing.id, ...values }) : await createMember(values);
    if (!result.ok) {
      form.setError("root", { message: result.error });
      return;
    }
    toast.success(editing ? `Đã lưu thành viên ${values.fullName}` : `Đã thêm thành viên ${values.fullName}`);
    onOpenChange(false);
    form.reset({ fullName: "", email: "", teamId: "", isActive: true });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-section-title">{editing ? "Sửa thành viên" : "Thêm thành viên"}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <Field>
            <FieldLabel htmlFor="member-name">Họ tên</FieldLabel>
            <Input id="member-name" {...form.register("fullName")} aria-invalid={!!form.formState.errors.fullName} />
            <FieldError errors={[form.formState.errors.fullName]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="member-email">Email</FieldLabel>
            <Input id="member-email" type="email" {...form.register("email")} aria-invalid={!!form.formState.errors.email} />
            <FieldError errors={[form.formState.errors.email]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="member-team">Team</FieldLabel>
            <Controller
              control={form.control}
              name="teamId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="member-team" aria-invalid={!!form.formState.errors.teamId}>
                    {/* Base UI's SelectValue renders the raw value by default; map it back to the team name. */}
                    <SelectValue placeholder="Chọn team">
                      {(value: string) => teams.find((team) => team.id === value)?.name ?? "Chọn team"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError errors={[form.formState.errors.teamId]} />
          </Field>
          <Field orientation="horizontal">
            <FieldLabel htmlFor="member-active">Đang hoạt động</FieldLabel>
            <Controller
              control={form.control}
              name="isActive"
              render={({ field }) => <Switch id="member-active" checked={field.value} onCheckedChange={field.onChange} />}
            />
          </Field>
          {form.formState.errors.root && (
            <p role="alert" className="text-caption text-destructive">
              {form.formState.errors.root.message}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Đang lưu…" : "Lưu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 7: Members table (role-aware controls)**

Create `src/features/members/components/members-table.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { FilterBar } from "@/components/data/filter-bar";
import { MemberCode } from "@/components/status/member-code";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteMember } from "@/features/members/actions";
import { MemberDialog } from "@/features/members/components/member-dialog";

type Member = {
  id: string;
  code: string;
  fullName: string;
  email: string;
  teamId: string | null;
  teamName: string | null;
  isActive: boolean;
};
type TeamOption = { id: string; name: string };

export function MembersTable({
  members,
  teams,
  canCreate,
  canDelete,
}: {
  members: Member[];
  teams: TeamOption[];
  canCreate: boolean;
  canDelete: boolean;
}) {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [confirming, setConfirming] = useState<Member | null>(null);
  const [pending, setPending] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => `${m.code} ${m.fullName} ${m.email}`.toLowerCase().includes(q));
  }, [members, search]);

  const columns: ColumnDef<Member, unknown>[] = [
    { accessorKey: "code", header: "Mã", cell: ({ row }) => <MemberCode code={row.original.code} /> },
    { accessorKey: "fullName", header: "Họ tên" },
    { accessorKey: "email", header: "Email" },
    { accessorKey: "teamName", header: "Team", cell: ({ row }) => row.original.teamName ?? "—" },
    {
      accessorKey: "isActive",
      header: "Trạng thái",
      cell: ({ row }) =>
        row.original.isActive ? (
          <Badge variant="secondary" className="rounded-sm">
            Đang hoạt động
          </Badge>
        ) : (
          <span className="text-caption text-muted-foreground">Ngừng hoạt động</span>
        ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label={`Thao tác cho ${row.original.fullName}`} />}>
            <MoreHorizontal aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setEditing(row.original);
                setDialogOpen(true);
              }}
            >
              Sửa
            </DropdownMenuItem>
            {canDelete && (
              <DropdownMenuItem variant="destructive" onClick={() => setConfirming(row.original)}>
                Xóa
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  async function handleDelete() {
    if (!confirming) return;
    setPending(true);
    const result = await deleteMember({ id: confirming.id });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      setConfirming(null);
      return;
    }
    toast.success(`Đã xóa thành viên ${confirming.fullName}`);
    setConfirming(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm theo tên, mã, email…"
        hasActiveFilters={search.length > 0}
        onClear={() => setSearch("")}
      >
        {canCreate && (
          <Button
            size="sm"
            className="ml-auto"
            disabled={teams.length === 0}
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus aria-hidden className="size-4" />
            Thêm thành viên
          </Button>
        )}
      </FilterBar>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        empty={<EmptyState title="Không tìm thấy thành viên" description="Thử từ khóa khác hoặc xóa bộ lọc." />}
      />
      <MemberDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} teams={teams} />
      {canDelete && (
        <ConfirmDialog
          open={!!confirming}
          onOpenChange={(open) => !open && setConfirming(null)}
          title={`Xóa thành viên ${confirming?.code} · ${confirming?.fullName}?`}
          description="Chỉ xóa được khi thành viên chưa có bản ghi chứng chỉ nào. Không thể hoàn tác."
          confirmLabel="Xóa thành viên"
          pendingLabel="Đang xóa…"
          pending={pending}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 8: Wire the page**

Replace `src/app/(app)/members/page.tsx`:

```tsx
import { PageHeader } from "@/components/app-shell/page-header";
import { getCurrentUser } from "@/features/auth/queries";
import { MembersTable } from "@/features/members/components/members-table";
import { listMembers, listTeamOptionsForCurrentUser } from "@/features/members/queries";

export default async function MembersPage() {
  const user = await getCurrentUser();
  const [members, teams] = await Promise.all([listMembers(), listTeamOptionsForCurrentUser()]);
  const isAdmin = user?.role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Thành viên"
        description={isAdmin ? "Toàn bộ thành viên và team của họ." : "Thành viên trong team bạn quản lý."}
      />
      <MembersTable members={members} teams={teams} canCreate={isAdmin} canDelete={isAdmin} />
    </div>
  );
}
```

- [ ] **Step 9: Verify and commit**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: all pass (67 tests: 64 + 3 new).

Manual smoke: as admin, add a member with a team, edit it, delete it (blocked if training_records reference it — none do yet in seed data, so delete should succeed). As `manager@certtracker.test`, open `/members`: no "Thêm thành viên" button, no "Xóa" menu item, only members in the manager's managed team(s) appear, and the Team select in Edit only lists that manager's own team(s).

```bash
git add src/features/members src/app/\(app\)/members/page.tsx
git commit -m "feat: add role-aware member CRUD"
```

---

### Task 4: Course catalog — CertType, Provider, Course (`/courses`)

**Files:**
- Create: `src/features/courses/schema.ts`, `src/features/courses/schema.test.ts`, `src/features/courses/queries.ts`, `src/features/courses/actions.ts`
- Create: `src/features/courses/components/{cert-type-section.tsx,cert-type-dialog.tsx,provider-section.tsx,provider-dialog.tsx,courses-table.tsx,course-sheet.tsx}`
- Modify: `src/app/(app)/courses/page.tsx`
- Test: `e2e/courses.spec.ts`

**Interfaces:**
- Consumes: `getCurrentUser`, `mapPostgresError`, `Result`/`ok`/`err`, `PageHeader`, `DataTable`, `FilterBar`, `EmptyState`, `ConfirmDialog`, `formatVnd` (`@/lib/format`).
- Produces:
  - `certTypeSchema`, `providerSchema`, `courseSchema` + their `*Input` types from `@/features/courses/schema`
  - `listCertTypes()`, `listProviders()`, `listCourses(): Promise<{ id, name, certTypeId, certTypeName, providerId, providerName, level, validityMonths, refundable, cost, estHours, url }[]>`
  - `create/update/delete` × `{CertType, Provider, Course}` — `(input) => Promise<Result<null>>`

- [ ] **Step 1: Write the failing schema test**

Create `src/features/courses/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { certTypeSchema, courseSchema, providerSchema } from "@/features/courses/schema";

describe("certTypeSchema / providerSchema", () => {
  it("both require a non-empty trimmed name", () => {
    expect(certTypeSchema.safeParse({ name: "  Cloud  " }).data).toEqual({ name: "Cloud" });
    expect(providerSchema.safeParse({ name: "" }).success).toBe(false);
  });
});

describe("courseSchema", () => {
  const base = {
    name: "AWS Solutions Architect Associate",
    certTypeId: "00000000-0000-0000-0000-000000000000",
    providerId: "00000000-0000-0000-0000-000000000000",
    level: "Associate",
    validityMonths: 36,
    refundable: true,
    cost: 150,
    estHours: 40,
    url: "https://aws.amazon.com/certification/",
  };

  it("accepts a fully filled course", () => {
    expect(courseSchema.safeParse(base).success).toBe(true);
  });

  it("allows validityMonths, cost, estHours, url and level to be empty (No Expiry course, no known cost)", () => {
    const result = courseSchema.safeParse({
      ...base,
      level: "",
      validityMonths: null,
      cost: null,
      estHours: null,
      url: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-positive validityMonths", () => {
    expect(courseSchema.safeParse({ ...base, validityMonths: 0 }).success).toBe(false);
  });

  it("rejects an invalid url", () => {
    expect(courseSchema.safeParse({ ...base, url: "not a url" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- courses/schema`
Expected: FAIL — cannot resolve `@/features/courses/schema`.

- [ ] **Step 3: Implement the schema**

Create `src/features/courses/schema.ts`:

```ts
import { z } from "zod";

export const certTypeSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên loại chứng chỉ"),
});
export type CertTypeInput = z.infer<typeof certTypeSchema>;

export const providerSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên nhà cung cấp"),
});
export type ProviderInput = z.infer<typeof providerSchema>;

const emptyToNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === "" || value === undefined ? null : value), schema.nullable());

export const courseSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên khóa học"),
  certTypeId: z.string().uuid("Vui lòng chọn loại chứng chỉ"),
  providerId: z.string().uuid("Vui lòng chọn nhà cung cấp"),
  level: z.string().trim().optional().default(""),
  validityMonths: emptyToNull(z.coerce.number().int().positive("Thời hạn phải lớn hơn 0")),
  refundable: z.boolean().default(false),
  cost: emptyToNull(z.coerce.number().nonnegative("Chi phí không được âm")),
  estHours: emptyToNull(z.coerce.number().int().positive("Số giờ phải lớn hơn 0")),
  url: emptyToNull(z.string().trim().url("Đường dẫn không hợp lệ")),
});
export type CourseInput = z.infer<typeof courseSchema>;
```

Run: `pnpm test -- courses/schema` → PASS (7 tests).

- [ ] **Step 4: Queries**

Create `src/features/courses/queries.ts`:

```ts
import { createClient } from "@/lib/supabase/server";

export async function listCertTypes() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("cert_types").select("id, name").order("name");
  if (error) throw new Error(error.message);
  return data;
}

export async function listProviders() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("providers").select("id, name").order("name");
  if (error) throw new Error(error.message);
  return data;
}

export async function listCourses() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select(
      "id, name, cert_type_id, provider_id, level, validity_months, refundable, cost, est_hours, url, cert_types(name), providers(name)",
    )
    .order("name");
  if (error) throw new Error(error.message);
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    certTypeId: row.cert_type_id,
    certTypeName: row.cert_types?.name ?? "—",
    providerId: row.provider_id,
    providerName: row.providers?.name ?? "—",
    level: row.level,
    validityMonths: row.validity_months,
    refundable: row.refundable,
    cost: row.cost,
    estHours: row.est_hours,
    url: row.url,
  }));
}
```

- [ ] **Step 5: Actions**

Create `src/features/courses/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { certTypeSchema, courseSchema, providerSchema, type CertTypeInput, type CourseInput, type ProviderInput } from "@/features/courses/schema";
import { err, ok, type Result } from "@/lib/result";
import { mapPostgresError } from "@/lib/postgres-error";
import { createClient } from "@/lib/supabase/server";

export async function createCertType(input: CertTypeInput): Promise<Result<null>> {
  const parsed = certTypeSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { error } = await supabase.from("cert_types").insert(parsed.data);
  if (error) return err(mapPostgresError(error, { duplicate: `Loại chứng chỉ "${parsed.data.name}" đã tồn tại.` }));
  revalidatePath("/courses");
  return ok(null);
}

export async function updateCertType(input: CertTypeInput & { id: string }): Promise<Result<null>> {
  const parsed = certTypeSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { error } = await supabase.from("cert_types").update(parsed.data).eq("id", input.id);
  if (error) return err(mapPostgresError(error, { duplicate: `Loại chứng chỉ "${parsed.data.name}" đã tồn tại.` }));
  revalidatePath("/courses");
  return ok(null);
}

export async function deleteCertType(input: { id: string }): Promise<Result<null>> {
  const supabase = await createClient();
  const { error } = await supabase.from("cert_types").delete().eq("id", input.id);
  if (error) return err(mapPostgresError(error, { restricted: "Loại chứng chỉ đang được khóa học sử dụng." }));
  revalidatePath("/courses");
  return ok(null);
}

export async function createProvider(input: ProviderInput): Promise<Result<null>> {
  const parsed = providerSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { error } = await supabase.from("providers").insert(parsed.data);
  if (error) return err(mapPostgresError(error, { duplicate: `Nhà cung cấp "${parsed.data.name}" đã tồn tại.` }));
  revalidatePath("/courses");
  return ok(null);
}

export async function updateProvider(input: ProviderInput & { id: string }): Promise<Result<null>> {
  const parsed = providerSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { error } = await supabase.from("providers").update(parsed.data).eq("id", input.id);
  if (error) return err(mapPostgresError(error, { duplicate: `Nhà cung cấp "${parsed.data.name}" đã tồn tại.` }));
  revalidatePath("/courses");
  return ok(null);
}

export async function deleteProvider(input: { id: string }): Promise<Result<null>> {
  const supabase = await createClient();
  const { error } = await supabase.from("providers").delete().eq("id", input.id);
  if (error) return err(mapPostgresError(error, { restricted: "Nhà cung cấp đang được khóa học sử dụng." }));
  revalidatePath("/courses");
  return ok(null);
}

function toCourseRow(data: CourseInput) {
  return {
    name: data.name,
    cert_type_id: data.certTypeId,
    provider_id: data.providerId,
    level: data.level || null,
    validity_months: data.validityMonths,
    refundable: data.refundable,
    cost: data.cost,
    est_hours: data.estHours,
    url: data.url,
  };
}

export async function createCourse(input: CourseInput): Promise<Result<null>> {
  const parsed = courseSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { error } = await supabase.from("courses").insert(toCourseRow(parsed.data));
  if (error) return err(mapPostgresError(error, { duplicate: `Khóa học "${parsed.data.name}" đã tồn tại cho nhà cung cấp này.` }));
  revalidatePath("/courses");
  return ok(null);
}

export async function updateCourse(input: CourseInput & { id: string }): Promise<Result<null>> {
  const parsed = courseSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { error } = await supabase.from("courses").update(toCourseRow(parsed.data)).eq("id", input.id);
  if (error) return err(mapPostgresError(error, { duplicate: `Khóa học "${parsed.data.name}" đã tồn tại cho nhà cung cấp này.` }));
  revalidatePath("/courses");
  return ok(null);
}

export async function deleteCourse(input: { id: string }): Promise<Result<null>> {
  const supabase = await createClient();
  const { error } = await supabase.from("courses").delete().eq("id", input.id);
  if (error) return err(mapPostgresError(error, { restricted: "Khóa học đang có người theo học. Không thể xóa." }));
  revalidatePath("/courses");
  return ok(null);
}
```

- [ ] **Step 6: CertType and Provider sections**

These are field-for-field identical to Task 2's `DcSection`/`DcDialog` with different labels and actions. Create `src/features/courses/components/cert-type-dialog.tsx`:

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { createCertType, updateCertType } from "@/features/courses/actions";
import { certTypeSchema, type CertTypeInput } from "@/features/courses/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function CertTypeDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: { id: string; name: string } | null;
}) {
  const form = useForm<CertTypeInput>({ resolver: zodResolver(certTypeSchema), values: { name: editing?.name ?? "" } });

  async function onSubmit(values: CertTypeInput) {
    const result = editing ? await updateCertType({ id: editing.id, ...values }) : await createCertType(values);
    if (!result.ok) {
      form.setError("name", { message: result.error });
      return;
    }
    toast.success(editing ? `Đã lưu loại chứng chỉ ${values.name}` : `Đã thêm loại chứng chỉ ${values.name}`);
    onOpenChange(false);
    form.reset({ name: "" });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-section-title">{editing ? "Sửa loại chứng chỉ" : "Thêm loại chứng chỉ"}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <Field>
            <FieldLabel htmlFor="cert-type-name">Tên loại chứng chỉ</FieldLabel>
            <Input id="cert-type-name" {...form.register("name")} aria-invalid={!!form.formState.errors.name} />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Đang lưu…" : "Lưu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

Create `src/features/courses/components/cert-type-section.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { Button } from "@/components/ui/button";
import { deleteCertType } from "@/features/courses/actions";
import { CertTypeDialog } from "@/features/courses/components/cert-type-dialog";

type CertType = { id: string; name: string };

export function CertTypeSection({ certTypes }: { certTypes: CertType[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CertType | null>(null);
  const [confirming, setConfirming] = useState<CertType | null>(null);
  const [pending, setPending] = useState(false);

  const columns: ColumnDef<CertType, unknown>[] = [
    { accessorKey: "name", header: "Tên loại chứng chỉ" },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(row.original);
              setDialogOpen(true);
            }}
          >
            Sửa
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(row.original)}>
            Xóa
          </Button>
        </div>
      ),
    },
  ];

  async function handleDelete() {
    if (!confirming) return;
    setPending(true);
    const result = await deleteCertType({ id: confirming.id });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      setConfirming(null);
      return;
    }
    toast.success(`Đã xóa loại chứng chỉ ${confirming.name}`);
    setConfirming(null);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-section-title">Loại chứng chỉ</h2>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus aria-hidden className="size-4" />
          Thêm loại chứng chỉ
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={certTypes}
        getRowId={(row) => row.id}
        empty={<EmptyState title="Chưa có loại chứng chỉ nào" />}
      />
      <CertTypeDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
      <ConfirmDialog
        open={!!confirming}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={`Xóa loại chứng chỉ ${confirming?.name}?`}
        description="Chỉ xóa được khi không có khóa học nào dùng loại này."
        confirmLabel="Xóa loại chứng chỉ"
        pendingLabel="Đang xóa…"
        pending={pending}
        onConfirm={handleDelete}
      />
    </section>
  );
}
```

Create `src/features/courses/components/provider-dialog.tsx` — identical to `cert-type-dialog.tsx` with `Provider`/`providerSchema`/`createProvider`/`updateProvider` and label "nhà cung cấp":

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { createProvider, updateProvider } from "@/features/courses/actions";
import { providerSchema, type ProviderInput } from "@/features/courses/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function ProviderDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: { id: string; name: string } | null;
}) {
  const form = useForm<ProviderInput>({ resolver: zodResolver(providerSchema), values: { name: editing?.name ?? "" } });

  async function onSubmit(values: ProviderInput) {
    const result = editing ? await updateProvider({ id: editing.id, ...values }) : await createProvider(values);
    if (!result.ok) {
      form.setError("name", { message: result.error });
      return;
    }
    toast.success(editing ? `Đã lưu nhà cung cấp ${values.name}` : `Đã thêm nhà cung cấp ${values.name}`);
    onOpenChange(false);
    form.reset({ name: "" });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-section-title">{editing ? "Sửa nhà cung cấp" : "Thêm nhà cung cấp"}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <Field>
            <FieldLabel htmlFor="provider-name">Tên nhà cung cấp</FieldLabel>
            <Input id="provider-name" {...form.register("name")} aria-invalid={!!form.formState.errors.name} />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Đang lưu…" : "Lưu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

Create `src/features/courses/components/provider-section.tsx` — identical to `cert-type-section.tsx` with `Provider`/`deleteProvider`/`ProviderDialog` and Vietnamese labels swapped to "nhà cung cấp":

```tsx
"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { Button } from "@/components/ui/button";
import { deleteProvider } from "@/features/courses/actions";
import { ProviderDialog } from "@/features/courses/components/provider-dialog";

type Provider = { id: string; name: string };

export function ProviderSection({ providers }: { providers: Provider[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [confirming, setConfirming] = useState<Provider | null>(null);
  const [pending, setPending] = useState(false);

  const columns: ColumnDef<Provider, unknown>[] = [
    { accessorKey: "name", header: "Tên nhà cung cấp" },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(row.original);
              setDialogOpen(true);
            }}
          >
            Sửa
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(row.original)}>
            Xóa
          </Button>
        </div>
      ),
    },
  ];

  async function handleDelete() {
    if (!confirming) return;
    setPending(true);
    const result = await deleteProvider({ id: confirming.id });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      setConfirming(null);
      return;
    }
    toast.success(`Đã xóa nhà cung cấp ${confirming.name}`);
    setConfirming(null);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-section-title">Nhà cung cấp</h2>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus aria-hidden className="size-4" />
          Thêm nhà cung cấp
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={providers}
        getRowId={(row) => row.id}
        empty={<EmptyState title="Chưa có nhà cung cấp nào" />}
      />
      <ProviderDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
      <ConfirmDialog
        open={!!confirming}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={`Xóa nhà cung cấp ${confirming?.name}?`}
        description="Chỉ xóa được khi không có khóa học nào dùng nhà cung cấp này."
        confirmLabel="Xóa nhà cung cấp"
        pendingLabel="Đang xóa…"
        pending={pending}
        onConfirm={handleDelete}
      />
    </section>
  );
}
```

- [ ] **Step 7: Course sheet (8 fields — Sheet, not Dialog, per this plan's scope decision 2)**

Create `src/features/courses/components/course-sheet.tsx`:

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { createCourse, updateCourse } from "@/features/courses/actions";
import { courseSchema, type CourseInput } from "@/features/courses/schema";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";

type Option = { id: string; name: string };
type Editing = (CourseInput & { id: string }) | null;

export function CourseSheet({
  open,
  onOpenChange,
  editing,
  certTypes,
  providers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Editing;
  certTypes: Option[];
  providers: Option[];
}) {
  const empty: CourseInput = {
    name: "",
    certTypeId: "",
    providerId: "",
    level: "",
    validityMonths: null,
    refundable: false,
    cost: null,
    estHours: null,
    url: null,
  };
  const form = useForm<CourseInput>({ resolver: zodResolver(courseSchema), values: editing ?? empty });

  async function onSubmit(values: CourseInput) {
    const result = editing ? await updateCourse({ id: editing.id, ...values }) : await createCourse(values);
    if (!result.ok) {
      form.setError("root", { message: result.error });
      return;
    }
    toast.success(editing ? `Đã lưu khóa học ${values.name}` : `Đã thêm khóa học ${values.name}`);
    onOpenChange(false);
    form.reset(empty);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-section-title">{editing ? "Sửa khóa học" : "Thêm khóa học"}</SheetTitle>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4" onSubmit={form.handleSubmit(onSubmit)}>
          <Field>
            <FieldLabel htmlFor="course-name">Tên khóa học</FieldLabel>
            <Input id="course-name" {...form.register("name")} aria-invalid={!!form.formState.errors.name} />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="course-cert-type">Loại chứng chỉ</FieldLabel>
            <Controller
              control={form.control}
              name="certTypeId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="course-cert-type" aria-invalid={!!form.formState.errors.certTypeId}>
                    {/* Base UI's SelectValue renders the raw value by default; map it back to the cert type name. */}
                    <SelectValue placeholder="Chọn loại chứng chỉ">
                      {(value: string) => certTypes.find((option) => option.id === value)?.name ?? "Chọn loại chứng chỉ"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {certTypes.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError errors={[form.formState.errors.certTypeId]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="course-provider">Nhà cung cấp</FieldLabel>
            <Controller
              control={form.control}
              name="providerId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="course-provider" aria-invalid={!!form.formState.errors.providerId}>
                    {/* Base UI's SelectValue renders the raw value by default; map it back to the provider name. */}
                    <SelectValue placeholder="Chọn nhà cung cấp">
                      {(value: string) => providers.find((option) => option.id === value)?.name ?? "Chọn nhà cung cấp"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError errors={[form.formState.errors.providerId]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="course-level">Cấp độ</FieldLabel>
            <Input id="course-level" {...form.register("level")} placeholder="Associate, Professional…" />
          </Field>
          <Field>
            <FieldLabel htmlFor="course-validity">Thời hạn hiệu lực (tháng)</FieldLabel>
            <Input
              id="course-validity"
              type="number"
              min={1}
              {...form.register("validityMonths")}
              placeholder="Để trống nếu không hết hạn"
              aria-invalid={!!form.formState.errors.validityMonths}
            />
            <FieldError errors={[form.formState.errors.validityMonths]} />
          </Field>
          <Field orientation="horizontal">
            <FieldLabel htmlFor="course-refundable">Được hoàn tiền</FieldLabel>
            <Controller
              control={form.control}
              name="refundable"
              render={({ field }) => <Switch id="course-refundable" checked={field.value} onCheckedChange={field.onChange} />}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="course-cost">Chi phí (VNĐ)</FieldLabel>
            <Input
              id="course-cost"
              type="number"
              min={0}
              {...form.register("cost")}
              aria-invalid={!!form.formState.errors.cost}
            />
            <FieldError errors={[form.formState.errors.cost]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="course-hours">Thời gian học ước tính (giờ)</FieldLabel>
            <Input
              id="course-hours"
              type="number"
              min={1}
              {...form.register("estHours")}
              aria-invalid={!!form.formState.errors.estHours}
            />
            <FieldError errors={[form.formState.errors.estHours]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="course-url">Đường dẫn khóa học</FieldLabel>
            <Input id="course-url" type="url" {...form.register("url")} aria-invalid={!!form.formState.errors.url} />
            <FieldError errors={[form.formState.errors.url]} />
          </Field>
          {form.formState.errors.root && (
            <p role="alert" className="text-caption text-destructive">
              {form.formState.errors.root.message}
            </p>
          )}
          <SheetFooter className="flex-row justify-end gap-2 px-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Đang lưu…" : "Lưu"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 8: Courses table (visible to every role; write controls Admin-only)**

Create `src/features/courses/components/courses-table.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { FilterBar } from "@/components/data/filter-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteCourse } from "@/features/courses/actions";
import { CourseSheet } from "@/features/courses/components/course-sheet";
import { formatVnd } from "@/lib/format";

type Course = {
  id: string;
  name: string;
  certTypeId: string;
  certTypeName: string;
  providerId: string;
  providerName: string;
  level: string | null;
  validityMonths: number | null;
  refundable: boolean;
  cost: number | null;
  estHours: number | null;
  url: string | null;
};
type Option = { id: string; name: string };

export function CoursesTable({
  courses,
  certTypes,
  providers,
  canManage,
}: {
  courses: Course[];
  certTypes: Option[];
  providers: Option[];
  canManage: boolean;
}) {
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [confirming, setConfirming] = useState<Course | null>(null);
  const [pending, setPending] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) => `${c.name} ${c.certTypeName} ${c.providerName}`.toLowerCase().includes(q));
  }, [courses, search]);

  const columns: ColumnDef<Course, unknown>[] = [
    { accessorKey: "name", header: "Tên khóa học" },
    { accessorKey: "certTypeName", header: "Loại" },
    { accessorKey: "providerName", header: "Nhà cung cấp" },
    { accessorKey: "level", header: "Cấp độ", cell: ({ row }) => row.original.level || "—" },
    {
      accessorKey: "validityMonths",
      header: "Thời hạn",
      cell: ({ row }) => (row.original.validityMonths ? `${row.original.validityMonths} tháng` : "Không hết hạn"),
    },
    {
      accessorKey: "refundable",
      header: "Hoàn tiền",
      cell: ({ row }) =>
        row.original.refundable ? (
          <Badge variant="secondary" className="rounded-sm">
            Có
          </Badge>
        ) : (
          <span className="text-caption text-muted-foreground">Không</span>
        ),
    },
    {
      accessorKey: "cost",
      header: "Chi phí",
      cell: ({ row }) => (row.original.cost != null ? formatVnd(row.original.cost) : "—"),
    },
    ...(canManage
      ? ([
          {
            id: "actions",
            header: "",
            enableSorting: false,
            cell: ({ row }) => (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="ghost" size="icon-xs" aria-label={`Thao tác cho ${row.original.name}`} />}
                >
                  <MoreHorizontal aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      setEditing(row.original);
                      setSheetOpen(true);
                    }}
                  >
                    Sửa
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => setConfirming(row.original)}>
                    Xóa
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          },
        ] satisfies ColumnDef<Course, unknown>[])
      : []),
  ];

  async function handleDelete() {
    if (!confirming) return;
    setPending(true);
    const result = await deleteCourse({ id: confirming.id });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      setConfirming(null);
      return;
    }
    toast.success(`Đã xóa khóa học ${confirming.name}`);
    setConfirming(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm theo tên, loại, nhà cung cấp…"
        hasActiveFilters={search.length > 0}
        onClear={() => setSearch("")}
      >
        {canManage && (
          <Button
            size="sm"
            className="ml-auto"
            disabled={certTypes.length === 0 || providers.length === 0}
            onClick={() => {
              setEditing(null);
              setSheetOpen(true);
            }}
          >
            <Plus aria-hidden className="size-4" />
            Thêm khóa học
          </Button>
        )}
      </FilterBar>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        empty={<EmptyState title="Không tìm thấy khóa học" description="Thử từ khóa khác hoặc xóa bộ lọc." />}
      />
      {canManage && (
        <>
          <CourseSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            editing={
              editing
                ? {
                    id: editing.id,
                    name: editing.name,
                    certTypeId: editing.certTypeId,
                    providerId: editing.providerId,
                    level: editing.level ?? "",
                    validityMonths: editing.validityMonths,
                    refundable: editing.refundable,
                    cost: editing.cost,
                    estHours: editing.estHours,
                    url: editing.url,
                  }
                : null
            }
            certTypes={certTypes}
            providers={providers}
          />
          <ConfirmDialog
            open={!!confirming}
            onOpenChange={(open) => !open && setConfirming(null)}
            title={`Xóa khóa học ${confirming?.name}?`}
            description="Chỉ xóa được khi chưa có ai theo học khóa này. Không thể hoàn tác."
            confirmLabel="Xóa khóa học"
            pendingLabel="Đang xóa…"
            pending={pending}
            onConfirm={handleDelete}
          />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 9: Wire the page**

Replace `src/app/(app)/courses/page.tsx`:

```tsx
import { PageHeader } from "@/components/app-shell/page-header";
import { getCurrentUser } from "@/features/auth/queries";
import { CertTypeSection } from "@/features/courses/components/cert-type-section";
import { CoursesTable } from "@/features/courses/components/courses-table";
import { ProviderSection } from "@/features/courses/components/provider-section";
import { listCertTypes, listCourses, listProviders } from "@/features/courses/queries";

export default async function CoursesPage() {
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";
  const [certTypes, providers, courses] = await Promise.all([listCertTypes(), listProviders(), listCourses()]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Khóa học" description="Danh mục chứng chỉ, provider và thời hạn." />
      {isAdmin && (
        <>
          <CertTypeSection certTypes={certTypes} />
          <ProviderSection providers={providers} />
        </>
      )}
      <section className="flex flex-col gap-3">
        {isAdmin && <h2 className="text-section-title">Khóa học</h2>}
        <CoursesTable courses={courses} certTypes={certTypes} providers={providers} canManage={isAdmin} />
      </section>
    </div>
  );
}
```

- [ ] **Step 10: Verify and commit**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: all pass (74 tests: 67 + 7 new).

Manual smoke: as admin, add a CertType and a Provider, then add a Course referencing both (leave "Thời hạn hiệu lực" empty → catalog shows "Không hết hạn"); edit the course; try to delete the CertType while the Course references it (must fail with the restricted message); delete the Course, then the CertType (must succeed). As `member@certtracker.test`, open `/courses`: sees the Courses table read-only (no "Thêm khóa học" button, no row menu), does **not** see the CertType/Provider sections at all.

```bash
git add src/features/courses src/app/\(app\)/courses/page.tsx
git commit -m "feat: add course catalog CRUD (CertType, Provider, Course)"
```

---

### Task 5: E2E coverage

**Files:**
- Create: `e2e/org.spec.ts`, `e2e/members.spec.ts`, `e2e/courses.spec.ts`

**Interfaces:**
- Consumes: `signIn` from `./helpers`.

- [ ] **Step 1: Org e2e**

Create `e2e/org.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("admin manages the org tree end to end", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await page.goto("/org");

  const dcName = `DC E2E ${Date.now()}`;
  await page.getByRole("button", { name: "Thêm trung tâm" }).click();
  await page.getByLabel("Tên trung tâm").fill(dcName);
  await page.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByRole("cell", { name: dcName })).toBeVisible();

  const programName = `Program E2E ${Date.now()}`;
  await page.getByRole("button", { name: "Thêm chương trình" }).click();
  await page.getByLabel("Tên chương trình").fill(programName);
  await page.getByLabel("Trung tâm").click();
  await page.getByRole("option", { name: dcName }).click();
  await page.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByRole("cell", { name: programName })).toBeVisible();

  // The DC now has a Program: deleting it must fail with the restricted message, not a raw Postgres error.
  await page
    .locator("tr", { has: page.getByRole("cell", { name: dcName, exact: true }) })
    .getByRole("button", { name: "Xóa" })
    .click();
  await page.getByRole("button", { name: "Xóa trung tâm" }).click();
  await expect(page.getByText("Trung tâm đang có chương trình")).toBeVisible();
});

test("member has no write access to the org tree", async ({ page }) => {
  await signIn(page, "member@certtracker.test");
  await expect(page.getByRole("link", { name: "Tổ chức" })).toHaveCount(0);
});
```

- [ ] **Step 2: Members e2e**

Create `e2e/members.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("admin creates and deletes a member", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await page.goto("/members");

  const email = `e2e-${Date.now()}@certtracker.test`;
  await page.getByRole("button", { name: "Thêm thành viên" }).click();
  await page.getByLabel("Họ tên").fill("Người Dùng E2E");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Team").click();
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByRole("cell", { name: email })).toBeVisible();

  await page.getByRole("row", { name: new RegExp(email) }).getByRole("button", { name: /Thao tác/ }).click();
  await page.getByRole("menuitem", { name: "Xóa" }).click();
  await page.getByRole("button", { name: "Xóa thành viên" }).click();
  await expect(page.getByRole("cell", { name: email })).toHaveCount(0);
});

test("manager cannot create or delete members", async ({ page }) => {
  await signIn(page, "manager@certtracker.test");
  await page.goto("/members");
  await expect(page.getByRole("button", { name: "Thêm thành viên" })).toHaveCount(0);
});
```

- [ ] **Step 3: Courses e2e**

Create `e2e/courses.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("admin adds a course and a member can only read it", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await page.goto("/courses");

  const courseName = `Course E2E ${Date.now()}`;
  await page.getByRole("button", { name: "Thêm khóa học" }).click();
  await page.getByLabel("Tên khóa học").fill(courseName);
  await page.getByLabel("Loại chứng chỉ").click();
  await page.getByRole("option").first().click();
  await page.getByLabel("Nhà cung cấp").click();
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByRole("cell", { name: courseName })).toBeVisible();

  // "Đăng xuất" is a menu item behind the "Tài khoản" trigger (src/components/app-shell/user-menu.tsx), not a plain button — see e2e/auth.spec.ts for the same two-step pattern.
  await page.getByRole("button", { name: "Tài khoản" }).click();
  await page.getByRole("menuitem", { name: "Đăng xuất" }).click();
  await signIn(page, "member@certtracker.test");
  await page.goto("/courses");
  await expect(page.getByRole("cell", { name: courseName })).toBeVisible();
  await expect(page.getByRole("button", { name: "Thêm khóa học" })).toHaveCount(0);
});
```

- [ ] **Step 4: Run and commit**

Run: `pnpm test:e2e`
Expected: all pass (14: 9 existing + 5 new). Needs `supabase start` running and a seed manager who has `role = 'manager'` and a `member_id` — if `supabase/seed.sql` doesn't already give the seed manager a `member_id`, add one line linking `manager@certtracker.test`'s profile to a seeded member before running (note this in the report; do not change seed data as part of a different task's commit).

```bash
git add e2e/org.spec.ts e2e/members.spec.ts e2e/courses.spec.ts
git commit -m "test: add e2e coverage for org, member and course CRUD"
```

---

## Self-review

**Spec coverage:** `docs/superpowers/specs/2026-09-26-certtracker-design.md` §10 Week 2 = "CRUD DC/Program/Team/Member và Course/CertType/Provider" — Tasks 2–4 cover all seven entities. §6.1's pattern (Server Actions, `Result<T>`, Zod shared client/server, Postgres errors mapped) is followed by every action in Tasks 2–4. §5's RLS matrix is respected by construction (no app-level permission logic duplicates it) and specifically exercised by the Manager-restricted tests in Task 5.

**Not in this plan (later weeks per the roadmap):** Training Records (week 3), Import/Export (week 4), Dashboard (week 5), cron/email (week 6) — none of Week 2's scope touches them.

**Type consistency:** `Result<T>`, `ok`, `err` used identically to Week 1's `src/lib/result.ts`. `mapPostgresError` signature is defined once in Task 1 and used with the same two-arg shape in every action across Tasks 2–4. Component prop names (`open`/`onOpenChange`/`editing`) are consistent across every `*Dialog`/`*Sheet` component so a future task can follow the same shape without re-deriving it.
