/**
 * Phase 8c-3 — heirloom palette loading skeleton for /tree/[id].
 *
 * Explicit bg-background prevents the brief black flash during route
 * transitions (#50, 1/3). Skeleton tones map to brand secondary/40, so
 * 8a-2's warm-shifted dark-mode tokens carry through.
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
        <div className="h-10 w-10 rounded-md bg-secondary/60 animate-pulse" />
        {/* Tree-name placeholder */}
        <div className="h-9 flex-1 rounded-md bg-secondary/60 animate-pulse" />
        {/* Members icon button placeholder */}
        <div className="h-10 w-10 rounded-md bg-secondary/60 animate-pulse" />
      </div>
      {/* Canvas placeholder — neutral block, NOT shaped like nodes
          (avoid implying a person count we don't yet know). */}
      <div className="max-w-4xl mx-auto rounded-lg border border-dashed border-border bg-card/40 h-[60vh] animate-pulse" />
    </main>
  )
}
