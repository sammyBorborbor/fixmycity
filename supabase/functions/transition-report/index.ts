// transition-report — THE server-side state machine (CLAUDE.md principle 3).
// Clients never write statuses; every legal transition goes through here,
// produces exactly one status_transitions audit row, and notifies the citizen.
//
// Citizen action: reopen (reporter, from Resolved, within 7 days — FR-024).
// Staff actions: acknowledge | assign | reject | start | resolve (officer/admin).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const REOPEN_WINDOW_DAYS = 7;

type Status = 'submitted' | 'acknowledged' | 'assigned' | 'in_progress' | 'resolved' | 'rejected' | 'reopened';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

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

// HTML escaping: prevents XSS injection from user-provided text interpolated into email HTML
function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
    <span style="display:inline-block;background:${p.badge.bg};color:${p.badge.text};font-size:12px;font-weight:600;padding:4px 10px;border-radius:9999px">${escapeHtml(p.statusLabel)}</span>
    <p style="color:#1F2937;font-size:15px;line-height:1.5;margin:16px 0">${escapeHtml(p.bodyText)}</p>
    <div style="background:#FAFAFA;border-radius:12px;padding:16px;margin:16px 0">
      <p style="color:#6B7280;font-size:12px;margin:0 0 4px">${escapeHtml(p.reference)}</p>
      <p style="color:#1F2937;font-size:14px;font-weight:600;margin:0">${escapeHtml(p.category)}</p>
      <p style="color:#6B7280;font-size:13px;margin:4px 0 0">${escapeHtml(p.locationName)}</p>
    </div>
    <a href="${escapeHtml(p.reportUrl)}" style="display:inline-block;background:#0B2545;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 20px;border-radius:8px">View in FixMyCity</a>
  </div>
  <p style="color:#6B7280;font-size:11px;text-align:center;padding:16px">FixMyCity &middot; AWMA pilot &middot; Accra</p>
