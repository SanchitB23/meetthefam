'use client'

// Zoom control cluster for the tree canvas.
//
// A 3-button pill in the top-right corner of the canvas:
//   Zoom in  (+)
//   Zoom out (−)
//   Fit tree to screen (Maximize2)
//
// Chrome matches the old TreeOverviewButton (rounded-md, border, bg-card/85,
// backdrop-blur-sm) but stacks three 40×40 buttons with divide-y separators.
// Shown on both edit and read-only (share) views — zoom is viewer-safe.

import { Maximize2, Minus, Plus } from 'lucide-react'

type Props = {
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
}

const btnClass =
  'h-10 w-10 flex items-center justify-center text-foreground/80 hover:bg-card hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors'

export function ZoomControls({ onZoomIn, onZoomOut, onFit }: Props) {
  return (
    <div className="absolute top-3 right-3 z-10 rounded-md border border-border bg-card/85 backdrop-blur-sm overflow-hidden flex flex-col divide-y divide-border">
      <button
        type="button"
        onClick={onZoomIn}
        aria-label="Zoom in"
        title="Zoom in"
        className={btnClass}
      >
        <Plus size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onZoomOut}
        aria-label="Zoom out"
        title="Zoom out"
        className={btnClass}
      >
        <Minus size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onFit}
        aria-label="Fit tree to screen"
        title="Fit tree to screen"
        className={btnClass}
      >
        <Maximize2 size={16} aria-hidden="true" />
      </button>
    </div>
  )
}
