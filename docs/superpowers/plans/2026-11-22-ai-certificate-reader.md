# AI certificate reader and AI gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A member picks a certificate image or PDF in "Add record"; DeepSeek reads it and the form is pre-filled (exam or completion), behind a gateway that can later be replaced by a Rust service.

**Architecture:** A versioned JSON contract (`src/lib/ai/contract.ts`) with a `fake` and a `deepseek` gateway behind one interface, chosen by env like `createEmailSender`. Usage, daily limit and feature flag live in two plain Postgres tables reached only through the service role. A route handler does auth, file checks, catalogue read (user JWT) and the call; the record sheet applies the suggestion.

**Tech Stack:** Next.js 16 route handler, Zod 4, Vitest, Supabase Postgres + pgTAP, `fetch` (no AI SDK).

**Spec:** `docs/superpowers/specs/2026-11-22-ai-certificate-reader-design.md` (decision #75). Executors read it too.

**Working rules:** branch `feat/ai-certificate-reader` from `dev`. Do not commit or push unless the owner asks (CLAUDE.md); steps end at "tests green". Project rules apply: `Result<T>` from `src/lib/result.ts`, no `any`, Zod at the server, English in code and UI. Read `node_modules/next/dist/docs/` for the route handler API before Task 6.

## Global Constraints

- Contract version prefix `/v1`; fields are only added, never changed or removed.
- Feature id `"certificate-reader"`; kinds `"exam" | "completion"` (`CERTIFICATE_KINDS` in `src/features/certificates/schema.ts`).
- Files: PDF, JPG, PNG, WebP, ≤ 4 MB, type from first bytes (`sniffEvidenceType`, `MAX_EVIDENCE_BYTES`, messages in `src/lib/storage/evidence.ts`).
- Model `deepseek-flash`, base URL `https://api.deepseek.com`, non-thinking, image input; all three are env values with these defaults.
- Defaults: confidence threshold `0.6`, PDF page cap `3`, limit `10` calls per member per day, provider timeout `45_000` ms, `maxDuration = 60`, catalogue cap `300`; feature flag seeded `enabled = false`.
- Dates: ISO `YYYY-MM-DD` only; a partial date is `null`. Day boundary `Asia/Ho_Chi_Minh`.
- The holder's name and e-mail never appear in a log row, a usage row, a thrown message or a response. Member code may.
- AI key only in server env; never `NEXT_PUBLIC_`. `fake` transport is a config error when `NODE_ENV === "production"`.
- Service role only in `src/lib/ai/usage-store.ts` (new ESLint exception, decision #35 and #75).

## Review Focus

1. The model returns a `certificateId` that was not in the catalogue sent → server sets `null` (Task 5).
2. The model returns extra fields such as `holderName` → dropped, never logged or returned (Tasks 1, 5).
3. The model says `exam` but the matched catalogue entry is a completion (or the reverse) → the catalogue entry's kind wins (Task 5).
4. The model answers with fenced or malformed JSON, a partial date, or a future date → `invalid_output` or `null` field, never a thrown error (Tasks 4, 5).
5. A file whose bytes are not an allowed type but whose `File.type` says image, or a body over 4 MB → refused before any provider call and before a usage row (Task 6).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/ai/contract.ts` | Zod request/response schemas, error codes, `CONTRACT_VERSION` |
| `src/lib/ai/gateway.ts` | `AiGateway` interface, `AiConfigError`, `createAiGateway(env)` |
| `src/lib/ai/fake-gateway.ts` | Sample answers for both kinds |
| `src/lib/ai/deepseek-gateway.ts` | OpenAI-compatible call, prompt, timeout, error mapping |
| `src/lib/ai/limits.ts` | Cost estimate, rates from env |
| `src/lib/ai/usage-store.ts` | `UsageStore` interface + Postgres implementation (service role) |
| `src/lib/ai/fixtures/*.json` | Request/response pairs shared by contract tests and a future Rust service |
| `supabase/migrations/20261122000001_ai_usage.sql` | Tables, claim/finish functions, grants |
| `supabase/tests/database/39_ai_usage.test.sql` | pgTAP |
| `src/features/records/ai-read.ts` | `readCertificate(deps, input)`: the whole server flow, injectable |
| `src/app/api/records/ai-read/route.ts` | Thin handler around `readCertificate` |
| `src/features/records/components/ai-fill-button.tsx` | "Fill from file" button, posts the file |
| `src/lib/ai/pdf-pages.ts` | PDF → up to 3 images (Task 8) |
| `eslint.config.*`, `.env.example` | Exception for `usage-store.ts`; new env keys |

---

### Task 1: Contract and fixtures

**Files:** Create `src/lib/ai/contract.ts`, `src/lib/ai/contract.test.ts`, `src/lib/ai/fixtures/exam.request.json`, `exam.response.json`, `completion.request.json`, `completion.response.json`.

**Interfaces — Produces:**
```ts
export const CONTRACT_VERSION = "v1";
export const AI_ERROR_CODES = ["disabled","daily_limit","unreadable","timeout","provider_error","invalid_output"] as const;
export type AiErrorCode = (typeof AI_ERROR_CODES)[number];
export const extractRequestSchema: z.ZodType<ExtractRequest>;   // { feature, requestedBy, pages: {mime, bytesBase64}[1..3], catalogue: {id, kind, name, provider}[0..300] }
export const extractResponseSchema: z.ZodType<ExtractResponse>; // { ok:true, result, confidence, usage } | { ok:false, error: AiErrorCode }
export type ExtractRequest; export type ExtractResponse; export type ExtractResult;
// ExtractResult = exam { kind, certificateId|null, certificateName|null, provider|null, issuedDate|null, validUntil|null, verifyUrl|null }
//               | completion { kind, certificateId|null, courseName|null, provider|null, completedDate|null }
```
`pages` replaces the spec's single `file` (a PDF yields several images); update the spec line with it. Response objects use Zod's default strip, so unknown keys such as `holderName` are removed on parse.

- [ ] **Step 1:** Write `contract.test.ts`: each of the four fixtures parses; a request with 4 pages, a 301-entry catalogue or a `requestedBy` of `""` fails; a response whose result carries `holderName: "A"` parses and the parsed object has no `holderName`; `issuedDate: "June 2025"` fails; `ok:false` with `error:"nope"` fails.
- [ ] **Step 2:** Run `pnpm vitest run src/lib/ai/contract.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement the schemas above in `contract.ts`; dates via a shared `isoDate` (`/^\d{4}-\d{2}-\d{2}$/` plus a real-date check using `toIsoDate` from `src/lib/dates.ts`); ids with `z.guid()` (seed ids are not RFC 4122, see `recordSchema`); `verifyUrl` http(s) only. Write the four fixtures by hand with realistic sample values.
- [ ] **Step 4:** Re-run the test. Expected: PASS.

### Task 2: Cost estimate

**Files:** Create `src/lib/ai/limits.ts`, `src/lib/ai/limits.test.ts`.

**Interfaces — Produces:**
```ts
export type Rates = { inputPerMillionUsd: number; outputPerMillionUsd: number };
export function ratesFromEnv(env?: Record<string, string | undefined>): Rates;  // AI_PRICE_INPUT_PER_M default 0.30, AI_PRICE_OUTPUT_PER_M default 1.20
export function estimateCostMicroUsd(usage: { inputTokens: number; outputTokens: number }, rates: Rates): number; // integer, rounded up
```

- [ ] **Step 1:** Test: 1_000_000 input + 0 output at defaults → `300_000`; 1 input token → `1` (rounds up, never 0 for any use); env override changes the rate; a non-numeric or negative env value falls back to the default.
- [ ] **Step 2:** Run it; expect FAIL. **Step 3:** Implement. **Step 4:** Run; expect PASS.

### Task 3: Gateway interface, factory, fake gateway

**Files:** Create `src/lib/ai/gateway.ts`, `fake-gateway.ts`, `gateway.test.ts`; modify `.env.example`.

**Interfaces — Consumes:** Task 1 types. **Produces:**
```ts
export interface AiGateway {
  readonly transport: "fake" | "deepseek";
  /** Never throws: every failure is `{ ok: false, error }`. */
  extractCertificate(request: ExtractRequest): Promise<ExtractResponse>;
}
export class AiConfigError extends Error {}
export function createAiGateway(env?: Record<string, string | undefined>): AiGateway;
export class FakeGateway implements AiGateway {}  // returns exam sample when the first catalogue entry is an exam, else completion sample; certificateId = that entry's id
```
Factory rules (mirror `createEmailSender`): `AI_TRANSPORT` unset → `fake` outside production, `AiConfigError` in production; `fake` in production → `AiConfigError`; `deepseek` needs `DEEPSEEK_API_KEY`; `http` → `AiConfigError("AI_TRANSPORT=http is not built yet.")`; any other value → `AiConfigError`.

- [ ] **Step 1:** Tests: the five factory rules above (production unset, production fake, deepseek without key, http, unknown value) and dev default is `fake`; `FakeGateway` output parses with `extractResponseSchema` for an exam-first and a completion-first catalogue and for an empty catalogue (ids `null`).
- [ ] **Step 2:** Run; expect FAIL. **Step 3:** Implement; add `AI_TRANSPORT`, `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL`, `AI_CONFIDENCE_THRESHOLD`, `AI_PRICE_INPUT_PER_M`, `AI_PRICE_OUTPUT_PER_M` with comments to `.env.example`. **Step 4:** Run; expect PASS.

### Task 4: DeepSeek gateway

**Files:** Create `src/lib/ai/deepseek-gateway.ts`, `deepseek-gateway.test.ts`; modify `gateway.ts` to return it.

**Interfaces — Consumes:** Tasks 1, 3. **Produces:** `export class DeepSeekGateway implements AiGateway { constructor(options: { apiKey: string; baseUrl: string; model: string; timeoutMs: number; fetch?: typeof fetch }) }`.

Before coding, read the DeepSeek Vision guide (image message format) and Thinking Mode guide (how to switch off) at `https://api-docs.deepseek.com/guides/vision` and `…/thinking_mode`; use JSON output mode. The prompt asks for the exact response shape, tells the model to choose `certificateId` only from the catalogue given, to return `null` for anything unreadable, never to return the holder's name, and to report per-field confidence. Pass the catalogue as compact text lines `id | kind | provider | name`.

- [ ] **Step 1:** Tests with an injected `fetch` (no network): (a) a good JSON body parses to `{ ok: true }` and `usage` comes from the API's `usage` field; (b) fenced ```json output is rejected as `invalid_output`; (c) body with `holderName` returns a result without it; (d) a fetch that never resolves returns `{ ok:false, error:"timeout" }` within `timeoutMs` (use fake timers); (e) HTTP 500, network error → `provider_error`; (f) the request sent has the `Authorization` header, the model name, and image parts, and its body string does not contain `requestedBy`; (g) no error message or thrown value contains the API key.
- [ ] **Step 2:** Run; expect FAIL. **Step 3:** Implement with `AbortSignal.timeout`; map failures to the six codes; validate with `extractResponseSchema`. **Step 4:** Run; expect PASS.

### Task 5: Usage tables, atomic claim, and `UsageStore`

**Files:** Create `supabase/migrations/20261122000001_ai_usage.sql`, `supabase/tests/database/39_ai_usage.test.sql`, `src/lib/ai/usage-store.ts`, `src/lib/ai/usage-store.test.ts`; modify the ESLint config (copy the cron override: a block for `files: ["src/lib/ai/usage-store.ts"]` that repeats the `cn` path rule and omits the admin-client pattern) and `src/types/database.ts` (via `pnpm db:types`).

**Interfaces — Produces:**
```sql
-- ai_feature_flags(feature text pk, enabled boolean not null default false, daily_limit int not null check (daily_limit > 0))
-- ai_usage(id uuid pk default gen_random_uuid(), day date not null, feature text not null, member_code text not null,
--          input_tokens int, output_tokens int, cost_micro_usd bigint, outcome text not null check (outcome in
--          ('pending','ok','unreadable','timeout','provider_error','invalid_output')), created_at timestamptz default now())
-- claim_ai_call(p_feature text, p_member_code text) returns table (usage_id uuid, refusal text)  -- refusal null | 'disabled' | 'daily_limit'
-- finish_ai_call(p_id uuid, p_input int, p_output int, p_cost bigint, p_outcome text) returns void
```
```ts
export interface UsageStore {
  isEnabled(feature: string): Promise<boolean>;
  claim(feature: string, memberCode: string): Promise<{ ok: true; usageId: string } | { ok: false; reason: "disabled" | "daily_limit" }>;
  finish(usageId: string, usage: { inputTokens: number; outputTokens: number; costMicroUsd: number; outcome: Exclude<AiErrorCode, "disabled" | "daily_limit"> | "ok" }): Promise<void>;
}
export function createUsageStore(): UsageStore;  // `import "server-only"`; uses createAdminClient
```
`claim_ai_call` takes `pg_advisory_xact_lock(hashtext(p_feature || p_member_code))`, reads the flag, counts that member's rows for today (`Asia/Ho_Chi_Minh` day) and inserts a `pending` row only when allowed — one transaction, so parallel calls cannot pass the limit together. Both functions and both tables: `revoke all … from public, anon, authenticated`; `grant … to service_role`; RLS enabled with no policy. Seed one flag row: `('certificate-reader', false, 10)`.

- [ ] **Step 1:** Write the pgTAP test: seed flag is `enabled = false` → claim returns `disabled` and inserts nothing; after `update … set enabled = true` the first 10 claims for one member succeed and the 11th returns `daily_limit` and adds no row; a second member still succeeds; a row dated yesterday (Ho Chi Minh) does not count; `finish_ai_call` sets tokens and outcome; `authenticated` and `anon` get permission denied on both tables and both functions (`throws_ok … '42501'`). Check `.claude/rules/` for any pgTAP conventions first.
- [ ] **Step 2:** `supabase db reset` then `pnpm test:db`. Expected: the new file FAILs (objects missing).
- [ ] **Step 3:** Write the migration; run `supabase db reset`, `pnpm test:db` (expect PASS), `pnpm db:types`.
- [ ] **Step 4:** Write `usage-store.test.ts` with the admin client mocked: `claim` maps `refusal` values to `{ ok:false, reason }` and a row to `{ ok:true, usageId }`; an RPC error throws nothing and returns `{ ok:false, reason:"disabled" }` (fail closed). Implement `createUsageStore`; add the ESLint exception; run `pnpm lint && pnpm typecheck && pnpm vitest run src/lib/ai`. Expected: PASS.

### Task 6: Server flow and route

**Files:** Create `src/features/records/ai-read.ts`, `ai-read.test.ts`, `src/app/api/records/ai-read/route.ts`.

**Interfaces — Consumes:** Tasks 1–5, `listCertificates` (`src/features/certificates/queries.ts`), `getCurrentUser`, `sniffEvidenceType`. **Produces:**
```ts
export type CertificateSuggestion = {
  kind: CertificateKind; certificateId: string | null; issuedDate: string | null;
  certificateUrl: string | null; validUntil: string | null; aiFields: string[]; // names of the form fields the AI filled
};
export type ReadDeps = {
  gateway: AiGateway; usage: UsageStore; rates: Rates; threshold: number;
  catalogue: () => Promise<{ id: string; kind: CertificateKind; name: string; provider: string }[]>; // approved entries, ≤ 300
  pages: (file: { bytes: Uint8Array; mime: EvidenceMime }) => Promise<Result<{ mime: "image/jpeg"|"image/png"|"image/webp"; bytesBase64: string }[]>>;
  today: string; // todayVn()
};
export async function readCertificate(deps: ReadDeps, input: { memberCode: string; file: File }): Promise<Result<CertificateSuggestion>>;
```
Order inside `readCertificate`: empty file → `EVIDENCE_EMPTY_MESSAGE`; over 4 MB → `EVIDENCE_TOO_LARGE_MESSAGE`; sniff first bytes, `null` → `EVIDENCE_WRONG_TYPE_MESSAGE` (all three before any claim); `usage.claim`; `deps.pages`; gateway call; `usage.finish` with outcome and estimated cost (also on failure; a failed `pages` step finishes as `unreadable`); then `applySuggestion`: keep `certificateId` only if it is in the catalogue sent, set `kind` from that entry when matched, drop any field whose confidence is below `threshold`, drop a date later than `today`, and list the surviving fields in `aiFields`. Error codes map to short English messages (no provider text, no file name).

The route (`POST`, `maxDuration = 60`) mirrors `src/app/api/import/parse/route.ts`: 401 when signed out, early 413 on `content-length` over `MAX_EVIDENCE_BYTES` plus 64 KB, `formData()` with `file`, member code of the signed-in user (read through the user client, RLS-visible `members` row), then `readCertificate` with real deps (`createAiGateway()`, `createUsageStore()`, `ratesFromEnv()`, `AI_CONFIDENCE_THRESHOLD` default `0.6`). Until Task 8 lands, `pages` accepts images only and returns `err("PDF reading is not available yet. Upload a JPG, PNG or WebP image.")` for a PDF.

- [ ] **Step 1:** Write `ai-read.test.ts` with a stub gateway, stub store and tiny PNG/JPEG byte fixtures: flag off → `disabled` message and `finish` never called; limit reached → `daily_limit` message; 5-byte `File` typed `image/png` with non-image bytes → wrong-type message and `claim` not called; id not in catalogue → `certificateId: null`; exam answer matched to a completion entry → `kind: "completion"`; confidence 0.4 on `issuedDate` → `issuedDate: null` and absent from `aiFields`; a date after `today` → `null`; gateway `timeout` → `finish` called with outcome `timeout` and a non-empty message; gateway returning `holderName` → absent from the returned suggestion and from every `finish` argument; cost passed to `finish` equals `estimateCostMicroUsd` of the reported usage.
- [ ] **Step 2:** Run `pnpm vitest run src/features/records/ai-read.test.ts`; expect FAIL. **Step 3:** Implement `ai-read.ts` and the route. **Step 4:** Run the test (expect PASS) and `pnpm lint && pnpm typecheck`.

### Task 7: "Fill from file" in the record sheet

**Files:** Create `src/features/records/components/ai-fill-button.tsx`, `ai-fill-button.test.tsx`; modify `src/features/records/components/record-sheet.tsx`, `record-sheet.test.tsx`, and the page that renders `RecordSheet` (`src/app/(app)/records/page.tsx`) to pass `aiReaderEnabled`.

**Interfaces — Consumes:** Task 6 route and `CertificateSuggestion`. **Produces:**
```tsx
export function AiFillButton(props: { file: File | null; onSuggestion: (s: CertificateSuggestion) => void }): JSX.Element;
// RecordSheet gets a new optional prop: aiReaderEnabled?: boolean (default false)
```
The page sets `aiReaderEnabled` from `createUsageStore().isEnabled("certificate-reader")` and the transport not being misconfigured (a failure means `false`). In the sheet: the button is rendered only when `aiReaderEnabled` and a file is chosen in the existing evidence `FileDropzone`; on success it sets the kind selector from `suggestion.kind`, then `certificateId`, `issuedDate`, `certificateUrl`, and — when `issuedDate` is set — `status: "done"` and `progress: 100`, each with `shouldDirty: true`; fields in `aiFields` show a small "AI" badge (use the existing `Badge`) that disappears when the field is edited; on error show the route's message with `toast.error` and leave the form untouched. Saving is unchanged and stays manual; the same `File` is uploaded as evidence by the existing flow.

- [ ] **Step 1:** Tests (mock `fetch`): button absent when `aiReaderEnabled` is false or no file chosen; success fills the fields and shows the AI badge on `issuedDate`; editing the date clears its badge; a 429-style error response leaves every field as it was and shows the message; a suggestion with `issuedDate: null` does not set status or progress.
- [ ] **Step 2:** Run both test files; expect FAIL. **Step 3:** Implement. **Step 4:** Run them (expect PASS) and `pnpm lint && pnpm typecheck`.

### Task 8: PDF pages as images (gate: may be dropped for the first release)

**Files:** Create `src/lib/ai/pdf-pages.ts`, `pdf-pages.test.ts`, a small sample PDF under `src/lib/ai/fixtures/`; modify `ai-read.ts` wiring in the route; add the chosen dependency to `package.json`.

**Interfaces — Produces:** `export async function pdfToImages(bytes: Uint8Array, maxPages = 3): Promise<Result<{ mime: "image/png"; bytesBase64: string }[]>>`.

- [ ] **Step 1 (spike):** Try a pure-JS or prebuilt-binary renderer (candidates: `unpdf` with `@napi-rs/canvas`, or `pdfjs-dist`) on a 3-page sample in a Vitest test: expected 3 PNGs of at most 1600 px on the long side. Measure installed size and cold start; write the numbers in a comment. **Gate:** if it cannot run on Vercel Hobby (bundle over the function limit, native binary fails to load, or render over 20 s), do not add it: keep the image-only message from Task 6, set the file picker's hint accordingly, and record this in `docs/decisions.md` as a follow-up. Stop here in that case.
- [ ] **Step 2:** Test: sample PDF → 3 images; a 5-page PDF → only 3; an encrypted or corrupt PDF → `err("That PDF could not be read.")`.
- [ ] **Step 3:** Implement and wire into the route's `pages` dependency. **Step 4:** Run the test, then `pnpm lint && pnpm typecheck`.

### Task 9: Docs and final verification

**Files:** Modify `docs/process/04-wbs.md` (13.1 and 13.2 status), `docs/decisions.md` (#75: add that #35 is extended to `usage-store.ts`), `docs/deploy/` (new short section or file: set the three env keys, flip the flag with `update ai_feature_flags set enabled = true where feature = 'certificate-reader'`, and "do not enable before WBS 1.8 is answered"), `CLAUDE.md` status line (migration `20261122000001` not yet `db push`).

- [ ] **Step 1:** Make the edits above.
- [ ] **Step 2:** Run `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db`; paste the real counts into your report. Run `graphify update .` if the command exists.
- [ ] **Step 3:** With `AI_TRANSPORT` unset and the flag turned on locally, run `pnpm dev`, open Add record, pick an image, press "Fill from file" and check the form fills from the fake answer for both kinds (use a catalogue whose first entry is an exam, then a completion). Turn the flag off and check the button disappears. Report what you saw; do not claim a real-certificate result (that waits for WBS 1.8).
