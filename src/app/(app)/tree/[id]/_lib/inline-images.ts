// src/app/(app)/tree/[id]/_lib/inline-images.ts
// Safari fix for #218: WebKit taints cross-origin <img> elements drawn into a
// canvas (via foreignObject in html-to-image's clone), even when the server
// sends CORS headers and the element has crossorigin="anonymous". The symptom
// is every person avatar being dropped from the exported PNG on Safari while
// looking fine on screen.
//
// Fix: before toBlob(), fetch every http(s) img src as a same-origin blob and
// replace its src with a base64 data URL. At raster time the clone is
// effectively all-same-origin, so WebKit never taints the canvas.
//
// Restore: the returned async function resets every img back to its original
// src, so the live DOM is unchanged after export. The caller MUST call it in
// a `finally` block.
//
// Error strategy: a fetch/convert failure for a single image is not fatal —
// we leave that img's src unchanged and continue. Only a complete abort of
// the whole fetch is propagated (via the AbortSignal in the options).

/** Convert a Blob to a base64 data URL. */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** Fetches an image src and returns a base64 data URL, or null on failure. */
async function toDataUrl(src: string): Promise<string | null> {
  try {
    const res = await fetch(src, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    return blobToDataUrl(blob)
  } catch {
    // Network error, CORS preflight failure, etc. — treat as non-fatal.
    return null
  }
}

/**
 * For each `<img>` under `target` whose `src` is an http(s) URL, fetch the
 * image as a same-origin base64 data URL and swap the element's `src`.
 *
 * Returns a `restore` function that puts every swapped `src` back.
 * The caller MUST invoke `restore()` in a `finally` block.
 *
 * Failures on individual images are silent (original src is left unchanged).
 */
export async function inlineImages(target: HTMLElement): Promise<() => void> {
  const imgs = Array.from(target.querySelectorAll<HTMLImageElement>('img'))

  // Only process images with a real http(s) src — skip data URLs, relative
  // paths, and already-inlined blobs.
  const httpImgs = imgs.filter((img) => /^https?:\/\//i.test(img.src))

  // Fetch all in parallel; resolve to [img, dataUrl | null] pairs.
  const results = await Promise.all(
    httpImgs.map(async (img) => {
      const dataUrl = await toDataUrl(img.src)
      return { img, original: img.src, dataUrl }
    }),
  )

  // Swap in data URLs where we successfully fetched.
  const swapped: Array<{ img: HTMLImageElement; original: string }> = []
  for (const { img, original, dataUrl } of results) {
    if (dataUrl) {
      img.src = dataUrl
      swapped.push({ img, original })
    }
    // On null dataUrl: leave src as-is; that image may still render if
    // html-to-image's clone manages CORS anyway (Chrome path).
  }

  return function restore() {
    for (const { img, original } of swapped) {
      img.src = original
    }
  }
}
