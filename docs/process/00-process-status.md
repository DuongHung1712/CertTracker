# Process Status

- **Status:** Draft v1 — backfilled after the MVP build
- **Last updated:** 2026-10-07
- **Owner:** CertTracker team (DC34)
- **Sources:** [Design spec](../superpowers/specs/2026-09-26-certtracker-design.md), [Decisions](../decisions.md), `git log`

> **Tóm tắt (VI):** Đối chiếu chuỗi quy trình của manager với những gì đã làm thật. Dự án đã build MVP nội bộ trước khi có CA và WBS; bộ tài liệu này bù lại và đặt một cổng quyết định (G1) trước Giai đoạn 2 (AI).

## 1. Why this document exists

The recommended process is **Idea → Brainstorm → CA → WBS → SAD → Design/Mockup → PoC → MVP → Production**, with the principle "build the right thing before building the thing right".

CertTracker did **not** follow that order. A feature list (from the DC34 team lead) and a technical design spec existed, and the build started right away. The Concept/Customer Analysis (CA) and the WBS were never written. This document states that plainly, shows where each stage stands today, and defines the gate that stops further investment until the need is confirmed.

## 2. Stage map

| Stage | Status | Evidence / gap |
|---|---|---|
| Idea | Done | `CertTracker - Feature List.pdf` (9 feature groups, DC34; internal, not stored in this repository) |
| Brainstorm | Done | [Design spec](../superpowers/specs/2026-09-26-certtracker-design.md) (2026-09-26) and [Decisions](../decisions.md) |
| CA (Concept/Customer Analysis) | **Missing — backfilled** | [01-requirements-and-ca.md](01-requirements-and-ca.md). The need was **not** validated with end users |
| WBS | **Missing — backfilled** | [02-wbs.md](02-wbs.md) |
| SAD | Exists as the design spec | [03-sad.md](03-sad.md) condenses it |
| Design / Mockup | Partial — as-built documented; proposed mockups awaiting review | Design system and component catalogue exist ([Design system](../design-system.md), the `/design` page, dev only). No screen mockups were reviewed before the build; [04](04-design-and-mockups.md) documents the as-built screens (§3–§4b) and holds proposed mockups for the sponsor to review (§5, checklist in §6) |
| PoC | Partial — reconstructed from tests; see [05](05-poc-and-mvp.md) | Foundation deployed 2026-09-27 on free tiers ([deploy notes](../deploy/task9-free-tier.md)); no separate PoC phase was run. What the build proves technically, and what it does not, is reconstructed in [05](05-poc-and-mvp.md) §2–§3 |
| MVP | Built internally, **not validated** | Weeks 1–4 released to `main`, week 5 in `dev`; week 6 is in pull request #16, open and not merged (as of 2026-10-07); see notes below the table. The MVP acceptance criteria in [05](05-poc-and-mvp.md) §5 are not met yet |
| Production | Not started | The public Vercel URL is a pilot deployment of `main` on free tiers; see notes below the table. What must be true before production: [06](06-production-readiness.md) |

Statements about week 6 and the cloud/e-mail setup are as of 2026-10-05 and must be refreshed when week 6 is merged.

MVP details (as of 2026-10-05):

- Weeks 1–5 are merged into `dev` through the feature/chore PRs #1, #3, #4, #6, #8, #10, #11, #13 and #15 (2026-09-26 → 2026-10-04); see the counting note in [02-wbs.md](02-wbs.md).
- Week 6 (cron, e-mail, data quality) is built and reviewed on branch `feat/week6-notifications`, pushed to GitHub on 2026-10-07 as pull request #16 (open, not merged as of 2026-10-07; see 9.1); last code commit 2026-10-04.
- The legacy Excel file has not been tried; there has been no UAT with a real team.

What is deployed where (as of 2026-10-05):

- The public Vercel URL builds from `main` ([deploy notes](../deploy/task9-free-tier.md), section C2: Production Branch = `main`).
- The last release into `main` is PR #14 (2026-10-02: weeks 1–4 plus UI fixes). `main` has no real Dashboard (only a placeholder page saying the KPIs come in week 5) and no `loading.tsx` at all.
- `origin/dev` additionally has week 5 (the Dashboard and one `loading.tsx`). Week 6 exists only in the open pull request #16 above.
- So what a reviewer sees on the public URL is a pilot deployment, not a production service.

Production details (as of 2026-10-05):

- Hosting is Vercel Hobby + Supabase Free: no automatic backups, the project pauses after 7 idle days, and Hobby is non-commercial ([deploy notes](../deploy/task9-free-tier.md)).
- Database migrations are pushed to the cloud manually, so the cloud schema can lag behind `main`.
- There is no evidence in the repository that the sending domain is verified on Resend (it must be verified before real use; [e-mail setup](../deploy/cron-email.md)).

## 3. Gate G1 — before Phase 2 (AI features, weeks 7–12)

Phase 2 is the largest remaining investment. It is **blocked** until all of these are true:

1. The key assumptions in [01 §7](01-requirements-and-ca.md) (`A-01`…`A-10`) have been checked as planned in 01 §7 (interviews, the real Excel import, the SkillMatrix owner, the data owner).
2. A real team has used the product for at least two consecutive weeks (including two Monday e-mails) — *proposed; the sponsor decides the final period* — and the sponsor confirms it replaces their spreadsheet.
3. The sponsor confirms which Phase 2 features (`R-20`…`R-26`) are wanted and in what order.

If the interviews show the need is weaker than assumed, the correct outcome is to **stop or re-scope**, not to continue.

## 4. What is next

See [02-wbs.md](02-wbs.md): work packages 1 (requirements and validation), 8.1 (performance), 8.4 (accessibility) and 9 (rollout) are expected before G1. 8.2 (interface language) and 8.3 (self sign-up) are not scheduled before G1 unless the sponsor asks for them earlier.

The two-week pilot with one real team (work package 9.2) is planned in [05](05-poc-and-mvp.md) §6 and feeds G1; what must be true before CertTracker becomes a production service is the checklist in [06](06-production-readiness.md) (work package 9.4).

The sponsor is also asked to review the proposed mockups in [04](04-design-and-mockups.md) §5 and answer the checklist in §6 (work package 1.5), including whether 8.2 or 8.3 should be brought forward and which Phase 2 concept matters most for G1 condition 3.
