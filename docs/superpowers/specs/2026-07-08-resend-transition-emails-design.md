# Resend transition-status emails — design spec

## Context

CLAUDE.md locks in "email via Resend" as one of the two notification channels for every
status transition (alongside in-app Supabase Realtime, already implemented — see the
`notifications` table, `transition-report`'s existing insert into it, and the citizen app's
bell/Notifications feed). FR-070/071 requires the citizen be notified on every transition via
both channels; only the email leg is missing. A Resend API key has been set as a secret on the
Supabase project's edge functions.

## Scope

- Single file: `supabase/functions/transition-report/index.ts`. Fires for all 6 transitions
  that already reach `apply()`: acknowledge, assign, reject, start, resolve, reopen.
- No changes to `submit-report` — no submission-confirmation email in this iteration; scope is
  limited to status transitions, matching FR-070/071's wording exactly.
- Required secret (already set): `RESEND_API_KEY`.
- Sender: `noreply@fixmycity.gov.gh` (verified Resend domain).
- No new DB columns/tables. No changes to the citizen or console apps.

## Part 1 — Fetching the reporter's email

`public.profiles` has no email column (see `20260707131603_initial_schema.sql`); email only
exists on `auth.users`. `transition-report` already builds a service-role `admin` client, so:

```ts
const { data: authUser } = await admin.auth.admin.getUserById(report!.reporter_id);
const toEmail = authUser?.user?.email;
```

If this fails or returns no email, sending is skipped (logged, non-fatal) — same treatment as
every other failure mode below.

## Part 2 — Status label / category label / color maps (new, function-local)

`transition-report` currently only has `notifyBody()` (sentence copy), no human-readable status
label or color. Both the citizen and console apps already maintain their own copies of this
mapping client-side (`citizen/src/lib/store.tsx`'s `STATUS` and `DB_TO_CATEGORY` consts); since
edge functions are self-contained Deno files that can't import client code, the same values are
duplicated here rather than shared, matching the existing "self-contained, deliberate exception
only when truly reused" convention documented in `_shared/image-model.ts`:

```ts
const STATUS_LABEL: Record<Status, string> = {
  submitted: 'Submitted', acknowledged: 'Acknowledged', assigned: 'Assigned',
  in_progress: 'In Progress', resolved: 'Resolved', rejected: 'Rejected', reopened: 'Reopened',
};
// bg/text pairs mirror this repo's existing pill classes (STATUS.pill in store.tsx),
// converted to their standard Tailwind hex values for use in inline email HTML
const STATUS_BADGE: Record<Status, { bg: string; text: string }> = {
  submitted:    { bg: '#F3F4F6', text: '#4B5563' }, // gray-100 / gray-600
  acknowledged: { bg: '#EFF6FF', text: '#1D4ED8' }, // blue-50 / blue-700
  assigned:     { bg: '#DBEAFE', text: '#1E3A8A' }, // blue-100 / blue-900
  in_progress:  { bg: '#FFFBEB', text: '#92400E' }, // amber-50 / amber-800
  resolved:     { bg: '#F0FDF4', text: '#15803D' }, // green-50 / green-700
  rejected:     { bg: '#FEF2F2', text: '#B91C1C' }, // red-50 / red-700
  reopened:     { bg: '#FFF7ED', text: '#C2410C' }, // orange-50 / orange-700
};
const CATEGORY_LABEL: Record<string, string> = {
  dumping: 'Illegal Dumping', drain: 'Blocked Drain', streetlight: 'Broken Streetlight',
};
```

## Part 3 — Email template (inline HTML, no external template engine)

One function, `renderTransitionEmail(params)`, returns an HTML string built from a template
literal (email clients require inline CSS, no external stylesheets/classes):

- Navy (`#0B2545`) header band with the "FixMyCity" wordmark.
- Status badge: small rounded pill using `STATUS_BADGE[to]`'s `bg`/`text`, labeled with
  `STATUS_LABEL[to]`.
- Main message: the same string `notifyBody(to, crewName, noteText)` already generates for the
  in-app notification — one source of truth for the wording, just wrapped in a template instead
  of duplicated.
- Metadata block: report reference (`report.reference`), category (`CATEGORY_LABEL[report.category]`),
  location (`report.location_name`).
- CTA link: "View in FixMyCity" → `https://fixmycity-citizen.vercel.app/reports/${reportId}`
  (opens the report detail screen once signed in).
- A plain-text version (`text` field) is built from the same pieces and sent alongside the HTML
  — Resend accepts `html` alone, but including `text` improves deliverability/spam scoring.

## Part 4 — Sending (new helper, local to this file)

```ts
async function sendTransitionEmail(to: string, subject: string, html: string, text: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) { console.error('RESEND_API_KEY not configured — skipping email'); return; }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from: 'FixMyCity <noreply@fixmycity.gov.gh>', to, subject, html, text }),
  });
  if (!res.ok) throw new Error(`resend returned ${res.status}: ${await res.text()}`);
}
```

Matches the raw-`fetch` pattern already established in `_shared/image-model.ts` for calling an
external API with a secret from `Deno.env.get` — no `npm:resend` dependency added.

## Part 5 — Wiring into `apply()`

Immediately after the existing notifications insert (`transition-report/index.ts:103-109`),
inside the same function, in a non-fatal try/catch mirroring how `notifyErr` is already just
logged today without failing the transition:

```ts
try {
  const { data: authUser } = await admin.auth.admin.getUserById(report!.reporter_id);
  const toEmail = authUser?.user?.email;
  if (toEmail) {
    const label = STATUS_LABEL[to];
    const subject = `FixMyCity — ${label} · ${report!.reference}`;
    const bodyText = notifyBody(to, crewName, noteText);
    const html = renderTransitionEmail({
      statusLabel: label, badge: STATUS_BADGE[to], bodyText,
      reference: report!.reference, category: CATEGORY_LABEL[report!.category],
      locationName: report!.location_name,
      reportUrl: `https://fixmycity-citizen.vercel.app/reports/${reportId}`,
    });
    await sendTransitionEmail(toEmail, subject, html, bodyText);
  }
} catch (e) {
  console.error('transition email failed:', e);
}
```

## Error handling / invariants

- Email delivery never affects the transition's success — the status update + audit row write
  (the existing atomic core of `apply()`) happen first and are returned to the caller
  regardless of what happens below them.
- Missing `RESEND_API_KEY` (e.g. local `supabase functions serve` without it configured): skip
  + log, never throws.
- No audit trail of "was this email actually sent" beyond Resend's own dashboard logs — the
  existing `notifications` row remains the durable, in-app record that the citizen was
  notified; adding email-delivery tracking is out of scope here.

## Verification

No existing test suite covers edge functions (`submit-report`/`classify-image`/
`check-duplicates` have none either); this follows the same manual pattern already used for
those:

1. Deploy the updated function (Supabase MCP `deploy_edge_function`, or
   `yarn supabase functions deploy transition-report`).
2. Trigger a real transition from the console app (e.g. acknowledge a submitted seed report,
   signed in as `akua.osei@awma.gov.gh`).
3. Confirm the email arrives at the reporter's real address; check Resend's dashboard logs for
   delivery status.
4. Spot-check subject/body for at least acknowledge, assign, resolve, and reject-with-reason,
   to confirm copy and badge colors match expectations across the range of transition types.
