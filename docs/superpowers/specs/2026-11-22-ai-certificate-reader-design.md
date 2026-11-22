# AI certificate reader and AI gateway — design

Date: 2026-11-22. WBS 13.1 (AI platform) and 13.2 (AI reads certificate files). Decision #75. Status: draft for approval.

## Intent

A member who already holds a certificate uploads a PDF or image. The AI reads it and fills the "Add record" form; the member checks and saves. This replaces typing name, provider and date by hand, and is the first AI feature of release C2 (decision #52, DeepSeek).

The platform part (13.1) is built first and works with sample data only. The feature is switched on later, after the Admin approves the DeepSeek terms (WBS 1.8).

## Goals

- Upload file → pre-filled record form, in one step, for both kinds: **exam** and **completion** (course completion).
- Every use case still works with AI off (WBS 13.1 acceptance).
- The AI layer can later move to a separate Rust service (and its own database) without changing the callers: contract first (decision #75).
- Cost and use are logged; a daily limit stops runaway use.

## Non-goals

- No AI feature other than 13.2 (13.3–13.10 stay in their own WBS rows).
- No admin page for usage in this slice (to be added in a later step of 13.1).
- No Rust code, no separate deployment now.
- No masking code in this slice: the only text sent is the catalogue, which has no personal data, and the image cannot be masked (see Constraints). A `mask.ts` is built with the first feature that sends free text (WBS 13.3 and later).
- No automatic save: the AI only suggests (decision #50).
- No new certificate or course is created from the AI result; no match means the member picks by hand or uses the existing "propose" flow.

## Anti-goals (a failure even if it works)

- A value the AI guessed that the member does not notice is saved as fact. Every AI-filled field is marked and editable; low-confidence fields stay empty.
- The AI invents a certificate that is not in the catalogue.
- The holder's name or e-mail reaches a log or the database via the AI path. (The member code is allowed in `ai_usage`: it is a pseudonym and the key of the daily limit.)

## Constraints

- The API key and every AI call stay on the server (R-27). Key only in server env, never `NEXT_PUBLIC_`.
- The AI sees only data the caller may see (R-28): the Next.js server reads the catalogue with the user's JWT and passes it in the request. The gateway never queries app tables.
- Text sent to the AI carries no names or e-mails (R-29, #50). **Exception, accepted 2026-11-22:** a certificate image or PDF always shows the holder's name and cannot be masked. This is sent to DeepSeek only after the Admin approves the terms (WBS 1.8). The prompt tells the model not to return the name; the name is never stored in logs or in the usage table.
- File rules are those of the existing evidence upload: PDF, JPG, PNG, WebP, at most 4 MB, type decided from the first bytes (`src/lib/storage/evidence.ts`).
- Free tiers (Vercel Hobby, Supabase Free) during the pilot. Vercel function time is short, so a call must fail cleanly on timeout and the form must stay usable.
- Dates use `Asia/Ho_Chi_Minh` (`lib/dates.ts`).
- No `any`; Zod validates every request, response and model output.

## Approaches considered

| | What | Trade-off |
|---|---|---|
| **A (chosen)** | Contract-first. TypeScript gateway inside Next now, behind a port; a Rust service implements the same JSON contract later. | One extra contract file and fixtures. Pilot stays on free tiers. |
| B | Separate Rust service from day one. | No rewrite later, but a second deployment outside Vercel Hobby, more secrets and latency, and Rust is "Later" in the plan. |
| C | Write straight into Next and Supabase, rewrite when moving. | Cheapest now; the masking and limit logic would be tied to Next and Supabase and rewritten. |

Decided with the project owner on 2026-11-22: A.

## Design

### Layout

```
src/lib/ai/
  contract.ts        Zod schemas = the wire contract (request, response, error codes)
  gateway.ts         interface AiGateway { extractCertificate(req): Promise<Result<...>> }, createAiGateway(env)
  fake-gateway.ts    sample output for both kinds; refused in production
  deepseek-gateway.ts  OpenAI-compatible fetch; provider, base URL, model from env
  http-gateway.ts    later: calls the Rust service; same contract (stub only, not built now)
  limits.ts          pure: daily limit check and cost estimate from usage rows
  usage-store.ts     interface UsageStore; Postgres implementation
  fixtures/          JSON request/response pairs; the contract tests run against them
src/app/api/records/ai-read/route.ts   route handler (not a server action, so `maxDuration` can be set, like `api/import/parse`): auth, file checks, catalogue, call, return suggestion
```

`createAiGateway(env)` follows `createEmailSender` (`src/lib/email/sender.ts`): `AI_TRANSPORT` is `fake`, `deepseek` or `http`. Unset in dev means `fake`. `fake` in production is an error. Default for every feature flag is **off**.

### Contract (what a Rust service must implement)

`POST /v1/extract-certificate`, JSON in, JSON out. Versioned by the `/v1` prefix; fields are only added, never changed.

Request:
- `pages`: 1 to 3 items `{ mime, bytesBase64 }` (images; the server has already turned PDF pages into images, at most 3 pages).
- `catalogue`: one list of `{ id, kind, name, provider }` with both kinds (exam and completion certificates from the certificate catalogue, read with the user's JWT; no personal data). The model picks an id from it. The server then checks the returned `certificateId` is in the list it sent and sets it to `null` if not. Capped at 300 entries (`shortcut: no ranking, add name-based pre-filtering when the catalogue grows past that`).
- `requestedBy`: the member code (never a name or e-mail), for the daily limit.
- `feature`: `"certificate-reader"`.

Response, a union on `kind`:
- `exam`: `certificateId | null`, `certificateName`, `provider`, `issuedDate` (ISO), `validUntil | null` (shown to the member for comparison only: expiry is computed from the catalogue's validity), `verifyUrl | null`.
- `completion`: `certificateId | null`, `courseName`, `provider`, `completedDate` (ISO).
- Both: `confidence`, a map from field name to 0–1, and `usage` `{ inputTokens, outputTokens }`. A field the model cannot read is `null` with confidence 0.
- Dates are full ISO dates only. If the certificate shows only month and year, the date is `null` and the member types it (the record rules need a full date).

Errors are values, not exceptions: `disabled`, `daily_limit`, `unreadable`, `timeout`, `provider_error`, `invalid_output`. Never include the holder's name.

### Form behaviour

- Add record sheet gets "Fill from file" next to the evidence upload. It is the same file pick: the chosen file is read by the AI now and uploaded as evidence by the existing flow when the member saves (the file travels twice, 4 MB at most each time). The button is hidden when the feature flag is off. The kind selector that already exists is set from the AI answer; the member can change it.
- Fields below a confidence threshold (default 0.6, env-tunable) stay empty. Filled fields show an "AI" mark that clears when the member edits the value.
- A completion with `issuedDate` in the future is rejected by the existing record rules (`recordRuleIssues`), so the form shows the same error as for hand-typed data.
- On any error the form stays as it is and shows one short message; saving by hand is unchanged.

### Data

New migration (a new file; pgTAP test and `pnpm db:types` with it):
- `ai_usage(id, day date, feature text, member_code text, input_tokens int, output_tokens int, cost_micro_usd bigint, outcome text, created_at)`. `day` uses `Asia/Ho_Chi_Minh`. No name, no file, no prompt text.
- `ai_feature_flags(feature text primary key, enabled boolean not null default false, daily_limit int not null)`.
- **Limit:** `daily_limit` is a number of calls per member per day for that feature (seeded `10`, flag seeded `enabled = false`). Every call that reached the provider counts, including `unreadable`, `timeout` and `provider_error`; a call refused by `disabled` or `daily_limit` does not. The check and the insert of the usage row are one atomic statement, so two parallel requests cannot pass the limit together. There is no global cost cap in this slice (20 members × 10 calls bounds it); the cost estimate is only logged.
- **Switches:** `AI_TRANSPORT` chooses the implementation; `ai_feature_flags.enabled` chooses on or off. Both must allow a call. Until an admin page exists the flag is changed with SQL.
- **Timeout:** the route sets `maxDuration = 60` and calls the provider with a 45 s limit. A timeout returns `timeout`, writes a usage row with `outcome = timeout`, and counts against the limit.
- Plain Postgres: the logic does not use `auth.uid()`. Tables are readable and writable by the service path only; no policy for ordinary users. The Next server uses the existing server-only admin client for these two tables, which is a new use of the service role beyond cron — recorded in decision #75 and the access matrix.

### Moving to Rust later

Replace `createAiGateway` output with `HttpGateway` (env `AI_TRANSPORT=http`, `AI_GATEWAY_URL`, bearer token). The Rust service owns masking, limits, usage and the DeepSeek call; its database can be separate. The contract tests (`fixtures/`) run against both implementations. Next.js keeps the file checks, the catalogue read with the user's JWT, and the form.

## Testing

- Unit: `mask`, `limits`, contract schemas, gateway factory (production refuses `fake`), confidence threshold, PDF-to-image page cap.
- Contract: each fixture pair parses with `contract.ts`; the fake gateway returns a valid answer for both kinds.
- pgTAP: only the service path can touch `ai_usage` and `ai_feature_flags`; ordinary users, including admin, cannot.
- Action tests: flag off → `disabled`; over limit → `daily_limit`; bad file → existing evidence messages; no name in any logged row.
- A manual check on real certificates waits for 1.8 (target in the WBS: at least 80% of fields right on 30 certificates, proposed).

## Left to the builder

- How to turn PDF pages into images on Vercel (a library or a service). This needs a size and cold-start check; if it does not fit the free tier, accept images only in the first slice and say so on the form.
- **Provider facts, confirmed from the DeepSeek model table pasted by the project owner on 2026-11-22:** model `deepseek-flash` (legacy names `deepseek-v4-flash` and `deepseek-v4-flash-vision-exp` are served by it); base URL `https://api.deepseek.com` (OpenAI format); Vision and JSON Output supported; `deepseek-v4-pro` does **not** support vision, so it is not an option for this feature; concurrency limit 2500; thinking mode is on by default. Still for the builder to confirm in the Vision and Thinking Mode guides: the image input format in the message, and how to switch thinking off (the reader should run non-thinking to keep inside the 45 s limit and the cost low).
- **Vision is a hard requirement** and is met by `deepseek-flash`. If a later model change drops it, stop and bring it back as a new decision (an OCR step would change the contract).
- Cost rates are env values. Flash prices (per 1M tokens, peak / off-peak, peak = 01:00–04:00 and 06:00–10:00 UTC on weekdays): input cache miss $0.30 / $0.15, output $1.20 / $0.60. The logged estimate uses the peak rate, so it is an upper bound.
- Retention and training terms for uploaded images are part of the Admin's 1.8 approval, not code.
- Prompt wording and the structured-output mode.

## Builder's own calls (to check while reading)

- Confidence threshold 0.6; PDF page cap 3; flags default off; limit 10 calls per member per day; timeout 45 s; catalogue cap 300.
- Member code is allowed in `ai_usage`; no masking code in this slice.
- Route handler, not server action; flag flipped by SQL; button hidden when off.
- Partial dates (month and year only) come back `null`.
- Kind is detected by the model and can be changed by the member.
- No usage page now; usage is read with SQL until it is built.
