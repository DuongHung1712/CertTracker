# PoC and MVP

- **Status:** Draft v1 — reconstructed after the MVP build; the pilot plan in §6 is *proposed*
- **Last updated:** 2026-10-07
- **Owner:** CertTracker team (DC34)
- **Sources:** [Process status](00-process-status.md), [Requirements and CA](01-requirements-and-ca.md), [WBS](02-wbs.md), [SAD](03-sad.md), [Decisions](../decisions.md), [Free-tier deployment](../deploy/task9-free-tier.md), [E-mail and cron runbook](../deploy/cron-email.md), the tests under `supabase/tests/database/`, `src/` and `e2e/`

> **Tóm tắt (VI):** Dự án **không** chạy một giai đoạn PoC riêng. Tài liệu này dựng lại những gì bản build đã chứng minh về mặt kỹ thuật (bằng chứng là test tự động và các lần chạy đã kiểm tra; gần như tất cả chạy trên máy local với dữ liệu seed giả, ngoại trừ lần smoke test bản foundation trên cloud ngày 2026-09-27, xem P-09) và nói rõ những gì **chưa** được chứng minh: hiệu năng trên cloud, file Excel thật, email thật qua Resend, người dùng thật. MVP đã được xây nội bộ nhưng **chưa được xác nhận**: không tiêu chí chấp nhận MVP nào đạt. §6 là kế hoạch pilot hai tuần với một team thật (đề xuất; ngày bắt đầu đặt khi đủ điều kiện), kết quả pilot là đầu vào cho cổng G1.

**Reading note.** Items marked **(W6, unmerged)** are built on the week-6 branch `feat/week6-notifications`, which is in pull request #16, open, not merged (as of 2026-10-07). "Built" means built and tested by the build team, not validated by users.

## 1. Status and how to read this

The process asks for a PoC (prove the risky technical parts) before an MVP (the smallest product real users can try). CertTracker did not run a PoC as a separate phase: the build went straight from the design spec to the MVP, as [00](00-process-status.md) explains.

This document therefore does two things after the fact:

- **§2–§3 (PoC).** It reconstructs what the build has proven technically. Evidence is limited to automated tests in the repository and runs that were actually verified. Almost all of it ran on a local Supabase database with fictional seed data. The only recorded checks in the cloud are the smoke test of the week-1 foundation deployment (2026-09-27) and the signed-out timing spike of 2026-10-05 ([02](02-wbs.md) §4). §3 lists what is **not** proven and which work package closes each gap.
- **§4–§6 (MVP).** It restates the MVP scope, defines acceptance criteria and plans a two-week pilot with one real team. The MVP is **built internally, not validated**: none of the acceptance criteria in §5 is met.

Test counts below come from the files themselves (pgTAP: the `plan(n)` count in each file; end-to-end: the `test(` calls in `e2e/*.spec.ts`). For this document only the Vitest unit suite was re-run on this branch (2026-10-07: 56 files, 624 tests passed); the pgTAP and end-to-end suites were **not** re-run. CI runs lint, type check, unit tests, pgTAP and a build on every pull request (`.github/workflows/ci.yml`); the Playwright end-to-end tests run only locally (they are not in CI).

## 2. What the build proves technically (PoC findings)

