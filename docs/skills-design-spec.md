# 'My Skills' (/skills) UI/UX Design Specification & Component Architecture

**Status:** Approved Specification  
**Design System Reference:** `docs/design-system.md` (Decisions #14, #68)  
**Anti-Slop Standard:** `references/app-screens.md` (Design-Taste-Frontend v2)  
**Target Capability:** WBS 11.1–11.3, BRD §4.1 (Skill Matrix & Competency Profiling)

---

## 1. Executive Summary & Design Vision

The **My Skills** page (`/skills`) provides CertTracker members with an enterprise-grade, high-density matrix of their technical and professional competencies. It pairs self-assessment with **cryptographic-level certificate verification** and **target role benchmark gap analysis**, answering the core question:
> *"Where do my demonstrated capabilities stand relative to my team's standards, which skills are verified by active certificates, and where are my growth gaps?"*

### Core Tenets:
1. **Dense Enterprise Utility:** 32px table rows, 13px body text (`text-table`), tabular numbers (`tabular-nums`), 4px grid spacing. White space is functional for grouping, not decorative.
2. **Strict Anti-Slop (Zero Gradients):** No linear/radial/conic gradients, no pastel mesh backgrounds, no AI-generated badges, no cards with centered icons in tinted pastel circles, no sparklines.
3. **Truth in Certification:** A skill is **Certified** only when backed by an active, approved, non-expired, non-renewed `training_record`. Otherwise, it is honestly labelled **Self-assessed**.
4. **Token Purity:** Uses semantic design tokens (`primary`, `card`, `border`, `muted`, `foreground`). **Status expiry colors (`--status-*`) are never leaked into skill levels or ratings**, strictly honoring Design System §2.2 & §8.
5. **Dual Visual Style Fidelity:** Seamlessly renders in **Classic Swiss** (clean flat paper-white ground `#F6F7F5`, deep teal accent `#0E5C58`) and **Credential Vault** (`data-style="vault"`, precision borders `#CAD6D3`/`#1E3837`, mono stamps `data-stamp`, verified hooks `data-verified="true"`).

---

## 2. Information Architecture & Layout Structure

The layout is arranged into five logical sections:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ PageHeader: My skills                                                                 │
│ Description: See your skill levels next to your team's standards and active certificates│
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Scope & Benchmark Strip:                                                               │
│ [Standard Target Role: Senior Software Engineer · Team Cloud]    [Scale Guide] [Reset] │
│ "Autonomous engineering lead responsible for cloud architecture..."                    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Dense KPI Summary (dl grid - type, not tiles; no colored icon circles):                │
│ ┌──────────────────┬──────────────────┬──────────────────┬───────────────────────────┐ │
│ │ SKILL INDEX      │ CERTIFIED SKILLS │ ROLE MATCH       │ GROWTH GAPS               │ │
│ │ 3.4 / 5.0        │ 8 / 15 (53%)     │ 12 / 15 (80%)    │ 3 skills below target     │ │
│ └──────────────────┴──────────────────┴──────────────────┴───────────────────────────┘ │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ FilterBar (32px controls):                                                             │
│ [Search skill, code, certificate...] [Category ▾] [Status ▾] [Sort ▾]   [Clear filters]│
│ Tabs: [All (15)] [Cloud (3)] [Backend (3)] [DevOps (2)] [Security (2)] [Data/AI (3)]... │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Skills Matrix / Enterprise Table (32px rows, 13px text, tabular-nums):                │
│ Code     │ Skill Name        │ Current Level   │ Role Target │ Verification │ Actions  │
│ SKL-CLD-1│ AWS Architecture  │ ■■■■□ L4 Expert │ L4 (Met)    │ [CERTIFIED]  │ [Edit]   │
│ SKL-OPS-1│ Kubernetes / CKA  │ ■■■□□ L3 Adv.   │ L3 (Met)    │ [CERTIFIED]  │ [Edit]   │
│ SKL-SEC-1│ Threat Modeling   │ ■■□□□ L2 Inter. │ L3 (-1 Gap) │ [SELF]       │ [Edit]   │
│ SKL-DAT-2│ Vector DB / RAG   │ ■□□□□ L1 Novice │ L3 (-2 Gap) │ [SELF]       │ [Edit]   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Component Architecture

### 3.1 `SkillsPage` (`src/app/(app)/skills/page.tsx`)
- **Type:** Next.js Server Component with client wrapper.
- **Access Control:** Requires signed-in member (`user.memberId`). Non-member accounts (unlinked Admin/Manager) are redirected to `/dashboard`.
- **Data Flow:** Loads member profile, career role, linked active certificates from `training_records`, and member skills.

### 3.2 `SkillsHeader` & Benchmark Card (`src/features/skills/components/skills-header.tsx`)
- **Benchmark Card:**
  - Displays standard role (`benchmark.roleName`), team (`benchmark.teamName`), and concise role scope description.
  - Action buttons:
    - `<Button variant="outline" size="sm" onClick={onOpenGuide}>`: Opens `SkillLevelGuide`.
    - `<Button variant="ghost" size="sm" onClick={onResetSeed}>`: Reset demo seed state.
- **KPI Summary Grid (`dl > div`):**
  - **Skill Index:** Average level `3.4 / 5.0` (Target: 3.3). Semantic label, no colored icon circles.
  - **Certified Skills:** `8 / 15` (53% verified by exams/certificates). In Vault mode: includes `vault-live-dot`.
  - **Role Match:** `12 / 15` (80% on track for target career role).
  - **Growth Gaps:** `3` skills below target. Clickable filter action to view deficient skills.

### 3.3 `SkillsFilterBar` (`src/features/skills/components/skills-filter-bar.tsx`)
- Built using CertTracker standard 32px height controls (`Input h-8`, `Select h-8`).
- Category strip: Horizontal scrollable tab pills (`All`, `Cloud & Infrastructure`, `Backend & Systems`, `Frontend & Web`, `DevOps & SRE`, `Security & Compliance`, `Data & AI`, `Leadership`).
- Search input: 32px with `Search` icon (`pl-8`), filtering by name, code (`SKL-*`), or certificate issuer.
- Status dropdown: `All`, `Certified only`, `Self-assessed only`, `Gaps only`.
- Sort dropdown: `Proficiency: High to Low`, `Proficiency: Low to High`, `Largest Gap First`, `Name (A-Z)`.
- Accessible "Clear filters" button that restores focus to the search input.

### 3.4 `SkillLevelBadge` (`src/features/skills/components/skill-level-badge.tsx`)
- **Segmented Bar:** 5 segments (representing levels 1 to 5).
  - Unfilled: `bg-muted border border-border/60`.
  - Filled (L1–L3): `bg-foreground/75`.
  - Filled (L4–L5): `bg-primary`.
  - Target marker: `▲` caret indicator below the target level.
- **Badge Tag:**
  - L0: `L0 · None` (`bg-muted/60 text-muted-foreground border border-border/50`).
  - L1–L2: `L1/L2` (`bg-muted text-foreground border border-border`).
  - L3–L4: `L3/L4` (`bg-primary/10 text-primary border border-primary/20`).
  - L5: `L5 · DC Master` (`bg-primary text-primary-foreground font-bold`).
- **Gap Status Text:**
  - Met or Exceeded: `Meets standard` or `+N above standard` (`text-primary font-medium`).
  - Below Target: `-N below target` (`text-muted-foreground font-medium`).
  - *Strict Rule:* No `--status-*` expiry color classes.

### 3.5 `SkillsTable` / Matrix View (`src/features/skills/components/skills-table.tsx`)
- Uses TanStack Table or compact HTML table matching CertTracker's `DataTable` rules:
  - 32px row height, cell padding `4px 10px`.
  - Column 1: **Code & Skill** — Geist Mono code (`SKL-CLD-01`), 13px font-medium name, truncate with tooltip.
  - Column 2: **Category** — Neutral label badge (`rounded-sm px-1.5 py-0.5 text-xs`).
  - Column 3: **Current Level** — Compact `SkillLevelBadge` (segments + level tag).
  - Column 4: **Target & Gap** — Benchmark level (`L4`) + delta (`Met` or `-1 Gap`).
  - Column 5: **Verification Status & Proof**:
    - If `certified`: Stamp badge with `ShieldCheck` icon, certificate name, and popover/tooltip showing verification date & issuer. Vault hook: `data-verified="true"`.
    - If `self_assessed`: Outline neutral badge `Self-assessed` with `UserCheck` icon.
    - If `pending_review`: Secondary badge `Pending Review` with `Hourglass` icon.
  - Column 6: **Years of Exp & Last Evaluated** — `5 yrs`, `15/10/2026` (`tabular-nums font-mono text-xs text-muted-foreground`).
  - Column 7: **Action** — `size="icon-xs"` edit button opening `SkillAssessmentSheet`.

### 3.6 `SkillAssessmentSheet` (`src/features/skills/components/skill-assessment-sheet.tsx`)
- Right-hand slide-over sheet (`FormSheet` pattern, max-w-md):
  - Skill header (Code, Name, Category).
  - Current vs. Target benchmark comparison.
  - Interactive Proficiency Selector (0 to 4 radio / segmented buttons with full level definitions).
  - Level 5 Governance Notice:
    - Level 5 button is clearly designated as "DC Master (Requires Manager Endorsement)".
    - Enabling Level 5 triggers a "Request Manager Endorsement" checkbox and disables self-authoring without approval.
  - Production Experience / Evidence Textarea:
    - Captures production PR links, system architecture contributions, or incident resolution examples.
  - Linked Certificate section:
    - Shows matching active certificate if available, with "Verified by Certificate" badge.
    - If gap exists, lists 1–2 recommended catalogue courses with duration and refundable badge.
  - Save button ("Saving..." during submission) and Cancel.

### 3.7 `SkillLevelGuide` Dialog (`src/features/skills/components/skill-level-guide.tsx`)
- Clean modal detailing L0 through L5:
  - L0: None (No production exposure).
  - L1: Novice (Basic fundamentals, needs guidance).
  - L2: Intermediate (Autonomous delivery of standard tasks).
  - L3: Advanced (Independent problem solver, module architecture).
  - L4: Expert (System-wide authority, cross-team mentor).
  - L5: DC Master (DC-wide authority; requires DC Manager formal endorsement).

---

## 4. Proficiency Scale & Governance Rules

| Level | Label | Self-Assessable? | Verified By Cert? | Manager Approval? | Description |
|---|---|---|---|---|---|
| **0** | None | Yes | N/A | No | No prior exposure or production usage. |
| **1** | Novice | Yes | Associate/Foundational | No | Executes routine tasks under guidance. |
| **2** | Intermediate | Yes | Practitioner/Core Exam | No | Delivers standard features autonomously. |
| **3** | Advanced | Yes | Professional/Specialty Exam | No | Deep domain authority, solves complex edge cases. |
| **4** | Expert | Yes | Multi-Cert/Principal Exam | No | System-wide decisions, establishes standards. |
| **5** | DC Master | **No** (Request only) | N/A | **Required** | DC-recognized principal lead; manager review required. |

---

## 5. Certificate Verification Engine & State Matrix

Verification is strictly computed based on active database records:
1. **Certified (Verified):**
   - Condition: Member has a `training_records` row matching the skill mapping where:
     `status = 'done'` AND `approval = 'approved'` AND `renewed = false` AND (`expiry_status != 'expired'` OR certificate is permanent completion).
   - Vault Mode: Renders with `data-verified="true"` hook and mono stamp `CERTIFIED`.
2. **Self-Assessed:**
   - Condition: Member has rated themselves L1–L4 with no qualifying active certificate.
   - UI: Renders neutral badge `Self-assessed`.
3. **Pending Review:**
   - Condition: Member has requested Level 5 endorsement or submitted proof pending manager sign-off.
   - UI: Renders `Pending Review` (`Hourglass` icon).

---

## 6. Anti-Slop & Design System Audit Checklist

- [x] **Zero Gradients:** No `bg-gradient-to-*`, no radial glows.
- [x] **No Pastel Slop:** Surfaces use `bg-card` (`#FFFFFF` in light, `#162028` in dark).
- [x] **No Icon-in-Circle KPIs:** Metrics are pure typography (`text-kpi font-semibold text-foreground` inside `<dl>`).
- [x] **No Expiry Token Leakage:** Never use `--status-active-*` or `--status-expiring-*` for skill ratings. Use `text-primary` or `text-muted-foreground`.
- [x] **High Density:** 32px row heights, 13px table text, 4px grid.
- [x] **Monospace Precision:** Geist Mono used for skill codes (`SKL-CLD-01`), levels (`L3`), dates, and stamps.
- [x] **Tokens Only:** All styling binds to CSS variables in `globals.css`.

---

## 7. Seed Dataset Requirements for `@seed`

For realistic demo presentation, `@seed` should provide a dataset containing:
1. **Target Role Benchmark:**
   - Role: `Senior Software Engineer` (Team Cloud, DC34). Target Skill Index: `3.3 / 5.0`.
2. **15 Realistic IT Skills Across 7 Domains:**
   - **Cloud (3):** AWS Architecture (`L4`, Certified by AWS Solutions Architect Pro), Google Cloud Platform (`L2`, Self-assessed), Terraform / IaC (`L3`, Certified by HashiCorp Terraform Assoc).
   - **DevOps (2):** Kubernetes & Container Orchestration (`L3`, Certified by CKA), CI/CD Automation & GitHub Actions (`L3`, Self-assessed).
   - **Backend (3):** Go Microservices & Concurrency (`L3`, Self-assessed), PostgreSQL Performance & Optimization (`L4`, Self-assessed), Node.js & TypeScript (`L4`, Certified by OpenJS Node.js Dev).
   - **Frontend (2):** React & Next.js Architecture (`L4`, Self-assessed), Web Performance & Accessibility (`L3`, Self-assessed).
   - **Security (2):** Threat Modeling & Secure SDLC (`L2` vs Target `L3` - Gap -1), CISSP Security Principles (`L1` vs Target `L2` - Gap -1).
   - **Data/AI (2):** Vector Databases & RAG Pipelines (`L1` vs Target `L3` - Gap -2), Prompt Engineering & LLM APIs (`L2`, Self-assessed).
   - **Leadership (1):** Technical Mentorship & System Architecture (`L4`, Self-assessed).
3. **Seed Metrics Summary:**
   - Total Skills: `15`
   - Certified Skills: `5` (33% coverage)
   - Self-Assessed Skills: `9`
   - Pending Review: `1` (Requesting L5 in PostgreSQL)
   - Target Met: `12`
   - Growth Gaps: `3` (Security Threat Modeling, CISSP, Vector DB/RAG)
