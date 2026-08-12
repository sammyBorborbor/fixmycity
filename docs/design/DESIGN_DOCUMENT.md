# FixMyCity — System Analysis & Design Document

CSCD 602 Capstone — Group Zero Down Time. Companion to `docs/srs/SRS.md` (the
requirements) and `CLAUDE.md` (the living project brief). See `docs/GROUP_INFO.md`
for the group/member roster.

**Provenance note:** every diagram below is derived directly from the shipped code —
`supabase/migrations/*.sql` (18 migrations) and `supabase/functions/*` (10 edge
functions) — not from prose descriptions, which can drift out of date as the system
evolves. Where CLAUDE.md's own architecture prose is now stale (most notably: image
classification and duplicate detection are handled by an external computer-vision
microservice rather than an in-house Claude-vision call or PostGIS/pgvector pipeline,
and six edge functions exist that CLAUDE.md doesn't mention), these diagrams follow
the real system.

---

## 1. System Architecture

FixMyCity is a three-tier system: two independently deployed React PWAs sharing one
Supabase backend, plus one external AI microservice the team does not own.

```mermaid
flowchart TB
    subgraph Clients["Client tier"]
        Citizen["Citizen App\nReact + Vite + Tailwind\nvite-plugin-pwa · Vercel · :5173"]
        Console["Operations Console\nReact + Vite + Tailwind\nno PWA · Vercel · :5174"]
    end

    subgraph Supabase["Supabase project"]
        Auth["Auth\n(JWT, email/password)"]
        EdgeFns["Edge Functions (Deno)\nsubmit-report · transition-report\ncancel-report · follow-report · unfollow-report\nmanage-users · manage-crews\ncheck-duplicates · duplicate-reviews\nclassify-image (dormant stub)"]
        DB[("Postgres\n+ PostGIS (dormant use)\n+ pgvector (dormant use)")]
        Storage["Storage\n(report-photos bucket, private)"]
        Realtime["Realtime\n(reports, notifications)"]
    end

    CV["External CV microservice\n(teammate-owned, HTTP API)\nclassification · perceptual-hash dedup\nduplicate-review queue"]
    Resend["Resend\n(transactional email)"]
    OSM["OpenStreetMap tiles\n(Leaflet / react-leaflet)"]

    Citizen -->|HTTPS JSON| EdgeFns
    Citizen -->|auth| Auth
    Citizen -->|signed URLs| Storage
    Citizen -->|subscribe| Realtime
    Citizen --> OSM

    Console -->|HTTPS JSON| EdgeFns
    Console -->|auth| Auth
    Console -->|direct RLS reads:\nprofiles, crews, reports| DB
    Console -->|subscribe| Realtime
    Console --> OSM

    EdgeFns --> DB
    EdgeFns --> Storage
    EdgeFns -->|classify + dedup| CV
    EdgeFns -->|transactional email| Resend
    Realtime -.->|RLS-scoped change feed| DB
```

**Why two client apps talk to Postgres two different ways.** Citizen writes always go
through an edge function (`submit-report`, `cancel-report`, `follow-report`, …) because
every write needs server-side validation (AWMA jurisdiction gate, CV classification,
duplicate blocking) that can't be trusted to the client. Console reads for
low-stakes directory views (Citizens list, Crews list) go straight to Postgres under
RLS, because there's no business logic to enforce beyond "is this caller staff" — RLS
already answers that. Console *writes* still go through edge functions
(`manage-users`, `manage-crews`, `transition-report`) for the same reason as citizen
writes: authorization and audit-logging can't live in the client.

**Technology architecture (deployment view).** Citizen and Console are separate Vercel
projects (Citizen is live; Console is not yet deployed — see the Deployment doc).
Supabase hosts Postgres/Auth/Storage/Edge-Functions/Realtime as one managed project.
The CV microservice and Resend are external, reached over HTTPS with an API key
(`IMAGE_MODEL_URL`/`IMAGE_MODEL_API_KEY`, `RESEND_API_KEY`). No component is unique to
a single cloud provider by design (Postgres, Deno edge functions, and static React
builds are all portable).

---

## 2. Use-Case Diagram

Mermaid has no native UML use-case notation; actors are drawn as boxes on the left,
use cases as rounded/stadium nodes grouped by subsystem.

