# Group Information: CSCD 602 Capstone

Canonical group/member record for the FixMyCity capstone submission. Reused verbatim
in the SRS, README, and the coursework's required "Group Information" section. Update
here first if anything changes, then propagate.

**Group Number/Name:** Zero Down Time
**Project Title:** FixMyCity: A Civic Issue-Reporting Platform for Ayawaso West
Municipal Assembly, Ghana
**Course:** CSCD 602, Advanced Software Engineering (MSc)
**Lecturer:** Prof. Solomon Mensah
**Department:** Department of Computer Science, University of Ghana, Legon

## Members

| No. | Group Member | Student ID | Major Contribution |
|---|---|---|---|
| 1 | Nana Agyemang Duah | 22425071 | AI model. Designed and trained the external computer-vision service's photo-classification pipeline that FixMyCity's `classify-image`/`submit-report` flow calls at submission time. _(expand with your own understanding/detail before individual submission)_ |
| 2 | Nigel Dolling | 22424595 | Testing & QA. Ran manual functional testing on the citizen app's report-submission and tracking flows, logging defects that fed into `docs/testing/TESTING_REPORT.md`. _(expand with your own understanding/detail before individual submission)_ |
| 3 | Samuel Owusu Ampadu | 22424245 | Built and own the FixMyCity application end-to-end: the citizen and console React/Vite front-ends, the Supabase schema and Row-Level Security policies, and all ten edge functions (`submit-report`, `transition-report`, `cancel-report`, `follow-report`/`unfollow-report`, `manage-users`, `manage-crews`, `check-duplicates`, `duplicate-reviews`, `classify-image`). Designed the server-enforced closed-loop status workflow, the AWMA jurisdiction geofence, and the follow-a-duplicate IDOR fix; integrated the external CV vendor behind a fail-soft anti-corruption adapter; deployed both apps to Vercel and the backend to Supabase. |
| 4 | Stanford Ofori | 22427427 | FixMyCity application. Contributed to the operations console (Inbox, Assignments, Crews screens) and the Supabase edge-function layer alongside Samuel. _(expand with your own understanding/detail before individual submission)_ |
| 5 | Alexander Adade | 22424693 | AI model. Built the perceptual-hash duplicate-detection side of the external computer-vision service and its API contract with `check-duplicates`/`duplicate-reviews`. _(expand with your own understanding/detail before individual submission)_ |
| 6 | Hajara Yusif | 22425066 | Testing & QA. Verified staff-side workflows on the operations console (triage, assignment, duplicate review) and cross-checked defect reports before they were logged in `docs/testing/TESTING_REPORT.md`. _(expand with your own understanding/detail before individual submission)_ |

Source: `docs/FixMyCity-demo.pptx` title slide (has student IDs). Cross-checked against
`docs/FixMyCity_SRS.docx`, which lists the same six people with slightly different name
forms and no IDs ("Nana Duah", "Samel Owusu Ampadu", "Hajara Yusuf", "Alex" only),
those look like shorthand/typos rather than a second identity, but **please confirm the
spellings above are correct** before final submission, since the coursework requires
names and IDs to appear clearly and consistently.

Per the coursework's individual-submission requirement (Section 5), each member
completes the "Major Contribution" column with their own contribution and understanding
statement. This file supplies the shared roster, not the personal statements.

## Individual Understanding Statement: Samuel Owusu Ampadu

*Draft: read it over, correct anything that doesn't match how you'd explain it, and
keep it in first person for your own submission.*

I built the FixMyCity application itself, end to end. The core design decision the
whole system hangs off is that status changes are never trusted to a client: every
report moves through a strict server-side state machine inside the `transition-report`
edge function, which checks the caller's role against the requested transition, writes
an append-only audit row, and only then updates the report. If the audit write fails,
it rolls the status back, so the two can never disagree. That guarantee is backed up
at the database layer too: Row-Level Security is enabled on every table, and the
`authenticated`/`anon` roles were stripped down to narrow, explicit grants, so even a
compromised or bypassed client still can't write a report's status directly against
Postgres. I verified that live with a direct `PATCH` attempt that came back
`403 permission denied`.

