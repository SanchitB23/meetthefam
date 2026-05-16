// src/components/icons/Heart.tsx
type Props = {
  size?: number
  className?: string
}

/**
 * Heart glyph — extracted from the `heart` glyph in Kintree's `Icon` map
 * (`docs/ux/inspiration/kintree/project/shared.jsx`). Single hand-drawn
 * path (not two arcs + a V like Lucide's `Heart`). 24×24, 1.6px stroke.
 * Used as a feature-card icon alongside `Family` on the landing page;
 * decorative, so `aria-hidden=true`.
 */
export function Heart({ size = 18, className }: Props) {
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
      <path d="M12 20s-7-4.5-9-9.5C1.5 6.5 5 3 8.5 5 10 5.8 11 7 12 8c1-1 2-2.2 3.5-3 3.5-2 7 1.5 5.5 5.5C19 15.5 12 20 12 20z" />
    </svg>
  )
}
