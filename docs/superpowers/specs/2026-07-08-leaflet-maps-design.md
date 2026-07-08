# Leaflet maps — design spec

## Context

CLAUDE.md's tech stack section already names `leaflet + react-leaflet (OpenStreetMap
tiles — no Google Maps, no API keys)` as the decided mapping library; milestone 6
(build order) is where it actually gets built. Today, both apps use an identical
stylized `MapPlaceholder` component (SVG landmass blob + faint street grid) with pins
positioned by a client-side `COORDS`/`GEO` lookup keyed by area name — meaning every
report in the same one of the 8 AWMA neighbourhoods stacks at the exact same point,
regardless of where it was actually reported. This spec replaces that placeholder with
real OpenStreetMap tiles and each report's real, precise coordinates, and upgrades the
citizen report-submission flow to capture a precise pin instead of only a named area.

## Scope

All 4 existing map usage sites, across both apps:
- Citizen: `Map.tsx` (full report list), `ReportFlow.tsx` step 2 (location picker for a
  new report).
- Console: `MapView.tsx` (full report list), `DetailPanel.tsx` (single-report mini-map).

## Part 1 — Data layer

Add two generated columns to `public.reports` via migration:

```sql
alter table public.reports
  add column lat double precision generated always as (extensions.st_y(location::extensions.geometry)) stored,
  add column lng double precision generated always as (extensions.st_x(location::extensions.geometry)) stored;
```

- Computed directly from the existing `location geography(point,4326)` column — always
  in sync, no drift possible, no new write path.
- Already included in every existing `select('*')` call in both apps' `mapReport()`
  functions — no query changes needed, just add `lat: number; lng: number` to the
  `Report` type in both `citizen/src/lib/store.tsx` and `console/src/lib/store.tsx` and
  populate them from `row.lat`/`row.lng` in `mapReport`.
- `submit-report`'s existing Greater Accra bounding-box validation on `lat`/`lng`
  already accepts arbitrary coordinates within it — no edge function change needed for
  this part; `location` (and therefore the generated `lat`/`lng`) will simply reflect
  whatever precise coordinates the citizen app now sends (see Part 3).
- `location` is `not null`, so `lat`/`lng` are always present — no null-handling needed
  in either app's `Report` type or map rendering.

## Part 2 — Display maps (read-only: citizen Map tab, console MapView, console detail-panel mini-map)

New `LeafletMap` component in each app (`citizen/src/components/LeafletMap.tsx`,
`console/src/components/LeafletMap.tsx`), replacing `MapPlaceholder` at these 3 call
sites with the **same prop signature** it already has:

```ts
interface LeafletMapProps {
  reports: Report[];
  onPin?: (r: Report) => void;
  activeId?: string | null;
  height?: number;
  rounded?: string;
}
```

- `react-leaflet`'s `MapContainer` + `TileLayer` pointed at standard OSM raster tiles
  (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`), with the OSM attribution
  control left enabled (required by their tile usage policy).
- One `Marker` per report at `(report.lat, report.lng)`, using a custom Leaflet
  `divIcon` that renders the existing Lucide `MapPin` icon colored via
  `STATUS[report.status].solid` (bigger + a small dot when `activeId` matches),
  preserving the exact visual language of today's placeholder pins.
- Marker click calls `onPin(r)` directly (`eventHandlers={{ click: () => onPin?.(r) }}`)
  — no Leaflet popups, matching current click-to-navigate/open-detail behavior exactly.
- Fixed initial center/zoom on Ayawaso West (not auto-fit-to-bounds) — consistent,
  predictable framing regardless of how many reports exist, matching how the stylized
  placeholder always renders the same fixed view today. Approximate starting point:
  center `(5.6350, -0.1850)` (roughly central to all 8 seeded neighbourhoods, near
  Okponglo/UG campus), zoom level `14` — exact values can be tuned visually during
  implementation.
- `DetailPanel.tsx`'s mini-map usage is the same component with a single-report array
  and a smaller `height` — no other changes.

## Part 3 — Citizen location picker (`ReportFlow.tsx` step 2)

New `citizen/src/components/LocationPicker.tsx`, replacing the current static preview
map + area dropdown block, used only in the citizen app (console has no submission
flow).

**Behavior:**
1. On mount, attempt `navigator.geolocation.getCurrentPosition()` with a short timeout
   and `enableHighAccuracy: false` (fast, battery-friendly, sufficient precision for
   civic reporting).
   - Granted: place the draggable marker there, center the map on it.
   - Denied / unavailable / timed out: fall back silently to today's default (the
     `location` dropdown's currently-selected area centroid, i.e. Okponglo by default)
     — no error shown to the citizen. This is a fail-soft path, consistent with
     milestone 5's AI-feature conventions.
