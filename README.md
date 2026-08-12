# FixMyCity

A civic issue-reporting platform for Ghana. Residents of the pilot municipality report
local problems (with a photo and a map pin), and the municipal assembly tracks every
report through a closed-loop workflow until it is resolved — with the citizen notified
at every step.

Built by group **Zero Down Time** as the CSCD 602 (Advanced Software Engineering, MSc)
capstone project at the University of Ghana.

**Live:** citizen app → https://fixmycity-citizen.vercel.app · operations console →
https://fixmycity-console.vercel.app

> **Project status:** see [docs/TRACKER.md](docs/TRACKER.md) for the full build log.
> Capstone deliverables (SRS, design document, testing report, user manual, maintenance
> plan) live under [docs/](docs/) — see the Documentation section below.

## Pilot scope

- **Municipality:** Ayawaso West Municipal Assembly (AWMA), Greater Accra
- **Issue categories:** Illegal Dumping, Blocked Drain, Broken Streetlight, Flooding,
  Pothole, Pollution, Broken Public Facility, Poor Sanitation, Other
- **User roles:** Citizen, Reports Officer, Field Crew, Administrator (the console
  further presents Administrator/Supervisor/Officer/Dispatcher/Viewer/Field Crew as a
  finer-grained `console_role`)
- **Delivery:** Progressive Web App (no native apps in this iteration)

The core idea is a *closed loop*: every report moves through a strict status flow —

```
Submitted -> Acknowledged -> Assigned -> In Progress -> Resolved
```

with two branches: **Rejected** (a reason is required, legal from any open status) and
**Reopened** (the citizen can reopen a Resolved report within 7 days, at which point it
re-enters the flow). Every transition is timestamped, audit-logged, and triggers a
citizen notification — enforced entirely server-side, never by a client writing a
status directly.

## What's actually built

- **Real, working backend.** Supabase (Postgres + PostGIS + Auth + Storage + Edge
  Functions), not a demo store. Every write path — report submission, status
  transitions, crew/user management — goes through a server function that validates
  the request and writes an append-only audit row.
- **AI-assisted reporting.** Report photos are classified and screened for duplicates
  by an external computer-vision service at submission time. A strong duplicate of
  another citizen's open report doesn't create a second report — it offers the citizen
  a **follow** instead, and every follower gets every subsequent status notification.
  Officers work a Duplicate-Review queue to resolve or merge CV-flagged candidate
  pairs, without that ever directly changing a report's status.
- **Server-authoritative AWMA jurisdiction gate.** A real OpenStreetMap boundary
  polygon (point-in-polygon, not a loose bounding box) rejects reports outside the
  pilot municipality before they're ever created.
- **Row-Level Security everywhere.** Citizens see their own (and followed) reports;
  staff see everything; field crew see only what's assigned to their crew; no table
  grants direct write access to a client role.
- **Role-based console.** Administrator / Supervisor / Officer / Dispatcher / Viewer /
  Field Crew each get a different slice of the workflow, enforced both in the UI and
  inside the edge functions.

See [docs/NOTABLE_FEATURES.md](docs/NOTABLE_FEATURES.md) for a deeper, requirement-
traced writeup of the most defensible engineering decisions, and
[docs/testing/TESTING_REPORT.md](docs/testing/TESTING_REPORT.md) for live evidence
(not just descriptions) that all of the above actually works.

## Monorepo layout

```
fixmycity/
├── citizen/     # Citizen mobile PWA  — React + Vite + TS + Tailwind v4  (port 5173)
├── console/     # AWMA operations console (desktop web) — React + Vite + TS (port 5174)
├── supabase/    # migrations (18) + edge functions (10) + seed data
├── docs/        # SRS, design document, testing report, user manual, maintenance plan
└── package.json # root dev tooling (supabase CLI)
```

Both front-ends are TypeScript (strict mode) and run against the real Supabase
backend — no mock/in-memory data path exists.

## Prerequisites

- Node.js 20+
- Yarn 1 (classic) — **this repo uses yarn only; do not use npm**

## Getting started

Each app has its own dependencies and lockfile:

