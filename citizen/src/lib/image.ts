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
  // `imageOrientation: 'from-image'` applies the photo's EXIF orientation before
  // we draw it. Phone CAMERA photos store their pixels un-rotated plus an
  // orientation flag; without this the canvas (and the WebP we upload) comes out
  // sideways — which both the CV validator and officers then see. Gallery images
  // rarely carry the flag, so they were already correct. (canvas.toBlob strips
  // EXIF, so the baked-in pixel orientation is all that survives.)
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
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
