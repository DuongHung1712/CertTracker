# Certificate and course catalogues: design (Part D)

Status: **draft for discussion** with the owner. Nothing is built yet. Supersedes section 5 of `2026-11-10-review-comments-design.md`.
Branch: `feat/certificate-catalogue` from `dev` (Parts A–C merged, last migration `20261110000003`).
Review comments it answers: "Courses và Certificate riêng" and "Đối với course ... bỏ validity".

Open questions are collected in section 10, each with a proposed answer. Sections 1–9 use the proposed answers.

---

## 1. Why

Today one table, `courses`, holds two different things:

- **what a member holds** (a certificate: type, level, validity, expiry), and
- **how a member studies** (a course: duration, cost, refund terms, link).

The review asked to separate them. The owner added that a certificate is earned in two ways: by **passing an exam**, or by **finishing a course** that grants a certificate of completion.

Success means:

- an admin can describe a course and the certificate it leads to without mixing fields;
- a member records the certificate they hold, and optionally the course they studied;
- expiry, dashboards, reminders, export and import keep working with the same numbers as before the change;
- no existing record, date or proof file is lost.

Anti-goals: duplicate data entry for members; a migration that changes any existing expiry date; a model that needs a second table of "records" for courses.

## 2. Words used in this spec

| Term | Meaning | UI label |
|---|---|---|
| Certificate | A credential a member can hold. Has a kind. May expire. | Certificate |
| Exam certification | Certificate earned by passing an exam (AWS SAA, NVIDIA Generative AI LLMs). | Exam |
| Course completion | Certificate granted by finishing one specific course (Coursera ML Specialization). | Course completion |
| Course | A way to study: duration, cost, refund terms, link. Prepares for an exam, or grants a completion certificate. | Course |
| Record | A member's tracking of one certificate: status, progress, dates, proof, refund. Table `training_records`. | Certificate (in "My certificates") |
| Course studied | The course a member used for a record (optional for exams, implied for completions). | Course studied |

## 3. Scenarios

**S1. Exam with a paid course (most common).** Lan takes the Udemy course "Ultimate AWS Certified Solutions Architect Associate" (27 h, 15 USD, refundable if the exam is passed within 6 months), then passes AWS Solutions Architect Associate.
She adds a record: Certificate = AWS Solutions Architect Associate (Exam), Course studied = the Udemy course. At Completed she enters the issue date; expiry = issue date + 36 months. The admin sees the course cost and refund terms on the record for the refund.

**S2. Exam by self-study.** Minh passes the same exam without a course. Certificate = AWS SAA, Course studied = empty.

**S3. Course completion.** Hoa finishes Coursera "Machine Learning Specialization" (90 h, 49 USD), which grants a completion certificate with no expiry.
She adds a record: Certificate = Machine Learning Specialization (Course completion). Course studied is filled in automatically and cannot be changed. Expiry shows "No expiry".

**S4. A course that grants completion and prepares for an exam.** AWS Skill Builder "Exam Prep: Solutions Architect Associate" grants a completion badge and prepares for the AWS SAA exam. Both links are allowed: the completion certificate points to the course, and the course points to the exam it prepares for. A member can record either certificate or both (two records).

**S5. Manager view.** A manager sees the same dashboards. "Popular certificates" counts both kinds; breakdowns by type and provider use the certificate's type and provider.

## 4. Data model

### 4.1 Tables (sketch, not final SQL)

```sql
create type public.certificate_kind as enum ('exam', 'completion');

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  kind public.certificate_kind not null,
  cert_type_id uuid references public.cert_types (id) on delete restrict,
  provider_id uuid references public.providers (id) on delete restrict,
  level text,
  validity_months int check (validity_months is null or validity_months > 0),
  url text,
  course_id uuid unique references public.courses (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, name),
  constraint certificates_completion_has_course
    check ((kind = 'completion') = (course_id is not null))
);

alter table public.courses
  add column prepares_for_id uuid references public.certificates (id) on delete set null;
-- after the data copy (section 5): drop cert_type_id, level, validity_months from courses

alter table public.training_records
  add column certificate_id uuid references public.certificates (id) on delete restrict;
-- after the backfill: set not null; course_id drop not null;
-- drop training_records_member_course_key; add unique (member_id, certificate_id)
```

Courses keep: `name`, `provider_id`, `est_hours` (Duration), `cost`, `cost_currency`, `refundable`, `refund_conditions`, `url` (Course link), the unique `(provider_id, name)`.

### 4.2 Rules the database enforces

| Rule | How | Error |
|---|---|---|
| A completion certificate has exactly one granting course; an exam has none | check constraint above | 23514 |
| A course grants at most one completion certificate | `unique (course_id)` | 23505 |
| `courses.prepares_for_id` points to an **exam** certificate | trigger `courses_prepares_for_exam` | 23514 "prepares_for must be an exam certificate" |
| A record for a completion certificate always has the granting course as course studied | trigger `training_records_course_matches_certificate` sets `course_id` | — |
| A record for an exam certificate has no course, or a course that prepares for it | same trigger | 23514 "course does not prepare for this certificate" |
| One record per member and certificate | `unique (member_id, certificate_id)` | 23505 |
| A course that grants a completion certificate cannot be deleted while that certificate exists | `on delete restrict` | 23503 |
| A certificate with records cannot be deleted | `on delete restrict` | 23503 |

