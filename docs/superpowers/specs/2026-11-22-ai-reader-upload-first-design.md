# AI certificate reader: upload-first form and admin switch — design

Date: 2026-11-22. Builds on `2026-11-22-ai-certificate-reader-design.md` (decision #75). Status: approved by the project owner in chat on 2026-11-22. Small change: a UX rework of the Add record sheet plus an admin switch.

## Intent

A member only discovered "Fill from file" after filling most of the form and reaching the evidence field at the bottom. With AI on, the file should come first and the form should fill itself. An admin should be able to switch the feature on and off without SQL.

## Goals

- With AI on, the top of the Add sheet explains the feature and takes the file; reading starts when the file is chosen.
- The member sees what the AI filled, what is still needed, and can fill by hand at any time.
- Required fields stay marked `*` and the sheet still refuses to save while one is empty.
- An admin switches the feature on or off, and sets the daily limit per member, on `/settings`.

## Non-goals

- The two other entry points that open the same sheet (dashboard certificate list, learning submit dialog) stay without AI.
- No change to the contract, the gateway or the limit logic.
- No per-user opt-out, no usage charts.

## Design

**Sheet, AI on and adding (not editing):**
- A card at the top: "Have your certificate file? Upload it and AI fills in the form for you", the file drop zone, a one-line notice that the file is sent to an AI service (DeepSeek) and the member checks everything before saving, and "No file? Skip this and fill in the form below."
- This card is the only evidence field: the bottom Evidence field is not shown, and the chosen file is uploaded as evidence by the existing save flow.
- Choosing a file starts one read. A status line (announced politely to screen readers) says "Reading your file…", then "AI filled N fields. Check them before saving." or the failure message with a "Read again" button. A late answer for a file the member has since replaced or removed is ignored.
- After a read, empty required fields are listed ("Still needed: Certificate, Issue date"); each item moves focus to its field. No red error appears until the member presses Save.
- Save is disabled while a read is running.
- The existing "AI" marks, the "AI read … not in the catalogue" note and the proposal prefill stay.

**Sheet, AI off or editing:** unchanged (Evidence field at the bottom, no card).

**Admin switch:** a section "AI certificate reader" on `/settings` (admin only): a switch, the daily limit per member (1 to 200), today's number of reads, and the provider status ("DeepSeek configured" or "Not configured: the button stays hidden"). Saving goes through two Postgres functions, `get_ai_feature` and `set_ai_feature`, which refuse anyone who is not an admin (`app_role()`), are called with the user's own JWT, and add no new service-role use. The gateway path (`claim_ai_call`, `finish_ai_call`) is untouched.

## Approaches considered

| | What | Trade-off |
|---|---|---|
| **A (chosen)** | Card at the top, auto read, SECURITY DEFINER admin functions | Admin check lives in the database, in line with the RLS rule; two new functions |
| B | Keep the button, only move it to the top | Smallest, but the member still has to find and press it |
| C | Server action with a code check and the service role | No migration, but a permission check in code instead of the database, against rule 1 |

## Constraints

- English UI text; dates `dd/MM/yyyy`; only design tokens; existing components first.
- The sheet must stay usable when the AI call fails or times out.
- `.claude/rules/database.md`: new functions are `SECURITY DEFINER` with `set search_path = ''`, tested for admin, manager, member and anon.
