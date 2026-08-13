# Software Requirements Specification (SRS)

## FixMyCity

*A Civic Issue-Reporting Platform for Ghanaian Metropolitan, Municipal, and District
Assemblies*

**Document Version:** 2.0
**Status:** Revised for capstone submission (refreshed from the v1.0 draft to match
the delivered system)
**Prepared by:** Nana Agyemang Duah (22425071) · Nigel Dolling (22424595) · Samuel
Owusu Ampadu (22424245) · Stanford Ofori (22427427) · Alexander Adade (22424693) ·
Hajara Yusif (22425066) — Group **Zero Down Time**
**Lecturer:** Prof. Solomon Mensah
**Course:** CSCD 602 — Advanced Software Engineering
**Department of Computer Science, University of Ghana, Legon**
*August 2026*

See the cover page of Project_Documentation.pdf for the canonical roster and
*Design_Documentation.pdf* for the accompanying diagrams (use-case, ER, class,
sequence, state, component).

---

# Document Control

## Revision History

| Version | Date | Author(s) | Description of Change |
|---|---|---|---|
| 0.1 | May 2026 | Project team | Initial outline based on capstone brief. |
| 0.5 | June 2026 | Project team | Stakeholder analysis, MoSCoW prioritisation, scope agreed with lecturer. |
| 1.0 | June 2026 | Project team | First complete SRS issued for capstone submission. Scope: single MMDA (AWMA), **three** issue categories, four user classes. |
| 2.0 | August 2026 | Project team (documentation refresh drafted with Claude Code, reviewed by the team — see Appendix D.7) | Reconciled the SRS with the delivered system, which has moved substantially since v1.0: issue categories expanded from 3 to 9 (team sign-off, 2026-07-24); image classification and duplicate detection are now performed by an external computer-vision (CV) microservice rather than an in-house component, and duplicate detection **blocks** submission and offers a **follow** option rather than merely flagging (§4.2, §9.4 — this is the biggest single behavioural change from v1.0); added functional requirements for report cancellation, following a duplicate report, crew management, the console-role permission taxonomy (Dispatcher/Viewer carve-outs), and the officer-facing duplicate-review queue; corrected the report state-transition table to match what the server actually enforces (reject legal from any open state; crew self-service on their own assigned reports; reopened reports re-enter via acknowledge/assign); added the AWMA jurisdiction geofence as an explicit interface requirement; updated the data model and architecture sections to name Supabase/PostGIS/pgvector as the implemented choices, cross-referenced to *Design_Documentation.pdf*. Every change above was verified against the shipped migrations and edge functions, not against the original prompt or intent. |

## Approvals

| Role | Name | Signature | Date |
|---|---|---|---|
| Project Author | Nana Agyemang Duah | | |
| Project Author | Nigel Dolling | | |
| Project Author | Samuel Owusu Ampadu | | |
| Project Author | Stanford Ofori | | |
| Project Author | Alexander Adade | | |
| Project Author | Hajara Yusif | | |
| Project Lecturer | Prof. Solomon Mensah | | |
| Course Coordinator | *(to be completed by the Department of Computer Science)* | | |

## Distribution List

- Course lecturer and grading committee.
- Project author(s) and group members.
- Department of Computer Science capstone archive.
- Stakeholder representatives at the Ayawaso West Municipal Assembly (on request).

---

# 1. Introduction

## 1.1 Purpose

This Software Requirements Specification (SRS) defines the functional and
non-functional requirements of FixMyCity, a civic issue-reporting platform designed
for use by residents and Metropolitan, Municipal, and District Assemblies (MMDAs) in
Ghana. The document is prepared in accordance with the IEEE/ISO/IEC 29148:2018
standard for systems and software engineering requirements, and it constitutes the
principal requirements artefact submitted in fulfilment of the capstone project
requirement.

The purpose of this SRS is fourfold. First, to establish a single, agreed reference
describing what FixMyCity does, for whom, and under what constraints. Second, to
bound the scope of the project deliberately so that design, implementation and
evaluation proceed within a realistic capstone schedule. Third, to provide a basis
for stakeholder review, particularly by the course lecturer and any participating
MMDA. Fourth, to serve as the source of traceable requirements against which the
delivered system, the test plan (*Testing_Report.pdf*), and this
document's own accuracy are validated.

Version 2.0 additionally serves a fifth purpose specific to a capstone context:
several requirements in v1.0 described an *intended* design that the implementation
subsequently diverged from (most significantly, the AI approach) or extended beyond
(follow-a-duplicate, cancellation, crew management). This revision closes that gap so
the SRS describes the system that was actually delivered and can actually be
demonstrated, which is what a grading committee needs to assess.

## 1.2 Document Conventions

Functional requirements are identified by the prefix FR-, followed by a three-digit
number (e.g., FR-001). Non-functional requirements are identified by the prefix NFR-.
Use cases are identified by UC-. Requirements are prioritised using the MoSCoW
method: Must have, Should have, Could have, and Won't have (this iteration). The
keywords "shall", "should", and "may" are used in the conventional engineering sense
to indicate, respectively, a mandatory requirement, a recommended behaviour, and an
optional behaviour. Requirement IDs are never renumbered or reused between versions,
even when their text changes — FR-018 in this document is a revision of FR-018 in
v1.0, not a new requirement, so cross-references in older material stay valid. New
requirements introduced in v2.0 use previously unused ID slots within their thematic
range, noted inline.

## 1.3 Intended Audience and Reading Suggestions

This document is intended for several audiences with different concerns. The course
lecturer and grading committee should focus on Sections 1 to 5 and the appendices to
evaluate the rigour and completeness of the requirements engineering work. Developers
should read Sections 3 to 7 in detail, as these define interfaces, features,
non-functional constraints, use cases and data — and should cross-reference
*Design_Documentation.pdf* for the diagrams that make these concrete.
Stakeholders at participating MMDAs should focus on Sections 1, 2 and 9 for an
executive understanding of scope, value, and prioritisation. Reviewers concerned with
the AI-assisted methodology should read Appendix D, which documents the prompts used
to generate v1.0 of this document and the process used to produce v2.0.

## 1.4 Project Scope

FixMyCity is a web-based civic issue-reporting platform that enables residents of a
Ghanaian metropolitan, municipal or district assembly to report local infrastructure
and sanitation problems with a photograph and a geographic location, and enables
assembly staff to receive, route, assign, track and resolve those reports. The
platform consists of a mobile-first citizen Progressive Web Application (PWA), a
desktop-oriented MMDA administrative web dashboard, and a common backend application
programming interface (API) and database.

For the purposes of this iteration, the scope is deliberately constrained as follows.
The pilot is targeted at a single MMDA, the Ayawaso West Municipal Assembly (AWMA) in
the Greater Accra Region — the municipality whose jurisdiction includes the
University of Ghana, Legon campus, together with East Legon, Dzorwulu, Abelemkpe and
the Airport Residential Area. AWMA recorded a population of 75,303 in the 2021
Population and Housing Census over approximately 31 square kilometres, making it a
legally complete but compact assembly: under the Local Governance Act, 2016 (Act
936), a municipal assembly operates thirteen statutory departments (compared with
sixteen at metropolitan level) and has its own budget, departments and field staff.

**Nine** categories of issue are within scope, expanded from the original three by
team sign-off on 2026-07-24 once it became clear the AI classification vendor's own
model already recognised a wider set than the pilot exposed to citizens: illegal
dumping, blocked drain, broken streetlight, flooding, pothole, pollution, broken
public facility, poor sanitation, and other. Four user classes are recognised in the
system: Citizen, Reports Officer, Field Crew, and Administrator (the operations
console additionally exposes a finer-grained `console_role` — Administrator,
Supervisor, Officer, Dispatcher, Viewer, or Field Crew — layered on top of these four
access classes for org-chart-style presentation and, for Dispatcher/Viewer, a
narrower slice of workflow actions; see §4.6 and §4.9). The system is deployed as a
single Progressive Web Application accessible on modern mobile and desktop browsers;
native iOS and Android applications are out of scope for this iteration.

A deliberate design principle of this iteration is that the operations console
abstracts, rather than replicates, the Assembly's internal procedures. The console
provides a single collation inbox for incoming reports, a flat list of crews to which
reports can be assigned, and a fixed status workflow with citizen feedback at every
transition. It does not model the Assembly's departmental structure, internal
approval chains, budgeting, or inter-departmental routing; mapping the console's flat
workflow onto the Assembly's internal procedures is an operational decision left to
the Assembly. This keeps the system simple for citizens — report and receive feedback
— and keeps the console a lightweight collation-and-dispatch tool rather than an
enterprise workflow system.

Items intentionally excluded from this iteration, and documented as future
enhancements in Appendix B, include short-message-service (SMS) and
unstructured-supplementary-service-data (USSD) intake channels, native mobile
applications, multi-language support for Twi, Ga, Ewe and other local languages,
integration with the Electricity Company of Ghana (ECG) or Ghana Water Company
Limited (GWCL) ticketing systems, and federation across multiple MMDAs. One item from
v1.0's exclusion list has since moved *into* scope and shipped: machine-learning-based
duplicate detection (§9.4, §B.6 — see the revision note there for why).

The project's intended benefits, expressed at a high level, are to give the
participating MMDA a unified digital workflow that converts unstructured citizen
complaints into actionable, measurable, accountable work; to give residents visible
evidence that their reports are received and acted upon; and to demonstrate, by means
of a working system, that the closed-loop status-tracking model can be implemented
within the technological and organisational realities of a Ghanaian assembly.

## 1.5 Definitions, Acronyms, and Abbreviations

