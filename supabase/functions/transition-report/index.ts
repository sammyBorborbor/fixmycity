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

  let body: { report_id?: string; action?: string; note?: string; crew_id?: string; reason?: string };
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
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  const role = profile?.role as 'citizen' | 'officer' | 'crew' | 'admin' | undefined;
  const isStaff = role === 'officer' || role === 'admin';

  // resolve a transition: validate legality, then apply status + audit + notify atomically
  async function apply(
    from: Status, to: Status, actorRole: string, extra: Record<string, unknown> = {}, noteText: string | null = null,
  ) {
    const { error: updateErr } = await admin.from('reports').update({ status: to, ...extra }).eq('id', reportId);
    if (updateErr) return json({ error: updateErr.message }, 500);

    const { error: auditErr } = await admin.from('status_transitions').insert({
      report_id: reportId, from_status: from, to_status: to,
      actor_id: user!.id, actor_role: actorRole, note: noteText,
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
      if (status !== 'submitted' && status !== 'reopened') return json({ error: 'can only acknowledge a submitted or reopened report' }, 409);
      return apply(status, 'acknowledged', role!, {}, note ?? null);
    }
    case 'assign': {
      if (!isStaff) return json({ error: 'staff only' }, 403);
      if (!['submitted', 'acknowledged', 'reopened'].includes(status)) return json({ error: 'this report cannot be assigned in its current state' }, 409);
      if (!crewId) return json({ error: 'crew_id is required to assign' }, 400);
      const { data: crew } = await admin.from('crews').select('available').eq('id', crewId).single();
      if (!crew) return json({ error: 'crew not found' }, 404);
      if (!crew.available) return json({ error: 'that crew is not available' }, 409);
      return apply(status, 'assigned', role!, { assigned_crew_id: crewId }, note ?? null);
    }
    case 'reject': {
      if (!isStaff) return json({ error: 'staff only' }, 403);
      if (status === 'resolved' || status === 'rejected') return json({ error: 'this report cannot be rejected in its current state' }, 409);
      if (!reason) return json({ error: 'a reason is required to reject' }, 400);
      return apply(status, 'rejected', role!, {}, reason);
    }
    case 'start': {
      if (!isStaff) return json({ error: 'staff only' }, 403);
      if (status !== 'assigned') return json({ error: 'work can only start on an assigned report' }, 409);
      return apply(status, 'in_progress', role!, {}, note ?? null);
    }
    case 'resolve': {
      if (!isStaff) return json({ error: 'staff only' }, 403);
      if (status !== 'in_progress') return json({ error: 'only in-progress reports can be resolved' }, 409);
      return apply(status, 'resolved', role!, {}, note ?? null);
    }

    default:
      return json({ error: 'unknown action' }, 400);
  }
});
