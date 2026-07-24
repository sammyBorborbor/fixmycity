# FixMyCity — Project Tracker

Single source of truth for **what's built, what's in flight, and what's left**. Organised by
the 6-milestone build order in [CLAUDE.md](../CLAUDE.md). When you finish or start work,
update the relevant line here.

> Note: the top-level [README.md](../README.md) is currently stale (it still describes an
> in-memory demo store and "any password works"). This tracker reflects the real state.

**Pilot scope (locked):** Ayawaso West Municipal Assembly (AWMA) · 3 categories (Illegal
Dumping, Blocked Drain, Broken Streetlight) · 4 roles (Citizen, Officer, Field Crew,
Administrator) · Progressive Web App.

**Last updated:** 2026-07-24

**Legend:** ✅ Done · 🟡 Partial / in progress · ⬜ Not started · 🔒 Blocked (reason given)

---

## Progress at a glance

| Milestone | Status |
| --- | --- |
| M1 — Schema + RLS + seed | ✅ (seed file missing) |
| M2 — Auth + citizen submission end-to-end | ✅ |
| M3 — State machine + console wiring | ✅ |
| M4 — Notifications (realtime + email) | ✅ (no web push) |
| M5 — AI features (classify + duplicates) | 🟡 integrated with external CV API (submit-time); needs live-contract confirmation |
| M6 — PWA + Leaflet maps + deploy | ✅ / 🟡 (offline shell-only) |

---

## M1 — Database schema, RLS & seed

✅ **16 migrations applied** (`supabase/migrations/`):

- Full schema: `crews`, `profiles`, `reports`, `status_transitions`, `notifications`.
- Enums: `user_role`, `profile_status`, `report_category`, `report_status` (7 states),
  `crew_department`.
- Extensions: **PostGIS** and **pgvector** (`vector(512)` embeddings, HNSW index).
- Row Level Security on all 5 public tables (reporter-owns / staff-read-all /
  crew-reads-assigned / notifications read+mark-read). **No client INSERT anywhere** — all
  writes go through edge functions.
- Reference generator trigger (`FMC-YYYY-NNNN`, sequence starts at 500).
- Append-only trigger on `status_transitions` (blocks UPDATE/DELETE, even service role).
- `handle_new_user()` signup trigger creates a profile row.
- Private `report-photos` storage bucket with per-folder + staff-read policies.
- Generated `lat`/`lng` columns on `reports` (from the `geography` point) for the maps.

🟡 **Gap:** `config.toml` expects `supabase/seed.sql` (`[db.seed] enabled = true`) but the
**seed file does not exist**. Sequence starting at 500 was reserved for seed refs.

---

## M2 — Auth & citizen report submission (end-to-end)

✅ **Email/password auth, both apps** (`*/src/lib/store.tsx`):

- Citizen: `signIn` / `signUp` (email confirmation via `/auth/callback`) / `signOut`,
  session bootstrap + `onAuthStateChange`.
- Console: role-gated — `officer` / `admin` get the office console, `crew` get a restricted
  `/my-reports` shell; `citizen` and suspended accounts are signed back out (see M3 RBAC)
  with a "staff only" message. No sign-up (staff invited).

✅ **Citizen submission is live end-to-end:** capture **1–5 photos** (camera or gallery
multi-select) → compress each to WebP → upload to `report-photos` bucket → invoke
`submit-report` edge function (validates array length 1–5, per-path ownership + existence) →
validated row (`photo_urls text[]`) + initial `submitted` transition + returned reference
number. 3-step `ReportFlow` UI. Photos shown as a main image + thumbnail strip in the report
detail (citizen + console) and a first-photo thumbnail in list cards. The AI category
suggestion runs on the first photo.