```mermaid
flowchart LR
    Citizen(["🧑 Citizen"])
    Officer(["🧑‍💼 Reports Officer"])
    Crew(["👷 Field Crew"])
    Admin(["🛡️ Administrator"])
    CVSvc(["🤖 External CV Service"])

    subgraph CitizenApp["Citizen App use cases"]
        UC1(("Register / Sign in"))
        UC2(("Submit a report"))
        UC3(("Track my reports"))
        UC4(("Follow a duplicate report"))
        UC5(("Cancel a submitted report"))
        UC6(("Reopen a resolved report\n(within 7 days)"))
        UC7(("View public issues map"))
        UC8(("Manage profile"))
    end

    subgraph ConsoleStaff["Console use cases — staff"]
        UC10(("Triage inbox"))
        UC11(("View report detail"))
        UC12(("Acknowledge report"))
        UC13(("Assign report to crew"))
        UC14(("Reject report"))
        UC15(("Review duplicate-review queue"))
        UC16(("View citizens directory"))
        UC17(("View analytics"))
    end

    subgraph ConsoleAdmin["Console use cases — Administrator/Supervisor/Dispatcher"]
        UC20(("Manage crews"))
        UC21(("Manage users & roles"))
    end

    subgraph ConsoleCrew["Console use cases — Field Crew"]
        UC30(("View assigned reports"))
        UC31(("Mark In Progress"))
        UC32(("Mark Resolved\n+ resolution photo"))
    end

    Citizen --> UC1 & UC2 & UC3 & UC4 & UC5 & UC6 & UC7 & UC8
    Officer --> UC10 & UC11 & UC12 & UC13 & UC14 & UC15 & UC16 & UC17
    Admin --> UC10 & UC11 & UC12 & UC13 & UC14 & UC15 & UC16 & UC17 & UC20 & UC21
    Crew --> UC30 & UC31 & UC32

    UC2 -.->|classifies + dedup-checks| CVSvc
    UC15 -.->|resolution/merge proxied to| CVSvc
```

Note: `Dispatcher` (a `console_role`) may only perform `Acknowledge` and `Assign`
among the staff actions; `Viewer` may perform none — both are narrower slices of the
"Reports Officer" actor above, not separate actors, since they share the same use
cases with a reduced permission set enforced server-side in `transition-report`.

---

## 3. Class Diagram (Conceptual Domain Model)

This is a conceptual/domain model, not a 1:1 mirror of the physical schema (Section 6
covers that) — it expresses the system's behaviour in OOP terms for readability, even
though the real implementation is serverless functions over Postgres rather than a
class hierarchy.

```mermaid
classDiagram
    class User {
        <<abstract>>
        +UUID id
        +String fullName
        +String email
        +String phone
        +Status status
    }
    class Citizen
    class ReportsOfficer {
        +ConsoleRole consoleRole
    }
    class FieldCrew {
        +Crew crew
    }
    class Administrator

    User <|-- Citizen
    User <|-- ReportsOfficer
    User <|-- FieldCrew
    User <|-- Administrator

    class Report {
        +UUID id
        +String reference
        +Category category
        +String description
        +GeoPoint location
        +String locationName
        +ReportStatus status
        +String[] photoUrls
        +submit(category, photo, location, description)
        +acknowledge(actor)
        +assign(actor, crew)
        +reject(actor, reason, duplicateOf?)
        +start(actor)
        +resolve(actor, resolutionPhoto)
        +reopen(citizen)
        +cancel(citizen)
    }

    class Crew {
        +UUID id
        +String name
        +Department department
        +Boolean available
        +Int memberCount
    }

    class StatusTransition {
        +ReportStatus fromStatus
        +ReportStatus toStatus
        +User actor
        +String note
        +DateTime occurredAt
    }

    class Notification {
        +String type
        +String body
        +Boolean read
    }

    class ReportFollower {
        +DateTime followedAt
    }

    class DuplicateOffer {
        +DateTime offeredAt
    }

    class CvVerdict {
        <<external, via CV microservice>>
        +Category suggestedCategory
        +Float confidence
        +String duplicateStatus
        +JSON detectedObjects
        +String perceptualHash
    }

    Citizen "1" --> "0..*" Report : submits
    Report "1" --> "0..*" StatusTransition : audited by
    Report "0..1" --> "1" Crew : assignedTo
    Crew "1" --> "0..*" FieldCrew : hasMembers
    Report "1" --> "0..*" Notification : triggers
    User "1" --> "0..*" Notification : receives
    Report "1" --> "0..*" ReportFollower : followedVia
    Citizen "1" --> "0..*" ReportFollower : follows
    Report "1" --> "0..*" DuplicateOffer : offeredVia
    Citizen "1" --> "0..*" DuplicateOffer : offeredTo
    Report "0..1" ..> "1" CvVerdict : classifiedBy
    Report "0..1" --> "0..1" Report : duplicateOf (via StatusTransition)
```

