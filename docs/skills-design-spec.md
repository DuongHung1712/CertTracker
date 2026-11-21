# My Skills (`/skills`) — UI spec

**Status:** UI mock (Later module, decision #59). Data lives in memory (`src/features/skills/seed-data.ts`), lost on reload. Updated 2026-11-20 (decision #70).

## 1. Job of the page

Answer one question for a member: *"Which skills do I have, at what level, and what backs each rating?"* A manager or admin reading the same profile asks *"Can I trust this rating?"*: a certificate, a pending level-5 review, or a self-rating with a note.

There are **no per-skill role targets** (removed 2026-11-20, owner: too hard to maintain). The page does not show gaps, "below target" or a role benchmark score.

## 2. Layout (top to bottom)

1. **Page header**: "My skills" — "Rate each skill from 0 to 5 and back it up with certificates."
2. **Role card**: role name · team, one line "The skills below are the ones this role uses." + role description. Actions: `Level guide` (outline), `Rate many skills` (primary).
3. **Four KPI tiles** (`KpiTile`): Average level (0–5 scale) · Level 4 or higher (of N) · Certified (of N, %) · Waiting for review (level 5 needs your manager).
4. **Category tabs** (line tabs, wrap onto a second row, never scroll hidden): All skills + only categories that have skills, each with a count.
5. **Filter bar** (`FilterBar` + `OptionSelect`): search (name, code, description, certificate) · Status (All / Certified / Waiting for review / Self-rated) · Sort (Highest level first [default] / Lowest level first / Name A–Z / Recently rated) · Clear filters · Card/Table view toggle.
6. **Skills**: cards (1/2/3 columns) or table. Empty state with "Clear all filters".

The page lists the role's skills only (16 in the seed). The full catalogue (182 skills, §5) is reachable from **Rate many skills**.

## 3. Components (`src/features/skills/components/`)

| Component | Shows | Notes |
|---|---|---|
| `SkillCard` | Name (opens details), status, 2-line description, "Level N · Title", 0–5 rater + `?` legend, proof line (certificate name or evidence note), category · years, `Edit` | `data-slot="vault-card"`, `data-verified` when certified |
| `SkillTable` | Skill + category, Your level (rater), Status, Proof, Edit | shadcn `Table` |
| `SkillQuickRate` | 0–5 radio group, roving focus, arrows/Home/End/digits, tooltip with the official legend | No target marker |
| `SkillStatus` | Certified / Waiting for review / Self-rated | Reuses `data-status-tone` + `vault-live-dot` like `ExpiryBadge` |
| `SkillLegendPopover` | Short 0–5 legend next to any rater | |
| `SkillLevelGuide` | Full 0–5 scale dialog with criteria | |
| `SkillDetailDialog` | Your level, experience + last rated, status + category, what the level means, proof (certificate or "no certificate yet"), your note, recommended courses | Footer: Close, Edit rating |
| `SkillAssessmentDialog` | Pick level (6 choices), years, "What have you done with it?" note (max 1000) | Level 5 → "Send for review" |
| `SkillBatchAssessDialog` | Whole catalogue by category, search, "Set all to 1 / 0", rater per row, status, "N of M rated", Save ratings | Changes stay local until Save |

Rules shared by all writers: `rateSkill()` in `metrics.ts` — level 5 → `pending_review`; a linked certificate keeps `certified`; otherwise `self_assessed`; date from `todayVn()`.

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

- 65 hand-written skills (`SEED_SKILLS` + `ADDITIONAL_ENTERPRISE_SKILLS`).
- 117 skills from the **DC34 Dev Skill Matrix** workbook (`dc34-matrix.ts`, sheets Programming Language, Backend, Web Frontend): skill name, group and category only. No member names or personal ratings are stored.
- Duplicates: same name ignoring case and spaces keeps the first entry; 50 near-duplicates are merged into the more specific existing skill via `DC34_SAME_AS` (e.g. FastAPI → "Python (FastAPI & AsyncIO)"). Broad groups (Python, Java, Security, Microservices…) stay separate.

## 6. Evidence

My Skills has **no file upload**. A rating is backed by:
- a **certificate** recorded in My learning (`/me`, Certificates tab: issue date, PDF or link, approval). Today the mock fakes the link (`certifiedProof`); the real link is `skill_certificate_links` (certificate → skill, `proves_level`);
- or a free-text **note** ("What have you done with it?") in the Edit dialog.

## 7. Not built yet / open

- Real data: queries/actions for `skills`, `member_skills`, `skill_certificate_links` (migration `20261119000001`, not pushed) — still has `skills.benchmark_level`, which the UI no longer uses.
- Manager view of a member's skills and the approve/return flow for level 5.
- Showing catalogue skills the member rated outside the role (owner chose to keep the page to role skills, 2026-11-20).