Two features I'd point to if asked to explain something in detail: the AWMA
jurisdiction gate and the follow-a-duplicate flow. The gate is a real point-in-polygon
check (`pointInAwma`) against an OpenStreetMap boundary, run server-side inside
`submit-report` before a report is ever created, with a small edge tolerance because a
few pilot neighbourhoods sit just outside the raw polygon. Follow-a-duplicate is the
feature where, if the external CV service flags a new photo as a strong duplicate of
someone else's open report, we don't create a second report. Instead we offer the
citizen the existing one to follow, and I had to specifically gate that with a
`duplicate_offers` table (RLS enabled, zero client policies) so a citizen can only
follow a report that was actually offered to them, closing what would otherwise be an
IDOR letting anyone follow, and read, any report by guessing its ID.

I also own the integration with the external CV model Nana and Alexander built: it
sits behind a single adapter module (`_shared/image-model.ts`) that translates between
our category vocabulary and theirs, and is designed to fail soft. If that service is
slow or down, the report still gets created without an AI verdict, because a
third-party outage shouldn't stop someone from reporting a pothole. Both apps are
deployed to Vercel and the backend runs on Supabase (Postgres with PostGIS, Auth,
Storage, and the ten edge functions listed above), and I led the documentation
refresh for this submission (SRS v2.0, the design document and diagrams, the testing
report, and the maintenance plan), grounding all of it in the actual migrations and
edge-function code rather than describing intended behaviour that was never built.

## Individual Understanding Statement: Nana Agyemang Duah

*Draft: this one is written from what FixMyCity's side of the integration can
actually verify (the contract the model exposes, not its internal architecture or
training process, which only you can speak to). Read it over, replace the parts that
don't match your own work, and add the model-side detail I can't see from here.*

I built the photo-classification side of the external computer-vision service
FixMyCity calls at submission time. When a citizen submits a report, `submit-report`
posts the photo to our API and gets back a verdict: whether the photo looks like a
genuine environmental/civic issue at all, and if so, roughly what kind. FixMyCity
uses that "is this even a real issue" signal directly: if the model says a photo
isn't environmental, submission is blocked and the citizen is asked to retake it,
except for the Broken Streetlight and Other categories, which our model doesn't have
a class for and are exempted from that check on FixMyCity's side.

The part of this I understand best is the contract we agreed on with Samuel's
integration code: our service returns a confidence score and verdict fields that his
adapter (`_shared/image-model.ts`) translates into FixMyCity's own category
vocabulary, and the whole call is expected to complete or time out within about eight
seconds, since FixMyCity is designed to create the report anyway (without an AI
verdict) if we don't answer in time. That fail-soft expectation shaped how I built
the service: it needs to respond fast and predictably, or fail cleanly, rather than
hang.

*(Fill in here: the actual model/architecture you used for classification, how you
trained or sourced it, what "genuine civic issue" detection looks like on your end,
and anything about the service's deployment you want to speak to directly.)*

## Individual Understanding Statement: Nigel Dolling

*Draft: this one describes the kind of testing role you had, illustrated with real
defects from the testing report, rather than claiming credit for a specific bug find
I can't personally attribute to you. Read it over and replace the general parts with
what you actually did and found.*

My contribution was testing and quality assurance on the citizen-facing side of
FixMyCity: working through the report-submission flow, the category selector, the
photo/location/description step, My Reports, the status timeline, and the map, and
checking that what the app actually did matched what it claimed to do. That kind of
manual functional testing is what surfaced real, documented defects in this
project's history, such as a citizen who resubmitted a photo of their own already-open
report falling through the duplicate check instead of being blocked (logged as D-1 in
the testing report), and a map that hid pins outside a fixed viewport instead of
fitting to show every report (D-2). Testing work like that is what a defect log is
built from: try the golden path, then try to break it, and write down exactly what
happened.

Understanding this system as a tester means understanding its closed-loop promise:
every report a citizen submits is supposed to move through Submitted, Acknowledged,
Assigned, In Progress, and Resolved, with a notification at each step, and the
citizen should always be able to see exactly where their report stands. Testing that
promise means checking not just that the happy path works, but that the edges do too:
what happens outside the AWMA boundary, what happens with a duplicate photo, what
happens if you try to reopen a report after the 7-day window.

*(Fill in here: which specific screens or flows you personally tested, which defects
you found or verified, and how you tracked and reported issues back to the team.)*

## Individual Understanding Statement: Stanford Ofori

*Draft: written to reflect the shared application work with Samuel at a level I can
verify from the codebase; personalize it with the specific pieces you actually built
or reviewed.*

I worked on the FixMyCity application itself alongside Samuel: the operations console
that Reports Officers, Field Crew, and Administrators use to triage, assign, and
resolve citizen reports, and the Supabase edge functions behind it. The console's
Inbox is the default screen staff land on: a filterable, paginated table of every
report with status chips and live counts, and clicking a row opens a detail panel
with the photo, location, description, follower count, and the same status timeline
citizens see. From there staff acknowledge, assign to an available crew, reject with
a reason, or move a report through the rest of the state machine, and every one of
those actions is a call to the `transition-report` edge function rather than a direct
database write.

Understanding the console well means understanding its permission model: it isn't
just one "staff" role, it's six console roles (Administrator, Supervisor, Officer,
Dispatcher, Viewer, Field Crew), each with a different slice of what they're allowed
to do, enforced both in the UI and, more importantly, inside the edge functions
themselves, so a Dispatcher or Viewer account can't perform an action just because the
button happens to be clickable. The Crews, Citizens, and Assignments screens are
lighter-weight than the Inbox: mostly direct, Row-Level-Security-scoped reads from
Postgres, since there's no extra business logic to enforce beyond "is this caller
staff."

