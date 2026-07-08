// check-duplicates — AI feature 2 (CLAUDE.md): PostGIS proximity+time filter,
// then pgvector cosine similarity on `reports.embedding`, so the console can
// show officers "possible duplicate of FMC-..." chips. Officer/admin only —
// citizens have no reason to see other reporters' candidate duplicates.
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

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'not signed in' }, 401);

  let body: { report_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }
  const reportId = body.report_id;
  if (!reportId) return json({ error: 'report_id is required' }, 400);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  const role = profile?.role as 'citizen' | 'officer' | 'crew' | 'admin' | undefined;
  if (role !== 'officer' && role !== 'admin') return json({ error: 'staff only' }, 403);

  const { data: report } = await admin.from('reports').select('id').eq('id', reportId).single();
  if (!report) return json({ error: 'report not found' }, 404);

  const { data: candidates, error: rpcErr } = await admin.rpc('find_duplicate_candidates', {
    p_report_id: reportId,
  });
  if (rpcErr) return json({ error: rpcErr.message }, 500);

  return json({ candidates: candidates ?? [] });
});
