// classify-image — AI feature 1 (CLAUDE.md): suggests a report category from a
// photo so the citizen app can pre-fill the category the citizen picked, with
// the citizen free to override. Pure image-model proxy: no DB reads/writes,
// since this runs before the photo is ever uploaded to storage. The embedding
// this also produces is discarded here — the authoritative embedding used for
// duplicate detection is recomputed in submit-report from the stored photo.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { classifyAndEmbed } from '../_shared/image-model.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // decoded size cap, bounds request size/cost/latency

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  // any signed-in citizen may call this — it runs pre-submission, no DB access
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

  const imageBase64 = body.image_base64 as string;
  const mimeType = (body.mime_type as string) || 'image/webp';

  if (typeof imageBase64 !== 'string' || !imageBase64) {
    return json({ error: 'image_base64 is required' }, 400);
  }
  // rough decoded-size check without fully decoding: base64 is ~4/3 the size of the source bytes
  if (imageBase64.length > (MAX_IMAGE_BYTES * 4) / 3) {
    return json({ error: 'image too large' }, 400);
  }

  try {
    const result = await classifyAndEmbed(imageBase64, mimeType);
    return json({ classification: { category: result.category, confidence: result.confidence } });
  } catch (e) {
    console.error('classify-image failed:', e);
    return json({ error: 'AI classification unavailable' }, 502);
  }
});
