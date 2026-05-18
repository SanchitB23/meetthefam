// src/components/icons/Branch.tsx

// Aspect ratio derived from the viewBox: 80 / 200 = 0.4
const BRANCH_ASPECT_RATIO = 80 / 200

type Props = {
  size?: number
  className?: string
  /** When true, render the mirror-flipped variant (Phase 8c "below features" use). */
  flip?: boolean
}

/**
 * Decorative section-divider SVG — Kintree's standalone `Branch` motif.
 *
 * Vendored from `docs/ux/inspiration/kintree/project/shared.jsx` (the
 * standalone `Branch` component, not the `branch` glyph in the `Icon` map):
 * gentle horizontal sine path with a centre node and two small leaf
 * silhouettes on either side. Stroke + fills use `currentColor` so the
 * motif inherits the wrapper's text colour (e.g. forest-green in light
 * mode, parchment in dark mode); use opacity on the wrapper to tone the
 * divider down rather than hard-coding a translucent fill.
 *
 * The original was non-square (200×80) and used `preserveAspectRatio="none"`
 * to stretch across a section; we preserve that exactly so the divider
 * scales horizontally with its container.
 */
export function Branch({ size = 200, className, flip = false }: Props) {
  return (
    <svg
      width={size}
      height={Math.round(size * BRANCH_ASPECT_RATIO)}
      viewBox="0 0 200 80"
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="none"
      style={{ transform: flip ? 'scaleX(-1)' : undefined }}
      className={className}
    >
      <path
        d="M5 40 Q 60 10, 105 40 T 195 40"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="105" cy="40" r="2.6" fill="currentColor" />
      <path
        d="M50 25 q 5 -8, 12 -6 q -3 6, -12 6 z"
        fill="currentColor"
        opacity={0.7}
      />
      <path
        d="M150 55 q 5 8, 12 6 q -3 -6, -12 -6 z"
        fill="currentColor"
        opacity={0.7}
      />
    </svg>
  )
}
