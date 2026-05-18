// src/components/icons/Family.tsx
type Props = {
  size?: number
  className?: string
}

/**
 * Family-cluster glyph — extracted from the `family` glyph in Kintree's
 * `Icon` map (`docs/ux/inspiration/kintree/project/shared.jsx`). Three
 * heads (two adults + one child) with shoulder arcs to either side. 24×24,
 * 1.6px stroke. Used as a feature-card icon on the landing page;
 * decorative, so `aria-hidden=true`.
 */
export function Family({ size = 18, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="8" cy="9" r="2.2" />
      <circle cx="16" cy="9" r="2.2" />
      <circle cx="12" cy="16" r="1.8" />
      <path d="M5 18c.5-2 1.5-3.5 3-4M19 18c-.5-2-1.5-3.5-3-4" />
    </svg>
  )
}
