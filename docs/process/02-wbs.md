# Work Breakdown Structure (WBS)

- **Status:** Draft v1 — backfilled after the MVP build (see `00-process-status.md`)
- **Last updated:** 2026-10-07
- **Owner:** CertTracker team (DC34)
- **Sources:** [Design spec §10](../superpowers/specs/2026-09-26-certtracker-design.md), `git log`, [Plans](../superpowers/plans/), [Requirements and CA](01-requirements-and-ca.md), [Process status](00-process-status.md)

> **Tóm tắt (VI):** Cây công việc có mã, trạng thái, kế hoạch so với thực tế. "Planned" lấy từ lộ trình tuần 1–6 trong spec; "Actual" lấy từ lịch sử git (ngày lịch; giờ công không được theo dõi). Phần chưa làm là ước lượng theo khoảng, cần xem lại và không phải cam kết. Tuần 6 (cron, email, chất lượng dữ liệu) mới có trên nhánh `feat/week6-notifications`, chưa merge vào `dev` và chưa lên production. Cổng G1 chặn Giai đoạn 2 (AI) cho tới khi nhu cầu được xác nhận.

## 1. How to read this

- **Planned**: the roadmap in the design spec (phase 1 = 6 weeks, phase 2 = 6 weeks). `—` means the item was not in that roadmap.
- **Actual**: calendar window from `git log` and merged pull requests. Effort in person-hours was **not tracked**, so none is claimed.
- **Est. remaining**: engineer estimates in working days; ranges, to be reviewed. They are not commitments.
- **Requirements** column links each work package to [01](01-requirements-and-ca.md). Every `R-xx` and `NFR-xx` in `01` §4 appears in at least one row.
- **Status** is one of `Done`, `In progress`, `Not started`, `Blocked (G1)`. `Done` means built and tested by the build team, not validated by users (see `01` §4 notes).
- Phase 1 was built with AI-assisted development, which is why the calendar time is much shorter than the original 6-week plan; the plan was not re-baselined.

## 2. WBS

