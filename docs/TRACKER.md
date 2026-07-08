# FixMyCity — Project Tracker

Single source of truth for **what's built, what's in flight, and what's left**. Organised by
the 6-milestone build order in [CLAUDE.md](../CLAUDE.md). When you finish or start work,
update the relevant line here.

> Note: the top-level [README.md](../README.md) is currently stale (it still describes an
> in-memory demo store and "any password works"). This tracker reflects the real state.

**Pilot scope (locked):** Ayawaso West Municipal Assembly (AWMA) · 3 categories (Illegal
Dumping, Blocked Drain, Broken Streetlight) · 4 roles (Citizen, Officer, Field Crew,
Administrator) · Progressive Web App.

**Last updated:** 2026-07-08

**Legend:** ✅ Done · 🟡 Partial / in progress · ⬜ Not started · 🔒 Blocked (reason given)

---

## Progress at a glance

| Milestone | Status |
| --- | --- |
| M1 — Schema + RLS + seed | ✅ (seed file missing) |
| M2 — Auth + citizen submission end-to-end | ✅ (Google OAuth in flight) |
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

✅ **Citizen submission is live end-to-end:** capture photo → compress to WebP → upload to
`report-photos` bucket → invoke `submit-report` edge function → validated row + initial
`submitted` transition + returned reference number. 3-step `ReportFlow` UI.

🟡 **In progress — Google OAuth / `/auth/callback` (uncommitted in working tree):**
`citizen/src/screens/AuthCallback.tsx` (new), plus modified `App.tsx`, `lib/store.tsx`,
`lib/supabase.ts`, `screens/Login.tsx`, and new `citizen/vercel.json`. Finish and commit.

---

## M3 — State machine & console wiring

✅ **`transition-report` fully implemented server-side** (the one place statuses change):

- Staff actions: `acknowledge`, `assign` (validates crew exists + available), `reject`
  (reason required; optional `duplicate_of_report_id` link), `start`, `resolve`.
- Citizen action: `reopen` (reporter only, from `resolved`, within a 7-day window).
- Each transition validates legality, writes exactly one audit row, reverts status on audit
  failure, returns 400/403/409 appropriately.

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

✅ **Leaflet / OpenStreetMap maps, both apps:** shared `LeafletMap` (status-coloured pins),
citizen `LocationPicker` (geolocate-on-mount, draggable pin, nearest-neighbourhood
auto-select, debounced Nominatim reverse-geocode as a display hint).

🟡 **Offline is shell-only** — no `runtimeCaching` for the Supabase host, so no offline data
or report queueing (network required for all API/storage calls).

- Console has **no PWA** (intentional — desktop tool).
- `citizen/vercel.json` SPA rewrite present; console has none. Neither app deployed yet.

---

## Known gaps — console demo-only (not persisted)

These UIs work but mutate session-local state only (labelled in `console/src/lib/store.tsx`):

- **Users & Roles** — `SEED_USERS`; invite / change-role / suspend are in-memory (needs a
  schema addition).
- **Crew roster edits** — crew *assignment* uses live crews, but add-crew / toggle-availability /
  add-member / set-lead are session-local.
- **Settings** — entirely local `useState`; "Settings saved" is cosmetic.
- **Profile** — edit form is a local draft.
- **Analytics** — "Avg. resolution time 3.4d" and "+2 vs last week" are hardcoded, not computed.
- **TopHeader search box** — placeholder input, no wired handler.

## Cross-cutting / tech debt

- **No tests** — no backend/edge-function tests, no Vitest or Playwright suite yet.
- Citizen `Profile` notification/push toggles are local-only (not persisted).

---

## What's left (prioritised backlog)

- [ ] Finish + commit the Google OAuth `/auth/callback` flow (M2).
- [ ] Ship the external image-model API and wire `_shared/image-model.ts` — unblocks both AI features (M5).
- [ ] Add `supabase/seed.sql` (config already expects it) (M1).
- [ ] Persist console Users, Crews roster, Settings, Profile (schema addition).
- [ ] Compute real Analytics values (avg resolution time, week-over-week deltas).
- [ ] Wire the console search box.
- [ ] Decide on / implement FCM web push (optional — email is the fallback).
- [ ] Offline report queueing (runtimeCaching / background sync) for the citizen PWA.
- [ ] Test suite: Vitest unit tests + Playwright E2E.
- [ ] Deploy both front-ends to Vercel; set up GitHub Actions CI.
- [ ] Refresh the stale top-level README.

---

## Recent changes (newest first)

Distilled from git history:

1. Citizen PWA polish — manifest completeness, offline shell, iOS install.
2. `LocationPicker` — geolocation + Nominatim reverse-geocoding, wired into submission.
3. Resend transition-status emails — send helper, template, wired into `transition-report`.
4. Leaflet maps in both apps + generated `lat`/`lng` columns on `reports`.
5. AI duplicate detection — schema, `classify-image` + `check-duplicates`, console/citizen UI.
6. Realtime — enabled on `notifications` + `reports`; both apps subscribe.
7. `transition-report` state machine + console wired to Supabase.
8. Citizen wired to Supabase — real auth, live reports, photo upload.
9. Initial schema migration (RLS, PostGIS, pgvector) + both apps ported from prototypes.
