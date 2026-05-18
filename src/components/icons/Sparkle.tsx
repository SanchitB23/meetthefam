// src/components/icons/Sparkle.tsx
type Props = {
  size?: number
  className?: string
}

/**
 * Sparkle glyph — extracted from the `sparkle` glyph in Kintree's `Icon`
 * map (`docs/ux/inspiration/kintree/project/shared.jsx`). Four cardinal
 * rays + four diagonal half-rays radiating from a centre point — used as
 * the "New" indicator in Phase 8c. 24×24, 1.6px stroke. Decorative, so
 * `aria-hidden=true`.
 */
export function Sparkle({ size = 18, className }: Props) {
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
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2" />
    </svg>
  )
}
