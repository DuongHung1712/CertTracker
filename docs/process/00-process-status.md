# Process Status

- **Status:** Draft v1 — backfilled after the MVP build
- **Last updated:** 2026-10-31
- **Owner:** CertTracker team (DC34)
- **Sources:** [Design spec](../superpowers/specs/2026-09-26-certtracker-design.md), [Decisions](../decisions.md), `git log`

> **Tóm tắt (VI):** Đối chiếu chuỗi quy trình của manager với những gì đã làm thật. Dự án đã build MVP nội bộ trước khi có CA và WBS; bộ tài liệu này bù lại và đặt một cổng quyết định (G1) trước Giai đoạn 2 (AI). Các file được đánh số theo đúng thứ tự quy trình: 01 ý tưởng và brainstorm, 02 CA, 03 requirements, 04 WBS, 05 SAD, 06 thiết kế/mockup, 07 PoC/MVP, 08 sẵn sàng production.

## 1. Why this document exists

The recommended process is **Idea → Brainstorm → CA → WBS → SAD → Design/Mockup → PoC → MVP → Production**, with the principle "build the right thing before building the thing right".

CertTracker did **not** follow that order. A feature list (from the DC34 team lead) and a technical design spec existed, and the build started right away. The Concept/Customer Analysis (CA) and the WBS were never written. This document states that plainly, shows where each stage stands today, and defines the gate that stops further investment until the need is confirmed.

## 2. Stage map

| Stage | Status | Evidence / gap |
|---|---|---|
| Idea | Done | [01](01-idea-and-brainstorm.md) §1: `CertTracker - Feature List.pdf` (9 feature groups, DC34; internal, not stored in this repository) |
| Brainstorm | Done, without customer analysis | [01](01-idea-and-brainstorm.md) §2–§3: [Design spec](../superpowers/specs/2026-09-26-certtracker-design.md) (2026-09-26) and [Decisions](../decisions.md); what the brainstorm did not do is in 01 §3 |
| CA (Concept/Customer Analysis) | **Backfilled; needs and assumptions not validated** | [02](02-concept-analysis.md): problem, users, needs, options, success criteria, assumptions, constraints, and the open points still to collect (§9). The need was **not** validated with end users. Requirements, traced to the needs: [03](03-requirements.md) |
| WBS | **Missing — backfilled** | [04](04-wbs.md) |
| SAD | Exists as the design spec | [05](05-sad.md) condenses it |
| Design / Mockup | Partial — as-built documented; proposed mockups awaiting review | Design system and component catalogue exist ([Design system](../design-system.md), the `/design` page, dev only). No screen mockups were reviewed before the build; [06](06-design-and-mockups.md) documents the as-built screens (§3–§4b) and holds proposed mockups for the sponsor to review (§5, checklist in §6) |
| PoC | Partial — reconstructed from tests; see [07](07-poc-and-mvp.md) | Foundation deployed 2026-09-27 on free tiers ([deploy notes](../deploy/task9-free-tier.md)); no separate PoC phase was run. What the build proves technically, and what it does not, is reconstructed in [07](07-poc-and-mvp.md) §2–§3 |
| MVP | Built internally, **not validated** | Weeks 1–4 released to `main`, week 5 in `dev`; week 6 is in pull request #16, open and not merged (as of 2026-10-07); see notes below the table. The MVP acceptance criteria in [07](07-poc-and-mvp.md) §5 are not met yet |
| Production | Not started | The public Vercel URL is a pilot deployment of `main` on free tiers; see notes below the table. What must be true before production: [08](08-production-readiness.md) |

Statements about week 6 and the cloud/e-mail setup are as of 2026-10-07 and must be refreshed when week 6 is merged.

MVP details (as of 2026-10-07):

