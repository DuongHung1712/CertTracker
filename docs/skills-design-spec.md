# My Skills (`/skills`) — UI spec

**Status:** Persisted in Postgres (updated 2026-11-26, decision #76; supersedes mock status from #59). See `docs/superpowers/specs/2026-11-26-my-skills-persistence-design.md` for full DB, RLS, certificate proof derivation, and Level 5 review design. Updated 2026-11-20 (decision #70).

## 1. Job of the page

Answer one question for a member: *"Which skills do I have, at what level, and what backs each rating?"* A manager or admin reading the same profile asks *"Can I trust this rating?"*: a certificate, a pending level-5 review, or a self-rating with a note.

There are **no per-skill role targets** (removed 2026-11-20, owner: too hard to maintain). The page does not show gaps, "below target" or a role benchmark score.

## 2. Layout (top to bottom)

1. **Page header**: "My skills" — "Rate each skill from 0 to 5 and back it up with certificates."
2. **Role card**: role name · team, one line "The skills below are the ones this role uses." + role description. Actions: `Level guide` (outline), `Update skill rate` (primary).
3. **Four KPI tiles** (`KpiTile`): Average level (0–5 scale) · Level 4 or higher (of N) · Certified (of N, %) · Waiting for review (level 5 needs your manager).
4. **Category tabs** (line tabs, wrap onto a second row, never scroll hidden): All skills + only categories that have skills, each with a count.
5. **Filter bar** (`FilterBar` + `OptionSelect`): search (name, code, description, certificate) · Status (All / Certified / Waiting for review / Returned / Self-rated) · Sort (Highest level first [default] / Lowest level first / Name A–Z / Recently rated) · Clear filters · Card/Table view toggle.
6. **Skills**: cards (1/2/3 columns) or table. Empty state with "Clear all filters"; a member with no saved rating sees "No skills rated yet" with an **Update skill rate** button instead.

The page lists the skills the member has saved (`member_skills` rows). The full catalogue (182 skills, §5) is reachable from **Update skill rate**. A Manager (in scope) or Admin opens another member's page with `/skills?memberId=<id>` (from `/members` → "View skills", or the "Waiting for your review" list on their own page), read-only except Approve / Return on Level 5 requests.

## 3. Components (`src/features/skills/components/`)

| Component | Shows | Notes |
|---|---|---|
| `SkillCard` | Name (opens details), status, 2-line description, "Level N · Title", 0–5 rater + `?` legend, proof line (certificate name or evidence note), category · years, `Edit` | `data-slot="vault-card"`, `data-verified` when certified |
| `SkillTable` | Skill + category, Your level (rater), Status, Proof, Edit | shadcn `Table` |
| `SkillQuickRate` | 0–5 radio group, roving focus, arrows/Home/End/digits, tooltip with the official legend | No target marker |
| `SkillStatus` | Certified / Waiting for review / Returned / Self-rated | Reuses `data-status-tone` + `vault-live-dot` like `ExpiryBadge` |
| `SkillLegendPopover` | Short 0–5 legend next to any rater | |
| `SkillLevelGuide` | Full 0–5 scale dialog with criteria | |
| `SkillDetailDialog` | Your level, experience + last rated, status + category, what the level means, proof (certificate or "no certificate yet"), your note, recommended courses | Footer: Close, Edit rating |
| `SkillAssessmentDialog` | Pick level (6 choices), years, "What have you done with it?" note (max 1000) | Level 5 → "Send for review" |
| `SkillBatchAssessDialog` | Whole catalogue by category, search, "Set all to 1 / 0", rater per row, status, "N of M rated", Save ratings | Changes stay local until Save; Save sends only the rows whose level changed |
| `SkillReviewDialog` | Return a Level 5 request with a required note ("What should the member fix?") | Manager/Admin only; Approve is one click |

Status rules (the DB trigger `member_skills_review_columns()` is the authority; `rateSkill()` in `metrics.ts` mirrors it for optimistic UI): level 5 → `pending_review` until a manager in scope or an admin approves (`certified`) or returns it (`returned`, level set to 4, note required); levels 1–4 show `certified` only while an approved, current certificate linked through `skill_certificate_links` exists, never from a stored flag; otherwise `self_assessed`. Saving a returned skill resubmits it and clears the note. Date from `todayVn()`.

## 4. Levels

| Level | Title | Who sets it |
|---|---|---|
| 0 | None | Member |
| 1 | Novice | Member |
| 2 | Intermediate | Member |
| 3 | Advanced | Member |
| 4 | Expert | Member |
| 5 | Master | Member requests, manager approves |

Wording comes from the DC34 matrix "General" sheet (`LEVEL_SCALE_GUIDE.officialLegend`).

## 5. Catalogue seed

The catalogue lives in the DB, seeded by migration `20261126000001` (9 domains, 182 skills, codes `SKL-*` and `DC34-NNN`). It was generated once from the former mock files (deleted 2026-11-26; unit tests use `src/features/skills/__fixtures__/skills.ts`):

- 65 hand-written skills (`SKL-*` codes).
- 117 skills from the **DC34 Dev Skill Matrix** workbook (`DC34-NNN` codes, sheets Programming Language, Backend, Web Frontend): skill name, group and category only. No member names or personal ratings are stored.
- Duplicates: same name ignoring case and spaces keeps the first entry; 50 near-duplicates are merged into the more specific existing skill (e.g. FastAPI → "Python (FastAPI & AsyncIO)"). Broad groups (Python, Java, Security, Microservices…) stay separate.

## 6. Evidence

My Skills has **no file upload**. A rating is backed by:
- a **certificate** recorded in My learning (`/me`, Certificates tab: issue date, PDF or link, approval). `certifiedProof` is derived live from `v_training_records` (done, approved, not renewed, expiry Active / Expiring / No Expiry) joined through `skill_certificate_links` (certificate → skill, `proves_level`); the highest `proves_level`, then latest issue date, wins;
- or a free-text **note** ("What have you done with it?") in the Edit dialog.

## 7. Implementation status

- Persisted via `supabase/migrations/20261126000001_my_skills_persistence.sql` `20261126000002_my_skills_review_guards.sql` and `20261126000003_my_skills_level5_reviewed.sql` (`skill_domains`, `skills`, `member_skills`, `skill_certificate_links`), server queries/actions in `src/features/skills/`, live Member Dashboard `SkillsMatrixCard`, `/members` `"View skills"` integration, and Manager/Admin Level 5 approve/return flow.
- `skills.benchmark_level` remains in the DB schema with default `3` for backward compatibility and is never read or rendered in the UI (decision #70).
- Admin UI for editing `skill_certificate_links` or adding custom skills in `/courses` remains a separate follow-up.