| # | Technical question | Answer | Evidence | Limits |
|---|---|---|---|---|
| P-01 | Can Row Level Security enforce three roles (Admin all, Manager own teams, Member own data), including the refusals? | Yes, on a local database: anonymous users see nothing; a Manager sees only managed-team members, records and evidence; a Member sees only their own profile, records and evidence; a Manager cannot create or commit an import batch and a Member cannot commit one | `supabase/tests/database/04_rls.test.sql` (18 assertions), `supabase/tests/database/05_records_week3.test.sql` (38), `supabase/tests/database/06_import.test.sql` (25); the 10 pgTAP files on this branch hold 233 assertions (including the two week-6 files); `e2e/records.spec.ts` (manager limited to the managed team; member cannot see company fields) | Local database and fictional data only. The cloud project has the same policies only if every migration was pushed, which is done manually and is not claimed here. No external security review or penetration test |
| P-02 | Can every role see organisation-wide aggregates without exposing small groups or a personal ranking? | Yes, as designed: `dashboard_kpis` and `dashboard_breakdown` return numbers only; a Member gets no per-team numbers and groups under 3 learners are hidden; only Admin and Manager can call the ranking, and the Manager's ranking is limited by RLS (decisions #30, #32) | `supabase/migrations/20261003000001_dashboard_rpc.sql`, `supabase/tests/database/08_dashboard.test.sql` (37 assertions), `e2e/dashboard.spec.ts` (a member cannot read the ranking or per-team numbers straight from the API) | Hiding is best effort: totals can still be inferred by subtracting rows (decision #30). Managers see unsuppressed team numbers by design. The privacy trade-off itself is an assumption (`A-06`) |
| P-03 | Can a messy legacy Excel sheet be cleaned, staged, previewed and committed in one all-or-nothing transaction that cannot run twice? | Yes, for a synthetic workbook: status and progress are normalised, Excel serial dates converted, members de-duplicated by e-mail, error rows skipped; a failing row rolls back the whole commit; a second commit of the same batch changes nothing; re-importing the same file changes nothing (decisions #20–#29) | `src/features/import/` (unit tests `clean.test.ts`, `workbook.test.ts`, `plan.test.ts`, `preview.test.ts`, `stored.test.ts`, `commit-error.test.ts` and others), `supabase/tests/database/06_import.test.sql` (25 assertions, including "a CHECK violation aborts the commit" and "rows before the failing row are rolled back"), `e2e/import.spec.ts` (4 tests); fixture `src/features/import/__fixtures__/legacy-workbook.ts` | The fixture is **generated in code**: eight numbered rows (plus one blank row) with fictional people that reference `supabase/seed.sql` ("no real personal data"), built to contain typical problems (a title row, merged cells, mixed status spellings, a duplicate row, an unknown team). It is **not** an anonymised copy of the real legacy file (the project testing rule asks for one; it does not exist yet). The real file has never been tried (`A-04`, WBS 1.3) |
| P-04 | Can evidence files be stored privately and shown only to people allowed to see the record? | Yes, locally: the `certificates` bucket is private with a 4 MB limit; storage policies follow the record's permissions per role; the download route reads the record under the user's RLS and redirects to a signed link valid for 60 seconds; file types are checked by content, not by the browser's MIME type (decisions #7, #17) | `supabase/tests/database/05_records_week3.test.sql` (bucket private, 4 MB cap, per-role access, anon refused), `src/lib/storage/evidence.test.ts`, `src/lib/storage/supabase-storage.test.ts`, `src/app/api/records/[id]/evidence/route.ts`, `e2e/records.spec.ts` (member uploads, opens and removes evidence) | A signed link can be forwarded and works for its 60 seconds. Files are not scanned for malware (nothing in the code does so) |
| P-05 | Do other users' screens refresh when a record changes? | Yes, locally: `training_records` is in the Realtime publication; the client only treats an event as "something changed" and re-reads the data on the server under RLS | `supabase/migrations/20260930000001_records_list_evidence_realtime.sql`, `src/features/records/components/records-realtime.tsx`, `e2e/records.spec.ts` (the list updates live for another user), `e2e/dashboard.spec.ts` (the dashboard updates live) | Two browser sessions on one machine. Behaviour with many users and the Realtime limits of the Supabase Free plan were not measured |
| P-06 | Can scheduled e-mails go to the right people exactly once, with failures visible? **(W6, unmerged)** | Yes, locally with the console transport: planners choose recipients and content; an atomic claim per kind, period and recipient means a second run sends nothing and only failed or stale claims are retried; history and failures show in Settings; cron routes require the bearer secret and fail closed (decisions #34–#40, #44) | `src/features/notifications/` (unit tests `deliver.test.ts`, `run.test.ts`, `runs.test.ts`, `handler.test.ts`, `expiry-plan.test.ts`, `monthly-plan.test.ts`, `cron-auth.test.ts` and others), `supabase/tests/database/10_notifications.test.sql` (51 assertions: claims, plus the log's access rules, function grants and the selection of staff recipients), `e2e/notifications.spec.ts` (a real run sends once and a second call sends nothing; the spec refuses to run unless the transport is `console`) | **No e-mail has been sent through Resend.** Inbox delivery, spam filtering, Vercel Cron timing and the production capacity of about 40–80 recipients per run (an estimate in the runbook) are untested. The code is in pull request #16, open, not merged (as of 2026-10-07) |
| P-07 | Does the service-role key stay confined to the scheduled jobs? **(W6, unmerged)** | Yes, statically: the admin client imports `server-only` and an ESLint rule forbids importing it outside the cron route handlers (decision #35); user-facing queries use the user's token, and the import commit runs as the signed-in Admin (decision #20) | `src/lib/supabase/admin.ts`, `eslint.config.mjs` | A lint rule is a static check; how the key is stored on Vercel is an operations matter (see [06](06-production-readiness.md)) |
| P-08 | Can data be exported to CSV and Excel with Vietnamese text intact, within each role's scope? | Yes, locally: CSV with a UTF-8 BOM; a valid `.xlsx`; a Manager's export is limited to managed teams (decision #26) | `src/features/export/csv.test.ts`, `src/features/export/records-export.test.ts`, `e2e/export.spec.ts` (3 tests) | Not opened by real users in their own Excel versions |
| P-09 | Can the stack be deployed and run on free tiers? | Partly: the week-1 foundation was deployed on Vercel Hobby and Supabase Free on 2026-09-27 and passed the smoke test in the deployment notes (decision #13). Later releases to `main` are deployed by Vercel automatically, but no smoke test of them is recorded | [Free-tier deployment](../deploy/task9-free-tier.md) (status line and section E), `.github/workflows/ci.yml` (the build step) | Only the foundation was verified in the cloud. The public URL builds from `main` (last release PR #14, weeks 1–4); weeks 5–6, Vercel Cron and e-mail have never run there. Nothing is claimed about the current cloud schema. Free-tier limits: pause after 7 idle days, no automatic backups, non-commercial hosting (decision #13) |

## 3. What is NOT proven yet

Each gap names the work package in [02](02-wbs.md) (or the document) that closes it, and the assumption from [01 §7](01-requirements-and-ca.md) it relates to.

- **Performance on the cloud deployment** for signed-in pages: never measured; only signed-out requests were timed ([02](02-wbs.md) §4). Closed by WBS 8.1 (`SM-4`, `NFR-03`).
- **The real legacy Excel file**: never imported; the fixture is synthetic (P-03). Closed by WBS 1.3 (`A-04`, `SM-2`).
- **Real e-mail delivery** through Resend with a verified sending domain (SPF, DKIM), including inbox placement: never done. Closed by WBS 9.1 (domain and a test e-mail) and WBS 9.2 (two real Mondays, `SM-3`, `A-02`).
- **Weeks 5–6 on the public deployment** and a cloud schema that matches the code: not done (`main` was last updated by PR #14; week 5 is only on `dev`; pull request #16 is open, not merged; migrations are pushed manually). Closed by WBS 9.1.
- **Real users updating their own data**: no real user has used the product. Closed by WBS 9.2 (`A-03`) and the interviews in WBS 1.2.
- **The need itself** — that teams want to leave their spreadsheet: not validated. Closed by WBS 1.2 and 9.2, decided at gate G1 (`A-01`, `SM-1`).
- **Data volume**: the parser is unit-tested at the import limit of 2000 rows per file (decision #24; `src/features/import/workbook.test.ts`), but the database and end-to-end tests use a few fictional rows, so committing a large batch and the Dashboard with real volumes were not tested. Real counts are needed (`A-09`); the real file in WBS 1.3 gives a first number.
- **Keyboard and screen-reader use**: contrast is tested automatically, nothing else is. Closed by WBS 8.4 (`NFR-05`).
- **Running for weeks on free tiers** (the 7-day pause, Resend free limits, Vercel Hobby cron timing): not observed. Observed during WBS 9.2; decided in WBS 9.3.
- **Backup and restore**: no backup procedure exists and no restore was tried. A first backup and one restore trial are part of WBS 9.1 (pilot readiness); automatic backups are WBS 9.4 ([06](06-production-readiness.md)).
- **Data protection approval** to store names, work e-mails and evidence files in a cloud service: recorded as a project decision (decision #1) but not confirmed by the data owner (`A-05`). Closed by WBS 9.1, before the pilot loads real data ([06](06-production-readiness.md)).
- **Browsers and phones**: the end-to-end tests run only in desktop Chromium (`playwright.config.ts`). Not in any work package yet; pilot members will use their own browsers in WBS 9.2, and problems they report go into the pilot log.
- **Build versus buy**: no market scan was done. Closed by WBS 1.4.

## 4. MVP scope

The MVP is phase 1 as defined in [01 §6](01-requirements-and-ca.md): `R-01` … `R-19`, `R-30`, `NFR-01` … `NFR-03` and `NFR-05` … `NFR-07`. Of these, `R-12`, `R-13`, `R-14`, `R-19`, `NFR-01` and `NFR-06` are **(W6, unmerged)**, so the MVP is not complete on `dev` until pull request #16 (open, not merged as of 2026-10-07) is merged.

Not part of the MVP:

- Phase 2, `R-20` … `R-29`, blocked by gate G1 ([00 §3](00-process-status.md)).
- `R-31` (self sign-up with approval; deferred by decisions #42 and #46) and `NFR-04` (English/Vietnamese switch; decision #48): unscheduled until after G1 unless the sponsor asks earlier (WBS 8.3 and 8.2).

## 5. MVP acceptance criteria

The MVP counts as accepted only when every criterion below is met **on the public deployment with real users**. Thresholds in *italics* are proposals for the sponsor to confirm. As of 2026-10-07 nothing has been verified on the public deployment with real users, so no criterion is met.

| ID | Criterion | How it is checked | Threshold | Status |
|---|---|---|---|---|
| MVP-01 | An Admin can do the core jobs end to end on the public deployment: organisation and catalogue upkeep, account set-up, import, export, data-quality review, e-mail history (`R-01`…`R-04`, `R-14`…`R-16`; WBS 9.1, 9.2) | The admin performs each job on the public URL during the pilot; problems go into the pilot log | *Every job completes without developer help* | Not met — the public URL builds from `main`, which has only a placeholder Dashboard and no week 6 |
| MVP-02 | A Manager can follow their teams: records, Dashboard with ranking, data quality, the weekly and monthly e-mails (`R-05`…`R-14`, `NFR-02`; WBS 9.2) | The pilot team's manager uses these screens in pilot weeks 1 and 2 | *All screens used without help; no wrong data reported* | Not met — not deployed (weeks 5–6 not on `main`); covered locally by `e2e/dashboard.spec.ts` and `e2e/notifications.spec.ts` only |
| MVP-03 | A Member can add and update their own certificate with evidence and see its status (`R-05`…`R-08`; WBS 9.2) | Pilot members do it on the public URL | See MVP-09 | Partly met — works locally in `e2e/records.spec.ts`; not tried by a real member on the public deployment |
| MVP-04 | Legacy data imports cleanly (`SM-2`, `R-15`; WBS 1.3) | Import the pilot team's real file; record rows imported, error rows and manual fixes | `SM-2`: zero unresolved error rows after cleaning — *proposed numeric target* | Not met — the real file has not been tried |
| MVP-05 | The weekly e-mail works (`SM-3`, `R-12`, `NFR-06`; WBS 9.1, 9.2) | Settings history for two consecutive Mondays ([runbook](../deploy/cron-email.md) §8) | `SM-3`: Sent > 0 and Failed = 0 on both Mondays | Not met — week 6 not merged; sending domain not verified; no e-mail sent through Resend |
| MVP-06 | Navigation feels immediate (`SM-4`, `NFR-03`; WBS 8.1) | Signed-out pages: the method in [02](02-wbs.md) §4. Signed-in pages cannot be measured that way; their method is defined in WBS 8.1 (*proposed*: browser navigation timings over at least 20 navigations per role, 75th percentile) | `SM-4`: feedback at once and 75th-percentile page load under 1 second — *proposed* | Not met — WBS 8.1 not started; signed-in pages not measured |
| MVP-07 | Security holds in operation (`R-17`, `NFR-01`, `NFR-02`) | pgTAP RLS tests green in CI; the service-role client imported only by the cron routes (lint rule); secrets set only in Vercel environment variables, none in the repository | All three true for the release in production | Partly met — the RLS tests run in CI; the service-role lint rule is part of week 6 (W6, unmerged); nothing records that the production environment variables for week 6 are set |
| MVP-08 | Accessibility baseline (`NFR-05`; WBS 8.4) | `src/app/tokens.test.ts` (contrast) in `pnpm test`; keyboard and screen-reader audit | Contrast tests green; *no blocking issue left from the audit* | Partly met — contrast tests exist and run in CI; the audit has not been done |
| MVP-09 | Usability: pilot members manage on their own (`A-03`; WBS 9.2) | Observe members adding a record with evidence, as planned for `A-03` in [01 §7](01-requirements-and-ca.md) | *At least two observed members add a record and evidence without help* | Not met — no observation yet |
| MVP-10 | Adoption: the pilot team stops using its spreadsheet (`SM-1`, `A-01`; WBS 9.2, gate G1) | Sponsor and admin confirmation after the pilot | `SM-1`: spreadsheet no longer updated after at least two consecutive weeks of real use — *proposed period* | Not met — no pilot yet |

## 6. Pilot plan: two weeks with one real team (WBS 9.2)

*Proposed. Dates are set when the preconditions are met; nothing below is scheduled yet.* The pilot provides the evidence for G1 condition 2 ([00 §3](00-process-status.md)). It follows the UAT steps in the [e-mail runbook](../deploy/cron-email.md) (last section) and does not repeat them.

### Preconditions

All preconditions are met before week 0, except the account creation in precondition 7, which happens in week 0. Preconditions 1, 2, 5, 6 and 7 together are WBS 9.1 (pilot readiness) and correspond to the items marked `Pilot` in [06](06-production-readiness.md); preconditions 3 and 4 are WBS 8.1 and 1.3. WBS 9.2 (this pilot) depends on 9.1, 1.3 and 8.1.

1. Week 6 is merged (pull request #16), the release reaches `main`, and all migrations are pushed to the cloud database (WBS 9.1).
2. The sending domain is verified on Resend, the production environment variables are set, and a test e-mail has been delivered (WBS 9.1; decision #40 requires the domain before any UAT).
3. WBS 8.1 is done, or at least every page shows loading feedback.
4. The pilot team's real file has been tried (WBS 1.3, for example on a local database) and the result recorded.
5. A backup of the cloud database can be taken and has been taken once: the deployment notes say not to load real personal data until backups exist ([deployment notes](../deploy/task9-free-tier.md), warning at the top; Supabase Free has no automatic backups). One restore into a separate project has been tried (WBS 9.1).
6. The data owner has agreed that the team's names, work e-mails and certificates may be stored in the cloud service (`A-05`; WBS 9.1).
7. The account procedure is ready; the accounts themselves are created in week 0, right after the import, because a login needs its member record. Self sign-up does not exist (decision #12): the admin creates each login in the Supabase dashboard as in the deployment notes (section B4). A new login is linked automatically to the member record with the same e-mail, so the members must be imported first; Manager roles are set in the database and the manager is assigned to the team on the Organisation page (WBS 9.1).

### Participants and roles

| Role | Who | In the pilot |
|---|---|---|
| Pilot team | One team with its manager and members (the runbook suggests 5–15 people) | Use CertTracker instead of the spreadsheet for their own records |
| Admin | The person who administers the data | Import, accounts, data-quality clean-up, reads the e-mail history |
| Sponsor | The manager who commissioned CertTracker | Chooses the team, attends the end-of-pilot review, decides the outcome |
| Owner | The developer | Set-up, dry runs, measurements, pilot log, fixes, pilot report |

No names are recorded in this document.

### Week 0 — set-up (the week before the first pilot Monday)

- Admin imports the team's file into the public deployment, using what the WBS 1.3 trial showed, and checks a sample of rows against the original.
- Admin and manager review the Data quality page and fix what they can; the owner writes down the count per issue type.
- Admin creates the accounts (precondition 7); the owner checks that each person can sign in.
- Owner runs both cron routes with `?dryRun=1` ([runbook](../deploy/cron-email.md) §5): the recipient list must match the team and `undeliverable` must be empty. If the expiry alert shows `planned: 0`, nobody in the team has a certificate in the alert window (decision #37) and the pilot cannot show `SM-3` for this team; the sponsor then picks another team or accepts that `SM-3` stays open.
- Short kick-off (proposed 30 minutes) with the team: what to update, where to report problems, and that the spreadsheet stays available as a fallback for the whole pilot while new changes are recorded in CertTracker first.

### Week 1

- **Monday:** the expiry-alert e-mail goes out at about 08:00 (Vercel Hobby may run it up to about an hour late; runbook §4). The admin checks the Settings history the same day.
- **During the week:** members update their own progress and add evidence; the manager reviews the team's records and the Dashboard; the owner observes two members adding a record with evidence (`A-03`, MVP-09).
- **Mid-week check-in** (proposed 15 minutes, owner and manager): problems so far, anything blocking.
- **End of week:** the owner records the measurements below.

### Week 2

- **Monday:** the second expiry-alert e-mail; the admin checks the history again (`SM-3` needs both Mondays).
- If the 1st of a month falls inside the pilot, the monthly report is checked the same way.
- **During the week:** normal use; new changes are still recorded in CertTracker first, and the manager notes whether the spreadsheet still had to be updated (`SM-1`).
- **End of week:** survey, interviews, measurements, pilot report.

### What is measured

Only what the application or a simple log can provide:

| Measure | Source | Feeds |
|---|---|---|
| E-mails sent, failed, in flight and stale per period, with the last error and the last activity | Settings → e-mail history ([runbook](../deploy/cron-email.md) §5 and §8). The number **planned** is not shown there: it comes from the JSON response of a cron run or dry run, and from that run's `cron-run` line in the Vercel logs ([runbook](../deploy/cron-email.md) §4–§5). A run with nothing to send writes no row (decision #37) | `SM-3`, `A-02` |
| Records created by members, by managers and by the admin | `training_records.created_by` (the application stores who **created** a record). It is visible only through a database query: the developer runs a read-only query in the Supabase SQL editor at the end of each pilot week | `A-03` |
| Records changed during the pilot | `training_records.updated_at` and `progress_updated_at`. The application does **not** store who last changed a record, so "changed by the member, a manager or the admin" comes from the survey and from the manager's and admin's own notes of edits made on members' behalf | `A-03` |
| Data-quality findings per issue type at the start of weeks 0, 1 and 2 and at the end of the pilot | Data quality page (shows the current state only; the owner copies the counts into the pilot log) | `SM-2` follow-up |
| Page-load times | Signed-out pages: the method in [02](02-wbs.md) §4; signed-in pages: the method defined in WBS 8.1. One run per pilot week is a spot check, not a 75th percentile | `SM-4` |
| Issues raised | Pilot log: date, role of the reporter, page, description, severity, action | Pilot report |

### Feedback

- **Survey** at the end of week 2 (proposed format: short written answers; questions 2, 3, 6 and 10 also ask for a yes/no):
  1. Before the pilot, how did you keep track of certificates, and what went wrong last time? (`A-01`)
  2. Did you receive both Monday e-mails, did you read them, and was anything wrong or missing? (`A-02`)
  3. Did you update your own progress and evidence yourself? If not, why not? (`A-03`)
  4. Admin only: how much manual fixing did the import need? (`A-04`)
  5. Are you comfortable with your name, work e-mail and certificate files being stored in this service? (`A-05`; the data owner's approval is separate)
  6. Is it right that only managers and admins see the personal ranking? (`A-06`)
  7. Which interface language do you prefer: Vietnamese with English technical terms, or a switch? (`A-07`)
  8. Managers only: which of the proposed AI features would you actually use, in order? (`A-08`)
  9. Admin only: how many members and certificate records does your unit have? (`A-09`)
  10. Would you stop using the spreadsheet? What is still missing? (`SM-1`)
- **Interviews** at the end of the pilot, following the interview plan in [01 §7](01-requirements-and-ca.md): about 30 minutes each, 3–5 people (one manager, one admin, two or three members). Answers are recorded per assumption ID. The mid-week check-in is separate and shorter (*proposed*, see Week 1).
- `A-10` (SkillMatrix) is not a pilot question: the sponsor confirms it with the SkillMatrix owner.

### Fallback and rollback

The spreadsheet stays available as a fallback for the whole pilot; the team is asked to record new changes in CertTracker first. Rolling back means the team keeps using the spreadsheet; nothing in the pilot deletes or changes it.

### Exit

The owner writes a pilot report (measurements, survey results, interview notes per assumption, issues and fixes) and presents it to the sponsor. It feeds gate G1 ([00 §3](00-process-status.md)). The sponsor chooses one outcome:

- **Continue to G1** — the criteria in §5 are met (or the sponsor records which gaps are accepted and why), and the team confirms it replaces the spreadsheet.
- **Fix and repeat** — specific problems must be fixed first, then the pilot is repeated.
- **Stop or re-scope** — the need is weaker than assumed.

The decision is recorded in [decisions.md](../decisions.md).

## 7. Risks during the pilot

| Risk | Mitigation |
|---|---|
| Supabase Free pauses the project after 7 idle days (decision #13), for example between set-up and the first pilot Monday | Start the pilot within a week of set-up; the owner checks the project status before each Monday and restores it if paused (deployment notes, troubleshooting table) |
| E-mails land in spam or are rejected (an unverified domain only delivers to the Resend account owner; decision #40) | Verify SPF and DKIM (DMARC recommended) before the pilot ([runbook](../deploy/cron-email.md) §1); ask recipients to check spam after the first Monday; failures show in Settings |
| Pages feel slow and members give up | WBS 8.1 first (precondition 3); measure each pilot week; record complaints in the pilot log |
| Members do not update their own records (`A-03`) | Short kick-off, a reminder from the manager at the mid-week check-in; the counts in "What is measured" show whether it happened |
| Questions about personal data in a cloud service; Supabase Free has no automatic backups | Data-owner agreement and a working backup before any real data is imported (preconditions 5 and 6); the spreadsheet stays the fallback |
| Vercel Hobby is for non-commercial use (decision #13) | The sponsor decides whether an internal pilot is acceptable on Hobby; the hosting decision is WBS 9.3 |
