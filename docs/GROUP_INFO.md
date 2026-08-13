# Group Information — CSCD 602 Capstone

Canonical group/member record for the FixMyCity capstone submission. Reused verbatim
in the SRS, README, and the coursework's required "Group Information" section — update
here first if anything changes, then propagate.

**Group Number/Name:** Zero Down Time
**Project Title:** FixMyCity — A Civic Issue-Reporting Platform for Ayawaso West
Municipal Assembly, Ghana
**Course:** CSCD 602 — Advanced Software Engineering (MSc)
**Lecturer:** Prof. Solomon Mensah
**Department:** Department of Computer Science, University of Ghana, Legon

## Members

| No. | Group Member | Student ID | Major Contribution |
|---|---|---|---|
| 1 | Nana Agyemang Duah | 22425071 | AI model — designed and trained the external computer-vision service's photo-classification pipeline that FixMyCity's `classify-image`/`submit-report` flow calls at submission time. _(expand with your own understanding/detail before individual submission)_ |
| 2 | Nigel Dolling | 22424595 | Testing & QA — ran manual functional testing on the citizen app's report-submission and tracking flows, logging defects that fed into `docs/testing/TESTING_REPORT.md`. _(expand with your own understanding/detail before individual submission)_ |
| 3 | Samuel Owusu Ampadu | 22424245 | Built and own the FixMyCity application end-to-end: the citizen and console React/Vite front-ends, the Supabase schema and Row-Level Security policies, and all ten edge functions (`submit-report`, `transition-report`, `cancel-report`, `follow-report`/`unfollow-report`, `manage-users`, `manage-crews`, `check-duplicates`, `duplicate-reviews`, `classify-image`). Designed the server-enforced closed-loop status workflow, the AWMA jurisdiction geofence, and the follow-a-duplicate IDOR fix; integrated the external CV vendor behind a fail-soft anti-corruption adapter; deployed both apps to Vercel and the backend to Supabase. |
| 4 | Stanford Ofori | 22427427 | FixMyCity application — contributed to the operations console (Inbox, Assignments, Crews screens) and the Supabase edge-function layer alongside Samuel. _(expand with your own understanding/detail before individual submission)_ |
| 5 | Alexander Adade | 22424693 | AI model — built the perceptual-hash duplicate-detection side of the external computer-vision service and its API contract with `check-duplicates`/`duplicate-reviews`. _(expand with your own understanding/detail before individual submission)_ |
| 6 | Hajara Yusif | 22425066 | Testing & QA — verified staff-side workflows on the operations console (triage, assignment, duplicate review) and cross-checked defect reports before they were logged in `docs/testing/TESTING_REPORT.md`. _(expand with your own understanding/detail before individual submission)_ |

Source: `docs/FixMyCity-demo.pptx` title slide (has student IDs). Cross-checked against
`docs/FixMyCity_SRS.docx`, which lists the same six people with slightly different name
forms and no IDs ("Nana Duah", "Samel Owusu Ampadu", "Hajara Yusuf", "Alex" only) —
those look like shorthand/typos rather than a second identity, but **please confirm the
spellings above are correct** before final submission, since the coursework requires
names and IDs to appear clearly and consistently.

Per the coursework's individual-submission requirement (Section 5), each member
completes the "Major Contribution" column with their own contribution and understanding
statement — this file supplies the shared roster, not the personal statements.

## Individual Understanding Statement — Samuel Owusu Ampadu

*Draft — read it over, correct anything that doesn't match how you'd explain it, and
keep it in first person for your own submission.*

I built the FixMyCity application itself, end to end. The core design decision the
whole system hangs off is that status changes are never trusted to a client: every
report moves through a strict server-side state machine inside the `transition-report`
edge function, which checks the caller's role against the requested transition, writes
an append-only audit row, and only then updates the report — and if the audit write
fails, it rolls the status back, so the two can never disagree. That guarantee is
backed up at the database layer too: Row-Level Security is enabled on every table, and
the `authenticated`/`anon` roles were stripped down to narrow, explicit grants, so even
a compromised or bypassed client still can't write a report's status directly against
Postgres — I verified that live with a direct `PATCH` attempt that came back
`403 permission denied`.

Two features I'd point to if asked to explain something in detail: the AWMA
jurisdiction gate and the follow-a-duplicate flow. The gate is a real point-in-polygon
check (`pointInAwma`) against an OpenStreetMap boundary, run server-side inside
`submit-report` before a report is ever created, with a small edge tolerance because a
few pilot neighbourhoods sit just outside the raw polygon. Follow-a-duplicate is the
feature where, if the external CV service flags a new photo as a strong duplicate of
someone else's open report, we don't create a second report — we offer the citizen the
existing one to follow instead, and I had to specifically gate that with a
`duplicate_offers` table (RLS enabled, zero client policies) so a citizen can only
follow a report that was actually offered to them, closing what would otherwise be an
IDOR letting anyone follow — and read — any report by guessing its ID.

I also own the integration with the external CV model Nana and Alex built: it sits
behind a single adapter module (`_shared/image-model.ts`) that translates between our
category vocabulary and theirs, and is designed to fail soft — if that service is slow
or down, the report still gets created without an AI verdict, because a third-party
outage shouldn't stop someone from reporting a pothole. Both apps are deployed to
Vercel and the backend runs on Supabase (Postgres with PostGIS, Auth, Storage, and the
ten edge functions listed above), and I led the documentation refresh for this
submission (SRS v2.0, the design document and diagrams, the testing report, and the
maintenance plan), grounding all of it in the actual migrations and edge-function code
rather than describing intended behaviour that was never built.