---

## 4. Sequence Diagrams

### 4.1 Citizen submits a report (with AWMA gate, CV classification, and duplicate branch)

```mermaid
sequenceDiagram
    actor C as Citizen
    participant App as Citizen App
    participant Storage as Supabase Storage
    participant Fn as submit-report
    participant CV as External CV Service
    participant DB as Postgres

    C->>App: pick category, take photo, confirm location, describe
    App->>Storage: upload photo (own folder)
    Storage-->>App: storage path
    App->>Fn: POST {category, location, description, photo_paths[]}
    Fn->>Fn: pointInAwma(lat, lng)
    alt outside AWMA
        Fn-->>App: 422 outside_awma
    else inside AWMA
        Fn->>Storage: fetch photo bytes (signed URL)
        Fn->>CV: POST /api/v1/reports (multipart photo)
        CV-->>Fn: {category, confidence, duplicateStatus, detectedObjects, perceptualHash}
        alt not_environmental (and category needs CV)
            Fn-->>App: 422 photo_not_environmental
        else strong duplicate of another citizen's open report
            Fn->>DB: insert duplicate_offers row
            Fn-->>App: 200 {status: duplicate_detected, candidate}
            App-->>C: "Is this the same issue?" screen (UC: Follow a duplicate report)
        else duplicate of caller's own open report
            Fn-->>App: 200 {status: already_reported}
            App-->>C: "You've already reported this" screen
        else new report (or CV unavailable — fail-soft)
            Fn->>DB: insert reports row (status=submitted)
            Fn->>DB: insert status_transitions (null → submitted)
            DB-->>Fn: report row
            Fn-->>App: 200 {report}
            App-->>C: confirmation screen, reference FMC-YYYY-NNNN
        end
    end
```

### 4.2 Reports Officer acknowledges and assigns a report

```mermaid
sequenceDiagram
    actor O as Reports Officer
    participant Console
    participant Fn as transition-report
    participant DB as Postgres
    participant RT as Realtime
    participant Mail as Resend
    actor Cz as Citizen (+ followers)

    O->>Console: open Inbox, filter Submitted, open report
    O->>Fn: POST {action: acknowledge, report_id}
    Fn->>Fn: check role/console_role allow-list, current status legal
    Fn->>DB: update reports.status=acknowledged
    Fn->>DB: insert status_transitions (submitted → acknowledged)
    Fn->>DB: insert notifications for reporter + followers
    Fn->>Mail: send transactional email(s)
    Fn-->>Console: {report}
    DB-->>RT: change event (RLS-scoped)
    RT-->>Cz: realtime notification badge

    O->>Console: click Assign, pick an available crew
    O->>Fn: POST {action: assign, report_id, crew_id}
    Fn->>DB: verify crews.available = true
    Fn->>DB: update reports.status=assigned, assigned_crew_id
    Fn->>DB: insert status_transitions (acknowledged → assigned)
    Fn->>DB: insert notifications for reporter + followers + crew
    Fn->>Mail: send transactional email(s)
    Fn-->>Console: {report}
```

### 4.3 Follow-a-duplicate flow (citizen chooses not to file a second report)

```mermaid
sequenceDiagram
    actor C as Citizen
    participant App as Citizen App
    participant SubmitFn as submit-report
    participant FollowFn as follow-report
    participant DB as Postgres

    C->>App: submits report B (same issue as open report A)
    App->>SubmitFn: POST submit-report
    SubmitFn->>DB: insert duplicate_offers(user=C, report=A)
    SubmitFn-->>App: {status: duplicate_detected, candidate: A}
    App-->>C: "FMC-...-00xx already reports this — follow it instead?"
    C->>App: confirms "Follow this report"
    App->>FollowFn: POST {report_id: A}
    FollowFn->>DB: verify duplicate_offers(user=C, report=A) exists (IDOR gate)
    alt no matching offer row
        FollowFn-->>App: 403 "not offered to you as a duplicate"
    else offer confirmed
        FollowFn->>DB: upsert report_followers(user=C, report=A)
        DB->>DB: trigger bump_follower_count on reports.follower_count
        FollowFn->>DB: best-effort delete C's now-unused uploaded photos
        FollowFn-->>App: {ok: true}
        App-->>C: now tracking A's status timeline
    end
```

