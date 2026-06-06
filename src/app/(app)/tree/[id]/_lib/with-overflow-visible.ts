// src/app/(app)/tree/[id]/_lib/with-overflow-visible.ts
// The .f3 tree container carries `overflow-hidden` (FamilyTree.tsx) so
// family-chart's own pan/zoom chrome clips cleanly. To capture the FULL
// rendered tree (not just the visible window) the capture step temporarily
// lifts that clip. This util sets inline `overflow: visible`, runs the
// callback, then restores whatever inline value was there before.

export async function withOverflowVisible<T>(
  el: HTMLElement,
  fn: () => T | Promise<T>,
): Promise<T> {
  const prev = el.style.overflow
  el.style.overflow = 'visible'
  try {
    return await fn()
  } finally {
    el.style.overflow = prev
  }
}
