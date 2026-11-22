# AI reader: upload-first form and admin switch — Implementation Plan

> **For agentic workers:** execute inline (the owner chose native execution, no commits) with superpowers:executing-plans and TDD.

**Goal:** With AI on, the Add sheet opens with a file card that reads the file as soon as it is chosen; admins switch the feature on or off on `/settings`.

**Architecture:** One migration adds two admin-only Postgres functions. A small `features/ai` folder holds the settings schema, query, action and component. The sheet swaps the old button for an `AiFileCard`.

**Spec:** `docs/superpowers/specs/2026-11-22-ai-reader-upload-first-design.md` (builds on `2026-11-22-ai-certificate-reader-design.md`).

## Global Constraints

- No commit or push unless the owner asks. Branch stays `feat/ai-certificate-reader`.
- `Result<T>` from `src/lib/result.ts`; no `any`; Zod at the server; English UI.
- Migration file `20261122000003_ai_feature_admin.sql`, pgTAP `41_ai_feature_admin.test.sql`, then `pnpm db:types`.
- Daily limit: integer 1–200. Feature id `certificate-reader`.
- Save stays blocked by `recordSchema` when a required field is empty; nothing about saving changes.

## Review Focus

1. A manager or member calls `set_ai_feature` or `get_ai_feature` directly (not through the page) → refused with 42501 (Task 1).
2. A limit of 0, 201 or a decimal reaches the action → refused before the database (Task 2).
3. The member replaces or removes the file while a read is running → the late answer must not fill the form (Task 3).
4. The read fails or times out → the sheet is still usable and Save works (Task 3).
5. The AI is on but the member is editing an existing record → the old Evidence field shows, no card (Task 3).

---

### Task 1: Admin functions (database)

**Files:** Create `supabase/migrations/20261122000003_ai_feature_admin.sql`, `supabase/tests/database/41_ai_feature_admin.test.sql`; regenerate `src/types/database.ts`.

**Produces:**
```sql
get_ai_feature(p_feature text) returns table (enabled boolean, daily_limit int, calls_today int)
set_ai_feature(p_feature text, p_enabled boolean, p_daily_limit int) returns void
```
Both `SECURITY DEFINER`, `set search_path = ''`, raise `42501` unless `public.app_role() = 'admin'`; `set_ai_feature` raises `P0002` for an unknown feature; `calls_today` counts `ai_usage` rows of the Ho Chi Minh day. `revoke execute … from public, anon`; `grant execute … to authenticated`.

- [ ] **Step 1:** pgTAP test (login helper as in `40_ai_usage.test.sql`): admin get returns `false/10/0`; admin set `true/20` and get shows it; calls_today counts today's rows and ignores yesterday's; manager set → `42501`; member get → `42501`; anon execute → `42501`; admin set unknown feature → `P0002`; admin limit `0` → `23514` (CHECK).
- [ ] **Step 2:** `pnpm exec supabase test db supabase/tests/database/41_ai_feature_admin.test.sql`. Expected: FAIL (functions missing).
- [ ] **Step 3:** Write the migration. **Step 4:** `supabase db reset`, run the file (expect PASS), `pnpm db:types`.

### Task 2: Settings section

**Files:** Create `src/features/ai/schema.ts`, `queries.ts`, `actions.ts`, `components/ai-reader-settings.tsx` and their `*.test.ts(x)`; modify `src/app/(app)/settings/page.tsx`.

**Produces:**
```ts
aiReaderSettingsSchema // { enabled: boolean, dailyLimit: z.coerce.number().int().min(1).max(200) }
getAiReaderSettings(): Promise<{ enabled: boolean; dailyLimit: number; callsToday: number; provider: "ready" | "not-configured" } | null>
saveAiReaderSettings(input: unknown): Promise<Result<null>>   // revalidates /settings, /records, /me
AiReaderSettings({ settings }): JSX.Element                    // switch + limit + Save + usage and provider lines
```
`provider` is `"ready"` when `createAiGateway()` does not throw. Errors map to plain messages (42501 → "You do not have permission to do this.").

- [ ] **Step 1:** Tests: schema (0, 201, 2.5, "abc" refused; "20" accepted); action (bad input refused before any RPC; success calls `set_ai_feature` with `certificate-reader`; 42501 → permission message; other error → generic); query (null on RPC error, mapped fields otherwise); component (shows current state, Save sends the values, shows the server message on failure, shows "Not configured" line when provider is not ready); settings page test only if one exists.
- [ ] **Step 2:** `pnpm vitest run src/features/ai`. Expected: FAIL. **Step 3:** Implement; add the section to the settings page (hidden when `getAiReaderSettings()` is null). **Step 4:** Run; expect PASS.

### Task 3: Upload-first card in the sheet

**Files:** Create `src/features/records/components/ai-file-card.tsx` and `ai-file-card.test.tsx`; modify `record-sheet.tsx`, rewrite `record-sheet-ai.test.tsx`; delete `ai-fill-button.tsx` and its test.

**Produces:**
```tsx
AiFileCard(props: {
  file: File | null;
  onFileChange: (file: File | null) => void;
  onSuggestion: (s: CertificateSuggestion) => void;
  onReadingChange: (reading: boolean) => void;
  onReject: (message: string) => void;
  missing: { label: string; fieldId: string }[];   // empty required fields, shown after a read
  fileError: string | null;
}): JSX.Element
```
Behaviour: choosing a file starts one read (POST `/api/records/ai-read`); a request token ignores a late answer for a replaced or removed file and an unmount aborts the request; statuses "Reading your file…", "AI filled N fields. Check them before saving.", failure message plus "Read again"; "Still needed: …" buttons call `document.getElementById(fieldId)?.focus()`. Sheet: `aiReaderEnabled && !editing` shows the card at the top and hides the bottom Evidence field; Save is disabled while reading; `missing` is computed from empty member (when not fixed), certificate and issue date, only after the first completed read.

- [ ] **Step 1:** Card tests: card text and DeepSeek notice shown; choosing a file calls fetch once with the file; "AI filled 2 fields" after a success; failure shows message and "Read again" retries; replacing the file during a read ignores the first answer; removing the file clears the status; `onReadingChange` true then false; "Still needed" item focuses its field.
- [ ] **Step 2:** Sheet tests (rewrite `record-sheet-ai.test.tsx`; keep every existing case, now without clicking a button): no card when the flag is off (bottom Evidence shown); no card when editing; with the flag on there is exactly one file input and it sits before "What are you adding?"; choosing a file fills certificate, date and link with "AI" marks; second read after "Read again" clears stale AI values; kind switch to completion; failure leaves the form untouched and Save still works; Save disabled while reading; the unmatched note and proposal prefill still work.
- [ ] **Step 3:** Run both files; expect FAIL. **Step 4:** Implement; remove `AiFillButton`. **Step 5:** Run; expect PASS, then `pnpm lint && pnpm typecheck`.

### Task 4: Docs and final checks

- [ ] Update `docs/deploy/ai-certificate-reader.md` (the switch now lives on `/settings`, SQL stays as a fallback), `docs/decisions.md` #75 (admin switch via SECURITY DEFINER functions; upload-first sheet), `docs/process/04-wbs.md` only if a row changes (13.1 admin view now built).
- [ ] Run `pnpm lint && pnpm typecheck && pnpm vitest run && pnpm exec supabase test db`; report real counts.
- [ ] Browser check on `pnpm dev` (flag on, fake transport): open Add on `/me`, see the card first, choose a file, fields fill, "Still needed" lists what is empty; flip the switch on `/settings` and confirm the card disappears on `/me`.