| WBS | Work package | Deliverable | Acceptance | Planned | Actual | Est. remaining | Depends on | Status | Requirements |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Requirements and project governance | Process documents `00`–`06`, validated assumptions | Documents reviewed by the sponsor; assumptions `A-01`…`A-10` checked | — | 2026-10-05 → | 5–6.5 days (roll-up of 1.1–1.5) | — | In progress | — |
| 1.1 | Process documents: status, CA, WBS, SAD, design, PoC/MVP, production readiness (this pack) | `docs/process/00`–`06` | Merged; sponsor feedback addressed | — | 2026-10-05 → | 1 day | — | In progress | — |
| 1.2 | User interviews | Interview notes per assumption | 3–5 interviews recorded; `01` §7 updated | — | not started | 2–3 days | 1.1 | Not started | — |
| 1.3 | Real-file import trial | Trial report (rows imported, manual fixes) | `SM-2` measured on a real file | — | not started | 0.5–1 day | 5 | Not started | R-15 |
| 1.4 | Build-vs-buy scan | One-page comparison | Sponsor agrees build is still justified | — | not started | 1 day | 1.1 | Not started | — |
| 1.5 | Mockup review with the sponsor | Reviewed 04 §6 checklist with answers | Answers recorded in 04 §6 and decisions.md where needed | — | 2026-10-07 (mockups drafted) | 0.5 day | 1.1 | In progress | — |
| 2 | Foundation (W1) | Schema, RLS, sign-in, CI, deployment on free tiers | PRs #1, #3 and #4 merged; pgTAP RLS green | Week 1 | 2026-09-26 → 2026-09-27 | — | — | Done | R-07, R-17, R-30, NFR-07 |
| 2.5 | Design system | Tokens, components, `/design` page, reference doc | PR #6 merged | — | 2026-09-27 | — | 2 | Done | NFR-05 |
| 2.6 | UI polish (logo, favicon, dropdown fixes) | Logo, favicon, sidebar brand mark, select fixes | PR #13 merged | — | 2026-10-02 | — | 2.5 | Done | NFR-05 |
| 3 | Org and catalogue CRUD (W2) | Organisation, members, courses | PR #8 merged | Week 2 | 2026-09-29 → 2026-09-30 | — | 2 | Done | R-01, R-02, R-03, R-04 |
| 4 | Training Records (W3) | List, form, evidence upload, expiry badge, Realtime | PR #10 merged | Week 3 | 2026-09-30 → 2026-10-01 | — | 3 | Done | R-05, R-06, R-08, R-18 |
| 5 | Import / Export (W4) | Excel import with staging and preview; CSV/Excel export | PR #11 merged; real-file trial pending (1.3) | Week 4 | 2026-10-01 | — | 4 | Done | R-15, R-16 |
| 6 | Dashboard (W5) | KPIs, breakdowns, ranking | PR #15 merged | Week 5 | 2026-10-04 | — | 4 | Done | R-09, R-10, R-11, NFR-02 |
| 7 | Cron, e-mail and data quality (W6) | Expiry alerts, monthly report, notification log, data-quality page; code (built and reviewed on branch `feat/week6-notifications`; pull request #16 open, not merged (see 9.1); as of 2026-10-07) | Branch reviewed; e2e green | Week 6 | 2026-10-04 (branch commits) | 0 (merge and push are in 9.1) | 4, 6 | In progress | R-12, R-13, R-14, R-19, NFR-01, NFR-06 |
| 8 | Cross-cutting improvements | See 8.1–8.4 | — | — | — | — | — | Not started | — |
| 8.1 | Page-navigation performance | Measured before/after; Supabase region confirmed in the dashboard; function region set near the database; loading feedback on every page; fewer sequential auth calls | `SM-4` met on the same measurement method | — | Diagnosed 2026-10-05 (spike) | 0.5–1 day | — | Not started | NFR-03 |
| 8.2 | Interface language switch (EN/VI) | Own design spec → plan → build | Both languages complete; e-mails follow the recipient's language. Unscheduled until after G1 unless the sponsor asks earlier (decision #48) | — | not started | 4–7 days (needs its own design) | 1.1 | Not started | NFR-04 |
| 8.3 | Self sign-up with approval | Own design + build | A new user can request access and an admin approves. Unscheduled until after G1 unless the sponsor asks earlier | — | not started | 2–4 days | 6 | Not started | R-31 |
| 8.4 | Accessibility audit (keyboard and screen reader) | Audit notes + fixes list | Key flows usable by keyboard; headings and labels checked | — | not started | 1–2 days | 6 | Not started | NFR-05 |
| 9 | Validation and rollout | See 9.1–9.4 | — | — | — | — | — | Not started | — |
| 9.1 | Merge week 6, push migrations, verify the sending domain | Week 6 merged into `dev`; cloud schema up to date; e-mail domain verified | Production shows all pages; a test e-mail is delivered | — | not started | 0.5–1 day | 7 | Not started | R-12, R-13 |
| 9.2 | Pilot with one real team | Pilot plan in [05 §6](05-poc-and-mvp.md); two Mondays of e-mails; feedback | `SM-3` met; feedback recorded | — | not started | 2 calendar weeks | 9.1, 1.3, 8.1 | Not started | R-12, R-13 |
| 9.3 | Production hosting decision | Decision record: stay on free tiers or move (e.g. VPS) | Recorded in `decisions.md` | — | not started | 1–2 days | 9.2 | Not started | NFR-07 |
| 9.4 | Production readiness | Checklist in [06](06-production-readiness.md) completed; release checklist adopted | All PRD items marked "needed before production" are done; sponsor go decision recorded | — | not started | 3–6 days (estimate; depends on hosting choice) | 9.3 | Not started | NFR-01, NFR-06, NFR-07 |
| G1 | Gate: need confirmed | Sponsor sign-off that the three conditions in [00 §3](00-process-status.md) are met: assumptions `A-01`…`A-10` checked as planned in `01` §7; a real team used the product for at least two consecutive weeks including two Monday e-mails (*proposed period*), with the sponsor confirming it replaces their spreadsheet; the sponsor confirms which Phase 2 features are wanted and in what order | Written decision to open, re-scope or stop Phase 2 | — | — | — | 1.2, 1.3, 9.2 | Not started | — |
| 10 | Phase 2 — AI features | Weeks 7–12 of the design spec | Re-estimated after G1 | Weeks 7–12 | — | re-estimate after G1 | G1 | Blocked (G1) | R-20, R-21, R-22, R-23, R-24, R-25, R-26, R-27, R-28, R-29 |

Notes:

- Row `7`: the week-6 commits are all dated 2026-10-04, and none of week 6 is on `dev` or `main`; the branch was pushed on 2026-10-07 as pull request #16, which is open and not merged (as of 2026-10-07). The cloud database schema is pushed manually (see [00 §2](00-process-status.md)); this document does not claim that any week 3–6 migration has been pushed to production.
- Rows `2.5` and `2.6` were not in the spec roadmap (hence Planned `—`); they trace to `NFR-05` for the contrast work already done. `NFR-05` is `Partial` in `01`, so the open work is `8.4`.
- Rows `1`, `1.1`, `1.2`, `1.4`, `1.5`, `8`, `9` and `G1` deliver process results or group other rows, so their Requirements cell is `—`.

## 3. Planned vs actual (summary)

| | Planned | Actual |
|---|---|---|
| Phase 1 (weeks 1–6) | 6 weeks | 2026-09-26 → 2026-10-04 (9 calendar days, 7 with commits; AI-assisted); week 6 is on a branch, not merged |
| Pull requests merged | — | 15 merged (#1–#15): 9 feature/chore PRs (#1, #3, #4, #6, #8, #10, #11, #13, #15) and 6 `dev` → `main` release merges (#2, #5, #7, #9, #12, #14) — see the counting note |
| Automated tests (week-6 branch) | — | 542 unit, 233 database assertions (10 files), 39 end-to-end — as reported at the end of week 6, not re-run for this document |

Counting note: PRs were counted from `git log origin/main --merges` and `git log origin/dev --merges`, using the merged branch name in each merge commit (no GitHub access was used; local `main` is stale, so the remote branches were used). A merge "from `dev`" is a release sync into `main`, not a feature; #15 is the only PR so far that is merged into `dev` but not yet released to `main`. #4 (`chore/sync-week1-wrapup`) is a documentation/sync PR; #1 and #3 both come from `feat/phase1-week1-foundation`.

Caveat: being ahead of the original calendar says nothing about whether the right thing was built. That is what gate G1 and work packages 1.2, 1.3 and 9.2 check.

## 4. Performance measurements (work package 8.1)

Spike on 2026-10-05 (read-only):

| Item | Result |
|---|---|
| Edge location | Singapore (`x-vercel-id: sin1::…`) |
| `/login` (cached) | 0.26–0.45 s (occasionally 1.2–1.9 s on a cold connection) |
| Redirect for a signed-out user | about 0.25 s |
| Function region for signed-in pages | not measured — hypothesis: US East while the database is far away. The Supabase region is recorded as Tokyo in the deployment notes (the notes also mention Singapore); confirm in the Supabase dashboard (Project Settings → Infrastructure) |
| Sequential Supabase calls per navigation | at least 3 (proxy session check, layout session check + profile read, page query) — from code |
| Pages with a loading state | Dashboard only on `dev`, and none on `main`, which the public deployment builds from (week 6 adds the data-quality page, in the open pull request #16) |
| Public Vercel deployment | Builds from `main` ([deploy notes](../deploy/task9-free-tier.md)); last release is PR #14 (2026-10-02, weeks 1–4 plus UI fixes); `main` has only a placeholder Dashboard page and no `loading.tsx`; `dev` adds week 5; week 6 is local only. It is a pilot deployment, not a production service |

Server-side time for signed-in pages could not be measured without a session; the measurements above are for signed-out requests only. After the fix, repeat the same measurements and add an "after" column here.
