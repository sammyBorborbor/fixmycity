# Design: Bound report location to AWMA

**Date:** 2026-07-17
**Status:** Approved (design), pending implementation plan

## Context

FixMyCity's pilot is locked to a single MMDA — Ayawaso West Municipal Assembly (AWMA).
Today, nothing enforces that a submitted report actually falls inside the municipality:

- The only geographic gate is a *loose Greater Accra bounding box* in
  `supabase/functions/submit-report/index.ts:54`
  (`lat 4..12, lng -4..2`), which admits essentially all of southern Ghana.
- The reports table has no CHECK constraint on `location`, and `location_name` is stored
  as free text — never validated against the 8 real neighbourhoods.
- The only "outside jurisdiction" concept is a *manual* staff reject reason in the console
  (`console/src/components/DetailPanel.tsx:14`).

The pin can be dragged anywhere. In practice this already misfires: a pin near the
municipality edge reverse-geocodes to "East Legon Hills, Kpone-Katamanso Municipal
District" — a neighbouring MMDA — and the server accepts it.

**Goal:** the API rejects reports whose location falls outside AWMA's real municipal
boundary, and the citizen app warns and blocks before submission so the citizen finds out
immediately rather than after tapping Submit.

## Boundary data

AWMA's real administrative boundary is a published OpenStreetMap relation:

- Nominatim: relation `12759086`, class/type `boundary/administrative`
- ~147-point Polygon, bounding box lat `5.5888..5.6674`, lng `-0.2285..-0.1428`

During implementation, fetch it once via Nominatim
(`.../search?q=Ayawaso+West+Municipal+District,+Ghana&format=jsonv2&polygon_geojson=1`)
and commit the ring as a static asset. It rarely changes, so it lives in the repo — no
runtime network dependency and no per-submission Nominatim call.

## Architecture

### 1. Canonical boundary asset
- Commit the fetched ring as `data/awma-boundary.geojson` (single source of truth).

### 2. Shared point-in-polygon check
- A ray-casting helper `pointInAwma(lat, lng): boolean` with a bounding-box fast-reject in
  front (cheap rejection for the common far-away case).
- **~500 m edge tolerance.** The raw OSM admin polygon is slightly tighter than FixMyCity's
  declared pilot scope: 3 of the 8 official neighbourhoods (Abelemkpe ~332 m, Airport
  Residential ~105 m, Roman Ridge ~393 m) fall just outside it. So `pointInAwma` returns
  true if the point is inside the polygon **or within 500 m of its edge** (point-to-segment
  distance). This captures all 8 declared neighbourhoods with margin while still rejecting
  genuinely out-of-area points (East Legon Hills ~1.4 km out, central Accra). No polygon
  offset library needed — the distance function also widens the bbox fast-reject.
- Lives in **two** thin files, both generated from the one committed GeoJSON and
  cross-referenced by comment, because the Deno edge runtime and the Vite browser bundle
  cannot cleanly share a module across the monorepo:
  - `supabase/functions/_shared/awma-boundary.ts` (server)
  - `citizen/src/lib/awma-boundary.ts` (client)
- ~147 points is trivial for ray-casting on both sides.

### 3. Server enforcement (authoritative)
- In `submit-report/index.ts`, replace the loose Greater Accra bbox (line 54) with:
  finite-number check -> AWMA bbox fast-reject -> `pointInAwma`.
- On failure return `422 { error: 'This location is outside Ayawaso West Municipal
  Assembly.', code: 'outside_awma' }` via the existing `json()` helper.
- This is the real gate. Clients stay thin; the server is the single source of truth
  (design principle #3). It runs early, before photo/CV work, to fail fast.

### 4. Client warn + block (UX only)
- In `LocationPicker.tsx` / `ReportFlow.tsx`, derive `inAwma` from the current pin
  position (the value already tracked by `movePin`).
- When the pin is outside AWMA: show an inline warning ("This spot is outside Ayawaso West
  — reports must be inside the municipality") and disable **Submit**, alongside the
  existing photo-required rule.
- `ReportFlow`'s submit handler maps a `code: 'outside_awma'` response to the same friendly
  message as a backstop if it ever slips through.

## Error handling

- Server: `422` with `code: 'outside_awma'` (distinct from the generic `400 invalid
  coordinates`, which remains for non-finite / NaN input).
- Client: the warning + disabled Submit prevents the common case; the 422 is the backstop.
- Boundary of trust: the **server** check is the security boundary; the **client** check is
  only UX. If the two polygon copies ever drift, the worst case is a slightly-off warning,
  never a bad row — `submit-report` is the sole authoritative write path and re-checks
  independently.

## Testing

- Unit-test `pointInAwma` (both copies, or a shared test fixture):
  - The 8 neighbourhood centroids (from `GEO`) -> inside.
  - East Legon Hills area and central Accra -> outside.
  - A couple of near-border points either side of the line.
- Edge function: submit with out-of-bounds coords -> `422 outside_awma`; in-bounds -> `200`.
- Manual (citizen app, port 5173): Report -> step 2 -> drag the pin outside AWMA ->
  warning appears and Submit disables; drag back inside -> warning clears, Submit enables.

## Out of scope (YAGNI)

- No DB CHECK constraint / trigger enforcement — `submit-report` is the only write path today.
- No admin-editable boundary; the polygon is a committed static asset.
- No re-validating `location_name` against the 8 neighbourhood names.
- No `maxBounds` pan-constraint on the map (the polygon check is the gate; can be added later
  as a nicety).
