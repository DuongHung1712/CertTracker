# Requirements and Concept/Customer Analysis (CA)

- **Status:** Draft v1 — backfilled after the MVP build (see `00-process-status.md`)
- **Last updated:** 2026-10-05
- **Owner:** CertTracker team (DC34)
- **Sources:** `CertTracker - Feature List.pdf`, [Design spec](../superpowers/specs/2026-09-26-certtracker-design.md), [Decisions](../decisions.md); context on SkillMatrix: S+ AI Tooling Initiative proposal (internal; not stored in this repository)

> **Tóm tắt (VI):** Phân tích vấn đề, người dùng, phương án thay thế, danh sách requirement có ID/ưu tiên/trạng thái, chỉ số thành công và các giả định chưa xác nhận kèm kế hoạch kiểm chứng. Điều quan trọng: nhu cầu mới do manager/lead giao, **chưa** được hỏi người dùng cuối.

## 1. Problem statement

Teams in DC34 track employee certifications in Excel / Google Sheets. The expected problems are: data goes stale (nobody updates it), expiring certificates are noticed too late, and a manager cannot get a team-level view without manual work. Every claim in this section is **Assumed** until confirmed by the interviews in §7 (see `A-01`).

Strategic context: CertTracker is built standalone but its data model (Member, Course, Training Record) is designed to feed **SkillMatrix**, a proposed employee-skill repository, whose main risk is stale data (`A-10`). This context comes from the S+ AI Tooling Initiative proposal (internal; not stored in this repository, so it cannot be traced from here).

## 2. Stakeholders and users

| Role | Who | Job to be done |
|---|---|---|
| Sponsor | The manager / lead who commissioned the feature list | Know the team's certification coverage and expiry risk; decide whether to invest further |
| Admin | Person who administers the data (org structure, catalogue, imports, accounts) | Replace the spreadsheet; import legacy data cleanly; keep the catalogue tidy |
| Manager | Leads one or more teams | See who holds / is studying which certificates, get warned before they expire, report monthly |
| Member | Employee | Record own certificates and progress with proof; see own status |

No end user has been interviewed yet (`A-01`, `A-03`).

## 3. Current state and alternatives

| Option | Notes | Status in this project |
|---|---|---|
| Keep Excel / Google Sheets + manual reminders | Zero build cost; the problems in §1 persist | The baseline the product must beat (`SM-1`) |
| Buy / adopt an existing tool | No formal market scan was performed | **Gap** — work package `1.4` in the WBS (one-day build-vs-buy scan) |
| Build CertTracker | Chosen at the start (design spec §1–2): cloud SaaS, TypeScript, per-team permissions, clean data for SkillMatrix | MVP built internally, not validated by users; rationale limited to the spec — re-confirm at gate G1 |

## 4. Requirements

Source codes: `FL-n` = feature group n of the Feature List (`FL-1`…`FL-7` platform, `FL-8` and `FL-9` AI; the AI principles at the end of the list are filed under `FL-9`); `SPEC §x` = design spec section; `DEC #n` = [decisions](../decisions.md) entry; `MGR` = manager feedback of 2026-10-05; `PROJECT` = proposed later by the team.

Priority: Must / Should / Could. Validation: `Assumed` (nobody outside the build team confirmed it), `Decided` (a recorded decision in the design spec or the decision log), `Validated` (confirmed by users). **No requirement is `Validated`.**

