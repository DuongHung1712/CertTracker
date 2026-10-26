# Requirements

- **Status:** Draft v1 — backfilled after the MVP build (see `00-process-status.md`)
- **Last updated:** 2026-10-26
- **Owner:** CertTracker team (DC34)
- **Sources:** `CertTracker - Feature List.pdf` (internal; not stored in this repository), [Concept analysis](02-concept-analysis.md), [Design spec](../superpowers/specs/2026-09-26-certtracker-design.md), [Decisions](../decisions.md)

> **Tóm tắt (VI):** Danh sách requirement có ID, nhu cầu mà nó phục vụ (`N-xx` trong 02), nguồn, ưu tiên, trạng thái build, bằng chứng và mức kiểm chứng; kèm danh sách requirement chưa gắn được với nhu cầu nào (ứng viên cần xác nhận hoặc cắt), phạm vi và bảng thuật ngữ. Phân tích vấn đề, người dùng, phương án thay thế, chỉ số thành công và giả định nằm ở [02](02-concept-analysis.md). Không requirement nào đã được người dùng xác nhận.

## 1. About this document

This document lists **what CertTracker must do**. Why, for whom, and whether it is worth doing are in the concept analysis, [02](02-concept-analysis.md): the problem statement (§2), the stakeholders (§3), the needs `N-01`… (§4), the options considered (§5), the success criteria `SM-1`… (§6) and the assumptions `A-01`… (§7). Until 2026-10-17 those sections were part of this document; they moved so that the order of the pack follows the process (CA before requirements).

## 2. Requirements

Source codes: `FL-n` = feature group n of the Feature List (`FL-1`…`FL-7` platform, `FL-8` and `FL-9` AI; the AI principles at the end of the list are filed under `FL-9`); `SPEC §x` = design spec section; `DEC #n` = [decisions](../decisions.md) entry; `MGR` = manager feedback of 2026-10-05; `PROJECT` = proposed later by the team.

Need column: the `N-xx` IDs of [02](02-concept-analysis.md) §4 that the requirement serves; `—` means no need has been identified (§3 below).

Priority: Must / Should / Could. Validation: `Assumed` (nobody outside the build team confirmed it), `Decided` (a recorded decision in the design spec or the decision log), `Validated` (confirmed by users). **No requirement is `Validated`.**

