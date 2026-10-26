# Concept Analysis (CA)

- **Status:** Draft v2 — backfilled after the MVP build; needs and assumptions not yet validated with users
- **Last updated:** 2026-10-26
- **Owner:** CertTracker team (DC34)
- **Sources:** `CertTracker - Feature List.pdf` (internal; not stored in this repository), [Design spec](../superpowers/specs/2026-09-26-certtracker-design.md), [Decisions](../decisions.md)

> **Tóm tắt (VI):** CA trả lời câu hỏi: thay bảng tính theo dõi chứng chỉ có đúng là vấn đề cần giải không, cho ai, và có đáng làm không. Tài liệu được viết bù sau khi đã build MVP, nên hầu hết nhu cầu và giả định vẫn ở mức **giả định**: chưa phỏng vấn người dùng, chưa xem bảng tính thật, chưa có số liệu nền. Tài liệu chỉ ghi những gì đã có nguồn (Feature List, spec, các quyết định); mọi điều chưa biết được gom vào danh sách ở §9 để lấy ý kiến.

## 1. Purpose

This document answers one question: **is replacing the team's certificate spreadsheet the right problem to solve, for whom, and is it worth the effort?** It was written after the MVP had already been built from the Feature List and the design spec. No user has been interviewed yet, so every need and assumption below is unconfirmed until the discovery interviews (WBS 1.2) and the pilot (WBS 9.2). Gate G1, before Phase 2 (AI), uses the result.

Status of a need or an assumption:

- `Assumed` — nobody outside the build team has confirmed it.
- `Partly evidenced` — some indirect evidence exists, but it does not settle the question.
- `Validated` — supported by both the discovery interviews and the pilot.
- `Contradicted` — evidence was found against it.
- `Decided` — assumptions only: a recorded project decision, not a user finding.

Nothing is `Validated` or `Contradicted` yet. *Proposed* marks a target the sponsor has not confirmed.

## 2. Problem and context

**The problem as stated.** Teams in DC34 track employee certifications in a spreadsheet (the Feature List says "Excel / Google Sheets"). The expected problems are:

1. the data goes stale, because nobody keeps it current;
2. expiring certificates are noticed too late;
3. a manager cannot see the team's state without manual work.

**Who raised it.** The DC34 team lead, in the Feature List: nine feature groups (`FL-1`…`FL-9`; seven core, two AI) for an application that replaces the spreadsheet. The three problems are the team lead's statement, not findings from users (`A-01`).

**Strategic context.** The data model is designed so that SkillMatrix, a proposed employee-skill repository whose main risk is stale data, can reuse it (design spec §1; `A-10`).

**The only evidence.** Two of the Feature List's five import-cleaning rules (normalise status spellings, trim spaces in CertType) suggest typing defects in the current sheet. They may be defensive, nobody in the build team has seen the file, and they say nothing about missed expiries or reporting effort.

## 3. Users and stakeholders

| Role | What they need from the tool |
|---|---|
| Sponsor (the team lead who wrote the Feature List) | Coverage and expiry risk at a glance; a basis for deciding further investment |
| Manager | Who holds or is studying which certificate; a warning before expiry; a monthly report without manual work |
| Member | Record their own certificates, progress and proof; see their own status |
| Admin | Maintain the organisation, catalogue and accounts; import the legacy spreadsheet cleanly |
| Data owner (to be named) | Approve storing personnel data in the cloud and decide its retention (`A-05`) |
| HR / L&D (to be named) | Rules for company-paid certificates and refunds, if they own them |
| SkillMatrix owner (to be named) | Decide whether SkillMatrix reuses the data (`A-10`) |

## 4. Needs

A need is the outcome a user wants, independent of CertTracker; [03](03-requirements.md) links every requirement to the needs it serves. `Partly evidenced` rests on the two cleaning rules in §2 (N-01, N-10), on the existence of a legacy file to import (N-05) or on one reviewer's feedback of 2026-10-05 (N-11, N-12).

| ID | Need | Who | Status |
|---|---|---|---|
| N-01 | Know at any time who holds which valid certificate, from one trusted record | Sponsor, Manager, Admin | Partly evidenced |
| N-02 | Be warned before a certificate expires, early enough to renew it | Member, Manager | Assumed |
| N-03 | Get a team or organisation report without manual work | Manager, Sponsor | Assumed |
| N-04 | Members record their own progress and proof, so the data does not depend on one person | Member, Admin | Assumed |
| N-05 | Bring the existing spreadsheet data across without retyping it | Admin | Partly evidenced |
| N-06 | Personal and certificate data is visible only to the right people and stored in a way the data owner accepts | Member, Data owner, Sponsor | Assumed |
| N-07 | Know which certificates the company paid for and the state of each refund | Sponsor, HR / L&D, Admin | Assumed |
| N-08 | See certificate coverage against project needs, including dependence on one or two people; reuse the data in SkillMatrix (Phase 2) | Manager, Sponsor, SkillMatrix owner | Assumed |
| N-09 | Decide who should study which certificate next, and plan it (Phase 2) | Manager, Member | Assumed |
| N-10 | Keep the catalogue and records clean: one name per course, consistent types, problems found early | Admin | Partly evidenced |
| N-11 | Read the tool in a language the user understands, with technical terms that make sense | Manager, Member | Partly evidenced |
| N-12 | The tool responds quickly enough that people keep using it | All roles | Partly evidenced |

