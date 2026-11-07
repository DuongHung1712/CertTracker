# Access matrix map (spec 2026-11-06 §7.2)

Each cell of the §7.2 table, mapped to the pgTAP test that already covers it, or "gap". Numbers are pgTAP assertion numbers in that file; files 06, 12 and 15 are cited by test name. Gaps are covered in `supabase/tests/database/16_access_matrix.test.sql` ("16 #n").

A `lives_ok` on an UPDATE does not count as cover: an UPDATE that RLS filters out affects 0 rows and still passes. Those cells are re-tested in file 16 by counting the rows the UPDATE affected.

| Role | Object | Operation | Spec | Covered by |
|---|---|---|---|---|
| Member | `members` | read | own only | 04 #10 |
| Member | `members` | update own row | cannot | 12 "a direct update of career_start/career_role_id by the member changes nothing" (career fields only); **gap** → 16 #1, #10 |
| Member | `members` | update another's row | cannot | **gap** → 16 #2, #10 |
| Member | `training_records` | read own, never another's | own | 04 #11, 05 #18 |
| Member | `training_records` | insert own / another's | own only | 04 #16 / 04 #15 |
| Member | `training_records` | update own | can | 04 #13 (lives_ok only); **gap** → 16 #3 |
| Member | `training_records` | update another's | never | **gap** → 16 #4, #11 |
| Member | `training_records` | delete another's | never | **gap** → 16 #5, #11 |
| Member | proof files | own: read, insert, update, delete | can | 05 #24, #22, #25, #29 |
| Member | proof files | another's: read, insert, update, move, delete | denied | 05 #20/#24, #23, #26, #27, #28; unchanged #35 |
| Member | `profiles` role | change own | cannot | **gap** (R5) → 16 #6, #12 |
| Member | `profiles` role | change another's | cannot | **gap** (R5) → 16 #7, #13 |
| Member | `manager_scopes` | read | none | 11 #15 |
| Member | `manager_scopes` | insert | cannot | **gap** → 16 #8 |
| Member | `manager_scopes` | delete | cannot | **gap** → 16 #9, #14 |
| Manager in scope | `members` | read | in scope | 04 #4, 11 #11 |
| Manager in scope | `members` | update | can | 12 "a manager can still update full_name of a member in scope" (lives_ok only); **gap** → 16 #15 |
| Manager in scope | `members` | move a member out of scope | cannot | **gap** → 16 #17 |
| Manager in scope | `members` | delete | cannot (spec allows update only) | **gap** → 16 #18, #29 |
| Manager in scope | `training_records` | read | in scope | 04 #5, 11 #12 |
| Manager in scope | `training_records` | update | can | 04 #6 (lives_ok only); **gap** → 16 #19 |
| Manager in scope | `training_records` | insert | can | **gap** → 16 #20 |
| Manager in scope | `training_records` | delete | can | **gap** → 16 #22 |
| Manager in scope | proof files | read, insert, update, delete | can | 05 #8/#12, #10, #13, #17 |
| Manager | `profiles` role | change own | cannot | **gap** (R5) → 16 #24, #31 |
| Manager | `profiles` role | change another's | cannot | **gap** (R5) → 16 #25, #32 |
| Manager | `manager_scopes` | insert | cannot | 11 #9 |
| Manager | `manager_scopes` | retarget own scope | cannot | **gap** → 16 #26, #33 |
| Manager | `manager_scopes` | delete own scope | cannot | **gap** → 16 #27, #33 |
| Manager out of scope | `members` | read | nothing | 04 #4, 11 #18 |
| Manager out of scope | `members` | update | nothing | **gap** → 16 #16, #28 |
| Manager out of scope | `training_records` | read | nothing | 04 #5, 11 #12, #19 |
| Manager out of scope | `training_records` | update | nothing | 04 #9 |
| Manager out of scope | `training_records` | insert | nothing | **gap** → 16 #21 |
| Manager out of scope | `training_records` | delete | nothing | **gap** → 16 #23, #30 |
| Manager out of scope | proof files | read, insert, update, move, delete | denied | 05 #9/#12, #11, #14, #15, #16; unchanged #35 |
| Demoted manager | `members` | read | own only | **gap** → 16 #34 |
| Demoted manager | `members` | update former team | nothing | **gap** → 16 #35, #46 |
| Demoted manager | `training_records` | read | own only | 11 #26 (former team only); **gap** for "own" → 16 #36 |
| Demoted manager | `training_records` | update own | can | **gap** → 16 #37 |
| Demoted manager | `training_records` | former team: update, insert, delete | nothing | **gap** → 16 #38, #39, #40, #47 |
| Demoted manager | proof files | read | own only | **gap** → 16 #41 |
| Demoted manager | proof files | insert own | can | **gap** → 16 #42 |
| Demoted manager | proof files | former team: insert, update, delete | denied | **gap** → 16 #43, #44, #45, #48 |
| Demoted manager | `manager_scopes` | rows grant nothing | — | 11 #23, #24, #25, #26 |
| Admin | `members` | read, insert, update | all | 04 #2; 15 "DB-1: an admin adding the member links the login that already exists"; 12 "the admin can set the role and the career start" |
| Admin | `members` | delete | all | **gap** → 16 #50 |
| Admin | `training_records` | read | all | 04 #3 |
| Admin | `training_records` | insert | all | 06 (the admin's `commit_import` creates records) |
| Admin | `training_records` | update, delete | all | **gap** → 16 #51, #52 |
| Admin | proof files | read, insert, update, delete | all | 05 #30/#32, #31, #33, #34 |
| Admin | `profiles` role | change | can | **gap** (R5) → 16 #49, #55 |
| Admin | `manager_scopes` | insert, delete | all | 11 #29, #30, #31 |
| Admin | `manager_scopes` | read all, update | all | **gap** → 16 #53, #54 |

Note: an UPDATE on `members` reaches only rows the SELECT policy "members: read self or managed team" shows, so a manager's update of an out-of-scope member is refused by two policies. Widening the update policy alone exposes nothing (mutation check (a), task 2 report).
