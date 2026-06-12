// src/app/(app)/tree/[id]/_lib/export-config.ts
// Feature flag for tree export paths (#219).
//
// EXPORT_PNG_VIA_CANVAS routes PNG export through the unified `toCanvas`
// rasteriser (Approach 2, shared with PDF). Set
// NEXT_PUBLIC_EXPORT_PNG_VIA_CANVAS="false" in Vercel to revert PNG to the
// legacy 2-pass `toBlob` pipeline if the canvas path regresses (e.g. a Safari
// surprise). Default (unset) = true.
//
// Caveat: capture is client-side, so this is a NEXT_PUBLIC var inlined at
// build time — flipping it in Vercel requires a redeploy to take effect
// (no code change). PDF export is NOT gated by this flag.
export const EXPORT_PNG_VIA_CANVAS =
  process.env.NEXT_PUBLIC_EXPORT_PNG_VIA_CANVAS !== 'false'