| ID | Requirement | Need | Source | Priority | Build status | Evidence | Validation |
|---|---|---|---|---|---|---|---|
| R-01 | Manage members: name, email, team, program, DC; auto-generated code (M001) | N-01 | FL-1 | Must | Built (W2) | src/features/members | Assumed |
| R-02 | Manage DC → Program → Team and assign members to a team | N-01, N-03 | FL-1 | Must | Built (W2) | src/features/organizations | Decided |
| R-03 | Manage the course / certificate catalogue: name, CertType, provider, level, validity (months) | N-01, N-10 | FL-2 | Must | Built (W2) | src/features/courses | Assumed |
| R-04 | Record refund information and a course link | N-07 | FL-2 | Should | Built (W2) | src/features/courses | Assumed |
| R-05 | Record a certificate per person: planned exam date, issue date, certificate link, via company, refund status | N-01, N-07 | FL-3 | Must | Built (W3) | src/features/records | Assumed |
| R-06 | Track progress % and normalised status (Done / In Progress / Not Started) with notes | N-01, N-04 | FL-3 | Must | Built (W3) | src/features/records | Assumed |
| R-07 | Compute ExpiryDate, DaysToExpiry and ExpiryStatus (Active / Expiring in 60d / Expiring Soon / Expired) | N-02 | FL-3 | Must | Built (W1) | supabase/migrations/20260928000003_expiry_view.sql | Decided |
| R-08 | Upload evidence files for a record (private storage) | N-04 | SPEC §6.1 | Should | Built (W3) | src/lib/storage | Assumed |
| R-09 | Dashboard KPIs: members, records, done and completion %, in progress, expired, still valid | N-03 | FL-4 | Must | Built (W5) | src/features/dashboard | Assumed |
| R-10 | Statistics by team, CertType and provider | N-03 | FL-4 | Must | Built (W5) | src/features/dashboard | Assumed |
| R-11 | Personal ranking (managers/admins only), course popularity, completion by provider | N-03 | FL-4 | Should | Built (W5) | src/features/dashboard | Assumed |
| R-12 | Weekly (Monday) e-mail about certificates expiring within 60 days, to members (their own) and managers (their teams) | N-02 | FL-5 | Must | Built (W6, unmerged) | src/app/api/cron/expiry-alerts | Assumed |
| R-13 | Monthly KPI e-mail to managers and admins (day 1) | N-03 | FL-5 | Must | Built (W6, unmerged) | src/app/api/cron/monthly-report | Assumed |
| R-14 | Data-quality checks. The Feature List items (bad member/course references, status/progress mismatch, badly formatted dates) are blocked at write time by database constraints and import staging; the report lists what remains: exam date passed but not Done, Done without evidence, member without team, course without validity | N-01, N-10 | FL-5 | Should | Built (W6, unmerged) | supabase/migrations/20261004000001_data_quality_view.sql, src/features/data-quality | Assumed |
| R-15 | Import the legacy Excel with cleaning: normalise status, trim, progress to %, Excel serial dates, de-duplicate members by e-mail | N-05 | FL-6 | Must | Built (W4) | src/features/import | Assumed |
| R-16 | Export CSV / Excel in UTF-8 (Vietnamese diacritics) | N-03 | FL-6 | Must | Built (W4) | src/features/export | Assumed |
| R-17 | Sign-in and role-based access (Admin / Manager / Member) enforced by Row Level Security | N-06 | FL-7 | Must | Built (W1) | supabase/migrations/20260928000004_rls.sql | Decided |
| R-18 | Realtime updates on the records list and the Dashboard | — | FL-7 | Should | Built (W3) | src/features/records/components/records-realtime.tsx | Assumed |
| R-19 | Scheduled jobs for alerts and periodic reports | N-02, N-03 | FL-7 | Must | Built (W6, unmerged) | vercel.json | Assumed |
| R-20 | AI: Cert Recommendation (next certificate per person, refundable first) | N-09 | FL-8 | Could | Gated (G1) | — | Assumed |
| R-21 | AI: Training Plan Generator (from a manager goal: who, which cert, timeline, cost) | N-08, N-09 | FL-8 | Could | Gated (G1) | — | Assumed |
| R-22 | AI: Data Assistant (read certificate images/PDF, suggest merging course names, classify CertType/provider) | N-04, N-10 | FL-8 | Could | Gated (G1) | — | Assumed |
| R-23 | AI: Skill Gap Analysis (team certificates vs project needs; key-person risk) | N-08 | FL-9 | Could | Gated (G1) | — | Assumed |
| R-24 | AI: Completion Risk Prediction (stalled progress, exam date near) | N-09 | FL-9 | Could | Gated (G1) | — | Assumed |
| R-25 | AI: Insights (Vietnamese commentary on dashboard trends, included in the monthly e-mail) | N-03 | FL-9 | Could | Gated (G1) | — | Assumed |
| R-26 | AI: Ask Your Data (natural-language questions answered through whitelisted queries, not free text-to-SQL; DEC #9) | N-01, N-03 | FL-9 | Could | Gated (G1) | — | Assumed |
| R-27 | AI calls only from the backend; the API key never reaches the browser | N-06 | FL-9 | Must | Planned | — | Decided |
| R-28 | AI sees only data the user may see (respects RLS) | N-06 | FL-9 | Must | Planned | — | Decided |
| R-29 | No unnecessary personal data (e-mail, phone) in prompts | N-06 | FL-9 | Must | Planned | — | Decided |
| R-30 | A member belongs to exactly one team; a manager can manage several teams | N-03, N-06 | DEC #3 | Must | Built (W1) | supabase/migrations/20260928000001_org_and_members.sql | Decided |
| R-31 | Self sign-up with administrator approval (e-mail + password, no SSO); would supersede DEC #12 (self sign-up disabled, admin creates accounts) and is deferred to a separate plan (DEC #42); unscheduled until after G1 unless the sponsor asks earlier | — | PROJECT | Could | Planned | — | Assumed |
| NFR-01 | Security: RLS is the main protection; the service-role key is used only by scheduled jobs | N-06 | DEC #35 | Must | Built (W6, unmerged) | src/lib/supabase/admin.ts | Decided |
| NFR-02 | Privacy: personal ranking visible to managers/admins only; members see aggregates with small groups hidden | N-06 | DEC #8 | Must | Built (W5) | supabase/migrations/20261003000001_dashboard_rpc.sql | Decided |
| NFR-03 | Performance: moving between pages feels immediate (loading feedback; on `dev` only the Dashboard has a loading state, and none on `main`, which the public deployment builds from; target set after re-measuring, see `SM-4`) | N-12 | MGR | Must | Partial | src/app/(app)/dashboard/loading.tsx | Assumed |
| NFR-04 | Language: the interface can be shown in English or Vietnamese (switch); technical terms stay understandable; unscheduled until after G1 unless the sponsor asks earlier | N-11 | MGR | Should | Planned | — | Assumed |
| NFR-05 | Accessibility: text contrast at WCAG AA (checked by an automated test); keyboard-friendly tables and forms (not yet audited) | — | DEC #14 | Should | Partial | docs/design-system.md, src/app/tokens.test.ts | Decided |
| NFR-06 | Reliability: scheduled e-mails are never sent twice and failures are visible to the admin | N-02, N-03 | SPEC §12 | Must | Built (W6, unmerged) | src/features/notifications/deliver.ts | Decided |
| NFR-07 | Cost: free-tier hosting during the pilot (Vercel Hobby, Supabase Free); move before commercial use | — | DEC #13 | Must | Built (W1) | docs/deploy/task9-free-tier.md | Decided |

Notes on the table:

- `Built` means the code exists and was tested by the build team. It does **not** mean a real user has used it. In particular, `R-15` has not been run on the real legacy file (`A-04`), and the `W6, unmerged` rows exist only on branch `feat/week6-notifications`, not on `dev` and not in production.
- `R-27`…`R-29` are design principles for Phase 2 recorded in the Feature List, the design spec (§7.1) and decisions #5, #6 and #9. They are `Decided` as constraints, but nothing is built yet.
- `NFR-03` is `Partial`: on `dev` only the Dashboard has a loading state, and none on `main`, which the public deployment builds from (the data-quality page's loading state exists only on the unmerged week-6 branch); the diagnosis (partly still a hypothesis) is in the [2026-10-05 design](../superpowers/specs/2026-10-05-process-docs-and-ux-feedback-design.md) §3, and the slowness is not yet fixed.

## 3. Requirements without an identified need

These requirements map to no need in [02](02-concept-analysis.md) §4. They came from the Feature List or from the team, not from a user outcome. Each is a candidate to confirm or cut at the discovery interviews (WBS 1.2) and gate G1; nothing is removed by this note.

- `R-18` — realtime updates. No need requires changes to appear within seconds; `N-01` would be met by data that is correct when the page is opened.
- `R-31` — self sign-up with approval. Proposed by the team (`PROJECT`); no user has asked to request their own account.
- `NFR-05` — accessibility. Kept as a quality baseline (decision #14) regardless of interviews; it is listed only because no need in 02 names it, not as a candidate to cut.
- `NFR-07` — free-tier cost. A constraint ([02](02-concept-analysis.md) §8, decision #13), not a user need.

Partly without a need: `R-11` is mapped to `N-03` for its course-popularity and completion-by-provider items, but its **personal-ranking** part has no identified need. No need asks for people to be ranked; the only recorded discussion is about hiding the ranking (decision #8, `A-06`). The ranking is a candidate to confirm or cut in the same way.

## 4. Scope

**In scope (phase 1):** R-01 … R-19, R-30, NFR-01 … NFR-03, NFR-05 … NFR-07.
**Phase 2 (gated by G1):** R-20 … R-29.
**Planned, not yet designed or dated:** R-31 (self sign-up), NFR-04 (interface language switch; needs its own design cycle). Both are unscheduled until after gate G1 unless the sponsor asks for them earlier (decision #48).
**Out of scope** (design spec §11): a member in several teams, a full audit log, native mobile apps, HRIS / SkillMatrix integration (only a compatible data model is kept).

The design spec §11 also listed "Vietnamese interface only". That item was reversed by the owner on 2026-10-05 after the manager's feedback (see `NFR-04`); the reversal is described in the [2026-10-05 design](../superpowers/specs/2026-10-05-process-docs-and-ux-feedback-design.md) §5 and is recorded as decision #48.

## 5. Glossary (EN ↔ VI)

| English term (✓ = kept in English in the current UI) | Vietnamese |
|---|---|
| Dashboard ✓ | Bảng điều khiển / tổng quan |
| Training Record | Bản ghi chứng chỉ của một người (UI: "Chứng chỉ theo người") |
| CertType | Loại chứng chỉ (UI: "Loại chứng chỉ") |
| Provider | Nhà cung cấp (UI: "Nhà cung cấp") |
| Expiring Soon / Expiring in 60d / Expired | Sắp hết hạn / Hết hạn trong 60 ngày / Đã hết hạn (the UI shows these Vietnamese labels) |
| Evidence | Minh chứng |
| Import / Export ✓ | Nhập / Xuất dữ liệu |
| RLS (Row Level Security) | Phân quyền theo từng dòng dữ liệu |
| Realtime | Cập nhật tức thời |
| Cron job | Tác vụ chạy theo lịch |
