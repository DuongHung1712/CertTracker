# Design and mockups

- **Status:** Draft v1, parts A (as-built documentation, §1–§4b) and B (proposed mockups for review, §5–§6)
- **Last updated:** 2026-10-07
- **Owner:** CertTracker team (DC34)
- **Sources:** [Design system](../design-system.md), [Decisions](../decisions.md), [Requirements and CA](01-requirements-and-ca.md), [WBS](02-wbs.md), [SAD](03-sad.md), the code under `src/app` and `src/components/app-shell/nav.ts`

> **Tóm tắt (VI):** Tài liệu này có hai phần tách bạch. Phần A (§1–§4b) ghi lại giao diện **đã được xây** (chụp màn hình thật, dữ liệu seed giả): app được xây trước khi có bất kỳ mockup nào được duyệt. Gồm cơ sở thiết kế, bảng liệt kê màn hình theo vai trò và requirement, ba luồng người dùng (member cập nhật chứng chỉ, manager theo dõi hằng tuần, admin import Excel) và thư viện ảnh theo vai trò. Phần B (§5–§6) là **mockup đề xuất, chưa xây**, để sponsor duyệt **trước khi** tốn công kỹ thuật: phản hồi khi chuyển trang, công tắc ngôn ngữ EN/VI, tự đăng ký có admin duyệt (sẽ thay thế quyết định #12, hoãn đến sau G1 trừ khi sponsor yêu cầu sớm hơn) và ba ý tưởng AI giai đoạn 2 (bị chặn bởi cổng G1, không phải cam kết). Mỗi ảnh đề xuất có biểu ngữ "PROPOSED MOCKUP — not built"; §6 là bảng 14 câu hỏi cần sponsor trả lời.

**Reading note.** Items marked **(W6, unmerged)** are built on the week-6 branch `feat/week6-notifications` and are not yet merged into `dev` (same label as in [01](01-requirements-and-ca.md), [02](02-wbs.md) and [03](03-sad.md)). "Built" means built and tested by the build team, not validated by users.

## 1. Status and how to read this

The screens of CertTracker were **built before any mockup was reviewed**. The usual order (Design/Mockup → PoC → MVP) was not followed for them, as [00](00-process-status.md) explains. This document therefore keeps two kinds of material strictly apart:

- **As-built (§3 and §4, including §4b).** Documentation of what exists today. The images are **screenshots of the running application**, not mockups, and nobody reviewed them as designs before the code was written.
- **Proposed (§5).** Mockups for the changes we want to make next, to be reviewed **before** anything is built. They are drawings, not screenshots, and each carries a "PROPOSED MOCKUP — not built" banner. The reviewer's questions are collected in §6.

How the screenshots were made: `docs/process/mockups/capture.mjs` signs in through the real login form as each of the three seed users and captures a 1440 × 900 viewport (and 390 × 844 for the phone views) of a production build running against a freshly reset local database. Consequences for the reader:

- All people, e-mail addresses, courses and numbers are **seed data** (fictional). The three records make charts and tables look sparser than real use would.
- The interface is shown in its current language, Vietnamese. Captions are in English, with the interface text translated in brackets where that helps.
- Each image is a single viewport, so long pages are cut at the bottom. One browser-native control (the file chooser on the import page) shows English text because of the browser, not the application.
- The Settings screenshot reflects a local setup with no e-mail service configured, so its status rows say "not configured" ("Chưa cấu hình").

## 2. Design basis

The design system ([design-system.md](../design-system.md), in Vietnamese) is the reference for every screen; it is not copied here. In short:

- **Direction:** a "certificate file" look (warm paper background, dark teal accent, ink-blue text) with compact data tables, chosen over a "control panel" or a "learning path" look (decision #14). Light theme only.
- **Tokens only:** colours, text sizes and radii are named by role and defined once in `src/app/globals.css`; components never hard-code them, so a dark theme can be added later without touching components.
- **Components:** shadcn/ui (`base-nova`, Base UI) plus CertTracker's own app shell, data table, filter bar, empty state and status components (see the component table in the design system and the `/design` showcase page).
- **Status is never colour alone:** every status has a text label and an icon.
- **Accessibility rules:** text contrast of at least 4.5:1 and control borders, focus rings and meaningful icons at least 3:1, checked by an automated test in CI (`src/app/tokens.test.ts`); keyboard operation, a skip link and landmarks are specified in the design system. A keyboard and screen-reader **audit has not been done** (see [02](02-wbs.md), item 8.4; requirement `NFR-05` is `Partial`).
- **Role-based navigation:** one app shell for every role, with a left sidebar that hides the entries a role cannot use (decision #14, implemented in `src/components/app-shell/nav.ts`). It is a convenience only: access is enforced by Row Level Security.

## 3. Screen inventory

Every `page.tsx` under `src/app`, as of branch `docs/process-pack` (which includes week 6). "Roles" combines the sidebar entries in `nav.ts` with the redirects inside each page. "Status" uses the wording of [01](01-requirements-and-ca.md) §4 and was checked against the first commit that gave the screen its real content (`git log`); the original placeholder pages of 2026-09-27 are ignored.

| Route | Screen | Roles | Purpose | Requirements | Status | Screenshot |
|---|---|---|---|---|---|---|
| `/login` | Sign in | Anyone not signed in | Sign in with e-mail and password (accounts are issued by an admin) | R-17 | Built (W1) | [desktop](images/asbuilt-anon-login.png), [phone](images/asbuilt-anon-login-mobile.png) |
| `/dashboard` | Dashboard | Admin, Manager, Member | KPIs, expiry chart, breakdowns by course, CertType and provider; by team and personal ranking for Admin and Manager only; a Member sees aggregates only, with groups under 3 people hidden | R-09, R-10, R-11, R-18, NFR-02 | Built (W5) | [admin](images/asbuilt-admin-dashboard.png), [manager](images/asbuilt-manager-dashboard.png), [manager ranking](images/asbuilt-manager-dashboard-ranking.png), [member](images/asbuilt-member-dashboard.png) |
| `/me` | My certificates | Admin, Manager, Member, if the account is linked to a member (the seed Admin and Manager are not) | A person's own certificates: add, edit, upload evidence, export | R-05, R-06, R-07, R-08, R-16, R-18 | Built (W3) | [desktop](images/asbuilt-member-me.png), [record editor](images/asbuilt-member-record-editor.png), [phone](images/asbuilt-member-me-mobile.png) |
| `/members` | Members | Admin, Manager (Manager sees only the managed teams; only Admin adds or deletes) | List and maintain members and their team | R-01, R-30 | Built (W2) | [admin](images/asbuilt-admin-members.png) |
| `/records` | Certificates by person | Admin, Manager (a Member is redirected to `/me`) | Team-wide list of certificates with filters, add and edit, evidence, CSV / Excel export | R-05, R-06, R-07, R-08, R-16, R-18 | Built (W3) | [admin](images/asbuilt-admin-records.png), [manager](images/asbuilt-manager-records.png) |
| `/courses` | Courses | Admin, Manager, Member (read); only Admin edits and sees the CertType and provider sections | Course and certificate catalogue: type, provider, level, validity, refund | R-03, R-04 | Built (W2) | [admin](images/asbuilt-admin-courses.png) |
| `/org` | Organisation | Admin (sidebar entry and write controls); the page itself has no role redirect, so what other roles would see is decided by RLS | Centre (DC), Program, Team and team managers | R-02, R-30 | Built (W2) | [admin](images/asbuilt-admin-org.png) |
| `/import` | Import / Export | Admin (others are redirected to `/dashboard`) | Upload the legacy Excel file, export data, list previous import batches | R-15, R-16 | Built (W4) | [admin](images/asbuilt-admin-import.png) |
| `/import/[batchId]` | Import batch preview | Admin (others are redirected to `/dashboard`) | Review the cleaned rows of one batch, then import or discard it | R-15 | Built (W4) | — (a batch exists only after a file is uploaded, which writes data; see the flow in §4 (c)) |
| `/data-quality` | Data quality | Admin, Manager (a Member is redirected to `/me`) | Records and catalogue entries that still need review: exam date passed, done without evidence, member without team, course without validity | R-14 | Built (W6, unmerged) | [admin](images/asbuilt-admin-data-quality.png) |
| `/settings` | Settings | Admin (others are redirected to `/dashboard`) | History of automatic e-mails and whether e-mail is configured | R-12, R-13, R-19, NFR-06 | Built (W6, unmerged) | [admin](images/asbuilt-admin-settings.png) |
| `/design` | Design system showcase | Developers; exists only on the dev server (not found in production) | Shows tokens and components for developers | NFR-05 | Built (W2), dev only | — (not part of the product) |

Notes:

- `src/app/page.tsx` is not a screen: `/` redirects to `/dashboard`, and the proxy sends anyone who is not signed in to `/login`.
- The seed Admin and Manager accounts are not linked to a member record, which is why their sidebar has no "My certificates" entry. A real manager who is also a team member would have one.
- The `/dashboard` row is wider than it looks: the same screen serves three roles and the sections shown change with the role (see the three dashboard images).

## 4. User flows

Each flow was checked against the code: routes, button labels (quoted in Vietnamese as shown on screen) and Server Actions. Steps that exist only on the week-6 branch are marked.

### (a) A member updates a certificate with evidence

```mermaid
flowchart TD
  A["Member signs in at /login"] --> B["Opens Chứng chỉ của tôi (/me)"]
  B --> C{"New or existing certificate?"}
  C -->|New| D["Clicks Thêm chứng chỉ"]
  C -->|Existing| E["Row menu, then Sửa"]
  D --> F["Side sheet opens"]
  E --> F
  F --> G["Fills course, status, progress, dates, link, notes"]
  G --> H["Optionally drops an evidence file<br/>PDF, JPG, PNG or WebP, up to 4 MB"]
  H --> I["Clicks Lưu"]
  I --> J["Server Action createRecord or updateRecord<br/>validated again with Zod, RLS applies"]
  J --> K{"Saved?"}
  K -->|No| L["Error shown in the sheet; sheet stays open"]
  L --> G
  K -->|Yes| M{"Evidence file chosen?"}
  M -->|Yes| N["Server Action uploadEvidence to private storage"]
  M -->|No| P["Sheet closes; toast: saved"]
  N --> Q{"Upload OK?"}
  Q -->|Yes| P
  Q -->|No| R["Record is kept; toast says the evidence is missing; Sửa again to retry"]
  P --> S["Realtime refresh: managers see the change"]
```

Notes: the sheet is opened and closed (without saving) in the [record editor image](images/asbuilt-member-record-editor.png). A Member can add and edit their own records but does not see the company-related fields (via company, refund status) and cannot delete a record; that is hidden in the interface and enforced by RLS.

### (b) A manager's weekly routine

```mermaid
flowchart TD
  A["Monday 08:00 Vietnam time<br/>(W6, unmerged)<br/>Vercel Cron calls /api/cron/expiry-alerts"] --> B["Manager receives an e-mail:<br/>certificates of the managed teams<br/>expiring within 60 days<br/>(W6, unmerged)"]
  B --> C["Clicks Mở CertTracker in the e-mail<br/>(W6, unmerged)"]
  C --> D["Dashboard (/dashboard)<br/>KPI Sắp hết hạn, Theo team, ranking"]
  D --> E["Chứng chỉ theo người (/records)<br/>filter by team and by Hạn"]
  E --> F["Opens a row: Sửa<br/>e.g. planned exam date, notes"]
  E --> G["Xuất CSV or Xuất Excel for a report"]
  D --> H["Chất lượng dữ liệu (/data-quality)<br/>(W6, unmerged)"]
  H --> I["Mở: goes to the screen where the finding is fixed"]
  F --> J["Follow-up with the member outside the app<br/>no in-app messaging exists"]
  G --> J
  I --> J
```

Notes: the Monday time comes from `vercel.json` (`0 1 * * 1`, which is 08:00 in Vietnam) and from the schedule text on the [Settings screen](images/asbuilt-admin-settings.png). The e-mail contains one link back to the application (the root, which leads to the Dashboard). A Manager sees only the managed teams on `/records` and in the ranking, as shown in the [ranking image](images/asbuilt-manager-dashboard-ranking.png). The e-mail step has not been exercised with real recipients, because the sending domain is not verified (see [00](00-process-status.md)).

### (c) An admin imports the legacy Excel file

```mermaid
flowchart TD
  A["Admin opens Import / Export (/import)"] --> B["Chooses the File Excel<br/>.xlsx or .xls, up to 4 MB and 2000 rows<br/>needs the columns Email and Khóa học"]
  B --> C["Clicks Tải lên và kiểm tra"]
  C --> D["POST /api/import/parse<br/>cleans the rows into a staging batch"]
  D --> E{"File accepted?"}
  E -->|No| F["Error message on /import; nothing imported"]
  F --> B
  E -->|Yes| G["Batch preview (/import/batchId)<br/>counts: Tạo mới, Cập nhật, Không đổi, Lỗi<br/>per-row messages, search and filter"]
  G --> H{"Decision"}
  H -->|"Hủy lô, then confirm"| I["Server Action discardImport<br/>batch marked discarded"]
  H -->|"Nhập N dòng, then confirm Nhập dữ liệu"| J["Server Action commitImport<br/>one database transaction<br/>error rows are skipped"]
  J --> K{"Committed?"}
  K -->|No| L["Error toast; nothing changed; batch stays reviewable"]
  K -->|Yes| M["Result: toast and message with created and updated counts<br/>link Xem chứng chỉ goes to /records"]
  M --> N["Batch shows in Lịch sử nhập on /import"]
  I --> N
```

Notes: the button "Nhập N dòng" is disabled when no row can be imported or when the upload of the batch is incomplete. This flow has **not** been run on the real legacy file (assumption `A-04`); it is covered by automated tests with a generated workbook. The preview and result screens are not in the gallery because producing them requires writing a batch to the database.

## 4b. As-built gallery by role

All images are screenshots of the current application with seed data (see §1).

### Before sign-in

![Sign-in page, desktop](images/asbuilt-anon-login.png)

Sign-in page: the only screen shown before a role is known.

### Admin

![Admin dashboard](images/asbuilt-admin-dashboard.png)

Admin Dashboard: seven KPI tiles, expiry chart, popular courses and the team breakdown ("Theo team"). Further sections (CertType, provider, personal ranking) are below the first screen.

![Admin members list](images/asbuilt-admin-members.png)

Members ("Thành viên"): all members with code, team and status; Admin can add and delete.

![Admin certificates by person](images/asbuilt-admin-records.png)

Certificates by person ("Chứng chỉ theo người"): team-wide list with status, progress, expiry badge and exam date; filters by team, status and expiry; CSV and Excel export.

![Admin courses](images/asbuilt-admin-courses.png)

Courses ("Khóa học"): CertType and provider sections (Admin only) above the course catalogue.

![Admin organisation](images/asbuilt-admin-org.png)

Organisation ("Tổ chức"): centre, program and team lists, each with add, edit and delete.

![Admin import and export](images/asbuilt-admin-import.png)

Import / Export: Excel upload, export links and the (empty) import history. The file chooser text is in English because of the browser.

![Admin data quality](images/asbuilt-admin-data-quality.png)

Data quality ("Chất lượng dữ liệu") **(W6, unmerged)**: one finding in the seed data, a completed certificate without evidence.

![Admin settings](images/asbuilt-admin-settings.png)

Settings ("Cài đặt") **(W6, unmerged)**: e-mail history (empty) and the configuration checklist; on this local setup nothing is configured.

### Manager

![Manager dashboard](images/asbuilt-manager-dashboard.png)

Manager Dashboard: the same KPIs as the Admin's; the sidebar has no Organisation, Import or Settings entry.

![Manager dashboard, ranking section](images/asbuilt-manager-dashboard-ranking.png)

The same page scrolled down: breakdowns and the personal ranking ("Xếp hạng cá nhân"), limited to the members of the managed team. Members cannot see this section.

![Manager certificates by person](images/asbuilt-manager-records.png)

Certificates by person for a Manager: only the managed team's records (two of the three seed records).

### Member

![Member dashboard](images/asbuilt-member-dashboard.png)

Member Dashboard: aggregates only. Groups with fewer than 3 learners are replaced by "Chưa có dữ liệu" ("No data yet"), and there are no team table or ranking.

![Member certificates](images/asbuilt-member-me.png)

My certificates ("Chứng chỉ của tôi"): the member's own records, with add and export.

![Member record editor](images/asbuilt-member-record-editor.png)

Record editor opened from "Thêm chứng chỉ" ("Add certificate"): course, status, progress, dates, link, notes and the evidence drop zone. Closed without saving.

### Mobile

![Sign-in page, phone](images/asbuilt-anon-login-mobile.png)

Sign-in page at 390 px width.

![Member certificates, phone](images/asbuilt-member-me-mobile.png)

My certificates at 390 px width: the sidebar becomes a drawer, and the table scrolls horizontally (the status column is already cut off). The layout works but was not designed phone-first.

## 5. Proposed mockups (for review before building)

Everything in this section is **proposed**: nothing here is built, and no sponsor decision has approved it. The images are **static drawings** made with the real design tokens (`docs/process/mockups/tokens.css`, a copy of the colours in `src/app/globals.css` that an automated test keeps identical), not screenshots of the application. The purpose is to let the sponsor say "yes", "no" or "change this" **before** any engineering effort is spent, in line with the principle "build the right thing before building the thing right" (see [00](00-process-status.md)).

How to tell a proposal from an as-built screenshot:

- Every image starts with a yellow banner, **"PROPOSED MOCKUP — not built · for review"**. The as-built images (§4b) have no banner.
- The Phase 2 images (§5.4) carry a second, orange label: **"CONCEPT — Phase 2, gated by G1, not a commitment"**.
- The dark numbered markers and the dark "Reviewer notes" box in each image are reading aids, not part of the proposed interface.
- All people, courses and numbers are fictional. Where a drawing needs data that the seed does not contain (a new requester, Azure certificates, study hours), it is invented, and the image or the text below says so.
- Text is in English because that is the reviewer's reading language; the Vietnamese version is shown only where it is the point (§5.2).

Sections 5.1 to 5.3 map to the work packages of the same numbers in [02](02-wbs.md); 5.4 is gated by G1 in [00](00-process-status.md). Every question for the reviewer is repeated in §6, so the answers can be returned in one place. The images are produced by `docs/process/mockups/render-mockups.mjs` from the HTML files next to it.

### 5.1 Loading feedback on page changes (WBS 8.1)

**Purpose.** Answers the manager's feedback of 2026-10-05 that moving between pages feels slow (`NFR-03`, success criterion `SM-4`). The design system already says that loading shows a skeleton shaped like the content and never a full-page spinner ([design system](../design-system.md), §4.4); today only the Dashboard follows it, and only on `dev` (there is no loading state on `main`, which the public deployment builds from; see [00](00-process-status.md)).

![Proposed: Members page in the moment after the click](images/proposed-loading-members.png)

*Proposed.* Members the instant after "Members" is clicked: the sidebar item is already highlighted, a thin progress bar runs along the top edge, the page title and column headers are shown, and the rows are grey placeholders in the same shape as the real rows. On screen the placeholders pulse gently; the pulse is left out of the picture and is switched off for users who prefer reduced motion.

**Behaviour notes.**

- The highlighted sidebar item and the breadcrumb change at once when a link is clicked, before the server has answered.
- The top bar starts with the navigation and ends when the page is ready. It is a thin line, not a full-page overlay or spinner.
- Parts of the page that do not depend on data (title, description, column headers) are drawn immediately. Only the data area is a placeholder, and it has the final size, so nothing jumps when the data arrives.
- The same pattern would be applied to every page in the app shell; Members is the example. A second image for the Dashboard is not included because the existing Dashboard loading state already looks like this.
- This is **feedback**, not speed. Making the data itself arrive sooner is the other part of 8.1 (confirm the database region, move the function region, fewer sequential calls); the mockup does not promise a number.

**Linked IDs.** WBS 8.1; `NFR-03`; `SM-4`; [design system](../design-system.md) §4.4.

**Decisions needed from the reviewer.**

1. Is instant feedback (highlight, top bar, placeholders) what you meant by "feels immediate", or do you also expect the data itself to arrive faster? The second needs the region work in 8.1 and is measured against `SM-4`.
2. Should the top bar appear on every navigation, or only when a page takes longer than about half a second?

### 5.2 Interface language switch EN/VI (WBS 8.2)

**Purpose.** Answers the manager's feedback that the interface should be readable in English (`NFR-04`, decision #48, which reversed the earlier "Vietnamese only" decision). This is a proposal for **where the switch lives and what a screen looks like in both languages**; it is not an i18n design. Work package 8.2 needs its own design spec and plan (4 to 7 days) and is unscheduled until after G1 unless the sponsor asks for it earlier (decision #48).

![Proposed: language switch in the user menu](images/proposed-i18n-switch-menu.png)

*Proposed.* The user menu (top right, opened from the e-mail and role) gets a "Language" row with two options, each written in its own language. Signed-out pages, such as sign-in, would get a small "English · Tiếng Việt" link under the form.

![Proposed: Dashboard in English](images/proposed-i18n-dashboard-en.png)

*Proposed.* The top of the Dashboard in English, translated according to the glossary in [01](01-requirements-and-ca.md) §8: for example "Certificates by person", "Expiring soon", "Still valid". "Dashboard" and "Import / Export" stay as they are, because the glossary keeps them in English.

![Proposed: Dashboard in Vietnamese](images/proposed-i18n-dashboard-vi.png)

*Proposed (current text).* The same screen in Vietnamese. The wording is the real current interface text, taken from the Dashboard page and its components; it is shown so the two languages can be compared side by side, and only the banner differs from today's screen.

**Behaviour notes.**

- The switch is in the existing user menu, so it is reachable from every page and takes no space in the topbar. The alternative, a permanent "EN | VI" toggle in the topbar, is more visible but busier.
- The choice would be remembered; where is open (question 4). If it is stored with the user's account, the scheduled e-mails can follow the recipient's language, which the acceptance criterion of 8.2 requires.
- Everything the application writes is translated: labels, buttons, messages and e-mails. Text that people type (course names, notes) is not.
- Dates and numbers follow the language. The English drawing writes "07 Oct 2026, 19:41" where Vietnamese shows "07/10/2026 19:41"; the exact format is for the i18n design.
- The convention "UI text in Vietnamese" in `CLAUDE.md` is to be reviewed when the i18n spec is approved (decision #48).

**Linked IDs.** WBS 8.2; `NFR-04`; `A-07`; decision #48; glossary in [01](01-requirements-and-ca.md) §8.

**Decisions needed from the reviewer.**

3. In which language should a new user and the sign-in page start: Vietnamese (as today), English, or the browser's language?
4. Where should the choice be remembered: with the user's account (follows the person across devices and decides the language of the e-mails) or only in the browser (simpler, but e-mails stay in one language)?
5. Should 8.2 be scheduled before G1 (estimate 4 to 7 days), or stay after G1 as it is today?
6. In Vietnamese mode, should the English terms kept today ("Dashboard", "Import / Export", "Team") stay in English, or should more be translated?

### 5.3 Self sign-up with administrator approval (WBS 8.3)

**Purpose.** Answers requirement `R-31`: a person can ask for an account and an administrator approves it. **This would supersede decision #12** (e-mail and password sign-in with self sign-up **disabled**, accounts created by an admin). It is a separate plan (decision #42), and it is **deferred to after G1 unless the sponsor asks for it earlier** (02 row 8.3, estimate 2 to 4 days). SSO is not part of it.

![Proposed: request access page](images/proposed-signup-request.png)

*Proposed.* A public "Request access" page in the style of the sign-in page: full name, work e-mail, team, password, and a notice that an administrator must approve the account.

![Proposed: waiting-for-approval and rejected pages](images/proposed-signup-pending.png)

*Proposed.* A. What the requester sees after submitting, and every time they sign in before a decision. B. What they see if the request is rejected.

![Proposed: access requests tab for the administrator](images/proposed-signup-admin-approvals.png)

*Proposed.* A second tab, "Access requests", on the Members page for Admins. "Approve…" opens the form shown under the first row: the role (Member, Manager or Admin) and the member record (create a new one or link an existing one). "Reject…" asks for confirmation. The two requesters are invented for the drawing and are not in the seed data.

**Behaviour notes.**

- A new account starts with no role. A "pending" account sees only the waiting page and no data. This needs a new role value and Row Level Security tests (a schema change, under the project rules). A pending user would receive no e-mails, which decision #42 already prepared for.
- Only an Admin chooses the role, and the default is the least powerful one (Member). For a Manager, the Admin also picks the teams they manage (the existing team-manager link).
- Approval connects the account to a member record, using the same link by e-mail address that the system makes today when an admin creates an account.
- The request stays on record after a decision, with who decided and when. That is a decision record on the request itself, not a general audit log (which is out of scope, see [01](01-requirements-and-ca.md) §6).
- Opening sign-up to the internet creates new risks: spam requests, and a team list visible to anyone who opens the page. The questions below decide how much protection is needed.

**Linked IDs.** WBS 8.3; `R-31`; decisions #12 (to be superseded) and #42.

**Decisions needed from the reviewer.**

7. Who approves requests: Admins only, or also Managers for their own teams?
8. Who may ask: any e-mail address, or only addresses on the company's e-mail domain? And should the form list team names to a visitor who is not signed in, or leave the team to the administrator?
9. Should the person receive an e-mail when the request is approved or rejected? It reuses the existing e-mail service, whose sending domain is not yet verified (see [00](00-process-status.md)).
10. Do you want this before G1 (it supersedes decision #12), or after G1 as currently planned?

### 5.4 Phase 2 AI concepts (gated by G1)

**Purpose.** To make three of the Phase 2 requirements concrete enough to be ranked: `R-20` (certificate recommendation), `R-26` (Ask Your Data) and `R-23` (skill gap analysis). **Nothing in this section is built**, and Phase 2 is **blocked by gate G1** ([00](00-process-status.md) §3): the assumptions must be checked, a real team must have used the product, and the sponsor must confirm which features are wanted and in what order (condition 3). The gate may also end in "re-scope" or "stop". These images are concepts to help that conversation, not a commitment to build them. The other Phase 2 requirements (`R-21`, `R-22`, `R-24`, `R-25`) have no drawing.

![Concept: suggested next certificates](images/proposed-ai-recommendations.png)

*Concept (R-20).* On "My certificates", a panel of two or three suggestions. Each has a reason, an estimated study time, a refundable badge and a link to the course; refundable courses come first, as the Feature List asks.

![Concept: Ask your data](images/proposed-ai-ask-your-data.png)

*Concept (R-26, R-28).* A question box on the Dashboard for Admins and Managers. The answer is one sentence plus a small table, with a line saying how it was answered and a visible note that answers use only data the user is allowed to see. The Azure certificates in this drawing are invented.

![Concept: skill gap for a team](images/proposed-ai-skill-gap.png)

*Concept (R-23).* A manager's view of one team against a project need: how many of each certificate are needed, how many people hold a valid one, who is studying, and flags for gaps and key-person risk. A short AI summary sits beside the flags. The project need and the dates are invented.

**Behaviour notes.**

- AI calls would be made only from the server, and the key never reaches the browser (`R-27`; decision #6).
- The AI sees only what the signed-in user may see, because the data is read under the user's Row Level Security (`R-28`). No e-mail address or phone number is sent to the AI service (`R-29`).
- Ask Your Data would pick from a fixed list of approved queries instead of writing free SQL (decision #9). The consequence is that some questions will honestly get "I cannot answer that".
- Anything written by AI is labelled "AI". The counts in the tables come from the data, not from the AI.
- The value of all three depends on how complete and current the certificate data is (`A-03`, `A-10`), which the pilot has not yet shown.

**Linked IDs.** `R-20`, `R-23`, `R-26`, `R-27`, `R-28`, `R-29`; assumption `A-08`; WBS 10 and G1; decisions #6, #9 and #46.

**Decisions needed from the reviewer.**

11. If only one of the three concepts could be built first, which should it be (G1 condition 3)? Please rank them: suggested next certificates, Ask Your Data, skill gap.
12. For suggestions: where should the estimated study hours come from, a new catalogue field filled in by an admin, or an AI estimate shown as an estimate? The catalogue has no such field today.
13. For skill gap: who defines the project need, and how (typed in by the manager, or imported from somewhere)?
14. Is it acceptable that Ask Your Data answers only questions covered by the approved queries, and says so otherwise?

## 6. Review checklist

This table collects every question from §5, so the answers can be given in one place. The **Answer** column is for the reviewer and is `—` until answered. Answers are then recorded here and, where a choice becomes a project decision, in [decisions](../decisions.md) (WBS 1.5).

| # | Question for the reviewer | Section | Answer |
|---|---|---|---|
| 1 | Is instant feedback (highlight, top bar, placeholders) what "feels immediate" means, or must the data itself arrive faster too? | 5.1 | — |
| 2 | Top bar on every navigation, or only when a page takes longer than about half a second? | 5.1 | — |
| 3 | Starting language for a new user and the sign-in page: Vietnamese, English, or the browser's language? | 5.2 | — |
| 4 | Remember the language with the user's account (it also decides the e-mail language) or only in the browser? | 5.2 | — |
| 5 | Schedule the language switch (8.2, 4 to 7 days) before G1, or keep it after G1? | 5.2 | — |
| 6 | In Vietnamese mode, keep today's English terms ("Dashboard", "Import / Export", "Team") or translate more? | 5.2 | — |
| 7 | Who approves access requests: Admins only, or Managers for their own teams too? | 5.3 | — |
| 8 | Who may request access (any e-mail or company domain only), and does the form list team names to a visitor? | 5.3 | — |
| 9 | Send the requester an e-mail on approval or rejection? | 5.3 | — |
| 10 | Build self sign-up (it supersedes decision #12) before G1, or after G1 as planned? | 5.3 | — |
| 11 | Rank the AI concepts for G1 condition 3: suggested next certificates, Ask Your Data, skill gap. | 5.4 | — |
| 12 | Source of the estimated study hours: a new catalogue field or an AI estimate? | 5.4 | — |
| 13 | Who defines project needs for skill gap, and how? | 5.4 | — |
| 14 | Accept that Ask Your Data answers only questions covered by approved queries? | 5.4 | — |

**How to return feedback.** Write the answers in the last column of this table, or send them as comments on the pull request that carries this document, or reply to the e-mail that came with it. Free-form comments on any image are welcome; please quote the section and image (for example "5.3, image 2"). Once the answers are in, the team records them in this table, updates the affected requirement or work package, and adds an entry to [decisions](../decisions.md) where a decision was made.
