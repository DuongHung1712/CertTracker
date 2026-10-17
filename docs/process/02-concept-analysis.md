# Concept / Customer Analysis (CA)

- **Status:** Draft v1 — backfilled after the MVP build (see `00-process-status.md`); instruments ready, data missing
- **Last updated:** 2026-10-17
- **Owner:** CertTracker team (DC34)
- **Sources:** `CertTracker - Feature List.pdf` (internal; not stored in this repository), S+ AI Tooling Initiative proposal (internal; not stored in this repository), [Idea and brainstorm](01-idea-and-brainstorm.md), [Design spec](../superpowers/specs/2026-09-26-certtracker-design.md), [Decisions](../decisions.md), [2026-10-05 design](../superpowers/specs/2026-10-05-process-docs-and-ux-feedback-design.md), [WBS](04-wbs.md)

> **Tóm tắt (VI):** CA trả lời câu hỏi "đây có đúng là vấn đề cần giải, cho ai, và có đáng công không?". Hiện gần như mọi thứ vẫn là **giả định**: chưa phỏng vấn người dùng, chưa xem bảng tính thật, chưa có số liệu nền. Bằng chứng duy nhất là các quy tắc làm sạch khi import trong Feature List, và nó yếu: chỉ hai quy tắc (cách viết trạng thái không thống nhất, CertType thừa khoảng trắng) **gợi ý** lỗi nhập liệu; ba quy tắc còn lại không phải bằng chứng lỗi của người dùng, và các quy tắc có thể chỉ được viết để phòng hờ. Tài liệu này liệt kê nhu cầu (`N-xx`), quy trình hiện tại và các điều chưa biết, giả thuyết nguyên nhân gốc, các bên liên quan, phương án thay thế (kể cả "cải tiến bảng tính" có thể rẻ hơn nhiều), khung business case với một điểm kiểm tra đề xuất trước pilot, ràng buộc, chỉ số thành công, giả định (`A-xx`) và bộ công cụ kiểm chứng (checklist dữ liệu, cách chọn người; kịch bản phỏng vấn khám phá và mẫu ghi chép ở Phụ lục A). Mọi chỗ chưa biết ghi "Not yet known" kèm câu hỏi, ai trả lời và cách thu thập.

> **What we ask of the sponsor** (details in §12 (a) and §6; collected in WBS 1.6):
>
> - Counts: people to be tracked, teams, certificate rows today.
> - The spreadsheet itself, or an anonymised copy, and a list of any other place that holds certificate data.
> - Certificates that expired in the last 12 months, and how many had a renewal started before expiry.
> - Hours spent last month keeping the sheet current and producing reports.
> - Where company-paid certificates and refunds are tracked, and which office tools and HR or learning systems the company uses.
> - Names: the data owner, who signs gate G1, the HR / L&D contact for certifications and refunds (and the SkillMatrix owner, if known).

## 1. Purpose and status

The concept analysis answers one question: **is this the right problem, for whom, and is it worth the effort?** In the recommended process it comes before the WBS and before anything is built. For CertTracker it was written afterwards: the MVP was built first from the Feature List and the design spec ([01](01-idea-and-brainstorm.md) §3).

Today almost everything below is *Assumed*. No user has been interviewed, the real spreadsheet has not been seen, and no baseline number exists. Every gap has an ID, and §12 and Appendix A provide the instruments to close them. Gate G1 ([00](00-process-status.md) §3) uses the result.

Conventions:

- **Status** of a need (§3) or an assumption (§11):
  - `Assumed` — nobody outside the build team has confirmed it;
  - `Partly evidenced` — some evidence exists and is named, but it does not settle the question;
  - `Validated` — the discovery interviews and the pilot both support it;
  - `Contradicted` — evidence was found against it (write what was found);
  - `Decided` — assumptions only: a recorded project decision, not a user finding (today only `A-05`).
  
  Nothing is `Validated` or `Contradicted` yet; `src/lib/process-docs.test.ts` checks both vocabularies and fails if anything is marked `Validated` before an interview result is recorded.
- **Not yet known** always comes with the question, who can answer it and how it will be collected.
- *proposed* marks a target, rule or checkpoint that the sponsor has not confirmed.

## 2. Problem statement

Teams in DC34 track employee certifications in a spreadsheet (the Feature List says "Excel / Google Sheets"; which one is not known). The expected problems are:

1. the data goes stale, because nobody keeps it up to date;
2. expiring certificates are noticed too late;
3. a manager cannot get a team-level view without manual work.

All three are **Assumed** (`A-01`). They come from the Feature List and the design spec, not from users.

**The only evidence, and how weak it is.** The Feature List's import-cleaning rules (`FL-6`) **suggest** what the current spreadsheet looks like. They may also be defensive, written in case the file has such problems, so they do not prove that it does:

