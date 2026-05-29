/**
 * Returns true if `date` lies within the last `withinDays` days from
 * `now`. Used by the dashboard's Sparkle "new" indicator to highlight
 * recently-created trees.
 *
 * `now` is injectable so the helper is deterministic in tests. Returns
 * false for invalid / unparseable dates rather than throwing — the
 * caller is decorative UI and should fail closed.
 */
export function isRecent(
  date: string | Date | null | undefined,
  withinDays = 7,
  now: Date = new Date(),
): boolean {
  if (date === null || date === undefined) return false
  const ts = typeof date === 'string' ? Date.parse(date) : date.getTime()
  if (Number.isNaN(ts)) return false
  const ageMs = now.getTime() - ts
  if (ageMs < 0) return false
  return ageMs < withinDays * 24 * 60 * 60 * 1000
}
