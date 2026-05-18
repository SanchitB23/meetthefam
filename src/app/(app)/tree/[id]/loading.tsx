/**
 * Phase 8c-3 polish — heirloom palette loading skeleton for /tree/[id].
 *
 * Uses the `.mtf-skeleton` shimmer utility from globals.css — warm-
 * tinted base + left→right gradient sweep — for the same readability
 * reason as the dashboard skeleton. Top bar mirrors the real
 * back-arrow + tree-name H1 + Share + Members layout from TreeContent.
 */
export default function TreeLoading() {
  return (
    <main
      className="px-4 py-8 bg-background min-h-[calc(100vh-3.5rem)]"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading tree…</span>
      <div className="mb-6 flex items-center gap-3 max-w-4xl mx-auto">
        {/* Back-arrow placeholder */}
        <div className="h-10 w-10 rounded-md mtf-skeleton" />
        {/* Tree-name placeholder */}
        <div className="h-9 flex-1 rounded-md mtf-skeleton" />
        {/* Share + Members icon-button placeholders */}
        <div className="h-10 w-10 rounded-md mtf-skeleton" />
        <div className="h-10 w-10 rounded-md mtf-skeleton" />
      </div>
      {/* Canvas placeholder — neutral block, NOT shaped like nodes
          (avoid implying a person count we don't yet know). */}
      <div className="max-w-4xl mx-auto rounded-lg border border-dashed border-border bg-card/40 h-[60vh] mtf-skeleton" />
    </main>
  )
}
