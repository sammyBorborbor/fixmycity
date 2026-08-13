# FixMyCity: Maintenance Strategy & Future Evolution Plan

CSCD 602 Capstone, Group Zero Down Time. This document is grounded in the project's
*actual* maintenance practice to date (the project's dated internal changelog, real git
history, and the defect log in *Testing_Report.pdf*) rather than a
generic textbook description of maintenance categories. Every example below really
happened.

## 1. Corrective Maintenance

Corrective maintenance (fixing defects in already-delivered functionality) has
been the most common category of change in this project. *Testing_Report.pdf*
§6 logs eleven real defects with dates, symptoms, and fixes; nine
are resolved, two remain open. Representative examples: the self-duplicate
resubmission bug (D-1, a citizen re-submitting a photo of their own already-open
report fell through the duplicate check), the fixed-centre Leaflet map silently
hiding pins outside its frame (D-2), and the Duplicate Reviews dropdown clipping off
the last card (D-3). The pattern in every case is the same: a defect is found (either
live-testing or normal use), the fix is scoped narrowly to the actual root cause, and
the fix is verified against the live system rather than assumed correct. See §5
(Bug-Fixing Process) below for the full workflow.

## 2. Adaptive Maintenance

Adaptive maintenance (changing the system to match a changed environment or
external dependency) has driven two of the project's largest changes:

- **The AI approach changed entirely.** The original design (the project's initial
  brief, and *SRS.pdf* v1.0) assumed an in-house classifier plus a
  PostGIS/pgvector duplicate-detection pipeline. Once a project teammate built a
  capable external computer-vision microservice, the team adapted `submit-report`
  and `check-duplicates` to integrate with it instead (via the anti-corruption
  adapter `_shared/image-model.ts`), rather than building a redundant in-house path.
  The pgvector schema was kept (dormant) rather than dropped, in case a future
  iteration needs a fallback or a complementary similarity signal.
- **The category set widened from 3 to 9** (2026-07-24) specifically to match the
  external CV vendor's own classification enum: an external dependency's shape
  changed the product's own scope, by team sign-off, documented in *SRS.pdf*
  §1.4 and the project's dated changelog.

## 3. Perfective Maintenance

Perfective maintenance (improving something that already works, without it being
broken) accounts for most of the console's recent history: table pagination (20
rows/page) added once the seeded dataset grew past a single screenful; follower-count
visibility surfaced in the Inbox and detail panel once the follow-a-duplicate feature
existed to make it meaningful; the hardcoded Analytics placeholder values (3.4 days /
+2) replaced with a real computation over the audit trail once the team had enough
seeded data to make the real numbers meaningful (D-9 in the Testing Report); the
Citizens directory added as a pure read-only convenience once staff needed to look up
a resident's report history without leaving the console.

## 4. Preventive Maintenance

Preventive maintenance (work done to reduce the likelihood of future defects rather
than to fix a known one) shows up most clearly in the security posture: stripping
blanket `authenticated`/`anon` table grants down to a narrow, explicit allowlist
(migration `20260707132647`) *before* any incident, not after; making
`status_transitions` physically append-only via a database trigger rather than
trusting application code to never issue an UPDATE; and the `duplicate_offers`
IDOR gate (see the Notable Implementation Features section of Project_Documentation.pdf, feature 6), which was designed in alongside the
follow-a-duplicate feature itself rather than retrofitted after a report of abuse.
*Testing_Report.pdf* §4 re-verified all of these live on 2026-08-12,
specifically to confirm preventive controls put in place weeks earlier are still
effective: a small, repeatable act of preventive maintenance in its own right.

## 5. Bug-Fixing Process

The observed (and recommended, going forward) process:

1. **Find**: either through manual use, a live end-to-end test (as in
   *Testing_Report.pdf* §3), or a teammate's report.
2. **Reproduce and scope**: confirm the defect against the live system (not a
   mock), and identify the narrowest correct fix rather than a broad rewrite.
3. **Fix and verify live**: apply the fix, then re-test against the real backend.
   The Notable Implementation Features section of Project_Documentation.pdf explicitly marks claims **"Verified"** only when this
   step happened, which is a discipline worth continuing.
4. **Record**: a dated entry in the project's "Recent changes" changelog, with
   enough detail (symptom, root cause, fix, verification) that a defect log like
   *Testing_Report.pdf* §6 can be reconstructed from it later, as this
   document's Testing Report literally was.
