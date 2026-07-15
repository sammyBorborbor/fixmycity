// Shared client for the team's external CV service (the "DID Backend"). This is
// the single anti-corruption boundary between FixMyCity's vocabulary
// (dumping/drain/streetlight, uuid reports) and the CV API's own
// (refuse_dump/.../other, integer reports, perceptual-hash dedup).
//
// The CV API is stateful and owns classification + duplicate detection: you POST
// a report's photo + metadata to `/api/v1/reports` and it stores the image in
// its own container, dedupes it against everything there, validates it's a
// genuine environmental concern, and returns the verdicts. It exposes no
// embedding vector, so this file no longer produces one.
//
// Config: IMAGE_MODEL_URL is the CV API BASE url (e.g. https://<host>); the
// endpoint paths are appended here. IMAGE_MODEL_API_KEY is optional (the current
// dev deployment is open). NOTE: the dev host is an ngrok URL that rotates —
// a stable host is required before any demo/deploy.
//
// Response shape confirmed against the live service: every response is wrapped in
// a { success, message, errors, data } envelope (the OpenAPI spec misleadingly
// documents the bare ReportRead). The not-environmental verdict is HTTP 400 +
// success:false + an environmental-concern message (see isNotEnvironmentalMessage).
//
// TODO(cv-api): two things still to confirm with a SUCCESSFUL create against a
// real environmental photo — (1) the success `data` object matches the ReportRead
// fields we read (id, cv_inferred_category, duplicate_status, duplicate_of_report_id,
// perceptual_hash, detected_objects); (2) /duplicates returns the CV service's own
// integer report ids so external_report_id reverse-mapping works.

// ---- Category mapping (CV API enum <-> our 3 categories) -------------------
// Their enum: refuse_dump, blocked_drain, flooding, pothole, pollution,
// broken_public_facility, sanitation, other. Only two map onto ours; the rest
// (including anything we can't classify) yield a null suggestion so the citizen's
// own choice stands. Their enum has NO streetlight — see the ours->theirs map.
const THEIR_TO_OUR: Record<string, string> = {
  refuse_dump: 'dumping',
  blocked_drain: 'drain',
};
const OUR_TO_THEIR: Record<string, string> = {
  dumping: 'refuse_dump',
  drain: 'blocked_drain',
  streetlight: 'other', // no streetlight class exists CV-side (see submit-report safeguard)
};

export function ourCategoryToTheirs(category: string): string {
  return OUR_TO_THEIR[category] ?? 'other';
}
export function theirCategoryToOurs(category: string | null | undefined): string | null {
  return category ? (THEIR_TO_OUR[category] ?? null) : null;
}

export function cvApiConfigured(): boolean {
  return !!Deno.env.get('IMAGE_MODEL_URL');
}

function cvBaseUrl(): string {
  const url = Deno.env.get('IMAGE_MODEL_URL');
  if (!url) throw new Error('IMAGE_MODEL_URL is not configured');
  return url.replace(/\/+$/, ''); // strip trailing slashes; paths are appended
}
function authHeader(): Record<string, string> {
  const apiKey = Deno.env.get('IMAGE_MODEL_API_KEY');
  return apiKey ? { authorization: `Bearer ${apiKey}` } : {};
}

// The CV API validates the uploaded file's EXTENSION (from the multipart
// filename), not just its content type — a filename without an extension is
// rejected with "Uploaded image extension is not allowed". Our citizen photos
// are WebP; map the mime type to an allowed extension (webp and jpg both work).
function extForMime(mime: string): string {
  const map: Record<string, string> = {
    'image/webp': 'webp',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
  };
  return map[(mime || '').toLowerCase()] ?? 'jpg';
}

// The CV service wraps every response in this envelope (confirmed against the
// live API — the OpenAPI spec misleadingly documents the bare ReportRead).
interface CvEnvelope<T> {
  success: boolean;
  message?: string;
  errors?: unknown[];
  data?: T;
}

// The subset of the CV API's ReportRead (carried under envelope.data) we consume.
interface CvReportRead {
  id: number;
  cv_inferred_category?: string | null;
  cv_confidence_score?: number | null;
  detected_objects?: unknown[] | null;
  perceptual_hash?: string | null;
  duplicate_status?: string | null;
  duplicate_of_report_id?: number | null;
  confidence_score?: number | null;
  status?: string | null;
}

// The "not an environmental/public concern" verdict (a selfie or junk photo)
// comes back as HTTP 400 with success:false and a message about an environmental
// or public concern. We match the message so we can tell it apart from a genuine
// bad-request/server error (which must fail soft, not block the citizen).
// Confirmed live: {"success":false,"message":"Image does not appear to show an
// environmental or public concern. Please upload a clear photo...","errors":[]}.
function isNotEnvironmentalMessage(message: string | undefined): boolean {
  return /environmental|public concern|clear photo of the issue/i.test(message ?? '');
}