✅ **AWMA jurisdiction gate:** reports must fall inside Ayawaso West. `submit-report` rejects
out-of-bounds points server-side (`422 { code: 'outside_awma' }`) against the real OSM admin
polygon (relation 12759086, committed at `data/awma-boundary.geojson`) widened by a ~500 m
edge tolerance — the raw polygon excludes 3 of the 8 pilot neighbourhoods (Abelemkpe, Airport
Residential, Roman Ridge) by 100–400 m. Shared `pointInAwma` helper (ray-cast + point-to-edge
distance) in `supabase/functions/_shared/awma-boundary.ts` and `citizen/src/lib/awma-boundary.ts`
(byte-identical, generated from the GeoJSON). The citizen `ReportFlow` also warns + disables
Submit when the pin leaves AWMA; the server stays the source of truth. Unit-tested (Vitest, now
set up in the citizen app too): all 8 neighbourhoods pass, out-of-area points fail.

✅ **Email confirmation redirect fixed & committed** (`935ce24`): signup verification links
were routing to the hosted project's default `localhost:3000` Site URL. Now `signUp` passes
`emailRedirectTo` → an in-app `/auth/callback` screen (`citizen/src/screens/AuthCallback.tsx`),
with explicit `detectSessionInUrl` / implicit-flow client config and a `citizen/vercel.json`
SPA rewrite so the route resolves in production. Hosted dashboard configured: Site URL →
`https://fixmycity-citizen.vercel.app`, `/auth/callback` redirect allowlist (prod + preview
wildcard + localhost), and Resend wired as **Auth Custom SMTP** so confirmation emails deliver
from `fixmycity@aseda-pos.byte24systems.com` instead of the rate-limited default sender.

✅ **Branded auth email templates** (`supabase/templates/confirmation.html` + `recovery.html`,
wired in `config.toml`): table-based, email-client-safe HTML matching the FixMyCity brand
(navy→blue header, white card, gold bulletproof CTA, plaintext fallback link). Replaces
Supabase's plain default. Applied to the hosted project via the dashboard (Confirm signup +
Reset Password templates).

✅ **Forgot-password / reset flow** (`84b30af`): login "Forgot password?" view sends a reset
email (`resetPasswordForEmail`); the recovery link lands on a new `/reset-password` screen
(`citizen/src/screens/ResetPassword.tsx`) that requires a valid recovery session and calls
`updateUser` to set the new password (invalid/expired state otherwise). Store gains
`sendPasswordReset` + `updatePassword`. **Dashboard TODO:** add `/reset-password` (prod +
preview wildcard + `http://localhost:5173/reset-password`) to the Supabase redirect allowlist.

---

## M3 — State machine & console wiring

✅ **`transition-report` fully implemented server-side** (the one place statuses change):

- Staff actions: `acknowledge`, `assign` (validates crew exists + available), `reject`
  (reason required; optional `duplicate_of_report_id` link), `start`, `resolve`.
- Citizen action: `reopen` (reporter only, from `resolved`, within a 7-day window).
- Each transition validates legality, writes exactly one audit row, reverts status on audit
  failure, returns 400/403/409 appropriately.

✅ **Citizen cancellation** (`cancel-report` edge function): a reporter may withdraw their own
report while it is still `submitted` (before acknowledgement). Implemented as a hard delete —
removes the stored photos, then deletes the report (FK cascade clears its transitions +
notifications). Note: this deviates from the strict append-only/closed-loop ideal (the record
is removed, not retained as a terminal state) — chosen deliberately as a lightweight withdrawal.
Required relaxing the `status_transitions` append-only trigger to UPDATE-only so the cascade
delete can proceed (content stays immutable; no client DELETE policy exists).

✅ **Console wired to live data:** Inbox (filter chips + table), slide-in `DetailPanel`
(status-gated action bar), Assignments, MapView, Analytics, Audit Log — all computed from
the live `reports` + joined `status_transitions`.

✅ **Users & Roles is real** (`manage-users` edge function, admin-gated): invite staff via
`inviteUserByEmail` with a branded set-password email landing on the console `/set-password`
screen; change role; suspend/reactivate (suspended staff are rejected at login). Adds
`console_role` / `unit` / `email` to `profiles`.

