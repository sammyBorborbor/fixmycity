// cancel-report — lets a citizen withdraw (hard-delete) their OWN report while
// it is still Submitted, i.e. before an officer has acknowledged it. Deleting
// the report cascades to its status_transitions and notifications; the stored
// photos are removed from the bucket first (best-effort). Server-authoritative:
// the reporter and the Submitted precondition are enforced here, not client-side.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  // identify the caller from their JWT
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'not signed in' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  const reportId = body.report_id as string;
  if (typeof reportId !== 'string' || reportId.length === 0) {
    return json({ error: 'report_id required' }, 400);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: report, error: fetchErr } = await admin
    .from('reports')
    .select('id, reporter_id, status, photo_urls')
    .eq('id', reportId)
    .maybeSingle();
  if (fetchErr) return json({ error: fetchErr.message }, 500);
  if (!report) return json({ error: 'report not found' }, 404);

  // only the reporter may cancel, and only before it is acknowledged
  if (report.reporter_id !== user.id) return json({ error: 'not your report' }, 403);
  if (report.status !== 'submitted') {
    return json({ error: 'only a submitted report can be cancelled' }, 409);
  }

  // remove the stored photos first (best-effort; orphaned objects are harmless)
  if (Array.isArray(report.photo_urls) && report.photo_urls.length > 0) {
    const { error: rmErr } = await admin.storage.from('report-photos').remove(report.photo_urls);
    if (rmErr) console.error('photo cleanup failed (non-fatal):', rmErr);
  }

  // delete the report; FK cascades remove its status_transitions + notifications
  const { error: delErr } = await admin.from('reports').delete().eq('id', reportId);
  if (delErr) return json({ error: delErr.message }, 500);

  return json({ ok: true });
});
