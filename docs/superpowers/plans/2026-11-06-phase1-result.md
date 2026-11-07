# Cert Core DAS pilot, Phase 1: result

Plan: `docs/superpowers/plans/2026-11-06-cert-core-das-pilot-phase1.md`. Spec: `docs/superpowers/specs/2026-11-06-cert-core-das-pilot-design.md`. Branch `feat/cert-core-accounts`, cut from `dev` at `fc05c2f`, **not merged, not pushed**; the one new migration `20261106000001_link_account_to_member.sql` is **not on production**. Working notes and reviews: `.superpowers/sdd/2026-11-06-cert-core-das-pilot-phase1/` (ledger `progress.md`).

## 1. What shipped

| Task | What | Commits |
|---|---|---|
| 0 | Invite by e-mail, `/set-password` page, invite/recovery templates; Access (role) in the member form; verified course catalogue script (55 courses); WBS re-cut and pilot spec | c591f2c, df3c241, 7476492, 2bcc86e; template test d900eba |
| 1 | Link trigger: a login links to its member when the member is added later; only an admin's changed e-mail links (never an unchanged one) | 5969553, 98224b2, 3e019b5, c54b8d9 |
| 2 | Access matrix for every role (pgTAP file 16, 55 assertions) and its map | 31172a6 |
| 3 | Proxy keeps refreshed cookies (with their options) on redirects; logs auth failures without secrets | 81df33a, 531d7aa, 1db046f |
| 4 | `setPassword` signs out (local scope) when the save fails; zero-row check on `setMemberAccess` (code in df3c241, pinned by U-6) | a684b9a, 09d37eb, 451117a |
| 5 | "Can't find your course? Ask your admin to add it." hint; linked to the course picker with `aria-describedby` | 9590558, 5387c8b, 5c8cd18 |
| 6 | Import file generator (rehearsal workbook and the real team file), no personal data in CLI output | 7719a75, f5854b9, 689b535, e0174d2 |
| 7 | e2e suite E-1…E-10 (helpers, day-one, access/boundary, data journeys) and its tightening round | 43ba5ca, 973b957, 39dd0fb, 119e80f, 12425a6 |
| 7 | E-7 product fix: a rejected proof file no longer saves the certificate | 65d1984 |
| 8 | CI `e2e` job on every pull request; report and traces kept on failure | 9590349, f5ac517 |
| 9 | Auth call counter script (1 server Auth call per page view, 0 from the browser); UPSTREAM guard; IPv6 host dropped | dc1a518, 1308f40, 097a537 |
| 10 | Runbooks (`docs/deploy/accounts-and-catalogue.md`, `backup-and-restore.md`), `pilot-checklist.md`, decision #61, WBS | 1d84c0a, 7fdc6f2, 43d12b2 |
| 11 | Review close-out: `/exports/` ignored; CLAUDE.md status; checklist items 13–15 (I-1, password rules, Email provider); "No account" e2e assertions | 198b8ad, be66faa |

## 2. Counts

Measured on **43d12b2** (Task 11 Step 1, `task-11-run.md`), local Supabase, clean tree:

| Check | Result |
|---|---|
| `pnpm lint` | 0 errors, 1 known warning (`react-hooks/incompatible-library`, TanStack `useReactTable`) |
| `pnpm typecheck` | clean |
| Vitest | 66 files / 804 tests |
| pgTAP | 16 files / 414 tests |
| e2e (Playwright, all specs) | 79/79 twice (4.6 and 4.5 min), 0 flaky, 0 retries |
| `pnpm build` | success, 0 warnings |

Baseline before Phase 1 (2026-11-05): Vitest 768, pgTAP 335, e2e 67.

Four small commits followed: 5c8cd18, 097a537, 198b8ad, be66faa. Their checks (`task-11-fix-report.md`): lint 0 errors, typecheck clean, Vitest 804 (process-docs 102/102), e2e 23/23 on the touched specs (records, courses, career, design, members). **The full e2e suite and pgTAP were not re-run after those four commits.** None of them touches a migration.

**Final re-run on `78cdc5a` (the last commit of the branch, after the four small commits):** lint 0 errors (1 known warning), typecheck clean, Vitest 66 files / 804, pgTAP 16 files / 414 after a full `supabase db reset`, e2e 79 passed twice (4.7 and 4.5 min, 0 flaky, 0 retries), `pnpm build` ok. The counts are identical to the run on `43d12b2`.