### 4.3 View `v_training_records` (security_invoker)

Changes against today's view (`20261031000003_course_cost_currency.sql`):

| Column | Today | After |
|---|---|---|
| `certificate_id`, `certificate_name`, `certificate_kind` | — | new, from `certificates` |
| `validity_months`, `expiry_date`, `days_to_expiry`, `expiry_status` | from the course | from the certificate |
| `cert_type_id`, `cert_type_name`, `provider_id`, `provider_name` | from the course | from the certificate |
| `course_name` | the course | the course studied (nullable) |
| `cost`, `cost_currency`, `est_hours` | from the course | from the course studied (nullable) |

The join to `courses` becomes a left join. Every other column is unchanged. Because columns change meaning and position, the view is dropped and recreated (not `create or replace`).

### 4.4 Functions and views that read courses today

| Object | Change |
|---|---|
| `dashboard_breakdown(p_dimension)` | dimension `course` becomes `certificate`; `cert_type` and `provider` read the certificate; `'course'` raises 22023 |
| `v_data_quality_issues` | join certificates; `course_no_validity` becomes `certificate_no_validity` and is raised **for exams only** (completions usually never expire) |
| Import commit (`commit_import`) | upsert on `(member_id, certificate_id)`; creates certificates (kind exam) instead of courses for unknown names, as today's import creates courses |
| Notifications (expiry e-mails, monthly report) | read `certificate_name` instead of `course_name` |

### 4.5 RLS

| Table | Admin | Manager | Member |
|---|---|---|---|
| `certificates` | read, write | read | read |
| `courses` | read, write (unchanged) | read | read |
| `training_records` | unchanged | unchanged | unchanged |

pgTAP covers each cell, including a refused insert and update for manager and member on `certificates`.

## 5. Migration of existing data

Every existing course row is an exam certification: the starter list (55 rows) was checked against providers' certification pages, and its cost is the exam fee.

Steps (one migration, one transaction):

1. Create the enum, `certificates`, its constraints, indexes and triggers.
2. `insert into certificates (id, name, kind, cert_type_id, provider_id, level, validity_months, url) select id, name, 'exam', cert_type_id, provider_id, level, validity_months, url from courses` (same ids).
3. `update courses set prepares_for_id = id`.
4. Add `training_records.certificate_id`, `update ... set certificate_id = course_id`, set not null, swap the unique constraint, drop not null on `course_id`.
5. Drop and recreate `v_training_records`; update `dashboard_breakdown`, `v_data_quality_issues`, the import commit function and the notification functions.
6. RLS policies on `certificates`.
7. Drop `cert_type_id`, `level`, `validity_months` from `courses`.

Before and after, for the seed:

| | Before | After |
|---|---|---|
| `courses` | AWS SAA (Cloud, AWS, Associate, 36 m, refundable, url); NVIDIA Generative AI LLMs (AI, NVIDIA, Associate, 24 m) | same two rows, without type/level/validity; `prepares_for_id` = their own id |
| `certificates` | — | AWS SAA (exam, Cloud, AWS, Associate, 36 m, url); NVIDIA Generative AI LLMs (exam, AI, NVIDIA, Associate, 24 m) |
| `training_records` | An–AWS done, Bình–NVIDIA in progress, Châu–AWS not started | same, plus `certificate_id` = old `course_id`; `course_id` kept (now "course studied") |
| An–AWS expiry | issue date + 36 m | identical (pgTAP asserts) |

The seed also gains one completion example (a course "Machine Learning Specialization" on Coursera and its completion certificate, no records) so the e2e can cover S3.

Cloud: Q2 says production has no real certificates yet; the rollout is still backup → `supabase db push` → counts before and after (section 9).

## 6. Screens

### 6.1 Catalogue (`/courses`, renamed "Catalogue" in the sidebar)

Two tabs. Members and managers read; only the admin adds, edits and deletes.

**Certificates tab** columns: Name, Kind, Type, Provider, Level, Validity, Link, Granted by (course, for completions).

Certificate form:

| Field | Shown | Rule / message |
|---|---|---|
| Kind | always, first | "Exam" or "Course completion"; required |
| Name | always | "Enter the certificate name" |
| Certificate type | always | "Choose a certificate type" |
| Provider | always | "Choose a provider" |
| Level | always | optional |
| Validity (months) | always | optional; "Validity must be greater than 0"; empty = No expiry |
| Certificate link | always | optional URL |
| Course | only for Course completion | required: "Choose the course that grants this certificate"; lists courses that grant nothing yet |

Changing the kind of a certificate that has records: allowed only from exam to completion when every record's course studied is empty or equals the chosen course (otherwise "This certificate has records with another course. Change them first."). See Q6.

**Courses tab** columns: Name, Provider, Duration (hours), Cost, Refundable (with conditions), Link, Prepares for, Grants.

