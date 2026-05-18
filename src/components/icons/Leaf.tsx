// src/components/icons/Leaf.tsx
type Props = {
  size?: number
  className?: string
}

/**
 * Leaf accent — extracted from the `leaf` glyph in Kintree's `Icon` map
 * (`docs/ux/inspiration/kintree/project/shared.jsx`). 24×24, 1.6px stroke
 * to match the Kintree line-icon family. Decorative — used in section
 * headings, so `aria-hidden=true` is the right default.
 */
export function Leaf({ size = 18, className }: Props) {
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
      <path d="M5 19c0-9 7-15 15-15-1 9-7 15-15 15z" />
      <path d="M5 19l9-9" />
    </svg>
  )
}