2. The citizen can drag the marker, or tap anywhere on the map, to reposition it.
3. On every position change (debounced ~400ms after the position settles, not on every
   intermediate drag frame):
   - Compute the nearest of the 8 known neighbourhood centroids via Haversine distance
     against the existing `GEO` lookup table (pure client-side math, no network call)
     and update the `location` dropdown to match. The citizen can still manually
     override via the dropdown; doing so re-centers the pin to that area's centroid
     (the existing one-way dropdown-drives-map relationship becomes bidirectional).
   - Reverse-geocode the position via Nominatim's `/reverse` endpoint (debounced;
     browser `fetch()` cannot set a custom `User-Agent` — Nominatim's usage policy
     accepts this for genuine browser-originated requests, since the browser's own UA
     and `Referer` already identify the site; stale in-flight requests ignored if the
     pin moves again before a response arrives) and show the result as a small,
     ephemeral text hint below the map (e.g. "Near: 12 Legon Road, Accra").
     **Display only — never persisted to the database.** On failure, timeout, or
     rate-limiting, the hint simply stays blank; this never blocks map interaction or
     report submission.
4. **What gets submitted:** the marker's current precise `(lat, lng)` — whatever it
   ends up being (geolocated, default, or manually moved) — is what the citizen app
   sends as `lat`/`lng` to `submit-report`, replacing today's behavior of always
   deriving those values from `GEO[location]`. The dropdown's selected area is still
   sent as `location_name` exactly as before; `submit-report`'s request shape and
   validation are unchanged.

**Threading through the code:**
- `ReportDraft` (`citizen/src/lib/store.tsx`) gains `lat: number; lng: number`.
- `submitReport` uses `draft.lat`/`draft.lng` directly instead of computing them from
  `GEO[draft.location]`.
- `ReportFlow.tsx` keeps its existing `location` dropdown state, now driven
  bidirectionally by `LocationPicker` as described above.

## Dependencies

- `leaflet` + `react-leaflet` as runtime dependencies in both `citizen/` and `console/`;
  `@types/leaflet` as a dev dependency in both.
- Import `leaflet/dist/leaflet.css` once per app (e.g. alongside the existing global
  CSS import).
- Because every marker uses a custom `divIcon` rather than Leaflet's default
  `L.Icon.Default`, this sidesteps the well-known "broken default marker icon path
  under Vite/webpack bundling" Leaflet issue entirely — no icon-path workaround needed.

## Error handling (consolidated)

| Failure | Behavior |
|---|---|
| Geolocation denied/unavailable/timeout | Silent fallback to the current default area centroid; no error UI. |
| Nominatim failure/timeout/rate-limit | Address hint stays blank; never blocks interaction or submission. |
| Tile load failure (e.g. offline) | Leaflet degrades to blank/grey tiles; report submission only depends on the pin's `(lat, lng)`, never on tiles actually rendering. |
| Missing `lat`/`lng` on a report | Cannot happen — `location` is `not null` and `lat`/`lng` are generated from it. |

## Testing / verification plan

1. Typecheck (`tsc -b`) and lint both apps after implementation.
2. Apply the migration locally (`supabase db reset` or `migration up`), regenerate
   types, copy `database.types.ts` into both apps as usual, confirm `lat`/`lng`
   populate correctly for existing seeded reports via direct SQL.
3. Use the `verify` skill to drive both apps: confirm real OSM tiles render with
   correctly-positioned pins matching known seed-report coordinates on the Map
   tab/MapView/detail-panel mini-map; confirm the location picker's
   geolocation-fallback, drag, tap, dropdown-sync, and address-hint behavior; submit a
   test report and confirm its precise coordinates land in the database via
   `lat`/`lng`.
4. Apply the migration to the hosted Supabase project (same MCP-based workflow used
   for milestone 5) and re-verify against it, since both apps run against the live
   hosted backend per their `.env` configuration.

## Out of scope (explicitly deferred, not part of this pass)

- Replacing `location_name` with a free-text geocoded address — the 8-neighbourhood
  dropdown stays as the authoritative, typed `LocationName` value; Nominatim only
  supplies a display-only hint.
- Persisting the Nominatim address hint anywhere in the database.
- Auto-fit-to-bounds behavior on the display maps (fixed center/zoom only, for now).
- Self-hosting Nominatim or switching to a commercial geocoding provider — the public
  Nominatim endpoint's fair-use rate limit is accepted as a known constraint for this
  pilot's expected traffic.
