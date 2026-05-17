'use client'

// Phase 8 sub-task 8b-2 — floating "+" affordance for adding a relative.
//
// Presentational only — receives position (computed in FamilyTree.tsx from
// the hovered node's bounding rect) and an onActivate callback. Returns null
// when position is null (nothing hovered).
//
// The position math (DOM rect → { top, left } relative to the chart
// container) lives in FamilyTree.tsx — this component is a dumb overlay
// that renders at whatever offset the parent supplies.

import { Plus } from 'lucide-react'

type Props = {
  /**
   * Bottom-right corner of the hovered node, relative to the chart container.
   * Null when no node is being hovered.
   */
  position: { top: number; left: number } | null
  /** Called when the "+" is clicked — caller opens the add-relative form. */
  onActivate: () => void
}

export function PersonHoverPlus({ position, onActivate }: Props) {
  if (!position) return null

  return (
    <button
      type="button"
      onClick={onActivate}
      aria-label="Add relative"
      title="Add relative"
      className="absolute z-10 h-9 w-9 rounded-full bg-accent text-accent-foreground shadow-[0_8px_22px_rgba(199,123,92,.45)] flex items-center justify-center hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-transform"
      style={{ top: position.top, left: position.left }}
    >
      <Plus size={14} aria-hidden="true" />
    </button>
  )
}
