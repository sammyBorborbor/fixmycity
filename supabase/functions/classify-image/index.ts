// classify-image — DORMANT.
//
// AI feature 1 (auto-categorisation) originally ran here as a stateless
// pre-submission call so the citizen app could pre-fill the category. The
// external CV service that now powers classification is stateful and runs at
// submission time (see submit-report -> _shared/image-model.ts), so there is no
// stateless "image -> category" endpoint to proxy. The category suggestion is
// still produced and stored server-side at submit and shown to officers via
// reports.ai_suggested_category.
//
// This function is intentionally kept (not deleted) so the pre-fill UX can be
// restored cheaply IF the teammate exposes a stateless classify endpoint
// (e.g. POST /classify -> { category, confidence }). Until then it returns 501.

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

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  return json({
    error: 'Pre-submission classification is disabled; the category is inferred at submission time.',
    code: 'classify_not_available',
  }, 501);
});
