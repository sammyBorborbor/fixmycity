/* Base64-encode a blob for inline transport (e.g. to classify-image, before
   the photo has been uploaded to storage). Chunked to avoid blowing the call
   stack on `String.fromCharCode(...bytes)` for larger images. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < buf.length; i += 0x8000) {
    binary += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/* Client-side photo compression: mid-range Android on 3G is the target
   (CLAUDE.md NFR), so we downscale + re-encode to WebP before upload. */
export async function compressImage(file: File, maxDim = 1600, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality));
    if (!blob) throw new Error('could not process the image');
    return blob;
  } finally {
    bitmap.close();
  }
}