**Design note on the `duplicate_offers` gate.** The `report_followers` RLS `select`
policy lets anyone in the table see the report they're following — so without a
gate, `follow-report` would let any authenticated citizen attach themselves as a
follower of *any* report ID they guess, an insecure direct object reference (IDOR).
Requiring a `duplicate_offers` row — which only `submit-report` ever writes, and only
for the specific citizen who was just shown that specific candidate — closes that
hole. This is exactly the "IDOR fix" referenced in `docs/NOTABLE_FEATURES.md`.

---

## 5. Activity / Process Diagrams

### 5.1 Report status lifecycle (state diagram — the system's architectural centre)

```mermaid
stateDiagram-v2
    [*] --> Submitted: submit-report

    Submitted --> Acknowledged: acknowledge\n(staff)
    Submitted --> Assigned: assign\n(staff)
    Submitted --> Rejected: reject\n(staff)

    Acknowledged --> Assigned: assign\n(staff)
    Acknowledged --> Rejected: reject\n(staff)

    Assigned --> InProgress: start\n(staff OR owning crew)
    Assigned --> Rejected: reject\n(staff)

    InProgress --> Resolved: resolve\n(staff OR owning crew)
    InProgress --> Rejected: reject\n(staff)

    Resolved --> Reopened: reopen\n(reporter only, ≤7 days)

    Reopened --> Acknowledged: acknowledge\n(staff)
    Reopened --> Assigned: assign\n(staff)
    Reopened --> Rejected: reject\n(staff)

    Rejected --> [*]
    Resolved --> [*]
```

Every arrow above writes exactly one `status_transitions` row (timestamp + actor +
optional note) inside the same server-side transaction that updates `reports.status`
— if the audit insert fails, `transition-report` reverts the status update, so the
current status and the audit trail can never disagree. `Dispatcher` console-role staff
may only fire `acknowledge`/`assign`; `Viewer` staff may fire none of the staff
transitions — both are enforced inside `transition-report`, never on the client.

### 5.2 Submit-report process (citizen-facing activity view)

```mermaid
flowchart TD
    Start([Citizen taps Report]) --> Cat[Select category]
    Cat --> Photo[Capture / choose photo]
    Photo --> Loc[Confirm location on map]
    Loc --> Desc[Optional description]
    Desc --> Submit[Tap Submit]
    Submit --> AwmaCheck{Inside AWMA\nboundary?}
    AwmaCheck -- No --> Blocked1[Blocked: outside jurisdiction]
    AwmaCheck -- Yes --> CvCall{CV service reachable?}
    CvCall -- No / timeout --> CreateFailSoft["Create report (fail-soft, no AI verdict)"]
    CvCall -- Yes --> EnvCheck{Photo looks\nenvironmental?}
    EnvCheck -- No --> Blocked2[Blocked: retake photo]
    EnvCheck -- Yes --> DupCheck{Strong duplicate\nof an OPEN report?}
    DupCheck -- "Yes, someone else's" --> OfferFollow[Offer: follow existing report]
    DupCheck -- "Yes, my own open report" --> AlreadyReported[Already-reported screen]
    DupCheck -- No --> CreateReport[Create report\nstatus = Submitted]
    OfferFollow --> FollowChoice{Citizen follows\nor submits anyway?}
    FollowChoice -- Follows --> FollowRecorded[report_followers row created]
    FollowChoice -- "Submits anyway (force_create)" --> CreateReport
    CreateReport --> Confirm([Confirmation: reference + Submitted pill])
    CreateFailSoft --> Confirm
```

---

## 6. Entity-Relationship / Data Model