| ID | Requirement | Source | Priority | Build status | Evidence | Validation |
|---|---|---|---|---|---|---|
| R-01 | Manage members: name, email, team, program, DC; auto-generated code (M001) | FL-1 | Must | Built (W2) | src/features/members | Assumed |
| R-02 | Manage DC → Program → Team and assign members to a team | FL-1 | Must | Built (W2) | src/features/organizations | Decided |
| R-03 | Manage the course / certificate catalogue: name, CertType, provider, level, validity (months) | FL-2 | Must | Built (W2) | src/features/courses | Assumed |
| R-04 | Record refund information and a course link | FL-2 | Should | Built (W2) | src/features/courses | Assumed |
| R-05 | Record a certificate per person: planned exam date, issue date, certificate link, via company, refund status | FL-3 | Must | Built (W3) | src/features/records | Assumed |
| R-06 | Track progress % and normalised status (Done / In Progress / Not Started) with notes | FL-3 | Must | Built (W3) | src/features/records | Assumed |
| R-07 | Compute ExpiryDate, DaysToExpiry and ExpiryStatus (Active / Expiring in 60d / Expiring Soon / Expired) | FL-3 | Must | Built (W1) | supabase/migrations/20260928000003_expiry_view.sql | Decided |
| R-08 | Upload evidence files for a record (private storage) | SPEC §6.1 | Should | Built (W3) | src/lib/storage | Assumed |
| R-09 | Dashboard KPIs: members, records, done and completion %, in progress, expired, still valid | FL-4 | Must | Built (W5) | src/features/dashboard | Assumed |
| R-10 | Statistics by team, CertType and provider | FL-4 | Must | Built (W5) | src/features/dashboard | Assumed |
| R-11 | Personal ranking (managers/admins only), course popularity, completion by provider | FL-4 | Should | Built (W5) | src/features/dashboard | Assumed |
| R-12 | Weekly (Monday) e-mail about certificates expiring within 60 days, to members (their own) and managers (their teams) | FL-5 | Must | Built (W6, unmerged) | src/app/api/cron/expiry-alerts | Assumed |
| R-13 | Monthly KPI e-mail to managers and admins (day 1) | FL-5 | Must | Built (W6, unmerged) | src/app/api/cron/monthly-report | Assumed |
| R-14 | Data-quality checks. The Feature List items (bad member/course references, status/progress mismatch, badly formatted dates) are blocked at write time by database constraints and import staging; the report lists what remains: exam date passed but not Done, Done without evidence, member without team, course without validity | FL-5 | Should | Built (W6, unmerged) | supabase/migrations/20261004000001_data_quality_view.sql, src/features/data-quality | Assumed |
| R-15 | Import the legacy Excel with cleaning: normalise status, trim, progress to %, Excel serial dates, de-duplicate members by e-mail | FL-6 | Must | Built (W4) | src/features/import | Assumed |
| R-16 | Export CSV / Excel in UTF-8 (Vietnamese diacritics) | FL-6 | Must | Built (W4) | src/features/export | Assumed |
| R-17 | Sign-in and role-based access (Admin / Manager / Member) enforced by Row Level Security | FL-7 | Must | Built (W1) | supabase/migrations/20260928000004_rls.sql | Decided |
| R-18 | Realtime updates on the records list and the Dashboard | FL-7 | Should | Built (W3) | src/features/records/components/records-realtime.tsx | Assumed |
| R-19 | Scheduled jobs for alerts and periodic reports | FL-7 | Must | Built (W6, unmerged) | vercel.json | Assumed |
| R-20 | AI: Cert Recommendation (next certificate per person, refundable first) | FL-8 | Could | Gated (G1) | — | Assumed |
| R-21 | AI: Training Plan Generator (from a manager goal: who, which cert, timeline, cost) | FL-8 | Could | Gated (G1) | — | Assumed |
| R-22 | AI: Data Assistant (read certificate images/PDF, suggest merging course names, classify CertType/provider) | FL-8 | Could | Gated (G1) | — | Assumed |
| R-23 | AI: Skill Gap Analysis (team certificates vs project needs; key-person risk) | FL-9 | Could | Gated (G1) | — | Assumed |
| R-24 | AI: Completion Risk Prediction (stalled progress, exam date near) | FL-9 | Could | Gated (G1) | — | Assumed |
| R-25 | AI: Insights (Vietnamese commentary on dashboard trends, included in the monthly e-mail) | FL-9 | Could | Gated (G1) | — | Assumed |
| R-26 | AI: Ask Your Data (natural-language questions answered through whitelisted queries) | FL-9 | Could | Gated (G1) | — | Assumed |
| R-27 | AI calls only from the backend; the API key never reaches the browser | FL-9 | Must | Planned | — | Decided |
| R-28 | AI sees only data the user may see (respects RLS) | FL-9 | Must | Planned | — | Decided |
| R-29 | No unnecessary personal data (e-mail, phone) in prompts | FL-9 | Must | Planned | — | Decided |
| R-30 | A member belongs to exactly one team; a manager can manage several teams | DEC #3 | Must | Built (W1) | supabase/migrations/20260928000001_org_and_members.sql | Decided |
| R-31 | Self sign-up with administrator approval (e-mail + password, no SSO); would supersede DEC #12 (self sign-up disabled, admin creates accounts) and is deferred to a separate plan (DEC #42) | PROJECT | Could | Planned | — | Assumed |
| NFR-01 | Security: RLS is the main protection; the service-role key is used only by scheduled jobs | DEC #35 | Must | Built (W6, unmerged) | src/lib/supabase/admin.ts | Decided |
| NFR-02 | Privacy: personal ranking visible to managers/admins only; members see aggregates with small groups hidden | DEC #8 | Must | Built (W5) | supabase/migrations/20261003000001_dashboard_rpc.sql | Decided |
| NFR-03 | Performance: moving between pages feels immediate (loading feedback; on `dev` only the Dashboard has a loading state; target set after re-measuring, see `SM-4`) | MGR | Must | Partial | src/app/(app)/dashboard/loading.tsx | Assumed |
| NFR-04 | Language: the interface can be shown in English or Vietnamese (switch); technical terms stay understandable | MGR | Should | Planned | — | Assumed |
| NFR-05 | Accessibility: text contrast at WCAG AA (checked by an automated test); keyboard-friendly tables and forms (not yet audited) | DEC #14 | Should | Partial | docs/design-system.md, src/app/tokens.test.ts | Decided |
| NFR-06 | Reliability: scheduled e-mails are never sent twice and failures are visible to the admin | SPEC §12 | Must | Built (W6, unmerged) | src/features/notifications/deliver.ts | Decided |
| NFR-07 | Cost: free-tier hosting during the pilot (Vercel Hobby, Supabase Free); move before commercial use | DEC #13 | Must | Built (W1) | docs/deploy/task9-free-tier.md | Decided |

