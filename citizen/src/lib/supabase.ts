import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types.ts';

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

/* Report photos live in a private bucket; viewing goes through signed URLs. */
export async function signedPhotoUrl(path: string, expiresIn = 3600): Promise<string | null> {
  const { data } = await supabase.storage.from('report-photos').createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}