| Term | Definition |
|---|---|
| AMA | Accra Metropolitan Assembly; the metropolitan assembly governing central Accra, referenced as context and as the jurisdiction of predecessor reporting initiatives. |
| AWMA | Ayawaso West Municipal Assembly; the municipal assembly covering Legon, East Legon, Dzorwulu, Abelemkpe and the Airport Residential Area, used here as the pilot MMDA. |
| API | Application Programming Interface; the contract through which the citizen app and admin dashboard communicate with the backend. |
| CV | Computer Vision; here, the external microservice that classifies report photos and detects duplicates by perceptual hash. |
| ECG | Electricity Company of Ghana; the public utility responsible for electricity supply and electrical-side faults including streetlights in some jurisdictions. |
| FR | Functional Requirement, prefixed FR- in this document. |
| GPS | Global Positioning System; used here generically for any device-derived geographic coordinate. |
| GWCL | Ghana Water Company Limited; the public utility responsible for water supply and reticulation. |
| IDOR | Insecure Direct Object Reference; a class of access-control vulnerability where an object identifier alone, without an authorisation check, grants access. |
| KPI | Key Performance Indicator. |
| MMDA | Metropolitan, Municipal, or District Assembly; the local-government unit in Ghana's three-tier decentralised structure. |
| MMDCE | Metropolitan, Municipal, or District Chief Executive; the appointed political head of an MMDA. |
| MoSCoW | Prioritisation method using the categories Must have, Should have, Could have, Won't have (this iteration). |
| NFR | Non-Functional Requirement, prefixed NFR- in this document. |
| PWA | Progressive Web Application; a web application that uses modern browser capabilities to behave like a native mobile application. |
| RLS | Row-Level Security; a database access-control mechanism that scopes which rows a given caller may see or modify, evaluated per-row rather than per-table. |
| Reports Officer | MMDA-side user class responsible for intake, validation, triage and assignment of citizen reports. |
| SLA | Service Level Agreement; here, the resolution-time target associated with a given issue category. |
| SRS | Software Requirements Specification. |
| UC | Use Case identifier, prefixed UC- in this document. |
| USSD | Unstructured Supplementary Service Data; a feature-phone protocol used widely in Ghana for mobile-money and citizen-service flows. |

## 1.6 References

- IEEE Computer Society. (2018). ISO/IEC/IEEE 29148:2018 — Systems and software
  engineering — Life cycle processes — Requirements engineering. International
  Organization for Standardization.
- IEEE Computer Society. (1998). IEEE Std 830-1998 — Recommended Practice for
  Software Requirements Specifications. Institute of Electrical and Electronics
  Engineers.
- Ministry of Roads and Highways, Republic of Ghana. (2024). Launch of the Maintain
  My Road mobile application and call centre. Government of Ghana.
- Ministry of Finance, Republic of Ghana, and Ghana Revenue Authority. (2024).
  CitizenApp: Unified Citizen Services Platform — Launch Announcement. Government of
  Ghana.
- Accra Metropolitan Assembly. (2025–2026). Public sanitation reward scheme and
  related press releases.
- Ghana Statistical Service. (2021). Population and Housing Census — District
  Analytical Report, Ayawaso West Municipal.
- Code for Ghana / Mobile Web Ghana. (n.d.). DearMP project documentation. Code for
  Africa.
- United Nations Children's Fund (UNICEF) Ghana. (2019). U-Report Ghana: first
  anniversary brief.
- mySociety and World Bank. (2015–2020). FixMyStreet research and adoption studies.
- Government of Ghana. (1993). Local Governance Act, 1993 (Act 462), as amended by
  the Local Governance Act, 2016 (Act 936).
- Government of Ghana. (2012). Data Protection Act, 2012 (Act 843).

---

# 2. Overall Description

## 2.1 Product Perspective

FixMyCity is a new, self-contained product. It does not replace an existing system
within the participating MMDA, although it absorbs and digitises workflows that are
presently handled through informal channels including Facebook posts, telephone
calls to assembly switchboards, walk-in complaints, and ad-hoc reports communicated
through assembly members. The platform is conceived as a thin, opinionated tool whose
primary contribution is to impose a closed-loop status workflow on top of those
informal flows. Consistent with the abstraction principle stated in Section 1.4, the
operations console is a collation-and-dispatch surface — one inbox, one crew list, one
status workflow — and deliberately does not encode the Assembly's departmental
structure or internal procedures.

The platform comprises three distinct components that together form a single logical
system. The Citizen Application is a mobile-first Progressive Web Application that
residents access from any modern smartphone or desktop browser. The MMDA
Administrative Dashboard (the "operations console") is a desktop-oriented web
application used by Reports Officers, Field Crews, and Administrators inside the
assembly. The Backend Service is a server-side application that exposes a
JSON-over-HTTPS API, persists data in a relational database, stores uploaded
photographs in object storage, and dispatches notifications. The two front-end
applications consume the same backend API; there is one source of truth for users,
reports, assignments, and status history. As implemented, the Backend Service is
built on Supabase (managed Postgres, Auth, Storage, and Deno-based Edge Functions);
*Design_Documentation.pdf* §1 diagrams this concretely.

Unlike v1.0's description, the system now has a real fourth party in its product
perspective: an **external computer-vision (CV) microservice**, developed and hosted
by a project teammate outside this repository, that FixMyCity's backend calls
synchronously at submission time to classify a report's photo and check it against
recent open reports for a likely duplicate by perceptual hash. FixMyCity treats this
service as an external dependency behind an anti-corruption adapter
(`supabase/functions/_shared/image-model.ts`) — see §3.3 and §8.1 — and is designed to
**fail soft**: if the CV service is unreachable or slow, report submission proceeds
without an AI verdict rather than blocking the citizen.

Although out of scope for this iteration, the architecture is intended to be
extensible toward multi-MMDA deployment, integration with external utility ticketing
systems (ECG, GWCL), and additional intake channels (SMS, USSD, WhatsApp).

## 2.2 Product Functions

At a high level the platform provides the following functions, each elaborated in
Section 4:

- Citizen registration, authentication and profile management.
- Issue reporting, supporting category selection, photograph capture, geographic
  location and description, gated to the AWMA jurisdiction.
- AI-assisted photo classification and duplicate detection at submission time, with
  fail-soft behaviour if the AI service is unavailable.
- Following an existing report instead of filing a near-identical duplicate, with
  status notifications fanned out to every follower.
- Cancelling a report the citizen submitted, before it has been acknowledged.
- Personal report tracking with a visible status timeline and notifications.
- A public issues map showing the location and status of reports submitted by any
  citizen.
- A Reports Officer dashboard supporting triage, filtering, search and assignment.
- A workflow engine that moves reports through defined status transitions and
  enforces assignment and resolution rules server-side.
- A Field Crew operational view for accepting assignments and updating status from
  the field, including self-service status updates on their own crew's assignments.
- An officer-facing queue for resolving or merging AI-flagged duplicate-review items,
  distinct from and never directly altering report status.
- Notifications to citizens (and followers) and assembly staff on key state
  transitions.
- Administrative functions including user management, role assignment, crew
  management, a read-only citizens directory, and audit logging.
- Analytics and reporting that present operational and management indicators.

## 2.3 User Classes and Characteristics

The system recognises four direct access-control user classes. Other parties
identified in Section 2.8 are stakeholders affected by the system but do not interact
with it through a user account.

| User Class | Typical Profile | Primary Goals | Technical Comfort |
|---|---|---|---|
| Citizen | Resident of the AWMA jurisdiction, aged 16 and above, owning a smartphone with intermittent mobile data, using English with possible preference for Twi or Ga. | Report an issue quickly; receive confirmation; track resolution; see that others' reports are being acted on. | Variable; design assumes novice users. |
| Reports Officer | Assembly staff member, civil servant, working from a desk at the MMDA, intermediate computer literacy, using a desktop or laptop on the assembly intranet. Presented in the console under a `console_role` of Administrator, Supervisor, Officer, Dispatcher, or Viewer. | Receive incoming reports, validate them, classify by category, assign to the appropriate field crew, monitor backlog, resolve duplicate-review items. | Intermediate; expects spreadsheet-like data manipulation. |
| Field Crew | MMDA labourer, contracted waste-collection worker (e.g. Zoomlion), or electrical/civil technician, working in the field with a basic Android smartphone and patchy data. | See assigned reports, navigate to them, mark progress and resolution with a photograph, directly and without waiting on the Reports Officer. | Basic; needs large buttons, minimal typing, low-data design. |
| Administrator | Assembly IT or MIS officer responsible for user accounts, crew rosters, system configuration and audit oversight. | Manage users and roles, manage crews, review the citizens directory and audit logs, export reports. | Advanced. |

## 2.4 Operating Environment

The Citizen Application shall operate on any modern web browser of the last two
major versions, including Google Chrome, Mozilla Firefox, Microsoft Edge and Apple
Safari, running on Android 9 or later, iOS 14 or later, Windows 10 or later, and
macOS 11 or later. The application must remain usable on mid-range Android devices
typical of the Ghanaian market — devices with two to four gigabytes of memory and
screens of five to six inches.

The MMDA Administrative Dashboard shall operate on the same browser baseline but is
optimised for desktop resolutions of 1366×768 and above. It may be used on tablets
but is not optimised for phone-sized viewports.

Network conditions assumed for the Citizen Application include intermittent 3G and
4G connectivity from MTN, Vodafone (now Telecel) and AirtelTigo, with effective
downlink speeds frequently below one megabit per second and brief outages. The
application must degrade gracefully on slow networks. Network conditions assumed for
the Administrative Dashboard include a fixed-line or fibre connection at the assembly
with ten megabits or more available.

The Backend Service operates in a managed cloud environment (Supabase, as
implemented — see §2.1). Data is hosted in a region that satisfies applicable
Ghanaian data-protection considerations.

## 2.5 Design and Implementation Constraints

- The Citizen Application and the Administrative Dashboard are implemented as two
  separate React/Vite single-page applications sharing one backend API; the Citizen
  Application additionally registers as an installable Progressive Web App. Native
  iOS or Android apps are out of scope.
- The Backend Service exposes a JSON-over-HTTPS REST-style API via Supabase Edge
  Functions. All communications use Transport Layer Security (TLS) 1.2 or higher.
- The system shall comply with the Ghana Data Protection Act, 2012 (Act 843), and
  shall apply equivalent principles where the Act is silent.
- Authentication uses token-based session management (JSON Web Tokens, via Supabase
  Auth).
