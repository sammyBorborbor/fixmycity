# FixMyCity — Testing & Quality Assurance Report

CSCD 602 Capstone — Group Zero Down Time. Companion to `docs/srs/SRS.md` (the
requirements being tested against) and `docs/design/DESIGN_DOCUMENT.md` (the
architecture under test).

**Testing date for the live evidence in this report:** 2026-08-12, run directly
against the hosted production Supabase project (`hvesugctansssxwtzjqn`) and the
project's Vitest suites. Every result below is either a pasted real command output, a
real HTTP response captured the day of writing, or a dated entry lifted from the
project's git/tracker history — nothing in this document is a projection or a
description of intended behaviour that wasn't actually exercised.

## 1. Testing Strategy

Given the capstone's time and staffing constraints, testing effort was prioritised as
follows: **automated unit tests** for pure business logic that's cheap to test and
regresses silently (RBAC matrix, report-action availability, the AWMA geofence);
**live integration/system tests** for the parts that are hardest to fake convincingly
— the server-side state machine, Row-Level Security, and the two AI-adjacent security
gates (IDOR on follow, jurisdiction on submit) — run directly against the real hosted
backend rather than a mocked one, because RLS and edge-function behaviour are
precisely the things a mock would paper over; and **honest gap-flagging** for
performance and formal moderated usability testing, which are described in §7–8 but
were not run this iteration due to time constraints, exactly as `docs/srs/SRS.md`
flags certain functional requirements as not-yet-implemented rather than silently
claiming completeness.

| Testing type | Status |
|---|---|
| Unit testing | ✅ Done — 50 tests, both apps (§2) |
| Integration testing | ✅ Done — live edge-function chain + database verification (§3) |
| System testing | ✅ Done — full closed-loop flow against production (§3) |
| Functional testing | ✅ Done — FR-level checks woven through §2–4 |
| Security testing | ✅ Done — live RLS/IDOR/geofence/bypass probes (§4) |
| User acceptance testing | 🟡 Partial — real captured UI evidence (§5), no moderated study |
| Usability testing | ⬜ Not run — NFR-030/031/033 targets defined, not measured (§7) |
| Performance testing | ⬜ Not run — NFR-001–005 targets defined, not measured (§7) |

## 2. Unit Testing

Both apps ship a Vitest suite. Run fresh for this report (not summarised from an
older run):

### 2.1 Citizen app — 13/13 passing

```
$ yarn test
 RUN  v4.1.10 /Users/oneplan/personal/school-work/fixmycity/citizen
 Test Files  1 passed (1)
      Tests  13 passed (13)
   Duration  123ms

 ✓ src/lib/awma-boundary.test.ts > pointInAwma > accepts East Legon (a pilot neighbourhood)
 ✓ src/lib/awma-boundary.test.ts > pointInAwma > accepts Okponglo (a pilot neighbourhood)
 ✓ src/lib/awma-boundary.test.ts > pointInAwma > accepts Dzorwulu (a pilot neighbourhood)
 ✓ src/lib/awma-boundary.test.ts > pointInAwma > accepts Abelemkpe (a pilot neighbourhood)
 ✓ src/lib/awma-boundary.test.ts > pointInAwma > accepts Airport Residential Area (a pilot neighbourhood)
 ✓ src/lib/awma-boundary.test.ts > pointInAwma > accepts Roman Ridge (a pilot neighbourhood)
 ✓ src/lib/awma-boundary.test.ts > pointInAwma > accepts Shiashie (a pilot neighbourhood)
 ✓ src/lib/awma-boundary.test.ts > pointInAwma > accepts Legon (near University of Ghana) (a pilot neighbourhood)
 ✓ src/lib/awma-boundary.test.ts > pointInAwma > rejects East Legon Hills (Kpone-Katamanso, ~1.4 km E)
 ✓ src/lib/awma-boundary.test.ts > pointInAwma > rejects Kwame Nkrumah Circle (central Accra, S)
 ✓ src/lib/awma-boundary.test.ts > pointInAwma > rejects Kumasi (far)
 ✓ src/lib/awma-boundary.test.ts > pointInAwma > rejects Tema (east coast)
 ✓ src/lib/awma-boundary.test.ts > pointInAwma > rejects non-finite coordinates
```

