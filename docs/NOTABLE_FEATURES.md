# FixMyCity: Notable Features

A reference of the technically interesting, defensible features of the FixMyCity
implementation, written for inclusion in the project report. Each entry states *what* the
feature is, *why* it is interesting, and *how* it is implemented, with functional/
non-functional requirement references for traceability. Where a feature was validated by a
live end-to-end test against the production backend, this is noted as **Verified**.

> Honesty note on AI: the external computer-vision (CV) service is **live** and does three
> real jobs: image registration, duplicate detection (perceptual hashing), and
> "is-this-a-genuine-civic-issue" validation. **Automatic category pre-fill is not currently
> wired** (the service returns a confidence score and a duplicate verdict, but not a category
> that maps to our three classes), and the in-database `pgvector` similarity path is present
> but **dormant** after the migration to the external service. The report should claim only
> what is live.

---

## 1. The closed-loop workflow (the core differentiator)

**What.** Every report moves through a strict, server-enforced state machine:
`Submitted → Acknowledged → Assigned → In Progress → Resolved`, with branches `Rejected`
(reason required) and `Reopened` (citizen may reopen a Resolved report within 7 days). Every
transition is timestamped, written to an append-only audit log, and fires a citizen
notification.

**Why interesting.** This is the project's central thesis: earlier Ghanaian civic-reporting
attempts failed because reports vanished: no resolution workflow and no feedback. FixMyCity's
differentiator is that the loop *closes* and the citizen is told at every step.

**How.** The state machine lives entirely server-side in the `transition-report` edge
function, which (a) validates that the requested transition is legal for the current status
*and* the caller's role, (b) writes a `status_transitions` row, and (c) updates the report and
fires notifications atomically. Front-ends never write statuses directly: they are thin
clients. *Traceability: FR-022 (7 statuses), FR-042 (acknowledge), FR-050 (assign), FR-052
(every transition logged with timestamp + actor + note), FR-024 (reopen within 7 days).*

---

## 2. Append-only audit log

**What.** Every status change is recorded in a `status_transitions` table that permits inserts
only (no updates, no deletes), enforced by a database trigger.

**Why interesting.** It gives the system a tamper-evident history: who did what, when, and why,
for every report. This is a governance/accountability property that regulators and an MMDA
care about, and it is enforced at the database layer rather than trusted to application code.

**How.** A Postgres trigger (`transitions_append_only`) blocks `UPDATE`/`DELETE` on the table.
The console's Audit Log view is a read-only projection of this log. *Traceability: FR-052.*

---

## 3. Human-in-the-loop AI (design principle, not just a feature)

**What.** AI *suggests*; humans *confirm*. The duplicate detector flags candidates an officer
decides on; the system never auto-rejects or auto-merges. The strong-duplicate path offers the
citizen a choice rather than silently discarding their report.

**Why interesting.** It is a deliberate, defensible stance on responsible AI in a civic
context: the model accelerates triage without removing human judgement or a citizen's agency.

**How.** The `check-duplicates` / duplicate-review queue surfaces "possible duplicate of
FMC-…" candidates to officers, who choose to reject-as-duplicate or keep. The citizen-facing
strong-duplicate flow (feature 5) presents "Follow it" vs "mine is different". *Traceability:
professor-mandated AI features; design principle 4.*

---

## 4. External CV integration with an anti-corruption adapter and fail-soft design

**What.** Image classification and duplicate detection are delegated to an external CV service.
The integration is wrapped in a single adapter module that (a) translates between the two
category vocabularies, (b) enforces an 8-second timeout, and (c) **fails soft**: if the CV
service is slow, down, or errors, the report is still created (with null AI metadata). An
outage never halts civic reporting.

**Why interesting.** This is textbook defensive integration: the "anti-corruption layer"
pattern isolates our domain model from a third-party contract, and the fail-soft policy makes
a non-critical dependency genuinely non-blocking. Only two conditions ever block a submission:
an explicit "not a civic issue" verdict, and a strong duplicate (which offers a follow
instead).