5. **Commit**: a small, focused commit with a plain-imperative message describing
   the *why*, per the team's established commit convention.

**Recommended addition:** a lightweight issue tracker (even GitHub Issues on the
existing repo) once the team grows past the current informal single-file-changelog
approach. The changelog works well for a single active repo owner but doesn't scale
to concurrent work by multiple people without collision.

## 6. Version Control

Git, hosted on GitHub (`https://github.com/sammyBorborbor/fixmycity`), with
conventions the team has followed throughout: small reviewable commits, plain-imperative
subject lines, no emoji/unicode noise, no AI-attribution trailers. **Honest note:**
the repository currently works on a single `master` branch with direct commits. No
feature-branch/PR review workflow exists yet. For a 6-person group this is a real
scalability gap for version control practice, not just a nice-to-have; recommended
next step is short-lived feature branches with at least one teammate's review before
merge, once GitHub Actions CI (§9) exists to run automatically on that PR.

## 7. Dependency / Library Updates

Both apps pin React 19.2, Vite 8, and TypeScript in strict mode; `supabase` is a
root devDependency at a pinned version. **No automated dependency-update tooling
(Dependabot / Renovate) is configured yet**: a gap, since a capstone timeline
naturally means dependencies were chosen once and not revisited. Recommended:
enable Dependabot on the GitHub repo (zero-config for a public repo) for security
advisories at minimum, and schedule a manual `yarn outdated` pass each semester the
project continues to be maintained.

## 8. Security Updates

Beyond the live-verified controls in *Testing_Report.pdf* §4, two real
gaps are worth carrying forward honestly rather than glossed over:

- **`supabase/seed/demo-users.sql` contains plaintext demo passwords**
  (`FixMyCity2026!` and `password`), committed to a public GitHub repository, and
  those exact passwords are live on the hosted demo project used for grading. This
  is an accepted, deliberate trade-off for a capstone pilot (the whole point of a
  seed script is discoverable demo access), but it is a real credential-exposure
  pattern that would need to change before any production use beyond the pilot:
  e.g. generating random per-seed-run passwords and distributing them out-of-band,
  the way this submission's own `Links.txt` was kept out of the repository (see
  the project's own deployment notes and this document's own §5 discipline of not
  repeating credentials in public documents).
