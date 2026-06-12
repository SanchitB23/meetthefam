// src/app/(app)/tree/[id]/_lib/isMobileLike.ts
// Degrade-rule device check (#225, spec §7 case 3): full-tree archival export
// is heavy (enlarge-container re-layout + big canvas); on phone-class devices
// we warn first. Coarse pointer alone isn't enough (touch laptops, tablets
// with desktop-class memory) — require a small viewport too.
export function isMobileLike(): boolean {
  if (typeof window === 'undefined') return false
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
  const small = Math.min(window.innerWidth, window.innerHeight) < 768
  return coarse && small
}