*Log note, not a failure:* in e2e run 1 the dev server logged `AuthApiError: Invalid Refresh Token` twice and one `[proxy] auth check failed` near the live-update test in `records.spec.ts`; that test passed. The new proxy logging (Task 3) now makes a stale session cookie visible in the log. Cause not investigated; if it shows up in production logs, look for a cookie from a signed-out session.

## 3. Mutation checks

Each mutation was a temporary edit, the named tests were run, then the file was restored with `git checkout` and the tree checked clean.

| Protected rule | Mutation | Went red | Task |
|---|---|---|---|
| Only an admin (or no JWT) links an account | delete the admin/no-JWT guard in the link trigger | DB-5 (file 15 #8–10) | 1 |
| A login already linked never moves | delete `and p.member_id is null` | DB-5b (#12, #13) | 1 |
| A member already linked is not linked again | delete the `not exists (… member_id = m.id)` in `handle_new_user` | DB-5c (#14, #15) | 1 |
| E-mail match ignores case | `lower(u.email) = lower(new.email)` → exact match (with guard removed) | DB-3, DB-3b | 1 |
| An unchanged e-mail never links (fix round) | remove the early return on unchanged e-mail | DB-5d | 1 |
| Manager updates stay in scope | widen the members read and update policies (a2) | file 16 #16, #17 | 2 |
| Proof files: own (member) or in scope (manager) | "certificates: read" → any object in the bucket | 05 #12, 05 #24, 16 #41 | 2 |
| Nobody changes their own role | add "profiles: update own" | 16 #6 first | 2 |
| Member cannot update another member's record | records read + update policies → `true` (i-b, reviewer) | 16 #4 first | 2 |
| A demoted manager loses the old scope | drop `app_role() = 'manager'` from `managed_team_ids()` (ii, reviewer) | 16 #34 first | 2 |
| Refreshed cookie on the `/login` redirect | bare `NextResponse.redirect` (1); same for `/dashboard` (2) | U-1; U-2 | 3 |
| No cookie or token in logs | log `request.cookies.getAll()` in the catch (3b) | "never logs a session cookie or a token" | 3 |
| A visitor with no session is not logged | log `AuthSessionMissingError` too (4) | "does not log a visitor who simply has no session" | 3 |
| Auth failures are logged | drop catch logs (5a, 5c); after fix round also the `checkLocally` logs (5b, 5d) | "logs … exactly once" and the getClaims rows | 3 |
| Cookies copied from the response with their options | copy from `request` (6); copy without options (7) | U-1/U-2 after fix round 1db046f (survived before) | 3 |
| Sign out after a failed password save | remove `signOut`; or `signOut()` global | U-5 (both) | 4 |
| Access change fails on zero rows | `assertAffected(data)` → `null` | U-6 | 4 |
| Missing course raises an error in the generator | return instead of throw | "refuses a certificate whose course is not in the catalogue" | 6 |
| Month clamp in the generator | drop `Math.min(day, lastDay)` | survived first; test 2024-02-29 added in fix round (green; re-run of the mutation *to confirm*) | 6 |
| Missing-course hint shown | "Ask" → "Asc" | `records.spec.ts` "course is missing" | 5 |
| Proof URL only for the owner or manager in scope | evidence route uses the service role | E-3, E-4 | 7 |
| `/login` checks the session with the server | `needsServerCheck` without `isPublic` | E-6 (too many redirects) | 7 |
| Oversize proof blocks Save | remove `if (fileError) return;` | E-7 over 4 MB (iii-a; again as (b) after fix round, on the action count) | 7 |
| Wrong file type blocks Save | remove the client sniff | E-7 renamed .txt (iii-b) | 7 |
| Signed-out export refused | proxy exempts export, route returns 200 (a) | E-5 | 7 |
| CSV opens in Excel with Vietnamese text | drop the UTF-8 BOM (reviewer) | E-8 | 7 |

Survived and accepted: Task 2 (a) widening only the update policy (the read policy also bounds UPDATE, R13; i-a likewise); Task 3 3a full error object in the log (auth-js errors carry no token, M-1).

## 4. Rulings

| # | What | Why |
|---|---|---|
| R1 | Task 0 commit 4 also stages the plan file | The plan belongs with the spec in history |
| R2 | Every review uses the clean-code rule IDs and the ponytail lens | Owner asked for both |
| R3 | A Sonnet implementer who finds an Opus test wrong reports it; an Opus author fixes it | Roles in the plan |
| R4 | Local `supabase db reset` before each task's first test run | Past polluted-DB failures |
| R5 | Task 2 must test `profiles.role` updates as manager/member (own and other's) and as admin | Task 0 review: nothing proved a non-admin cannot change a role |
| R6 | Warning comment next to `SET_PASSWORD_PATH`; runbook: password rules ≤ 8 chars, compare inserted course count | Review findings |
| R7 | Link on update only when the e-mail changed, plus DB-5d and DB-1b | Task 1 exploitable path; admin re-saves no longer link |
| R8 | Runbook: check a member's e-mail before inviting | A manager can plant an address before the invite (reworded later: no history view exists) |
| R9 | While the DB was down, run only no-DB tasks (3, 4, 6) | Windows reserved the Supabase ports; no idle time |
| R10 | "58 courses" in R6 was a typo; 55 | Spec §7.6 and the file say 55 |
| R11 | The test keeps its own copy of the SQL expiry rule | The test must not depend on the code under test |
| R12 | Task 6 fix round: JSON leak, `z.iso.date`, `import type`, marker guard, clamp test; not the MODULE_TYPELESS flag | Flag changes the package script (owner's call) |
| R13 | Task 2 mutation (a) "nothing red" accepted | The read policy also bounds UPDATE; (a2) covers the pair |
| R14 | Two missing access-map rows go to the Task 10 docs pass | No permission gap |
| R15 | Hint `aria-describedby` decided in the Task 11 review | Needs a prop on `EntityCombobox` (done in 5c8cd18) |
| R16 | Runbook paragraph "how the admin adds a missing course" | Spec §5.7 |
| R17 | Task 8 fix: reporter/trace flags, quiet `supabase start`, `permissions: contents: read`; not service excludes, concurrency, URL | Excludes are untestable without a runner |
| R18 | Fix the product for E-7 (block Save on a file error, sniff bytes on the client); server check stays the boundary | Spec §7.4 binds: "nothing saved" |
| R19 | Task 7 fix round: four Important plus three cheap test Minors; Remove-file gap to Task 11 | Keep the round test-only |
| R20 | Task 9 fix round waits for Task 10's commit | Two writers on one runbook |
| R21 | Task 10: fix everything in one round | The Critical was a data-loss instruction |
| R22 | I-1 handled by docs and one local check, not by changing the trigger | Requiring a confirmed e-mail would stop invite-first linking |
| R23 | Fix now: R15, drop `[::1]`, `/exports/`, CLAUDE.md, WBS §5, checklist lines, "No account" test; leave Remove-file, MODULE_TYPELESS, setAll Cache-Control, admin's own Access row | Reviewer's decisions accepted |

## 5. Reviews

| Task | Fix rounds | Big findings |
|---|---|---|
| 0 | 0 | No test that a manager/member cannot change `profiles.role` (moved to Task 2, R5) |
| 1 | 1 | **Exploitable:** the trigger fired on an unchanged e-mail, so a manager-planted address got linked at the admin's next unrelated save, exposing a colleague's certificates and proof (R7) |
| 2 | 0 | Approved; two missing map rows, citation polish |
| 3 | 1 (tests only) | Critical: U-1/U-2 could not see cookies copied from the request or without options (`HttpOnly`/`Secure` lost); Important: no test of failures in `getClaims` |
| 4 | 0 | Approved; one Minor applied (451117a) |
| 5 | 0 | Approved; hint not linked for screen readers (R15) |
| 6 | 1 | Important: malformed `people.json` printed names and e-mails |
| 7 | 1 + product fix | **Product bug E-7:** a rejected proof still saved the certificate (65d1984). Weak tests: E-5 accepted any 307 and hit only the 400 branch; E-7 could pass by racing the action; E-9 left data behind and never proved a send |
| 8 | 1 (no separate re-review) | Failure artifact would be empty (no reporter/trace flags) |
| 9 | 1 | Runbook step could detect nothing without UPSTREAM; `.next` held the counting URL; **UPSTREAM unguarded** (now http and localhost/127.0.0.1 only) |
| 10 | 1 + controller minors (43d12b2) | **Critical data-loss SQL:** `truncate public.career_roles cascade` would have wiped members, records and profiles on production; leaver keeps an open session; nested storage restore would hide proofs from members |
| 11 | 1 (re-review ✅, no new Critical/Important) | GO for PR to `dev`. **I-1:** an unlinked login could change its own Auth e-mail to a colleague's and be linked later, if "Confirm email"/"Secure email change" are OFF in production. Checked locally: with confirmation on, the change stays pending |

## 6. What the owner must still do

Everything below is in `docs/deploy/pilot-checklist.md` (fill Result and Date there).

- **Spec §8 items 1–12** and checklist items 13–15: free tiers; Resend domain and keys; custom SMTP; templates and Site URL; OTP expiry 24 h; e-mail rate limit for 20 invites; Vercel env vars; sign-up off; backups; data owner's agreement; delete test types `AWS`, `TOEIC`, `IELTS` and provider `IIG`; JWT signing key type; password rules ≤ 8 chars; do not disable the Email provider; keep Confirm email / Secure email change ON (I-1).
- **Spec §7.5 P-1…P-8**: invites to Gmail and company mailbox, scanner, 2-hour link, used/expired link, proof as manager, crons by hand, phone/office network, restore into a separate project.
- **Release order**: PR to `dev` first; then backup → `supabase db push` of `20261106000001_link_account_to_member.sql` (check `supabase migration list`) → merge `dev` to `main` → P-checks → import → invite. **Add or import members before inviting** (I-1).
- **Required checks**: after CI has run once, require `check` and `e2e` on `dev` and `main`.

**To confirm** (from the runbooks):
- Dashboard names: Email OTP expiry page; the Auth e-mail rate limit and where it is shown; sign-up switch; "Confirm email" / "Secure email change" production values; the Ban action; JWT keys page; Auth logs page; the set-password action in the restore project.
- Production `jwt_expiry` (an open leaver session lasts that long; local is 1 hour).
- Backup: how the CLI takes the DB password (flag, prompt or env var; the review suggests `SUPABASE_DB_PASSWORD`); that `storage cp -r` keeps `<member id>/<record id>/<file>` in both directions; `psql` installed; `postgres` may set `session_replication_role`; free-tier direct host may be IPv6-only (use the Session pooler).

**Only the first real CI run can prove** (task-8-review): `pnpm supabase` finds its binary under pnpm 11; cold `supabase start` time; `supabase status -o env` prints the keys on Linux; `::add-mask::` hides them and `pnpm dev` sees `$GITHUB_ENV`; cold `next dev` compiles inside the 5 s / 30 s timeouts (no CI retries); seed relative dates on a UTC runner; total time under 30 min; `playwright install --with-deps chromium`; the artifact holds the report and traces.

## 7. Known gaps and deferred items

- **Remove-file after an oversize pick:** no button; a member who wants to save without proof must close the sheet (picking a valid file clears the error). Phase 2.
- **MODULE_TYPELESS warning** in `make:import-file` and the `engines` (Node ≥ 22.18) note: owner's call (`--disable-warning=MODULE_TYPELESS_PACKAGE_JSON`).
- **`setAll` ignores the `headers` argument** (`Cache-Control: no-store` from @supabase/ssr): a risk only behind a CDN caching Set-Cookie responses. Phase 2.
- **Admin's own Access row:** the server refuses a self role change, but the dialog half-saves (member fields saved, role not). Left.
- **Two untested access-matrix cells:** member update on `manager_scopes`; demoted manager's update/delete of their own proof file (allowed, as for any member). Also no explicit cell for a user setting their own `profiles.member_id`.
- **E-10 coverage:** horizontal scroll is checked on the dashboard and `/me`, not with the certificate dialog open nor on `/set-password`.
- **`courses.spec.ts` leak:** each full run leaves "Course E2E <ts>" and "Priced Course <ts>" rows in the local DB.
- **CI:** no service excludes (`-x studio,…`) and no concurrency group; measure on the first run.
- Smaller: the generator's "not valid JSON" message also covers a missing file; the auth schema messages mix trailing periods; the E-9 sweep would delete hand-loaded catalogue rows on a local DB; nothing prevents zero admins (runbook note only).

## 8. Open list for Phase 2 (spec §10)

- **Submit and approve:** Phase 1 has no approval state. Every certificate entered now counts as Approved when Phase 2's migration runs (decision §13.2). Phase 2 adds Waiting/Approved/Returned, database-enforced state changes, the "Waiting for approval" filter and counting only Approved certificates.
- **Chosen field:** not stored in Phase 1. Phase 2 adds it on `/me` and the member form, set by the member through a database function.
- **Numbers by month or quarter:** the dashboard has no period picker yet. Phase 2 adds it (Vietnam dates, by issue date), with per-field counts and the waiting count.
- Each ships on its own behind the same CI gate; tests in spec §10.4.
