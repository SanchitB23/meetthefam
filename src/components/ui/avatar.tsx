// <Avatar> — photo (circular) or tone-tinted initials.
// Contract: docs/ux/avatars-and-tones.md
// Presentational + server-renderable: no state, no effects, no client APIs.

export type Tone = 'sage' | 'rose' | 'indigo' | 'amber' | 'green'

type Size = 'sm' | 'md' | 'lg' | number

type Props = {
  fullName: string
  /** Computed from `fullName` when absent. */
  initials?: string
  /** Photo URL — when present, replaces the tinted background. */
  photoUrl?: string | null
  tone: Tone
  /** `'md'` = 56, `'sm'` = 40, `'lg'` = 80; numbers are px. Default `'md'`. */
  size?: Size
  /** Adds a 2px ring in `var(--tone-X-ring)` for "current person" treatment. */
  ring?: boolean
  className?: string
}

const SIZE_MAP: Record<Exclude<Size, number>, number> = {
  sm: 40,
  md: 56,
  lg: 80,
}

/** First letter of the first word + first letter of the last word, uppercased. */
function computeInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0][0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : ''
  return (first + last).toUpperCase() || '?'
}

export function Avatar({
  fullName,
  initials,
  photoUrl,
  tone,
  size = 'md',
  ring = false,
  className,
}: Props) {
  const px = typeof size === 'number' ? size : SIZE_MAP[size]
  const text = initials ?? computeInitials(fullName)

  // Initials sit at ~34% of the avatar diameter (matches the Kintree prototype).
  const fontSize = Math.round(px * 0.34)

  const baseStyle: React.CSSProperties = {
    width: px,
    height: px,
    // Ring is drawn as an outline so it doesn't change layout dimensions.
    outline: ring ? `2px solid var(--tone-${tone}-ring)` : undefined,
    outlineOffset: ring ? 2 : undefined,
  }

  const containerClass = [
    'inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 select-none',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  if (photoUrl) {
    return (
      <span className={containerClass} style={baseStyle}>
        {/* Phase 5 owns photo plumbing — a plain <img> is sufficient for now. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl}
          alt={fullName}
          width={px}
          height={px}
          className="h-full w-full object-cover"
        />
      </span>
    )
  }

  return (
    <span
      className={containerClass}
      style={{
        ...baseStyle,
        background: `var(--tone-${tone}-bg)`,
        color: `var(--tone-${tone}-ink)`,
      }}
      aria-label={fullName}
      role="img"
    >
      <span
        className="font-serif"
        style={{
          fontSize,
          fontWeight: 600,
          letterSpacing: '0.02em',
          lineHeight: 1,
        }}
      >
        {text}
      </span>
    </span>
  )
}
