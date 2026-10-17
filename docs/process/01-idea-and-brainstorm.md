# Idea and brainstorm

- **Status:** Draft v1 — backfilled after the MVP build (see `00-process-status.md`)
- **Last updated:** 2026-10-17
- **Owner:** CertTracker team (DC34)
- **Sources:** `CertTracker - Feature List.pdf` (internal; not stored in this repository), S+ AI Tooling Initiative proposal (internal; not stored in this repository), [Design spec](../superpowers/specs/2026-09-26-certtracker-design.md), [Decisions](../decisions.md), [2026-10-05 design](../superpowers/specs/2026-10-05-process-docs-and-ux-feedback-design.md)

> **Tóm tắt (VI):** Ý tưởng đến từ Feature List do trưởng nhóm DC34 đưa ra (9 nhóm tính năng: 7 nền tảng, 2 AI), mục tiêu là thay bảng tính đang dùng; bối cảnh chiến lược là SkillMatrix trong đề xuất S+ AI Tooling Initiative. Phần "brainstorm" thực chất là spec thiết kế 2026-09-26 và các quyết định trong `decisions.md`. Brainstorm **không** phân tích khách hàng, không khảo sát thị trường, không có WBS/ước lượng và không hỏi người dùng — vì vậy CA (02) và WBS (04) được viết bù.

## 1. Idea

**Where it came from.** The idea arrived as a feature list, `CertTracker - Feature List.pdf`, written by the DC34 team lead. It is an internal document and is not stored in this repository, so it cannot be traced from here. It describes a solution (features), not an analysis of the need.

**Stated goal.** The Feature List opens with the goal: an application that manages the team's certifications and **replaces the current Excel / Google Sheets file**. It does not say which of the two is used today, how many people or certificates are involved, or what goes wrong with the file (see [02](02-concept-analysis.md) §4).

**The nine feature groups** (`FL-1`…`FL-9`; the codes are used in [03](03-requirements.md)):

| Code | Group | In one line |
|---|---|---|
| FL-1 | Members and teams | Maintain members (name, e-mail, team, program, DC, generated code such as M001) and the team / program structure |
| FL-2 | Courses | Maintain the course and certificate catalogue (CertType, provider, level, validity in months), with refund information and a course link |
| FL-3 | Training records | Record each person's certificates (planned exam date, issue date, certificate link, registered through the company, refund status), progress in %, a normalised status, and computed expiry fields |
| FL-4 | Dashboard | KPIs (members, records, completed and %, in progress, expired, still valid), statistics by team, CertType and provider, personal ranking, course popularity, completion by provider |
| FL-5 | Reports and automatic alerts | A Monday e-mail about certificates expiring within 60 days, a monthly KPI e-mail to managers on day 1, and data-quality checks |
| FL-6 | Import / Export | Import the old Excel file with cleaning rules; export CSV / Excel in UTF-8 with Vietnamese diacritics |
| FL-7 | Platform | Sign-in and permissions (Auth + Row Level Security), realtime updates, scheduled jobs |
| FL-8 | AI suggestions | Certificate recommendation, training-plan generator, AI data assistant (read certificate images, merge duplicate course names, classify new courses) |
| FL-9 | AI analysis | Skill gap analysis, completion-risk prediction, AI insights in Vietnamese, Ask Your Data; plus the principles for AI (backend only, respect permissions, no unnecessary personal data in prompts) |

Groups 1–7 are the platform (phase 1), groups 8–9 are AI (phase 2).

**Strategic context.** The design spec (§1) links CertTracker to **SkillMatrix**, a proposed employee-skill repository in the S+ AI Tooling Initiative proposal, whose main risk is stale data. CertTracker is built standalone, with a data model that SkillMatrix could reuse. The proposal is internal and not stored here; who owns SkillMatrix and whether it will consume CertTracker data is not known (`A-10`).

## 2. Brainstorm

No separate brainstorm record exists. What was decided, and where:

- **[Design spec](../superpowers/specs/2026-09-26-certtracker-design.md) (2026-09-26):** context and goal (§1: a real team stops using Excel, legacy data imports cleanly, expiry alerts run automatically), constraints (§2), architecture, data model, permissions, a week-by-week roadmap (§10: phase 1 about 6 weeks, phase 2 about 6 weeks) and what is out of scope (§11).
- **[Decisions log](../decisions.md) (#1–#48).** The decisions that shaped the scope most:
  - #1 — cloud SaaS hosting (Supabase Cloud + Vercel); the data may be stored in the cloud.
  - #2 — three roles, Admin / Manager / Member; members update their own progress and evidence ("admin enters everything" was rejected).
  - #3 — DC → Program → Team; a member belongs to one team, a manager manages several.
  - #4 — a team of 1–2 people, TypeScript only.
  - #5 — Next.js full-stack + Supabase, with Row Level Security as the main security layer.
  - #8 — the personal ranking is visible to Managers and Admins only.
  - #9 — Ask Your Data uses a whitelist of query specifications, not free text-to-SQL.
  - #12 — e-mail and password sign-in, self sign-up disabled, an admin creates accounts.
  - #13 — free tiers (Vercel Hobby + Supabase Free) for the foundation phase.
  - #15 — one record per member per course; a renewal edits the same record.
- **[2026-10-05 design](../superpowers/specs/2026-10-05-process-docs-and-ux-feedback-design.md)**, after the manager's feedback (navigation feels slow, the requirements are unclear, the all-Vietnamese interface is hard to read): the process documents, the latency spike and the language decision, recorded as decisions #45–#48 (process frame, gate G1, English process documents, English/Vietnamese interface switch).

## 3. What the brainstorm did not do

Stated plainly, because it explains the rest of this pack:

- **No customer analysis.** Nobody who would use CertTracker was asked about the problem; the need was given by the team lead's feature list.
- **No market scan.** Existing tools, an improved spreadsheet and company systems were not compared (WBS 1.4).
- **No estimates or WBS.** The spec has a week-by-week roadmap, but no work breakdown with estimates or acceptance per package; effort was not tracked.
- **No user validation.** No interview, no test with a real team, no look at the real spreadsheet.

That is why the concept analysis ([02](02-concept-analysis.md)) and the WBS ([04](04-wbs.md)) were written afterwards, and why gate G1 ([00](00-process-status.md) §3) stops further investment until the need is confirmed.

## 4. Inputs carried into the concept analysis

- The stated goal: replace the spreadsheet (Feature List; design spec §1).
- The nine feature groups `FL-1`…`FL-9`, used to derive the needs `N-01`… in [02](02-concept-analysis.md) §3.
- The Feature List's import-cleaning rules (`FL-6`) and data-quality checks (`FL-5`), the only material that describes the current spreadsheet ([02](02-concept-analysis.md) §2).
- The roles and constraints from the design spec (§1–§2) and decisions #1–#15.
- The SkillMatrix context (`A-10`).
- The manager's feedback of 2026-10-05 (slow navigation, unclear requirements, language).
