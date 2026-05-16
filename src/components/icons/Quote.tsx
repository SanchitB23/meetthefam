// src/components/icons/Quote.tsx
type Props = {
  size?: number
  className?: string
}

/**
 * Pull-quote glyph — extracted from the `quote` glyph in Kintree's `Icon`
 * map (`docs/ux/inspiration/kintree/project/shared.jsx`). 24×24, 1.6px
 * stroke. Two curly opening marks; used in landing-page testimonials and
 * the share-link footer pull-quote. Decorative, so `aria-hidden=true`.
 */
export function Quote({ size = 18, className }: Props) {
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
      <path d="M7 8h4v4c0 3-2 5-5 5" />
      <path d="M14 8h4v4c0 3-2 5-5 5" />
    </svg>
  )
}