✅ **Crew membership is real** (`manage-crews` edge function, staff-gated): crew members are
`role='crew'` users invited under the new **Field Crew** role; the Crews page assigns / moves /
removes them (writing `profiles.crew_id`) and sends a branded crew-assignment email + in-app
notification. Crew *create* + availability toggle are now persisted too (`manage-crews`
`create_crew` / `set_availability`).

✅ **Role-based access control (front-end + server-side).** A single `permsFor(role)` table in the
console store drives the nav, per-route guards, and the `DetailPanel` action bar, and is re-checked
in the edge functions so it can't be bypassed. Matrix: Administrator = everything incl. Users;
Supervisor = all but Users; Officer = triage (Inbox/Map/Assignments + full report actions);
Dispatcher = Inbox/Map/Assignments/Crews, acknowledge+assign only; Viewer = read-only. `transition-report`
enforces the per-`console_role` action set; `manage-crews` is limited to Administrator/Supervisor/Dispatcher.
**Field crew now sign in** to a restricted `/my-reports` shell showing only their assigned reports
(RLS-enforced).

✅ **Crew status updates (FR-061).** From `/my-reports`, field crew mark their own assigned reports
**Assigned → In Progress → Resolved** (`transition-report` allows `role='crew'` to `start`/`resolve`
only when `assigned_crew_id` = their crew; acknowledge/assign/reject stay office-only). Each crew
transition writes the audit row and notifies/emails the citizen like any other, closing the loop.

---

## M4 — Notifications (closes the loop)

✅ **In-app realtime:** migration adds `notifications` + `reports` to the realtime
publication; citizen subscribes to its notifications, console subscribes to all report
changes (both debounced-refetch).

✅ **Email via Resend:** `transition-report` sends inline-styled, XSS-escaped HTML + text
emails keyed by the new status. Fail-soft if `RESEND_API_KEY` is missing.

⬜ **Web push (FCM):** not implemented — **by design** per CLAUDE.md, realtime + email are
the fallback this iteration.

---

## M5 — AI features

🟡 **Integrated with the teammate's external CV service (the "DID Backend").** That service
is stateful and owns classification + duplicate detection: `submit-report` POSTs the main
photo to `POST /api/v1/reports`, and the service stores the image in its own container,
dedupes it (perceptual hash) against everything there, validates it's a genuine
environmental concern, and returns the verdicts. `_shared/image-model.ts` is now the
anti-corruption client that translates its vocabulary to ours.

- **Auto-categorisation:** runs server-side at submission time. The CV `cv_inferred_category`
  is mapped to our 3 categories and stored on the report (`ai_suggested_category` /
  `ai_confidence`), shown to officers in the console DetailPanel. The pre-submission "AI
  suggests X / Use this" chip is **removed** (the CV service has no stateless classify
  endpoint); `classify-image` is kept but dormant (returns 501).
- **Validity gate:** a "not an environmental concern" verdict (selfie/junk) **blocks
  submission** with a retake message (input validation) — except for `streetlight`, which
  the CV model has no class for and can't judge (safeguard in `submit-report`).
- **Duplicate detection** (`check-duplicates`): officer/admin-only; now proxies the CV
  service's own `GET /api/v1/reports/{id}/duplicates` and maps its integer ids back to our
  rows via `reports.external_report_id`. The pgvector `find_duplicate_candidates()` path is
  **dormant** (columns/index kept, not dropped). Surfaced unchanged as the console
  "possible duplicate" chips, feeds reject-as-duplicate.
- **Schema:** migration `20260715120000_external_cv_api.sql` adds `external_report_id`,
  `duplicate_status`, `detected_objects`, `perceptual_hash` to `reports`.
- **Config:** `IMAGE_MODEL_URL` = the CV API base URL; `IMAGE_MODEL_API_KEY` optional.

