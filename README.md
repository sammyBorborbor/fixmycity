# FixMyCity

A civic issue-reporting platform for Ghana. Residents of the pilot municipality report
local problems (with a photo and a map pin), and the municipal assembly tracks every
report through a closed-loop workflow until it is resolved — with the citizen notified
at every step.

Built by group **Zero Down Time** as the CSCD 602 (Advanced Software Engineering, MSc)
capstone project at the University of Ghana.

## Pilot scope

- **Municipality:** Ayawaso West Municipal Assembly (AWMA), Greater Accra
- **Issue categories:** Illegal Dumping, Blocked Drain, Broken Streetlight
- **User roles:** Citizen, Reports Officer, Field Crew, Administrator
- **Delivery:** Progressive Web App (no native apps in this iteration)

The core idea is a *closed loop*: every report moves through a strict status flow —

```
Submitted -> Acknowledged -> Assigned -> In Progress -> Resolved
```

with two branches: **Rejected** (a reason is required) and **Reopened** (the citizen can
reopen a Resolved report within 7 days). Every transition is timestamped, audit-logged,
and triggers a citizen notification.

## Monorepo layout

```
fixmycity/
├── citizen/     # Citizen mobile PWA  — React + Vite + TS + Tailwind v4  (port 5173)
├── console/     # AWMA operations console (desktop web) — React + Vite + TS (port 5174)
├── supabase/    # Supabase project: migrations + edge functions (in progress)
└── package.json # root dev tooling (supabase CLI)
```

Both front-ends are TypeScript (strict mode) and currently run against an **in-memory
demo store** with seeded reports. Wiring to Supabase (Postgres, Auth, Storage, Edge
Functions) is the next milestone — the store functions are marked with
`TODO: replace with supabase`.

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

Demo sign-in (no real auth yet — any password works):

- **Citizen app:** prefilled as `ama.asante@gmail.com`
- **Console:** prefilled as `akua.osei@aywma.gov.gh`

Auth is in-memory for now, so a full page reload signs you out.

### Other scripts (run inside `citizen/` or `console/`)

```bash
yarn build        # type-check (tsc -b) + production build
yarn lint         # eslint
yarn preview      # serve the production build locally
```

### Supabase CLI

The Supabase CLI is a root dev dependency — no global install needed:

```bash
yarn install      # once, at the repo root
yarn supabase <command>
```

### Environment variables

The apps will read `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from a git-ignored
`.env` file in each app directory once the backend is wired up. No env vars are needed
to run the current demo build.

## Tech stack

| Layer      | Choice                                                        |
| ---------- | ------------------------------------------------------------- |
| Front-end  | React 19, TypeScript (strict), Vite, Tailwind CSS v4          |
| Routing    | react-router-dom v7                                           |
| Icons      | lucide-react                                                  |
| PWA        | vite-plugin-pwa (citizen app only)                            |
| Backend    | Supabase: Postgres (+ PostGIS, pgvector), Auth, Storage, Edge Functions |
| Maps       | Leaflet + OpenStreetMap (planned; stylised placeholder today) |
| Hosting    | Vercel (planned), GitHub Actions CI (planned)                 |

## Roadmap

1. Database schema + row-level security + seed script
2. Real auth and end-to-end report submission (photo -> storage -> DB -> reference)
3. `transition-report` edge function (the server-side state machine) + console wiring
4. Notifications (in-app realtime + email) — closes the loop
5. AI features: photo auto-categorisation and duplicate detection (PostGIS + pgvector)
6. PWA polish, Leaflet maps, deployment

## Conventions

- Yarn only — never npm (no `package-lock.json`).
- Never commit `.env`.
- Status changes must go through the server-side state machine (never write statuses
  directly from a client).
- Small, reviewable commits; plain-text commit messages (short imperative subject,
  no emojis or special characters).
