# Production readiness

- **Status:** Draft v1 — checklist written before production work has started; items marked *proposed* need the sponsor's confirmation
- **Last updated:** 2026-10-07
- **Owner:** CertTracker team (DC34)
- **Sources:** [Process status](00-process-status.md), [Requirements and CA](01-requirements-and-ca.md), [WBS](02-wbs.md), [SAD](03-sad.md), [PoC and MVP](05-poc-and-mvp.md), [Decisions](../decisions.md), [Free-tier deployment](../deploy/task9-free-tier.md), [E-mail and cron runbook](../deploy/cron-email.md), `.github/workflows/ci.yml`, `package.json`, `vercel.json`, `supabase/config.toml`

> **Tóm tắt (VI):** CertTracker **chưa** phải dịch vụ production: URL công khai hiện là bản pilot chạy từ nhánh `main` trên gói miễn phí. Tài liệu này là danh sách những gì phải đúng (hosting, sao lưu và khôi phục, bảo mật, bảo vệ dữ liệu cá nhân, vận hành email, giám sát lỗi, quy trình phát hành, hiệu năng, khả năng truy cập, hỗ trợ người dùng), chia làm hai mức: mục `Pilot` phải xong trước khi pilot với một team thật (work package 9.1), mục `Production` phải xong trước khi lên production (chủ yếu 9.4). Mỗi mục có hiện trạng đã kiểm tra, vai trò chịu trách nhiệm và work package. Chỉ một mục đã có sẵn và cần giữ nguyên (link minh chứng có thời hạn 60 giây); mọi mục khác chưa đạt. Có thêm checklist phát hành, bảng phân vai và điều kiện go/no-go, tất cả đều là **đề xuất** chờ sponsor xác nhận.

## 1. Status

**Not started.** The public Vercel URL is a pilot deployment of `main`, not a production service ([00 §2](00-process-status.md)). As of 2026-10-07:

