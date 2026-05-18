/**
 * Phase 8c-3 — heirloom palette loading skeleton for /dashboard.
 *
 * Previously used Tailwind's bg-muted/50 + animate-pulse (gray flash).
 * Now uses bg-background + tone-tinted shimmer to match the dashboard's
 * actual chrome. Fixes the brief black/empty frame from #50 by setting
 * an explicit background on the outer <main>.
 */
export default function DashboardLoading() {
  return (
    <main
      className="px-4 py-8 max-w-4xl mx-auto bg-background"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading your trees…</span>
      <div className="mb-6 flex items-center justify-between">
        <div className="h-9 w-40 rounded-md bg-secondary/60 animate-pulse" />
        <div className="h-9 w-28 rounded-md bg-secondary/60 animate-pulse" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-card p-4"
          >
            <div className="mb-3 h-5 w-2/3 rounded bg-secondary/60 animate-pulse" />
            <div className="mb-2 h-3 w-1/2 rounded bg-secondary/40 animate-pulse" />
            <div className="h-3 w-1/3 rounded bg-secondary/30 animate-pulse" />
          </div>
        ))}
      </div>
    </main>
  )
}