</div>`.trim();
}

function renderTransitionEmailText(p: TransitionEmailParams): string {
  return `FixMyCity — ${p.statusLabel}\n\n${p.bodyText}\n\n${p.reference} · ${p.category} · ${p.locationName}\n\nView in FixMyCity: ${p.reportUrl}`;
}

async function sendTransitionEmail(to: string, subject: string, html: string, text: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) { console.error('RESEND_API_KEY not configured — skipping email'); return; }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from: 'FixMyCity <fixmycity@aseda-pos.byte24systems.com>', to, subject, html, text }),
  });
  if (!res.ok) throw new Error(`resend returned ${res.status}: ${await res.text()}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'not signed in' }, 401);

  let body: {
    report_id?: string; action?: string; note?: string; crew_id?: string; reason?: string;
    duplicate_of_report_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }
  const { report_id: reportId, action, note, crew_id: crewId, reason } = body;
  if (!reportId || !action) return json({ error: 'report_id and action are required' }, 400);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: report } = await admin.from('reports').select('*').eq('id', reportId).single();
  if (!report) return json({ error: 'report not found' }, 404);
  const status = report.status as Status;

  // caller's role (needed for staff-action authorization + the audit actor_role)
  const { data: profile } = await admin.from('profiles').select('role, console_role, crew_id').eq('id', user.id).single();
  const role = profile?.role as 'citizen' | 'officer' | 'crew' | 'admin' | undefined;
  const isStaff = role === 'officer' || role === 'admin';
  // Field crew may progress/resolve reports assigned to THEIR crew (FR-061).
  const isCrew = role === 'crew';
  const crewOwnsReport = isCrew && !!profile?.crew_id && report.assigned_crew_id === profile.crew_id;

  // Per-console_role action allow-list (mirrors permsFor() in the console store).
  // Dispatchers may only acknowledge/assign; Viewers may act on nothing. Any other
  // office role (Administrator/Supervisor/Officer, or a staff account with no
  // console_role set) keeps the full set.
  const consoleRole = profile?.console_role as string | null;
  const ACTIONS_BY_CONSOLE_ROLE: Record<string, string[]> = {
    Dispatcher: ['acknowledge', 'assign'],
    Viewer: [],
  };
  const roleAllows = (action: string) =>
    !consoleRole || !(consoleRole in ACTIONS_BY_CONSOLE_ROLE)
      ? true
      : ACTIONS_BY_CONSOLE_ROLE[consoleRole].includes(action);

  // resolve a transition: validate legality, then apply status + audit + notify atomically
  async function apply(
    from: Status, to: Status, actorRole: string, extra: Record<string, unknown> = {}, noteText: string | null = null,
    duplicateOfReportId: string | null = null,
  ) {
    const { error: updateErr } = await admin.from('reports').update({ status: to, ...extra }).eq('id', reportId);
    if (updateErr) return json({ error: updateErr.message }, 500);

    const { error: auditErr } = await admin.from('status_transitions').insert({
      report_id: reportId, from_status: from, to_status: to,
      actor_id: user!.id, actor_role: actorRole, note: noteText,
      duplicate_of_report_id: duplicateOfReportId,
    });
    if (auditErr) {
      // audit row failed: revert so status and audit log never disagree
      await admin.from('reports').update({ status: from }).eq('id', reportId);
      return json({ error: auditErr.message }, 500);
    }

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

    const { data: updated } = await admin.from('reports').select('*').eq('id', reportId).single();
    return json({ report: updated });
  }

  switch (action) {
    /* ---- citizen ---- */
    case 'reopen': {
      if (report.reporter_id !== user.id) return json({ error: 'only the reporter can reopen' }, 403);
      if (status !== 'resolved') return json({ error: 'only resolved reports can be reopened' }, 409);
      const { data: resolvedAt } = await admin
        .from('status_transitions').select('created_at')
        .eq('report_id', reportId).eq('to_status', 'resolved')
        .order('created_at', { ascending: false }).limit(1).single();
      const ageDays = resolvedAt
        ? (Date.now() - new Date(resolvedAt.created_at).getTime()) / 86_400_000
        : Infinity;
      if (ageDays > REOPEN_WINDOW_DAYS) {
        return json({ error: `reports can only be reopened within ${REOPEN_WINDOW_DAYS} days of resolution` }, 409);
      }
      return apply('resolved', 'reopened', 'citizen', {}, note ?? null);
    }

    /* ---- staff ---- */
    case 'acknowledge': {
      if (!isStaff) return json({ error: 'staff only' }, 403);
      if (!roleAllows(action!)) return json({ error: 'your role cannot perform this action' }, 403);
      if (status !== 'submitted' && status !== 'reopened') return json({ error: 'can only acknowledge a submitted or reopened report' }, 409);
      return apply(status, 'acknowledged', role!, {}, note ?? null);
    }
    case 'assign': {
      if (!isStaff) return json({ error: 'staff only' }, 403);
      if (!roleAllows(action!)) return json({ error: 'your role cannot perform this action' }, 403);
      if (!['submitted', 'acknowledged', 'reopened'].includes(status)) return json({ error: 'this report cannot be assigned in its current state' }, 409);
      if (!crewId) return json({ error: 'crew_id is required to assign' }, 400);
      const { data: crew } = await admin.from('crews').select('available').eq('id', crewId).single();
      if (!crew) return json({ error: 'crew not found' }, 404);
      if (!crew.available) return json({ error: 'that crew is not available' }, 409);
      return apply(status, 'assigned', role!, { assigned_crew_id: crewId }, note ?? null);
    }
    case 'reject': {
      if (!isStaff) return json({ error: 'staff only' }, 403);
      if (!roleAllows(action!)) return json({ error: 'your role cannot perform this action' }, 403);
      if (status === 'resolved' || status === 'rejected') return json({ error: 'this report cannot be rejected in its current state' }, 409);
      if (!reason) return json({ error: 'a reason is required to reject' }, 400);
      let duplicateOfReportId: string | null = null;
      if (typeof body.duplicate_of_report_id === 'string') {
        const { data: dupTarget } = await admin.from('reports').select('id').eq('id', body.duplicate_of_report_id).single();
        if (!dupTarget) return json({ error: 'duplicate target report not found' }, 404);
        duplicateOfReportId = body.duplicate_of_report_id;
      }
      return apply(status, 'rejected', role!, {}, reason, duplicateOfReportId);
    }
    case 'start': {
      // office staff (per console_role) OR the crew this report is assigned to (FR-061)
      if (isStaff) { if (!roleAllows(action!)) return json({ error: 'your role cannot perform this action' }, 403); }
      else if (isCrew) { if (!crewOwnsReport) return json({ error: 'this report is not assigned to your crew' }, 403); }
      else return json({ error: 'staff only' }, 403);
      if (status !== 'assigned') return json({ error: 'work can only start on an assigned report' }, 409);
      return apply(status, 'in_progress', role!, {}, note ?? null);
    }
    case 'resolve': {
      if (isStaff) { if (!roleAllows(action!)) return json({ error: 'your role cannot perform this action' }, 403); }
      else if (isCrew) { if (!crewOwnsReport) return json({ error: 'this report is not assigned to your crew' }, 403); }
      else return json({ error: 'staff only' }, 403);
      if (status !== 'in_progress') return json({ error: 'only in-progress reports can be resolved' }, 409);
      return apply(status, 'resolved', role!, {}, note ?? null);
    }

    default:
      return json({ error: 'unknown action' }, 400);
  }
});