- Hosting is Vercel Hobby (non-commercial use only) and Supabase Free (no automatic backups; the project pauses after 7 idle days) — decision #13 and the [deployment notes](../deploy/task9-free-tier.md).
- Database migrations reach the cloud only when pushed manually (`pnpm supabase db push`), so the cloud schema can lag behind the code; this document makes no claim about its current state.
- There is no evidence in the repository that the sending domain is verified on Resend ([runbook](../deploy/cron-email.md) §1; decision #40).
- Week 6 (scheduled e-mail, data quality) is in pull request #16, open, not merged (as of 2026-10-07). `main`, which the public URL builds from, was last updated by PR #14 (weeks 1–4).

## 2. Checklist

"Today" is what was checked in the repository on 2026-10-07; nothing is claimed about the cloud dashboards unless a document in the repository records it.

"Needed before" says when the item must be done: **Pilot** — before the two-week pilot with one real team ([05 §6](05-poc-and-mvp.md)), as part of work package 9.1 (pilot readiness); **Production** — before CertTracker becomes a production service, mostly work package 9.4.

Owner is a role: **Developer (owner)** = the developer who built CertTracker; **Admin** and **Sponsor** as in [01 §2](01-requirements-and-ca.md); **Data owner** = the person responsible for the personnel data, to be named by the sponsor (also in [01 §2](01-requirements-and-ca.md)).

| ID | Area | Item | Why | Today | Needed before | Owner | WBS |
|---|---|---|---|---|---|---|---|
| PRD-01 | Hosting | A hosting plan that allows the intended use: Vercel Pro, or the Next.js app on a VPS (Docker) with Supabase staying in the cloud; the choice recorded in `decisions.md` | Vercel Hobby is non-commercial; decision #13 says to move before official use | Vercel Hobby + Supabase Free (decision #13) | Production | Sponsor (decides), Developer (owner) (implements) | 9.3 |
| PRD-02 | Hosting | A database plan that does not pause | Supabase Free pauses after 7 idle days; restoring takes a few minutes and users see errors meanwhile | Supabase Free | Production | Sponsor | 9.3 |
| PRD-03 | Hosting | Database region confirmed and the server functions placed near it | Latency (suspected cause of slow navigation, [02](02-wbs.md) §4); the data owner may ask where the data lives | The deployment notes record Tokyo (`ap-northeast-1`) but their set-up steps say Singapore; not confirmed in the Supabase dashboard; function region not measured | Production | Developer (owner) | 8.1 |
| PRD-04 | Backup and recovery | A first backup of the cloud database is taken before real data is loaded, and one restore into a separate project has been tried and written down | The deployment notes say not to load real personal data until backups exist; a backup that was never restored is not known to work | No backup procedure in the repository; never done | Pilot | Developer (owner) | 9.1 |
| PRD-05 | Backup and recovery | Automatic backups: a Supabase plan with backups, or a scheduled `pg_dump` stored outside Supabase | Without regular backups, one mistake or incident loses the changes since the last manual backup | No automatic backups (Supabase Free, decision #13) | Production | Developer (owner) | 9.4 |
| PRD-06 | Backup and recovery | Recovery targets agreed: *proposed* RPO 24 hours (at most one day of changes lost) and RTO 1 working day | Sets the backup frequency and how fast service must return | None defined | Production | Sponsor | 9.4 |
| PRD-07 | Security | Secrets only in Vercel environment variables (Production), never in the repository or chat; set and confirmed on the Settings page ("Cấu hình" block, [runbook](../deploy/cron-email.md) §2) | Leaked keys bypass RLS (service role) or allow sending mail | `.env` and `.env.*` are git-ignored except `.env.example`; the runbook lists the five production variables (`RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`); whether they are set on Vercel is not recorded | Pilot | Developer (owner) | 9.1 |
| PRD-08 | Security | `CRON_SECRET` is random and at least 16 characters | The cron routes fail closed (HTTP 500) when it is missing or shorter (decision #39) | Code check exists; the production value is not recorded | Pilot | Developer (owner) | 9.1 |
| PRD-09 | Security | Self sign-up confirmed disabled in the cloud project, and kept so unless `R-31` is approved | Only internal staff may have accounts (decision #12; decision #42 defers sign-up) | `enable_signup = false` in `supabase/config.toml` (local); for the cloud the deployment notes (B3) say to switch sign-up off in the dashboard, which is not re-checked here | Pilot | Developer (owner) | 9.1 |
| PRD-10 | Security | Pilot accounts: the procedure is ready before the pilot and the admin creates the accounts in pilot week 0 — members imported first, then one login per person created in the Supabase dashboard (a new login is linked to the member with the same e-mail), Manager roles set, managers assigned to their team | There is no self sign-up and no account screen in the application | Only the first admin's set-up is documented (deployment notes, B4); the e-mail link is made by `handle_new_user` (`supabase/migrations/20260928000001_org_and_members.sql`) | Pilot | Admin | 9.1 |
| PRD-11 | Security | RLS tests run in CI and must pass before merging; branch protection on `main` requires CI | RLS is the main protection (decision #5) | CI runs lint, type check, unit tests, pgTAP (10 files on this branch, 2 of them from week 6) and a build on every pull request and on pushes to `main` and `dev` (`.github/workflows/ci.yml`); whether GitHub branch protection makes CI mandatory is not visible in the repository | Production | Developer (owner) | 9.4 |
| PRD-12 | Security | A written procedure to rotate the service-role key (rotate in Supabase, update Vercel, redeploy), used once before production and whenever someone with access leaves | The key bypasses RLS (decision #35) | No procedure in the repository | Production | Developer (owner) | 9.4 |
| PRD-13 | Security | Dependencies updated on a fixed routine (*proposed*: monthly), including a decision on the deprecated `@react-email/components` | Known vulnerabilities; decision #43 kept the deprecated package for now | No automated update configuration in the repository (no `.github/dependabot.yml`); `@react-email/components` still in `package.json` (decision #43); SheetJS installed from its CDN at 0.20.3 (decision #27) | Production | Developer (owner) | 9.4 |
| PRD-14 | Security | Least privilege: a reviewed list of Admin accounts and of who can open the Supabase, Vercel and Resend dashboards; *proposed*: two-factor sign-in on those dashboards | Admins and dashboard users can read and change everything | Admin role is set by SQL (deployment notes, B4); no list of admins or dashboard users is kept in the repository | Production | Sponsor (approves), Admin | 9.4 |
| PRD-15 | Data protection | The data owner approves in writing storing the personal data in a cloud service: names, work e-mails, team, certificates with dates, and evidence files (which may show more personal details) | `A-05` is recorded as a project decision (decision #1) but must be confirmed with the data owner ([01 §7](01-requirements-and-ca.md)); the pilot loads real personal data | Not confirmed | Pilot | Data owner | 9.1 |
| PRD-16 | Data protection | A retention rule for people who leave: how long their records and evidence are kept and who deletes them | Personal data should not be kept without a reason | `members.is_active = false` excludes a person from counts and e-mails (decisions #31, #34) but keeps all their data; a member with records cannot be deleted until the records are deleted (`src/features/members/actions.ts`); logins are removed only in the Supabase dashboard; no retention rule exists | Production | Data owner (rule), Admin (applies it) | 9.4 |
| PRD-17 | Data protection | Evidence stays reachable only through short-lived signed links after a permission check, and the data owner accepts that a link works for 60 seconds if forwarded | Evidence files are the most sensitive data | **Already in place:** private bucket with per-role policies; the download route reads the record under the user's RLS and redirects to a link valid for 60 seconds (`src/app/api/records/[id]/evidence/route.ts`; [05](05-poc-and-mvp.md) P-04). The data owner's acceptance is not recorded | Production | Developer (owner) | — |
| PRD-18 | E-mail operations | Sending domain verified on Resend (SPF, DKIM; DMARC recommended) and `EMAIL_FROM` on that domain | An unverified sender only delivers to the Resend account owner (decision #40); missing records send mail to spam | No evidence of verification in the repository; who controls the DNS is not recorded | Pilot | Developer (owner), with the DNS holder (to be assigned by the sponsor) | 9.1 |
| PRD-19 | E-mail operations | Someone is assigned to read the result of every scheduled run: the Vercel cron dashboard and the Settings e-mail history after each Monday and each 1st of the month | A failed or truncated run turns red on Vercel (HTTP 500) but nobody is notified otherwise (decisions #39, #44) | Week 6 is not deployed; nobody is assigned | Pilot | Admin | 9.1 |
| PRD-20 | E-mail operations | The runbook steps for `truncated`, `inFlight` and failures are known and have been rehearsed once (during the pilot) | `truncated` (HTTP 500) → call again until it is false; `inFlight` (HTTP 200) → wait about 15 minutes and call again; `failed` → read `failures[]`, fix, call again (decisions #39, #44; [runbook](../deploy/cron-email.md) §5–§6) | Documented in the runbook (Vietnamese); never exercised against Resend | Production | Developer (owner), Admin | 9.2 |
| PRD-21 | E-mail operations | Capacity matches the number of recipients: recipient count known; a second call or a paid Resend plan planned if needed | One run handles about 40–80 recipients (runbook estimate: 50-second budget, at least 600 ms between e-mails); Resend free allows 100 e-mails per day and 3,000 per month ([runbook](../deploy/cron-email.md) §1, §5) | Real recipient numbers unknown (`A-09`) | Production | Developer (owner) | 9.4 |
| PRD-22 | Monitoring and errors | An error-tracking service for server and browser errors (*proposed*: one with a free tier) | Errors are otherwise invisible unless a user reports them | None: no error-tracking package in `package.json` and no such integration in `src/` | Production | Developer (owner) | 9.4 |
| PRD-23 | Monitoring and errors | An uptime check on the public URL that alerts by e-mail (*proposed*) | A paused database or a broken deployment is otherwise noticed by users first | None | Production | Developer (owner) | 9.4 |
| PRD-24 | Monitoring and errors | Logs kept long enough to investigate an incident; retention decided together with PRD-01 | Vercel function logs are kept only briefly on Hobby (see Vercel's current plan limits); each cron run writes one JSON line of counts (decision #44); the Settings history is the durable e-mail record | Vercel Hobby logs only | Production | Developer (owner) | 9.4 |
| PRD-25 | Release process | The release flow and the checklist in §3 are adopted; every production release records the local end-to-end result | Today's flow works but is not written down in one place | Branch → pull request → CI (lint, type check, unit, pgTAP, build) → `dev` → release PR to `main` → Vercel production (deployment notes, C2). End-to-end tests run only locally (`playwright.config.ts`; not in `ci.yml`) | Production | Developer (owner) | 9.4 |
| PRD-26 | Release process | Migrations are pushed to the cloud **before** the code that needs them, and checked afterwards (first for the week-6 migrations; afterwards a step in §3) | New pages fail if the view or function they need is missing ([runbook](../deploy/cron-email.md) §3: database first, code second) | Pushed manually with `pnpm supabase db push`; the cloud schema can lag behind `main` | Pilot | Developer (owner) | 9.1 |
| PRD-27 | Release process | A rollback procedure, written and rehearsed once: redeploy the previous Vercel production build; repair the database with a new forward migration | Bad releases happen; the repository has only forward migrations (no down migrations in `supabase/migrations/`) | Not written down, not rehearsed | Production | Developer (owner) | 9.4 |
| PRD-28 | Performance | `SM-4` met: feedback at once and a 75th-percentile page load under 1 second (*proposed* target), measured with the signed-in method defined in WBS 8.1 | Slow navigation hurts adoption (manager feedback of 2026-10-05) | Signed-in pages not measured; one loading state on `dev` and none on `main` ([02](02-wbs.md) §4) | Production | Developer (owner) | 8.1 |
| PRD-29 | Accessibility | Keyboard and screen-reader audit done and blocking issues fixed | `NFR-05` is `Partial` | Contrast is tested automatically (`src/app/tokens.test.ts`); no audit | Production | Developer (owner) | 8.4 |
| PRD-30 | Support and ownership | Named roles for answering users and for incidents, with working hours | Without an owner, problems wait | Nobody assigned | Production | To be assigned by the sponsor | 9.4 |
| PRD-31 | Support and ownership | One channel for users to report problems | Problems must reach someone who can act | None defined; the pilot uses a pilot log ([05 §6](05-poc-and-mvp.md)) | Production | To be assigned by the sponsor | 9.4 |
| PRD-32 | Support and ownership | A short admin guide: create accounts and roles, assign managers, import, data quality, read the e-mail history | Today only the developer knows the account steps; there is no account screen in the application | The deployment notes and the runbook exist (in Vietnamese, written for the developer); no admin guide | Production | Developer (owner) | 9.4 |

## 3. Release checklist (proposed)

For one production release, in this order. Commands are the repository's own (`package.json` and the runbooks).

1. The feature pull requests in this release were merged into `dev` with CI green (lint, type check, unit tests, pgTAP, build).
2. On the release commit, locally: `pnpm lint`, `pnpm typecheck`, `pnpm test`; `pnpm supabase start` then `pnpm test:db`; `pnpm test:e2e` with `EMAIL_TRANSPORT=console` (the e-mail end-to-end spec refuses to run otherwise). Record the results in the release pull request.
3. Open the release pull request `dev` → `main`. List the migrations it contains and any new or changed environment variables.
4. Take a backup of the cloud database (PRD-04, PRD-05) and note where it is stored.
5. If the release contains migrations, push them **before** merging: `pnpm supabase migration list`, `pnpm supabase db push --dry-run`, `pnpm supabase db push`, then `pnpm supabase migration list` again (Local and Remote must match). Never run `supabase db reset --linked` or `supabase config push` ([runbook](../deploy/cron-email.md) §3; [deployment notes](../deploy/task9-free-tier.md), B2).
6. Set or change environment variables in Vercel (Production only); a change needs a redeploy to take effect ([runbook](../deploy/cron-email.md) §2).
7. Merge the release pull request. Vercel builds `main` as production (deployment notes, C2).
8. Smoke test on the public URL following the deployment notes (section E), then sign in once as each role. Section E expects the text "Vai trò: admin" on the Dashboard; that text no longer exists — the role is now shown as a badge in the user menu (`src/components/app-shell/user-menu.tsx`), so this step checks the role badge instead.
9. As Admin, open Settings: the configuration block shows every item as configured.
10. Call both cron routes with `?dryRun=1` ([runbook](../deploy/cron-email.md) §5): `transport` is `resend`, the recipients are as expected and `undeliverable` is empty. Never call a cron route without `dryRun` unless a real send is intended.
11. Record the release (date, commit, migrations, test results) in the release pull request, and check the next scheduled run in the Settings history (PRD-19).
12. If the release is broken: redeploy the previous production build in Vercel; if the database is involved, fix it with a new forward migration (PRD-27).

## 4. Responsibilities (RACI-light)

*Proposed — to be confirmed by the sponsor.* R = does the work, A = answers for the result, C = asked before.

| Activity | Responsible | Accountable | Consulted |
|---|---|---|---|
| Releases (checklist in §3) | Developer (owner) | Developer (owner) | Admin |
| Database migrations | Developer (owner) | Developer (owner) | — |
| Backups and the restore test | Developer (owner) | Sponsor | Data owner |
| E-mail operations (reading each run, re-running, fixing failures) | Admin | Developer (owner) | Team managers |
| User accounts, roles and team managers | Admin | Sponsor | Team managers |
| Incident response | Developer (owner) | Sponsor | Admin |
| Data-protection questions (storage, retention, deletion) | Data owner | Sponsor | Developer (owner), Admin |
| Gate G1 and the production go decision | Sponsor | Sponsor | Developer (owner), Admin, Data owner, Team managers |

## 5. Go/no-go for production

*Proposed — to be confirmed by the sponsor.* Production starts only when all of these are true:

1. Every item in §2 is done: the `Pilot` items (WBS 9.1) and the `Production` items (mostly WBS 9.4).
2. The MVP acceptance criteria in [05 §5](05-poc-and-mvp.md) are met.
3. Gate G1 is passed ([00 §3](00-process-status.md)). This is a **new proposal** of this document: G1 as defined in 00 §3 and decision #46 gates Phase 2 (AI), not production. Requiring it before production as well is for the sponsor to accept or reject.
4. The sponsor's written go decision is recorded in [decisions.md](../decisions.md).

As of 2026-10-07 none of the four is true.
