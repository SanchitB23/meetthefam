'use client'

// Phase 8 sub-task 8b-2 — zoom-to-fit overview button.
//
// Positioned absolute top-right of the tree canvas container (which is
// position:relative via the f3 container in FamilyTree.tsx). Matches the
// existing AddRelativeFab chrome — rounded, border, bg-card/85, backdrop
// blur — but at icon-button scale (40×40) to avoid fighting the bottom-right FAB.

import { Maximize2 } from 'lucide-react'

type Props = {
  /** Called on click — caller handles the actual zoom-to-fit logic. */
  onActivate: () => void
}

export function TreeOverviewButton({ onActivate }: Props) {
  return (
    <button
      type="button"
      onClick={onActivate}
      aria-label="View whole tree"
      title="View whole tree"
      className="absolute top-3 right-3 z-10 h-10 w-10 rounded-md border border-border bg-card/85 backdrop-blur-sm flex items-center justify-center text-foreground/80 hover:bg-card hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors"
    >
      <Maximize2 size={16} aria-hidden="true" />
    </button>
  )
}