✅ **Follow-a-duplicate (citizen-facing dedup).** When the CV service flags a citizen's
submission as a strong duplicate (`duplicate_status = 'duplicate'`) of an existing report,
`submit-report` does **not** create a report — it returns the candidate and the citizen
chooses on the confirmation screen: **Follow it** (subscribe, no duplicate filed) or **submit
anyway** (`force_create` re-call that skips the CV step). A report is now many-to-many with
citizens via the new `report_followers` join table (migration
`20260720120000_report_followers.sql`), and `transition-report` fans out every status
notification + email to the reporter **plus all followers**. New `follow-report` /
`unfollow-report` edge functions (service-role; `follow-report` also cleans up the orphaned
uploaded photos, since the browser has no storage-DELETE policy). **Follow is offer-gated**
(migration `20260720123000_duplicate_offers.sql`): `submit-report` records that it offered a
candidate to a user, and `follow-report` rejects any `report_id` that wasn't offered — so a
citizen can't follow an arbitrary report to read its contents (IDOR guard). Privacy (Act 843): a
follower reads the full followed report but never the owner's identity (profiles are
read-own/staff-only under RLS); a denormalised `reports.follower_count` shows "N following"
without exposing who. Citizen UI: duplicate-choice view in `ReportFlow`, "Following" pill in
My Reports, follower count + Unfollow on the detail screen (reporter-only Reopen/Cancel hidden
on followed reports). **Known limitation:** on the follow path the CV corpus keeps an orphaned
external report (the service exposes no delete endpoint) — harmless dedup-corpus noise.

**Still to confirm against the live service (see `TODO(cv-api)` in `_shared/image-model.ts`):**
(1) the exact "not environmental" signal — we currently read the returned report's
`status === 'rejected'`; (2) that `duplicate_of_report_id` / `/duplicates` use the CV
service's own integer ids; (3) whether a `streetlight` class can be added; (4) a **stable
host** (the dev URL is an ngrok tunnel that rotates); (5) optionally a stateless
`POST /classify` to restore the pre-fill chip.

---

## M6 — PWA, maps & deploy

✅ **Citizen PWA:** `vite-plugin-pwa` (`autoUpdate`), complete manifest (192/512 any +
maskable icons, standalone, portrait), iOS install meta, offline **app-shell**
(`navigateFallback: /index.html`).

✅ **Mobile install prompt** (`6ddc3dc`): dismissible `InstallPrompt` banner on the citizen
login + home screens — one-tap "Install app" on Android (via a captured `beforeinstallprompt`
event stashed at startup in `lib/installPrompt.ts`), Add-to-Home-Screen hint on iOS.
Mobile-only, hidden once installed, dismissible for the session (`sessionStorage`).

✅ **Leaflet / OpenStreetMap maps, both apps:** shared `LeafletMap` (status-coloured pins),
citizen `LocationPicker` (geolocate-on-mount, nearest-neighbourhood auto-select, debounced
Nominatim reverse-geocode as a display hint). The picker is now a compact **non-interactive
preview** that opens a **full-screen `MapLocationModal`** on tap — a fixed centre pin the
citizen moves the map under (Uber-style), with a draft-then-Confirm commit and the AWMA
jurisdiction gate. Removes the old inline-map scroll-vs-pan conflict. The picker also has a
**place-search type-ahead** (Nominatim `/search`, Ghana + Accra viewbox, debounced) so a
citizen can type a landmark and jump the map there — no Google Places, no API key.

🟡 **Offline is shell-only** — no `runtimeCaching` for the Supabase host, so no offline data
or report queueing (network required for all API/storage calls).

- Console has **no PWA** (intentional — desktop tool).
- `citizen/vercel.json` SPA rewrite present; console has none. **Citizen deployed** to
  `https://fixmycity-citizen.vercel.app`; console not yet deployed.

---

## Known gaps — console demo-only (not persisted)

These UIs work but mutate session-local state only (labelled in `console/src/lib/store.tsx`):

- **Settings security section** — 2FA / active-sessions / password-change are static UI (no
  backend). The *preferences* (notification toggles, compact inbox, default filter) are persisted.

## Cross-cutting / tech debt

- **Tests** — console has a Vitest unit suite (`console/`, `yarn test`) covering the RBAC matrix
  (`permsFor`), the report action-availability rules (`reportActions`), Analytics resolution
  metrics, and store helpers. Still missing: edge-function (Deno) tests for the state machine and
  Playwright E2E.