| Cleaning rule (FL-6) | What it suggests about the current spreadsheet |
|---|---|
| Normalise status to three standard values | Status may be typed in several spellings — a possible typing defect |
| Trim spaces in CertType | CertType values may carry stray spaces, so one type can look like several — a possible typing defect |
| Convert progress from a decimal to % | Not evidence of user error: Excel stores a percent-formatted cell as a fraction (0.75 for 75%), and a program reads that fraction (decision #23) |
| Remove dates stored as Excel serial numbers | Not evidence of user error: Excel stores dates as serial numbers, and a program can read the number instead of the date |
| De-duplicate members by e-mail | Not a defect: it shows the sheet's likely shape, one flat sheet with one row per person per certificate, so a person with several certificates appears on several rows. The importer and its synthetic fixture model the sheet that way (`src/features/import/workbook.ts`, `src/features/import/__fixtures__/legacy-workbook.ts`); the real shape is not confirmed |

So **three of the five rules are not evidence of user error**, and the other two only suggest it. The data-quality checks in `FL-5` (wrong member or course references, status and progress that disagree, badly formatted dates) are of the same kind: features asked for, not measurements. Further limits:

- It all comes from the person who wrote the Feature List, not from looking at the file. How many rows are affected is **Not yet known** (answered by the real-file trial, WBS 1.3, and the data checklist, §12 (a)).
- The importer's size limits (2000 rows and 4 MB per file) were set from platform limits (decision #24) and an assumed sheet size, not from the real file (`A-09`).
- It says nothing about problems 2 and 3 (late expiry warnings, manual reporting), and nothing about how much any of it costs the team.

**Strategic context.** CertTracker's data model is designed to feed SkillMatrix, a proposed employee-skill repository whose main risk is stale data (design spec §1; S+ AI Tooling Initiative proposal, internal and not stored here). Whether SkillMatrix will consume this data is `A-10`.

## 3. Needs

A need is written as the outcome a user wants, independent of CertTracker. Needs are derived from the problem statement, the roles (§6) and the Feature List groups ([01](01-idea-and-brainstorm.md) §1); [03](03-requirements.md) §2 links every requirement to the needs it serves.

| ID | Need (as a user outcome) | Who | Evidence today | Linked assumptions | Status |
|---|---|---|---|---|---|
| N-01 | Know at any time who holds which valid certificate, from one record that can be trusted | Sponsor, Manager, Admin | Weak: two FL-6 cleaning rules (status spellings, untrimmed CertType) suggest typing defects in the current sheet, and the rules may be defensive (§2); the Feature List states the goal of replacing the sheet | A-01, A-11, A-14 | Partly evidenced |
| N-02 | Be warned before a certificate expires, early enough to renew it | Member, Manager | Requested in FL-3 and FL-5; no evidence yet that expiries are missed today | A-02, A-12 | Assumed |
| N-03 | Get a team or organisation report without manual work | Manager, Sponsor | Requested in FL-4 and FL-5; how reports are made today is not known (§4) | A-01, A-15 | Assumed |
| N-04 | Members record their own progress and proof, so the data does not depend on one person | Member, Admin | Decision #2 (a design choice, not a user finding) | A-03, A-13 | Assumed |
| N-05 | Bring the existing spreadsheet data across without retyping it | Admin | FL-6 asks to import the old Excel file, so a legacy file exists; its size and condition are not known (§2) | A-04, A-09 | Partly evidenced |
| N-06 | Personal and certificate data is visible only to the people who should see it, and stored in a way the data owner accepts | Member, Data owner, Sponsor | FL-7 and the AI principles in FL-9 ask for it; decisions #1, #5 and #8 | A-05, A-06 | Assumed |
| N-07 | Track which certificates the company paid for and the state of each refund | Sponsor, HR / L&D, Admin | FL-2 and FL-3 list refund fields; who owns the refund policy and where refunds are tracked today is not known | A-16 | Assumed |
| N-08 | See certificate coverage against what projects need, including dependence on one or two people; reuse the same data in SkillMatrix later (Phase 2) | Manager, Sponsor, SkillMatrix owner | Requested in FL-9; SkillMatrix context from the S+ proposal (not stored here) | A-08, A-10, A-17 | Assumed |
| N-09 | Decide who should study which certificate next, and plan it (Phase 2) | Manager, Member | Requested in FL-8 | A-08 | Assumed |
| N-10 | Keep the catalogue and the records clean (one name per course, consistent types, problems found early) | Admin | Weak: the same two FL-6 rules as N-01 (§2) | A-04, A-11 | Partly evidenced |
| N-11 | Read the tool in a language the user understands, with technical terms that make sense | Manager, Member | The manager's feedback of 2026-10-05: the all-Vietnamese interface with translated technical terms was hard to read (one reviewer) | A-07 | Partly evidenced |
| N-12 | The tool responds quickly enough that people keep using it | All roles | The manager's feedback of 2026-10-05: moving between pages feels slow (one reviewer); the cause is partly a hypothesis ([04](04-wbs.md) §4) | A-03 | Partly evidenced |

Notes:

- `Partly evidenced` never means the need is confirmed. N-01 and N-10 rest on two Feature List rules that only suggest defects; N-05 on the existence of a legacy file; N-11 and N-12 on one reviewer's feedback.
- The discovery interviews (WBS 1.2) and the pilot (WBS 9.2) update the Status column; a need that nobody confirms is a candidate to drop, together with the requirements that serve only that need.

## 4. Current process (as-is)

**What is known.**

- Certificates are tracked in a spreadsheet, Excel or Google Sheets (Feature List).
- The columns are implied by the Feature List: member (name, e-mail, team, program, DC), course or certificate (name, CertType, provider, level, validity in months, refund information, course link), and per person: planned exam date, issue date, certificate link, registered through the company, refund status, progress, status and notes. These are **implied**, not confirmed: nobody in the build team has seen the file.
- Expiry appears to be worked out by hand or not at all: the Feature List asks the application to compute it. Whether status and progress are typed in free form is only suggested by the cleaning rules (§2).

**What is not known.**

| # | Question | Who can answer | How it will be collected |
|---|---|---|---|
| Q-01 | Which tool is it (Excel file, Google Sheet, several files), and where does it live? | Admin | Data checklist §12 (a); a copy of the file |
| Q-02 | Who updates the sheet: the members themselves, a manager, or one administrator? | Admin, Manager | Discovery interview (Appendix A); compare with the file's edit history if the tool keeps one |
| Q-03 | How often is it updated, and when was it last fully correct? | Admin | Discovery interview; edit history |
| Q-04 | How does a manager produce a certification report today, for whom, how often, and how long does it take? | Manager, Sponsor | Discovery interview; the last report as an example |
| Q-05 | Where are company-paid certificates and refunds tracked (this sheet, HR, finance, nowhere)? | Sponsor, HR / L&D | Ask the sponsor; ask HR / L&D (to be identified) |
| Q-06 | How is an upcoming expiry noticed today (calendar, vendor e-mail, nobody)? | Member, Manager | Discovery interview |
| Q-07 | How many certificates expired in the last 12 months, and how many of those were renewed in time? | Admin | Count from the real file (§12 (a)); vendor portals if the file lacks dates |
| Q-08 | How many people, teams and certificate rows are involved? | Admin | Data checklist §12 (a) (`A-09`) |
| Q-09 | Is there more than one source (per-team copies, HR records, vendor portals)? | Admin, Sponsor | Discovery interview; inventory in §12 (a) |
| Q-10 | Who outside the team uses the data (HR, project staffing, vendor partner programmes)? | Sponsor | Ask the sponsor |

## 5. Root-cause hypotheses

Why would the data go stale and expiries be missed? Each hypothesis below is untested.

| # | Hypothesis | If true, does CertTracker fix it? | How to test | Assumption |
|---|---|---|---|---|
| H-1 | **Tooling friction:** updating the sheet is slow or error-prone (many columns, free-text status, no validation), so people put it off | Partly: forms with fixed values and validation, members edit their own records. An improved spreadsheet could also fix much of this (§7 option b) | Watch one person update a row in the current sheet; ask about the last update; count defects in the real file | A-11 |
| H-2 | **No reminders:** nobody is prompted when a certificate nears expiry | Yes, if issue dates and validity are recorded: the Monday e-mail (R-12). A scheduled reminder in the company's office tools could do the same (§7 option b) | Count expiries in the last 12 months and how many were renewed in time (Q-07); ask how expiry is noticed today (Q-06) | A-12 |
| H-3 | **No ownership or incentive:** members gain nothing from keeping their record current, and nobody is accountable for the sheet | **No.** A tool alone does not create a reason to update. It needs a rule from the sponsor (for example: refunds or reviews require a current record) | Ask the sponsor and HR / L&D whether any policy requires an up-to-date record; ask members what led them to update, or not | A-13 |
| H-4 | **Duplicated sources:** several copies or systems hold certificate data, so none is trusted | Partly: only if CertTracker becomes the one agreed source, which needs a decision by the sponsor, not code | Inventory of sources (Q-09) | A-14 |
| H-5 | **No visibility for managers:** a manager must ask people or rebuild the sheet to see the team's state, so nobody looks until it is too late | Yes for visibility (Dashboard, monthly e-mail), if the data is current (depends on H-1 and H-3) | Ask managers how they made the last report and how long it took (Q-04) | A-15 |
| H-6 | **Inconsistent data entry:** free-form values make the sheet unreliable even when it is updated | Yes: fixed values, constraints and the import cleaning (R-14, R-15). Validation lists in a spreadsheet also help | Count status spellings and CertType variants in the real file (WBS 1.3) | A-04, A-11 |

**Stated plainly:** if the main cause turns out to be H-3 (incentives and ownership), CertTracker alone will not fix the problem. The answer would then be a rule from the sponsor, possibly with a much simpler tool. §8 proposes that this question is answered before the pilot and brought to G1.

## 6. Stakeholders

Interest and influence are the build team's *proposed* reading, to be corrected by the sponsor.

| Role | Who | Job to be done | Interest | Influence |
|---|---|---|---|---|
| Sponsor | The manager / lead who commissioned the Feature List | Know the team's certification coverage and expiry risk; decide whether to invest further | High | High (decides) |
| Admin | Person who administers the data (org structure, catalogue, imports, accounts) | Replace the spreadsheet; import legacy data cleanly; keep the catalogue tidy | High | Medium |
| Manager | Leads one or more teams | See who holds or is studying which certificates, get warned before they expire, report monthly | High | Medium |
| Member | Employee | Record own certificates and progress with proof; see own status | Medium (*Not yet known*: depends on what members gain, H-3) | Low individually; high together (adoption) |
| Data owner | To be named by the sponsor (the person responsible for the personnel data) | Approves storing personnel data in the cloud (`A-05`) and decides its retention | Medium | High (can block the pilot) |
| HR / L&D | **Not yet known** whether HR or L&D owns the certification and refund policy. Question for the sponsor (Q-05) | Refund rules; possibly a training or HR system that already holds this data (§7 option c) | Not yet known | Not yet known (could make a rule that settles H-3) |
| SkillMatrix owner | **Not yet known**; the sponsor is asked to name them (`A-10`) | Decide whether SkillMatrix will consume CertTracker data | Not yet known | Medium (shapes Phase 2, N-08) |
| Developer (owner) | The developer who built CertTracker | Build, operate, run the validation | High | Medium |

**Who signs gate G1** is an open question for the manager. The responsibilities in [08](08-production-readiness.md) §4 *propose* the Sponsor as accountable for G1; that has not been confirmed. No end user has been interviewed yet (`A-01`, `A-03`).

## 7. Alternatives

Every cell is the build team's judgement **to be verified in WBS 1.4** (build-vs-buy scan). No product prices or vendor claims are made. Values: **meets**, **partly**, **no**, **unknown**. For option (e), "meets" means built and tested by the build team, **not** validated by users.

Options:

- **(a) Keep the spreadsheet as it is**, with manual reminders.
- **(b) Improve the spreadsheet:** validation lists for status and CertType, conditional formatting for expiry, a scheduled script or flow in the company's office tools that e-mails upcoming expiries, a pivot or chart for the report. Which tools the company uses, and what they allow, is **Not yet known** (to verify in 1.4).
- **(c) An existing company system** (a learning-management or HR system), if one exists: **Not yet known**; question for the sponsor and HR / L&D.
- **(d) Wait for, or merge into, SkillMatrix**: its scope, timing and owner are **Not yet known** here.
- **(e) Build CertTracker** (the current path).

| Need | (a) Keep | (b) Improve sheet | (c) Company system | (d) SkillMatrix | (e) CertTracker |
|---|---|---|---|---|---|
| N-01 one trusted record | no | partly (validation reduces bad values; still one shared file) | unknown | unknown | meets |
| N-02 warned before expiry | no | partly to meets (if the office tools allow a scheduled e-mail; to verify) | unknown | unknown | meets (W6, unmerged; not yet sent through Resend) |
| N-03 report without manual work | partly (manual) | partly (template pivot / chart) | unknown | unknown | meets |
| N-04 members record their own | unknown (depends on sharing today) | unknown (whether each member can be limited to their own rows; to verify) | unknown | unknown | meets |
| N-05 legacy data without retyping | meets (nothing to move) | meets (clean the same file once) | unknown | unknown | meets on synthetic data; the real file is untried (WBS 1.3) |
| N-06 right people see the data | unknown | unknown (row-level permissions to verify) | unknown | unknown | meets (RLS, tested locally) |
| N-07 company-paid and refunds | unknown (Q-05) | partly (columns) | unknown | unknown | meets (fields exist) |
| N-08 coverage vs project needs | no | no / partly (manual) | unknown | unknown (stated purpose of SkillMatrix; not verified) | no (Phase 2, gated) |
| N-09 plan who studies next | no | no | unknown | unknown | no (Phase 2, gated) |
| N-10 clean catalogue and records | no | partly (validation lists) | unknown | unknown | partly (constraints, import cleaning, data-quality page; no AI help) |
| N-11 understandable language | meets (whatever the team uses) | meets | unknown | unknown | partly (Vietnamese only today; switch planned, WBS 8.2) |
| N-12 responsive | meets (assumed) | meets (assumed) | unknown | unknown | partly (navigation reported slow; WBS 8.1) |
| Cost | none beyond today's effort | low, to be estimated in WBS 1.4 | unknown | unknown | built in 9 calendar days (hours not tracked); cost still ahead in §8 |

**Stated honestly:** option (b) might cover N-01 (partly), N-02, N-03, N-05, N-07 and N-10 (partly) at much lower cost and with no new system for users to learn. Option (e) is stronger on N-04 and N-06 (per-person editing and per-row permissions) and is the only option already built, but "already built" is a sunk cost, not a reason. Checking this comparison is exactly the job of WBS 1.4 (`A-18`).

## 8. Value and cost (business case skeleton)

**Benefits.** Each benefit is a hypothesis with a metric. No baseline exists; each one must be measured **before** the pilot (WBS 1.6, checklist §12 (a)) so that the pilot can be compared with it.

| # | Benefit hypothesis | Metric | Baseline | Target | Linked |
|---|---|---|---|---|---|
| B-1 | Less time spent maintaining the sheet and producing reports | Person-hours per month for upkeep and reporting | **Not yet known.** Ask the admin and one manager to estimate last month's hours, and time the next report before the pilot | *proposed*: lower than the baseline; the size of the reduction is set by the sponsor once the baseline is known | SM-5, A-15 |
| B-2 | Fewer certificates expire unnoticed | Certificates that expired in the last 12 months without a renewal started beforehand | **Not yet known.** Count from the real file (issue date + validity) or vendor portals (Q-07) | *proposed*: fewer than the baseline in the 12 months after go-live | SM-6, A-12 |
| B-3 | Renewals start in time | Share of certificates expiring in a period whose renewal (planned exam date or new issue date) was recorded before expiry | **Not yet known.** Same source as B-2 | *proposed*: higher than the baseline | SM-7, A-12 |
| B-4 | Company-paid certificates and refunds are known | Share of company-paid certificates with a recorded refund status; total refund amount known | **Not yet known**, including where this is tracked today (Q-05) | *proposed*: every company-paid certificate in the pilot team has a refund status | SM-8, A-16 |
| B-5 | Certification counts needed for vendor partner programmes are available on demand | Time to answer "how many valid certificates of vendor X do we have?" | **Not yet known**, including whether this matters to DC34 at all (Q-10) | Set only if the sponsor confirms it is relevant | A-17 |

**Costs.**

| Item | Known | Not yet known |
|---|---|---|
| Build so far | Calendar window 2026-09-26 → 2026-10-04 ([04](04-wbs.md) §3); AI-assisted. Already spent: not part of any decision below | Person-hours: **not tracked**, so no cost can be stated |
| Hosting today | Free tiers, Vercel Hobby + Supabase Free (decision #13); e-mail sending is sized for the Resend free plan (decision #40) | — |
| Production hosting | — | Decided in WBS 9.3; decision #13 says to move off the free tiers before official use ([08](08-production-readiness.md) PRD-01, PRD-02) |
| Still ahead after 1.4 and 1.6 (the checkpoint below), before G1 | Estimates in [04](04-wbs.md), assuming 1.1 is finished: 1.2 (2–3 days), 1.3 (0.5–1), 1.5 (0.5), 8.1 (0.5–1), 8.4 (1–2), 9.1 (1–2), 9.3 (1–2), i.e. about 6.5–11.5 developer days, plus the pilot (one set-up week and two calendar weeks, 9.2). Ranges, not commitments | The time of the people interviewed and of the pilot team; not estimated |
| After G1 | 9.4 production readiness 3–6 days; 8.2 language switch 4–7 days and 8.3 self sign-up 2–4 days if wanted ([04](04-wbs.md)) | Phase 2 (AI) is re-estimated after G1; AI service costs not known |
| Maintenance | — | Effort per month after go-live; nobody has estimated it |

**Proposed checkpoint after 1.4 and 1.6, before the pilot** (*proposed; the sponsor confirms*). Once the alternatives are checked (1.4) and the baselines are in (1.6), continue to the pilot only if the expected benefit (B-1…B-5 against their baselines) justifies **the cost still ahead at that point** — the rows "Still ahead" and "After G1" above, plus production hosting — and not the work already spent. Three outcomes: continue with CertTracker; switch to a cheaper alternative from §7; or stop. If the baselines cannot be collected, that itself is a finding for the sponsor.

**Proposed additional input to G1** (*to be confirmed by the sponsor*). The official G1 conditions stay those of [00](00-process-status.md) §3 and decision #46. This document proposes that the sponsor also weighs at G1: (1) the business case and the alternatives judgement above, and (2) the incentives question of §5 (H-3, `A-13`): whether anything makes members keep their records current.

## 9. Constraints

| Constraint | Source |
|---|---|
| Cloud SaaS is allowed for this data (Supabase Cloud + Vercel) | Decision #1 |
| A team of 1–2 developers, TypeScript only | Decision #4 |
| Free tiers during the foundation phase and the pilot (Vercel Hobby non-commercial; Supabase Free pauses after 7 idle days and has no automatic backups) | Decision #13 |
| Row Level Security is the main security layer; user queries run with the user's token | Decision #5; rules in `CLAUDE.md` |
| Self sign-up is disabled; an admin creates accounts | Decision #12 |
| Interface in English and Vietnamese with a switch (planned, unscheduled until after G1); process documents in English | Decisions #48 and #47 |
| Storing names, work e-mails and evidence files in the cloud needs the data owner's approval, which is pending | `A-05`; [08](08-production-readiness.md) PRD-15 |

## 10. Success criteria

`SM-1`…`SM-4` are unchanged in meaning. `SM-3` and `SM-4` are technical health metrics: they show the product works, not that it helps. `SM-2` is a data-quality outcome: it shows the legacy data can move across, not that anyone benefits. `SM-1` and `SM-5`…`SM-8` are customer outcomes. `SM-5`…`SM-8` are new and *proposed*; their baselines are collected in WBS 1.6.

| ID | Criterion | Target | Basis | Baseline |
|---|---|---|---|---|
| SM-1 | A real team stops using its spreadsheet | The sponsor and the admin confirm the spreadsheet is no longer updated, after at least two consecutive weeks of real use — *proposed; the sponsor decides the final period* (aligned with gate G1 in `00-process-status.md` §3) | Design spec §1 (phase-1 goal) | Today: the spreadsheet is in use |
| SM-2 | Legacy data imports cleanly | A real file imports with zero unresolved error rows after cleaning; manual fixes recorded | Design spec §10 — *proposed numeric target to confirm with the sponsor* | Not yet known (WBS 1.3) |
| SM-3 | Weekly e-mail works | The Monday e-mail runs correctly on two consecutive Mondays with no failed delivery (Settings history shows Sent > 0, Failed = 0) | Design spec §10 | None sent yet |
| SM-4 | Navigation feels immediate | Moving between pages shows feedback at once and the 75th-percentile page load stays under 1 second — *proposed; confirm after re-measuring with the same method* | Manager feedback (2026-10-05); measurements in `04-wbs.md` item 8.1 | Signed-out pages only ([04](04-wbs.md) §4); signed-in pages not measured |
| SM-5 | Less time on upkeep and reporting | *proposed*: person-hours per month below the baseline; the reduction is set by the sponsor | B-1 | Not yet known (WBS 1.6) |
| SM-6 | Fewer expiries go unnoticed | *proposed*: fewer certificates expire without a renewal started beforehand than in the 12 months before | B-2 | Not yet known (WBS 1.6) |
| SM-7 | Renewals start before expiry | *proposed*: the share of renewals started before expiry is higher than the baseline | B-3 | Not yet known (WBS 1.6) |
| SM-8 | Refund status is known | *proposed*: every company-paid certificate of the pilot team has a refund status | B-4 | Not yet known (WBS 1.6; Q-05) |

## 11. Assumptions

`A-01`…`A-10` keep their meaning. `A-11`…`A-18` are new: they turn the root-cause hypotheses (§5) and the business case (§8) into checkable statements. Gate G1 condition 1 names `A-01`…`A-10` (decision #46); whether `A-11`…`A-18` are added to the gate is for the sponsor (*proposed*: yes, because they decide whether a build is needed at all).

| ID | Assumption | How to validate | Who | Status |
|---|---|---|---|---|
| A-01 | Teams track certificates in spreadsheets and it is painful (stale data, late expiry warnings) | Discovery interviews with 4–5 people (Appendix A); look at a real spreadsheet | Sponsor + owner | Assumed |
| A-02 | Managers want the Monday e-mail and will read it | Two Mondays of the pilot; post-pilot interview ([07](07-poc-and-mvp.md) §6) | Owner | Assumed |
| A-03 | Members will update their own progress and evidence | Observe two members doing it; compare update counts during the pilot; post-pilot interview | Owner | Assumed |
| A-04 | The legacy Excel imports with acceptable effort | Import a real file (week-4 trial); record manual fixes (`SM-2`) | Admin | Assumed |
| A-05 | Storing names and e-mails in a cloud service is acceptable | Recorded in decisions #1; confirm with the data owner before production | Sponsor | Decided |
| A-06 | Showing the personal ranking only to managers/admins is the right privacy trade-off | Ask in the discovery interviews | Owner | Assumed |
| A-07 | Users prefer a Vietnamese interface with English technical terms (or a switch) | Ask in the discovery interviews and the post-pilot interview; input to the i18n design | Owner | Assumed |
| A-08 | The Phase 2 AI features are wanted and in this priority order | Show the list; rank with the sponsor and managers (gate G1) | Sponsor | Assumed |
| A-09 | Data volume stays small (hundreds of members, thousands of records) | Ask for real counts | Admin | Assumed |
| A-10 | SkillMatrix will consume CertTracker data | Confirm with the SkillMatrix owner | Sponsor | Assumed |
| A-11 | Updating the current sheet is slow or error-prone enough that people put it off (H-1, H-6) | Watch one update; count defects in the real file (WBS 1.3); Appendix A question 4 | Owner, Admin | Assumed |
| A-12 | Certificates expire unnoticed today: at least some expired in the last 12 months without a renewal started in time (H-2) | Count from the real file or vendor portals (Q-07, WBS 1.6) | Admin | Assumed |
| A-13 | Members have, or can be given, a reason to keep their own record current (a policy, refunds, reviews) (H-3) | Ask the sponsor and HR / L&D; Appendix A question 9 | Sponsor | Assumed |
| A-14 | There is one main source of certificate data that CertTracker can replace; other copies can be retired (H-4) | Inventory of sources (Q-09) | Admin, Sponsor | Assumed |
| A-15 | Managers spend noticeable time compiling certificate reports today (H-5) | Ask for last month's hours; time the next report (Q-04, WBS 1.6) | Manager | Assumed |
| A-16 | Tracking company-paid certificates and refunds matters to someone who will use it | Ask the sponsor and HR / L&D who owns refunds and where they are tracked (Q-05) | Sponsor | Assumed |
| A-17 | Certification counts per vendor matter for DC34 (for example vendor partner programmes) | Ask the sponsor (Q-10); if not relevant, drop B-5 | Sponsor | Assumed |
| A-18 | An improved spreadsheet or an existing company system cannot meet the Must needs at a clearly lower total cost | Build-vs-buy scan over §7 (WBS 1.4) | Owner, Sponsor | Assumed |

## 12. Validation kit

The kit is ready; the data is missing. WBS 1.6 collects (a). WBS 1.2 then runs the **discovery interviews**, before the pilot, with the people chosen as in (b) and the script, recording template and update rules in Appendix A. The pilot has its own short post-pilot interview ([07](07-poc-and-mvp.md) §6).

### (a) Data to collect from the sponsor and the admin before the interviews

- [ ] Number of people who should be tracked, and number of teams (Q-08, `A-09`).
- [ ] Number of certificate rows today, and how many courses or certificate types.
- [ ] The spreadsheet itself, or an anonymised copy (Q-01), so that WBS 1.3 can run and the rules of §2 can be checked against it.
- [ ] All other places that hold certificate data (Q-09, `A-14`).
- [ ] Certificates that expired in the last 12 months, and how many had a renewal started before expiry (Q-07, B-2, B-3).
- [ ] Hours spent last month on keeping the sheet up to date and on reports; the next report timed (Q-04, B-1).
- [ ] Who owns the refund policy, where company-paid certificates and refunds are tracked, and (if available) last year's count (Q-05, B-4).
- [ ] Whether vendor partner programmes or other external uses of the counts exist (Q-10, B-5).
- [ ] Which office tools the company uses, and whether a learning-management or HR system exists (§7 options b and c).
- [ ] Names, given by the sponsor: data owner, SkillMatrix owner, HR / L&D contact, who signs G1 (§6).

### (b) Recruitment

4–5 people (1 manager, 1 admin, 2–3 members). Plan 40–45 minutes for the manager and the admin, about 30 minutes for each member. How to pick:

- From the team that is most likely to run the pilot (WBS 9.2), so that the interview and the pilot describe the same situation.
- The admin is whoever maintains the spreadsheet today, if there is such a person.
- Members: at least one who holds or is studying a certificate with an expiry date, and at least one who rarely updates the sheet (ask the admin). Do not pick only enthusiasts.
- Nobody from the build team. The sponsor may introduce the interviews but should not sit in on the members' interviews.

## 13. Gaps and next actions

| # | Gap | Status | Owner (role) | WBS |
|---|---|---|---|---|
| GAP-01 | Evidence and numbers | Data missing | Sponsor, Admin | 1.6 |
| GAP-02 | Need → requirement traceability | Addressed | Developer (owner) | 1.1 |
| GAP-03 | Current process (as-is) | Data missing | Admin, Manager | 1.2, 1.6 |
| GAP-04 | Root cause | Open, untested | Developer (owner), Sponsor | 1.2 |
| GAP-05 | Business case | Data missing | Sponsor | 1.6 |
| GAP-06 | Alternatives | Open, not verified | Developer (owner) | 1.4 |
| GAP-07 | Outcome metrics with baselines | Data missing | Sponsor, Admin | 1.6 |
| GAP-08 | Stakeholder decision rights | Open | Sponsor | 1.6 |
| GAP-09 | Constraints | Addressed | Developer (owner) | 1.1 |
| GAP-10 | Interview instruments | Ready; interviews not done | Developer (owner) | 1.2 |

## 14. Risks

Risks to the concept itself (operational risks of the pilot and production are in [07](07-poc-and-mvp.md) §7 and [08](08-production-readiness.md) §2):

1. **The need is weaker than assumed** → the discovery interviews, the proposed checkpoint (§8) and gate G1; stopping or re-scoping is a valid outcome.
2. **The root cause is wrong**, in particular incentives and ownership rather than tooling (H-3, `A-13`) → a new tool does not help; ask the sponsor for a rule before the pilot.
3. **A cheaper alternative is enough** (§7 option b or c, `A-18`) → WBS 1.4 before more is built.

## Appendix A — Interview kit (discovery interviews, WBS 1.2)

Used **before** the pilot, after the data collection in §12 (a). The post-pilot interview is separate ([07](07-poc-and-mvp.md) §6).

### A.1 Script

Open questions only. Do not show CertTracker before question 10, and do not describe its features while asking about today. Ask for the last real example rather than opinions. **Must ask** lists the roles for whom a question is never skipped; with members (about 30 minutes) the other questions are asked only if time allows.

| # | Question | Ask | Must ask | Maps to |
|---|---|---|---|---|
| 1 | Tell me about the last time you needed to know who holds a certificate. What did you do? | All | Manager, Admin | N-01, A-01 |
| 2 | Where is certificate information kept today? Is there more than one place? | Admin, Manager | Admin | Q-01, Q-09, A-14 |
| 3 | Who changes the spreadsheet, and when did you last change it yourself? | All | All | Q-02, Q-03, A-03 |
| 4 | Walk me through the last time you updated it. What happened next? | Member, Admin | Member, Admin | A-11, H-1 |
| 5 | Think of the last certificate that expired. How was it noticed, and what happened next? | All | All | Q-06, A-12, N-02 |
| 6 | How did you make the last certification report? Who was it for, and how long did it take? | Manager, Admin | Manager | Q-04, A-15, N-03 |
| 7 | How are company-paid certificates and refunds handled? Where is that recorded? | Manager, Admin | Admin | Q-05, A-16, N-07 |
| 8 | Who should be able to see your certificates and progress? Who should not? | Member, Manager | — | N-06, A-06; input for the data owner |
| 9 | When did you last update your own record, and what led you to do it, or not to? | Member | Member | A-13, A-03, H-3 |
| 10 | (Now show the tool or the screenshots in [06](06-design-and-mockups.md) §4b.) What would you use, and what would you not use? | All | Manager, Member | A-03, N-04 |
| 11 | Which words on these screens were unclear? | All | — | A-07, N-11 |
| 12 | Which of these future ideas would you actually use, if any: suggested next certificates, a training plan, skill gaps against a project, asking questions in plain language? | Manager | Manager | A-08, N-08, N-09 |
| 13 | If nothing changed and you kept the spreadsheet, what would happen? | All | Manager | A-01, A-18 |
| 14 | Is there anything about certificates that we did not ask but should have? | All | All | — |

### A.2 Recording template

One row per answer that matters. Quote the person's words; do not paraphrase into the hypothesis.

| Date | Role | Question / A-xx | Answer (quote) | Supports / contradicts | Follow-up |
|---|---|---|---|---|---|
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |

### A.3 How the results update this pack

1. For every `A-xx` in §11, set the status as defined in §1: `Partly evidenced`, still `Assumed`, or `Contradicted` (write what was found). Use `Validated` only when the discovery interviews and the pilot both support it, and relax the check in `src/lib/process-docs.test.ts` deliberately when the first interview result is recorded.
2. Update the Evidence and Status columns of the needs in §3; a need that nobody confirms is marked for removal, and the requirements that serve only that need are listed for the sponsor.
3. Update the Validation column in [03](03-requirements.md) §2 for the affected requirements.
4. Fill the baselines in §8 and §10.
5. Bring the result to the proposed checkpoint (§8) and to gate G1 ([00](00-process-status.md) §3), including any finding that points to stop or re-scope.