export interface CvSubmitResult {
  verdict: 'ok' | 'not_environmental';
  externalId: number | null;
  cvCategory: string | null;          // mapped to our vocabulary (or null)
  cvConfidence: number | null;
  duplicateStatus: string | null;
  duplicateOfExternalId: number | null;
  detectedObjects: unknown[] | null;
  perceptualHash: string | null;
}

export interface CvSubmitInput {
  imageBytes: Uint8Array;
  mimeType: string;
  category: string;                   // OUR category (mapped to theirs here)
  title: string;
  description?: string;
  lat: number;
  lng: number;
}

// POST the photo + metadata to the CV API so it runs its checks. Throws on
// transport/HTTP errors (the caller decides whether that's fail-soft); returns a
// verdict of 'not_environmental' when the CV service rejects the photo.
export async function submitToCvApi(input: CvSubmitInput): Promise<CvSubmitResult> {
  const form = new FormData();
  form.append('title', input.title);
  form.append('category', ourCategoryToTheirs(input.category));
  form.append('latitude', String(input.lat));
  form.append('longitude', String(input.lng));
  if (input.description) form.append('description', input.description);
  form.append('image', new Blob([input.imageBytes], { type: input.mimeType }), `photo.${extForMime(input.mimeType)}`);

  const res = await fetch(`${cvBaseUrl()}/api/v1/reports`, {
    method: 'POST',
    headers: { ...authHeader() }, // do NOT set content-type: fetch sets the multipart boundary
    body: form,
  });
  const envelope = await res.json().catch(() => null) as CvEnvelope<CvReportRead> | null;

  // Not-environmental verdict: HTTP 400 + success:false + an environmental-concern
  // message. Return a clean verdict so the caller can block submission.
  if (envelope && envelope.success === false) {
    if (res.status === 400 && isNotEnvironmentalMessage(envelope.message)) {
      return {
        verdict: 'not_environmental',
        externalId: null,
        cvCategory: null,
        cvConfidence: null,
        duplicateStatus: null,
        duplicateOfExternalId: null,
        detectedObjects: null,
        perceptualHash: null,
      };
    }
    // any other failure (bad request, server error) is not the citizen's fault —
    // let the caller fail soft rather than block a legitimate report.
    throw new Error(`CV API POST /reports failed: ${envelope.message ?? res.status}`);
  }
  if (!res.ok || !envelope) throw new Error(`CV API POST /reports returned ${res.status}`);

  const report = (envelope.data ?? {}) as CvReportRead;
  return {
    verdict: 'ok',
    externalId: typeof report.id === 'number' ? report.id : null,
    cvCategory: theirCategoryToOurs(report.cv_inferred_category),
    cvConfidence: Number.isFinite(report.cv_confidence_score as number)
      ? Math.min(1, Math.max(0, report.cv_confidence_score as number))
      : null,
    duplicateStatus: report.duplicate_status ?? null,
    duplicateOfExternalId: typeof report.duplicate_of_report_id === 'number'
      ? report.duplicate_of_report_id
      : null,
    detectedObjects: Array.isArray(report.detected_objects) ? report.detected_objects : null,
    perceptualHash: report.perceptual_hash ?? null,
  };
}

export interface CvDuplicate {
  externalId: number;
  similarity: number | null; // CV confidence_score, if present
  category: string | null;   // mapped to our vocabulary
}

// Fetch the CV API's own duplicate candidates for a report (by its CV id). The
// caller maps these integer ids back to our rows via reports.external_report_id.
export async function fetchCvDuplicates(externalId: number): Promise<CvDuplicate[]> {
  // TODO(cv-api): confirm the /duplicates response returns the CV API's own
  // integer report ids so external_report_id reverse-mapping works.
  const res = await fetch(`${cvBaseUrl()}/api/v1/reports/${externalId}/duplicates`, {
    method: 'GET',
    headers: { ...authHeader() },
  });
  if (!res.ok) throw new Error(`CV API GET /duplicates returned ${res.status}`);

  // Unwrap the { success, data } envelope; tolerate a bare array too.
  const parsed = await res.json().catch(() => null) as CvEnvelope<CvReportRead[]> | CvReportRead[] | null;
  const rows = Array.isArray(parsed) ? parsed : (parsed?.data ?? []);
  return rows.map((r) => ({
    externalId: r.id,
    similarity: Number.isFinite(r.confidence_score as number) ? (r.confidence_score as number) : null,
    category: theirCategoryToOurs(r.cv_inferred_category),
  }));
}