Course form: Name, Provider, Duration (hours), Cost + Currency, Refundable + Refund conditions (Part A), Course link, **Prepares for** (optional picker over exam certificates).

### 6.2 Certificate form for a record ("Add certificate")

Order: Member (admin/manager only) → **Certificate** → Course studied → Status → the status-dependent fields from PR #28.

| Situation | Course studied field |
|---|---|
| no certificate chosen yet | hidden |
| exam certificate | optional picker; options = courses whose "Prepares for" is this certificate; empty option "None (self-study)" |
| completion certificate | shown read-only with the granting course; always saved |

Certificate options show the kind, e.g. "AWS Solutions Architect Associate · Exam". Hint under the field: "Can't find your certificate? Ask your admin to add it." Duplicate message: "This member already has this certificate. Edit the existing one instead of creating a new one."

### 6.3 Records list, dashboards, member pages

- Records table: column "Course" becomes "Certificate" (name + kind badge); a new optional column "Course studied" (hidden by default on narrow screens).
- Dashboards: Explorer tab "Popular courses" becomes "Popular certificates"; "By certificate type" and "By provider" read the certificate. Manager "Next to expire" and "Planned exams" show the certificate name.
- Member dashboard and "My certificates": certificate name; the course studied appears as a secondary line when set.
- E-mails (expiry reminder, monthly report): certificate name.

### 6.4 Export and import (records)

Export columns (same order, changes in bold):

`Code, Full name, Email, Team, Career role, YoE,` **`Certificate`**, **`Kind`**, `Provider, Certificate type, Validity (months),` **`Course studied`**, `Cost, Currency, Duration (hours), Status, ...` (rest unchanged). Cost, Currency and Duration now come from the course studied.

Import:
- The "Course" column (and its aliases "chứng chỉ", "certificate", "certification", ...) matches a **certificate** by name and provider, as it matched a course before. Unknown names create an exam certificate, as unknown courses were created before.
- New optional column "Course studied" matches a course by name; it must prepare for the certificate (otherwise a row error "This course does not prepare for <certificate>").
- Old workbooks (without "Course studied") import unchanged; exports round-trip.

## 7. Edge cases

| Case | Behaviour |
|---|---|
| Admin deletes a course that grants a completion certificate | refused: "This course grants the certificate <name>. Delete or change that certificate first." |
| Admin deletes a course that prepares for an exam and is used as course studied | records keep the certificate; `course_id` set null (the records FK changes from `on delete restrict` to `on delete set null`) — see Q12 |
| Admin changes a course's "Prepares for" while records use it as course studied | existing records keep their course (no re-validation of old rows); new saves are validated |
| Admin changes a certificate's validity | every record's expiry is recomputed (computed in the view, decision: computed fields never stored) |
| Admin deletes a certificate with records | refused (23503): "This certificate has records. Delete them first." |
| Member edits a record and switches the certificate | allowed; course studied is cleared (exam) or set (completion) |
| Completion certificate with a validity | allowed (some vendors expire badges); expiry works as for exams |

## 8. What does not change

Record status, progress, dates, proof upload, refund fields, the status-dependent form, RLS scope rules for managers, the member import (Part C), the profile page (Part B).

## 9. Rollout

1. Merge into `dev` after CI.
2. Local: `pnpm exec supabase migration up --local`, `pnpm db:types` (never `supabase db reset`).
3. Production, with the release PR to `main`: backup (`supabase db dump --linked` schema and data), record counts of `courses` and `training_records`, `supabase db push --dry-run` (lists only the new migration), `supabase db push`, counts again (`certificates` = old `courses`, `training_records` unchanged), check one expiry date on `/records`.
4. Decision #65 in `docs/decisions.md`; data model section of `2026-09-26-certtracker-design.md` updated.

## 10. Open questions (proposed answers in bold)

| # | Question | Proposed answer | Why |
|---|---|---|---|
| Q6 | May an admin change a certificate's kind after it has records? | **Only exam → completion, and only when every record's course studied is empty or the chosen course.** Completion → exam is allowed when the course is cleared. | Keeps the trigger rule true for old records without silently rewriting them. |
| Q7 | Should every migrated row also stay a course? | **Yes (each existing row becomes an exam certificate and keeps a course that prepares for it).** Alternative: keep a course only where cost, hours or refund data exist. | No data loss; the admin can delete the extra courses later. |
| Q8 | Where does the exam fee live? | **On the course for now (cost of the course studied).** A separate exam fee on the certificate is out of scope. | Today's cost column already mixes both; splitting fees is a later request. |
| Q9 | Do completion certificates count in KPIs (valid, completed) like exams? | **Yes, with the kind shown where space allows.** | The owner treats completions as certificates. |
| Q10 | Data quality: flag certificates without validity? | **Exams only.** | Completions usually never expire. |
| Q11 | Can a member suggest a new certificate or course? | **No (unchanged: only the admin adds; hint tells the member to ask).** | Decision of 2026-11-06. |
| Q12 | When a prepared-for course is deleted, what happens to records that used it? | **Keep the record, clear the course studied.** | The certificate is what matters; refund history is on the record. |
