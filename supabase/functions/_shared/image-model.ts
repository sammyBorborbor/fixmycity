// Shared client for the team's custom image model API: one model that both
// classifies a photo's category and produces the embedding used for
// duplicate detection. Used by classify-image (category suggestion) and
// submit-report (authoritative embedding, recomputed from the stored photo).
//
// This is a deliberate exception to this repo's "no shared dir, each function
// self-contained" convention: both call sites need the identical external
// client, and a still-changing contract is worse to maintain duplicated in
// two places than shared once.
//
// TODO(image-model): the request/response shape below is a PLACEHOLDER — the
// teammate's API isn't built yet. Replace the marked lines once its real
// contract (endpoint, auth header, field names, embedding dimension) is known.

const CATEGORIES = ['dumping', 'drain', 'streetlight'];

export interface ImageModelResult {
  category: string;
  confidence: number;
  // dimension TBD — placeholder assumes 512 to match the existing
  // `embedding vector(512)` column; if the real model's output size differs,
  // the column and its HNSW index need a follow-up migration.
  embedding: number[];
}

export async function classifyAndEmbed(imageBase64: string, mimeType: string): Promise<ImageModelResult> {
  const url = Deno.env.get('IMAGE_MODEL_URL');
  const apiKey = Deno.env.get('IMAGE_MODEL_API_KEY');
  if (!url) throw new Error('IMAGE_MODEL_URL is not configured');

  // TODO(image-model): confirm the real request shape (body field names,
  // auth header) and adjust this fetch call to match.
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({ image_base64: imageBase64, mime_type: mimeType }),
  });
  if (!res.ok) throw new Error(`image model returned ${res.status}`);

  // TODO(image-model): confirm the real response field names and adjust this
  // parsing/validation to match.
  const data = await res.json();
  if (
    !CATEGORIES.includes(data?.category) ||
    !Number.isFinite(data?.confidence) ||
    !Array.isArray(data?.embedding)
  ) {
    throw new Error('unexpected image model response shape');
  }

  return {
    category: data.category,
    confidence: Math.min(1, Math.max(0, data.confidence)),
    embedding: data.embedding,
  };
}
