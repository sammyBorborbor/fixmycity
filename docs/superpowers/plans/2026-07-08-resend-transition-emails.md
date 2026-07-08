# Resend Transition-Status Emails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the email leg of FR-070/071 (citizen notified on every status transition, in-app + email) by sending a Resend HTML email from `transition-report` alongside the in-app `notifications` row it already writes on every transition.

**Architecture:** All changes live in one file, `supabase/functions/transition-report/index.ts`. New module-scope consts map each status to a human label and inline-email-safe badge color, and each report category to a human label. A new `renderTransitionEmail`/`renderTransitionEmailText` pair builds the HTML/plain-text bodies from those maps plus the existing `notifyBody()` copy. A new `sendTransitionEmail` helper POSTs to Resend's REST API directly via `fetch` (no SDK), reading `RESEND_API_KEY` from `Deno.env.get`. The existing `apply()` function calls all of this in a non-fatal try/catch immediately after its current notifications insert.

**Tech Stack:** Deno edge function (existing), `jsr:@supabase/supabase-js@2` (existing import, no new dependency), Resend REST API via raw `fetch`.

## Global Constraints

- Full spec: `docs/superpowers/specs/2026-07-08-resend-transition-emails-design.md` — read it before starting if anything below is ambiguous.
- Scope is exactly the 6 transitions that already reach `apply()` in `transition-report/index.ts` (acknowledge, assign, reject, start, resolve, reopen). Do not touch `submit-report` — no submission-confirmation email in this iteration.
- Sender address is exactly `noreply@fixmycity.gov.gh` (verified Resend domain) — do not use the Resend sandbox address.
- `RESEND_API_KEY` is already set as a secret on the hosted Supabase project (ref `hvesugctansssxwtzjqn`) — do not re-set it, and never print/log its value.
- Email delivery must never fail the transition itself: every new code path added to `apply()` is wrapped so a thrown error is caught and logged, not propagated.
- No new DB migrations, no new tables/columns, no changes to `citizen/` or `console/` apps.
- This repo has no test framework for edge functions (no `deno.json`, no `*_test.ts` files, and the Deno CLI itself is not installed in this environment) — do not invent a test harness. Verification is: read the diff carefully, deploy to the hosted project, and manually trigger a real transition (Task 4).
- Report URLs point at `https://fixmycity-citizen.vercel.app/reports/<id>` (the deployed citizen app).
- Commit messages: short imperative subject, plain text only, no emojis, no Co-Authored-By trailer (per this repo's CLAUDE.md).
- Yarn only for any package-manager commands (none expected in this plan — no new dependencies).

---

## Task 1: Add label/color maps and the email template renderers

**Files:**
- Modify: `supabase/functions/transition-report/index.ts:37-39` (insert new code between the end of `notifyBody()` at line 37 and `Deno.serve(async (req) => {` at line 39)

**Interfaces:**
- Produces: `STATUS_LABEL: Record<Status, string>`, `STATUS_BADGE: Record<Status, { bg: string; text: string }>`, `CATEGORY_LABEL: Record<string, string>`, `interface TransitionEmailParams`, `renderTransitionEmail(p: TransitionEmailParams): string`, `renderTransitionEmailText(p: TransitionEmailParams): string`. Consumed by Task 3.

- [ ] **Step 1: Confirm the exact insertion point**

Run:
```bash
sed -n '25,40p' /Users/oneplan/personal/school-work/fixmycity/supabase/functions/transition-report/index.ts
```
Expected output (unchanged from today):
```
// citizen-facing copy for the notification feed, keyed by the new status
function notifyBody(status: Status, crewName: string | null, reason: string | null): string {
  switch (status) {
    case 'acknowledged': return 'AWMA has reviewed your report.';
    case 'assigned':     return `Assigned to ${crewName ?? 'a field crew'}.`;
    case 'in_progress':  return 'A crew is now working on your issue.';
    case 'resolved':     return 'Your report has been marked resolved.';
    case 'rejected':     return reason ?? 'This report could not be actioned.';
    case 'reopened':     return 'You sent this report back to AWMA.';
    default:             return 'Your report was updated.';
  }
}

Deno.serve(async (req) => {
```
If this doesn't match, stop and re-read the current file before proceeding — later steps assume this exact layout.

- [ ] **Step 2: Insert the label/color maps and template functions**

Insert the following block immediately after the `notifyBody()` function's closing `}` (i.e. directly before the blank line that precedes `Deno.serve(async (req) => {`):

```ts
// human-readable labels + inline-email-safe colors, mirroring citizen/src/lib/store.tsx's
// STATUS/DB_TO_CATEGORY consts. Duplicated here (not imported) since edge functions are
// self-contained Deno files that can't import client app code — same convention documented
// in _shared/image-model.ts.
const STATUS_LABEL: Record<Status, string> = {
  submitted: 'Submitted', acknowledged: 'Acknowledged', assigned: 'Assigned',
  in_progress: 'In Progress', resolved: 'Resolved', rejected: 'Rejected', reopened: 'Reopened',
};
const STATUS_BADGE: Record<Status, { bg: string; text: string }> = {
  submitted:    { bg: '#F3F4F6', text: '#4B5563' },
  acknowledged: { bg: '#EFF6FF', text: '#1D4ED8' },
  assigned:     { bg: '#DBEAFE', text: '#1E3A8A' },
  in_progress:  { bg: '#FFFBEB', text: '#92400E' },
  resolved:     { bg: '#F0FDF4', text: '#15803D' },
  rejected:     { bg: '#FEF2F2', text: '#B91C1C' },
  reopened:     { bg: '#FFF7ED', text: '#C2410C' },
};
const CATEGORY_LABEL: Record<string, string> = {
  dumping: 'Illegal Dumping', drain: 'Blocked Drain', streetlight: 'Broken Streetlight',
};

interface TransitionEmailParams {
  statusLabel: string;
  badge: { bg: string; text: string };
  bodyText: string;
  reference: string;
  category: string;
  locationName: string;
  reportUrl: string;
}

// inline-styled HTML: email clients strip <style> blocks and external stylesheets, so every
// rule has to be a literal style="" attribute
function renderTransitionEmail(p: TransitionEmailParams): string {
  return `
<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;background:#FAFAFA">
  <div style="background:#0B2545;padding:24px;text-align:center">
    <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.02em">FixMyCity</span>
  </div>
  <div style="background:#ffffff;padding:24px;border:1px solid #E5E7EB;border-top:none">
    <span style="display:inline-block;background:${p.badge.bg};color:${p.badge.text};font-size:12px;font-weight:600;padding:4px 10px;border-radius:9999px">${p.statusLabel}</span>
    <p style="color:#1F2937;font-size:15px;line-height:1.5;margin:16px 0">${p.bodyText}</p>
    <div style="background:#FAFAFA;border-radius:12px;padding:16px;margin:16px 0">
      <p style="color:#6B7280;font-size:12px;margin:0 0 4px">${p.reference}</p>
      <p style="color:#1F2937;font-size:14px;font-weight:600;margin:0">${p.category}</p>
      <p style="color:#6B7280;font-size:13px;margin:4px 0 0">${p.locationName}</p>
    </div>
    <a href="${p.reportUrl}" style="display:inline-block;background:#0B2545;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 20px;border-radius:8px">View in FixMyCity</a>
  </div>
  <p style="color:#6B7280;font-size:11px;text-align:center;padding:16px">FixMyCity &middot; AWMA pilot &middot; Accra</p>
</div>`.trim();
}

function renderTransitionEmailText(p: TransitionEmailParams): string {
  return `FixMyCity — ${p.statusLabel}\n\n${p.bodyText}\n\n${p.reference} · ${p.category} · ${p.locationName}\n\nView in FixMyCity: ${p.reportUrl}`;
}
```

- [ ] **Step 3: Typecheck**

Run:
```bash
cd /Users/oneplan/personal/school-work/fixmycity && grep -n "STATUS_LABEL\|STATUS_BADGE\|CATEGORY_LABEL\|renderTransitionEmail" supabase/functions/transition-report/index.ts
```
Expected: 6 matches (the 3 const declarations, the interface use is inline so won't match, `renderTransitionEmail` and `renderTransitionEmailText` function declarations). This file can't be typechecked with `tsc` (it's a Deno file, not part of either app's TS project, and the Deno CLI isn't installed here) — this grep is a sanity check that the block landed once, correctly, not a substitute for Task 4's real verification.

- [ ] **Step 4: Commit**

```bash
cd /Users/oneplan/personal/school-work/fixmycity
git add supabase/functions/transition-report/index.ts
git commit -m "Add status/category label maps and email template for transition-report"
```

---

## Task 2: Add the Resend send helper

**Files:**
- Modify: `supabase/functions/transition-report/index.ts` (insert directly after `renderTransitionEmailText`, still before `Deno.serve(async (req) => {`)

**Interfaces:**
- Consumes: nothing new (uses global `fetch`, `Deno.env.get`).
- Produces: `async function sendTransitionEmail(to: string, subject: string, html: string, text: string): Promise<void>` — throws on any failure (missing key is the one exception: it logs and returns instead of throwing, so a local/dev environment without the secret doesn't need special-casing at the call site). Consumed by Task 3.

- [ ] **Step 1: Insert the helper**

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

- [ ] **Step 2: Verify placement**

Run:
```bash
sed -n '/^function renderTransitionEmailText/,/^Deno.serve/p' /Users/oneplan/personal/school-work/fixmycity/supabase/functions/transition-report/index.ts
```
Expected: `renderTransitionEmailText`'s body, then the new `sendTransitionEmail` function, then the `Deno.serve(async (req) => {` line — in that order, with nothing else between them.

- [ ] **Step 3: Commit**

```bash
cd /Users/oneplan/personal/school-work/fixmycity
git add supabase/functions/transition-report/index.ts
git commit -m "Add Resend send helper to transition-report"
```

---

## Task 3: Wire email sending into `apply()`

**Files:**
- Modify: `supabase/functions/transition-report/index.ts` (inside the `apply()` function, between the existing notifications-insert block and the final re-fetch/return)

**Interfaces:**
- Consumes: `STATUS_LABEL`, `STATUS_BADGE`, `CATEGORY_LABEL`, `renderTransitionEmail`, `renderTransitionEmailText`, `sendTransitionEmail` (all from Tasks 1-2); `admin` (existing service-role client already in scope inside `apply()`); `report`, `reportId`, `to`, `crewName`, `noteText` (all existing local variables already in scope at this point in `apply()`).
- Produces: nothing new consumed elsewhere — this is the terminal wiring step for this feature.

- [ ] **Step 1: Confirm the exact insertion point**

Tasks 1-2 inserted new code before `Deno.serve`, which shifts this block's line numbers down from where they are in today's file — search by content instead of by line number:
```bash
grep -n -A 17 "// notify the reporter" /Users/oneplan/personal/school-work/fixmycity/supabase/functions/transition-report/index.ts
```
Expected output (content unchanged from today, at whatever line number it now starts):
```
    // notify the reporter (non-fatal — the transition already stands)
    const assignedCrewId = (extra.assigned_crew_id as string) ?? report!.assigned_crew_id;
    let crewName: string | null = null;
    if (assignedCrewId) {
      const { data: crew } = await admin.from('crews').select('name').eq('id', assignedCrewId).single();
      crewName = crew?.name ?? null;
    }
    const { error: notifyErr } = await admin.from('notifications').insert({
      user_id: report!.reporter_id,
      report_id: reportId,
      type: to,
      body: notifyBody(to, crewName, noteText),
    });
    if (notifyErr) console.error('notification insert failed:', notifyErr.message);

    const { data: updated } = await admin.from('reports').select('*').eq('id', reportId).single();
    return json({ report: updated });
  }
```
If this doesn't match, stop and re-read the current file before proceeding.

- [ ] **Step 2: Insert the email-sending block**

Insert the following immediately after the `if (notifyErr) console.error(...)` line and before the blank line that precedes `const { data: updated } = ...`:

```ts

    // email the reporter too (FR-070/071) — non-fatal, mirrors the notifyErr handling above
    try {
      const { data: authUser } = await admin.auth.admin.getUserById(report!.reporter_id);
      const toEmail = authUser?.user?.email;
      if (toEmail) {
        const label = STATUS_LABEL[to];
        const subject = `FixMyCity — ${label} · ${report!.reference}`;
        const bodyText = notifyBody(to, crewName, noteText);
        const params: TransitionEmailParams = {
          statusLabel: label,
          badge: STATUS_BADGE[to],
          bodyText,
          reference: report!.reference,
          category: CATEGORY_LABEL[report!.category] ?? report!.category,
          locationName: report!.location_name,
          reportUrl: `https://fixmycity-citizen.vercel.app/reports/${reportId}`,
        };
        await sendTransitionEmail(toEmail, subject, renderTransitionEmail(params), renderTransitionEmailText(params));
      }
    } catch (e) {
      console.error('transition email failed:', e);
    }
```

The full block, in order, should now read: update reports -> insert status_transitions -> insert notifications (existing) -> send email (new) -> re-fetch and return.

- [ ] **Step 3: Verify the final structure of `apply()`**

Run (content-anchored, same reason as Step 1 — line numbers have shifted):
```bash
grep -n -A 60 "async function apply(" /Users/oneplan/personal/school-work/fixmycity/supabase/functions/transition-report/index.ts
```
Expected: the full `apply()` function body, ending in `const { data: updated } = await admin.from('reports').select('*').eq('id', reportId).single();` then `return json({ report: updated });` then the closing `}` — with the new try/catch block appearing exactly once, after the notifications insert and before the re-fetch.

- [ ] **Step 4: Commit**

```bash
cd /Users/oneplan/personal/school-work/fixmycity
git add supabase/functions/transition-report/index.ts
git commit -m "Send transition-status email to reporter from transition-report"
```

---

## Task 4: Deploy and verify end-to-end

**Files:** none (deployment + manual verification only)

**Interfaces:** none — this task consumes the finished `transition-report/index.ts` from Tasks 1-3 and produces a verified, working deployment.

- [ ] **Step 1: Deploy the updated function to the hosted project**

Use the Supabase MCP `deploy_edge_function` tool (or, if unavailable, run):
```bash
cd /Users/oneplan/personal/school-work/fixmycity
yarn supabase functions deploy transition-report --project-ref hvesugctansssxwtzjqn
```
Expected: deployment succeeds with no build errors reported.

- [ ] **Step 2: Create a disposable test report to transition (do not mutate the real seed reports)**

Following this repo's existing E2E convention (`.claude/skills/verify/SKILL.md`), sign in to the citizen app as `ama.asante@gmail.com` / `accra2026` and submit a new report with a description starting with `E2E` (e.g. "E2E resend email test — blocked drain near Okponglo"), any category, any photo (`citizen/public/icon-512.png` works as a stand-in upload), any location. Note the returned reference (e.g. `FMC-2026-05xx`).

- [ ] **Step 3: Acknowledge the test report from the console app**

Sign in to the console app as `akua.osei@awma.gov.gh` / `awma-ops-2026`, open the Inbox, find the report by its reference/description from Step 2, open its detail panel, and click "Acknowledge". This is the actual trigger for the new email code path (status `submitted` -> `acknowledged`).

- [ ] **Step 4: Check the edge function logs for errors**

Use the Supabase MCP `get_logs` tool for the `transition-report` function (or the Dashboard's Edge Functions -> Logs page) covering the last few minutes. Expected: a log entry for the acknowledge request with a 200 response, and **no** `transition email failed:` or `RESEND_API_KEY not configured` error lines. If either error appears, stop and debug before continuing (do not proceed to claim this task complete).

- [ ] **Step 5: Confirm actual email delivery**

Check `ama.asante@gmail.com`'s inbox (the account holder needs to do this part directly) for an email from `FixMyCity <noreply@fixmycity.gov.gh>` with subject `FixMyCity — Acknowledged · <reference from Step 2>`. Separately, check the Resend dashboard's Emails/Logs view for a matching send with a "Delivered" (or at least "Sent") status. Both must be confirmed before this task is considered done — log-level success in Step 4 only proves the API call succeeded, not that the message was actually delivered.

- [ ] **Step 6: Spot-check the remaining transition types' copy**

Using the same test report, drive it through the rest of its lifecycle from the console app (Assign -> a crew, Start, Resolve), and separately submit and Reject a second throwaway `E2E`-prefixed report with a reason. Confirm each resulting email's subject line and status badge color match its transition (e.g. Assigned shows the blue-100 badge, Resolved shows the green badge, the Rejected email's body includes the rejection reason text).

- [ ] **Step 7: Clean up the test reports**

Per the verify skill's documented cleanup pattern, remove the `E2E`-prefixed reports from the live project (the append-only trigger on `status_transitions` must be disabled for the duration of the delete):
```sql
alter table status_transitions disable trigger transitions_append_only;
delete from reports where description like 'E2E%';
alter table status_transitions enable trigger transitions_append_only;
```
Run this via the Supabase MCP `execute_sql` tool against the hosted project. Expected: the `E2E`-prefixed reports and their associated `status_transitions`/`notifications` rows (both cascade-deleted via foreign keys) are gone; re-run `select count(*) from reports where description like 'E2E%';` and expect `0`.

- [ ] **Step 8: Final commit (if any docs need updating)**

No code changes are expected in this task. If Step 6 revealed a copy or color mismatch that required a fix, that fix should have already been committed as part of returning to Task 3 — this step is just confirming a clean `git status` before calling the feature done:
```bash
cd /Users/oneplan/personal/school-work/fixmycity && git status --short
```
Expected: no uncommitted changes to `supabase/functions/transition-report/index.ts`.
