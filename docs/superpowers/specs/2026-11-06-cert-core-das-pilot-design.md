# Cert Core: DAS pilot (Feature List section A)

- **Date:** 2026-11-06
- **Owner decision:** DAS, 20 people, starts next week on Phase 1. Every item of Feature List v2.1 section A is covered here before any AI (section B). Phase 2 lands during the pilot (2026-11-06, recorded by this work as decision #61; accounts are decision #60).
- **Feature List:** `exports/CertTracker-Feature-List-v2.1-2026-11-06.pdf` (outside git).
- **Sources:** [WBS](../../process/04-wbs.md), [production readiness](../../process/08-production-readiness.md), [pilot plan](../../process/07-poc-and-mvp.md) §6, [accounts runbook](../../deploy/accounts-and-catalogue.md), [e-mail runbook](../../deploy/cron-email.md).

## 1. Why

CertTracker is live on production, but nobody uses it: the cloud database holds 2 members and no certificates. The aim is to find out whether a real team drops its spreadsheet. That needs real people using the app now, not more features first.

This is a **proof of concept with DAS**. If it goes well, the owner moves to paid hosting afterwards (owner, 2026-11-06). Until then it stays on the free tiers, so the safeguards in §8 are manual.

**Success (the `SM` measures in 04):**
- All 20 people have signed in and hold their certificates in the app.
- `SM-1`: DAS stops updating its spreadsheet after two consecutive weeks of real use.
- `SM-2`: DAS's real file imports with no unresolved error rows.
- `SM-3`: two consecutive Mondays with Sent > 0 and Failed = 0.

**Failure, even if everything technically works:**
- Someone sees another person's certificate or proof without the right to.
- An invitation does not arrive or its link is dead, and the person gives up.
- Real staff data is lost with no backup.
- A real bug is first found by a DAS member when a test could have found it.

## 2. The three phases

| Phase | Content | When |
|---|---|---|
| **1 (this spec, §3–§9)** | Invitations, self-service certificates and proof, reminders, the existing dashboard, role changes | Next week |
| **2 (this spec, §10)** | Submit and approve, chosen field, numbers by month or quarter | During the pilot |
| 3 | The four AI features (section B) | After section A is done, own spec |

Phase 1 must not block Phase 2: when approval arrives, certificates entered during Phase 1 count as already approved (author's call, §13).

### 2.1 Section A, line by line

Every row of Feature List v2.1 section A, and where this spec handles it. "Existing" means built, on production and covered by the current tests; Phase 1 still checks it end to end (§7.4 E-1) and on production (§7.5).

| Section A row | Status in the list | Handled by |
|---|---|---|
| Members | Live | Existing; §5.1 links accounts added later |
| Organisation | Live | Existing |
| Manager scope | Live | Existing; §7.2 access matrix |
| Career info | Live | Existing |
| **Chosen field** | Planned | **§10.2** |
| Course list | Live | Existing |
| Starter list | Live | Loaded on production; §5.7 for missing courses |
| Certificate record | Live | Existing; §7.4 E-1, E-7 |
| Expiry | Live | Existing |
| **Submit and approve** | Planned | **§10.1** |
| Overview (dashboard) | Live | Existing; §10.1 changes it to count approved certificates only |
| **By month or quarter** | Planned | **§10.3** |
| Expiry e-mail | Live | Existing; §7.4 E-9, §7.5 P-6 |
| Monthly report | Live | Existing; §7.4 E-9, §7.5 P-6 |
| Data quality | Live | Existing |
| Import | Live | Existing; §7.6 generated file |
| Export | Live | Existing; §10.1 adds the approval column |
| Sign-in and roles | Live | Existing; §5.2, §5.3 |
| Invite by e-mail | Built | §4, §5.1, §5.6, §7.5 P-1 to P-4 |
| Change access | Built | §4 |
| Everyday use | Live | Existing; §5.5 |

## 3. Day-one journeys

These are what must work. Each maps to tests in §7.

**Set-up (admin, before Monday)**
1. Create the DAS organisation at `/org`: DC, program, teams.
2. Import DAS's real Excel file at `/import`, or add members at `/members`.
3. Invite each person from the Supabase Dashboard.
4. Set Access to Manager at `/members` for managers, then give them teams or programs at `/org`.

**A member's first day**
1. Receives the e-mail, opens the link, chooses a password, signs in.
2. Sees their own certificates at `/me`.
3. Adds a certificate, updates progress, uploads a proof file (PDF, JPG, PNG or WebP, up to 4 MB).
4. Enters when they started working.

**A manager's day**
1. Sees only the people in their teams or programs, at `/members` and `/records`.
2. Opens a member's proof, and edits a member's record if needed.
3. Reads the dashboard and the Monday e-mail.

**Every Monday and every 1st of the month**
- Expiry e-mails and the monthly report go out once each. The admin confirms this in the `/settings` history.

**When something goes wrong**
- Link expired or used: the page says so; the admin sends a new one.
- Password forgotten: the admin sends a recovery link from the Dashboard.
- Someone leaves: the admin marks the member inactive and bans the login in the Dashboard (§5.8).

## 4. Already built, not released

On branch `feat/cert-core-accounts`, uncommitted, with tests passing (Vitest 768, pgTAP 335, e2e 67 on 2026-11-05):
- `/set-password` for invitation and recovery links. The token is used only on submit, so mail scanners cannot use it up.
- Access (Admin, Manager, Member) in the member form; nobody can change their own.
- E-mail templates in `supabase/templates/`.
- Decisions #59 and #60, the re-cut WBS, and the runbook.

The course catalogue is already loaded on production. This spec does not redo any of this.

## 5. New code in Phase 1

Only what a real team would otherwise trip over.

### 5.1 Link an account when its member comes later

**Problem:** `handle_new_user()` links a login to a member only when the login is created. If the admin invites first and adds the member after, the person is told their account is not linked, and the only fix is SQL.

**Why this needs care:** a link gives a login the member's certificates and proof. A manager can edit a member's e-mail in scope (RLS has no column guard), so a trigger that links on any e-mail change would let a manager point a member at any unlinked login. That is the worst failure in §1, so the rule is narrow.

**Change:** one new migration.
- A trigger on `public.members` sets `profiles.member_id` to the member when the login with that e-mail has `member_id is null`:
  - after **insert**. Only the admin and `commit_import` can insert, so this is safe.
  - after **update of `email`**, only when the caller is the admin or has no JWT. A manager's e-mail edit never links.
- A link is never moved or removed by the trigger. Fixing a wrong link is a deliberate admin step: the SQL in the runbook.
- `handle_new_user()` is replaced so it links only a member who has no login yet. Today `profiles.member_id` is unique, so inviting a new address for a member who is already linked aborts the insert and the Dashboard just shows an error. After the change the login is created unlinked and the runbook explains the fix.

### 5.2 Keep the session when the proxy redirects

**Problem (review finding):** `src/lib/supabase/proxy.ts` builds new redirect responses that drop the cookies written during a session refresh, so a rotated refresh token can be lost and the user signed out.

**Change:** copy `response.cookies` onto both redirects.

### 5.3 Log auth errors in the proxy

**Problem (review finding):** an outage looks like people being signed out, with nothing in the logs. `getUser` and `getClaims` usually **return** an `AuthError` rather than throw, and `proxy.ts` ignores the returned `error`, so logging only in the `catch` blocks would miss most failures.

**Change:** `console.error` for thrown errors and for returned errors, except a missing session, which is normal for a signed-out visitor. The result stays signed out. Log the error only, never a token.

### 5.4 Run e2e in CI

**Problem:** `.github/workflows/ci.yml` runs lint, typecheck, Vitest, pgTAP and build, but no e2e. The 67 e2e tests only run when someone remembers.

**Change:** a job that starts Supabase, resets to the seed, installs Chromium and runs the whole Playwright suite on every pull request and on `dev` and `main`. It passes `SUPABASE_SERVICE_ROLE_KEY` (the local stack's), `CRON_SECRET` and `EMAIL_TRANSPORT=console` as environment. Merging needs it green. On failure it uploads the Playwright report.

### 5.5 Check, and fix if needed: sidebar prefetch

**Question (review finding, unmeasured):** adding `loading.tsx` to every route may make each sidebar link prefetch render the layout, costing one Auth call per link on each page view.

**Change:** count requests to `/auth/v1/user` on a production build. If one page view costs more than 2, set `prefetch={false}` on the sidebar links. If not, change nothing and record the number in 04 §4.

### 5.6 Sign out after a failed password save

**Problem:** `setPassword` leaves the person signed in when `updateUser` fails, because `verifyOtp` has already created a session, and the page then says to ask for a new link.

**Change:** sign out (local scope) on that failure too.

### 5.7 When a certificate is not in the course list

Only the admin can add courses (owner's choice, 2026-11-06). Where the member picks a course in the certificate form, a short line says that a missing course can be requested from the admin, and the runbook tells the admin how to add it. No schema or permission change.

### 5.8 No code for leavers

Marking a member inactive already stops their e-mails, but they can still sign in. For a 20-person pilot, the runbook covers this by banning the login in the Dashboard. `shortcut: manual ban for leavers, automate if the admin does it more than a few times.`

### 5.9 Documents

- `docs/deploy/accounts-and-catalogue.md`: add leavers, the 24-hour link setting, the Auth rate-limit check, fixing a wrong link, and an invited address that does not match; remove "do this first", the one-hour note and the old SQL once §5.1 lands.
- A backup and restore section for the free tier: a database dump (`supabase db dump`, schema and data) plus a copy of the `certificates` storage bucket, because a dump does not include proof files. Taken before inviting DAS and every Friday of the pilot.
- `docs/decisions.md` decision #61: the phase order in §2. `docs/process/04-wbs.md`: move the pilot before the AI milestone, and add Phase 2's work as a package.

## 6. Non-goals

- Self-service "Forgot password" page: the admin sends the link.
- In-app invitations: they would need the service role in the app, against invariant 2.
- Any AI (section B).
- Skill Matrix, goals, role growth, the Rust backend.
- Dropping `team_managers` (decision #58): a separate migration once the pilot is stable.

## 7. Test suite

Existing tests stay. This section lists what is added. Each rule below must fail if the behaviour breaks; a test that cannot fail does not count (this branch has hit that three times, always with `toHaveCount(0)` while a dialog hid the table).

### 7.1 Database (pgTAP)

| ID | Test |
|---|---|
| DB-1 | Login first, member added later: `member_id` is set |
| DB-2 | Same through `commit_import` |
| DB-3 | E-mail matching ignores case (`citext`) |
| DB-4 | Admin corrects a member's e-mail to match an unlinked login: it links |
| DB-5 | **A manager changes an in-scope member's e-mail to an unlinked login's address: no link, and that login still reads nothing of the member's** |
| DB-5b | A linked login is not moved or unlinked by any e-mail change |
| DB-5c | Inviting a new address for a member who is already linked: the login is created, unlinked, without an error |
| DB-6 | No matching login: the insert succeeds and nothing else changes |
| DB-7 | A member cannot call or trigger the link for someone else: after linking, RLS still shows them only their own member row |

### 7.2 Access matrix (pgTAP, run as each role)

The worst failure in §1, so it is tested at the database for every table a pilot user touches. Existing files may already cover some cells; the implementer maps them and adds only the gaps, listing the mapping in the plan.

| Who | `members` | `training_records` | Proof files (`storage.objects`) | `profiles` role | `manager_scopes` |
|---|---|---|---|---|---|
| Member | Own only; cannot update | Own read, insert, update; never another's | Own only | Cannot change, own or others' | Cannot write |
| Manager | In scope; update allowed | In scope only | In scope only | Cannot change | Cannot write |
| Manager out of scope | Sees nothing | Sees nothing | Denied | — | — |
| Demoted manager | Own only | Own only | Own only | — | Rows grant nothing |
| Admin | All | All | All | Can change | All |

Each "cannot" is asserted as a refusal or as zero affected rows, whichever the policy gives, and the assertion also proves the data did not change.

### 7.3 Unit (Vitest)

| ID | Test |
|---|---|
| U-1 | Redirect to `/login` carries the refreshed cookies |
| U-2 | Redirect to `/dashboard` carries the refreshed cookies |
| U-3 | A thrown error and a returned `AuthError` are each logged and treated as signed out; a missing session is not logged; no token appears in the log |
| U-4 | `setPassword`: when `verifyOtp` fails, `updateUser` is not called |
| U-5 | `setPassword`: when `updateUser` fails, it returns a message and signs out |
| U-6 | `setMemberAccess`: refused for yourself (exists); a non-admin's update returning no rows is an error, not success |

### 7.4 End to end (Playwright, in CI)

| ID | Journey |
|---|---|
| E-1 | **Whole first day:** admin adds a member, the invitation link is opened, password set, sign-in, member adds a certificate with a proof file, the manager in scope sees it and opens the proof, the dashboard count rises by one, and the export includes it |
| E-2 | Member added after the login exists: the person's `/me` is not the "not linked" page |
| E-3 | Member A opens member B's proof URL directly: refused |
| E-4 | Out-of-scope manager opens that same proof URL: refused |
| E-5 | Signed-out visitor on each app route and non-cron API route: redirected to `/login`, never data. Cron routes without the token: 401 |
| E-6 | Signing out in one browser sends the other session to `/login` without a redirect loop, and it can sign in again |
| E-7 | Wrong proof file type and a file over 4 MB: a clear message, nothing saved |
| E-8 | Vietnamese names survive import, screen, export and e-mail text |
| E-9 | Monthly and expiry runs against pilot-shaped data: each person gets one e-mail, a second run sends nothing |
| E-10 | A phone-width run of E-1's member steps: password, sign-in, add certificate, upload proof |

Rules: wait for dialogs to close before asserting absence; assert something positive first; no fixed sleeps; each test restores the seed.

### 7.5 Real-world checks (cannot be automated)

Run on production by the owner, before inviting DAS. Results go in the pilot log.

| ID | Check | Pass |
|---|---|---|
| P-1 | Invite your own second address (Gmail) and a company mailbox | Arrives within minutes, not in spam; link works |
| P-2 | Open a link in the company mailbox after its scanner has had time | Link still works |
| P-3 | Link after 2 hours | Works (§8 sets 24 hours) |
| P-4 | Used link, and an expired one | Clear message; a new invitation or recovery link works |
| P-5 | Upload a proof and open it as the manager | Opens; a signed-out browser cannot use the URL once it has expired |
| P-6 | Run the expiry and monthly crons by hand with `dryRun` per the runbook, then one real run to yourself | Numbers right; `/settings` history correct |
| P-7 | Sign in on a phone and on the office network | Works, no blocked resources |
| P-8 | Restore the backup into a separate project | Row counts match and a restored proof file opens |

### 7.6 Import file and rehearsal

The owner does not have a DAS file to import, so the builder produces one (owner, 2026-11-06):
- **A generator script** that writes an Excel workbook in the import's own format: headers as the export writes them, one row per certificate. The people, teams and certificates come from a small input list; the courses come from the 55 in the catalogue.
- **A rehearsal file** made by that script with 20 invented people (`@example.com` e-mails), 2 or 3 teams, and a spread of statuses and expiry dates: valid, expiring within 60 days, expired, in progress, not started, no expiry. Import it on the local stack and check the counts and the dashboard.
- **The DAS file** is made by the same script from the owner's list of real names, e-mails and teams. The list and the file stay outside the repository, and no staff names go into docs or test fixtures.

`SM-2` is then measured on whatever file DAS actually imports.

### 7.7 Done means

All of these on the same commit: lint 0 errors, typecheck, Vitest, pgTAP, full e2e in CI, then §7.5 and §7.6 recorded. A failing test may not be skipped to make the date. If a test blocks the Monday start, the start moves or the owner decides, in writing, to accept that risk.

## 8. Production set-up (owner)

These are decisions and Dashboard work, not code. The runbooks hold the steps.

| # | Item | Why |
|---|---|---|
| 1 | Stay on the free tiers for the proof of concept; decide on paid hosting afterwards (owner) | Vercel Hobby is non-commercial and Supabase Free has no automatic backup, so item 9 is manual |
| 2 | Verify the sending domain on Resend; set `EMAIL_FROM`, `RESEND_API_KEY` | Unverified senders only reach the account owner |
| 3 | Custom SMTP in Supabase Auth, using that domain | The built-in sender cannot reach staff |
| 4 | Email templates and Site URL in the Dashboard | The link must point to `/set-password` |
| 5 | **Email OTP expiry to 24 hours** (default 1 hour) | People do not always open mail within the hour |
| 6 | Check the Auth e-mail rate limit allows 20 invitations in one sitting | Otherwise invitations fail part way |
| 7 | `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL` on Vercel | Crons fail closed without them; confirm on `/settings` |
| 8 | Sign-up disabled in the cloud project (`PRD-09`) | Only staff may have accounts |
| 9 | Manual backup, including proof files, before inviting and every Friday; one tested restore (`PRD-04`) | Before any real data |
| 10 | Data owner's written agreement (`PRD-15`) | Names, e-mails and proof files go to a cloud service |
| 11 | Delete leftover test types `AWS`, `TOEIC`, `IELTS` and provider `IIG` | They clutter DAS's course form |
| 12 | Check JWT signing key type | HS256 costs one extra Auth call per page |

**Release order:** backup, then `supabase db push` the §5.1 migration, then merge `dev` to `main`, then §7.5, then import and invite. The §5.1 trigger is additive, so the running version keeps working during the gap.

## 9. Running the pilot

- **Owner** watches `/settings` history after each Monday and the 1st (`PRD-19`), and Vercel logs daily in week 1.
- **DAS contact:** one named person collects problems, on the existing Teams link.
- **Severity:** a data leak or lost data stops the pilot the same day. Anything blocking sign-in or saving is fixed within a working day. The rest is logged and sorted weekly.
- **Rollback:** Vercel Instant Rollback for code. Database changes in this phase are additive, so no database rollback is planned; the backup covers disaster.
- **Exit:** after two weeks, the owner and sponsor review the three `SM` measures and decide on Phase 2 timing and rollout (G1).

## 10. Phase 2: the rest of section A

Built while DAS uses Phase 1. Each part ships on its own, behind the same CI gate (§7.7). The flow below is the owner's (2026-11-05): the member submits, the manager approves or returns it with a note, the member fixes it and submits again, and only approved certificates count. Details marked *call* are the author's (§13).

### 10.1 Submit and approve

**What needs approval.** Only a certificate marked Completed. Not started and In progress records never wait for anyone.

**States** of a Completed certificate:

| State | Meaning | Who moves it |
|---|---|---|
| Waiting | Sent by the member, not yet checked | Set when a member saves it as Completed |
| Approved | Checked; counts everywhere | Manager in scope or admin |
| Returned | Sent back with a note | Manager in scope or admin; the note is required |

- A member's edit to an Approved or Returned certificate's course, issue date or proof sends it back to Waiting. Edits to notes or progress on a not-completed record change nothing (*call*).
- A Completed certificate saved by a manager in scope or by the admin is Approved straight away; so is every row of an admin import (*call*).
- **Migration:** every existing Completed certificate becomes Approved, including everything DAS enters in Phase 1.
- Only the manager in scope or the admin can change the state; the database enforces it, as it already does for refund fields. A member cannot approve their own certificate, even through the API.

**What "count" means.** Only Approved certificates appear in the dashboard numbers, breakdowns and ranking, the monthly report, and expiry e-mails (*call*: a reminder about an unchecked certificate would be noise). Lists and exports show every certificate, with an Approval column.

**Screens.**
- Member: the certificate shows its state; a Returned one shows the note.
- Manager and admin: a "Waiting for approval" filter on `/records` with a count; Approve and Return actions on the certificate, next to its proof.
- No new e-mail in Phase 2 (*call*); the waiting count on the dashboard is the prompt.

### 10.2 Chosen field

- A member picks one field they want to grow in, from the certificate types (Cloud, Security, Languages and so on), on `/me`. It can be cleared.
- The admin can set it in the member form; a manager sees it read-only.
- A member sets only their own, through the same pattern as career start (a database function; members cannot update their member row).
- Removing a certificate type clears the field rather than failing.
- Phase 3's "Next certificate" uses it. Phase 2 only stores and shows it.

### 10.3 Numbers by month or quarter

- A period picker on the dashboard: this month (default), a month, or a quarter. Months and quarters follow Vietnam dates.
- For the chosen period:
  - **People newly certified:** distinct people with at least one Approved certificate issued in the period.
  - **New certificates:** Approved certificates issued in the period.
  - **Per field:** new certificates in the period by certificate type, next to each type's currently valid total.
- **Waiting for approval** is a current count, not tied to the period.
- A period is decided by the **issue date**, not the approval date (*call*).
- Scope follows the existing dashboard: the admin sees everything, a manager their teams and programs, a member only anonymous totals.

### 10.4 Phase 2 tests

**Database (pgTAP)**

| ID | Test |
|---|---|
| A-1 | A member saving a Completed certificate gets Waiting; a manager in scope or admin saving one gets Approved |
| A-2 | A member cannot set Approved or Returned on their own certificate, directly or through any function |
| A-3 | A manager out of scope cannot approve or return |
| A-4 | Returned without a note is refused |
| A-5 | A member's edit of course, issue date or proof sends Approved back to Waiting; a progress edit on a not-completed record does not |
| A-6 | The migration makes every existing Completed certificate Approved and leaves the others untouched |
| A-7 | Dashboard functions count only Approved certificates; the expiry and monthly e-mail data likewise |
| F-1 | A member sets and clears only their own chosen field; a manager cannot change it; the admin can |
| F-2 | Deleting a certificate type clears chosen fields that point to it |
| N-1 | Period edges: issued on the last day of a quarter and on the first day of the next, by Vietnam date |
| N-2 | Two Approved certificates of one person in a period count as one person and two certificates |
| N-3 | A Waiting certificate issued in the period is not counted in the period numbers but is in the waiting count |
| N-4 | Each role sees its own scope of the period numbers; a member sees anonymous totals only |

**Unit (Vitest):** state labels and allowed actions per role; period picker to date range, including quarters across a year end.

**End to end (Playwright, in CI)**

| ID | Journey |
|---|---|
| E-11 | Member completes a certificate with proof, it shows Waiting; the manager sees it in the waiting filter, returns it with a note; the member sees the note, fixes it and resubmits; the manager approves; the dashboard count rises only then |
| E-12 | A member cannot see Approve or Return, and the server refuses the action if called directly |
| E-13 | A member picks a chosen field on `/me`; the admin sees it in `/members`; the manager sees it read-only |
| E-14 | The dashboard period picker changes the numbers to match a known seed spread |
| E-15 | The export has the Approval column, and an exported file still imports unchanged (decision #26) |

## 11. Decisions to record

- **#61** in `docs/decisions.md`: the phase order in §2, and that section A is finished before section B.
- `docs/process/04-wbs.md`: Phase 2 as work packages in C1, and the pilot moved before the AI milestone.

## 12. What is left to the builder

Task order and commit split, test file names and fixtures, exact wording of messages, the trigger's name, how to shape E-9's data, and the CI job layout. The plan ends at a green pull request to `dev`; the owner approves each commit, merges, runs `supabase db push` and carries out §8.

## 13. Decisions and calls

**Decided by the owner (2026-11-06):** Phase 1 first with DAS, 20 people; a proof of concept on the free tiers; the builder generates the import file; only the admin adds courses.

**Calls made by the author; check these:**

1. The link trigger (§5.1) is in scope: the runbook's "member first" rule is easy to break with 20 people.
2. Phase 1 certificates count as approved when Phase 2 arrives.
2a. Phase 2's details marked *call* in §10: manager and admin saves are approved straight away; only approved certificates appear in numbers and e-mails; no approval e-mail; periods follow the issue date.
3. A leaver is handled by a manual ban.
4. E-mail link lifetime is 24 hours.
5. Merging requires the e2e job green, which slows each pull request by a few minutes.
6. A failing test can block the Monday start.
7. Pilot severity targets in §9.
8. Every person in DAS, managers included, gets a member row, because the manager picker and "Manages" column only show people with one.
9. Only the admin's e-mail corrections link an account. A manager's correction leaves the person unlinked until the admin steps in, and wrong links are fixed with runbook SQL.
10. Backups include proof files, before inviting and every Friday.
11. The plan stops at a green pull request to `dev`.
12. The rehearsal file uses invented people; the DAS file is generated from the owner's list.