*(Fill in here: the specific screens, edge functions, or fixes you personally built
or reviewed, and anything about the console you want to speak to directly.)*

## Individual Understanding Statement: Alexander Adade

*Draft: like Nana's, this is written from what FixMyCity's side of the integration
can verify (the contract, not the model internals). Read it over and add the
detection-side detail only you can speak to.*

I built the duplicate-detection side of the external computer-vision service
FixMyCity calls at submission time: the perceptual-hash matching that decides whether
a newly submitted photo is a likely duplicate of an existing open report. When our
service flags a strong match, FixMyCity doesn't create a second report. It records a
follow-offer and gives the citizen the choice to follow the existing report instead
of filing a near-identical one, or to submit anyway if it really is a different
issue. That verdict also has to distinguish a duplicate of someone else's report
(which triggers the follow offer) from a duplicate of the same citizen's own report
(which just tells them they've already reported it), so the service's response needs
to carry enough information for FixMyCity to tell those two cases apart.

The part of this I understand best is the staff-facing side: officers work a
Duplicate-Review queue in the console, where each item pairs two reports with a
match-percentage figure our service produces, and they resolve or merge candidates
without that ever changing a report's actual status. That queue is a thin proxy to
our service's own review-queue API on FixMyCity's side, so the accuracy and
usefulness of that percentage is really a reflection of how well our matching works.

*(Fill in here: the actual perceptual-hashing or similarity approach you used, how
you tuned or evaluated match thresholds, and anything about the detection service's
deployment you want to speak to directly.)*

## Individual Understanding Statement: Hajara Yusif

*Draft: this one describes the kind of testing role you had, illustrated with real
defects from the testing report, rather than claiming credit for a specific bug find
I can't personally attribute to you. Read it over and replace the general parts with
what you actually did and found.*

My contribution was testing and quality assurance on the staff-facing side of
FixMyCity: working through the operations console's Inbox, the acknowledge/assign/
reject workflow, the Duplicate-Review queue, Crews, and Users & Roles, and checking
that staff actions behaved the way they were supposed to for each console role. That
kind of testing is what a permission model like FixMyCity's needs, since it isn't
enough for a feature to work for an Administrator; it also has to correctly refuse
the wrong action for a Dispatcher or a Viewer, and testing work like the defect found
where the Duplicate Reviews dropdown clipped off the last card at the edge of the
viewport (logged as D-3 in the testing report) is exactly the kind of edge-case
checking that role-based, table-heavy interfaces need.

Understanding this system from the staff side means understanding that the console
is deliberately a thin collation-and-dispatch tool, one inbox, one flat crew list, one
status workflow, rather than a model of AWMA's internal departments. Testing it well
means checking that this simplicity holds up: that assigning a report only offers
crews that are actually marked available, that rejecting a report always requires a
reason, and that every action a staff member takes shows up in that report's audit
trail exactly once.

*(Fill in here: which specific screens or workflows you personally tested, which
defects you found or verified, and how you tracked and reported issues back to the
team.)*
