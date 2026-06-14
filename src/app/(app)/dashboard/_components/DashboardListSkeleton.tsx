/**
 * Inner Suspense fallback for just the trees grid. The page shell (header +
 * "New tree") now renders above the boundary, so only the data-dependent grid
 * streams behind this skeleton. Perf #249.
 */
export function DashboardListSkeleton() {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-busy="true"
      aria-label="Loading your trees…"
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-32 rounded-lg mtf-skeleton" />
      ))}
    </div>
  )
}
