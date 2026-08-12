# FixMyCity — UI Screenshots

Real screenshots of the two running FixMyCity front-ends (citizen PWA + operations
console), captured against the **live hosted Supabase project** — not mockups or
redrawn wireframes. Captured with Playwright: citizen app at a 420x860 mobile
viewport, console app at a 1440x900 desktop viewport. Data shown (reports, crews,
users, timelines) is the live seeded demo dataset (`supabase/seed/demo-users.sql`).

## Citizen App

![Login screen — email/password sign-in with the navy-to-blue gradient header, pin logo and tagline "Report local issues. Track every fix."](screenshots/citizen-01-login.png)

![Home screen — signed in as citizen Ama Asante; gradient "Report an issue" CTA, total/in-progress stat tiles, and a "Your recent reports" list, per FR-010](screenshots/citizen-02-home.png)

![Report flow step 1 — category selection across all 9 AI-aligned categories (Illegal Dumping, Blocked Drain, Broken Streetlight, Flooding, Pothole, Pollution, Broken Public Facility, Poor Sanitation, Other), per the 2026-07-24 category widening](screenshots/citizen-03-report-step1-category.png)

![Report flow step 2 — photo capture, Ayawaso West location picker (map + neighbourhood dropdown) and description; Submit stays disabled until a photo is attached, per FR-011](screenshots/citizen-04-report-step2-details.png)

![My Reports — full list of the signed-in citizen's 10 reports, newest first, each showing category, location, status pill and reference number](screenshots/citizen-05-my-reports.png)

![Report detail (FMC-2026-0533, Resolved) — vertical status timeline with a timestamp and actor for every transition (Submitted -> Acknowledged -> Assigned -> In Progress -> Resolved), demonstrating the closed-loop audit trail per FR-052](screenshots/citizen-06-report-detail-timeline.png)

![Issue map — Leaflet/OpenStreetMap map of all reports across Ayawaso West with status-coloured pins and a legend for all 7 statuses](screenshots/citizen-07-map.png)

![Profile screen — signed-in citizen's account details, notification toggles, and settings rows](screenshots/citizen-08-profile.png)

## Console

![Staff login — AWMA-branded sign-in card on the navy radial-gradient backdrop, prefilled work email](screenshots/console-01-login.png)

![Inbox — default view after staff sign-in: status filter chips with live counts, category/area/crew dropdown filters, and the reports table (Reference, Category, Location, Submitted, Status, Crew) across all 34 seeded reports](screenshots/console-02-inbox.png)

![Report detail panel (FMC-2026-0533) — slides in from the right with photo, mini-map, reporter, description, assigned crew (Crew Alpha), and the full 5-step status timeline with timestamp + actor per transition, per FR-052](screenshots/console-03-detail-panel.png)

![Map screen — full-width Leaflet/OpenStreetMap view of all reports with status-coloured pins and legend](screenshots/console-04-map.png)

![Assignments — one column per crew listing its active reports with a live count, for triage and workload balancing](screenshots/console-05-assignments.png)

![Crews — crew cards for Alpha, Beta and Gamma showing lead, member count, phone, availability toggle and live active-job count](screenshots/console-06-crews.png)

![Users & Roles (Administrator only) — staff directory with avatar, name, email, unit, colour-coded role dropdown (Administrator/Supervisor/Officer/Dispatcher/Viewer) and Active/Suspended status, per the RBAC matrix in permsFor()](screenshots/console-07-users-roles.png)

![Citizens directory (Administrator/Supervisor only) — read-only list of every citizen profile with avatar, email, join date and report count, backed directly by RLS-protected reads](screenshots/console-08-citizens.png)

![Duplicate Reviews — AI feature 2 in action: 4 open candidate pairs flagged by the external CV service's perceptual-hash dedup, each showing a match percentage, side-by-side photos and Resolve/Merge actions for the human-in-the-loop officer decision](screenshots/console-09-duplicate-reviews.png)

![Analytics — resolution-time and throughput metrics computed live from the status_transitions audit trail (avg. resolution time, resolved-this-week delta)](screenshots/console-10-analytics.png)
