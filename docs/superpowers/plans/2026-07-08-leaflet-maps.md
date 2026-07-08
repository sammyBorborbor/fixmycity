# Leaflet Maps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stylized `MapPlaceholder` component with real OpenStreetMap tiles (via Leaflet/react-leaflet) across all 4 map usage sites in both apps, using each report's real stored coordinates instead of a per-area lookup, and add a geolocation + draggable-pin location picker to the citizen report-submission flow with Nominatim reverse-geocoding for a display-only address hint.

**Architecture:** A generated `lat`/`lng` column pair on `reports` (computed from the existing PostGIS `location` column) feeds a new `LeafletMap` display component in each app (citizen, console) that is a near drop-in replacement for `MapPlaceholder`. A separate citizen-only `LocationPicker` component handles the richer interactive submission flow: geolocate-on-mount, draggable/clickable pin, client-side nearest-neighbourhood matching (no network call), and debounced Nominatim reverse-geocoding for a UI-only address hint.

**Tech Stack:** `leaflet@^1.9.4`, `react-leaflet@^5.0.0` (React 19 peer dependency — matches this repo's React 19.2), `@types/leaflet@^1.9.21` (dev dependency). No new backend dependencies; Nominatim is called directly from the browser (no API key, public endpoint).

## Global Constraints

- Yarn only — never `npm install`. Run all package installs via `yarn add`/`yarn add -D` inside the relevant app directory (`citizen/` or `console/`).
- This repo has no test framework (`vitest` is not installed, no `*.test.*` files exist anywhere) despite CLAUDE.md's long-term aspiration to add one. Do not invent a test harness for this plan. Verification for each task is: `tsc -b` (typecheck) + `yarn lint`, and the final task drives both real apps with the project's existing `verify` skill (Playwright-based), matching how milestone 5 (AI features) was actually verified in this codebase.
- Supabase schema changes go through a migration file in `supabase/migrations/`, applied locally via `supabase db reset` (or the CLI) and additionally applied to the hosted project via the Supabase MCP tools (`apply_migration`) — this repo's apps run against the **live hosted Supabase project** (see `citizen/.env`/`console/.env`), not a local instance, so a migration only touching local Postgres is not sufficient on its own.
- After any migration that changes `reports` or `status_transitions` columns/functions, regenerate `database.types.ts` and hand-copy the diff into **both** `citizen/src/lib/database.types.ts` and `console/src/lib/database.types.ts` (this repo does not share the generated types file between apps).
- Both apps' `Report` type and `mapReport()` function live in `citizen/src/lib/store.tsx` / `console/src/lib/store.tsx` respectively — screens/components never talk to Supabase directly for report data.
- Preserve the existing per-app duplication convention: components like `Icon.tsx`/`MapPlaceholder.tsx` are duplicated (not shared) between `citizen/src/components/` and `console/src/components/`. `LeafletMap.tsx` follows the same pattern.
- Status pill colors come from `STATUS[status].solid` (both apps' `store.tsx`) — reuse this for map pin coloring, do not hardcode new colors.
- Commit messages: short imperative subject, plain text only, no emojis/Co-Authored-By trailers (per this repo's CLAUDE.md).

---

## Task 1: Add generated `lat`/`lng` columns to `reports`

**Files:**
- Create: `supabase/migrations/20260709090000_add_report_lat_lng.sql`

**Interfaces:**
- Produces: `public.reports.lat` (`double precision`, generated, always non-null since `location` is `not null`), `public.reports.lng` (same). Consumed by Task 3 (both apps' `Report`/`mapReport`).

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260709090000_add_report_lat_lng.sql
-- Milestone 6: real Leaflet maps. Both apps currently position pins using a
-- client-side area-name lookup (COORDS/GEO), so every report in the same
-- named area stacks at one point. These generated columns expose each
-- report's actual stored coordinates (always in sync with `location`, no new
-- write path) so the map can plot precise, distinct pins per report.
alter table public.reports
  add column lat double precision generated always as (extensions.st_y(location::extensions.geometry)) stored,
  add column lng double precision generated always as (extensions.st_x(location::extensions.geometry)) stored;
```

- [ ] **Step 2: Apply locally and verify**

Run:
```bash
cd /Users/oneplan/personal/school-work/fixmycity
/Users/oneplan/personal/school-work/fixmycity/node_modules/.bin/supabase db reset
```
Expected: all migrations apply cleanly, ending with `Finished supabase db reset on branch master.` (no errors).

Then verify the columns exist and compute correctly:
```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c \
  "select column_name, data_type, is_generated from information_schema.columns where table_name='reports' and column_name in ('lat','lng');"
```
Expected: two rows, both `data_type = double precision`, `is_generated = ALWAYS`.

- [ ] **Step 3: Apply to the hosted project**

Use the Supabase MCP tool `apply_migration` with `project_id: hvesugctansssxwtzjqn`, `name: add_report_lat_lng`, and the exact SQL from Step 1 as `query`. Then verify with `execute_sql`:
```sql
select id, lat, lng from public.reports limit 3;
```
Expected: existing seeded reports now show non-null numeric `lat`/`lng` values matching their known neighbourhoods (e.g. Okponglo reports around `lat ≈ 5.635, lng ≈ -0.185`).

- [ ] **Step 4: Commit**

```bash
cd /Users/oneplan/personal/school-work/fixmycity
git add supabase/migrations/20260709090000_add_report_lat_lng.sql
git commit -m "Add generated lat/lng columns to reports

Computed from the existing PostGIS location column so both apps can
plot each report's real coordinates instead of a per-area lookup."
```

---

## Task 2: Add Leaflet dependencies to both apps

**Files:**
- Modify: `citizen/package.json`, `console/package.json`
- Modify: `citizen/src/main.tsx`, `console/src/main.tsx`

**Interfaces:**
- Produces: `leaflet`, `react-leaflet` importable in both apps' `src/` from Task 4 onward.

- [ ] **Step 1: Install dependencies in citizen**

```bash
cd /Users/oneplan/personal/school-work/fixmycity/citizen
yarn add leaflet@^1.9.4 react-leaflet@^5.0.0
yarn add -D @types/leaflet@^1.9.21
```
Expected: `package.json` gains `leaflet` and `react-leaflet` under `dependencies`, `@types/leaflet` under `devDependencies`.

- [ ] **Step 2: Install dependencies in console**

```bash
cd /Users/oneplan/personal/school-work/fixmycity/console
yarn add leaflet@^1.9.4 react-leaflet@^5.0.0
yarn add -D @types/leaflet@^1.9.21
```

- [ ] **Step 3: Import Leaflet's CSS in both apps**

Edit `citizen/src/main.tsx` — add the import alongside the existing `./index.css` import:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';

import 'leaflet/dist/leaflet.css';
import './index.css';

import App from './App.tsx';
import { StoreProvider } from './lib/store.tsx';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <StoreProvider>
        <App />
        <Analytics />
      </StoreProvider>
    </BrowserRouter>
  </React.StrictMode>
);
```

Edit `console/src/main.tsx` identically (same import addition, rest of the file unchanged):

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';

import 'leaflet/dist/leaflet.css';
import './index.css';

import App from './App.tsx';
import { StoreProvider } from './lib/store.tsx';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <StoreProvider>
        <App />
        <Analytics />
      </StoreProvider>
    </BrowserRouter>
  </React.StrictMode>
);
```

- [ ] **Step 4: Typecheck both apps**

```bash
cd /Users/oneplan/personal/school-work/fixmycity/citizen && yarn tsc -b
cd /Users/oneplan/personal/school-work/fixmycity/console && yarn tsc -b
```
Expected: both `Done` with no errors (nothing uses the new packages yet, so this just confirms the install didn't break anything).

- [ ] **Step 5: Commit**

```bash
cd /Users/oneplan/personal/school-work/fixmycity
git add citizen/package.json citizen/yarn.lock citizen/src/main.tsx console/package.json console/yarn.lock console/src/main.tsx
git commit -m "Add leaflet and react-leaflet dependencies to both apps"
```

---

## Task 3: Surface `lat`/`lng` in both apps' data layer

**Files:**
- Modify: `citizen/src/lib/database.types.ts`, `console/src/lib/database.types.ts`
- Modify: `citizen/src/lib/store.tsx`, `console/src/lib/store.tsx`

**Interfaces:**
- Consumes: `public.reports.lat`/`lng` (Task 1).
- Produces: `Report.lat: number`, `Report.lng: number` in both apps — consumed by Task 4 (`LeafletMap`) and Task 8 (submission flow, citizen only).

- [ ] **Step 1: Regenerate types and diff against the checked-in files**

```bash
cd /Users/oneplan/personal/school-work/fixmycity
/Users/oneplan/personal/school-work/fixmycity/node_modules/.bin/supabase gen types typescript --local > /tmp/database.types.ts
diff /tmp/database.types.ts citizen/src/lib/database.types.ts
```
Expected: a diff showing new `lat`/`lng` fields inside the `reports` table's `Row`/`Insert`/`Update` shapes (similar in shape to how `ai_confidence`/`ai_suggested_category` already appear), plus possibly unrelated formatting differences from a different CLI-generation method used previously (as seen in milestone 5) — do **not** overwrite the file wholesale; patch in only the new fields by hand to keep the diff minimal, matching how `duplicate_of_report_id` was added in the previous migration.

- [ ] **Step 2: Patch `citizen/src/lib/database.types.ts`**

Find the `reports` table's `Row`, `Insert`, and `Update` blocks. Add `lat: number` and `lng: number` to `Row` (both required, since the generated columns are always non-null); add `lat?: never` and `lng?: never` to both `Insert` and `Update` (generated columns cannot be written to — Supabase's type generator marks generated-always columns this way, matching the existing pattern for the `id` column: `id?: never` in `Insert`). Example of the resulting `Row` shape (only the relevant slice shown — insert alphabetically alongside the other fields already there):

```ts
      reports: {
        Row: {
          // ...existing fields (ai_confidence, ai_suggested_category, assigned_crew_id, category, created_at, description, embedding, id, location, location_name, photo_urls, reference, reporter_id, status)...
          lat: number
          lng: number
        }
        Insert: {
          // ...existing fields...
          lat?: never
          lng?: never
        }
        Update: {
          // ...existing fields...
          lat?: never
          lng?: never
        }
        // Relationships unchanged
      }
```

- [ ] **Step 3: Patch `console/src/lib/database.types.ts`**

Apply the identical change (same field additions in the same three blocks) to `console/src/lib/database.types.ts`.

- [ ] **Step 4: Add `lat`/`lng` to citizen's `Report` type and `mapReport`**

In `citizen/src/lib/store.tsx`, find the `Report` interface (around the `category`/`location` fields) and add:

```ts
export interface Report {
  id: string;
  uuid?: string;
  category: CategoryName;
  location: LocationName;
  lat: number;
  lng: number;
  description: string;
  status: StatusName;
  crew: string | null;
  hasPhoto: boolean;
  photoPath?: string | null;
  rejectReason?: string;
  timeline: TimelineEvent[];
}
```

Then in `mapReport()`, add `lat: row.lat, lng: row.lng,` alongside the existing `location: row.location_name as LocationName,` line:

```ts
  return {
    id: row.reference,
    uuid: row.id,
    category: DB_TO_CATEGORY[row.category],
    location: row.location_name as LocationName,
    lat: row.lat,
    lng: row.lng,
    description: row.description,
    status: DB_TO_STATUS[row.status],
    crew: row.assigned_crew_id,
    hasPhoto: row.photo_urls.length > 0,
    photoPath: row.photo_urls[0] ?? null,
    rejectReason: rejected?.note ?? undefined,
    timeline: transitions.map(t => ({
      status: DB_TO_STATUS[t.to_status],
      timestamp: t.created_at,
      actor: actorLabel(t, uid, userName, row.assigned_crew_id),
      note: t.note ?? undefined,
    })),
  };
```

- [ ] **Step 5: Add `lat`/`lng` to console's `Report` type and `mapReport`**

In `console/src/lib/store.tsx`, apply the same shape change to its `Report` interface:

```ts
export interface Report {
  id: string;
  uuid?: string;
  category: CategoryName;
  location: LocationName;
  lat: number;
  lng: number;
  description: string;
  status: StatusName;
  crew: string | null;
  hasPhoto: boolean;
  photoPath?: string | null;
  reporterName?: string;
  rejectReason?: string;
  aiSuggestedCategory?: CategoryName | null;
  aiConfidence?: number | null;
  timeline: TimelineEvent[];
}
```

And in `mapReport()`, add `lat: row.lat, lng: row.lng,` alongside `location: row.location_name as LocationName,`:

```ts
  return {
    id: row.reference,
    uuid: row.id,
    category: DB_TO_CATEGORY[row.category],
    location: row.location_name as LocationName,
    lat: row.lat,
    lng: row.lng,
    description: row.description,
    status: DB_TO_STATUS[row.status],
    crew: row.assigned_crew_id,
    hasPhoto: row.photo_urls.length > 0,
    photoPath: row.photo_urls[0] ?? null,
    reporterName: (row.reporter_id && names.get(row.reporter_id)) || 'Resident',
    rejectReason: rejected?.note ?? undefined,
    aiSuggestedCategory: row.ai_suggested_category ? DB_TO_CATEGORY[row.ai_suggested_category] : null,
    aiConfidence: row.ai_confidence,
    timeline: transitions.map(t => ({
      status: DB_TO_STATUS[t.to_status],
      timestamp: t.created_at,
      actor: actorLabel(t, names, row.assigned_crew_id),
      note: t.note ?? undefined,
    })),
  };
```

- [ ] **Step 6: Typecheck both apps**

```bash
cd /Users/oneplan/personal/school-work/fixmycity/citizen && yarn tsc -b
cd /Users/oneplan/personal/school-work/fixmycity/console && yarn tsc -b
```
Expected: both `Done` with no errors. (`ReportFlow.tsx`'s inline literal `{ id: 'new', category, location, status: 'Submitted', ... }` object passed to `MapPlaceholder` will now be MISSING `lat`/`lng` and fail to typecheck against the updated `Report` type — this is expected and gets fixed in Task 8 when `MapPlaceholder` is removed from `ReportFlow.tsx` entirely. If Task 8 has not yet run, this one call site's type error is expected and acceptable to leave until then; do not patch it here.)

- [ ] **Step 7: Commit**

```bash
cd /Users/oneplan/personal/school-work/fixmycity
git add citizen/src/lib/database.types.ts citizen/src/lib/store.tsx console/src/lib/database.types.ts console/src/lib/store.tsx
git commit -m "Surface report lat/lng in both apps' data layer"
```

---

## Task 4: Create `LeafletMap` display component in both apps

**Files:**
- Create: `citizen/src/components/LeafletMap.tsx`
- Create: `console/src/components/LeafletMap.tsx`

**Interfaces:**
- Consumes: `Report.lat`/`lng` (Task 3), `STATUS` (existing export in both `store.tsx`), `Icon` (existing component in both apps).
- Produces: `LeafletMap` component with props `{ reports: Report[]; onPin?: (r: Report) => void; activeId?: string | null; height?: number; rounded?: string }` — the exact same shape as `MapPlaceholder`. Consumed by Task 5.

- [ ] **Step 1: Write `citizen/src/components/LeafletMap.tsx`**

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import Icon from './Icon.tsx';
import { STATUS } from '../lib/store.tsx';
import type { Report } from '../lib/store.tsx';

interface LeafletMapProps {
  reports: Report[];
  onPin?: (r: Report) => void;
  activeId?: string | null;
  height?: number;
  rounded?: string;
}

// Roughly central to all 8 seeded AWMA neighbourhoods, near Okponglo/UG campus.
const AYAWASO_WEST_CENTER: [number, number] = [5.635, -0.185];
const DEFAULT_ZOOM = 14;

/* Status-colored pin matching the placeholder's visual language, built from a
   real DOM render of the shared <Icon> component (not Leaflet's default
   marker), so pins look identical to every other status indicator in the app. */
function pinIcon(color: string, active: boolean): L.DivIcon {
  const size = active ? 32 : 26;
  const html = renderToStaticMarkup(
    <span style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Icon name="MapPin" size={size} strokeWidth={2.5}
            style={{ color, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.25))' }} />
      {active && (
        <span style={{ position: 'absolute', bottom: -4, width: 8, height: 8, borderRadius: 9999, background: color, border: '2px solid white' }} />
      )}
    </span>,
  );
  return L.divIcon({
    html,
    className: '', // strip Leaflet's default white-box divIcon styling
    iconSize: [size, size],
    iconAnchor: [size / 2, size], // bottom-center, matching the placeholder's pin anchor
  });
}

/* Real OpenStreetMap tiles, one marker per report at its actual coordinates.
   Same props shape as the old MapPlaceholder, so call sites barely change. */
export default function LeafletMap({ reports, onPin, activeId, height = 320, rounded = 'rounded-xl' }: LeafletMapProps) {
  return (
    <div className={`relative w-full overflow-hidden ${rounded} ring-1 ring-black/5`} style={{ height }}>
      <MapContainer
        center={AYAWASO_WEST_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {reports.map(r => {
          const cfg = STATUS[r.status] || STATUS.Submitted;
          const active = activeId === r.id;
          return (
            <Marker
              key={r.id}
              position={[r.lat, r.lng]}
              icon={pinIcon(cfg.solid, active)}
              eventHandlers={{ click: () => onPin?.(r) }}
              zIndexOffset={active ? 1000 : 0}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}
```

- [ ] **Step 2: Write `console/src/components/LeafletMap.tsx`**

Identical file, adjusted only for console's import paths (same relative structure, since `console/src/components/` mirrors `citizen/src/components/`):

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import Icon from './Icon.tsx';
import { STATUS } from '../lib/store.tsx';
import type { Report } from '../lib/store.tsx';

interface LeafletMapProps {
  reports: Report[];
  onPin?: (r: Report) => void;
  activeId?: string | null;
  height?: number;
  rounded?: string;
}

// Roughly central to all 8 seeded AWMA neighbourhoods, near Okponglo/UG campus.
const AYAWASO_WEST_CENTER: [number, number] = [5.635, -0.185];
const DEFAULT_ZOOM = 14;

/* Status-colored pin matching the placeholder's visual language, built from a
   real DOM render of the shared <Icon> component (not Leaflet's default
   marker), so pins look identical to every other status indicator in the app. */
function pinIcon(color: string, active: boolean): L.DivIcon {
  const size = active ? 32 : 26;
  const html = renderToStaticMarkup(
    <span style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Icon name="MapPin" size={size} strokeWidth={2.5}
            style={{ color, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.25))' }} />
      {active && (
        <span style={{ position: 'absolute', bottom: -4, width: 8, height: 8, borderRadius: 9999, background: color, border: '2px solid white' }} />
      )}
    </span>,
  );
  return L.divIcon({
    html,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

/* Real OpenStreetMap tiles, one marker per report at its actual coordinates.
   Same props shape as the old MapPlaceholder, so call sites barely change. */
export default function LeafletMap({ reports, onPin, activeId, height = 320, rounded = 'rounded-xl' }: LeafletMapProps) {
  return (
    <div className={`relative w-full overflow-hidden ${rounded} ring-1 ring-black/5`} style={{ height }}>
      <MapContainer
        center={AYAWASO_WEST_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {reports.map(r => {
          const cfg = STATUS[r.status] || STATUS.Submitted;
          const active = activeId === r.id;
          return (
            <Marker
              key={r.id}
              position={[r.lat, r.lng]}
              icon={pinIcon(cfg.solid, active)}
              eventHandlers={{ click: () => onPin?.(r) }}
              zIndexOffset={active ? 1000 : 0}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck both apps**

```bash
cd /Users/oneplan/personal/school-work/fixmycity/citizen && yarn tsc -b
cd /Users/oneplan/personal/school-work/fixmycity/console && yarn tsc -b
```
Expected: both `Done`. The pre-existing `ReportFlow.tsx` type error from Task 3 Step 6 is still expected here (not yet fixed).

- [ ] **Step 4: Commit**

```bash
cd /Users/oneplan/personal/school-work/fixmycity
git add citizen/src/components/LeafletMap.tsx console/src/components/LeafletMap.tsx
git commit -m "Add LeafletMap display component to both apps"
```

---

## Task 5: Wire `LeafletMap` into the 3 read-only display sites

**Files:**
- Modify: `citizen/src/screens/Map.tsx`
- Modify: `console/src/screens/MapView.tsx`
- Modify: `console/src/components/DetailPanel.tsx`

**Interfaces:**
- Consumes: `LeafletMap` (Task 4).

- [ ] **Step 1: Swap citizen's Map tab**

In `citizen/src/screens/Map.tsx`, replace the import and usage:

```tsx
import { useNavigate } from 'react-router-dom';
import { useStore, STATUS } from '../lib/store.tsx';
import type { StatusName } from '../lib/store.tsx';
import LeafletMap from '../components/LeafletMap.tsx';

export default function Map() {
  const { reports } = useStore();
  const navigate = useNavigate();

  return (
    <div className="px-4 pt-5 pb-4 fade-in">
      <h1 className="text-xl font-bold text-navy mb-1">Issue map</h1>
      <p className="text-sm text-muted mb-4">All reports across Accra</p>
      <LeafletMap reports={reports} height={360} activeId={null} onPin={r => navigate('/reports/' + r.id)} />
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
        {(Object.keys(STATUS) as StatusName[]).map(s => (
          <span key={s} className="flex items-center gap-1.5 text-[11px] text-muted"><span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS[s].solid }} />{s}</span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Swap console's Map view**

In `console/src/screens/MapView.tsx`:

```tsx
import { useOutletContext } from 'react-router-dom';
import { useStore, STATUS } from '../lib/store.tsx';
import type { StatusName } from '../lib/store.tsx';
import type { AppOutletContext } from '../App.tsx';
import LeafletMap from '../components/LeafletMap.tsx';

export default function MapView() {
  const { reports } = useStore();
  const { openRow, activeId } = useOutletContext<AppOutletContext>();

  return (
    <div className="p-6 max-w-[1100px]">
      <h1 className="text-2xl font-bold text-navy mb-1">Map</h1>
      <p className="text-sm text-muted mb-4">Live view of all reports · click a pin for details</p>
      <LeafletMap reports={reports} height={460} activeId={activeId} onPin={r => openRow(r.id)} />
      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4">
        {(Object.keys(STATUS) as StatusName[]).map(s => <span key={s} className="flex items-center gap-1.5 text-xs text-muted"><span className="w-3 h-3 rounded-full" style={{ background: STATUS[s].solid }} />{s}</span>)}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Swap console's detail-panel mini-map**

In `console/src/components/DetailPanel.tsx`, change the import line:

```tsx
import LeafletMap from './LeafletMap.tsx';
```

(replacing `import MapPlaceholder from './MapPlaceholder.tsx';`), and change the mini-map usage line (currently `<div className="mt-4"><MapPlaceholder reports={[report]} height={140} activeId={report.id} /></div>`) to:

```tsx
            <div className="mt-4"><LeafletMap reports={[report]} height={140} activeId={report.id} /></div>
```

- [ ] **Step 4: Typecheck and lint both apps**

```bash
cd /Users/oneplan/personal/school-work/fixmycity/citizen && yarn tsc -b && yarn lint
cd /Users/oneplan/personal/school-work/fixmycity/console && yarn tsc -b && yarn lint
```
Expected: citizen typechecks clean (the `Map.tsx` fix removes one use of the old placeholder, but `ReportFlow.tsx`'s literal-object type error from Task 3 Step 6 is still expected here). Console typechecks clean. Lint: only the same two pre-existing, unrelated `react-hooks/set-state-in-effect` violations from before this project (in `console/src/components/DetailPanel.tsx`'s `ReportPhoto` effect and crew-default effect, and `citizen/src/components/PhotoBox.tsx`) should appear — nothing new.

- [ ] **Step 5: Commit**

```bash
cd /Users/oneplan/personal/school-work/fixmycity
git add citizen/src/screens/Map.tsx console/src/screens/MapView.tsx console/src/components/DetailPanel.tsx
git commit -m "Wire LeafletMap into read-only map display sites"
```

---

## Task 6: Create citizen geo helper (nearest-neighbourhood + reverse geocoding)

**Files:**
- Create: `citizen/src/lib/geo.ts`

**Interfaces:**
- Consumes: `GEO` (existing export, `citizen/src/lib/store.tsx`), `LocationName` (existing type, same file).
- Produces: `nearestLocation(lat: number, lng: number): LocationName`, `reverseGeocode(lat: number, lng: number): Promise<string>` — both consumed by Task 7 (`LocationPicker`).

- [ ] **Step 1: Write `citizen/src/lib/geo.ts`**

```ts
import { GEO } from './store.tsx';
import type { LocationName } from './store.tsx';

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/* Great-circle distance between two lat/lng points, in kilometres. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/* Nearest of the 8 known AWMA neighbourhoods to a point, by straight-line
   distance to each area's centroid (GEO). Pure client-side math, no network
   call — this is why milestone 6's design doesn't need Nominatim just to
   pick which of the 8 fixed dropdown values to auto-select. */
export function nearestLocation(lat: number, lng: number): LocationName {
  let best: LocationName = 'Okponglo';
  let bestDist = Infinity;
  (Object.keys(GEO) as LocationName[]).forEach(name => {
    const g = GEO[name];
    const dist = haversineKm(lat, lng, g.lat, g.lng);
    if (dist < bestDist) {
      bestDist = dist;
      best = name;
    }
  });
  return best;
}

/* Reverse-geocode via Nominatim (OpenStreetMap's free geocoder, no API key).
   Display-only address hint — never persisted to the database. Browser
   fetch() cannot set a custom User-Agent (a forbidden header); Nominatim's
   usage policy accepts this for genuine browser-originated requests, since
   the browser's own UA and Referer already identify the site. */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  if (!res.ok) throw new Error(`nominatim returned ${res.status}`);
  const data = await res.json();
  if (typeof data?.display_name !== 'string') throw new Error('no address found');
  return data.display_name;
}
```

- [ ] **Step 2: Sanity-check the Haversine math**

There is no test framework in this repo (see Global Constraints), so verify the formula directly with a throwaway Node script rather than skipping verification:

```bash
node -e "
const toRad = d => d * Math.PI / 180;
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
// Okponglo (5.6350, -0.1850) vs East Legon (5.6360, -0.1610) — roughly 2.7km apart in reality
console.log('Okponglo -> East Legon (km):', haversineKm(5.6350, -0.1850, 5.6360, -0.1610).toFixed(2));
// same point should be ~0
console.log('same point (km):', haversineKm(5.6350, -0.1850, 5.6350, -0.1850).toFixed(4));
"
```
Expected: first line prints roughly `2.6` to `2.8` (matches the real-world distance between these two neighbourhoods), second line prints `0.0000`. If either is wildly off (e.g. negative, NaN, or off by orders of magnitude), the formula has a bug — fix `haversineKm` in `geo.ts` before proceeding.

- [ ] **Step 3: Typecheck citizen**

```bash
cd /Users/oneplan/personal/school-work/fixmycity/citizen && yarn tsc -b
```
Expected: `Done`, no errors (the `ReportFlow.tsx` type error from Task 3 persists until Task 8, as noted previously).

- [ ] **Step 4: Commit**

```bash
cd /Users/oneplan/personal/school-work/fixmycity
git add citizen/src/lib/geo.ts
git commit -m "Add nearest-neighbourhood and reverse-geocoding helpers"
```

---

## Task 7: Create citizen `LocationPicker` component

**Files:**
- Create: `citizen/src/components/LocationPicker.tsx`

**Interfaces:**
- Consumes: `GEO`, `LocationName` (`citizen/src/lib/store.tsx`), `nearestLocation`, `reverseGeocode` (Task 6), `Icon` (existing component).
- Produces: `LocationPicker` component with props `{ location: LocationName; onLocationChange: (loc: LocationName) => void; onPositionChange: (lat: number, lng: number) => void; height?: number }` — consumed by Task 8 (`ReportFlow.tsx`).

- [ ] **Step 1: Write `citizen/src/components/LocationPicker.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import type { LeafletEvent } from 'leaflet';
import L from 'leaflet';
import Icon from './Icon.tsx';
import { GEO } from '../lib/store.tsx';
import type { LocationName } from '../lib/store.tsx';
import { nearestLocation, reverseGeocode } from '../lib/geo.ts';

interface LocationPickerProps {
  location: LocationName;
  onLocationChange: (loc: LocationName) => void;
  onPositionChange: (lat: number, lng: number) => void;
  height?: number;
}

const PIN_ICON = L.divIcon({
  html: renderToStaticMarkup(
    <Icon name="MapPin" size={32} strokeWidth={2.5} style={{ color: '#1E5F8E', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.3))' }} />,
  ),
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

/* Invisible helper: re-centers the map whenever `position` changes (react-leaflet
   does not do this automatically from the MapContainer `center` prop after mount). */
function RecenterOnChange({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(position); }, [position, map]);
  return null;
}

/* Invisible helper: tapping anywhere on the map moves the pin there. */
function ClickHandler({ onMove }: { onMove: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) { onMove(e.latlng.lat, e.latlng.lng); },
  });
  return null;
}

/* Geolocate-on-mount + draggable/clickable pin for precise report-submission
   location. Fails soft throughout: a denied/unavailable/timed-out geolocation
   falls back silently to the given area's centroid; a failed reverse-geocode
   just leaves the address hint blank. Neither ever blocks interaction. */
export default function LocationPicker({ location, onLocationChange, onPositionChange, height = 160 }: LocationPickerProps) {
  const [position, setPosition] = useState<[number, number]>(() => {
    const g = GEO[location];
    return [g.lat, g.lng];
  });
  const [hint, setHint] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);
  // guards against LocationPicker's own nearest-neighbourhood update to
  // `location` re-triggering the "dropdown changed externally" recenter effect
  // below, which would otherwise snap a precisely-dragged pin back to a
  // neighbourhood's centroid.
  const skipNextRecenter = useRef(false);

  function movePin(lat: number, lng: number) {
    setPosition([lat, lng]);
    onPositionChange(lat, lng);
    setHint(null);

    const nearest = nearestLocation(lat, lng);
    if (nearest !== location) {
      skipNextRecenter.current = true;
      onLocationChange(nearest);
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    const seq = ++requestSeq.current;
    debounceRef.current = setTimeout(() => {
      reverseGeocode(lat, lng)
        .then(address => { if (seq === requestSeq.current) setHint(address); })
        .catch(() => { /* fail soft: leave the hint blank */ });
    }, 400);
  }

  // geolocate once on mount; silently keep the default position on any failure
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => movePin(pos.coords.latitude, pos.coords.longitude),
      () => { /* denied/unavailable: keep the default position */ },
      { enableHighAccuracy: false, timeout: 5000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- geolocate once on mount only
  }, []);

  // the citizen picked a different area from the dropdown: recenter the pin
  // to that area's centroid, unless this `location` change was itself caused
  // by the pin moving (see skipNextRecenter above).
  useEffect(() => {
    if (skipNextRecenter.current) {
      skipNextRecenter.current = false;
      return;
    }
    const g = GEO[location];
    setPosition([g.lat, g.lng]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally excludes movePin/onPositionChange, only reacts to `location`
  }, [location]);

  return (
    <div>
      <div className="rounded-xl overflow-hidden ring-1 ring-black/5" style={{ height }}>
        <MapContainer center={position} zoom={15} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker
            position={position}
            icon={PIN_ICON}
            draggable
            eventHandlers={{
              dragend: (e: LeafletEvent) => {
                const p = (e.target as L.Marker).getLatLng();
                movePin(p.lat, p.lng);
              },
            }}
          />
          <RecenterOnChange position={position} />
          <ClickHandler onMove={movePin} />
        </MapContainer>
      </div>
      {hint && <p className="text-[11px] text-muted mt-1.5 px-1">Near: {hint}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck citizen**

```bash
cd /Users/oneplan/personal/school-work/fixmycity/citizen && yarn tsc -b
```
Expected: `Done`, no errors in the new file (the pre-existing `ReportFlow.tsx` error persists until Task 8).

- [ ] **Step 3: Commit**

```bash
cd /Users/oneplan/personal/school-work/fixmycity
git add citizen/src/components/LocationPicker.tsx
git commit -m "Add LocationPicker component with geolocation and reverse geocoding"
```

---

## Task 8: Wire `LocationPicker` into the citizen report flow

**Files:**
- Modify: `citizen/src/lib/store.tsx`
- Modify: `citizen/src/screens/ReportFlow.tsx`

**Interfaces:**
- Consumes: `LocationPicker` (Task 7), `GEO` (existing, `store.tsx`).
- Produces: `ReportDraft.lat: number`, `ReportDraft.lng: number` — used only within `submitReport`.

- [ ] **Step 1: Add `lat`/`lng` to `ReportDraft` and thread through `submitReport`**

In `citizen/src/lib/store.tsx`, update the `ReportDraft` interface:

```ts
export interface ReportDraft {
  category: CategoryName;
  location: LocationName;
  lat: number;
  lng: number;
  description: string;
  photo: File;
  aiSuggestedCategory?: CategoryName;
  aiConfidence?: number;
}
```

Then in `submitReport`, replace the `GEO`-derived lat/lng with the draft's own precise coordinates. Find:

```ts
      const geo = GEO[draft.location];
      const { data, error } = await supabase.functions.invoke('submit-report', {
        body: {
          category: CATEGORY_TO_DB[draft.category],
          location_name: draft.location,
          lat: geo.lat,
          lng: geo.lng,
          description: draft.description,
          photo_path: path,
          ai_suggested_category: draft.aiSuggestedCategory ? CATEGORY_TO_DB[draft.aiSuggestedCategory] : undefined,
          ai_confidence: draft.aiConfidence,
        },
      });
```

Replace with:

```ts
      const { data, error } = await supabase.functions.invoke('submit-report', {
        body: {
          category: CATEGORY_TO_DB[draft.category],
          location_name: draft.location,
          lat: draft.lat,
          lng: draft.lng,
          description: draft.description,
          photo_path: path,
          ai_suggested_category: draft.aiSuggestedCategory ? CATEGORY_TO_DB[draft.aiSuggestedCategory] : undefined,
          ai_confidence: draft.aiConfidence,
        },
      });
```

(`GEO` remains exported from `store.tsx` — it's still used by `LocationPicker.tsx` and `geo.ts` for area centroids.)

- [ ] **Step 2: Replace the map+dropdown block in `ReportFlow.tsx`**

First, update the imports at the top of `citizen/src/screens/ReportFlow.tsx` — replace:

```tsx
import { useStore, CATEGORIES, COORDS } from '../lib/store.tsx';
import type { AiSuggestion, CategoryName, LocationName } from '../lib/store.tsx';
import Icon from '../components/Icon.tsx';
import Btn from '../components/Btn.tsx';
import StatusPill from '../components/StatusPill.tsx';
import CategoryBadge from '../components/CategoryBadge.tsx';
import ProgressBar from '../components/ProgressBar.tsx';
import MapPlaceholder from '../components/MapPlaceholder.tsx';
```

with:

```tsx
import { useStore, CATEGORIES, GEO } from '../lib/store.tsx';
import type { AiSuggestion, CategoryName, LocationName } from '../lib/store.tsx';
import Icon from '../components/Icon.tsx';
import Btn from '../components/Btn.tsx';
import StatusPill from '../components/StatusPill.tsx';
import CategoryBadge from '../components/CategoryBadge.tsx';
import ProgressBar from '../components/ProgressBar.tsx';
import LocationPicker from '../components/LocationPicker.tsx';
```

Add a `position` state alongside the existing `location` state (find `const [location, setLocation] = useState<LocationName>('Okponglo');` and add immediately after it):

```tsx
  const [location, setLocation] = useState<LocationName>('Okponglo');
  const [position, setPosition] = useState(() => GEO['Okponglo']);
```

Update `submit()` to pass the precise position through:

```tsx
  async function submit() {
    if (!category || !photo || busy) return;
    setBusy(true);
    setError(null);
    const { report, error: submitError } = await submitReport({
      category, location, lat: position.lat, lng: position.lng, description: desc, photo,
      aiSuggestedCategory: aiSuggestion?.category,
      aiConfidence: aiSuggestion?.confidence,
    });
    setBusy(false);
    if (submitError || !report) {
      setError(submitError ?? 'Could not submit the report. Please try again.');
      return;
    }
    setNewId(report.id);
    setStep(3);
  }
```

Finally, replace the entire "map" block (the `<div>` containing the old `MapPlaceholder` + overlaid dropdown, currently right after the AI-suggestion banner block and before the description field):

```tsx
          {/* map */}
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wide">Location</label>
            <div className="mt-1.5 relative rounded-xl overflow-hidden ring-1 ring-black/5">
              <MapPlaceholder reports={[{ id: 'new', category, location, status: 'Submitted', description: '', crew: null, hasPhoto: !!photo, timeline: [] }]} height={130} rounded="" activeId="new" />
              <div className="absolute inset-x-0 bottom-0 bg-white/95 backdrop-blur px-3 py-2 flex items-center gap-2">
                <Icon name="MapPin" size={15} className="text-ocean" />
                <select value={location} onChange={e => setLocation(e.target.value as LocationName)}
                  className="flex-1 bg-transparent text-sm font-medium text-ink focus:outline-none">
                  {Object.keys(COORDS).map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <p className="text-[11px] text-muted mt-1">Pin auto-detected near Okponglo. Adjust if needed.</p>
          </div>
```

with:

```tsx
          {/* location */}
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wide">Location</label>
            <div className="mt-1.5">
              <LocationPicker
                location={location}
                onLocationChange={setLocation}
                onPositionChange={(lat, lng) => setPosition({ lat, lng })}
                height={160}
              />
            </div>
            <div className="mt-1.5 flex items-center gap-2 bg-white rounded-xl ring-1 ring-black/5 px-3 py-2">
              <Icon name="MapPin" size={15} className="text-ocean shrink-0" />
              <select value={location} onChange={e => setLocation(e.target.value as LocationName)}
                className="flex-1 bg-transparent text-sm font-medium text-ink focus:outline-none">
                {Object.keys(GEO).map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
            <p className="text-[11px] text-muted mt-1">Drag the pin or tap the map to set a precise spot — we'll match the nearest area automatically.</p>
          </div>
```

- [ ] **Step 3: Typecheck and lint citizen**

```bash
cd /Users/oneplan/personal/school-work/fixmycity/citizen && yarn tsc -b && yarn lint
```
Expected: `tsc -b` now fully clean (the `ReportFlow.tsx` type error from Task 3, caused by the old inline `MapPlaceholder` literal missing `lat`/`lng`, is resolved since that literal is gone). Lint: only the same pre-existing `PhotoBox.tsx` violation as before, nothing new.

- [ ] **Step 4: Commit**

```bash
cd /Users/oneplan/personal/school-work/fixmycity
git add citizen/src/lib/store.tsx citizen/src/screens/ReportFlow.tsx
git commit -m "Wire LocationPicker into citizen report submission flow"
```

---

## Task 9: Delete dead `MapPlaceholder` and `COORDS`

**Files:**
- Delete: `citizen/src/components/MapPlaceholder.tsx`, `console/src/components/MapPlaceholder.tsx`
- Modify: `citizen/src/lib/store.tsx`, `console/src/lib/store.tsx`

**Interfaces:**
- None (pure removal — by this point in the plan, nothing references either symbol).

- [ ] **Step 1: Confirm nothing still references them**

```bash
cd /Users/oneplan/personal/school-work/fixmycity
grep -rln "MapPlaceholder" citizen/src console/src
grep -rln "\bCOORDS\b" citizen/src console/src
```
Expected: the first command lists only the two `MapPlaceholder.tsx` files themselves (their own definitions, no importers left); the second lists only the two `store.tsx` files' own `export const COORDS = ...` lines (no importers left). If either command shows a file other than these definitions, stop — something still depends on it and must be migrated first (re-check Tasks 5 and 8 were fully applied).

- [ ] **Step 2: Delete both `MapPlaceholder.tsx` files**

```bash
git rm citizen/src/components/MapPlaceholder.tsx console/src/components/MapPlaceholder.tsx
```

- [ ] **Step 3: Remove `COORDS` from both `store.tsx` files**

In `citizen/src/lib/store.tsx`, delete the `COORDS` export block:

```ts
// percent within the stylised map frame (placeholder map)
export const COORDS: Record<LocationName, { x: number; y: number }> = {
  'East Legon':                    { x: 63, y: 71 },
  'Okponglo':                      { x: 50, y: 52 },
  'Dzorwulu':                      { x: 47, y: 45 },
  'Abelemkpe':                     { x: 76, y: 20 },
  'Airport Residential Area':      { x: 38, y: 24 },
  'Roman Ridge':                   { x: 33, y: 56 },
  'Shiashie':                      { x: 73, y: 73 },
  'Legon (near University of Ghana)': { x: 41, y: 67 },
};
```

Delete this entire block (and its `// real-world coordinates...` comment separator, if it becomes redundant — leave the `GEO` export immediately below it untouched).

In `console/src/lib/store.tsx`, delete the equivalent `COORDS` export block (same shape, under the `/* ---- Map coordinates (percent within map frame) ---- */` comment).

- [ ] **Step 4: Typecheck and lint both apps**

```bash
cd /Users/oneplan/personal/school-work/fixmycity/citizen && yarn tsc -b && yarn lint
cd /Users/oneplan/personal/school-work/fixmycity/console && yarn tsc -b && yarn lint
```
Expected: both `tsc -b` clean. Lint: same two pre-existing violations as before (console's `DetailPanel.tsx`/citizen's `PhotoBox.tsx`), nothing new.

- [ ] **Step 5: Commit**

```bash
cd /Users/oneplan/personal/school-work/fixmycity
git add -A citizen/src/components console/src/components citizen/src/lib/store.tsx console/src/lib/store.tsx
git commit -m "Remove MapPlaceholder and COORDS, superseded by Leaflet maps"
```

---

## Task 10: Deploy and verify end-to-end

**Files:** none (deployment + verification only).

- [ ] **Step 1: Confirm the hosted project already has the migration**

(Applied in Task 1, Step 3 — this step just re-confirms before final verification.) Use the Supabase MCP `execute_sql` tool with `project_id: hvesugctansssxwtzjqn`:

```sql
select column_name from information_schema.columns where table_name='reports' and column_name in ('lat','lng');
```
Expected: two rows (`lat`, `lng`).

- [ ] **Step 2: Drive both apps with the `verify` skill**

Invoke the project's `verify` skill to check, in order:
1. Citizen Map tab: real OSM tiles render, pins appear at each seeded report's actual coordinates (not stacked per-area), clicking a pin navigates to that report's detail page.
2. Citizen new-report flow (step 2): the location picker attempts geolocation (grant or deny browser permission during the drive — both paths should work without error), the pin can be dragged/tapped to a new spot, the location dropdown updates to match the nearest neighbourhood, and (network permitting) an address hint appears below the map. Submit a test report and confirm its `lat`/`lng` in the database reflect the picked position (not a fixed area centroid) via `execute_sql`.
3. Console Map view: same tile/pin checks as the citizen Map tab, using `openRow` navigation instead.
4. Console detail panel: opening any report shows a correctly-positioned single-pin mini-map at that report's real coordinates.
5. No new browser console errors beyond expected network noise (e.g. an OSM tile occasionally 429s under heavy local testing — acceptable, Leaflet just leaves that tile blank).

- [ ] **Step 3: Clean up any test data created during verification**

If Step 2 created a test report, delete it (and its status_transitions row, disabling the append-only trigger around the delete, matching the pattern used in milestone 5's verification):

```sql
alter table status_transitions disable trigger transitions_append_only;
delete from reports where description like 'E2E%';
alter table status_transitions enable trigger transitions_append_only;
```

- [ ] **Step 4: Final full-repo typecheck and lint sweep**

```bash
cd /Users/oneplan/personal/school-work/fixmycity/citizen && yarn tsc -b && yarn lint
cd /Users/oneplan/personal/school-work/fixmycity/console && yarn tsc -b && yarn lint
```
Expected: both clean except the same two pre-existing, unrelated lint violations noted throughout this plan.

- [ ] **Step 5: Push**

```bash
cd /Users/oneplan/personal/school-work/fixmycity
git push origin master
```
