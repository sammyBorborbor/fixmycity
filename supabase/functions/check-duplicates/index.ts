// check-duplicates — AI feature 2 (CLAUDE.md): duplicate detection runs in the
// external CV service (perceptual-hash matching against its own image corpus).
// This proxies the CV API's /duplicates for a report and maps the CV service's
// own integer report ids back to our rows, so the console can show officers
// "possible duplicate of FMC-..." chips. Officer/admin only — citizens have no
// reason to see other reporters' candidate duplicates.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { fetchCvDuplicates } from '../_shared/image-model.ts';

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

  const { data: report } = await admin
    .from('reports')
    .select('id, external_report_id')
    .eq('id', reportId)
    .single();
  if (!report) return json({ error: 'report not found' }, 404);
  // No CV id means the CV service never processed this report (older row, or the
  // service was down at submission) — nothing to check against.
  if (report.external_report_id == null) return json({ candidates: [] });

  // Ask the CV service for its own duplicate candidates (by its integer id).
  let cvDuplicates;
  try {
    cvDuplicates = await fetchCvDuplicates(report.external_report_id as number);
  } catch (e) {
    console.error('CV API /duplicates failed:', e);
    return json({ error: 'Could not check for duplicates.' }, 502);
  }
  if (cvDuplicates.length === 0) return json({ candidates: [] });

  // Map the CV service's integer ids back to OUR rows. We surface only reports
  // that exist on our side, using our own reference/category/status/photo.
  const simByExternalId = new Map<number, number | null>(cvDuplicates.map((d) => [d.externalId, d.similarity]));
  const { data: rows } = await admin
    .from('reports')
    .select('id, reference, category, location_name, status, photo_urls, external_report_id')
    .in('external_report_id', cvDuplicates.map((d) => d.externalId))
    .neq('id', reportId); // never flag a report as a duplicate of itself

  const candidates = (rows ?? [])
    .map((r) => ({
      id: r.id,
      reference: r.reference,
      category: r.category,
      location_name: r.location_name,
      status: r.status,
      photo_path: (r.photo_urls as string[] | null)?.[0] ?? null,
      // CV dedup isn't proximity-based; distance_m is unused by the console chip.
      // similarity is the CV confidence when present; treat a missing score as
      // high-confidence since the service returned it as a duplicate at all.
      similarity: simByExternalId.get(r.external_report_id as number) ?? 1,
      distance_m: 0,
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);

  return json({ candidates });
});