Traceability: FR-012 (AWMA jurisdiction gate). This is the client-side copy of the
same `pointInAwma` logic enforced server-side in `submit-report` — §4.3 below
demonstrates the server copy live.

### 2.2 Console app — 37/37 passing

```
$ yarn test
 RUN  v4.1.10 /Users/oneplan/personal/school-work/fixmycity/console
 Test Files  4 passed (4)
      Tests  37 passed (37)
   Duration  226ms

 ✓ reportActions.test.ts > availableActions — status gating (full permissions) > Submitted: acknowledge, assign, reject; not progress/resolve
 ✓ reportActions.test.ts > availableActions — status gating (full permissions) > Acknowledged: assign + reject only
 ✓ reportActions.test.ts > availableActions — status gating (full permissions) > Assigned: progress + reject
 ✓ reportActions.test.ts > availableActions — status gating (full permissions) > In Progress: resolve + reject
 ✓ reportActions.test.ts > availableActions — status gating (full permissions) > Resolved / Rejected are terminal: no actions
 ✓ reportActions.test.ts > availableActions — role gating > Dispatcher can acknowledge/assign but never reject
 ✓ reportActions.test.ts > availableActions — role gating > Crew can progress an assigned report but not acknowledge/assign/reject
 ✓ reportActions.test.ts > availableActions — role gating > Crew can resolve an in-progress report
 ✓ reportActions.test.ts > availableActions — role gating > read-only role (empty set) gets nothing regardless of status
 ✓ metrics.test.ts > resolutionMetrics > returns a dash and zeros when nothing is resolved
 ✓ metrics.test.ts > resolutionMetrics > averages the submitted→resolved span in days
 ✓ metrics.test.ts > resolutionMetrics > averages across multiple resolved reports
 ✓ metrics.test.ts > resolutionMetrics > counts resolved-this-week and the week-over-week delta
 ✓ metrics.test.ts > resolutionMetrics > ignores reopened reports (current status not Resolved)
 ✓ permissions.test.ts > permsFor — page access > Administrator can reach every page including Users
 ✓ permissions.test.ts > permsFor — page access > Supervisor reaches everything except Users
 ✓ permissions.test.ts > permsFor — page access > Officer is triage-only (no crews/analytics/users/audit)
 ✓ permissions.test.ts > permsFor — page access > Dispatcher sees Crews but not Analytics/Users/Audit
 ✓ permissions.test.ts > permsFor — page access > Viewer sees Analytics/Audit but not Crews/Users
 ✓ permissions.test.ts > permsFor — page access > Field Crew is confined to /my-reports
 ✓ permissions.test.ts > permsFor — report actions > Administrator/Supervisor/Officer may perform every transition
 ✓ permissions.test.ts > permsFor — report actions > Dispatcher may only acknowledge and assign
 ✓ permissions.test.ts > permsFor — report actions > Viewer is read-only (no actions)
 ✓ permissions.test.ts > permsFor — report actions > Field Crew may only progress and resolve their jobs
 ✓ permissions.test.ts > permsFor — management capabilities > only Administrator can manage users
 ✓ permissions.test.ts > permsFor — management capabilities > Administrator, Supervisor and Dispatcher can manage crews
 ✓ permissions.test.ts > permsFor — management capabilities > only Field Crew is flagged isCrew
 ✓ permissions.test.ts > permsFor — management capabilities > an unknown role falls back to the least-privileged (Viewer) perms
 ✓ store.test.ts > status / category model > defines all seven statuses and five canonical steps
 ✓ store.test.ts > status / category model > defines all nine CV-aligned categories
 ✓ store.test.ts > relTime > minutes / hours / days (singular + plural)
 ✓ store.test.ts > buildTimeline > marks completed steps done and appends remaining canonical steps as pending
 ✓ store.test.ts > buildTimeline > a rejected report shows no pending steps
 ✓ store.test.ts > crew lookups (seed fallback) > resolves seeded crew ids to names / returns null for unknown ids
```

