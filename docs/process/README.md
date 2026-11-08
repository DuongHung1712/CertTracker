# CertTracker — Process documents

The documents are numbered in the order of the process, **Idea → Brainstorm → CA → WBS → SAD → Design/Mockup → PoC → MVP → Production**, and are best read in that order. They were **not written in that order**: the MVP was built first, and these documents were written afterwards (backfilled). 06 documents the screens as they were built (screenshots, not mockups) and holds the proposed mockups that the sponsor reviews before more is built; 07 reconstructs the PoC from the tests and plans the pilot; 08 lists what must be true before production, which has not started. See [00](00-process-status.md) for why, and for the gate before Phase 2.

| # | Document | Question it answers |
|---|---|---|
| 00 | [Process status](00-process-status.md) | Where are we in Idea → … → Production, honestly? |
| 01 | [Idea and brainstorm](01-idea-and-brainstorm.md) | Where did the idea come from, what was decided early, and what was skipped? |
| 02 | [Concept analysis (CA)](02-concept-analysis.md) | Is this the right problem, for whom, and is it worth the effort — and how do we find out? |
| 03 | [Requirements](03-requirements.md) | What must CertTracker do, and which need does each requirement serve? |
| 04 | [WBS](04-wbs.md) | What work was done and what remains, planned vs actual? |
| 05 | [SAD](05-sad.md) | How is the system built and why? |
| 06 | [Design and mockups](06-design-and-mockups.md) | What do the screens look like today, and which proposed changes should the sponsor review before we build them? |
| 07 | [PoC and MVP](07-poc-and-mvp.md) | Is the MVP proven, and how do we pilot it? |
| 08 | [Production readiness](08-production-readiness.md) | What must be true before production? |

Statements marked "as of 2026-10-07" (or an earlier date) or "(W6, unmerged)" must be refreshed when week 6 is merged and the public deployment is updated.

Sources of truth that these documents link to rather than copy: the [design spec](../superpowers/specs/2026-09-26-certtracker-design.md), [decisions log](../decisions.md), [design system](../design-system.md), [deployment notes](../deploy/).
