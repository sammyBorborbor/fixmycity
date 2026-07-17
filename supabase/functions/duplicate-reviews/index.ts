// duplicate-reviews — proxies the external CV service's own duplicate-review
// queue (auto-created when the model detects a possible duplicate at submission)
// so the console can triage it: list / resolve / merge. The CV service keys its
// reviews by its OWN integer report ids; we map those back to our rows via
// reports.external_report_id so officers see FMC references. Officer/admin only.
//
// PURE PROXY: this never changes reports.status — that stays exclusively in
// transition-report (CLAUDE.md principle 3). Officers still reject-as-duplicate
// from the report detail panel to close our loop; this is the model's advisory queue.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  listDuplicateReviews,
  resolveDuplicateReview,
  mergeDuplicateReview,
  CV_RESOLUTIONS,
} from '../_shared/image-model.ts';

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

// One side of a review (report or candidate), resolved to our row when possible.
interface ReviewSide {
  externalId: number;
  ourId: string | null;
  reference: string | null;
  category: string | null;    // DB enum value
  status: string | null;      // DB enum value
  locationName: string | null;
  label: string;              // display fallback (reference, or "External #<id>")
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

  let body: { action?: string; review_id?: number; resolution?: string; duplicate_of_report_id?: number; target_report_id?: number; notes?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  const role = profile?.role as 'citizen' | 'officer' | 'crew' | 'admin' | undefined;
  if (role !== 'officer' && role !== 'admin') return json({ error: 'staff only' }, 403);

  const action = body.action;

  // ---- list --------------------------------------------------------------
  if (action === 'list') {
    let reviews;
    try {
      reviews = await listDuplicateReviews();
    } catch (e) {
      console.error('CV API list duplicate-reviews failed:', e);
      return json({ error: 'Could not reach the review service.' }, 502);
    }

    // Reverse-map every CV integer id in the queue back to our rows.
    const ids = [...new Set(reviews.flatMap((r) => [r.reportId, r.candidateReportId]))];
    const byExternalId = new Map<number, { id: string; reference: string; category: string; status: string; location_name: string }>();
    if (ids.length) {
      const { data: rows } = await admin
        .from('reports')
        .select('id, reference, category, status, location_name, external_report_id')
        .in('external_report_id', ids);
      for (const r of rows ?? []) byExternalId.set(r.external_report_id as number, r as never);
    }
    const side = (externalId: number): ReviewSide => {
      const r = byExternalId.get(externalId);
      return {
        externalId,
        ourId: r?.id ?? null,
        reference: r?.reference ?? null,
        category: r?.category ?? null,
        status: r?.status ?? null,
        locationName: r?.location_name ?? null,
        label: r?.reference ?? `External #${externalId}`,
      };
    };

    const enriched = reviews.map((rv) => ({
      id: rv.id,
      confidence: rv.confidence,
      status: rv.status,
      resolution: rv.resolution,
      notes: rv.notes,
      createdAt: rv.createdAt,
      resolvedAt: rv.resolvedAt,
      report: side(rv.reportId),
      candidate: side(rv.candidateReportId),
    }));
    return json({ reviews: enriched });
  }

  // ---- resolve -----------------------------------------------------------
  if (action === 'resolve') {
    const reviewId = Number(body.review_id);
    if (!Number.isInteger(reviewId)) return json({ error: 'review_id is required' }, 400);
    if (!CV_RESOLUTIONS.includes(body.resolution as string)) return json({ error: 'invalid resolution' }, 400);
    if (typeof body.notes === 'string' && body.notes.length > 2000) return json({ error: 'notes too long' }, 400);
    try {
      const review = await resolveDuplicateReview(reviewId, {
        resolution: body.resolution as string,
        duplicateOfReportId: body.duplicate_of_report_id ?? null,
        notes: body.notes ?? null,
      });
      return json({ review });
    } catch (e) {
      console.error('CV API resolve failed:', e);
      return json({ error: 'Could not resolve the review.' }, 502);
    }
  }

  // ---- merge -------------------------------------------------------------
  if (action === 'merge') {
    const reviewId = Number(body.review_id);
    const targetReportId = Number(body.target_report_id);
    if (!Number.isInteger(reviewId)) return json({ error: 'review_id is required' }, 400);
    if (!Number.isInteger(targetReportId)) return json({ error: 'target_report_id is required' }, 400);
    if (typeof body.notes === 'string' && body.notes.length > 2000) return json({ error: 'notes too long' }, 400);
    try {
      const review = await mergeDuplicateReview(reviewId, targetReportId, body.notes ?? null);
      return json({ review });
    } catch (e) {
      console.error('CV API merge failed:', e);
      return json({ error: 'Could not merge the review.' }, 502);
    }
  }

  return json({ error: 'unknown action' }, 400);
});
