# Work Breakdown Structure (WBS)

- **Status:** Draft v5 — re-cut around the Cert Core release (decision #59); pilot before AI (decision #61)
- **Last updated:** 2026-11-07
- **Owner:** CertTracker team (DC34)
- **Sources:** BRD v3.0 (`exports/CertTracker-BRD-v3.0-2026-10-31.docx`, not in git), [decisions #50–#61](../decisions.md), `git log`, [Plans](../superpowers/plans/), [Requirements](03-requirements.md)

> **Tóm tắt (VI):** Cây công việc cắt lại theo **release Cert Core** (decision #59): phần đã chạy trên `main` và production là `Built`; `C0` duyệt phạm vi, `C1` tài khoản và danh mục khóa học, `C2` AI phục vụ chứng chỉ, `C3` kiểm chứng và go-live. Skill Matrix, mục tiêu theo quý, lộ trình role, phần AI còn lại và việc chuyển backend sang Rust nằm ở `Later`. Mã WBS giữ nguyên để các tài liệu 00/07/08 còn trỏ đúng; việc mới là 15 và 16. Theo decision #61, pilot với DAS (9.1, 9.2) đứng trước `C2` (AI), và ba tính năng giai đoạn 2 (15.4–15.6) làm trong lúc pilot chạy.

## 1. Purpose and how to read

This document lists the work done and the work remaining for CertTracker. The first release is **Cert Core**: the certificate features live on `main` and production, the accounts and catalogue they still need, and the AI that serves certificates (decision #59, which replaces the single release of decision #54). Everything else is `Later`.

- **WBS** codes keep their numbering because [00](00-process-status.md), [07](07-poc-and-mvp.md) and [08](08-production-readiness.md) cite them. Codes 15 and 16 are new.
- **Milestone** is the build order: `Built` (on `main` and production), `C0` to `C3` (§3), then `Later` (after Cert Core, not scheduled).
- **Priority** is the BRD priority (Must, Should, Could). Inside a milestone, Must items go first.
- **Est. (days)** is the developer's estimate in working days for one developer with AI-assisted development: ranges, not commitments. `—` means nothing left to do. Parent rows show the sum of their children.
- **Actual** is the calendar window from `git log` and merged pull requests. Effort in hours was not tracked, so none is claimed.
- **Status** is `Done` (built and tested by the build team, not validated by users), `In progress`, `Not started`, `Waiting` (on someone outside the build team) or `Out of scope`.
- **BRD trace** is the use case (UC), functional (FR) or non-functional (NFR) requirement in BRD v3.0. **Requirements** are the IDs in [03](03-requirements.md); each appears in at least one row.
- **G1** is the review after the pilot: the DC manager decides whether CertTracker is rolled out beyond the pilot team. It holds back only production readiness (9.4).

## 2. WBS

| WBS | Work package | Deliverable | Acceptance | Milestone | Priority | Est. (days) | Actual | Depends on | Status | BRD trace | Requirements |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Requirements and governance** | See 1.1–1.9 | — | — | — | 8–11 (sum) | — | — | In progress | — | — |
| 1.1 | Process documents (this pack) | `docs/process/00`–`08` aligned with decisions #50–#60 | Merged; `pnpm test` green | C0 | Should | 0.5–1 | 2026-10-05 → | — | In progress | Decisions #50–#54 | — |
| 1.2 | Discovery interviews | Notes per assumption | 4–5 people interviewed (1 manager, 1 admin, 2–3 members); CA statuses updated | C3 | Should | 2–3 | — | 1.1, 1.6 | Not started | — | — |
| 1.3 | Real-file trials | Trial report for the certificate file: rows imported, manual fixes (the Skill Matrix file moves to Later, with 11.7) | `SM-2` measured on the real files | C3 | Must | 1 | — | 5 | Not started | FR-05, FR-06 | R-15 |
| 1.4 | Build-vs-buy scan | One-page comparison: spreadsheet, company system, SkillMatrix, CertTracker | DC manager agrees building is still justified | C3 | Could | 1 | — | 1.1 | Not started | — | — |
| 1.5 | Mockup review with the DC manager | Answered review checklist ([06](06-design-and-mockups.md) §6), including the new screens | Answers recorded; decisions logged where needed | C0 | Should | 0.5 | 2026-10-07 (mockups drafted) | 1.1 | In progress | Appendix B | — |
| 1.6 | CA data collection | Baseline numbers and named contacts | DC manager and admin supplied them; CA updated | C3 | Should | 1–2 | — | 1.1 | Not started | BO-1–BO-3 | — |
| 1.7 | BRD approval for the Cert Core release | BRD revised for Cert Core and its AI (decision #59), then signed off | DC manager approves; review comments closed | C0 | Must | 0.5 | 2026-10-31 (v3.0 sent; revision for #59 pending) | — | Waiting | Whole BRD | — |
| 1.8 | Answers to the BRD open questions | AI budget and DeepSeek terms for C2; risk thresholds and the key-person rule wait for Later | Answers recorded in `decisions.md` | C0 | Must | 0.5 | — | 1.7 | Waiting | BRD §7 | — |
| 1.9 | Plans for the Cert Core release | One plan each for C1 and C2 | Plans in `docs/superpowers/plans/` | C0 | Must | 1–1.5 | — | 1.7 | Not started | Whole BRD | — |
| 2 | Foundation (W1) | Schema, RLS, sign-in, CI, free-tier deployment | PRs #1, #3, #4 merged; pgTAP RLS green | Built | Must | — | 2026-09-26 → 2026-09-27 | — | Done | FR-01, NFR-01 | R-07, R-17, R-30, NFR-07 |
| 2.5 | Design system | Tokens, components, `/design` page, reference doc | PR #6 merged | Built | Must | — | 2026-09-27 | 2 | Done | NFR-05 | NFR-05 |
| 2.6 | UI polish | Logo, favicon, sidebar brand mark, select fixes | PR #13 merged | Built | Should | — | 2026-10-02 | 2.5 | Done | NFR-05 | NFR-05 |
| 3 | Org and catalogue CRUD (W2) | Organisation, members, courses | PR #8 merged | Built | Must | — | 2026-09-29 → 2026-09-30 | 2 | Done | FR-02, FR-04 | R-01, R-02, R-03, R-04 |
| 4 | Training records (W3) | List, form, evidence upload, expiry badge, Realtime | PR #10 merged | Built | Must | — | 2026-09-30 → 2026-10-01 | 3 | Done | FR-08 | R-05, R-06, R-08, R-18 |
| 5 | Import / Export (W4) | Excel import with staging and preview; CSV/Excel export | PR #11 merged; real-file trial is 1.3 | Built | Must | — | 2026-10-01 | 4 | Done | FR-05 | R-15, R-16 |
| 6 | Dashboard (W5) | KPIs, breakdowns, ranking | PR #15 merged | Built | Must | — | 2026-10-04 | 4 | Done | FR-12 | R-09, R-10, R-11, NFR-02 |
| 7 | Cron, e-mail and data quality (W6) | Expiry alerts, monthly report, notification log, data-quality page | PR #16 merged into `main`; migrations pushed; cron returns 401 without the secret | Built | Must | — | 2026-10-04 → 2026-10-17 | 4, 6 | Done | FR-10, FR-12, NFR-06 | R-12, R-13, R-14, R-19, NFR-01, NFR-06 |
| 8 | **Cross-cutting improvements** | See 8.1–8.4 | — | — | — | 1.5–3 (sum, open) | — | — | In progress | — | — |
| 8.1 | Page-navigation performance | Loading feedback on every page; fewer auth calls (functions already moved to Tokyo, hnd1) | `SM-4` measured on production and recorded in §4 | C1 | Should | 0.5 | 2026-11-01 (code; production p75 pending) | — | In progress | NFR-03 | NFR-03 |
| 8.2 | English-first interface | Existing Vietnamese screens and e-mails rewritten in English; switch to Vietnamese later (decision #51) | No Vietnamese UI text left; e2e updated | Built | Must | — | 2026-11-05 (live) | 2 | Done | NFR-04 | NFR-04 |
| 8.3 | Self sign-up with approval | Not in Release 1 (BRD §1.3: the admin creates every account) | — | — | Could | — | — | — | Out of scope | — | R-31 |
| 8.4 | Accessibility check | Keyboard and screen-reader audit of the live screens; list of fixes | BRD Appendix B.2 items met | C3 | Must | 1–2 | — | 15.1 | Not started | NFR-05 | NFR-05 |
| 9 | **Validation and rollout** | See 9.1–G1 | — | — | — | 6–11 (sum) | — | — | Not started | — | — |
| 9.1 | Pilot readiness | Sending domain verified; first backup; DC manager agrees to staff data in the cloud | All `Pilot` items in [08](08-production-readiness.md) done; a test e-mail reaches a non-owner address | C1 | Must | 1–2 | — | 7 | Not started | FR-10, FR-11 | R-12, R-13 |
| 9.2 | Pilot with one real team | Two-week pilot ([07](07-poc-and-mvp.md) §6) and pilot report | `SM-3` met; feedback recorded | C1 | Must | 2–3 | — | 9.1, 8.1 | Not started | BO-1, BO-2 | R-12, R-13 |
| 9.3 | Production hosting decision | Stay on free tiers or move (Vercel Hobby is non-commercial; Supabase Free has no automatic backup) | Recorded in `decisions.md` before real staff data is loaded | C3 | Must | 1–2 | — | — | Not started | NFR-13 | NFR-07 |
| 9.4 | Production readiness | Production checklist completed; release checklist adopted | All `Production` items in 08 done; go decision recorded | C3 | Must | 2–4 | — | 9.3, G1 | Not started | NFR-13 | NFR-01, NFR-06, NFR-07 |
| G1 | Gate: pilot review | DC manager's decision to roll out beyond the pilot team | Pilot report accepted; no longer blocks any feature (decision #54) | C3 | Must | — | — | 1.2, 1.3, 1.6, 9.2 | Not started | BO-1 | — |
| 10 | **Platform changes** | See 10.1–10.3 | — | — | — | — | — | — | Done | — | — |
| 10.1 | Manager scope (team, program) | `manager_scopes` takes over from `team_managers`; RLS helpers; scope admin screen | pgTAP: each scope sees exactly its people; new teams included | Built | Must | — | 2026-11-05 (live) | 2 | Done | FR-02, BRD §4.1 | R-30 |
| 10.2 | Current role and YoE | Role (set by admin) and YoE (set by member) on the member record | Shown on the profile and in exports | Built | Must | — | 2026-11-05 (live) | 3 | Done | FR-03 | — |
| 10.3 | Course cost and study hours | Two new course fields in forms, import and export | Values editable and exported | Built | Must | — | 2026-11-05 (live) | 3 | Done | FR-04 | R-03 |
| 11 | **Skill Matrix** | See 11.1–11.7 | — | — | — | 14–20.5 (sum) | — | — | Not started | — | — |
| 11.1 | Skill list | Fields (incl. General), skills, sub-skills, shared skills, level scale 0–5; seeded from BRD Appendix A | Seed loads; admin can edit; one entry per shared skill | Later | Must | 2–3 | — | 10.1 | Not started | FR-14, UC-06 | — |
| 11.2 | Course–skill links | Link a course to skills and the level it proves; list of unlinked courses | Labels update when a link changes | Later | Must | 1–2 | — | 11.1 | Not started | FR-15, UC-06 | — |
| 11.3 | My skills | Choose fields; rate 0–4; Certified / Self-assessed labels; raise offer; level 5 by manager; manager review and send back | Rules of BRD §4.1 pass unit and pgTAP tests | Later | Must | 3–4 | — | 11.2 | Not started | FR-17, UC-07 | — |
| 11.4 | Skill Matrix view | DC × skills grid per field tab; filters; counts; key-person flag; Excel export in the old layout | 150 people × 500 skills opens in < 2 s; keyboard and screen-reader table | Later | Must | 3–4 | — | 11.3 | Not started | FR-20, UC-09 | — |
| 11.5 | Find people for a project | Search with several skill + minimum level conditions; Certified only; close matches | BRD example (Next.js ≥ 3, Rust ≥ 4) returns the right people | Later | Must | 2–3 | — | 11.3 | Not started | FR-21, UC-10 | R-23 |
| 11.6 | Review every 3 months | Rating history; reminder e-mail; Out of date mark; 3- or 12-month setting | Reminder sent once per cycle; history kept | Later | Should | 1–1.5 | — | 11.3 | Not started | FR-18, UC-07 | — |
| 11.7 | Skill Matrix import | One-time import of the old spreadsheet: ratings, YoE, conflicts flagged | Real file imported; conflicting ratings and YoE listed | Later | Should | 2–3 | — | 11.3 | Not started | FR-06, UC-02 | — |
| 12 | **Goals and courses** | See 12.1–12.3 | — | — | — | 7–10 (sum) | — | — | Not started | — | — |
| 12.1 | Quarterly certificate goals | Goal per scope; Q1–Q4 targets; people (default) or certificates; team shares; status | BRD example (50 AI certificates by Q3 2027) shows each team's share | Later | Must | 3–4 | — | 10.1, 11.2 | Not started | FR-23, UC-11 | — |
| 12.2 | Pick or assign a course | "Join this goal" for members; assignment by managers with e-mail; state per course | Picked and assigned courses count towards the goal | Later | Must | 2–3 | — | 12.1 | Not started | FR-25, UC-12 | — |
| 12.3 | Exam reminders, risk levels, key-person alerts | Reminder 14 days before the exam; Low / Medium / High risk; key-person expiry warning | UC-04 rules pass tests; no duplicate e-mails | Later | Should | 2–3 | — | 12.2, 11.4 | Not started | FR-11, UC-04 | R-24 |
| 13 | **AI** | See 13.1–13.10 | — | — | — | 15.5–23 (sum; C2 10–15) | — | — | Not started | — | — |
| 13.1 | AI platform | Provider-agnostic client (OpenAI-compatible), DeepSeek config, name masking, usage log, daily limit, on/off per feature, admin view | Every use case works with AI off; no names sent; cost logged | C2 | Must | 3–4 | — | 1.8 | Not started | FR-31, NFR-07–NFR-12 | R-27, R-28, R-29 |
| 13.2 | AI reads certificate files | PDF or image → filled form with course match; AI fields marked | ≥ 80% of fields right on 30 real certificates (proposed) | C2 | Must | 2–3 | — | 13.1 | Not started | FR-09, UC-03 | R-22 |
| 13.3 | AI goal plan | Who could study what and in which quarter, with cost and refund; manager edits and confirms | Plan uses only app data; nothing saved without confirmation | Later | Must | 2–3 | — | 13.1, 12.2 | Not started | FR-24, UC-11 | R-21 |
| 13.4 | AI suggests course–skill links | Suggested skills and level per course, with a reason | Admin accepts, changes or dismisses each | Later | Should | 1–1.5 | — | 13.1, 11.2 | Not started | FR-16, UC-06 | — |
| 13.5 | AI clean-up of imports | Groups look-alike course names; suggests type and provider | Admin confirms each change in the preview | C2 | Should | 1–2 | — | 13.1 | Not started | FR-07, UC-02 | R-22 |
| 13.6 | AI suggests the next certificate | Up to 3 certificates with reason, hours, cost and refund | Only courses in the list; add to plan in one click | Later | Should | 1.5–2 | — | 13.1, 11.3 | Not started | FR-19, UC-08 | R-20 |
| 13.7 | AI answers questions | A fixed set of questions about certificates, answered with the number and a link | Numbers match the dashboard | C2 | Should | 2–3 | — | 13.1 | Not started | FR-30, UC-15 | R-26 |
| 13.8 | AI evaluation and cost check | Test set per AI feature; monthly cost estimate | Each feature passes its test set; cost within budget | C2 | Must | 1–2 | — | 13.2, 13.5 | Not started | NFR-11 | — |
| 13.9 | AI turns a project description into conditions | Suggested conditions and one line per person | Manager checks them before the search runs | Later | Could | 1–1.5 | — | 13.1, 11.5 | Not started | FR-22, UC-10 | R-23 |
| 13.10 | AI summary in the monthly report | 3–5 sentences built from app numbers | Left out when the numbers do not match | C2 | Could | 1 | — | 13.1 | Not started | FR-13, UC-05 | R-25 |
| 14 | **Growth** | See 14.1–14.4 | — | — | — | 4.5–7 (sum) | — | — | Not started | — | — |
| 14.1 | Roles and role criteria | Ordered roles; skills with minimum levels, certificates, text criteria; written by the admin | Criteria for the 4 roles entered | Later | Must | 1.5–2 | — | 11.1 | Not started | FR-26, UC-13 | — |
| 14.2 | My next role | Criteria met / not yet; link to my plan | Matches the member's ratings and certificates | Later | Must | 1–2 | — | 14.1 | Not started | FR-27, UC-13 | — |
| 14.3 | AI learning path | Gap explained; ordered steps with a rough timeline | Never says whether someone is ready for promotion | Later | Should | 1–1.5 | — | 14.2, 13.1 | Not started | FR-28, UC-13 | — |
| 14.4 | Team progress towards a role | Criteria met and missing per member in scope; no scores | Only people within the manager's scope | Later | Could | 1–1.5 | — | 14.2 | Not started | FR-29, UC-14 | — |
| 15 | **Cert Core accounts and data** | See 15.1–15.6 | — | — | — | 2–2.5 (sum of 15.1–15.3; 15.4–15.6 not estimated yet) | — | — | In progress | — | — |
| 15.1 | Account set-up by e-mail | Admin invites from the Supabase Dashboard; the member sets a password through the e-mailed link; same link type for a new password | e2e: invite, set password, sign in; a used link is refused. Dashboard templates and SMTP set on production | C1 | Must | 1–1.5 | 2026-11-05 → | 2 | In progress | FR-01 | R-17 |
| 15.2 | Change access in the app | Admin sets Admin, Manager or Member in the member form; new accounts start as Member | e2e: role change takes effect; own access cannot be changed | C1 | Must | 0.5 | 2026-11-05 → | 15.1 | In progress | FR-01 | R-17 |
| 15.3 | Course catalogue | Script loads 55 courses by name, each value checked against official sources (`supabase/catalog/SOURCES.md`); safe to run again | Local run twice adds no duplicates; loaded on production | C1 | Must | 0.5 | 2026-11-05 | 3 | Done | FR-04 | R-03 |
| 15.4 | Submit and approve (Phase 2) | A Completed certificate waits for the manager in scope or the admin, who approves it or returns it with a note; only approved certificates count in the dashboard, reports and e-mails; the export gets an Approval column (spec 2026-11-06 §10.1) | pgTAP approval tests and e2e E-11, E-12, E-15 (spec §10.4); every existing Completed certificate becomes Approved | C1 | Should | — | — | 15.1 | Not started | Feature List v2.1 §A | R-05, R-06 |
| 15.5 | Chosen field (Phase 2) | A member picks the certificate type they want to grow in, on `/me`; the admin can set it, a manager sees it read-only (spec §10.2) | pgTAP chosen-field tests and e2e E-13 (spec §10.4) | C1 | Should | — | — | 15.1 | Not started | Feature List v2.1 §A | R-01 |
| 15.6 | Numbers by month or quarter (Phase 2) | A period picker on the dashboard: people newly certified, new certificates and new certificates per type for the chosen month or quarter, plus a waiting-for-approval count (spec §10.3) | pgTAP period tests and e2e E-14 (spec §10.4) | C1 | Should | — | — | 15.1 | Not started | Feature List v2.1 §A | R-09, R-10 |
| 16 | Backend moves to Rust | Direction only, after Cert Core has real users (decision #59); needs its own spec, starting with auth | Not estimated | Later | Could | — | — | 9.4 | Not started | — | — |

## 3. Summary

| Milestone | Content | Est. (days) | Cumulative (weeks, upper end) |
|---|---|---|---|
| Built | On `main` and production (https://cert-tracker-three.vercel.app): W1–W6 certificates, plus manager scopes, career role and YoE, course cost, English UI, loading feedback | — | — |
| C0 | Scope: BRD revised and approved, AI budget and terms answered, mockups reviewed, plans | 3–4 | 0.8 |
| C1 | Accounts and data, then the DAS pilot (decision #61): e-mail set-up, access control, catalogue, production speed check, pilot readiness and the two-week pilot; Phase 2 features 15.4–15.6 are built during the pilot (not yet estimated) | 5.5–8 (without 15.4–15.6) | 2.4 |
| C2 | Certificate AI: platform, reading certificate files, import clean-up, questions, monthly summary, evaluation | 10–15 | 5.4 |
| C3 | Validate and go live: hosting, real-file trial, accessibility, interviews, G1, production | 9–15 | 8.4 |
| Later | Skill Matrix, quarterly goals, the AI that needs them, role growth, Rust backend | 31–45.5 | Not scheduled |

- **Cert Core open work:** 27.5–42 developer days (about 6–8 weeks for one developer). The pilot (9.2) also needs two calendar weeks of real use.
- **Production today:** the code is live, but the cloud database holds 2 members, no courses and no certificates (checked 2026-11-05), so no user has validated it yet.
- **Before real staff data:** 9.1 (sending domain, backup, data owner's agreement) and 15.1 must be done, and the free-tier choice for the pilot period is recorded (spec §8 item 1); 9.3 is the later decision on real hosting.
- **Pilot order (decision #61):** the DAS pilot (9.1, 9.2) runs in `C1`, before the AI (`C2`). So that no `C1` row waits for a later milestone, 9.1 no longer depends on 9.3 and 9.2 no longer depends on 1.3: for the pilot period the hosting question is answered by spec 2026-11-06 §8 item 1 (stay on the free tiers; paid hosting is decided afterwards, which is 9.3), and 1.3 is measured on the file DAS imports (`SM-2`) and keeps its `C3` report.
- **Waiting:** 1.7 and 1.8 wait on the DC manager. 13.1 cannot send real data to DeepSeek before 1.8 is answered; it can be built and tested with sample data.
- **Moved to Later because they need the Skill Matrix or goals:** 13.3, 13.4, 13.6, 13.9. 12.3 (exam reminders) also moves; say if exam reminders should come back into Cert Core.

## 4. Performance measurements (work package 8.1)

Read-only spike on 2026-10-05, signed-out requests only:

| Item | Result |
|---|---|
| `/login` (cached, Singapore edge) | 0.26–0.45 s; 1.2–1.9 s on a cold connection |
| Redirect for a signed-out user | About 0.25 s |
| Signed-in pages | Not measured (needs a session); suspected cause of slowness: functions far from the database |
| Supabase region | Tokyo in the deployment notes, which also mention Singapore; to confirm in the Supabase dashboard |
| Sequential Supabase calls per navigation | At least 3 (proxy session check, layout session and profile read, page query), from the code |
| Pages with a loading state | Dashboard only, on `dev`; none on `main`, which the public deployment builds from |

### After 8.1 (M1 Task 8, 2026-11-01)

The production URL cannot be reached from the feature branch, so the signed-in pages were measured on a **local production build** (`pnpm build`, `pnpm start`) against the local Supabase stack. The local database is not the seed (58 courses and extra records), the server and database are on the same machine, and the pages are Chromium on one laptop: the numbers show the *direction* of the change and are **not comparable** with production. Method: signed in as the seed manager (admin for Organisation, Import / Export and Settings; the seed member for My certificates), each page opened 10 times by a click on its sidebar link from another page, 75th percentile (nearest rank). "Content" is the time from the click until the page heading shows; "feedback" is the time until the first thing shows (the skeleton, or the heading when the page has no skeleton). The original production figures above stay as they are; a production run is still to be done after deployment.

| Page | Before: feedback | Before: content | After: feedback | After: content | Server time (RSC response end) before to after |
|---|---|---|---|---|---|
| Dashboard | 80 | 397 | 30 | 339 | 157 to 89 |
| My certificates | 174 | 174 | 30 | 335 | 149 to 102 |
| Members | 180 | 180 | 30 | 332 | 161 to 86 |
| Records | 171 | 171 | 30 | 334 | 153 to 91 |
| Data quality | 30 | 332 | 30 | 332 | 162 to 103 |
| Courses | 170 | 170 | 31 | 335 | 151 to 93 |
| Organisation | 170 | 170 | 30 | 332 | 167 to 112 |
| Import / Export | 152 | 152 | 30 | 332 | 166 to 86 |
| Settings | 183 | 183 | 30 | 333 | 169 to 85 |

All values are local prod build, p75 in ms. The last column isolates the auth change: "before" is the same build with the proxy's `getUser()` restored, "after" is the committed code.

- **Feedback** now appears about 30 ms after the click on every page (it was 150 to 180 ms where the page had no skeleton), and the top bar starts at the click.
- **Content** on pages whose data arrives in under 300 ms now shows at about 330 ms, not at 150 to 180 ms. This is React: once a Suspense fallback (the `loading.tsx` skeleton) has been shown, React holds the reveal of the content until 300 ms after the fallback (`FALLBACK_THROTTLE_MS`), to avoid a flash. The server answers in 85 to 112 ms (down from 150 to 170 ms because the second auth round trip is gone); the rest is that throttle. On production the pages are expected to take longer than 300 ms to produce, so the throttle is expected to cost nothing there (confirm with the production run); it only matters on this fast local setup.
- No page is above 1 s, so there is no follow-up item from this run. The production run after deployment decides whether `SM-4` is met.


### Auth calls per page view (Cert Core Phase 1, task 9, 2026-11-07)

Spec §5.5 asked whether the `loading.tsx` files make each sidebar link prefetch cost an Auth call. Measured with `scripts/count-auth-calls.mjs` on a local production build (`pnpm build`, `next start -p 3101`) against the local Supabase stack, signed in as the seed admin, one full load per page plus 3 s for link prefetches. The build ran with `NEXT_PUBLIC_SUPABASE_URL` pointing at the script's counting proxy, so calls from the Next server are counted too.

| Page | Link prefetches in the window | Auth `/auth/v1/user` calls from the browser | from the Next server |
|---|---|---|---|
| `/dashboard` | 15 | 0 | 1 |
| `/records` | 15 | 0 | 1 |
| `/members` | 15 | 0 | 1 |

Rule was "more than 2 per page view means `prefetch={false}`": 1 is within it, so the sidebar links are unchanged. Limit: the local project verifies JWTs locally (`getClaims()`), while a symmetric (HS256) project would add one call per proxy check; on production check the JWT signing-key type or the Auth logs after the first deploy (the script cannot see server calls there; see `docs/deploy/accounts-and-catalogue.md`). Full loads only, not client-side clicks.

## 5. Open points (to be confirmed)

- All estimates, confirmed by the developer and the DC manager
- The four open questions of BRD §7: AI budget, DeepSeek terms, risk thresholds, key-person rule (`1.8`)
- The acceptance threshold for reading certificates with AI (≥ 80% of fields on 30 real certificates is a proposal) (`13.2`)
- Which team runs the pilot, and when (`9.2`)
- Who collects the CA data and when (`1.6`)
- Whether the hosting decision comes before or after G1 (`9.3`)