Traceability: FR-042/043/050/056/061 (the state-machine action-availability rules),
FR-081/087 (the console-role permission taxonomy, including the Dispatcher/Viewer
carve-outs), FR-090 (Analytics resolution metrics), FR-022 (the 7-status/5-step
model), FR-010 (the 9-category model).

**Gap, honestly flagged:** these are pure-logic unit tests (no Deno/edge-function
runtime tests, no Playwright browser tests exist in the repo). §3–4 compensate by
testing the real edge functions and RLS policies directly against the live backend,
which exercises the same logic these unit tests assert about the client copy of, but
a dedicated Deno test harness for the edge functions themselves remains future work
(tracked in `docs/MAINTENANCE_AND_EVOLUTION.md`).

## 3. Integration & System Testing — Live Closed-Loop Flow

Rather than mock the backend, a full report lifecycle was run against the live
production database via direct HTTP calls to the real Supabase Auth, REST, and Edge
Function endpoints — the same endpoints the citizen and console apps call. A
disposable test report (reference `FMC-2026-0554`) was created, driven through the
entire state machine, verified, and then deleted (§3.4) so it does not pollute the
demo dataset used for presentations.

### 3.1 Flow executed

1. Signed in as seeded citizen `ama.asante@gmail.com`.
2. Uploaded a test photo to her private storage folder.
3. `POST submit-report` — category `other`, location inside East Legon (AWMA)  →
   **201, status `submitted`**, reference `FMC-2026-0554` generated.
4. Signed in as staff `akua.osei@awma.gov.gh` (Administrator).
5. `POST transition-report {action: acknowledge}` → **200, status `acknowledged`**.
6. Looked up an available crew (`Crew Beta`, drainage, `available=true`).
7. `POST transition-report {action: assign, crew_id: <Crew Beta>}` → **200, status
   `assigned`**.
8. `POST transition-report {action: start}` (staff-mediated — no Field Crew
   credential was available for this test run, so the officer performed the
   crew-side transition, which `transition-report` explicitly permits) → **200,
   status `in_progress`**.
9. `POST transition-report {action: resolve, note: "E2E test - resolved by
   automated probe"}` → **200, status `resolved`**.

### 3.2 Audit trail verification (direct SQL against the live database)

```sql
select from_status, to_status, actor_role, note, created_at
from status_transitions where report_id = '2fc4bb23-82c5-4bdf-a447-641295ff9539'
order by created_at;
```

| from_status | to_status | actor_role | note | created_at (UTC) |
|---|---|---|---|---|
| *(null)* | submitted | citizen | *(null)* | 2026-08-12 11:17:05.201 |
| submitted | acknowledged | admin | *(null)* | 2026-08-12 11:17:21.062 |
| acknowledged | assigned | admin | *(null)* | 2026-08-12 11:17:39.532 |
| assigned | in_progress | admin | *(null)* | 2026-08-12 11:17:42.290 |
| in_progress | resolved | admin | "E2E test - resolved by automated probe" | 2026-08-12 11:17:43.610 |

Five rows, strictly increasing timestamps, correct `from`/`to` pairs at every step —
**FR-052 (every transition timestamped, actor-tagged, and logged) verified live**,
not just asserted by a unit test.

### 3.3 Notification fan-out verification

```sql
select type, body, read, created_at from notifications
where report_id = '2fc4bb23-82c5-4bdf-a447-641295ff9539' order by created_at;
```

| type | body | created_at (UTC) |
|---|---|---|
| acknowledged | "AWMA has reviewed your report." | 11:17:21.145 |
| assigned | "Assigned to Crew Beta." | 11:17:39.624 |
| in_progress | "A crew is now working on your issue." | 11:17:42.394 |
| resolved | "Your report has been marked resolved." | 11:17:43.755 |

Exactly one notification per transition (the initial `submitted` transition has no
notification by design — there is no one to notify yet). **This is a direct,
live measurement of the "Closed-loop integrity" success criterion in
`docs/srs/SRS.md` §9.5 (100% of transitions accompanied by a notification) — 4/4 on
this run.**

### 3.4 Clean-up

