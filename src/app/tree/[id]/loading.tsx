/**
 * Phase 6 polish — perceived-loading affordance for tree-page navigation.
 *
 * Next.js automatically uses this file as a Suspense fallback while the
 * tree page's Server Component runs its data-fetch chain (tree row +
 * membership check + people query + members + pending invites). Without
 * this, opening a tree from the dashboard shows the dashboard for the
 * duration of the fetch — the "feels stuck" UX the user flagged.
 *
 * Visual: matches the real tree page's top-bar shape (back-arrow,
 * title, Members icon) and a placeholder canvas block. The skeleton
 * intentionally avoids family-chart-shaped placeholders — they'd be
 * misleading about how many people are in the tree. Phase 8 polish
 * could swap to a brand-quality shimmer animation.
 */
export default function TreeLoading() {
  return (
    <main className="px-4 py-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading tree…</span>
      <div className="mb-6 flex items-center gap-3 max-w-4xl mx-auto">
        {/* Back-arrow placeholder */}
        <div className="h-10 w-10 rounded-md bg-muted/50 animate-pulse" />
        {/* Tree-name placeholder */}
        <div className="h-9 flex-1 rounded-md bg-muted/50 animate-pulse" />
        {/* Members icon button placeholder */}
        <div className="h-10 w-10 rounded-md bg-muted/50 animate-pulse" />
      </div>
      {/* Canvas placeholder — neutral block, NOT shaped like nodes
          (avoid implying a person count we don't yet know). */}
      <div className="max-w-4xl mx-auto rounded-lg border border-dashed border-border bg-card/30 h-[60vh] animate-pulse" />
    </main>
  )
}