**How.** `supabase/functions/_shared/image-model.ts` is the boundary: it maps
`refuse_dump→dumping`, `blocked_drain→drain`, our `streetlight→broken_public_facility`, and
posts the photo as multipart form data to the CV service; `submit-report` consumes the result.
A streetlight safeguard ignores "not environmental" verdicts for streetlight photos because the
model has no streetlight class. **Verified:** live submissions populated `external_report_id`
and `perceptual_hash` on every report; a genuinely off-topic photo was correctly blocked with a
`photo_not_environmental` message. *Traceability: AI feature 1; NFR (CV outage tolerance).*

---

## 5. Follow-a-duplicate: image-based deduplication that turns duplicates into signal

**What.** When a citizen submits a photo that the CV service recognises (by perceptual hash) as
a strong duplicate of an existing open report by *another* citizen, the system does **not**
create a second report. Instead it offers the citizen the existing report to **follow**. A
followed report then carries multiple interested residents, and every one of them receives the
same status notifications through resolution.

**Why interesting.** It reframes duplicates (usually treated as noise to be merged away) as a
*demand signal*: how many residents care about this exact problem. It also improves data
quality (one canonical report instead of many near-identical ones) without a citizen feeling
their submission was thrown away.

**How.** On a strong-`duplicate` verdict, `submit-report` records a `duplicate_offers` row and
returns `{status:"duplicate_detected", candidate}` instead of inserting a report. The citizen
picks "Follow it" → `follow-report` adds a `report_followers` row (a trigger maintains
`reports.follower_count`), or "mine is different" → resubmit with `force_create`, which skips
the CV step. On every subsequent transition, `transition-report` fans notifications out to the
reporter **and** all followers. **Verified:** citizen A filed FMC-2026-0534; citizen B uploaded
the identical image, was offered A's report, followed it (`follower_count → 1`), and then
received the officer's "acknowledged" notification. *Traceability: AI feature 2; FR-070/071
(notify on every transition).*

---

## 6. IDOR-hardened follow authorisation (a real security fix)

**What.** A citizen can only follow a report that was *explicitly offered to them* as a
duplicate: they cannot follow an arbitrary report id.

**Why interesting.** Without this gate, any authenticated user could follow any report id and,
via the follower read policy, read that report's full contents (photos, description, precise
location, timeline), a classic Insecure Direct Object Reference. This is a concrete, named
security control the report can point to, not a hand-wave.

**How.** The `duplicate_offers` table has Row-Level Security enabled with **no policies at all**
(so no client can read or write it: only the service role can). `follow-report` checks for a
matching offer row before inserting the follow; absent an offer it returns `403`. The follow
read policy deliberately exposes the report body to followers but **never the reporter's
identity**. *Traceability: NFR (least privilege / Act 843 data minimisation).*

---

## 7. Server-authoritative jurisdiction gate (PostGIS point-in-polygon)

**What.** The pilot serves exactly one municipality (Ayawaso West). Any report whose
coordinates fall outside the AWMA boundary is rejected at the server: the front-end also warns,
but the server is the source of truth.

**Why interesting.** It is precise geofencing done properly: a real municipal boundary polygon
(from OpenStreetMap) plus a small tolerance for edge neighbourhoods, evaluated with a fast
bounding-box reject before the exact test. It keeps the pilot's scope enforceable rather than
advisory.

**How.** `pointInAwma(lat, lng)` runs a bounding-box fast-reject, then a ray-casting
point-in-polygon test against the AWMA ring, then a distance-to-edge check with a ~500 m
tolerance (because a few estates sit just outside the raw OSM polygon). Enforced in
`submit-report` before any write. **Verified:** a point near Nkrumah Circle was rejected
(`422 outside_awma`, zero rows created); points at AWMA neighbourhood centroids succeeded.
*Traceability: locked pilot scope; FR-010.*

