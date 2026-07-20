// follow-report — lets a citizen subscribe to an EXISTING report that the CV
// service flagged as a duplicate of the one they were about to file. The citizen
// then receives the same status notifications the reporter does (fan-out lives in
// transition-report). A report can have many followers (report_followers).
//
// Server-authoritative: the caller must be signed in, may not follow their own
// report, and the follow is idempotent. It also cleans up the photos the client
// uploaded for the report it decided NOT to file — the browser cannot delete its
// own storage objects (there is no storage DELETE RLS policy), so cleanup must run
// here under the service role.
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
    .select('id, reporter_id')
    .eq('id', reportId)
    .maybeSingle();
  if (fetchErr) return json({ error: fetchErr.message }, 500);
  if (!report) return json({ error: 'report not found' }, 404);

  // you can't follow your own report (you already get its notifications)
  if (report.reporter_id === user.id) return json({ error: "you can't follow your own report" }, 403);

  // insert the follow row (idempotent: a repeat follow is a no-op success). The
  // report_followers_count trigger bumps reports.follower_count.
  const { error: insertErr } = await admin
    .from('report_followers')
    .upsert({ report_id: reportId, user_id: user.id }, { onConflict: 'report_id,user_id', ignoreDuplicates: true });
  if (insertErr) return json({ error: insertErr.message }, 500);

  // clean up the photos uploaded for the report the citizen decided NOT to file.
  // Best-effort (orphaned objects are harmless); only paths in the caller's own
  // folder are touched.
  const photoPaths = body.photo_paths;
  if (Array.isArray(photoPaths) && photoPaths.length > 0) {
    const ownFolder = new RegExp(`^${user.id}/[\\w.-]+$`);
    const paths = photoPaths.filter((p) => typeof p === 'string' && ownFolder.test(p)) as string[];
    if (paths.length > 0) {
      const { error: rmErr } = await admin.storage.from('report-photos').remove(paths);
      if (rmErr) console.error('orphaned photo cleanup failed (non-fatal):', rmErr);
    }
  }

  return json({ ok: true });
});