- Citizen `Profile` notification/push toggles are local-only (not persisted).
- **CORS hardening across edge functions.** Every edge function sends
  `Access-Control-Allow-Origin: *`. Not independently exploitable today (auth is a bearer JWT in
  the `Authorization` header, which browsers never auto-attach cross-origin — so a malicious site
  can't forge an authenticated request for a victim), but a team-wide pass should restrict the
  allowed origin to the citizen/console app origins (e.g. `https://fixmycity-citizen.vercel.app`)
  as defense-in-depth. Do it consistently across ALL functions, not one-off. Flagged by the
  automated security review of the follow-a-duplicate work.
- **Manual hosted-project config (staff invite).** `supabase/config.toml` + `supabase/templates/`
  are the source of truth, but the hosted project applies auth email templates and the redirect
  allow-list via the dashboard. For the invite click-through to work end-to-end, add on the hosted
  project: (1) the branded **Invite** email template (`templates/invite.html`), and (2)
  `http://localhost:5174/set-password` + the deployed console URL's `/set-password` to the redirect
  allow-list. Same applies to the console once it's deployed to Vercel.

---

## What's left (prioritised backlog)

- [x] Fix + commit the signup email-confirmation `/auth/callback` redirect (M2).
- [x] Brand the confirm-signup + password-reset auth email templates (M2).
- [x] Wire the citizen "Forgot password?" flow: `resetPasswordForEmail` + `/reset-password`
  update-password screen (needs `/reset-password` added to the Supabase redirect allowlist).
- [~] External CV API wired into `_shared/image-model.ts` (submit-time classify + dedup + validity, M5).
  Remaining: confirm the live contract (invalid-photo signal, id semantics), a `streetlight` class,
  and a stable host — see M5 `TODO(cv-api)`.
- [ ] Add `supabase/seed.sql` (config already expects it) (M1). Live demo population now
  exists separately: `supabase/seed/demo-users.sql` (35 accounts across two blocks;
  block 1 = 19 applied 2026-07-23, block 2 = 16 back-dated citizens applied 2026-07-24).
- [x] Persist console Users & Roles (real invite + role/suspend via `manage-users` edge function).
- [x] Persist console Crew create + availability toggle, Settings prefs, Profile (name/phone).
- [x] Compute real Analytics values (avg resolution time, resolved-this-week week-over-week delta).
- [x] Wire the console search box (jump-to-report by reference / location / category / reporter).
- [ ] Decide on / implement FCM web push (optional — email is the fallback).
- [ ] Offline report queueing (runtimeCaching / background sync) for the citizen PWA.
- [~] Test suite: Vitest unit tests done (console pure logic); edge-function (Deno) + Playwright E2E left.
- [ ] Deploy the console to Vercel (citizen is live); set up GitHub Actions CI.
- [ ] Refresh the stale top-level README.
- [ ] Restrict `Access-Control-Allow-Origin` on all edge functions to the app origins
  (defense-in-depth; see Cross-cutting / tech debt).

---

## Recent changes (newest first)

Distilled from git history:

1. Demo citizen list padded out for the Friday demo: a second `DO` block appended to
   `supabase/seed/demo-users.sql` adds 16 more **citizen** accounts (35 total in the file)
   with join dates **back-dated** randomly across the last 21 days (per-row
   `now() - random()*interval '21 days'`, applied to `auth.users`, `auth.identities`, and an
   override of the trigger-stamped `profiles.created_at`). New batch uses password `password`;
   the original 19 keep `FixMyCity2026!` and are untouched. Emails extend the plus-addressing
   pattern (`trialweb4/sammyborborbor/devsammy20 +7..+12`) plus `sammyowusu+1@hotmail.com`.
   Idempotent (skips existing emails). Applied to the live project 2026-07-24; verified 16
   rows with scattered dates and password login for the hotmail + a gmail account.
2. Resolve-as-dropdown on the console **Duplicate Reviews** screen. The single Resolve button
   is now a dropdown (reusing TopHeader's account-menu pattern) listing all four CV
   `DuplicateStatus` values — Duplicate, Possible duplicate, Supporting evidence, and
   **Reject (not a duplicate)** which maps to the API's `new`. Picking one pre-fills the
   existing confirm form (resolution shown read-only; "Duplicate of" now only appears for
   duplicate-type resolutions). Front-end only (`console/src/screens/DuplicateReviews.tsx`);
   no edge-function/store change — `new` was already in the `CV_RESOLUTIONS` allowlist and
   `resolveDuplicateReview` forwards the value unchanged through the `duplicate-reviews` proxy.
2. Demo population seeded into the live project via `supabase/seed/demo-users.sql`
   (2026-07-23): 19 confirmed accounts — 6 citizens, 4 console staff (spec names:
   Kofi Mensah Supervisor, Ama Darko Officer, Nii Lartey Dispatcher, Efua Sarpong
   suspended), 9 field-crew members (3 each in Crews Alpha/Beta/Gamma, leads matching
   `crews.lead_name`); `member_count` resynced (fixed Crew Gamma's stale 3-with-no-members).
   Emails are plus-addressed over three real inboxes (`trialweb4+N`, `sammyborborbor+N`,
   `devsammy20+N` @gmail.com); shared demo password. Idempotent (skips existing emails);
   login verified via the auth REST API for citizen, crew, and dispatcher accounts.
2. Place-search type-ahead in the full-screen location picker. New `searchPlaces()` in
   `citizen/src/lib/geo.ts` calls the same free OpenStreetMap Nominatim service as the
   reverse-geocode (forward `/search`, `countrycodes=gh` + padded AWMA `viewbox` + `bounded=1`,
   debounced, fail-soft). A search box in `MapLocationModal` shows suggestions; picking one
   calls `map.setView(...)`, whose `moveend` reuses the existing draft-position + reverse-geocode
   + `pointInAwma` flow. Zoom control moved to bottom-left so the search bar doesn't cover it.
   Deliberately NOT Google Places (would need a paid API key + Google tiles, against the locked
   design). No new env var, no state-machine/submit change.

2. Full-screen location picker for the citizen report flow. The step-2 map is now a compact,
   locked preview (fixed centre pin + "Tap to adjust on map" chip); tapping it opens a new
   full-screen `MapLocationModal` where the citizen moves the map under a stationary pin,
   sees a live "Near: ..." address, and taps "Confirm location". New `CenterPin` overlay
   shared by preview + modal. The modal renders through a `createPortal` to `document.body`
   to escape the form's `fade-up` transform (which would otherwise trap the `fixed` overlay).
   Reuses the existing nearest-neighbourhood, reverse-geocode, and `pointInAwma` gate logic;
   no state-machine or submit-payload change.

3. Follow-a-duplicate (multi-follower notifications). When the CV service flags a submission as
   a strong duplicate, `submit-report` returns the existing report as a candidate instead of
   filing a new one, and the citizen chooses to follow it or submit anyway (`force_create`).
   New `report_followers` join table + `reports.follower_count` counter (migration
   `20260720120000_report_followers.sql`), a follower SELECT policy on `reports`, and new
   `follow-report` / `unfollow-report` edge functions. `transition-report` now fans out every
   notification + email to the reporter plus all followers. Citizen UI: duplicate-choice screen,
   "Following" pill, follower count + Unfollow. Owner identity stays hidden (RLS); only the
   aggregate count is shown. Known limitation: orphaned CV external report on the follow path.

1. AWMA jurisdiction gate on report location. `submit-report` now rejects any point outside
   Ayawaso West (`422 outside_awma`) against the real OSM boundary polygon
   (`data/awma-boundary.geojson`) + a ~500 m tolerance so all 8 pilot neighbourhoods still
   qualify. New shared `pointInAwma` helper (client + edge copies, generated from the GeoJSON),
   citizen `ReportFlow` warn + Submit-disable when the pin is outside, and Vitest set up in the
   citizen app with unit tests for the boundary. Replaces the old loose Greater-Accra bbox.

2. Console Users & Roles UX: role changes and suspends now go through a reusable
   confirm dialog (`console/src/components/ConfirmDialog.tsx`) before firing, and every
   action reports its outcome via a new app-wide toast host (`console/src/components/Toast.tsx`,
   mounted in `main.tsx`) — success ("X is now an Administrator" / "suspended" /
   "Invite sent to …") and errors alike. Added per-row "Saving…" busy state, a "You" chip
   on the admin's own row, and moved invite errors inline. No store/edge-function changes.

2. Integrated the teammate's external CV service (the "DID Backend") for M5. `submit-report` now
   POSTs the main photo to the service, which classifies it, dedupes it, and validates it's an
   environmental concern; a "not environmental" verdict blocks submission with a retake message
   (streetlight exempted). `check-duplicates` proxies the service's own `/duplicates`; the pgvector
   path is dormant. New migration adds `external_report_id` / `duplicate_status` / `detected_objects`
   / `perceptual_hash`. The pre-submission classify chip was removed (`classify-image` kept but
   dormant). `_shared/image-model.ts` rewritten as the CV-API anti-corruption client. Several live
   contract details still need teammate confirmation (see M5).
2. Inbox gains category / area / assigned-crew dropdown filters that combine with the status chips
   (chip counts reflect the active dropdowns); a "Clear filters" reset and a live "N shown" count.
2. Map screen fills the viewport height (was a fixed 460px), and fixed a Leaflet z-index bug where
   the background map painted over the slide-in detail panel (clipping its text) — the map wrapper
   now `isolate`s its stacking context.
2. Wired the console TopHeader search: type a reference / location / category / reporter to get a
   live dropdown of matching reports; picking one opens its detail panel from any page. Also fixed
   the account chip + menu to show the logged-in user instead of hardcoded "Akua O.".
2. Test suite (console Vitest, `yarn test`): 37 unit tests over the RBAC matrix (`permsFor`), the
   report action-availability rules, Analytics resolution metrics, and store helpers. Extracted two
   inline computations into pure, testable modules (`lib/metrics.ts`, `lib/reportActions.ts`) and
   refactored Analytics/DetailPanel to use them. Edge-function (Deno) + Playwright E2E still to do.
2. Persisted the last demo-only console bits. Crew **create** + **availability toggle** are real
   (new `manage-crews` create_crew / set_availability, staff-gated; create restricted to the 3
   department enum values). **Profile** is rewired to the logged-in user with name/phone editable +
   persisted (client update grant). **Settings** preferences persist to a new `profiles.settings`
   jsonb, and two are wired to behavior — the Inbox opens on the saved default filter and honors
   compact rows. Security section (2FA/sessions) stays static. Migration
   `20260710120000_profile_settings.sql`.
2. Real Analytics: the "Avg. resolution time" and "Resolved this week / vs last week" KPIs are now
   computed from the live status timeline (submitted→resolved span; 7-day windows) instead of the
   hardcoded 3.4d / +2. Verified the rendered values match a direct SQL computation.
2. Crew status updates (FR-061): from the `/my-reports` shell, field crew mark their own assigned
   reports Assigned → In Progress → Resolved. `transition-report` lets `role='crew'` `start`/`resolve`
   only when the report's `assigned_crew_id` matches their crew (acknowledge/assign/reject stay
   office-only); each transition notifies/emails the citizen. Verified in the UI + direct-API 403s.
2. Role-based access control (front-end + server-side). A single `permsFor(role)` table in the
   console store gates the nav, per-route guards, and the report action bar, and is re-checked in the
   edge functions so it can't be bypassed: `transition-report` enforces the per-`console_role` action
   set (Dispatcher = acknowledge/assign only, Viewer = none) and `manage-crews` is limited to
   Administrator/Supervisor/Dispatcher. Field crew now sign in to a restricted `/my-reports`
   shell showing only their assigned reports (read-only at this point; FR-061 updates landed next —
   see entry 1). Verified per-role in the UI and via direct-API 403s.
2. Crew members are now real users. Added a **Field Crew** console role (invited via Users & Roles
   as `role='crew'`, created silently with no set-password link since there's no crew app yet). The
   Crews page loads real rosters from `profiles.crew_id`; a new admin/officer-gated `manage-crews`
   edge function handles assign / move / remove / set-lead, and assigning or moving a member sends a
   branded Resend email + in-app notification and resyncs `crews.member_count`. Migration
   `20260709130000_crew_console_role.sql` allows the new console_role. Crew create + availability
   toggle stay demo.
2. Staff invite flow finished: branded `supabase/templates/invite.html`, the invite email now
   redirects to a new console `/set-password` screen (public route) where the invited staffer sets
   their password, and the invite Unit field is a dropdown. Needs a manual hosted-project step —
   see "Manual hosted-project config" below.
2. Console Users & Roles is now real: new `manage-users` edge function (admin-gated) invites staff
   via `inviteUserByEmail` and persists role / suspend changes; `profiles` gained `console_role`,
   `unit`, `email` columns (migration `20260709120000_staff_directory.sql`); the console loads the
   staff list from `profiles` and suspended staff are rejected at login. (The 5 console roles were a
   directory label at this point; role-based enforcement landed later — see entry 1.)
2. Citizen My Reports — empty-state card ("No reports yet") when the list is empty, mirroring
   the Home empty state, instead of a blank page.
2. Forgot-password / reset flow — login "Forgot password?" view + `/reset-password` screen.
3. Sign-out confirmation; cleared prefilled demo login credentials.
4. Pinned the citizen bottom nav (viewport-locked layout); only the content area scrolls.
5. Branded auth email templates (`confirmation.html` + `recovery.html`).
6. Citizen Issue Map fills the available screen height (flex-fill) instead of a fixed 360px
   box, removing the dead space below the legend.
2. Citizen report cancellation — a reporter can withdraw their own report while still
   Submitted (before acknowledgement) via the new `cancel-report` edge function (hard delete:
   photos + report + cascaded transitions/notifications). Relaxed the `status_transitions`
   append-only trigger to UPDATE-only so the cascade can proceed. Cancel button on the report
   detail screen.
3. Multiple report photos (1–5) with camera + gallery capture — `submit-report` now takes
   `photo_paths[]` (validates 1–5, ownership, existence; embeds the first photo); citizen
   picker supports camera and multi-select gallery with removable thumbnails; detail views
   show a main image + thumbnail strip (both apps); list cards show a first-photo thumbnail.
   DB `photo_urls text[]` already supported arrays — no migration.
4. Branded auth email templates — `supabase/templates/confirmation.html` + `recovery.html`
   (table-based, gold CTA), wired in `config.toml` and applied to the hosted project.
5. Fix missing Blocked Drain category icon in both apps — lucide renamed `Waves`, so the
   `Icon` wrapper fell back to a blank box; switched to `WavesHorizontal`.
6. Citizen Home — empty state for "Your recent reports" (icon + message) instead of a blank
   gap when the user has no reports; "View all" hidden when empty.
7. Mobile PWA install prompt on citizen login + home (Android one-tap, iOS hint).
8. Signup email-confirmation redirect fix — in-app `/auth/callback`, implicit-flow client
   config, `citizen/vercel.json` SPA rewrite; hosted Site URL + Resend Auth SMTP configured.
9. Citizen PWA polish — manifest completeness, offline shell, iOS install.
10. `LocationPicker` — geolocation + Nominatim reverse-geocoding, wired into submission.
11. Resend transition-status emails — send helper, template, wired into `transition-report`.
12. Leaflet maps in both apps + generated `lat`/`lng` columns on `reports`.
13. AI duplicate detection — schema, `classify-image` + `check-duplicates`, console/citizen UI.
14. Realtime — enabled on `notifications` + `reports`; both apps subscribe.
15. `transition-report` state machine + console wired to Supabase.
16. Citizen wired to Supabase — real auth, live reports, photo upload.
17. Initial schema migration (RLS, PostGIS, pgvector) + both apps ported from prototypes.