Notes on the table:

- `Built` means the code exists and was tested by the build team. It does **not** mean a real user has used it. In particular, `R-15` has not been run on the real legacy file (`A-04`), and the `W6, unmerged` rows exist only on branch `feat/week6-notifications`, not on `dev` and not in production.
- `R-27`…`R-29` are design principles for Phase 2 recorded in the Feature List, the design spec (§7.1) and decisions #5, #6 and #9. They are `Decided` as constraints, but nothing is built yet.
- `NFR-03` is `Partial`: on `dev` only the Dashboard has a loading state (the data-quality page's loading state exists only on the unmerged week-6 branch); the diagnosis (partly still a hypothesis) is in the [2026-10-05 design](../superpowers/specs/2026-10-05-process-docs-and-ux-feedback-design.md) §3, and the slowness is not yet fixed.

## 5. Success criteria (measurable)

| ID | Criterion | Target | Basis |
|---|---|---|---|
| SM-1 | A real team stops using its spreadsheet | The sponsor and the admin confirm the spreadsheet is no longer updated, after at least two consecutive weeks of real use — *proposed; the sponsor decides the final period* (aligned with gate G1 in `00-process-status.md` §3) | Design spec §1 (phase-1 goal) |
| SM-2 | Legacy data imports cleanly | A real file imports with zero unresolved error rows after cleaning; manual fixes recorded | Design spec §10 — *proposed numeric target to confirm with the sponsor* |
| SM-3 | Weekly e-mail works | The Monday e-mail runs correctly on two consecutive Mondays with no failed delivery (Settings history shows Sent > 0, Failed = 0) | Design spec §10 |
| SM-4 | Navigation feels immediate | Moving between pages shows feedback at once and the 75th-percentile page load stays under 1 second — *proposed; confirm after re-measuring with the same method* | Manager feedback (2026-10-05); measurements in `02-wbs.md` item 8.1 |

## 6. Scope

**In scope (phase 1):** R-01 … R-19, R-30, NFR-01 … NFR-03, NFR-05 … NFR-07.
**Phase 2 (gated by G1):** R-20 … R-29.
**Planned, not yet designed or dated:** R-31 (self sign-up), NFR-04 (interface language switch; needs its own design cycle).
**Out of scope** (design spec §11): a member in several teams, a full audit log, native mobile apps, HRIS / SkillMatrix integration (only a compatible data model is kept).

The design spec §11 also listed "Vietnamese interface only". That item was reversed by the owner on 2026-10-05 after the manager's feedback (see `NFR-04`); the reversal is described in the [2026-10-05 design](../superpowers/specs/2026-10-05-process-docs-and-ux-feedback-design.md) §5 and is not yet in the decision log.

## 7. Assumptions, risks and the plan to validate them

| ID | Assumption | How to validate | Who | Status |
|---|---|---|---|---|
| A-01 | Teams track certificates in spreadsheets and it is painful (stale data, late expiry warnings) | Interview 3–5 users; look at a real spreadsheet | Sponsor + owner | Assumed |
| A-02 | Managers want the Monday e-mail and will read it | Two Mondays of the pilot; ask for feedback | Owner | Assumed |
| A-03 | Members will update their own progress and evidence | Observe two members doing it; compare update counts during the pilot | Owner | Assumed |
| A-04 | The legacy Excel imports with acceptable effort | Import a real file (week-4 trial); record manual fixes (`SM-2`) | Admin | Assumed |
| A-05 | Storing names and e-mails in a cloud service is acceptable | Recorded in decisions #1; confirm with the data owner before production | Sponsor | Decided |
| A-06 | Showing the personal ranking only to managers/admins is the right privacy trade-off | Ask in the interviews | Owner | Assumed |
| A-07 | Users prefer a Vietnamese interface with English technical terms (or a switch) | Ask in the interviews; input to the i18n design | Owner | Assumed |
| A-08 | The Phase 2 AI features are wanted and in this priority order | Show the list; rank with the sponsor and managers (gate G1) | Sponsor | Assumed |
| A-09 | Data volume stays small (hundreds of members, thousands of records) | Ask for real counts | Admin | Assumed |
| A-10 | SkillMatrix will consume CertTracker data | Confirm with the SkillMatrix owner | Sponsor | Assumed |

**Risks (top five):** (1) the need is weaker than assumed → gate G1; (2) a dirty legacy file → staging and preview in the import, real-file trial; (3) wrong permissions leak data → RLS tests per role; (4) e-mails duplicated or lost → claim log and visible history; (5) slow navigation hurts adoption → performance work package 8.1.

**Interview plan (3–5 people, ~30 minutes each):** one manager, one admin, two or three members. Ask: how do you track certificates today, what went wrong last time, what would make you stop using the spreadsheet, who should see what, which language do you prefer, which of the Phase 2 features would you actually use. Record answers per assumption ID; update this table (Validation → `Validated`) and `00-process-status.md` §3.

## 8. Glossary (EN ↔ VI)

| English term (kept in the UI where marked ✓) | Vietnamese |
|---|---|
| Dashboard ✓ | Bảng điều khiển / tổng quan |
| Training Record ✓ | Bản ghi chứng chỉ của một người |
| CertType ✓ | Loại chứng chỉ |
| Provider ✓ | Nhà cung cấp |
| Expiring Soon / Expiring in 60d / Expired ✓ | Sắp hết hạn (≤ 30 ngày) / Hết hạn trong 31–60 ngày / Đã hết hạn |
| Evidence | Minh chứng |
| Import / Export ✓ | Nhập / Xuất dữ liệu |
| RLS (Row Level Security) | Phân quyền theo từng dòng dữ liệu |
| Realtime | Cập nhật tức thời |
| Cron job | Tác vụ chạy theo lịch |