- The system is deployable from a public Git repository with continuous integration
  (GitHub Actions CI is tracked as outstanding work — see
  *Maintenance_and_Evolution.pdf*). No proprietary or closed-source components are
  used beyond the managed platform services named in §8.
- The system supports at least the English language. Other languages are deferred to
  future enhancements.
- The user interface shall conform to Web Content Accessibility Guidelines (WCAG)
  2.1 Level AA where feasible within the capstone timeline; documented exceptions are
  permitted.
- Report writes never bypass the server-side state machine (`transition-report`) or
  the server-side jurisdiction gate (`pointInAwma`) — this is enforced both by
  application code and by database grants (clients hold no direct write privilege on
  `reports` or `status_transitions`; see *Design_Documentation.pdf* §7).

## 2.6 User Documentation

The following user documentation is produced alongside the system (delivered as
*User_Manual.pdf*, organised by role rather than as five separate print-ready
artefacts, given the capstone's documentation-consolidation allowance):

- A Citizen quick-start covering registration through to tracking and reopening a
  report, illustrated with real screens.
- A Reports Officer section explaining intake, triage, assignment, rejection, and the
  duplicate-review queue.
- A Field Crew section covering the assigned-reports queue and one-tap status
  updates.
- An Administrator section covering user management, crew management, the citizens
  directory, and audit-log inspection.

## 2.7 Assumptions and Dependencies

- It is assumed that the participating MMDA will identify and commit at least one
  Reports Officer to use the system during the pilot.
- It is assumed that field crews involved in the pilot have access to a basic
  Android smartphone with at least 2 GB of RAM and intermittent mobile data (Field
  Crew status updates are performed through the operations console in the current
  iteration, not a dedicated crew app — see Appendix B.3 for the native/dedicated-app
  future enhancement).
- It is assumed that the assembly will provide a list of crews and, in a future
  iteration, resolution-time expectations (SLAs) per category — SLA configuration is
  not yet implemented (§9.4).
- It is assumed that citizens consent to the storage of their email address, phone
  number and the geographic location of submitted reports, and that the privacy
  policy will disclose these usages.
- The system depends on OpenStreetMap (via Leaflet/react-leaflet) for the public and
  staff map views, requiring no paid API key.
- The system depends on Resend for transactional email notifications. SMS is
  reserved for a future iteration.
- The system depends on an **external CV microservice**, owned by a project
  teammate outside this repository, for photo classification and duplicate
  detection. This is a new, real dependency not present in v1.0's assumptions; its
  unavailability is designed to degrade report submission gracefully rather than
  block it (§2.1, §4.2).

## 2.8 Stakeholders

Stakeholders are parties whose interests are affected by the system, whether or not
they are direct users. Direct users are described in Section 2.3. The wider
stakeholder landscape is summarised below.

| Stakeholder | Relationship to the System | Primary Interest |
|---|---|---|
| Residents of AWMA | Direct users (Citizens). | Visible, accountable resolution of local issues. |
| Assembly leadership (Municipal Chief Executive, Municipal Coordinating Director) | Indirect users (read-only dashboards). | Operational visibility, performance, political accountability. |
| Assembly departments (Works; Environmental Health and Sanitation — municipal assemblies have no standalone Waste Management Department) | Direct users (Reports Officer, Field Crew supervisors). | Workflow efficiency, evidence base, departmental accountability. |
| Field crews including Zoomlion staff | Direct users (Field Crew). | Clear assignments, low-friction status updates. |
| Public Relations / Communications Office | Indirect / occasional direct user. | Defusing media pressure, citizen communications. |
| Electricity Company of Ghana (ECG) | External party referenced in routing. | Coordination on streetlight faults. |
| Ghana Water Company Limited (GWCL) | External party referenced in routing. | Coordination on water-related issues (future). |
| Department of Urban Roads / Ghana Highway Authority | External party referenced in routing. | Coordination on major-road defects. |
| Ghana Police Service | External party. | Enforcement of sanitation offences. |
| Ministry of Local Government, Chieftaincy and Religious Affairs | Indirect stakeholder. | National policy alignment, sanitation strategy. |
| Civil-society and media | Indirect stakeholders. | Transparency, accountability monitoring. |
| The external CV service's development team | External technical partner (new in v2.0). | A stable, well-specified integration contract; the anti-corruption-layer boundary exists partly to protect this relationship from churn on either side. |
| Capstone lecturer and grading committee | Evaluators. | Rigour and completeness of the SRS and delivered system. |

---

# 3. External Interface Requirements

## 3.1 User Interfaces

The system presents two distinct user-interface surfaces sharing a common visual
language (navy/blue/gold palette, shared status-pill colour mapping — see the
project's design-system conventions and *Design_Documentation.pdf* for real captured
screens).

### 3.1.1 Citizen Application

- Mobile-first layout, designed for portrait orientation on screens between four and
  seven inches.
- Single-handed reachability for the primary report-creation flow.
- Bottom navigation bar with the items Home, Report, My Reports, Map, and Profile.
- Touch targets of at least 44 by 44 pixels in accordance with mobile accessibility
  guidance.
- Use of system-native input components for camera, gallery, and geolocation to
  maximise familiarity.
- Visible status timelines and confirmation screens so the citizen always knows what
  state their report is in.

### 3.1.2 MMDA Administrative Dashboard

- Desktop-first layout, designed for a minimum viewport of 1280 by 720 pixels.
- Left navigation rail with the items Inbox, Map, Assignments, Crews, Citizens,
  Analytics, Users, Duplicate Reviews, and Audit Log (Audit Log is a read-only
  placeholder pending its next iteration — see *Maintenance_and_Evolution.pdf*).
- Table-centric data presentation with sticky headers, multi-column filters,
  pagination, and a consistent right-hand detail panel for the selected report,
  supporting in-context status updates without leaving the queue.

## 3.2 Hardware Interfaces

The system has no bespoke hardware. The Citizen Application uses the device camera
and geolocation sensor through standard browser APIs (the MediaDevices API and the
Geolocation API respectively). The Administrative Dashboard relies only on standard
desktop input devices.

## 3.3 Software Interfaces

| Interface | Direction | Purpose |
|---|---|---|
| Authentication provider (Supabase Auth) | Outbound (auth check) / inbound (token verification) | Authenticate users at sign-in and on token refresh. |
| Object storage service (Supabase Storage) | Outbound (upload, fetch signed URL) | Store photographs uploaded with reports; private bucket, per-user folder scoping. |
| Mapping service (OpenStreetMap, via Leaflet) | Outbound (tile requests) | Render the public and staff map views. No paid API key required. |
| **External CV microservice** *(new in v2.0)* | Outbound (submit photo, request duplicate list, manage review queue) | Classify a report photo, detect near-duplicate reports by perceptual hash, and expose a duplicate-review queue for officer resolution. Reached via an anti-corruption adapter (`_shared/image-model.ts`) with an 8-second timeout and fail-soft behaviour on outage. |
| Email gateway (Resend) | Outbound | Deliver transition-notification emails to citizens, followers, and staff. |
| SMS gateway (Hubtel, Twilio, or equivalent) | Outbound | Reserved for future enhancement; SMS notifications and SMS intake. |
| Analytics / error monitoring (Vercel Analytics) | Outbound | Capture client-side performance metrics. |

## 3.4 Communications Interfaces

- All client–server communication uses HTTPS over TLS 1.2 or higher. Plain HTTP is
  rejected.
- The API is JSON-over-REST-style with conventional HTTP verbs, implemented as
  Supabase Edge Functions (see *Design_Documentation.pdf* §8 for the full
  10-function surface).
- File uploads (photographs) use multipart/form-data, capped at five megabytes per
  file.
- Real-time notifications to logged-in clients use Supabase Realtime (a managed
  WebSocket-based publication), scoped by the same Row-Level Security policies that
  govern REST reads.

---

# 4. System Features (Functional Requirements)

This section enumerates the functional requirements of FixMyCity, grouped by
feature. Each requirement carries a MoSCoW priority and a short source/rationale.
Requirements unchanged in substance from v1.0 are marked *(unchanged)*; revised or
new requirements explain what changed and why.

## 4.1 Citizen Registration and Authentication

| ID | Requirement | Priority | Source / Rationale |
|---|---|---|---|
| FR-001 | The system shall allow a Citizen to register an account using a unique email address or a Ghanaian mobile phone number and a password. | Must | Citizen identity is foundational. *(unchanged)* |
| FR-002 | The system shall require email verification before allowing report submission. | Must | Prevents abusive anonymous reporting. *(unchanged)* |
| FR-003 | The system shall allow a Citizen to sign in using their registered email or phone number and password. | Must | Standard authentication. *(unchanged)* |
| FR-004 | The system shall enforce a password policy of at least eight characters with a mix of letters and numbers. | Must | Security baseline. *(unchanged)* |
| FR-005 | The system shall provide a password-reset flow using a time-limited verification token sent to the registered email. | Must | Recoverability. *(unchanged)* |
| FR-006 | The system shall allow a Citizen to view and update their profile, including name, contact information, and notification preferences. | Should | Self-service. *(unchanged)* |
| FR-007 | The system shall allow a Citizen to delete their account, with reports submitted by that account anonymised rather than deleted, preserving the operational record. | Should | Data-protection principle. *(unchanged — implementation status to be confirmed in the Testing Report)* |

## 4.2 Issue Reporting, AI-Assisted Classification, and Duplicate Handling

This is the core citizen-facing feature. **This subsection changed the most between
v1.0 and v2.0** — the original spec described an in-house, non-blocking duplicate
*flag*; the delivered system uses an external CV vendor and, for a strong duplicate,
*blocks creation of a second report* and offers the citizen a follow option instead.

| ID | Requirement | Priority | Source / Rationale |
|---|---|---|---|
| FR-010 | The system shall allow an authenticated Citizen to create a new report by selecting one of the nine supported categories: illegal dumping, blocked drain, broken streetlight, flooding, pothole, pollution, broken public facility, poor sanitation, or other. | Must | Primary use case. *(revised: 3 → 9 categories, 2026-07-24)* |
| FR-011 | The system shall require at least one photograph per report, captured directly or selected from the device gallery. | Must | Photograph is essential evidence. *(unchanged)* |
| FR-012 | The system shall capture the geographic location of the report using the device geolocation, with the Citizen permitted to refine the location on a map before submission, and shall reject submission with a clear error if the location falls outside the AWMA jurisdiction boundary. | Must | Location is essential for routing; jurisdiction enforcement keeps the pilot's scope real rather than advisory. *(revised: adds the server-authoritative AWMA point-in-polygon gate, not present in v1.0)* |
| FR-013 | The system shall accept a free-text description of up to 500 characters. | Must | Citizen context. *(unchanged)* |
| FR-014 | The system shall compress uploaded photographs before storage. | Must | Storage and bandwidth control. *(unchanged in intent)* |
| FR-015 | The system shall confirm successful submission by presenting a unique report reference (format `FMC-YYYY-NNNN`) and a visible status of 'Submitted'. | Must | Closed-loop trust. *(unchanged)* |
| FR-016 | The system shall permit the Citizen to attach up to three photographs to a single report. | Should | Richer evidence. *(unchanged — current photo_urls field supports multiple; confirm cap in Testing Report)* |
| FR-017 | The system should allow report submission while offline, queuing the report locally and submitting it when connectivity is restored. | Could | Low-connectivity tolerance; not yet implemented — offline is shell-only (app-shell caching, no data queue). | 
| FR-018 | The system shall submit the report photo to an external CV service for classification and duplicate screening at submission time. If the service reports the photo is **not a genuine civic issue**, submission shall be blocked with a clear message (except for the streetlight and other categories, which the CV vendor's model does not classify and which are therefore exempt from this check). If the service reports a **strong duplicate of another citizen's currently-open report**, the system shall **not** create a second report; instead it shall record a follow-offer and present the existing report to the Citizen with the option to follow it (FR-019) or submit anyway (which skips the CV check on retry). If the service reports a strong duplicate of the **same citizen's own** currently-open report, the system shall present an "already reported" message instead of creating a duplicate. If the CV service is unreachable or times out (8 seconds), the report shall still be created without an AI verdict (fail-soft). | Must | Triage efficiency and data quality; this is one of the two professor-mandated AI features (§ AI features in *Design_Documentation.pdf* §1). *(fundamentally revised from v1.0's "flag but do not block" behaviour, and from an in-house PostGIS/pgvector design to an external CV vendor — see the Notable Implementation Features section of Project_Documentation.pdf for the verified behaviour)* |
| FR-019 | The system shall allow a Citizen who was offered an existing report as a likely duplicate (FR-018) to follow it: the Citizen is added as a follower and receives every subsequent status notification for that report, exactly as the original reporter does, without the original reporter's identity being disclosed to them. | Must | Turns duplicate submissions into a demand signal instead of discarded noise, per the "follow-a-duplicate" feature. | *(new in v2.0 — this ID slot was unused in v1.0)* |

## 4.3 Report Tracking, Cancellation, and Reopening

| ID | Requirement | Priority | Source / Rationale |
|---|---|---|---|
| FR-020 | The system shall provide each Citizen with a 'My Reports' list showing all reports submitted by that account (and all reports they follow), with current status and submission date. | Must | Self-service tracking. *(revised: extended to followed reports)* |
| FR-021 | The system shall display, for any selected report, a status timeline showing every state transition with a timestamp and the actor (Citizen, Reports Officer, Field Crew, System). | Must | Transparency. *(unchanged)* |
| FR-022 | The supported statuses shall be: Submitted, Acknowledged, Assigned, In Progress, Resolved, Rejected, and Reopened. | Must | Workflow definition. *(unchanged)* |
| FR-023 | The system should allow a Citizen to add a follow-up comment to a report while it is open. | Should | Two-way communication; not yet implemented — confirm in Testing Report. |
| FR-024 | The system shall allow a Citizen to mark a Resolved report as 'Reopened' within seven days if the issue is not in fact fixed, prompting the assignment workflow to recur. | Must | Quality assurance. *(unchanged)* |
| FR-025 | The system shall allow a Citizen to cancel their own report while it remains in the Submitted status (i.e. before it has been acknowledged), permanently removing the report and its uploaded photographs. | Must | Lets a citizen correct an accidental or mistaken submission before staff have acted on it. | *(new in v2.0)* |

## 4.4 Public Issues Map

| ID | Requirement | Priority | Source / Rationale |
|---|---|---|---|
| FR-030 | The system shall provide a public map view showing all non-rejected reports as markers, colour-coded by status. | Must | Transparency. *(unchanged)* |
| FR-031 | The public map shall not disclose the identity or contact details of the reporting Citizen. | Must | Privacy. *(unchanged)* |
| FR-032 | The public map shall, on marker selection, show the report category, status, date submitted, and one photograph. | Must | Public information. *(unchanged)* |
| FR-033 | The public map shall be accessible without authentication. | Should | Public good; confirm current auth-gating in Testing Report. |
| FR-034 | The system should provide filters on the public map for category, status, and date range. | Could | Browseability. |

## 4.5 Reports Officer Dashboard

| ID | Requirement | Priority | Source / Rationale |
|---|---|---|---|
| FR-040 | The system shall present incoming reports to the Reports Officer in a sortable, filterable, paginated inbox showing reference, category, location, submission time, and current status. | Must | Triage productivity. *(revised: pagination added)* |
| FR-041 | The Reports Officer shall be able to view the full detail of any report, including the photograph, location on a map, citizen description, follower count, and history. | Must | Decision support. *(revised: adds follower count)* |
| FR-042 | The Reports Officer shall be able to acknowledge a report, transitioning it from Submitted or **Reopened** to Acknowledged. | Must | Closed-loop first step. *(revised: also legal from Reopened — see the state diagram in *Design_Documentation.pdf* §5.1)* |
| FR-043 | The Reports Officer shall be able to reject a report, from any status except Resolved or Rejected itself, with a documented reason (out of jurisdiction, duplicate, insufficient information, or not valid) and, when rejecting as a duplicate, a reference to the report it duplicates. Rejected reports remain in the audit log. | Must | Triage realism. *(revised: reject is legal from any open status, not only as a terminal step from Submitted, and supports recording the duplicate target)* |
| FR-044 | The Reports Officer shall be able to filter the inbox by category and status. | Must | Search efficiency. |
| FR-045 | The system should flag overdue reports (those exceeding an SLA for their category) in the inbox with a visible indicator. | Should | Escalation surfacing; **not implemented** — no SLA concept exists in the current schema (categories are a fixed enum, not an administrator-configurable table with SLA hours). Carried forward as future work; see §9.4 and *Maintenance_and_Evolution.pdf*. |
| FR-046 | The system could support bulk operations on a selected set of reports. | Could | Power-user efficiency; not implemented. |

## 4.6 Assignment and Workflow

| ID | Requirement | Priority | Source / Rationale |
|---|---|---|---|
| FR-050 | The Reports Officer shall be able to assign a Submitted, Acknowledged, or **Reopened** report to a specific, currently-available Field Crew, transitioning it to Assigned. | Must | Workflow. *(revised: also legal from Submitted and Reopened directly, and requires `crews.available = true`)* |
| FR-051 | The system shall enforce, server-side, that each status transition is legal only for its defined starting status/statuses and the caller's role, exactly as specified in the state diagram in *Design_Documentation.pdf* §5.1. No transition is ever accepted from a client-asserted status alone. | Must | Workflow integrity — the state machine lives entirely in the `transition-report` server function; clients cannot write `reports.status` directly (enforced by database grants). *(revised: precision added; server-only enforcement is now explicit and verified, not just described)* |
| FR-052 | The system shall record every state transition in an append-only audit log with timestamp, actor identity, actor role, and (where applicable) the reason, note, or duplicate-target reference supplied. The audit log permits inserts only; updates and deletes are rejected at the database level. | Must | Audit trail. *(revised: the append-only guarantee is now a database trigger, not just a convention)* |
| FR-053 | The system shall notify the assigned Field Crew, the reporter, and every follower of the report on assignment. | Must | Closed loop. *(revised: extended to followers)* |
| FR-054 | The system should allow reassignment of a report from one crew to another by the Reports Officer or Administrator. | Should | Operational reality; confirm current support in Testing Report. |
| FR-055 | The system could automatically escalate a report to the originating Reports Officer if no status update occurs within an SLA window. | Could | Depends on FR-045 (SLA concept); not implemented. |
| FR-056 | A Field Crew member shall be able to mark a report assigned to their own crew as In Progress or Resolved directly, without requiring the Reports Officer to perform the transition on their behalf. | Must | Reduces friction and back-and-forth between the console and the field, closing exactly the kind of back-end gap that undermined predecessor Ghanaian apps. | *(new in v2.0 — reflects real `transition-report` behaviour: crew callers may self-serve `start`/`resolve` on their own assigned reports)* |

## 4.7 Field Crew Operations

| ID | Requirement | Priority | Source / Rationale |
|---|---|---|---|
| FR-060 | The Field Crew shall see a list of reports assigned to them. | Must | Work queue. *(unchanged in intent; delivered via the operations console rather than a separate crew app — see Appendix B.3)* |
| FR-061 | The Field Crew shall be able to mark an Assigned report as In Progress and as Resolved (FR-056). | Must | Friction minimisation. *(unchanged)* |
| FR-062 | The Field Crew shall be able to attach a resolution photograph at the time of resolution. | Must | Verification. *(unchanged)* |
| FR-063 | The Field Crew should be able to add a short text note when changing status. | Should | Field context. |
| FR-064 | The Field Crew should be able to view the report's location on a map. | Should | Wayfinding. |
| FR-065 | The Field Crew interface should restrict photograph uploads to compressed form. | Should | Bandwidth realism. |

## 4.8 Notifications

| ID | Requirement | Priority | Source / Rationale |
|---|---|---|---|
| FR-070 | The system shall notify the originating Citizen **and every follower of the report** when it is Acknowledged, Assigned, In Progress, Resolved, Rejected, or Reopened. | Must | Closed loop. *(revised: extended to followers, a v2.0 concept)* |
| FR-071 | The system shall notify the assigned Field Crew when a report is Assigned to them. | Must | Work routing. *(unchanged)* |
| FR-072 | The system should notify the Reports Officer when a report exceeds its SLA without resolution. | Should | Escalation; depends on FR-045, not implemented. |
| FR-073 | The system shall support in-application notifications (via real-time subscription) and email notifications. SMS is deferred to future enhancements. | Must | Channel baseline. *(revised: in-app delivery mechanism named — Supabase Realtime)* |
| FR-074 | The system should allow Citizens to opt out of email notifications while retaining in-app notifications. | Should | Preference. |

## 4.9 Administration

| ID | Requirement | Priority | Source / Rationale |
|---|---|---|---|
| FR-080 | The Administrator shall be able to create, update, deactivate and reactivate user accounts for Reports Officers, Field Crews and other Administrators. | Must | User management. *(unchanged)* |
| FR-081 | The Administrator shall be able to assign and revoke `console_role` values (Administrator, Supervisor, Officer, Dispatcher, Viewer, Field Crew) for any non-Citizen user, which in turn derives that user's underlying access role (Administrator→admin, Field Crew→crew, all others→officer). | Must | Access control. *(revised: the console-role taxonomy and its mapping to access role is now explicit and includes Dispatcher/Viewer, which carry restricted workflow permissions — see §4.6)* |
| FR-082 | The Administrator should be able to configure the supported categories and their SLA targets. | Should | Operational flexibility; **not implemented** — categories are a fixed database enum requiring a schema migration to change, and no SLA concept exists yet. Honestly flagged as a gap relative to v1.0's intent; see §9.4. |
| FR-083 | The Administrator shall be able to view a chronological audit log of all state transitions. | Must | Accountability. *(unchanged; a general configuration/user-action audit log beyond status transitions remains a future-work item — see *Maintenance_and_Evolution.pdf*)* |
| FR-084 | The system shall not allow the Administrator role to delete audit log entries. | Must | Tamper resistance — enforced by a database trigger, not merely a UI restriction. *(unchanged in intent, strengthened in enforcement)* |
| FR-085 | The Administrator should be able to export data in CSV format. | Should | Reporting and backup; confirm current support in Testing Report. |
| FR-086 | Administrator, Supervisor, and Dispatcher console roles shall be able to create a crew, add or move a member between crews, remove a member from a crew, set a crew's lead, and toggle a crew's availability. | Must | Crew management is a real, shipped console feature underpinning FR-050's "available crew" constraint. | *(new in v2.0)* |
| FR-087 | Dispatcher console-role users shall be permitted to perform only the Acknowledge and Assign workflow actions; Viewer console-role users shall be permitted to perform none of the staff workflow actions. All other console roles retain the full staff action set. | Must | Encodes a least-privilege permission taxonomy for staff who need visibility or limited triage ability without full officer authority. | *(new in v2.0)* |
| FR-088 | Administrator and Supervisor console roles shall have access to a read-only Citizens directory listing registered citizen accounts. | Should | Operational visibility into the reporter base without exposing citizen data to the wider staff. | *(new in v2.0)* |
| FR-089 | Reports Officer, Administrator, and Supervisor console roles shall have access to a Duplicate-Review queue populated by the external CV service, in which each item pairs a report with a candidate and a similarity indicator, and staff may resolve the item (as duplicate, possible duplicate, supporting evidence, or not-a-duplicate) or merge it. Resolving or merging a duplicate-review item shall never, by itself, change a report's status — status changes remain exclusively the responsibility of the state machine in §4.6. | Must | Operationalises the "AI suggests, human confirms" design principle for the duplicate-detection AI feature with a real staff workflow surface, while preserving a clean architectural boundary between the AI's advisory queue and the report state machine. | *(new in v2.0)* |

## 4.10 Analytics and Reporting

| ID | Requirement | Priority | Source / Rationale |
|---|---|---|---|
| FR-090 | The system should present a management dashboard showing total reports submitted, total resolved, current backlog, and average time to resolution. | Should | Management view; confirm current scope in Testing Report. |
| FR-091 | The system should present a hotspot view identifying geographic clusters of reports. | Should | Resource planning; confirm current scope in Testing Report. |
| FR-092 | The system should present per-crew productivity accessible to Administrators only. | Should | Operational management; confirm current scope in Testing Report. |
| FR-093 | The system could present a trend chart of reports by category over time. | Could | Strategic insight. |

---

# 5. Non-Functional Requirements

Non-functional requirements are carried forward from v1.0 largely unchanged — they
describe target behaviour and are still the acceptance bar the delivered system
should be measured against in *Testing_Report.pdf*, whether or not every
target has yet been formally measured. Two additions reflect real, new dependencies.

## 5.1 Performance

| ID | Requirement | Acceptance Criterion |
|---|---|---|
| NFR-001 | The Citizen Application shall load its primary report-creation screen quickly on a typical Ghanaian 3G connection. | Time to interactive ≤ 5 seconds on a connection of 1 Mbps downlink and 250 ms latency, measured on a mid-range Android device. |
| NFR-002 | The MMDA Administrative Dashboard shall present the inbox quickly on a typical assembly fixed-line connection. | Time to first contentful paint ≤ 2 seconds on a 10 Mbps connection. |
| NFR-003 | The API shall respond promptly to common operations. | P95 latency ≤ 600 ms for read operations and ≤ 1500 ms for write operations under 100 concurrent users. |
| NFR-004 | Photograph upload shall complete within a tolerable window for the citizen. | Median upload time ≤ 8 seconds for a 2 MB photograph on a 1 Mbps connection. |
| NFR-005 | The system shall support concurrent users sized for the AWMA pilot. | 200 concurrent users sustained for one hour with all NFR-001 to NFR-004 targets maintained. |
| NFR-006 | An outage of the external CV service shall not prevent report submission. | Report creation succeeds (without an AI verdict) when the CV service does not respond within an 8-second timeout. | *(new in v2.0, formalising the fail-soft behaviour verified in the Notable Implementation Features section of Project_Documentation.pdf, feature 4)* |

## 5.2 Security

| ID | Requirement | Acceptance Criterion |
|---|---|---|
| NFR-010 | All communications shall be encrypted in transit. | TLS 1.2 or higher enforced; non-TLS requests rejected. |
| NFR-011 | Passwords shall be stored using a modern adaptive hashing function. | bcrypt (via Supabase Auth) at a tuned cost factor; never stored or logged in plaintext. |
| NFR-012 | Personal data shall be encrypted at rest. | Database-level encryption enabled for the database and the object storage. |
| NFR-013 | Authorisation shall be role-based and enforced server-side on every protected endpoint and, additionally, at the database layer. | No endpoint relies solely on client-side role checks; Row-Level Security policies exist on every table; write grants to the `authenticated` role are limited to a small, explicit column allowlist. |
| NFR-014 | The system shall log security-relevant events to a tamper-resistant audit log. | Status transitions recorded with actor and timestamp in an insert-only table (database trigger enforced). |
| NFR-015 | The system shall comply with the Ghana Data Protection Act, 2012 (Act 843), in collecting, processing, and storing personal data. | A documented privacy policy, lawful basis for each data type, and a data-subject access process exist. |
| NFR-016 | Common web vulnerabilities shall be mitigated, including Insecure Direct Object Reference (IDOR) risks introduced by newer features such as report-following. | OWASP Top Ten checks pass; the `duplicate_offers` table (which gates who may follow which report) carries Row-Level Security with zero client-facing policies, closing a specific IDOR that the follow feature would otherwise introduce — see the Notable Implementation Features section of Project_Documentation.pdf, feature 6. |
| NFR-017 | Requests to the AI-assisted submission path shall not leak citizen identity to the external CV vendor beyond what is strictly required to classify a photograph. | The adapter sends only the photograph and category context to the CV service, never citizen PII. | *(new in v2.0, reflecting the addition of a real third-party AI dependency)* |

## 5.3 Reliability and Availability

| ID | Requirement | Acceptance Criterion |
|---|---|---|
| NFR-020 | The system shall be available during normal operational hours. | ≥ 99% availability between 06:00 and 22:00 GMT measured monthly, excluding planned maintenance. |
| NFR-021 | Overall availability shall meet a pilot-appropriate target. | ≥ 95% overall monthly availability. |
| NFR-022 | The system shall recover from a backend failure without data loss for committed transactions. | Database point-in-time recovery enabled with a Recovery Point Objective ≤ 15 minutes. |
| NFR-023 | The system shall back up data daily. | Daily automated backup with a Recovery Time Objective ≤ 4 hours. |

## 5.4 Usability

| ID | Requirement | Acceptance Criterion |
|---|---|---|
| NFR-030 | A first-time citizen shall be able to submit a complete report quickly without assistance. | ≥ 90% of first-time users in a moderated usability test complete a report submission in ≤ 90 seconds without help. |
| NFR-031 | The Field Crew flow shall be minimal-friction. | Status update from notification to confirmation in ≤ 3 taps and ≤ 15 seconds. |
| NFR-032 | The interface shall conform to recognised accessibility guidelines. | WCAG 2.1 Level AA conformance for colour contrast, keyboard navigation, and focus management, with documented exceptions. |
| NFR-033 | Citizen-facing copy shall be written in plain English suitable for a Junior High School reading level. | Flesch-Kincaid grade level ≤ 8 on key screens. |

## 5.5 Maintainability

| ID | Requirement | Acceptance Criterion |
|---|---|---|
| NFR-040 | The code base shall be version-controlled and continuously integrated. | All code in Git; CI is a documented gap, not yet wired (*Maintenance_and_Evolution.pdf*). |
| NFR-041 | Automated tests shall cover the core workflow. | Vitest unit suites exist for both apps (permissions/state-transition-availability logic, report actions, metrics, the AWMA boundary check); coverage percentage and end-to-end coverage are reported in *Testing_Report.pdf*. |
| NFR-042 | The system should expose machine-readable health and metrics endpoints. | Not yet implemented. |
| NFR-043 | Configuration shall be externalised from code. | `.env` files (git-ignored) hold `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`; no environment-specific secret is committed to source control. |

## 5.6 Portability

| ID | Requirement | Acceptance Criterion |
|---|---|---|
| NFR-050 | The Citizen Application shall function on the two most recent major versions of mainstream browsers. | Functional and visual parity on Chrome, Safari, Firefox, and Edge current and previous major versions. |
| NFR-051 | The system shall avoid reliance on services unique to a single cloud provider beyond the managed platform choice itself. | Postgres, Deno-based edge functions, and static React builds are all portable technologies; no proprietary provider-locked feature is used. |

## 5.7 Scalability

| ID | Requirement | Acceptance Criterion |
|---|---|---|
| NFR-060 | The system architecture shall support an order-of-magnitude growth without redesign. | Capable of supporting 2,000 concurrent users and 2,000 reports per day with horizontal scaling and no schema redesign. |
| NFR-061 | Storage shall accommodate at least 12 months of photographic evidence at the pilot scale. | Storage budget allows for 2,500 reports/month × up to 3 photographs × 2 MB ≈ 180 GB over 12 months. |

## 5.8 Internationalisation and Localisation

| ID | Requirement | Acceptance Criterion |
|---|---|---|
| NFR-070 | User-facing strings should be externalised to a translation file. | Not yet implemented; all copy is currently inline English. |
| NFR-071 | The system shall display dates and times in the local time zone. | All timestamps shown in Greenwich Mean Time (GMT), Ghana's local time zone. |

---

# 6. Use Cases

Use case identifiers carry the prefix UC-. UC-01 through UC-05 are revised from v1.0
to match the real submission/workflow behaviour; UC-06 and UC-07 are new.

## 6.1 UC-01: Citizen Submits a New Issue Report

| Field | Value |
|---|---|
| Actor | Citizen (authenticated) |
| Preconditions | The Citizen has a verified account and is signed in. The device has camera and location permissions granted. |
| Main Success Scenario | 1. Citizen selects 'Report' from the main navigation. 2. System presents the category selector (nine categories). 3. Citizen selects a category. 4. System prompts for a photograph; Citizen captures or selects one. 5. System captures the device location; Citizen confirms or adjusts on the map. 6. Citizen optionally types a description. 7. Citizen submits. 8. System checks the location is inside the AWMA jurisdiction. 9. System sends the photograph to the external CV service for classification and duplicate screening. 10. System validates, persists the report, generates a reference, and presents a confirmation with the reference and the status 'Submitted'. |
| Alternative — Outside Jurisdiction | If step 8 fails, the system blocks submission with a clear "outside AWMA" message and no report is created. |
| Alternative — Not a Civic Issue | If the CV service (step 9) reports the photo is not a genuine civic issue (and the category is not exempt), submission is blocked with a message asking the Citizen to retake the photo. |
| Alternative — Strong Duplicate (Another Citizen) | If the CV service reports a strong duplicate of another citizen's open report, no new report is created; the Citizen is shown the existing report and offered UC-06 (Follow) or the option to submit anyway. |
| Alternative — Strong Duplicate (Own Report) | If the duplicate is the Citizen's own open report, the Citizen sees an "already reported" message instead of a new report. |
| Alternative — CV Service Unavailable | If the CV service times out or errors, the system creates the report anyway without an AI verdict (fail-soft). |
| Postconditions | A new report exists in status 'Submitted' with any AI-derived metadata attached. An entry appears in the Citizen's 'My Reports' list. An in-app notification is queued for the Reports Officer pool. |

## 6.2 UC-02: Reports Officer Acknowledges and Assigns a Report

| Field | Value |
|---|---|
| Actor | Reports Officer (or Administrator; Dispatcher may perform this use case's actions only) |
| Preconditions | The officer is signed in and has at least one report in 'Submitted' or 'Reopened' state in the inbox. |
| Main Success Scenario | 1. Officer opens the Inbox, filters to a status. 2. Officer opens a report and inspects the photograph, location, description, and follower count. 3. Officer clicks 'Acknowledge'. 4. System transitions the report to 'Acknowledged' and notifies the reporter and any followers. 5. Officer clicks 'Assign' and selects an available Field Crew. 6. System transitions the report to 'Assigned', notifies the chosen Crew and the reporter/followers, and records the assignment in the audit log. |
| Alternative — Reject | Officer instead clicks 'Reject' (available from any status except Resolved/Rejected), selects a reason, optionally references a duplicate target, and confirms. System transitions the report to 'Rejected' and notifies the reporter/followers with the reason. Dispatcher-role officers cannot perform this action. |
| Postconditions | The report is in 'Assigned' state. The audit log contains the acknowledge and assign actions. The notified Crew sees the new assignment in their queue. |

## 6.3 UC-03: Field Crew Marks a Report Resolved

| Field | Value |
|---|---|
| Actor | Field Crew (a member of the crew the report is assigned to) — or a Reports Officer/Administrator acting on the crew's behalf |
| Preconditions | The caller is signed in. At least one report is assigned to their crew in state 'Assigned' or 'In Progress'. |
| Main Success Scenario | 1. Crew opens their assignment queue. 2. Crew opens a report's detail. 3. Crew taps 'Start' to transition to 'In Progress'. System notifies the reporter/followers. 4. After resolving the issue on the ground, Crew taps 'Mark Resolved' and captures a resolution photograph. 5. System transitions the report to 'Resolved', records the resolution photograph, and notifies the reporter/followers. |
| Postconditions | The report is in 'Resolved' state with a resolution photograph. The audit log records the transition. The reporter and every follower are notified. |

## 6.4 UC-04: Citizen Reopens an Unresolved Report

| Field | Value |
|---|---|
| Actor | Citizen (the original reporter only) |
| Preconditions | Citizen has a report in 'Resolved' state, marked as such within the last seven days. |
| Main Success Scenario | 1. Citizen opens the report in 'My Reports'. 2. Citizen taps 'Reopen'. 3. System transitions the report to 'Reopened' and surfaces it in the Reports Officer inbox. |
| Postconditions | The report re-enters the workflow; a Reports Officer can Acknowledge or Assign it directly from 'Reopened' (FR-042, FR-050). The audit log records the reopen. |

## 6.5 UC-05: Administrator Manages Users, Roles, and Crews

| Field | Value |
|---|---|
| Actor | Administrator (crew management is also available to Supervisor and Dispatcher console roles) |
| Preconditions | Administrator is signed in. |
| Main Success Scenario | 1. Administrator navigates to 'Users'. 2. Administrator invites a new staff account, selecting a console role (Administrator, Supervisor, Officer, Dispatcher, Viewer, or Field Crew). 3. System creates the account, sends a credential-set email (or, for Field Crew, provisions the account silently since crews have no personal login flow yet), and records the action. 4. Administrator navigates to 'Crews' and creates a crew, adds members, or toggles a crew's availability. 5. System persists the change; unavailable crews are excluded from the Assign dropdown (FR-050). |
| Postconditions | A new user account exists. Crew rosters and availability reflect the changes. All actions appear in the audit log. |

## 6.6 UC-06: Citizen Follows an Existing Duplicate Report *(new in v2.0)*

| Field | Value |
|---|---|
| Actor | Citizen |
| Preconditions | The Citizen was just offered an existing report as a likely duplicate during UC-01 (i.e. a matching follow-offer exists server-side for this Citizen and this report). |
| Main Success Scenario | 1. Citizen is shown the existing report's summary with a "Follow this report instead?" prompt. 2. Citizen confirms. 3. System verifies the follow-offer, adds the Citizen as a follower, and discards any photo the Citizen had already uploaded for the report they chose not to file. 4. Citizen now sees the report in 'My Reports' and receives every subsequent status notification for it. |
| Alternative — No Matching Offer | If the Citizen (or a forged request) attempts to follow a report id with no matching follow-offer, the system rejects the request — this is the IDOR gate described in NFR-016. |
| Alternative — Mine Is Different | Citizen instead chooses "submit anyway"; the system re-submits with the CV duplicate check skipped, creating a genuinely new report (UC-01). |
| Postconditions | The Citizen follows the existing report (or, on the alternative path, has filed their own new report). No duplicate report was created on the main path. |

## 6.7 UC-07: Citizen Cancels a Submitted Report *(new in v2.0)*

| Field | Value |
|---|---|
| Actor | Citizen (the original reporter) |
| Preconditions | Citizen has a report in 'Submitted' status (not yet acknowledged). |
| Main Success Scenario | 1. Citizen opens the report from 'My Reports'. 2. Citizen taps 'Cancel report'. 3. System verifies the report belongs to the caller and is still 'Submitted'. 4. System deletes the report, its uploaded photographs, and (via cascade) its audit trail and notifications. |
| Alternative — Already Acknowledged | If the report has moved past 'Submitted', the system rejects the cancellation — a citizen cannot un-submit work staff have already started triaging. |
| Postconditions | The report no longer exists in the system. |

---

# 7. Data Requirements

This section defines the logical data model at a conceptual level, consistent with
v1.0's framing. The **physical** schema — exact columns, types, indexes, RLS
policies, and the Mermaid ER diagram — is maintained in
*Design_Documentation.pdf* §6–7 and is kept in sync with
`supabase/migrations/*.sql`, the actual source of truth; this section should be read
as the conceptual companion to that physical design, not a duplicate of it.

## 7.1 Core Entities

| Entity | Description | Key Attributes |
|---|---|---|
| User (`profiles`) | Any account-holding party, extending Supabase Auth. | id, email, phone, role, console_role, status, fullName |
| Crew | A field team with a department and availability. | id, name, department, leadName, available, memberCount |
| Report | A submitted issue. | id, reference, category, description, photoUrls, location, status, reporterId, assignedCrewId, aiSuggestedCategory, duplicateStatus |
| StatusTransition | An immutable record of a status change. | id, reportId, fromStatus, toStatus, byUserId, note, duplicateOfReportId, occurredAt |
| Notification | An outbound message to a User. | id, userId, reportId, type, body, read |
| ReportFollower | A citizen's subscription to a report they did not originally file. | reportId, userId, followedAt |
| DuplicateOffer | A server-issued token recording that a specific report was offered to a specific citizen as a likely duplicate — the security gate behind ReportFollower (NFR-016). | userId, reportId, offeredAt |

Note on scope changes from v1.0: the originally-specified conceptual entities
`Role`, `Category`, `ReportPhoto`, `Assignment`, `AuditLog`, and `Configuration` do
not exist as separate physical tables in the delivered system — `Role` and
`Category` are Postgres enum types rather than configurable rows (§4.9's honest note
on FR-082), `ReportPhoto` is realised as an array column on `Report`, `Assignment` is
realised as a nullable foreign key on `Report` rather than its own table, `AuditLog`
is realised specifically as `StatusTransition` (a narrower, report-scoped audit log
rather than a general one), and no `Configuration` key-value store exists. This is
recorded here for traceability rather than silently reconciled, since it is exactly
the kind of divergence between initial design intent and delivered scope that a
capstone's "challenges and solutions" narrative should discuss.

## 7.2 Key Relationships

- A User in role Citizen owns zero or more Reports (reporter), and separately
  follows zero or more Reports via ReportFollower (new in v2.0).
- A Report belongs to exactly one Category and has zero or one assigned Crew.
- A Report has one or more StatusTransitions, in strict temporal order.
- A Notification is linked optionally to a Report and to exactly one User.
- A DuplicateOffer links exactly one User to exactly one Report and exists purely as
  an internal authorisation token — it has no client-facing read access at all.
- StatusTransitions is append-only and is the system's tamper-resistant record of
  report-status changes.

## 7.3 State Model for Report

The Report entity follows a strict finite-state model. This table is revised from
v1.0 to match exactly what `transition-report` enforces server-side (see
*Design_Documentation.pdf* §5.1 for the equivalent state diagram):

| From | To | Trigger | Authorised Actor |
|---|---|---|---|
| Submitted | Acknowledged | Acknowledge action. | Staff (not Viewer) |
| Submitted | Assigned | Assign to an available Field Crew. | Staff (not Viewer) |
| Submitted | Rejected | Reject with reason. | Staff (not Viewer, not Dispatcher) |
| Acknowledged | Assigned | Assign to an available Field Crew. | Staff (not Viewer) |
| Acknowledged | Rejected | Reject with reason. | Staff (not Viewer, not Dispatcher) |
| Assigned | In Progress | Start action. | Staff (not Viewer/Dispatcher) **or** the assigned Field Crew |
| Assigned | Rejected | Reject with reason. | Staff (not Viewer, not Dispatcher) |
| In Progress | Resolved | Mark resolved with resolution photograph. | Staff (not Viewer/Dispatcher) **or** the assigned Field Crew |
| In Progress | Rejected | Reject with reason. | Staff (not Viewer, not Dispatcher) |
| Resolved | Reopened | Citizen disputes resolution within 7 days. | Originating Citizen only |
| Reopened | Acknowledged | Reports Officer triages the reopened report. | Staff (not Viewer) |
| Reopened | Assigned | Assign directly from Reopened. | Staff (not Viewer) |
| Reopened | Rejected | Reject with reason. | Staff (not Viewer, not Dispatcher) |

Differences from v1.0, all confirmed against the shipped `transition-report`
function: Reject is legal from **any** open status (v1.0 implied it was mainly a
Submitted-state action); Assign and Acknowledge both also accept Reopened as a
starting status, letting a reopened report re-enter the normal flow without a
separate "un-reopen" step; Field Crew members (not only staff) may perform
Start/Resolve on their own crew's assigned reports; and the Dispatcher/Viewer
console-role carve-outs did not exist in v1.0 at all.

---

# 8. System Architecture Overview

This section is descriptive rather than prescriptive, consistent with v1.0's intent,
but now names the implemented technology choices where useful; see
*Design_Documentation.pdf* §1 and §8 for the diagrams.

## 8.1 High-Level Components

FixMyCity is a three-tier web system comprising the Citizen Application (mobile-first
PWA), the MMDA Administrative Dashboard (desktop web app), and the Backend Service,
supported by a relational database, object storage for photographs, and outbound
integrations for email, mapping, and — new in v2.0 — an external computer-vision
service.

- Citizen Application — a Progressive Web Application optimised for low-bandwidth
  mobile use; consumes the Backend API.
- MMDA Administrative Dashboard — a web application optimised for desktop use;
  consumes the same Backend API with different authorisation, plus some direct,
  RLS-scoped reads for low-stakes directory views (Citizens, Crews) where no
  additional business logic is needed beyond "is this caller staff."
- Backend Service — implemented as Supabase Edge Functions (Deno/TypeScript) that
  authenticate users, enforce authorisation, validate inputs, persist data, dispatch
  notifications, and write the audit log.
- Relational Database — Postgres (via Supabase), with the PostGIS extension enabled
  for the AWMA jurisdiction geofence and the pgvector extension present but currently
  dormant (its original duplicate-detection role has been taken over by the external
  CV service's perceptual hashing — see §2.1 and *Design_Documentation.pdf* §7).
- Object Storage — Supabase Storage, private bucket, per-user folder scoping.
- Email Gateway — Resend, for outbound transactional email.
- Mapping Service — OpenStreetMap tiles via Leaflet, for the public map, staff map,
  and address derivation.
- **External CV Microservice** *(new in v2.0)* — a teammate-owned HTTP service
  reached through an anti-corruption adapter; performs photo classification and
  perceptual-hash duplicate detection, and exposes a duplicate-review queue.

## 8.2 Logical Layering

Within the Backend Service, the architecture follows a conventional layered
structure:

1. Interface layer: HTTP endpoints (Edge Functions), request validation, response
   shaping.
2. Application layer: use-case functions orchestrating multiple domain operations
   within a transaction (e.g. `transition-report`'s atomic status-update-plus-audit).
3. Domain layer: entities, state machines (the Report state model in §7.3), and
   business rules, including the AWMA jurisdiction gate.
4. Infrastructure layer: persistence, object storage adapters, email adapter,
   mapping adapter, and — new in v2.0 — the CV-service adapter
   (`_shared/image-model.ts`), which is deliberately isolated as an
   anti-corruption layer so the domain model does not leak the third party's own
   vocabulary (its category names, its confidence scale) into FixMyCity's core.

## 8.3 Context Diagram

See *Design_Documentation.pdf* §1 for the Mermaid rendering of this system's
context. In prose: at the centre sits the FixMyCity Backend Service with its Database
and Object Storage. To the left, the Citizen Application is used by Residents over a
mobile network. To the right, the MMDA Administrative Dashboard is used by Reports
Officers, Field Crews and Administrators. Above the Backend sit the Email Gateway
and the external CV Microservice. Below sits the Mapping Service. Outside the system
boundary but referenced by data flow are the Electricity Company of Ghana, Ghana
Water Company Limited, and the Department of Urban Roads — referenced for future
routing integrations only.

## 8.4 Security Architecture

- Authentication is performed by Supabase Auth; on success a signed access token
  (JWT) is issued.
- Authorisation is enforced in two independent layers: server-side role/ownership
  checks inside each Edge Function, **and** Row-Level Security policies at the
  database layer, so a compromised or bypassed function still cannot leak data the
  database itself will not return.
- Photographs are stored in a private object-storage bucket; URLs are pre-signed and
  time-limited.
- All inputs are validated against typed schemas before reaching the domain layer.
- The audit log (`status_transitions`) is physically append-only, not merely
  conventionally so.
- The `duplicate_offers` capability token is invisible to every client role — the
  IDOR mitigation described in NFR-016.

---

# 9. MoSCoW Prioritisation Summary

This summary collapses the priorities of Section 4 into a one-page reference. It is
the authoritative scope statement for this iteration of FixMyCity.

## 9.1 Must Have (the MVP)

| Theme | Requirement |
|---|---|
| Citizen account | FR-001 to FR-005 |
| Issue reporting + AI classification/dedup | FR-010 to FR-015, FR-018, FR-019 |
| Tracking, cancel, reopen | FR-020 to FR-022, FR-024, FR-025 |
| Public map | FR-030 to FR-032 |
| Officer dashboard | FR-040 to FR-044 |
| Assignment workflow | FR-050 to FR-053, FR-056 |
| Field crew operations | FR-060 to FR-062 |
| Notifications (in-app + email) | FR-070, FR-071, FR-073 |
| Administration | FR-080, FR-081, FR-083, FR-084, FR-086, FR-087, FR-089 |

## 9.2 Should Have

| Theme | Requirement |
|---|---|
| Citizen profile, account deletion | FR-006, FR-007 |
| Multiple photos per report | FR-016 |
| Citizen comments and reopen visibility | FR-023 |
| Public map without authentication | FR-033 |
| SLA visibility in inbox | FR-045 (not implemented — see gap note) |
| Reassignment | FR-054 |
| Field crew notes and navigation | FR-063, FR-064 |
| Data-light field crew mode | FR-065 |
| SLA notifications to Officer | FR-072 (not implemented) |
| Notification opt-out | FR-074 |
| Data export | FR-085 |
| Category/SLA configuration | FR-082 (not implemented — gap) |
| Citizens directory | FR-088 |
| Analytics — operational dashboard | FR-090 |
| Hotspot view and crew productivity | FR-091, FR-092 |

## 9.3 Could Have

| Theme | Requirement |
|---|---|
| Offline submission | FR-017 (not implemented) |
| Public map filters | FR-034 |
| Bulk operations | FR-046 (not implemented) |
| Auto-escalation on SLA breach | FR-055 (not implemented) |
| Category trend chart | FR-093 |

## 9.4 Won't Have (This Iteration) — and one item that moved out of this list

The following remain explicitly excluded from this iteration, documented in
Appendix B as candidate future enhancements: SMS and USSD intake channels;
multi-language support for Twi, Ga, Ewe and other Ghanaian languages; native iOS and
Android applications; integration with the Electricity Company of Ghana (ECG) and
Ghana Water Company Limited (GWCL) ticketing systems; multi-MMDA federation; a
public API for third-party reporting integrations.

**One v1.0 "Won't Have" has shipped.** v1.0's Appendix B.6 explicitly excluded
"machine-learning-based duplicate detection" from this iteration, expecting it "only
after sufficient data is collected during the pilot." In practice, a project teammate
built an external CV service ahead of that expectation, and the team integrated it —
so image-hash-based duplicate detection (FR-018, FR-019, FR-089) is not a future
enhancement but a delivered, verified feature (see the Notable Implementation
Features section of Project_Documentation.pdf). The
in-house pgvector/embedding approach v1.0 implicitly assumed was never built; the
external-vendor approach was used instead, which is a legitimate and arguably lower-
risk way to satisfy the same product goal, and is recorded here as a scope decision
made *during* implementation rather than during requirements engineering — worth
discussing explicitly in the project documentation's "challenges and solutions"
section.

## 9.5 Success Criteria

| Metric | Target |
|---|---|
| Status-update latency | ≥ 70% of submitted reports receive a status update within 48 hours (in the pilot). |
| Resolution within SLA | ≥ 50% of accepted reports reach 'Resolved' status within their category SLA. *(SLA concept itself is not yet implemented — see FR-045/FR-082 — so this target cannot yet be measured; retained as a forward-looking success criterion.)* |
| Closed-loop integrity | 100% of state transitions are accompanied by a notification to the reporter and all followers. |
| Citizen repeat-usage | ≥ 30% of reporters submit a second report within six months (benchmarked against mySociety FixMyStreet research, which found a 54% repeat-usage uplift after a successful first report). |
| Field Crew adoption | ≥ 80% of assigned reports are updated by the assigned Crew directly (FR-056), not by the Reports Officer on their behalf. |
| Audit completeness | 100% of state transitions appear in the append-only audit log. |

---

# Appendix A. Extended Glossary

In addition to the abbreviations defined in Section 1.5, the following operational
terms are used throughout this document.

| Term | Definition |
|---|---|
| Acknowledged | A report state indicating that the Reports Officer has reviewed and accepted the report as valid and in-jurisdiction. |
| Anti-corruption layer | A software design pattern isolating one system's domain model from another's, translating between vocabularies at a single boundary — used here for the external CV service integration. |
| Assigned | A report state indicating that the report has been routed to a specific Field Crew for action. |
| Audit log | An append-only record of security-relevant events maintained for accountability. |
| Backlog | The set of reports that are not yet in a closed state (Resolved or Rejected). |
| Closed-loop | A workflow that informs the originator of each state change of their request; contrasted with predecessor apps where reports disappeared without feedback. |
| Fail-soft | A dependency-handling strategy where a non-critical service's failure degrades functionality gracefully rather than blocking the primary operation — used for the CV service. |
| Field Crew | A user role assigned to MMDA-employed or contractor personnel who perform physical resolution of reports. |
| Follow(-a-duplicate) | The act of a citizen subscribing to an existing report instead of filing a near-identical one; see FR-019, UC-06. |
| Hotspot | A geographic cluster of reports above an analytic threshold. |
| IDOR | See Section 1.5. |
| Jurisdiction | The geographic area governed by the participating MMDA. |
| MoSCoW | Requirements prioritisation method using Must / Should / Could / Won't categories. |
| MVP | Minimum Viable Product; the smallest releasable subset of the system that delivers verifiable value. |
| Perceptual hash | A fingerprint of an image's visual content, robust to minor edits, used to detect near-duplicate photographs. |
| Pilot | An initial, scope-limited deployment of the system to a single MMDA for evaluation. |
| Reopened | A report state entered when a Citizen disputes the resolution of a closed report. |
| Reports Officer | A user role assigned to MMDA staff responsible for triage and assignment. |
| Resolution photograph | A photograph captured by the assigned Field Crew at the time of marking a report as resolved, serving as evidence of completion. |
| Row-Level Security (RLS) | See Section 1.5. |
| SLA | Service Level Agreement; the maximum acceptable resolution time for a report of a given category. Aspirational in the current iteration — not yet a configurable system concept. |
| Status transition | A change of a report's state, accompanied by an immutable audit entry. |
| Triage | The process by which the Reports Officer reviews incoming reports and decides whether to acknowledge, reject, or seek clarification. |

# Appendix B. Future Enhancements

The items below are intentionally excluded from the present iteration. Each is
presented with a brief rationale, a description, and a recommended priority. (One
item originally listed here in v1.0 — machine-learning-based duplicate detection —
has since shipped; see §9.4.) This appendix is developed further, with a full
maintenance and roadmap treatment, in *Maintenance_and_Evolution.pdf*.

## B.1 SMS and USSD Intake

Rationale: A substantial share of Ghanaian residents access digital services through
feature phones over USSD, as evidenced by the dominance of mobile-money flows.
Limiting intake to a Progressive Web Application excludes this population.

Description: An SMS short-code accepting structured messages of the form CATEGORY
\<space\> LOCATION-DESCRIPTION; a USSD menu allowing category selection and
free-text description; integration with a Ghanaian SMS gateway. Photographs, being
unavailable in this channel, would be substituted by a follow-up MMS request or a
callback option.

Recommended priority for next iteration: High.

## B.2 Multi-Language Support

Rationale: English is widely understood in urban Accra but not universal, and
elders, recent migrants and field crews are often more comfortable in Twi, Ga, Ewe or
other Ghanaian languages.

Description: Externalise all user-facing strings (NFR-070), commission translations
for Twi, Ga and Ewe, and provide a language switcher.

Recommended priority for next iteration: High.

## B.3 Native Mobile / Dedicated Field Crew Application

Rationale: A PWA satisfies the immediate need but native applications offer better
camera access, background sync, and push notifications. Field crews currently share
the operations console rather than having a dedicated low-bandwidth app of their own.

Description: React Native or Flutter applications sharing the backend with the PWA,
starting with a dedicated Field Crew app given how minimal its interaction surface
already is (FR-060–FR-065).

Recommended priority for next iteration: Medium.

## B.4 Utility Integrations (ECG, GWCL)

Rationale: Streetlight faults and water leaks routinely cross jurisdictional
boundaries between MMDA and utility. A truly closed-loop system needs handshakes with
utility ticketing systems.

Recommended priority for next iteration: Medium, subject to partnership
feasibility.

## B.5 Multi-MMDA Federation

Rationale: Ghana has 261 MMDAs; a system useful only to a single municipal assembly
captures a fraction of one percent of the addressable market.

Recommended priority for next iteration: Medium.

## B.6 SLA Configuration and Enforcement *(carried forward, revised)*

Rationale: v1.0 assumed SLA targets per category would be an early feature (FR-045,
FR-072, FR-082, the "Resolution within SLA" success criterion). None of this shipped
— categories remain a fixed database enum rather than an administrator-configurable
table with SLA hours attached.

Description: Add a `categories` table (name, `sla_hours`, active flag) that the
`report_category` enum currently precludes; surface SLA breaches in the inbox and as
staff notifications.

Recommended priority for next iteration: High — this is the most-referenced
unimplemented requirement in this document.

## B.7 Public API

Rationale: Civic media and watchdog organisations may wish to integrate FixMyCity
data into their own dashboards, increasing accountability pressure.

Recommended priority for next iteration: Low.

# Appendix C. Traceability Matrix

| Functional Requirement(s) | Use Case(s) | Non-Functional Coverage |
|---|---|---|
| FR-001 to FR-007 | UC-01 (precondition); UC-05 | NFR-010, NFR-011, NFR-015 |
| FR-010 to FR-019 | UC-01, UC-06 | NFR-001, NFR-004, NFR-006, NFR-017, NFR-030, NFR-033 |
| FR-020 to FR-025 | UC-04, UC-07 | NFR-030, NFR-033 |
| FR-030 to FR-034 | n/a (browsing flow) | NFR-002, NFR-032 |
| FR-040 to FR-046 | UC-02 | NFR-002, NFR-003, NFR-040 |
| FR-050 to FR-056 | UC-02, UC-03 | NFR-013, NFR-014 |
| FR-060 to FR-065 | UC-03 | NFR-031 |
| FR-070 to FR-074 | UC-01 to UC-07 | NFR-020, NFR-021 |
| FR-080 to FR-089 | UC-05 | NFR-013, NFR-014, NFR-016 |
| FR-090 to FR-093 | n/a (read flow) | NFR-002, NFR-040 |

# Appendix D. AI Prompts and Process Disclosure

This appendix documents the prompts and process used with AI assistive tools to
produce both versions of this SRS and the accompanying prototype/design artefacts, in
keeping with the capstone's disclosure spirit. Sections D.1–D.6 are retained verbatim
from v1.0 (they document the original SRS and prototype generation). Section D.7 is
new and documents the v2.0 refresh.

## D.1–D.6

Retained from v1.0 without change — see the archived v1.0 document
(`docs/FixMyCity_SRS.docx`) for the full text of the primary SRS-generation prompt,
the methodological notes on that process, and the Claude design / Figma Make
prototype prompts used to build the citizen and console interfaces that were later
ported into this repository's `citizen/` and `console/` React applications per
the team's "port, not reinvent" instruction.

## D.7 Process Disclosure for the v2.0 Refresh *(new)*

Unlike v1.0, which was substantially AI-*generated* from a single detailed prompt,
v2.0 was AI-*assisted research and drafting under close direction*, with a
different and arguably stronger guarantee of accuracy: every factual claim about the
delivered system in this revision was derived by having Claude Code read the actual
source of truth — all 18 database migrations in `supabase/migrations/`, all 10 edge
functions in `supabase/functions/`, and the project's existing internal changelog and
feature records — rather than being re-prompted from
memory or intent. Where the real implementation disagreed with v1.0's requirements
(the AI/duplicate-detection redesign, the state-machine precision, the unimplemented
category/SLA configuration), that disagreement is stated explicitly in the relevant
section rather than silently smoothed over, on the view that an honest account of
what shipped versus what was planned is itself part of what a capstone SRS should
demonstrate. The team reviewed this revision before submission; corrections and
disagreements with the AI's characterisation of the system belong in a future
revision-history entry, not a silent edit.

---

*This Software Requirements Specification is issued as Version 2.0 for capstone
submission. Subsequent versions, if any, will be recorded in the Revision History in
the Document Control section.*
