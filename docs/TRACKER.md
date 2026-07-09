# FixMyCity — Project Tracker

Single source of truth for **what's built, what's in flight, and what's left**. Organised by
the 6-milestone build order in [CLAUDE.md](../CLAUDE.md). When you finish or start work,
update the relevant line here.

> Note: the top-level [README.md](../README.md) is currently stale (it still describes an
> in-memory demo store and "any password works"). This tracker reflects the real state.

**Pilot scope (locked):** Ayawaso West Municipal Assembly (AWMA) · 3 categories (Illegal
Dumping, Blocked Drain, Broken Streetlight) · 4 roles (Citizen, Officer, Field Crew,
Administrator) · Progressive Web App.

**Last updated:** 2026-07-09

**Legend:** ✅ Done · 🟡 Partial / in progress · ⬜ Not started · 🔒 Blocked (reason given)

---

## Progress at a glance

| Milestone | Status |
| --- | --- |
| M1 — Schema + RLS + seed | ✅ (seed file missing) |
| M2 — Auth + citizen submission end-to-end | ✅ |
| M3 — State machine + console wiring | ✅ |
| M4 — Notifications (realtime + email) | ✅ (no web push) |
| M5 — AI features (classify + duplicates) | 🔒 wired, blocked on image model |
| M6 — PWA + Leaflet maps + deploy | ✅ / 🟡 (offline shell-only) |

---

## M1 — Database schema, RLS & seed

✅ **9 migrations applied** (`supabase/migrations/`):

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
- Console: role-gated — only `officer` / `admin` may sign in; others are signed back out
  with a "staff only" message. No sign-up (staff invited).

✅ **Citizen submission is live end-to-end:** capture **1–5 photos** (camera or gallery
multi-select) → compress each to WebP → upload to `report-photos` bucket → invoke
`submit-report` edge function (validates array length 1–5, per-path ownership + existence) →
validated row (`photo_urls text[]`) + initial `submitted` transition + returned reference
number. 3-step `ReportFlow` UI. Photos shown as a main image + thumbnail strip in the report
detail (citizen + console) and a first-photo thumbnail in list cards. The AI category
suggestion runs on the first photo.

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

🔒 **Both features are fully wired end-to-end and fail-soft, but blocked on the external
image model.**

- **Auto-categorisation** (`classify-image`): citizen app calls it after photo pick to
  pre-fill category (`citizen/src/lib/store.tsx`), user can override.
- **Duplicate detection** (`check-duplicates`): officer/admin-only; PostGIS `ST_DWithin`
  proximity + 7-day window, then pgvector cosine ranking via `find_duplicate_candidates()`
  RPC; surfaced as "possible duplicate" chips in the console DetailPanel, feeds
  reject-as-duplicate.

**Blocker:** `supabase/functions/_shared/image-model.ts` is a `TODO(image-model)`
placeholder — request/response shape and embedding dimension are assumed, and it needs
`IMAGE_MODEL_URL` / `IMAGE_MODEL_API_KEY`. Until a teammate ships that API, no real category
or embedding output is produced (so duplicate ranking has no vectors to compare).

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
citizen `LocationPicker` (geolocate-on-mount, draggable pin, nearest-neighbourhood
auto-select, debounced Nominatim reverse-geocode as a display hint).

🟡 **Offline is shell-only** — no `runtimeCaching` for the Supabase host, so no offline data
or report queueing (network required for all API/storage calls).

- Console has **no PWA** (intentional — desktop tool).
- `citizen/vercel.json` SPA rewrite present; console has none. **Citizen deployed** to
  `https://fixmycity-citizen.vercel.app`; console not yet deployed.

---

## Known gaps — console demo-only (not persisted)

These UIs work but mutate session-local state only (labelled in `console/src/lib/store.tsx`):

- **Crew create / availability toggle** — `addCrew` and `toggleCrewAvailability` are still
  session-local (crew *membership* and lead are now real — see below).
- **Settings** — entirely local `useState`; "Settings saved" is cosmetic.
- **Profile** — edit form is a local draft.
- **Analytics** — "Avg. resolution time 3.4d" and "+2 vs last week" are hardcoded, not computed.
- **TopHeader search box** — placeholder input, no wired handler.

## Cross-cutting / tech debt

- **No tests** — no backend/edge-function tests, no Vitest or Playwright suite yet.
- Citizen `Profile` notification/push toggles are local-only (not persisted).
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
- [ ] Ship the external image-model API and wire `_shared/image-model.ts` — unblocks both AI features (M5).
- [ ] Add `supabase/seed.sql` (config already expects it) (M1).
- [x] Persist console Users & Roles (real invite + role/suspend via `manage-users` edge function).
- [ ] Persist console Crew create + availability toggle, Settings, Profile (crew membership is real).
- [ ] Compute real Analytics values (avg resolution time, week-over-week deltas).
- [ ] Wire the console search box.
- [ ] Decide on / implement FCM web push (optional — email is the fallback).
- [ ] Offline report queueing (runtimeCaching / background sync) for the citizen PWA.
- [ ] Test suite: Vitest unit tests + Playwright E2E.
- [ ] Deploy the console to Vercel (citizen is live); set up GitHub Actions CI.
- [ ] Refresh the stale top-level README.

---

## Recent changes (newest first)

Distilled from git history:

1. Crew members are now real users. Added a **Field Crew** console role (invited via Users & Roles
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
   staff list from `profiles` and suspended staff are rejected at login. The 5 console roles remain
   a directory label, not enforced permissions.
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
