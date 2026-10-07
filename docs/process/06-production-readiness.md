# Production readiness

- **Status:** Draft v1 — checklist written before production work has started; items marked *proposed* need the sponsor's confirmation
- **Last updated:** 2026-10-07
- **Owner:** CertTracker team (DC34)
- **Sources:** [Process status](00-process-status.md), [Requirements and CA](01-requirements-and-ca.md), [WBS](02-wbs.md), [SAD](03-sad.md), [PoC and MVP](05-poc-and-mvp.md), [Decisions](../decisions.md), [Free-tier deployment](../deploy/task9-free-tier.md), [E-mail and cron runbook](../deploy/cron-email.md), `.github/workflows/ci.yml`, `package.json`, `vercel.json`, `supabase/config.toml`

> **Tóm tắt (VI):** CertTracker **chưa** phải dịch vụ production: URL công khai hiện là bản pilot chạy từ nhánh `main` trên gói miễn phí. Tài liệu này là danh sách những gì phải đúng trước khi lên production (hosting, sao lưu và khôi phục, bảo mật, bảo vệ dữ liệu cá nhân, vận hành email, giám sát lỗi, quy trình phát hành, hiệu năng, khả năng truy cập, hỗ trợ người dùng), kèm hiện trạng đã kiểm tra, vai trò chịu trách nhiệm và work package (9.4 là gói mới). Có thêm checklist phát hành đề xuất, bảng phân vai (đề xuất, chờ sponsor xác nhận) và điều kiện go/no-go. Chưa mục nào được đánh dấu là xong.

## 1. Status

**Not started.** The public Vercel URL is a pilot deployment of `main`, not a production service ([00 §2](00-process-status.md)). As of 2026-10-07:

