# Review comments of 2026-11-10: design

Five review comments on CertTracker, the current state of each in the code, and what we build. Base branch: `dev`.

| # | Comment (as written) | Part |
|---|---|---|
| 1 | Manager dựa trên org | A (no code) |
| 2 | Import Users | C |
| 3 | Courses và Certificate riêng | D |
| 4 | Đối với course sẽ có info duration, bỏ validity, thêm điều kiện refund (có thể là notes). Thêm link | A (duration, refund conditions, link) and D (remove validity) |
| 5 | Thêm page profile setting | B |

## 0. Owner decisions

Each question had a default that this spec and its plan used. Answers from the owner are marked **Answered** with the date; a different answer changes only the part named.

| # | Question | Default | Changes |
|---|---|---|---|
| Q1 | In the certificate form, does a member pick a **certificate** (the credential, with validity) and optionally the course they studied, or still a course? | **Answered 2026-11-10:** separate courses and certificates. The owner noted that a course can itself grant a certificate of completion while a certification is earned by an exam, and asked for a proposal: section 5 (two kinds of certificate; the member picks a certificate, the course is optional or implied). | Part D |
| Q2 | Has DAS entered real data in the cloud database? | No (checked 2026-11-05: no courses, no certificates). Part D migrates existing rows anyway, so the answer only changes how carefully the cloud migration is rehearsed. | Part D rollout |
| Q3 | Does importing users also send invitations? | No. Import creates members; invitations stay as today (Supabase Dashboard, runbook in `docs/deploy/`). | Part C |
| Q4 | "Thêm link" in comment 4: which link? | The course link, which already exists ("Course link"). The certificate gets its own link in Part D ("Certificate link", for the exam or credential page). | Parts A, D |
| Q5 | May a member change their own name or email on the profile page? | **Answered 2026-11-10:** the name yes (the user edits it through `set_my_full_name`), the email no (the admin changes it; the account is linked to the member by email, decision #60). Decision #63. | Part B |

## 1. Comment 1: manager based on the organisation (Part A, no code)

Already built in M1 (decision #55, spec `2026-10-31-m1-platform-changes-design.md`):

- `manager_scopes` assigns a manager to teams and/or programs; a program scope covers every team in it at query time.
- The admin assigns managers on `/org` (Programs and Teams sections).
- The admin is the DC lead and covers the whole DC; there is no DC-level manager.
- RLS, not code, limits what a manager sees.

Resolution to post on the comment: "Done in M1: managers are assigned per team or program on the Organisation page (/org); a program covers all its teams; the admin covers the DC (decision #55)." The profile page (Part B) also shows a manager their own scope, so the link is visible to them.

## 2. Comment 4, first part: course details (Part A)

- **Duration:** the course's `est_hours` is shown as **"Duration (hours)"** in the course form, the courses table and the records export ("Study hours" becomes "Duration (hours)"). The column name stays `est_hours` (no rename churn). The import also accepts the headers "duration" and "duration (hours)".
- **Refund conditions:** new nullable column `courses.refund_conditions text`, at most 1000 characters (check constraint and Zod). The form shows a "Refund conditions" textarea only while "Refundable" is on; turning "Refundable" off saves `null`. The courses table shows the text under the "Refundable" badge, cut to one line with the full text in a tooltip.
- **Link:** already there ("Course link"). No change.
- Not in the records export, not in the import (YAGNI; add later if asked).

## 3. Comment 5: profile page (Part B)

New page `/profile` for every role, opened from a new "Profile" item in the user menu (above "Sign out").

Sections, top to bottom:

1. **Account** (read-only): full name, email, role badge, member code and team (when linked to a member), and the line "Ask your admin to change your name or email." An account not linked to a member shows "Not linked to a member" instead of code and team.
2. **Scope** (managers only, read-only): the teams and programs from `manager_scopes` for this user (policy "manager_scopes: read own" already allows it), each with its name. Empty: "No teams or programs assigned yet."
3. **Career**: the existing `CareerCard` moves here from `/me` (`/me` no longer shows it; each fact appears once). Members still edit their career start here; the admin still sets the career role on `/members`.
4. **Password**: "Change password" form with current password, new password, confirm. The server action checks the current password with `signInWithPassword` for the signed-in email, then calls `updateUser({ password })`. Rules: same as `setPasswordSchema` (length and match). Wrong current password: "The current password is not correct." Success: toast "Password changed" and the fields clear; the session stays.

Out of scope: editing name or email (Q5), e-mail notification preferences, avatar, two-factor.

The admin page `/settings` keeps its name and content (career roles, e-mail history).

## 4. Comment 2: import users (Part C)

Admin only. On `/members`, a new "Import members" button opens a dialog:

1. **Upload** an `.xlsx` or `.csv` file (at most 4 MB and 500 data rows). A "Download template" link serves `public/templates/members-import.csv` with the header row `Full name,Email,Team,Career role`.
2. **Read**: the first sheet; headers matched case- and accent-insensitively (`Full name`/`Name`/`Họ tên`, `Email`/`E-mail`, `Team`/`Nhóm`, `Career role`/`Role`). Team and career role are matched by name, case-insensitively, against existing rows; nothing new is created from the file.
3. **Preview** (nothing saved yet): one row per line with its result:
   - **Create**: valid and the email is new.
   - **Skip**: the email already belongs to a member (never renamed or moved, as in decision #21).
   - **Error**: missing name, bad email, unknown team, unknown career role, or an email that appears twice in the file (both rows).
   Counts at the top: "N to create, N skipped, N with errors".
4. **Import**: "Import N members" (disabled when N = 0) inserts every Create row in one statement, so either all are saved or none. Error rows are not imported. Afterwards the dialog shows "Imported N members." and the list refreshes.

Validation runs on the server for both preview and import (the import action re-reads the file it is given; it never trusts a client-side preview). No invitations are sent (Q3).

## 5. Comments 3 and 4 (second part): separate certificates and courses (Part D)

### 5.1 The idea

A member tracks **certificates**: the document they hold, which may expire. A certificate is earned in one of two ways, so there are two kinds:

- **Exam certification**: earned by passing an exam (AWS Solutions Architect Associate, NVIDIA Generative AI LLMs). Usually has a validity in months.
- **Course completion**: granted by finishing one course (for example a Coursera specialisation). Usually has no expiry.

A **course** is how someone studies: it has a duration, a cost, refund terms and a link. A course either **grants** a completion certificate, or **prepares for** an exam certification.

| Course | Certificate | How they connect |
|---|---|---|
| "Ultimate AWS Certified Solutions Architect Associate" (Udemy, 27 h, 15 USD, refundable if the exam is passed within 6 months) | "AWS Solutions Architect Associate" (exam, Cloud, AWS, 36 months) | the course prepares for the certificate |
| "Machine Learning Specialization" (Coursera, 90 h, 49 USD) | "Machine Learning Specialization" (course completion, AI, Coursera, no expiry) | the course grants the certificate |
| none | "AWS Solutions Architect Associate" | a member who self-studied records only the certificate |

### 5.2 Model

- **`certificates`** (new): `name`, `kind` (`exam` or `completion`), `cert_type_id`, `provider_id`, `level`, `validity_months` (null = no expiry), `url` ("Certificate link": the exam or credential page), `course_id` (only for `completion`: the course that grants it), timestamps.
  - Unique `(provider_id, name)`.
  - Check: `kind = 'completion'` requires `course_id`; `kind = 'exam'` requires `course_id is null`.
  - `course_id` is unique: a course grants at most one completion certificate.
- **`courses`** (slimmed): `name`, `provider_id`, `est_hours` (Duration), `cost`, `cost_currency`, `refundable`, `refund_conditions`, `url` (Course link), `prepares_for_id` (nullable; must point to an `exam` certificate, enforced by a trigger). `cert_type_id`, `level` and `validity_months` move to `certificates` and are dropped from `courses`.
- **Record** (`training_records`): gains `certificate_id uuid not null`; `course_id` becomes nullable and means "the course studied". Uniqueness moves from `(member_id, course_id)` to `(member_id, certificate_id)`. Status, progress, dates, proof and refund fields stay on the record.
  - For a `completion` certificate, `course_id` is always the granting course (a trigger sets it; the form shows it read-only).
  - For an `exam` certificate, `course_id` is optional and, when set, must be a course that prepares for that certificate (trigger).
- **Expiry** = issue date + the **certificate's** validity. No validity: "No expiry".

### 5.3 Migration of existing data (no loss)

Every existing course row is an exam certification with its own cost, hours and refund data (the starter list was checked against the providers' certification pages). In one migration, in a transaction:

1. Create `certificates` and copy every course into it **with the same id**, `kind = 'exam'`, taking name, cert type, provider, level, validity and url.
2. Keep every course row and set `courses.prepares_for_id = courses.id` (each existing course prepares for the certificate copied from it). The admin can later rename or delete courses that are not real courses.
3. Add `training_records.certificate_id`, fill it with `course_id` (same id), set it not null, swap the unique constraint, make `course_id` nullable (existing rows keep `course_id`, which now means the course studied).
4. Recreate `v_training_records` (security_invoker) to join `certificates` for kind, type, provider, level, validity and expiry, and `courses` (left join) for the course studied, its cost and duration. New columns `certificate_name` and `certificate_kind`; `course_name` becomes the course studied and may be null.
5. Update `dashboard_breakdown` (dimension `course` becomes `certificate`; `cert_type` and `provider` read the certificate), the data-quality view, the import commit function (`on conflict (member_id, certificate_id)`), and the notification queries.
6. RLS on `certificates`: everyone signed in reads; only the admin writes (same as `courses`). pgTAP for the three roles, including refused writes by a manager and a member, and the kind and course rules.
7. Drop the moved columns from `courses` last.

The expiry date of every existing record must be the same before and after (pgTAP).

### 5.4 Screens

- `/courses` becomes **"Catalogue"** with two tabs; only the admin edits, as today.
  - **Certificates**: name, kind ("Exam" or "Course completion"), type, provider, level, validity, link. The form asks for the kind first; "Course completion" shows a required **Course** picker (the granting course).
  - **Courses**: name, provider, duration, cost, refundable and conditions, link, and "Prepares for" (optional picker over exam certificates). A course that grants a completion certificate shows that certificate's name in the table.
- Certificate form (records): **Certificate** (required) replaces Course; each option shows its kind. Then:
  - exam certificate: optional **Course studied** picker listing only the courses that prepare for it;
  - course completion: **Course** shown read-only (the granting course).
  - Hint: "Can't find your certificate? Ask your admin to add it."
- Records table, member list, dashboards and exports say "Certificate" for the credential and "Course studied" for the course. The Explorer tab "Popular courses" becomes "Popular certificates"; breakdowns by type and provider use the certificate.
- Import (records): the Excel "Course" column maps to the certificate by name (today's rows are certificates); a new optional "Course studied" column maps to a course.

### 5.5 Out of scope

A course preparing for several certificates (many-to-many), tracking a course that leads to no certificate, renaming the `training_records` table, exam fees as a separate cost.

## 6. Global constraints

- RLS is the security layer; user queries go through `lib/supabase/server.ts`; no service role outside cron.
- Every view `security_invoker = true`; computed fields (expiry, days to expiry) stay in views.
- Dates in `Asia/Ho_Chi_Minh` via `lib/dates.ts`; displayed `dd/MM/yyyy`.
- No `any`; Zod on the server for every action.
- Schema change = new migration + RLS tests + `pnpm db:types`.
- UI text in English, sentence case, design-system tokens only.
- Each part ships on its own branch from `dev` (`feat/course-details`, `feat/profile-page`, `feat/import-members`, `feat/certificate-catalogue`).
- New decision entries in `docs/decisions.md` for Parts B (#63), C (#64) and D (#65: certificates and courses are separate catalogues; two kinds of certificate).
