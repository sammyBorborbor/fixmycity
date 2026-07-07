// transition-report — THE server-side state machine (CLAUDE.md principle 3).
// Clients never write statuses; every legal transition goes through here and
// produces exactly one status_transitions audit row.
//
// Milestone 2 implements the citizen-facing `reopen` action (FR-024: reporter
// only, from Resolved, within 7 days). Staff actions (acknowledge / assign /
// reject / start / resolve) land in milestone 3 with the console wiring.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const REOPEN_WINDOW_DAYS = 7;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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

  let body: { report_id?: string; action?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }
  const { report_id: reportId, action, note } = body;
  if (!reportId || !action) return json({ error: 'report_id and action are required' }, 400);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: report } = await admin.from('reports').select('*').eq('id', reportId).single();
  if (!report) return json({ error: 'report not found' }, 404);

  switch (action) {
    case 'reopen': {
      if (report.reporter_id !== user.id) return json({ error: 'only the reporter can reopen' }, 403);
      if (report.status !== 'resolved') return json({ error: 'only resolved reports can be reopened' }, 409);

      const { data: resolvedAt } = await admin
        .from('status_transitions')
        .select('created_at')
        .eq('report_id', reportId)
        .eq('to_status', 'resolved')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      const ageDays = resolvedAt
        ? (Date.now() - new Date(resolvedAt.created_at).getTime()) / 86_400_000
        : Infinity;
      if (ageDays > REOPEN_WINDOW_DAYS) {
        return json({ error: `reports can only be reopened within ${REOPEN_WINDOW_DAYS} days of resolution` }, 409);
      }

      const { error: updateErr } = await admin
        .from('reports').update({ status: 'reopened' }).eq('id', reportId);
      if (updateErr) return json({ error: updateErr.message }, 500);

      const { error: transitionErr } = await admin.from('status_transitions').insert({
        report_id: reportId,
        from_status: 'resolved',
        to_status: 'reopened',
        actor_id: user.id,
        actor_role: 'citizen',
        note: note ?? null,
      });
      if (transitionErr) {
        // audit row failed: revert so status and audit log never disagree
        await admin.from('reports').update({ status: 'resolved' }).eq('id', reportId);
        return json({ error: transitionErr.message }, 500);
      }

      const { data: updated } = await admin.from('reports').select('*').eq('id', reportId).single();
      return json({ report: updated });
    }

    case 'acknowledge':
    case 'assign':
    case 'reject':
    case 'start':
    case 'resolve':
      return json({ error: `action "${action}" is not available yet (console milestone)` }, 400);

    default:
      return json({ error: 'unknown action' }, 400);
  }
});