```mermaid
erDiagram
    PROFILES {
        uuid id PK "FK -> auth.users, cascade"
        text full_name
        text phone
        user_role role "citizen|officer|crew|admin"
        uuid crew_id FK "nullable"
        profile_status status "active|suspended"
        text console_role "Administrator|Supervisor|Officer|Dispatcher|Viewer|Field Crew"
        text unit
        text email
        jsonb settings
    }

    CREWS {
        uuid id PK
        text name
        crew_department department "sanitation|drainage|electrical"
        text lead_name
        text phone
        int member_count
        boolean available
    }

    REPORTS {
        uuid id PK
        text reference UK "FMC-YYYY-NNNN, trigger-generated"
        report_category category "9 values"
        text description
        text_array photo_urls
        geography location "PostGIS point, 4326"
        double lat "generated from location"
        double lng "generated from location"
        text location_name
        report_status status "7-state enum"
        uuid reporter_id FK
        uuid assigned_crew_id FK "nullable"
        report_category ai_suggested_category "nullable"
        real ai_confidence "nullable"
        vector embedding "dormant, 512-dim"
        bigint external_report_id "CV service's own id"
        text duplicate_status "new|duplicate|possible_duplicate|supporting_evidence"
        jsonb detected_objects
        text perceptual_hash
        int follower_count
    }

    STATUS_TRANSITIONS {
        bigint id PK
        uuid report_id FK
        report_status from_status "nullable"
        report_status to_status
        uuid actor_id FK "nullable"
        user_role actor_role "nullable"
        text note
        uuid duplicate_of_report_id FK "nullable, set on reject-as-duplicate"
        timestamptz created_at
    }

    NOTIFICATIONS {
        bigint id PK
        uuid user_id FK
        uuid report_id FK "nullable"
        text type
        text body
        boolean read
    }

    REPORT_FOLLOWERS {
        uuid report_id PK, FK
        uuid user_id PK, FK
    }

    DUPLICATE_OFFERS {
        uuid user_id PK, FK
        uuid report_id PK, FK
    }

    PROFILES ||--o{ REPORTS : "submits (reporter_id)"
    PROFILES }o--o| CREWS : "belongs to (crew_id)"
    CREWS |o--o{ REPORTS : "assigned to (nullable)"
    REPORTS ||--o{ STATUS_TRANSITIONS : "audit trail"
    PROFILES |o--o{ STATUS_TRANSITIONS : "acted as (actor_id, nullable)"
    REPORTS |o--o{ STATUS_TRANSITIONS : "duplicate target (nullable)"
    PROFILES ||--o{ NOTIFICATIONS : receives
    REPORTS |o--o{ NOTIFICATIONS : "concerns (nullable)"
    REPORTS ||--o{ REPORT_FOLLOWERS : "followed by"
    PROFILES ||--o{ REPORT_FOLLOWERS : follows
    REPORTS ||--o{ DUPLICATE_OFFERS : "offered as candidate"
    PROFILES ||--o{ DUPLICATE_OFFERS : "offered to"
```

Every entity above also carries `created_at`; append-only tables
(`status_transitions`) have no `updated_at` by design — a
`before update` trigger (`block_transition_mutation`) rejects any UPDATE against
`status_transitions` outright, so the audit log is physically, not just
conventionally, immutable.

`report_followers` and `duplicate_offers` are not in CLAUDE.md's data-model section at
all; they're the tables behind the "follow instead of re-reporting a duplicate"
citizen workflow (Section 4.3 above) and are as central to the real system as
`status_transitions` is to the closed-loop workflow.

---

## 7. Database Design (Physical Notes)

- **Extensions:** `postgis` and `vector` are both enabled (`extensions` schema).
  PostGIS is used live for the AWMA point-in-polygon jurisdiction gate's underlying
  `geography(point,4326)` column and the `reports_location_gix` GiST index; pgvector's
  `vector(512)` embedding column and its HNSW index exist but are **dormant** — the
  duplicate-detection responsibility moved to the external CV service's perceptual
  hashing, and the SQL function `find_duplicate_candidates()` (PostGIS `ST_DWithin` +
  pgvector cosine distance) that would have used them is no longer called by any edge
  function. Both extensions stay installed for two reasons: the schema documents the
  team's original intended design (worth keeping visible for the capstone's design
  history), and re-enabling similarity search later requires no migration, only a
  code change.
- **Schemas:** `public` (client-facing, RLS'd) and `private` (SQL helper
  functions/triggers not exposed via the Data API — e.g. `current_user_role()`,
  `current_user_crew()`, used inside RLS policies to avoid the "RLS policy reads a
  table with an RLS policy on it" recursion problem).
- **Row-Level Security is on for every table.** Writes are edge-function-only: the
  `authenticated` role's grants were deliberately stripped down to `select` (plus
  three narrow, column-scoped `update` grants: `profiles.full_name/phone/settings`,
  `notifications.read`) in migration `20260707132647`. `anon` has no table grants at
  all. This means **the state machine cannot be bypassed by a client writing directly
  to Postgres** — the only door into a status change is `transition-report`, which is
  exactly the "state machine lives server-side" design principle in `CLAUDE.md`.
  `duplicate_offers` is the strictest table in the schema: RLS is on with **zero**
  policies, so it's invisible to every role except `service_role` (i.e., edge
  functions) — by design, since it exists purely as an internal capability token, not
  user-facing data.