- Hosting is Vercel Hobby (non-commercial use only) and Supabase Free (no automatic backups; the project pauses after 7 idle days) — decision #13 and the [deployment notes](../deploy/task9-free-tier.md).
- Database migrations reach the cloud only when pushed manually (`pnpm supabase db push`), so the cloud schema can lag behind the code; this document makes no claim about its current state.
- There is no evidence in the repository that the sending domain is verified on Resend ([runbook](../deploy/cron-email.md) §1; decision #40).
- Week 6 (scheduled e-mail, data quality) is in pull request #16, which is open and **not merged** into `dev` (checked with `git ls-remote origin`: the PR head is not contained in `origin/dev`). `main`, which the public URL builds from, was last updated by PR #14 (weeks 1–4).

## 2. Checklist

"Today" is what was checked in the repository on 2026-10-07; nothing is claimed about the cloud dashboards unless a document in the repository records it. "Needed before production" is **Yes** when production must wait for the item. Owner is a role: **Owner** = the developer; **Admin**, **Sponsor** and **Data owner** as in [01 §2](01-requirements-and-ca.md).

| ID | Area | Item | Why | Today | Needed before production | Owner | WBS |
|---|---|---|---|---|---|---|---|
| PRD-01 | Hosting | A hosting plan that allows the intended use: Vercel Pro, or the Next.js app on a VPS (Docker) with Supabase staying in the cloud | Vercel Hobby is non-commercial; decision #13 says to move before official use | Vercel Hobby + Supabase Free (decision #13) | **Yes** — the choice recorded in `decisions.md` | Sponsor (decides), Owner (implements) | 9.3 |
| PRD-02 | Hosting | A database plan that does not pause | Supabase Free pauses after 7 idle days; restoring takes minutes and users see errors meanwhile | Supabase Free | **Yes** | Sponsor | 9.3 |
| PRD-03 | Hosting | Database region confirmed and the server functions placed near it | Latency (suspected cause of slow navigation, [02](02-wbs.md) §4); the data owner may ask where the data lives | The deployment notes record Tokyo (`ap-northeast-1`) but their set-up steps say Singapore; not confirmed in the Supabase dashboard; function region not measured | **Yes** | Owner | 8.1 |
| PRD-04 | Backup and recovery | Automatic backups: a Supabase plan with backups, or a scheduled `pg_dump` stored outside Supabase | Without a backup, one mistake or incident loses all data; the deployment notes say not to load real personal data until backups exist | No automatic backups (Supabase Free, decision #13); no backup procedure in the repository | **Yes** | Owner | 9.4 |
| PRD-05 | Backup and recovery | A restore has been tested into a separate project and written down | A backup that was never restored is not known to work | Never done | **Yes** | Owner | 9.4 |
| PRD-06 | Backup and recovery | Recovery targets agreed: *proposed* RPO 24 hours (at most one day of changes lost) and RTO 1 working day | Sets the backup frequency and how fast service must return | None defined | **Yes** — targets confirmed by the sponsor | Sponsor | 9.4 |
| PRD-07 | Security | Secrets only in Vercel environment variables (Production), never in the repository or chat | Leaked keys bypass RLS (service role) or allow sending mail | `.env` and `.env.*` are git-ignored except `.env.example`; the runbook lists the five production variables (`RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`); whether they are set on Vercel is not recorded | **Yes** — set in Production and confirmed on the Settings page ("Cấu hình" block, [runbook](../deploy/cron-email.md) §2) | Owner | 9.1 |
| PRD-08 | Security | A written procedure to rotate the service-role key (rotate in Supabase, update Vercel, redeploy), used once before production and whenever someone with access leaves | The key bypasses RLS (decision #35) | No procedure in the repository | **Yes** | Owner | 9.4 |
| PRD-09 | Security | `CRON_SECRET` is random and at least 16 characters | The cron routes fail closed (HTTP 500) when it is missing or shorter (decision #39) | Code check exists; the production value is not recorded | **Yes** | Owner | 9.1 |
| PRD-10 | Security | RLS tests run in CI and must pass before merging | RLS is the main protection (decision #5) | CI runs lint, type check, unit tests, pgTAP (10 files on this branch, 2 of them from week 6) and a build on every pull request and on pushes to `main` and `dev` (`.github/workflows/ci.yml`); whether GitHub branch protection makes CI mandatory is not visible in the repository | **Yes** — branch protection on `main` requires CI | Owner | 9.4 |
| PRD-11 | Security | Dependencies updated on a fixed routine, including a decision on the deprecated `@react-email/components` | Known vulnerabilities; decision #43 kept the deprecated package for now | No automated update configuration in the repository (no `.github/dependabot.yml`); `@react-email/components` still in `package.json` (decision #43); SheetJS installed from its CDN at 0.20.3 (decision #27) | **Yes** — routine agreed (*proposed*: monthly) | Owner | 9.4 |
| PRD-12 | Security | Least privilege: a reviewed list of Admin accounts and of who can open the Supabase, Vercel and Resend dashboards; *proposed*: two-factor sign-in on those dashboards | Admins and dashboard users can read and change everything | Admin role is set by SQL (deployment notes, B4); no list of admins or dashboard users is kept in the repository | **Yes** | Sponsor (approves), Admin | 9.4 |
| PRD-13 | Security | Self sign-up stays disabled unless `R-31` is approved | Only internal staff may have accounts (decision #12; decision #42 defers sign-up) | `enable_signup = false` in `supabase/config.toml` (local); for the cloud the deployment notes (B3) say to switch sign-up off in the dashboard, which is not re-checked here | **Yes** — confirmed in the cloud dashboard | Owner | 9.4 |
| PRD-14 | Data protection | The data owner approves storing the personal data in a cloud service: names, work e-mails, team, certificates with dates, and evidence files (which may show more personal details) | `A-05` is recorded as a project decision (decision #1) but must be confirmed with the data owner before production ([01 §7](01-requirements-and-ca.md)) | Not confirmed | **Yes** — written approval | Data owner | 9.4 |
| PRD-15 | Data protection | A retention rule for people who leave: how long their records and evidence are kept and who deletes them | Personal data should not be kept without a reason | `members.is_active = false` excludes a person from counts and e-mails (decisions #31, #34) but keeps all their data; a member with records cannot be deleted until the records are deleted (`src/features/members/actions.ts`); logins are removed only in the Supabase dashboard; no retention rule exists | **Yes** | Data owner (rule), Admin (applies it) | 9.4 |
| PRD-16 | Data protection | Evidence is only reachable through short-lived signed links after a permission check | Evidence files are the most sensitive data | Private bucket with per-role policies; the download route reads the record under the user's RLS and redirects to a link valid for 60 seconds (`src/app/api/records/[id]/evidence/route.ts`; [05](05-poc-and-mvp.md) P-04) | **Yes** — already in place; keep it, and the data owner accepts that a link works for 60 seconds if forwarded | Owner | — |
| PRD-17 | E-mail operations | Sending domain verified on Resend (SPF, DKIM; DMARC recommended) and `EMAIL_FROM` on that domain | An unverified sender only delivers to the Resend account owner (decision #40); missing records send mail to spam | No evidence of verification in the repository; who controls the DNS is not recorded | **Yes** | Owner, with the DNS holder (to be assigned by the sponsor) | 9.1 |
| PRD-18 | E-mail operations | Someone reads the result of every scheduled run: the Vercel cron dashboard and the Settings e-mail history after each Monday and each 1st of the month | A failed or truncated run turns red on Vercel (HTTP 500) but nobody is notified otherwise (decisions #39, #44) | Week 6 is not deployed; nobody is assigned | **Yes** | Admin | 9.4 |
| PRD-19 | E-mail operations | The runbook steps for `truncated`, `inFlight` and failures are known and have been rehearsed once | `truncated` (HTTP 500) → call again until it is false; `inFlight` (HTTP 200) → wait about 15 minutes and call again; `failed` → read `failures[]`, fix, call again (decisions #39, #44; [runbook](../deploy/cron-email.md) §5–§6) | Documented in the runbook (Vietnamese); never exercised against Resend | **Yes** — rehearsed during the pilot | Owner, Admin | 9.2 |
| PRD-20 | E-mail operations | Capacity matches the number of recipients | One run handles about 40–80 recipients (runbook estimate: 50-second budget, at least 600 ms between e-mails); Resend free allows 100 e-mails per day and 3,000 per month ([runbook](../deploy/cron-email.md) §1, §5) | Real recipient numbers unknown (`A-09`) | **Yes** — recipient count known; a second call or a paid Resend plan planned if needed | Owner | 9.4 |
| PRD-21 | Monitoring and errors | An error-tracking service for server and browser errors (*proposed*: one with a free tier) | Errors are otherwise invisible unless a user reports them | None: no error-tracking package in `package.json` and no such integration in `src/` | **Yes** | Owner | 9.4 |
| PRD-22 | Monitoring and errors | An uptime check on the public URL that alerts by e-mail (*proposed*) | A paused database or a broken deployment is otherwise noticed by users first | None | **Yes** | Owner | 9.4 |
| PRD-23 | Monitoring and errors | Logs kept long enough to investigate an incident | Vercel function logs are kept only briefly on Hobby (see Vercel's current plan limits); each cron run writes one JSON line of counts (decision #44); the Settings history is the durable e-mail record | Vercel Hobby logs only | **Yes** — retention decided (with PRD-01) | Owner | 9.4 |
| PRD-24 | Release process | The release flow and the checklist in §3 are adopted | Today's flow works but is not written down in one place | Branch → pull request → CI (lint, type check, unit, pgTAP, build) → `dev` → release PR to `main` → Vercel production (deployment notes, C2). End-to-end tests run only locally (`playwright.config.ts`; not in `ci.yml`) | **Yes** — every production release follows §3 and records the local end-to-end result | Owner | 9.4 |
| PRD-25 | Release process | Migrations are pushed to the cloud **before** the code that needs them, and checked afterwards | New pages fail if the view or function they need is missing ([runbook](../deploy/cron-email.md) §3: database first, code second) | Pushed manually with `pnpm supabase db push`; the cloud schema can lag behind `main` | **Yes** — a step in §3 | Owner | 9.1 |
| PRD-26 | Release process | A rollback procedure: redeploy the previous Vercel production build; repair the database with a new forward migration | Bad releases happen; the repository has only forward migrations (no down migrations in `supabase/migrations/`) | Not written down, not rehearsed | **Yes** — written and rehearsed once | Owner | 9.4 |
| PRD-27 | Performance | `SM-4` met: feedback at once and a 75th-percentile page load under 1 second (*proposed* target) | Slow navigation hurts adoption (manager feedback of 2026-10-05) | Signed-in pages not measured; one loading state on `dev` and none on `main` ([02](02-wbs.md) §4) | **Yes** | Owner | 8.1 |
| PRD-28 | Accessibility | Keyboard and screen-reader audit done and blocking issues fixed | `NFR-05` is `Partial` | Contrast is tested automatically (`src/app/tokens.test.ts`); no audit | **Yes** | Owner | 8.4 |
| PRD-29 | Support and ownership | Named roles for answering users and for incidents, with working hours | Without an owner, problems wait | Nobody assigned | **Yes** | To be assigned by the sponsor | 9.4 |
| PRD-30 | Support and ownership | One channel for users to report problems | Problems must reach someone who can act | None defined; the pilot uses a pilot log ([05 §6](05-poc-and-mvp.md)) | **Yes** | To be assigned by the sponsor | 9.4 |
| PRD-31 | Support and ownership | A short admin guide: create accounts and roles, assign managers, import, data quality, read the e-mail history | Today only the developer knows the account steps; there is no account screen in the application | The deployment notes and the runbook exist (in Vietnamese, written for the developer); no admin guide | **Yes** | Owner | 9.4 |

## 3. Release checklist (proposed)

For one production release, in this order. Commands are the repository's own (`package.json` and the runbooks).

1. The feature pull requests in this release were merged into `dev` with CI green (lint, type check, unit tests, pgTAP, build).
2. On the release commit, locally: `pnpm lint`, `pnpm typecheck`, `pnpm test`; `pnpm supabase start` then `pnpm test:db`; `pnpm test:e2e` with `EMAIL_TRANSPORT=console` (the e-mail end-to-end spec refuses to run otherwise). Record the results in the release pull request.
3. Open the release pull request `dev` → `main`. List the migrations it contains and any new or changed environment variables.
4. Take a backup of the cloud database (PRD-04) and note where it is stored.
5. If the release contains migrations, push them **before** merging: `pnpm supabase migration list`, `pnpm supabase db push --dry-run`, `pnpm supabase db push`, then `pnpm supabase migration list` again (Local and Remote must match). Never run `supabase db reset --linked` or `supabase config push` ([runbook](../deploy/cron-email.md) §3; [deployment notes](../deploy/task9-free-tier.md), B2).
6. Set or change environment variables in Vercel (Production only); a change needs a redeploy to take effect ([runbook](../deploy/cron-email.md) §2).
7. Merge the release pull request. Vercel builds `main` as production (deployment notes, C2).
8. Smoke test on the public URL as in the deployment notes (section E), then sign in once as each role.
9. As Admin, open Settings: the configuration block shows every item as configured.
10. Call both cron routes with `?dryRun=1` ([runbook](../deploy/cron-email.md) §5): `transport` is `resend`, the recipients are as expected and `undeliverable` is empty. Never call a cron route without `dryRun` unless a real send is intended.
11. Record the release (date, commit, migrations, test results) in the release pull request, and check the next scheduled run in the Settings history (PRD-18).
12. If the release is broken: redeploy the previous production build in Vercel; if the database is involved, fix it with a new forward migration (PRD-26).

## 4. Responsibilities (RACI-light)

*Proposed — to be confirmed by the sponsor.* R = does the work, A = answers for the result, C = asked before.

| Activity | Responsible | Accountable | Consulted |
|---|---|---|---|
| Releases (checklist in §3) | Owner | Owner | Admin |
| Database migrations | Owner | Owner | — |
| Backups and the restore test | Owner | Sponsor | Data owner |
| E-mail operations (reading each run, re-running, fixing failures) | Admin | Owner | Team managers |
| User accounts, roles and team managers | Admin | Sponsor | Team managers |
| Incident response | Owner | Sponsor | Admin |
| Data-protection questions (storage, retention, deletion) | Data owner | Sponsor | Owner, Admin |
| Gate G1 and the production go decision | Sponsor | Sponsor | Owner, Admin, Data owner, Team managers |

## 5. Go/no-go for production

Production starts only when all of these are true:

1. Every item in §2 with **Yes** under "Needed before production" is done (WBS 9.4).
2. The MVP acceptance criteria in [05 §5](05-poc-and-mvp.md) are met.
3. Gate G1 is passed ([00 §3](00-process-status.md)).
4. The sponsor's written go decision is recorded in [decisions.md](../decisions.md).

As of 2026-10-07 none of the four is true.
