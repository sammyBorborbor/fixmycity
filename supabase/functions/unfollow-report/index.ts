// unfollow-report — the inverse of follow-report: a citizen stops following a
// report they had subscribed to. Idempotent; server-authoritative (a user may
// only remove their OWN follow row). Deleting the row drops the report out of the
// follower's RLS scope and decrements reports.follower_count (via trigger).
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

  // scoped to the caller's own follow row; a missing row is a no-op success.
  const { error: delErr } = await admin
    .from('report_followers')
    .delete()
    .eq('report_id', reportId)
    .eq('user_id', user.id);
  if (delErr) return json({ error: delErr.message }, 500);

  return json({ ok: true });
});