- Weeks 1–5 are merged into `dev` through the feature/chore PRs #1, #3, #4, #6, #8, #10, #11, #13 and #15 (2026-09-26 → 2026-10-04); see [04](04-wbs.md) §3.
- Week 6 (cron, e-mail, data quality) is built and reviewed on branch `feat/week6-notifications`, pushed to GitHub on 2026-10-07 as pull request #16 (open, not merged as of 2026-10-07; see 9.1); last code commit 2026-10-04.
- The legacy Excel file has not been tried; there has been no UAT with a real team.

What is deployed where (as of 2026-10-07):

- The public Vercel URL builds from `main` ([deploy notes](../deploy/task9-free-tier.md), section C2: Production Branch = `main`).
- The last release into `main` is PR #14 (2026-10-02: weeks 1–4 plus UI fixes). `main` has no real Dashboard (only a placeholder page saying the KPIs come in week 5) and no `loading.tsx` at all.
- `origin/dev` additionally has week 5 (the Dashboard and one `loading.tsx`). Week 6 exists only in the open pull request #16 above.
- So what a reviewer sees on the public URL is a pilot deployment, not a production service.

Production details (as of 2026-10-07):

- Hosting is Vercel Hobby + Supabase Free: no automatic backups, the project pauses after 7 idle days, and Hobby is non-commercial ([deploy notes](../deploy/task9-free-tier.md)).
- Database migrations are pushed to the cloud manually, so the cloud schema can lag behind `main`.
- There is no evidence in the repository that the sending domain is verified on Resend (it must be verified before real use; [e-mail setup](../deploy/cron-email.md)).

## 3. Gate G1 — before Phase 2 (AI features, weeks 7–12)

> **Update 2026-10-31 (decisions #50 and #54):** there is no Phase 2 any more. Every feature in BRD v3.0, AI included, is part of Release 1, and G1 no longer blocks any feature. G1 is now the DC manager's review after the pilot, before CertTracker is rolled out beyond the pilot team; it holds back only production readiness (WBS 9.4). The text below is kept as the original gate (decision #46). The current plan is [04](04-wbs.md).

Phase 2 is the largest remaining investment. It is **blocked** until all of these are true:

1. The key assumptions in [02 §7](02-concept-analysis.md) (`A-01`…`A-10`) have been checked (interviews, the real Excel import, the SkillMatrix owner, the data owner).
2. A real team has used the product for at least two consecutive weeks (including two Monday e-mails) — *proposed; the sponsor decides the final period* — and the sponsor confirms it replaces their spreadsheet.
3. The sponsor confirms which Phase 2 features (`R-20`…`R-26`) are wanted and in what order.

If the interviews show the need is weaker than assumed, the correct outcome is to **stop or re-scope**, not to continue.

These three conditions (decision #46) are the official gate. What is still to be confirmed before it (contacts, baselines, the main cause of stale data, whether a simpler option would do) is listed in [02](02-concept-analysis.md) §9.

## 4. What is next

See [04](04-wbs.md): work packages 1 (requirements and validation, including 1.6, the data collection for the concept analysis), 8.1 (performance), 8.4 (accessibility) and 9.1–9.3 (pilot readiness, pilot, hosting decision) are expected before G1; 9.4 (production readiness) comes after G1 (*proposed* in [08](08-production-readiness.md) §5). 8.2 (interface language) was built in M1 (2026-11-01); 8.3 (self sign-up) is not scheduled before G1 unless the sponsor asks for it earlier.

The two-week pilot with one real team (work package 9.2) is planned in [07](07-poc-and-mvp.md) §6 and feeds G1; its preconditions are work package 9.1 (the `Pilot` items in [08](08-production-readiness.md)). What must be true before CertTracker becomes a production service is the rest of that checklist (the `Production` items, work package 9.4).

The sponsor is also asked to review the proposed mockups in [06](06-design-and-mockups.md) §5 and answer the checklist in §6 (work package 1.5), including whether 8.2 or 8.3 should be brought forward and which Phase 2 concept matters most for G1 condition 3.