The test report, its audit trail, and its notifications were deleted via
`DELETE FROM reports WHERE id = '2fc4bb23-...'`, which cascades to
`status_transitions` and `notifications` by foreign-key `ON DELETE CASCADE` — this
cascade succeeding is itself a positive confirmation that the `status_transitions`
append-only trigger's 2026-07-09 relaxation (UPDATE-only, not UPDATE-or-DELETE,
specifically to support `cancel-report`'s cascade) works as designed, live. The
uploaded test photo in Storage could **not** be deleted with the citizen's own bearer
token (`403 Access denied` — Storage DELETE requires elevated privileges the client
role doesn't have) and direct SQL deletion of `storage.objects` is itself blocked by
a `storage.protect_delete()` trigger; it was left in place as a known, pre-existing
limitation rather than worked around unsafely. See §6, defect **D-10**.

## 4. Security Testing — Live Probes Against Production

All of the following were run today against the hosted project using its public
anon key (the same key shipped in both apps' `.env` — not a secret) and, where noted,
a signed-in citizen or staff session token.

| # | Probe | Expected | Actual result |
|---|---|---|---|
| 1 | Anonymous `GET /rest/v1/reports` | Denied | **401** `permission denied for table reports` |
| 2 | Anonymous `GET /rest/v1/profiles` | Denied | **401** `permission denied for table profiles` |
| 3 | Anonymous `GET /rest/v1/duplicate_offers` | Denied | **401** `permission denied for table duplicate_offers` |
| 4 | Anonymous direct `POST /rest/v1/reports` (bypassing `submit-report`) | Denied | **401** `permission denied for table reports` |
| 5 | Authenticated citizen reads her own reports | Allowed, scoped to her rows | **200**, 3 rows, all `reporter_id` = her own id |
| 6 | Authenticated citizen reads `profiles` | Scoped to her own row only | **200**, exactly 1 row (herself) |
| 7 | Authenticated citizen reads `duplicate_offers` | Empty (zero client policies, even authenticated) | **200**, `[]` |
| 8 | Authenticated citizen directly `PATCH`es `reports.status` on her own report (bypassing `transition-report`) | Denied | **403** `permission denied for table reports` |
| 9 | Authenticated citizen calls `follow-report` on a real report belonging to a different citizen, with no matching `duplicate_offers` row | Denied (IDOR gate) | **403** `"this report was not offered to you as a duplicate"` |
| 10 | Authenticated citizen submits a report with coordinates in Kumasi (outside AWMA) | Denied | **422** `{"code":"outside_awma", ...}` |

Every probe returned exactly the access-control outcome the design claims (§8.4 of
`docs/design/DESIGN_DOCUMENT.md`, NFR-013/016 of the SRS). Probe 9 in particular is a
direct, dated, live re-verification of the IDOR fix documented in
`docs/NOTABLE_FEATURES.md` §6 — confirming it is still effective as of this report's
date, not just at the time it was originally built (2026-07-24).

**Not covered by this pass** (honest scope note): a full OWASP Top Ten sweep
(injection fuzzing, XSS payloads in free-text fields, CSRF), automated dependency
vulnerability scanning, and the CORS wildcard gap already flagged in
`docs/TRACKER.md` (every edge function currently sends
`Access-Control-Allow-Origin: *`; not independently exploitable because auth is a
bearer token browsers won't auto-attach cross-origin, but flagged as a
defense-in-depth gap — see §6, D-11).

## 5. User Acceptance / Usability Evidence

Formal moderated usability testing against NFR-030 (≥90% of first-time users
complete a report in ≤90 seconds) was not conducted this iteration — flagged
honestly rather than fabricated (§7). What *is* available as UAT-adjacent evidence:
`docs/design/UI_SCREENSHOTS.md` captures 18 real screens from both apps, driven live
against the production dataset via Playwright, demonstrating that every golden-path
screen in the SRS's use cases (UC-01 through UC-05) renders correctly with real data
— the report-detail timeline, the console inbox with live filter counts, the
Duplicate Reviews queue with real CV-service match percentages, and so on. This is
functional/visual confirmation, not a substitute for a moderated usability study.

## 6. Defects Found and Resolved

Mined from `docs/TRACKER.md`'s dated change history and git log — a real log of bugs
found during development, not a retrospective invention. Each entry names the
symptom, the fix, and (where available) how it was verified.

| ID | Date | Symptom | Fix | Verification |
|---|---|---|---|---|
| D-1 | 2026-07-31 | A citizen re-submitting a photo of their **own already-open report** fell through the duplicate check and filed a second report — the strong-duplicate branch only fired for a match against *another* citizen's report. | `submit-report` now checks for a self-match first and returns `already_reported` instead of creating a row; citizen app shows a "You've already reported this" screen. | Verified live against deployed v13: block fires, `force_create` override still works, jurisdiction gate unaffected at all 8 pilot neighbourhoods. |
| D-2 | 2026-07-31 | The Leaflet map used a fixed centre/zoom (Okponglo, z14); a citizen with reports outside that frame (e.g. East Legon) saw pins silently missing off-screen. | Added a `FitToReports` helper (`fitBounds` over all visible pins, capped zoom, single-pin recentre, AWMA-default fallback when empty) in both apps. | Manual verification in both apps' Map screens. |
| D-3 | 2026-07-31 | The per-card "Resolve" dropdown on the last card in the console Duplicate Reviews list rendered off-screen / clipped at the viewport edge. | Dropdown now measures `getBoundingClientRect` on open and flips upward when a downward menu would overflow. | Manual verification; confirmed in the `console-09-duplicate-reviews.png` screenshot in this submission. |
| D-4 | 2026-07 (M2) | Signup email-confirmation links routed to the hosted Supabase project's default `localhost:3000` Site URL instead of the deployed app — confirmation was effectively broken in production. | Added an in-app `/auth/callback` screen, explicit `emailRedirectTo` + implicit-flow client config, a SPA rewrite in `citizen/vercel.json`, and corrected the hosted project's Site URL / redirect allowlist. | Commit `935ce24`; confirmed end-to-end signup flow works against the deployed URL. |
| D-5 | 2026-07 (M3) | The `Waves` Lucide icon (used for the Blocked Drain category) was renamed upstream, silently rendering a blank icon box in both apps. | Switched to the renamed `WavesHorizontal` icon. | Manual visual check, both apps. |
| D-6 | 2026-07 (M6) | The Leaflet map z-index sat below the slide-in console detail panel in some browsers, causing the background map to paint over and clip the panel's text. | Map wrapper given its own stacking context (`isolate`) so it can no longer bleed through a higher z-index sibling. | Manual visual check. |
| D-7 | 2026-07 (M6) | The inline step-2 location map conflated scrolling the page with panning the map, making it hard to use one-handed on mobile. | Replaced with a locked preview + full-screen `MapLocationModal` (fixed centre pin, citizen pans the map underneath, explicit Confirm). | Manual UX check; matches the "Uber-style" pattern used across the redesigned flow. |
| D-8 | 2026-07-23 | Seed data left `Crew Gamma` with a stale `member_count` of 3 while it actually had zero assigned members, after manual roster edits during seeding. | `manage-crews` gained a `resyncCount()` helper that recounts `profiles.crew_id` on every membership change instead of trusting a denormalised counter. | Verified against the corrected seed data. |
| D-9 | Ongoing, pre-existing | The Analytics screen's "Avg. resolution time" and "Resolved this week" figures were hardcoded placeholder values (3.4 days / +2), not computed from real data — a correctness gap rather than a crash, but one that would have shipped misleading numbers to an Administrator. | Replaced with a real computation over the `submitted → resolved` timestamp span and a rolling 7-day window (`console/src/lib/metrics.ts`, unit-tested — §2.2). | Rendered values checked against an independent direct-SQL computation at the time of the fix; the same logic is now covered by `metrics.test.ts`. |
| D-10 | 2026-08-12 (found during this testing pass) | An uploaded report photo cannot be deleted from Storage using the uploading citizen's own bearer token (`403 Access denied`), and direct SQL deletion of `storage.objects` is blocked by Supabase's own `protect_delete()` trigger — so any code path that needs to clean up an orphaned photo (a cancelled report, an abandoned duplicate-follow choice, or this testing pass's own test photo) cannot fully clean up client-side. | **Not yet fixed.** `follow-report`'s best-effort photo cleanup (§ NOTABLE_FEATURES.md, feature 5) already works around this using the edge function's service-role privileges rather than the client's; the same approach would need to be applied anywhere else client-side cleanup is attempted. Currently harmless (orphaned private-bucket objects, not publicly readable, small storage cost) but worth a scheduled janitor job — added to `docs/MAINTENANCE_AND_EVOLUTION.md`. | Reproduced live, 2026-08-12 (§3.4), consistent with a limitation the team had already independently discovered in earlier E2E testing (2026-07-31 session notes). |
| D-11 | Ongoing, not yet fixed | Every edge function sends `Access-Control-Allow-Origin: *`. Not independently exploitable (bearer-token auth isn't browser-auto-attached cross-origin), but a defense-in-depth gap flagged by an earlier automated security review of the follow-a-duplicate work. | **Not yet fixed** — tracked as backlog in `docs/TRACKER.md` and `docs/MAINTENANCE_AND_EVOLUTION.md`. | N/A — documented, not yet remediated. |

## 7. Performance Testing

**Not run this iteration.** `docs/srs/SRS.md` §5.1 defines concrete, measurable
targets (TTI ≤ 5 s on a 1 Mbps/250 ms 3G profile, API P95 ≤ 600 ms reads / 1500 ms
writes, 200 concurrent users sustained for an hour). None of these have been formally
measured against the deployed citizen app or the live backend. Recommended follow-up,
scoped for a team with more time rather than attempted half-heartedly here: Lighthouse
CI (or WebPageTest with a throttled 3G profile) against the deployed
`https://fixmycity-citizen.vercel.app` for NFR-001/002; a small k6 or Artillery script
driving `submit-report`/`transition-report` at increasing concurrency for
NFR-003/005. This is recorded as an explicit gap rather than presented as satisfied.

## 8. Usability Testing

**Not run this iteration**, for the same time-constraint reason as §7. NFR-030
(≥90% of first-time citizens complete a report in ≤90 seconds unaided) and NFR-033
(Flesch–Kincaid ≤ grade 8 on key screens) are both measurable with a small moderated
session and are recommended as the first usability-testing pass in
`docs/MAINTENANCE_AND_EVOLUTION.md`.

## 9. Requirements Coverage Summary

| Requirement theme | Live-verified this pass | Unit-tested | Not yet verified |
|---|---|---|---|
| AWMA jurisdiction gate (FR-012) | ✅ §3.1, §4 probe 10 | ✅ §2.1 | |
| State machine legality/audit (FR-051/052) | ✅ §3.2 | ✅ §2.2 | |
| Notification fan-out (FR-070/071) | ✅ §3.3 | | |
| RBAC / console-role carve-outs (FR-081/087) | | ✅ §2.2 | Live probe as a Dispatcher/Viewer account, not just Administrator |
| Follow-a-duplicate IDOR gate (NFR-016) | ✅ §4 probe 9 | | |
| Row-Level Security, all tables (NFR-013) | ✅ §4 probes 1–8 | | |
| Crew self-service start/resolve (FR-056) | | ✅ §2.2 | Live probe as an actual crew account |
| Performance targets (NFR-001–005) | | | ⬜ §7 |
| Usability targets (NFR-030–033) | | | ⬜ §8 |
| SLA configuration (FR-045/082) | N/A — not implemented, see SRS §9.4 | | |

## 10. Conclusion

Fifty automated unit tests pass cleanly across both applications, and — more
distinctively for a capstone testing report — the report's central architectural
claim (a server-enforced, fully-audited, fully-notified closed-loop workflow) was
verified **live against the production system**, not simulated: a real report was
pushed through every status in the state machine, its audit trail and notification
fan-out were confirmed row-for-row by direct database query, and it was cleaned up
afterward. Security posture (RLS, the IDOR fix, the jurisdiction gate, and the
inability to bypass the state machine with a direct table write) was independently
re-confirmed the same day, rather than taken on trust from earlier development notes.
Eleven real defects are logged with their fixes, two of which remain open and are
carried into `docs/MAINTENANCE_AND_EVOLUTION.md`. Performance and formal usability
testing are the two most significant gaps and are named as such rather than
glossed over.