- **Generated columns:** `reports.lat`/`reports.lng` are `GENERATED ALWAYS AS
  (ST_Y(location::geometry))`/`ST_X(...)` **STORED**, so client code (and the two
  React apps' map components) can read plain floats without needing a PostGIS client
  library, while `location` remains the single source of geographic truth.
- **Reference generation:** a `before insert` trigger
  (`private.set_report_reference()`) assigns `FMC-YYYY-NNNN` from a dedicated sequence
  (`report_reference_seq`, starting at 500) — the format promised to citizens in the
  SRS's confirmation-screen requirement (FR-015).
- **Realtime:** only `public.notifications` and `public.reports` are in the
  `supabase_realtime` publication; RLS applies to the realtime stream too, so a
  citizen's socket only ever receives their own notification inserts, while staff
  sockets receive all report changes (matching their broader `reports` select policy).

---

## 8. Component Diagram

```mermaid
flowchart LR
    subgraph CitizenComponents["Citizen App components"]
        CScreens["Screens\n(Login, Home, ReportFlow, MyReports,\nReportDetail, Map, Profile)"]
        CStore["State/store\n(store.tsx)"]
        CLibs["Shared libs\n(supabase client, awma-boundary,\ngeo, api wrappers)"]
        CScreens --> CStore --> CLibs
    end

    subgraph ConsoleComponents["Console components"]
        KScreens["Screens\n(Inbox, ReportDetail panel, Map,\nAssignments, Crews, Citizens,\nUsers & Roles, Analytics, Audit Log stub)"]
        KStore["State/store + permissions\n(store.tsx, permissions.ts,\nreportActions.ts, metrics.ts)"]
        KLibs["Shared libs\n(supabase client, api wrappers)"]
        KScreens --> KStore --> KLibs
    end

    subgraph EdgeComponents["Supabase Edge Functions"]
        direction TB
        WriteFns["Write path\nsubmit-report · transition-report\ncancel-report · follow-report\nunfollow-report · manage-users\nmanage-crews"]
        ReadProxyFns["Read-proxy path\ncheck-duplicates · duplicate-reviews"]
        DormantFn["Dormant\nclassify-image (501 stub)"]
        Shared["_shared\nawma-boundary.ts · image-model.ts"]
        WriteFns --> Shared
        ReadProxyFns --> Shared
    end

    DB[("Postgres + RLS")]
    Storage["Storage bucket\n(report-photos, private)"]
    CV["External CV microservice"]
    Resend["Resend"]

    CLibs -->|HTTPS| WriteFns
    CLibs -->|signed URLs| Storage
    KLibs -->|HTTPS| WriteFns
    KLibs -->|HTTPS| ReadProxyFns
    KLibs -->|RLS reads| DB

    WriteFns --> DB
    WriteFns --> Storage
    WriteFns -->|classify/dedup| CV
    WriteFns -->|email| Resend
    ReadProxyFns -->|proxy| CV
```

---

## 9. Traceability to the SRS

Each diagram above exists to make a specific SRS section concrete:

| SRS section | Diagram(s) here |
|---|---|
| §4 System Features (FR-001–FR-093) | Use-Case Diagram (§2), Sequence Diagrams (§4) |
| §6 Use Cases (UC-01–UC-05) | Sequence Diagrams (§4) map 1:1 to UC-01–UC-04; UC-05 (Administrator) is covered by the manage-users/manage-crews write path in the Component Diagram (§8) |
| §7 Data Requirements | ER Diagram (§6), Database Design (§7) |
| §8 System Architecture Overview | System Architecture (§1), Component Diagram (§8) |
| Report state model (§7.3 of the SRS) | State Diagram (§5.1) — refined here with the real `console_role` carve-outs and crew self-service transitions the SRS's June-2026 draft didn't yet capture |

See `docs/design/UI_SCREENSHOTS.md` for the User-Interface design artefacts (real
captured screens from both running apps, per the "port, don't reinvent" principle in
`CLAUDE.md` — the UI was already fully built, so screenshots are stronger evidence
than redrawn wireframes).
