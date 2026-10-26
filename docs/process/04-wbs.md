# Work Breakdown Structure (WBS)

- **Status:** Draft v2 — backfilled after the MVP build
- **Last updated:** 2026-10-26
- **Owner:** CertTracker team (DC34)
- **Sources:** [Design spec §10](../superpowers/specs/2026-09-26-certtracker-design.md), `git log`, [Plans](../superpowers/plans/), [Requirements](03-requirements.md)

> **Tóm tắt (VI):** Cây công việc có mã, kế hoạch so với thực tế và phần việc còn lại. "Planned" lấy từ lộ trình trong spec; "Actual" là ngày lịch lấy từ git (giờ công không được theo dõi). Ước lượng còn lại là khoảng, không phải cam kết. Tuần 6 nằm trong pull request #16, chưa merge; cổng G1 chặn Giai đoạn 2 (AI) cho tới khi nhu cầu được xác nhận.

## 1. Purpose and how to read

This document lists the work done and the work remaining for CertTracker. It was written after Phase 1 had been built.

- **Planned** is the design-spec roadmap (Phase 1 = weeks 1–6, Phase 2 = weeks 7–12); `—` means the item was not in it.
- **Actual** is the calendar window from `git log` and merged pull requests. Effort in hours was not tracked, so none is claimed.
- **Est. remaining** is the developer's estimate in working days: ranges, not commitments.
- **Status** is `Done` (built and tested by the build team, not validated by users), `In progress`, `Not started` or `Blocked (G1)`. **Requirements** are the IDs in [03](03-requirements.md); each appears in at least one row.
- **G1** is the gate before Phase 2 (decision #46): the key assumptions are checked; a real team has used the product for two consecutive weeks and the sponsor confirms it replaces their spreadsheet; the sponsor confirms which Phase 2 features are wanted.

## 2. WBS

| WBS | Work package | Deliverable | Acceptance | Planned | Actual | Est. remaining | Depends on | Status | Requirements |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Requirements and project governance | Process documents `00`–`08`; checked assumptions | Sponsor reviewed the documents; `A-01`…`A-10` checked | — | 2026-10-05 → | 6–8.5 days (sum of 1.1–1.6) | — | In progress | — |
| 1.1 | Process documents (this pack) | `docs/process/00`–`08` | Merged; sponsor feedback addressed | — | 2026-10-05 → | 1 day | — | In progress | — |
| 1.2 | Discovery interviews (before the pilot) | Notes per assumption | 4–5 people interviewed (1 manager, 1 admin, 2–3 members); CA statuses updated | — | not started | 2–3 days | 1.1, 1.6 | Not started | — |
| 1.3 | Real-file import trial | Trial report: rows imported, manual fixes | `SM-2` measured on a real file | — | not started | 0.5–1 day | 5 | Not started | R-15 |
| 1.4 | Build-vs-buy scan | One-page comparison: spreadsheet, company system, SkillMatrix, CertTracker | Sponsor agrees building is still justified | — | not started | 1 day | 1.1 | Not started | — |
| 1.5 | Mockup review with the sponsor | Answered review checklist ([06](06-design-and-mockups.md) §6) | Answers recorded; decisions logged where needed | — | 2026-10-07 (mockups drafted) | 0.5 day | 1.1 | In progress | — |
| 1.6 | CA data collection | Baseline numbers and named contacts | Sponsor and admin supplied them; CA updated | — | not started | 1–2 days | 1.1 | Not started | — |
| 2 | Foundation (W1) | Schema, RLS, sign-in, CI, free-tier deployment | PRs #1, #3, #4 merged; pgTAP RLS green | Week 1 | 2026-09-26 → 2026-09-27 | — | — | Done | R-07, R-17, R-30, NFR-07 |
| 2.5 | Design system | Tokens, components, `/design` page, reference doc | PR #6 merged | — | 2026-09-27 | — | 2 | Done | NFR-05 |
| 2.6 | UI polish | Logo, favicon, sidebar brand mark, select fixes | PR #13 merged | — | 2026-10-02 | — | 2.5 | Done | NFR-05 |
| 3 | Org and catalogue CRUD (W2) | Organisation, members, courses | PR #8 merged | Week 2 | 2026-09-29 → 2026-09-30 | — | 2 | Done | R-01, R-02, R-03, R-04 |
| 4 | Training records (W3) | List, form, evidence upload, expiry badge, Realtime | PR #10 merged | Week 3 | 2026-09-30 → 2026-10-01 | — | 3 | Done | R-05, R-06, R-08, R-18 |
| 5 | Import / Export (W4) | Excel import with staging and preview; CSV/Excel export | PR #11 merged; real-file trial is 1.3 | Week 4 | 2026-10-01 | — | 4 | Done | R-15, R-16 |
| 6 | Dashboard (W5) | KPIs, breakdowns, ranking | PR #15 merged into `dev` | Week 5 | 2026-10-04 | — | 4 | Done | R-09, R-10, R-11, NFR-02 |
| 7 | Cron, e-mail and data quality (W6) | Expiry alerts, monthly report, notification log, data-quality page | Branch reviewed, e2e green; PR #16 open, not merged | Week 6 | 2026-10-04 (branch commits) | 0 (merge is in 9.1) | 4, 6 | In progress | R-12, R-13, R-14, R-19, NFR-01, NFR-06 |
| 8 | Cross-cutting improvements | See 8.1–8.4 | — | — | — | — | — | Not started | — |
| 8.1 | Page-navigation performance | Loading feedback on every page; functions near the database; fewer auth calls | `SM-4` met, measured before and after (§4) | — | Diagnosed 2026-10-05 | 0.5–1 day | — | Not started | NFR-03 |
| 8.2 | Interface language switch (EN/VI) | Own design spec, plan and build | Both languages complete; e-mails in the recipient's language | — | not started | 4–7 days | 1.1 | Not started | NFR-04 |
| 8.3 | Self sign-up with approval | Own design and build | A user requests access; an admin approves | — | not started | 2–4 days | 6 | Not started | R-31 |
| 8.4 | Accessibility audit | Keyboard and screen-reader audit; list of fixes | Key flows usable by keyboard; headings and labels checked | — | not started | 1–2 days | 6 | Not started | NFR-05 |
| 9 | Validation and rollout | See 9.1–9.4 | — | — | — | — | — | Not started | — |
| 9.1 | Pilot readiness | Week 6 released; migrations pushed; sending domain verified; first backup; data-owner approval | All `Pilot` items in [08](08-production-readiness.md) done; a test e-mail delivered | — | not started | 1–2 days | 7 | Not started | R-12, R-13 |
| 9.2 | Pilot with one real team | Two-week pilot ([07](07-poc-and-mvp.md) §6) and pilot report | `SM-3` met; feedback recorded | — | not started | 1 set-up week + 2 calendar weeks | 9.1, 1.3, 8.1 | Not started | R-12, R-13 |
| 9.3 | Production hosting decision | Stay on free tiers or move | Recorded in `decisions.md` | — | not started | 1–2 days | 9.2 | Not started | NFR-07 |
| 9.4 | Production readiness | Production checklist completed; release checklist adopted | All `Production` items in 08 done; go decision recorded | — | not started | 3–6 days | 9.3, G1 | Not started | NFR-01, NFR-06, NFR-07 |
| G1 | Gate: need confirmed | Sponsor's written decision: open, re-scope or stop Phase 2 | The three G1 conditions are met (decision #46) | — | — | — | 1.2, 1.3, 1.4, 1.6, 9.2 | Not started | — |
| 10 | Phase 2 — AI features | Weeks 7–12 of the design spec | Re-estimated after G1 | Weeks 7–12 | — | re-estimate after G1 | G1 | Blocked (G1) | R-20, R-21, R-22, R-23, R-24, R-25, R-26, R-27, R-28, R-29 |

## 3. Summary

- **Phase 1** (planned: 6 weeks) was built from 2026-09-26 to 2026-10-04 with AI-assisted development; the plan was not re-baselined. 15 pull requests are merged: 9 feature/chore PRs (#1, #3, #4, #6, #8, #10, #11, #13, #15) and 6 `dev` → `main` release merges, counted from the merge commits on `origin/dev` and `origin/main`.
- **Week 6** is in pull request #16, open and not merged (as of 2026-10-07).
- **Before G1:** about 9.5–15.5 developer days (1.1–1.6, 8.1, 8.4, 9.1, 9.3) plus the pilot (one set-up week and two calendar weeks). 8.2 and 8.3 are not scheduled before G1 unless the sponsor asks (decision #48); 9.4 follows G1.
- **Phase 2** (10) is blocked by G1 and re-estimated after it. Being ahead of the calendar says nothing about whether the right thing was built; that is what G1 checks.

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

After 8.1, repeat the same measurements and add an "after" column.

## 5. Open points (to be confirmed)

- Remaining estimates, confirmed by the developer and the sponsor (`1`, `8.1`, `8.4`, `9.1`, `9.3`)
- Who collects the CA data and when the data owner can approve (`1.6`, `9.1`)
- Which team runs the pilot, and when (`9.2`)
- Final pilot period required by the gate (`9.2`, G1)
- Who signs G1 (G1)
- Whether the hosting decision comes before or after G1 (`9.3`)
- Whether 8.2 or 8.3 should be brought forward before G1 (`8.2`, `8.3`)
- Actual Supabase region and function region (`8.1`)
