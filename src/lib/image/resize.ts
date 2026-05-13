// Client-side image resize for the Phase 5 photo-upload flow.
//
// Phone cameras produce 5-15 MB images. We re-encode to JPEG at quality
// 0.85 with a 1024 px longest-side cap before uploading, which drops a
// typical 12 MP shot to ~150 KB. Spec: docs/architecture/photo-upload.md.
//
// JPEG-only by design (locked decision 7 in the Phase 5 plan):
//   - The `photos` bucket's allowed_mime_types is ['image/jpeg'] so a
//     non-JPEG would fail the upload at the bucket lid anyway.
//   - canvas.toBlob('image/webp', q) falls back silently to PNG on older
//     Safari, which would blow our ~150 KB target by >10x and trip the
//     512 KB bucket lid.
//
// EXIF orientation is normalised via `imageOrientation: 'from-image'`
// on createImageBitmap — without this, a portrait iPhone shot taken in
// "landscape" sensor orientation re-encodes sideways.
//
// HEIC handling is deliberately out of v0.1 scope. Safari decodes HEIC
// natively via createImageBitmap; Chrome desktop throws. The thrown
// DOMException becomes an ImageDecodeError here and the form surfaces
// "choose a JPEG or PNG photo" to the user. Real users on Chrome
// shooting HEIC are rare in a personal-MVP audience; revisit if QA
// reports it (see Phase 5 plan locked decision 6).

export class ImageDecodeError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ImageDecodeError'
  }
}

const MAX_DIMENSION = 1024
const JPEG_QUALITY = 0.85

export type ResizeResult = {
  blob: Blob
  width: number
  height: number
}

/**
 * Resize an image File to a JPEG Blob no larger than 1024 px on the
 * longest side, preserving aspect ratio. Always returns image/jpeg.
 *
 * Throws `ImageDecodeError` when the browser can't decode the input
 * (unsupported format, corrupt file). Callers should catch and surface
 * a user-facing message — see PersonForm photo picker handler.
 */
export async function resizeToJpeg(file: File): Promise<ResizeResult> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch (err) {
    throw new ImageDecodeError(
      'Could not decode the image. Please choose a JPEG or PNG photo.',
      { cause: err },
    )
  }

  const { width: srcW, height: srcH } = bitmap
  const scale = Math.min(1, MAX_DIMENSION / Math.max(srcW, srcH))
  const dstW = Math.round(srcW * scale)
  const dstH = Math.round(srcH * scale)

  const blob = await drawAndEncode(bitmap, dstW, dstH)
  bitmap.close()

  return { blob, width: dstW, height: dstH }
}

// OffscreenCanvas is supported in all modern browsers including Safari 16.4+.
// We still fall back to a detached <canvas> element so older mobile Safari
// (pre-16.4) doesn't hard-fail the whole upload flow — the result is
// identical, just runs on the main thread.
async function drawAndEncode(
  bitmap: ImageBitmap,
  width: number,
  height: number,
): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new ImageDecodeError('Could not get a 2D canvas context.')
    }
    ctx.drawImage(bitmap, 0, 0, width, height)
    return canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY })
  }

  // Fallback: detached <canvas> element + toBlob.
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new ImageDecodeError('Could not get a 2D canvas context.')
  }
  ctx.drawImage(bitmap, 0, 0, width, height)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new ImageDecodeError('canvas.toBlob returned null.'))
      },
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}
