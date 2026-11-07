# Pilot checklist (DAS, Phase 1)

Source: `docs/superpowers/specs/2026-11-06-cert-core-das-pilot-design.md` §7.5 and §8. The owner runs this on production **before inviting DAS**. Fill the Result and Date columns as you go; leave nothing ticked that you did not do. A check that fails is written down with what happened, not skipped.

Steps for each runbook: accounts and invitations in `accounts-and-catalogue.md`, backup and restore in `backup-and-restore.md`, the cron runs in `cron-email.md` (section 5, in Vietnamese).

## Real-world checks (spec §7.5)

| ID | Check | Pass | Result | Date |
|---|---|---|---|---|
| P-1 | Invite your own second address (Gmail) and a company mailbox | Arrives within minutes, not in spam; link works | | |
| P-2 | Open a link in the company mailbox after its scanner has had time | Link still works | | |
| P-3 | Link after 2 hours | Works (§8 sets 24 hours) | | |
| P-4 | Used link, and an expired one | Clear message; a new invitation or recovery link works | | |
| P-5 | Upload a proof and open it as the manager | Opens; a signed-out browser cannot use the URL once it has expired | | |
| P-6 | Run the expiry and monthly crons by hand with `dryRun` per the runbook, then one real run to yourself | Numbers right; `/settings` history correct | | |
| P-7 | Sign in on a phone and on the office network | Works, no blocked resources | | |
| P-8 | Restore the backup into a separate project | Row counts match and a restored proof file opens | | |

## Production set-up (spec §8, owner)

- [ ] 1. Stay on the free tiers for the proof of concept; decide on paid hosting afterwards (Vercel Hobby is non-commercial and Supabase Free has no automatic backup, so item 9 is manual)
- [ ] 2. Verify the sending domain on Resend; set `EMAIL_FROM`, `RESEND_API_KEY` (unverified senders only reach the account owner)
- [ ] 3. Custom SMTP in Supabase Auth, using that domain (the built-in sender cannot reach staff)
- [ ] 4. Email templates and Site URL in the Dashboard (the link must point to `/set-password`)
- [ ] 5. **Email OTP expiry to 24 hours** (default 1 hour), because people do not always open mail within the hour
- [ ] 6. Check the Auth e-mail rate limit allows 20 invitations in one sitting (otherwise invitations fail part way)
- [ ] 7. `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL` on Vercel (crons fail closed without them; confirm on `/settings`)
- [ ] 8. Sign-up disabled in the cloud project (`PRD-09`), so only staff may have accounts
- [ ] 9. Manual backup, including proof files, before inviting and every Friday; one tested restore (`PRD-04`), see `backup-and-restore.md`
- [ ] 10. Data owner's written agreement (`PRD-15`): names, e-mails and proof files go to a cloud service
- [ ] 11. Delete leftover test types `AWS`, `TOEIC`, `IELTS` and provider `IIG` (they clutter DAS's course form)
- [ ] 12. Check JWT signing key type (HS256 costs one extra Auth call per page), then count Auth calls as in `accounts-and-catalogue.md`
- [ ] 13. Password rules in the Dashboard no stricter than the form: minimum 8 characters, no character classes (a stricter rule makes "Set password" fail)
- [ ] 14. Do not turn off the Email provider (only the sign-up switch); invitations and sign-in need it
- [ ] 15. Keep "Confirm email" and "Secure email change" ON (*to confirm* the production values and Dashboard names); otherwise an unlinked login could take over a colleague by changing its own address. Add or import members **before** inviting them

Also, once CI has run: require `check` and `e2e` on `dev` and `main` ("Required checks" in `accounts-and-catalogue.md`).

## Release order (spec §8)

Backup, then `supabase db push` the §5.1 migration (`supabase/migrations/20261106000001_link_account_to_member.sql`; check `supabase migration list` for anything else not yet on production), then merge `dev` to `main`, then the checks above, then import and invite. The trigger is additive, so the running version keeps working during the gap.