- **CORS is wildcard-open (`Access-Control-Allow-Origin: *`) on every edge
  function** (D-11 in the Testing Report). Not independently exploitable today
  (bearer-token auth isn't browser-auto-attached cross-origin), but flagged
  defense-in-depth work: restrict to the two known app origins, consistently across
  all ten functions in one pass rather than piecemeal.

## 9. Scalability

*SRS.pdf* NFR-060/061 target 2,000 concurrent users and 2,000 reports/day
with no schema redesign, and ~180 GB of photo storage over 12 months at pilot scale.
The architecture is favourably positioned for this: edge functions are stateless
(horizontal scaling is a platform concern, not an application one), Postgres is the
only stateful component and Supabase supports read replicas and connection pooling
without an application change, and object storage scales independently of the
database. **Not yet load-tested** (§7 of the Testing Report): recommended first step
if the pilot expands is a k6/Artillery run against `submit-report` and
`transition-report` at increasing concurrency, before assuming the NFR targets hold.

## 10. Future Features

Prioritised from the project's existing backlog and *SRS.pdf*'s
honestly-flagged gaps (§9.4, Appendix B.6), highest-value first:

1. **Category/SLA configuration** (SRS FR-045/072/082): replace the fixed
   `report_category` enum with a real `categories` table carrying `sla_hours`, and
   surface SLA-breach flags in the Inbox. The most-referenced unimplemented
   requirement in the SRS.
2. **Offline report queueing**: the citizen PWA currently caches the app shell but
   not report data; a citizen who loses connectivity mid-submission loses the draft.
3. **FCM web push**: currently realtime (in-app) + email cover notifications;
   push would close the gap for a citizen who isn't actively looking at the app.
4. **Deno edge-function tests + Playwright E2E**: the current suite is Vitest unit
   tests only (§2 of the Testing Report); the live-probe methodology in §3–4 of the
   Testing Report is a reasonable template for what an automated E2E suite should
   assert.
5. **GitHub Actions CI**: run the Vitest suites (and, once built, the E2E suite)
   automatically on every push/PR.
6. **The six Should-have FRs a code audit confirmed were never built**
   (*Testing_Report.pdf* §5.2): crew reassignment on an Assigned report (FR-054),
   CSV export for Administrators (FR-085), a per-crew productivity view (FR-092), a
   geographic hotspot/cluster view (FR-091), follow-up comments on an open report
   (FR-023), and citizen account deletion with anonymisation (FR-007). None of the
   six is difficult in isolation; they're grouped here because they were simply
   deprioritised against the Must-have list within the capstone timeline, not
   because of any technical blocker.
7. **A public map route that doesn't require sign-in** (FR-033): the Map screen is
   currently wrapped in the same `RequireAuth` guard as the rest of the citizen app,
   which is the opposite of what the SRS specifies and the more defensible product
   decision (a public, unauthenticated map is meant to build civic trust). Splitting
   the router so `/map` sits outside the guard is a small, low-risk change.
8. **An all-time "total resolved" figure on the Analytics dashboard** (FR-090):
   currently only a resolved-this-week count is computed; the underlying data is
   already there, this is a small addition to `metrics.ts`.

## 11. Technology Migration

No urgent migration is needed. The current stack (Supabase, Vite/React, Vercel) is
portable and was chosen partly for that reason (*SRS.pdf* NFR-051). Two
migrations worth naming as *options*, not commitments: moving the citizen app to a
server-rendered framework (e.g. Next.js) if SEO/public-marketing pages become a
priority beyond the installable PWA; and, if the external CV vendor relationship
ever ends, reviving the dormant pgvector/PostGIS duplicate-detection path already
present in the schema as a same-day fallback rather than a from-scratch rebuild.
This is precisely why that path was kept rather than dropped during the CV vendor
integration (§2 above).

## 12. Future Integration with Other Systems

Carried forward from *SRS.pdf* Appendix B, unchanged in substance:
Electricity Company of Ghana (ECG) and Ghana Water Company Limited (GWCL) ticketing
integrations for streetlight/water issues that cross jurisdictional boundaries;
SMS/USSD intake for residents without smartphone data access; a public read-only API
for civic-media/watchdog dashboards; and multi-MMDA federation, which would be the
project's largest architectural change (introducing MMDA as a tenant boundary
throughout the schema and both apps) and the one most likely to justify a genuine
technology migration rather than an incremental feature.

## 13. Possible AI / Emerging-Technology Enhancements

- **Restore a stateless classify endpoint** so the citizen app can pre-fill a
  suggested category *before* submission (currently `classify-image` is a dormant
  501 stub, since classification only happens at submit time now).
- **A `streetlight` class from the CV vendor**, closing the current safeguard that
  exempts streetlight/other photos from the not-environmental check because the
  model has no class for them.
- **A stateless duplicate-relevance chatbot for citizens** ("is this the same as an
  existing report near you?") as a lighter-weight alternative to the current
  submit-time blocking flow, for categories the CV service doesn't fully cover.
- **LLM-assisted triage summaries** for Reports Officers: a one-line summary of a
  report's description + photo context in the Inbox, to speed up triage of the
  current text-only table view.
- **On-device photo quality/compression checks** before upload, reducing wasted
  bandwidth on photos that would fail the CV service's environmental check anyway,
  particularly relevant given the project's explicit 3G/mid-range-Android targeting
  (*SRS.pdf* NFR-001).

## 14. Future Evolution Roadmap

| Horizon | Focus |
|---|---|
| **Near-term** (next iteration) | Category/SLA configuration; GitHub Actions CI + Dependabot; CORS hardening across all edge functions; Deno/Playwright test coverage; formal performance and usability testing passes (both flagged as gaps in the Testing Report). |
| **Mid-term** | Offline report queueing; FCM web push; bulk console operations; a stateless classify endpoint restored; multi-language support (Twi, Ga, Ewe) per SRS Appendix B.2. |
| **Long-term** | SMS/USSD intake; native/dedicated Field Crew app; ECG/GWCL ticketing integrations; multi-MMDA federation (the project's largest possible architectural expansion); a public read-only API. |

Each horizon deliberately builds on what's already shipped rather than replacing it:
the closed-loop state machine, RLS posture, and anti-corruption CV adapter are
treated as stable foundations the roadmap extends, not rewrites.
