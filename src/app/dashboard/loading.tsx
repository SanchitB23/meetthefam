/**
 * Phase 6 polish — perceived-loading affordance for dashboard navigation.
 *
 * Next.js automatically uses this file as a Suspense fallback while the
 * dashboard's Server Component fetches the user's trees. Without it, a
 * click from /tree/<id>/back-arrow or a fresh hit of /dashboard shows the
 * previous page (or a blank screen) for the duration of the fetch — the
 * "feels stuck" UX the user flagged after Phase 6 sub-task 4 landed.
 *
 * Visual: minimal heirloom-flavored skeleton — a header strip (matching
 * "Your Trees" + "+ New tree" button positions) plus three card-shaped
 * pulses in the same grid the real dashboard uses. Brand-quality
 * skeletons (animated shimmer, serif typography hints, OKLCH-tuned
 * tones) are deferred to the Phase 8 polish backlog.
 */
export default function DashboardLoading() {
  return (
    <main className="px-4 py-8 max-w-4xl mx-auto" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your trees…</span>
      <div className="mb-6 flex items-center justify-between">
        <div className="h-9 w-40 rounded-md bg-muted/50 animate-pulse" />
        <div className="h-9 w-28 rounded-md bg-muted/50 animate-pulse" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-card p-4 animate-pulse"
          >
            <div className="mb-3 h-5 w-2/3 rounded bg-muted/50" />
            <div className="mb-2 h-3 w-1/2 rounded bg-muted/40" />
            <div className="h-3 w-1/3 rounded bg-muted/30" />
          </div>
        ))}
      </div>
    </main>
  )
}
