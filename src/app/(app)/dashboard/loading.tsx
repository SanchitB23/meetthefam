/**
 * Phase 8c-3 polish — heirloom palette loading skeleton for /dashboard.
 *
 * Mirrors the real TreeCard layout (title + role chip row, line-clamp-2
 * description, mt-auto "Updated …" footer) so the transition into the
 * loaded grid is shape-stable. Uses the `.mtf-skeleton` shimmer utility
 * from globals.css — warm-tinted base with a left → right gradient
 * sweep — which reads much better against the cream background than the
 * old `bg-secondary/60 animate-pulse` pair (Δ L between cream and
 * secondary is only 0.025, so the prior alpha-0.6 fills disappeared
 * into the page).
 */
export default function DashboardLoading() {
  return (
    <main
      className="px-4 py-8 max-w-4xl mx-auto bg-background"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading your trees…</span>

      {/* Header — "Your Trees" heading + "+ New tree" button */}
      <div className="mb-6 flex items-center justify-between">
        <div className="h-8 w-44 rounded-md mtf-skeleton" />
        <div className="h-9 w-32 rounded-md mtf-skeleton" />
      </div>

      {/* Card grid — matches the real `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3"
          >
            {/* Top row — tree name + role chip */}
            <div className="flex items-start justify-between gap-2">
              <div className="h-5 w-3/5 rounded-md mtf-skeleton" />
              <div className="h-5 w-12 rounded-full mtf-skeleton shrink-0" />
            </div>
            {/* Description — line-clamp-2 shape */}
            <div className="space-y-1.5">
              <div className="h-3 w-full rounded mtf-skeleton" />
              <div className="h-3 w-4/5 rounded mtf-skeleton" />
            </div>
            {/* mt-auto footer — "Updated X ago" */}
            <div className="h-3 w-1/3 rounded mtf-skeleton mt-1 opacity-70" />
          </div>
        ))}
      </div>
    </main>
  )
}
