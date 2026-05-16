/**
 * Logo — the meetthefam logomark.
 *
 * Three overlapping rings (family circles) with a terracotta accent dot at
 * their shared centre. Vendored from the Knot brand bundle (see
 * `docs/ux/inspiration/knot/project/logo.svg`) — same `viewBox` and shape
 * coordinates as the source SVG, but with two intentional swaps so the mark
 * is theme-aware:
 *
 * - Ring `stroke` is `currentColor` (inherits the wrapper's text colour:
 *   forest-green in light mode, warm parchment in dark mode).
 * - Accent dot fill is `var(--accent)` (terracotta token).
 *
 * The source SVG's `aria-label` reads "MeetMyFamily"; we override it to
 * `meetthefam` (the public brand name).
 */
type Props = {
  size?: number
  className?: string
}

export function Logo({ size = 32, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      role="img"
      aria-label="meetthefam"
      className={className}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
      >
        <circle cx="48" cy="36" r="18" />
        <circle cx="36" cy="56" r="18" />
        <circle cx="60" cy="56" r="18" />
      </g>
      <circle cx="48" cy="50" r="3.2" fill="var(--accent)" />
    </svg>
  )
}
