# Work Breakdown Structure (WBS)

- **Status:** Draft v3 — rebuilt for Release 1 as defined in BRD v3.0
- **Last updated:** 2026-10-31
- **Owner:** CertTracker team (DC34)
- **Sources:** BRD v3.0 (`exports/CertTracker-BRD-v3.0-2026-10-31.docx`, not in git), [decisions #50–#54](../decisions.md), `git log`, [Plans](../superpowers/plans/), [Requirements](03-requirements.md)

> **Tóm tắt (VI):** Cây công việc cho **Release 1** theo BRD v3.0: mọi tính năng (chứng chỉ, Skill Matrix, mục tiêu, lộ trình role, AI) nằm trong một release (decision #54). Mã 1–9 giữ nguyên để các tài liệu 00/07/08 còn trỏ đúng; phần việc mới là 10–14. Các mốc M0–M6 xếp thứ tự làm. Ước lượng là khoảng ngày công cho 1 developer, không phải cam kết. Còn khoảng 62–94 ngày công (12–19 tuần), cộng 2 tuần chạy pilot. G1 giờ chỉ là bước duyệt sau pilot, không chặn tính năng nào. Bản Excel cùng nội dung: `exports/CertTracker-WBS-v1.1-2026-10-31.xlsx`.

## 1. Purpose and how to read

This document lists the work done and the work remaining for CertTracker Release 1. Release 1 is everything in BRD v3.0: what is live today (certificates) and what is still to build (Skill Matrix, goals and courses, growth, AI). There is no Release 2 or 3 (decision #54).

- **WBS** codes 1–9 and G1 keep the numbering that [00](00-process-status.md), [07](07-poc-and-mvp.md) and [08](08-production-readiness.md) cite. Codes 10–14 are the new work from BRD v3.0.
- **Milestone** is the build order: `Built` (live), then M0 to M6 (§3).
- **Priority** is the BRD priority (Must, Should, Could). Inside a milestone, Must items go first.
- **Est. (days)** is the developer's estimate in working days for one developer with AI-assisted development: ranges, not commitments. `—` means nothing left to do. Parent rows show the sum of their children.
- **Actual** is the calendar window from `git log` and merged pull requests. Effort in hours was not tracked, so none is claimed.
- **Status** is `Done` (built and tested by the build team, not validated by users), `In progress`, `Not started`, `Waiting` (on someone outside the build team) or `Out of scope` (not in Release 1).
- **BRD trace** is the use case (UC), functional (FR) or non-functional (NFR) requirement in BRD v3.0. **Requirements** are the IDs in [03](03-requirements.md); each appears in at least one row.
- **G1** is now the review after the pilot: the DC manager decides whether CertTracker is rolled out beyond the pilot team. It no longer blocks any feature (decision #54 replaces the gate of decision #46).

## 2. WBS

| WBS | Work package | Deliverable | Acceptance | Milestone | Priority | Est. (days) | Actual | Depends on | Status | BRD trace | Requirements |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Requirements and governance** | See 1.1–1.9 | — | — | — | 8.5–12 (sum) | — | — | In progress | — | — |
| 1.1 | Process documents (this pack) | `docs/process/00`–`08` aligned with decisions #50–#54 | Merged; `pnpm test` green | M0 | Should | 0.5–1 | 2026-10-05 → | — | In progress | Decisions #50–#54 | — |
| 1.2 | Discovery interviews | Notes per assumption | 4–5 people interviewed (1 manager, 1 admin, 2–3 members); CA statuses updated | M6 | Should | 2–3 | — | 1.1, 1.6 | Not started | — | — |
| 1.3 | Real-file trials | Trial report for the certificate file and the Skill Matrix file: rows imported, manual fixes | `SM-2` measured on the real files | M6 | Must | 1 | — | 5, 11.7 | Not started | FR-05, FR-06 | R-15 |
| 1.4 | Build-vs-buy scan | One-page comparison: spreadsheet, company system, SkillMatrix, CertTracker | DC manager agrees building is still justified | M6 | Could | 1 | — | 1.1 | Not started | — | — |
| 1.5 | Mockup review with the DC manager | Answered review checklist ([06](06-design-and-mockups.md) §6), including the new screens | Answers recorded; decisions logged where needed | M0 | Should | 0.5 | 2026-10-07 (mockups drafted) | 1.1 | In progress | Appendix B | — |
| 1.6 | CA data collection | Baseline numbers and named contacts | DC manager and admin supplied them; CA updated | M6 | Should | 1–2 | — | 1.1 | Not started | BO-1–BO-3 | — |
| 1.7 | BRD v3.0 approval | Signed-off BRD v3.0 | DC manager approves; review comments closed | M0 | Must | 0.5 | 2026-10-31 (v3.0 sent) | — | Waiting | Whole BRD | — |
| 1.8 | Answers to the BRD open questions | AI budget, DeepSeek terms, risk thresholds, key-person rule | Answers recorded in `decisions.md` | M0 | Must | 0.5 | — | 1.7 | Waiting | BRD §7 | — |
| 1.9 | Design spec and plans for the new scope | Spec update and one plan per milestone M1–M5 | Plans in `docs/superpowers/plans/` | M0 | Must | 1.5–2.5 | — | 1.7 | Not started | Whole BRD | — |
| 2 | Foundation (W1) | Schema, RLS, sign-in, CI, free-tier deployment | PRs #1, #3, #4 merged; pgTAP RLS green | Built | Must | — | 2026-09-26 → 2026-09-27 | — | Done | FR-01, NFR-01 | R-07, R-17, R-30, NFR-07 |
| 2.5 | Design system | Tokens, components, `/design` page, reference doc | PR #6 merged | Built | Must | — | 2026-09-27 | 2 | Done | NFR-05 | NFR-05 |
| 2.6 | UI polish | Logo, favicon, sidebar brand mark, select fixes | PR #13 merged | Built | Should | — | 2026-10-02 | 2.5 | Done | NFR-05 | NFR-05 |
| 3 | Org and catalogue CRUD (W2) | Organisation, members, courses | PR #8 merged | Built | Must | — | 2026-09-29 → 2026-09-30 | 2 | Done | FR-02, FR-04 | R-01, R-02, R-03, R-04 |
| 4 | Training records (W3) | List, form, evidence upload, expiry badge, Realtime | PR #10 merged | Built | Must | — | 2026-09-30 → 2026-10-01 | 3 | Done | FR-08 | R-05, R-06, R-08, R-18 |
| 5 | Import / Export (W4) | Excel import with staging and preview; CSV/Excel export | PR #11 merged; real-file trial is 1.3 | Built | Must | — | 2026-10-01 | 4 | Done | FR-05 | R-15, R-16 |
| 6 | Dashboard (W5) | KPIs, breakdowns, ranking | PR #15 merged | Built | Must | — | 2026-10-04 | 4 | Done | FR-12 | R-09, R-10, R-11, NFR-02 |
| 7 | Cron, e-mail and data quality (W6) | Expiry alerts, monthly report, notification log, data-quality page | PR #16 merged into `main`; migrations pushed; cron returns 401 without the secret | Built | Must | — | 2026-10-04 → 2026-10-17 | 4, 6 | Done | FR-10, FR-12, NFR-06 | R-12, R-13, R-14, R-19, NFR-01, NFR-06 |
| 8 | **Cross-cutting improvements** | See 8.1–8.4 | — | — | — | 3.5–6 (sum) | — | — | Not started | — | — |
| 8.1 | Page-navigation performance | Loading feedback on every page; fewer auth calls (functions already moved to Tokyo, hnd1) | `SM-4` met, measured before and after (§4) | M1 | Should | 0.5–1 | Diagnosed 2026-10-05 | — | Not started | NFR-03 | NFR-03 |
| 8.2 | English-first interface | Existing Vietnamese screens and e-mails rewritten in English; switch to Vietnamese later (decision #51) | No Vietnamese UI text left; e2e updated | M1 | Must | 2–3 | — | 1.9 | Not started | NFR-04 | NFR-04 |
| 8.3 | Self sign-up with approval | Not in Release 1 (BRD §1.3: the admin creates every account) | — | — | Could | — | — | — | Out of scope | — | R-31 |
| 8.4 | Accessibility check | Keyboard and screen-reader audit of old and new screens; list of fixes | BRD Appendix B.2 items met | M6 | Must | 1–2 | — | 11.4, 12.1 | Not started | NFR-05 | NFR-05 |
| 9 | **Validation and rollout** | See 9.1–G1 | — | — | — | 6–11 (sum) | — | — | Not started | — | — |
| 9.1 | Pilot readiness | Sending domain verified; first backup; DC manager agrees to staff data in the cloud | All `Pilot` items in [08](08-production-readiness.md) done; a test e-mail reaches a non-owner address | M6 | Must | 1–2 | — | 7 | Not started | FR-10, FR-11 | R-12, R-13 |
| 9.2 | Pilot with one real team | Two-week pilot ([07](07-poc-and-mvp.md) §6) and pilot report | `SM-3` met; feedback recorded | M6 | Must | 2–3 | — | 9.1, 1.3, 8.1 | Not started | BO-1, BO-2 | R-12, R-13 |
| 9.3 | Production hosting decision | Stay on free tiers or move | Recorded in `decisions.md` | M6 | Should | 1–2 | — | 9.2 | Not started | NFR-13 | NFR-07 |
| 9.4 | Production readiness | Production checklist completed; release checklist adopted | All `Production` items in 08 done; go decision recorded | M6 | Must | 2–4 | — | 9.3, G1 | Not started | NFR-13 | NFR-01, NFR-06, NFR-07 |
| G1 | Gate: pilot review | DC manager's decision to roll out beyond the pilot team | Pilot report accepted; no longer blocks any feature (decision #54) | M6 | Must | — | — | 1.2, 1.3, 1.6, 9.2 | Not started | BO-1 | — |
| 10 | **Platform changes** | See 10.1–10.3 | — | — | — | 3–4.5 (sum) | — | — | Not started | — | — |
| 10.1 | Manager scope (team, program, DC) | Scope table replacing `team_managers`; RLS helpers; scope admin screen | pgTAP: each scope sees exactly its people; new teams included | M1 | Must | 2–3 | — | 1.9 | Not started | FR-02, BRD §4.1 | R-30 |
| 10.2 | Current role and YoE | Role (set by admin) and YoE (set by member) on the member record | Shown on the profile and in exports | M1 | Must | 0.5–1 | — | 1.9 | Not started | FR-03 | — |
| 10.3 | Course cost and study hours | Two new course fields in forms, import and export | Values editable and exported | M1 | Must | 0.5 | — | 1.9 | Not started | FR-04 | R-03 |
| 11 | **Skill Matrix** | See 11.1–11.7 | — | — | — | 14–20.5 (sum) | — | — | Not started | — | — |
| 11.1 | Skill list | Fields (incl. General), skills, sub-skills, shared skills, level scale 0–5; seeded from BRD Appendix A | Seed loads; admin can edit; one entry per shared skill | M2 | Must | 2–3 | — | 10.1 | Not started | FR-14, UC-06 | — |
| 11.2 | Course–skill links | Link a course to skills and the level it proves; list of unlinked courses | Labels update when a link changes | M2 | Must | 1–2 | — | 11.1 | Not started | FR-15, UC-06 | — |
| 11.3 | My skills | Choose fields; rate 0–4; Certified / Self-assessed labels; raise offer; level 5 by manager; manager review and send back | Rules of BRD §4.1 pass unit and pgTAP tests | M2 | Must | 3–4 | — | 11.2 | Not started | FR-17, UC-07 | — |
| 11.4 | Skill Matrix view | DC × skills grid per field tab; filters; counts; key-person flag; Excel export in the old layout | 150 people × 500 skills opens in < 2 s; keyboard and screen-reader table | M2 | Must | 3–4 | — | 11.3 | Not started | FR-20, UC-09 | — |
| 11.5 | Find people for a project | Search with several skill + minimum level conditions; Certified only; close matches | BRD example (Next.js ≥ 3, Rust ≥ 4) returns the right people | M2 | Must | 2–3 | — | 11.3 | Not started | FR-21, UC-10 | R-23 |
| 11.6 | Review every 3 months | Rating history; reminder e-mail; Out of date mark; 3- or 12-month setting | Reminder sent once per cycle; history kept | M2 | Should | 1–1.5 | — | 11.3 | Not started | FR-18, UC-07 | — |
| 11.7 | Skill Matrix import | One-time import of the old spreadsheet: ratings, YoE, conflicts flagged | Real file imported; conflicting ratings and YoE listed | M2 | Should | 2–3 | — | 11.3 | Not started | FR-06, UC-02 | — |
| 12 | **Goals and courses** | See 12.1–12.3 | — | — | — | 7–10 (sum) | — | — | Not started | — | — |
| 12.1 | Quarterly certificate goals | Goal per scope; Q1–Q4 targets; people (default) or certificates; team shares; status | BRD example (50 AI certificates by Q3 2027) shows each team's share | M3 | Must | 3–4 | — | 10.1, 11.2 | Not started | FR-23, UC-11 | — |
| 12.2 | Pick or assign a course | "Join this goal" for members; assignment by managers with e-mail; state per course | Picked and assigned courses count towards the goal | M3 | Must | 2–3 | — | 12.1 | Not started | FR-25, UC-12 | — |
| 12.3 | Exam reminders, risk levels, key-person alerts | Reminder 14 days before the exam; Low / Medium / High risk; key-person expiry warning | UC-04 rules pass tests; no duplicate e-mails | M3 | Should | 2–3 | — | 12.2, 11.4 | Not started | FR-11, UC-04 | R-24 |
| 13 | **AI** | See 13.1–13.10 | — | — | — | 15.5–23 (sum) | — | — | Not started | — | — |
| 13.1 | AI platform | Provider-agnostic client (OpenAI-compatible), DeepSeek config, name masking, usage log, daily limit, on/off per feature, admin view | Every use case works with AI off; no names sent; cost logged | M4 | Must | 3–4 | — | 1.8 | Not started | FR-31, NFR-07–NFR-12 | R-27, R-28, R-29 |
| 13.2 | AI reads certificate files | PDF or image → filled form with course match; AI fields marked | ≥ 80% of fields right on 30 real certificates (proposed) | M4 | Must | 2–3 | — | 13.1 | Not started | FR-09, UC-03 | R-22 |
| 13.3 | AI goal plan | Who could study what and in which quarter, with cost and refund; manager edits and confirms | Plan uses only app data; nothing saved without confirmation | M4 | Must | 2–3 | — | 13.1, 12.2 | Not started | FR-24, UC-11 | R-21 |
| 13.4 | AI suggests course–skill links | Suggested skills and level per course, with a reason | Admin accepts, changes or dismisses each | M4 | Should | 1–1.5 | — | 13.1, 11.2 | Not started | FR-16, UC-06 | — |
| 13.5 | AI clean-up of imports | Groups look-alike course names; suggests type and provider | Admin confirms each change in the preview | M4 | Should | 1–2 | — | 13.1 | Not started | FR-07, UC-02 | R-22 |
| 13.6 | AI suggests the next certificate | Up to 3 certificates with reason, hours, cost and refund | Only courses in the list; add to plan in one click | M4 | Should | 1.5–2 | — | 13.1, 11.3 | Not started | FR-19, UC-08 | R-20 |
| 13.7 | AI answers questions | A fixed set of questions answered with the number and a link | Numbers match the dashboard | M4 | Should | 2–3 | — | 13.1 | Not started | FR-30, UC-15 | R-26 |
| 13.8 | AI evaluation and cost check | Test set per AI feature; monthly cost estimate | Each feature passes its test set; cost within budget | M4 | Must | 1–2 | — | 13.2, 13.3 | Not started | NFR-11 | — |
| 13.9 | AI turns a project description into conditions | Suggested conditions and one line per person | Manager checks them before the search runs | M5 | Could | 1–1.5 | — | 13.1, 11.5 | Not started | FR-22, UC-10 | R-23 |
| 13.10 | AI summary in the monthly report | 3–5 sentences built from app numbers | Left out when the numbers do not match | M5 | Could | 1 | — | 13.1 | Not started | FR-13, UC-05 | R-25 |
| 14 | **Growth** | See 14.1–14.4 | — | — | — | 4.5–7 (sum) | — | — | Not started | — | — |
| 14.1 | Roles and role criteria | Ordered roles; skills with minimum levels, certificates, text criteria; written by the admin | Criteria for the 4 roles entered | M5 | Must | 1.5–2 | — | 11.1 | Not started | FR-26, UC-13 | — |
| 14.2 | My next role | Criteria met / not yet; link to my plan | Matches the member's ratings and certificates | M5 | Must | 1–2 | — | 14.1 | Not started | FR-27, UC-13 | — |
| 14.3 | AI learning path | Gap explained; ordered steps with a rough timeline | Never says whether someone is ready for promotion | M5 | Should | 1–1.5 | — | 14.2, 13.1 | Not started | FR-28, UC-13 | — |
| 14.4 | Team progress towards a role | Criteria met and missing per member in scope; no scores | Only people within the manager's scope | M5 | Could | 1–1.5 | — | 14.2 | Not started | FR-29, UC-14 | — |

## 3. Summary

Milestones in build order (open work only):

| Milestone | Content | Est. (days) | Cumulative (weeks, upper end) |
|---|---|---|---|
| Built | Certificates: W1–W6, live at https://cert-tracker-three.vercel.app | — | — |
| M0 | Approval and plans: BRD signed off, open questions answered, mockups reviewed, plans written | 3.5–5 | 1.0 |
| M1 | Platform changes: manager scope, role and YoE, course cost, English UI, page speed | 5.5–8.5 | 2.7 |
| M2 | Skill Matrix: skill list, links, ratings, matrix view, project search, review cycle, import | 14–20.5 | 6.8 |
| M3 | Goals and courses: quarterly goals, pick or assign, risk and key-person alerts | 7–10 | 8.8 |
| M4 | AI (core): AI platform and the Must / Should AI features | 13.5–20.5 | 12.9 |
| M5 | Growth and Could items: roles and criteria, next role, learning path | 6.5–9.5 | 14.8 |
| M6 | Quality and go-live: accessibility, real-file trials, interviews, pilot, G1, production | 12–20 | 18.8 |

- **Built:** Phase 1 (weeks 1–6) was built from 2026-09-26 to 2026-10-04 with AI-assisted development. Week 6 (pull request #16) was merged into `main` on 2026-10-17; its migrations are pushed and the function region is Tokyo (`hnd1`).
- **Open work:** 44 work packages, **62–94 developer days** (about 12–19 weeks for one developer): Must 41–62, Should 17–27, Could 4–5. The pilot (9.2) also needs two calendar weeks of real use.
- **Parallel work:** with a second developer, M4 (AI) can run alongside M2–M3 once 13.1 is done, because the AI features only need the platform and the screens they extend.
- **Waiting:** 1.7 and 1.8 wait on the DC manager. 13.1 cannot send real data to DeepSeek before 1.8 is answered; it can be built and tested with sample data.

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


## 5. Open points (to be confirmed)

- All estimates, confirmed by the developer and the DC manager
- The four open questions of BRD §7: AI budget, DeepSeek terms, risk thresholds, key-person rule (`1.8`)
- The acceptance threshold for reading certificates with AI (≥ 80% of fields on 30 real certificates is a proposal) (`13.2`)
- Which team runs the pilot, and when (`9.2`)
- Who collects the CA data and when (`1.6`)
- Whether the hosting decision comes before or after G1 (`9.3`)