A need that the interviews and the pilot do not confirm is a candidate to drop, together with the requirements that serve only that need.

## 5. Options considered

- **Keep the spreadsheet**, with manual reminders.
- **Improve the spreadsheet:** validation lists, expiry formatting, a scheduled reminder in the company's office tools, a pivot report.
- **Use an existing company system** (a learning or HR system), if one exists.
- **Wait for SkillMatrix**, or merge into it.
- **Build CertTracker** — chosen; the MVP is built.

The choice was made before the options were compared. The comparison, in particular whether an improved spreadsheet would be enough at a much lower cost, is not yet verified (WBS 1.4).

## 6. Success criteria

`SM-1` is the outcome that matters; `SM-2`…`SM-4` show that the product works, not that it helps; `SM-5` and `SM-6` need baselines that do not exist yet (WBS 1.6).

| ID | Criterion | Target |
|---|---|---|
| SM-1 | A real team stops using its spreadsheet | Sponsor and admin confirm it is no longer updated after at least two consecutive weeks of real use (*proposed* period) |
| SM-2 | Legacy data imports cleanly | A real file imports with zero unresolved error rows after cleaning; manual fixes recorded (*proposed*) |
| SM-3 | The weekly e-mail works | Two consecutive Mondays with Sent > 0 and Failed = 0 in the Settings history |
| SM-4 | Navigation feels immediate | Feedback at once; 75th-percentile page load under 1 second (*proposed*) |
| SM-5 | Less time spent on upkeep and reporting | Person-hours per month below the baseline (*proposed*; the sponsor sets the size of the reduction) |
| SM-6 | Expiries are handled in time | Fewer certificates expire without a renewal started beforehand than in the previous 12 months (*proposed*) |

## 7. Key assumptions

Gate G1 checks `A-01`…`A-10` (decision #46). `A-05` is a project decision (decision #1) that the data owner still has to confirm. The other assumptions of the previous draft (root cause, other data sources, refunds, cheaper alternatives) are now open points (§9).

| ID | Assumption | Status |
|---|---|---|
| A-01 | Teams track certificates in spreadsheets, and it is painful (stale data, late expiry warnings) | Assumed |
| A-02 | Managers want the Monday e-mail and will read it | Assumed |
| A-03 | Members will update their own progress and evidence | Assumed |
| A-04 | The legacy Excel file imports with acceptable effort | Assumed |
| A-05 | Storing names and work e-mails in a cloud service is acceptable | Decided |
| A-06 | Showing the personal ranking only to managers and admins is the right privacy trade-off | Assumed |
| A-07 | Users prefer a Vietnamese interface with English technical terms, or a language switch | Assumed |
| A-08 | The Phase 2 AI features are wanted, in the planned priority order | Assumed |
| A-09 | Data volume stays small (hundreds of members, thousands of records) | Assumed |
| A-10 | SkillMatrix will consume CertTracker data | Assumed |
| A-15 | Managers spend noticeable time compiling certificate reports today | Assumed |

## 8. Constraints

- Cloud SaaS (Supabase Cloud + Vercel) is allowed for this data (decision #1); the data owner's approval is pending (`A-05`).
- A team of 1–2 developers, TypeScript only (decision #4).
- Free tiers during the foundation phase and the pilot: Vercel Hobby is non-commercial; Supabase Free pauses after 7 idle days and has no automatic backups (decision #13).
- Row Level Security is the main security layer; user queries run with the user's own token (decision #5).
- No self sign-up; an admin creates accounts (decision #12).
- Interface in English and Vietnamese with a switch, not scheduled before G1 (decision #48); process documents in English (decision #47).

## 9. Open points (to be confirmed)

**Current practice**

- Number of people, teams and certificate rows to track (`A-09`)
- Current tool and process: which file, where, other copies, who updates it and how often (`A-01`, `A-03`)
- Where company-paid certificates and refunds are tracked, and who owns the refund policy (`N-07`)

**Size of the problem**

- Certificates that expired in the last 12 months, and how many were renewed in time (`SM-6`, `N-02`)
- Hours per month spent on keeping the sheet current and on reports (`SM-5`, `A-15`)
- Main cause of stale data: tooling, missing reminders, or no incentive or ownership to update (`A-01`, `A-03`)
- Whether an improved spreadsheet or an existing company system would be enough (WBS `1.4`)

**People**

- Names of the data owner, the person who signs G1 and the HR / L&D contact (`A-05`, G1)
- Whether SkillMatrix will use this data, and who owns it (`A-10`, `N-08`)

**Scope and preferences**

- Phase 2 features wanted, and in what order (`A-08`)
- Preferred interface language (`A-07`, `N-11`)
- Whether a personal ranking visible to managers and admins is acceptable (`A-06`)