---

## 8. Row-Level Security everywhere, with role-scoped visibility

**What.** Every table enforces RLS. Citizens see their own reports (plus public map fields);
officers/admins see all; field crews see only reports assigned to their crew; followers get a
scoped read of a followed report but never the reporter's identity. Clients cannot write report
statuses at all.

**Why interesting.** Authorisation is enforced by the database, not merely by the UI, so a
compromised or malicious client cannot escalate. The visibility rules encode the exact
role model of the domain.

**How.** RLS policies on `profiles`, `reports`, `status_transitions`, `notifications`,
`report_followers`, and `duplicate_offers`; the only client write grants are narrow
(`profiles.full_name/phone`, `notifications.read`). All privileged operations go through edge
functions running with the service role. *Traceability: NFR (access control); Act 843.*

---

## 9. Duplicate-review triage console for staff

**What.** A dedicated console screen where officers work the CV service's duplicate-review
queue: each item pairs a report with its candidate and a "% match" confidence, and staff
**Resolve** (with a dropdown of resolution outcomes: Duplicate / Possible duplicate /
Supporting evidence / Reject-as-not-a-duplicate) or **Merge**.

**Why interesting.** It operationalises the "AI suggests, human confirms" principle with a real
workflow surface, and it keeps a clean architectural boundary: resolving/merging updates the
model's advisory queue only. It never changes a report's status, which stays exclusively in
the state machine.

**How.** The console calls a `duplicate-reviews` edge function that is a pure proxy to the CV
service's queue; the resolution values are validated against the service's allowlist. *This is
the most recently added console feature.*

---

## 10. Ghana-context engineering (build for the real deployment environment)

**What.** The product is tuned for mid-range Android phones on 3G: target time-to-interactive
≤ 5 s on ~1 Mbps / 250 ms latency, photos compressed client-side to WebP before upload and
capped at 5 MB, English UI, and no dependency on paid map APIs.

**Why interesting.** The non-functional constraints are treated as first-class design inputs,
not afterthoughts, a frequent failure point for civic tech in the Global South.

**How.** Client-side image compression to WebP prior to storage upload; OpenStreetMap tiles via
Leaflet (no Google Maps key); a Progressive Web App shell so there is no app-store dependency.
*Traceability: NFR (TTI ≤ 5 s on 3G; ≤ 5 MB uploads; PWA delivery).*

---

## 11. Data-protection posture (Ghana Data Protection Act, Act 843)

**What.** Minimal PII collected, encrypted at rest, TLS 1.2+ in transit, passwords hashed with
bcrypt, and identity data withheld even where content is shared (followers never see who
reported).

**Why interesting.** Compliance is designed in: data minimisation and purpose limitation show
up directly in the schema and the RLS policies, which is exactly what an Act 843 assessment
looks for.

**How.** Supabase Auth (bcrypt password hashing), Postgres encryption at rest, TLS everywhere,
and RLS policies that expose only the fields a role needs. *Traceability: NFR (Act 843).*

---

## Quick "features to highlight" list (for a slide or abstract)

1. Server-enforced **closed-loop state machine** with citizen notifications at every step.
2. **Append-only, tamper-evident audit log** enforced by a DB trigger.
3. **Fail-soft external CV integration** behind an anti-corruption adapter (outage never blocks reporting).
4. **Follow-a-duplicate**: image-hash dedup that converts duplicates into a demand signal + multi-follower notifications.
5. **IDOR-hardened** follow authorisation via a policy-less `duplicate_offers` gate.
6. **PostGIS jurisdiction geofence**, server-authoritative.
7. **Row-Level Security** with role- and follower-scoped visibility; thin clients that cannot write statuses.
8. Built for **mid-range Android / 3G**, PWA delivery, no paid map keys, **Act 843**-aware.

*All AI/follow/jurisdiction claims above were validated by live end-to-end tests against the
production backend on 2026-07-24.*