```bash
# citizen app (mobile PWA)
cd citizen
yarn install
yarn dev          # http://localhost:5173

# operations console (desktop)
cd console
yarn install
yarn dev          # http://localhost:5174
```

Both apps need a `.env` file (git-ignored) with:

```
VITE_SUPABASE_URL=<your Supabase project URL>
VITE_SUPABASE_ANON_KEY=<your Supabase anon/publishable key>
```

Sign-in is real Supabase Auth (email + password) — there's no demo bypass. Test
account credentials for this pilot are provided separately with the capstone
submission package (not committed here, since this repository is public); a
teammate can also seed their own local accounts via `supabase/seed/demo-users.sql`
against a project they control.

### Other scripts (run inside `citizen/` or `console/`)

```bash
yarn build        # type-check (tsc -b) + production build
yarn test         # Vitest unit suite
yarn lint         # eslint
yarn preview      # serve the production build locally
```

### Supabase CLI

The Supabase CLI is a root dev dependency — no global install needed:

```bash
yarn install      # once, at the repo root
yarn supabase <command>
```

## Tech stack

| Layer | Choice |
| --- | --- |
| Front-end | React 19, TypeScript (strict), Vite, Tailwind CSS v4 |
| Routing | react-router-dom v7 |
| Icons | lucide-react |
| PWA | vite-plugin-pwa (citizen app only; console is a desktop-only tool) |
| Backend | Supabase — Postgres (+ PostGIS, pgvector present but currently dormant), Auth, Storage, 10 Deno Edge Functions |
| AI | External computer-vision microservice (photo classification + perceptual-hash duplicate detection), reached through an anti-corruption adapter |
| Maps | Leaflet + OpenStreetMap (both apps; no paid API key) |
| Email | Resend (transactional notification emails) |
| Hosting | Vercel — both apps deployed; GitHub Actions CI still outstanding |
| Testing | Vitest (50 unit tests across both apps); see the Testing Report for live integration/security evidence |

## Documentation

The full capstone documentation package lives under `docs/`:

| Document | Covers |
| --- | --- |
| [docs/srs/SRS.md](docs/srs/SRS.md) | Software Requirements Specification (v2.0) |
| [docs/design/DESIGN_DOCUMENT.md](docs/design/DESIGN_DOCUMENT.md) | Architecture, use-case/ER/class/sequence/state/component diagrams |
| [docs/design/UI_SCREENSHOTS.md](docs/design/UI_SCREENSHOTS.md) | Real captured screens from both live apps |
| [docs/testing/TESTING_REPORT.md](docs/testing/TESTING_REPORT.md) | Unit, integration, system, and security test evidence |
| [docs/USER_MANUAL.md](docs/USER_MANUAL.md) | Per-role usage guide (Citizen, Reports Officer, Field Crew, Administrator) |
| [docs/MAINTENANCE_AND_EVOLUTION.md](docs/MAINTENANCE_AND_EVOLUTION.md) | Maintenance strategy and future roadmap |
| [docs/TRACKER.md](docs/TRACKER.md) | Living build log — the single source of truth for current status |
| [docs/NOTABLE_FEATURES.md](docs/NOTABLE_FEATURES.md) | Defensible engineering highlights, requirement-traced |
| [docs/GROUP_INFO.md](docs/GROUP_INFO.md) | Group/member roster |

## Known limitations

- Offline support is app-shell only (no offline report queueing yet).
- No web push (FCM) — realtime in-app + email cover notifications this iteration.
- Category/SLA configuration is not implemented (categories are a fixed schema enum).
- No GitHub Actions CI yet; edge-function (Deno) and Playwright E2E test suites are
  future work — the current suite is Vitest unit tests only.

See `docs/MAINTENANCE_AND_EVOLUTION.md` for the full list and roadmap.

## Conventions

- Yarn only — never npm (no `package-lock.json`).
- Never commit `.env`.
- Status changes must go through the server-side state machine (never write statuses
  directly from a client) — this is enforced by database grants, not just convention.
- Small, reviewable commits; plain-text commit messages (short imperative subject,
  no emojis or special characters).
