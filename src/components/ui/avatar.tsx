// <Avatar> — photo (gender-shaped or circular) or tone-tinted initials.
// Contract: docs/ux/avatars-and-tones.md
// Presentational + server-renderable: no state, no effects, no client APIs.
//
// 8b-1: gender prop drives border-radius shape:
//   'm'       → rounded-square (~18% of px)
//   'other'   → squircle (~34% of px)
//   'f'       → circle (50%)
//   'unknown' → circle (50%, default)
// deceased prop: desaturates the avatar + adds a † badge (top-right corner)
// at sizes >= 36px.

/**
 * Soft octagon (~5% corner softening via Bezier-sampled polygon) — the shape
 * for `other`. Coordinates are percentages so the same string scales to any
 * avatar size. Visually indistinguishable from a true SVG <path> at every
 * avatar size in use (max 80px).
 *
 * Spec: docs/superpowers/specs/2026-06-02-gender-shape-system-remap-design.md
 */
export const SOFT_OCTAGON_CLIP_PATH = `polygon(
  35% 0%, 65% 0%,
  67.41% 0.22%, 69.64% 0.89%, 71.68% 1.99%, 73.54% 3.54%,
  96.46% 26.46%,
  98.01% 28.32%, 99.12% 30.36%, 99.78% 32.59%, 100% 35%,
  100% 65%,
  99.78% 67.41%, 99.12% 69.64%, 98.01% 71.68%, 96.46% 73.54%,
  73.54% 96.46%,
  71.68% 98.01%, 69.64% 99.12%, 67.41% 99.78%, 65% 100%,
  35% 100%,
  32.59% 99.78%, 30.36% 99.12%, 28.32% 98.01%, 26.46% 96.46%,
  3.54% 73.54%,
  1.99% 71.68%, 0.89% 69.64%, 0.22% 67.41%, 0% 65%,
  0% 35%,
  0.22% 32.59%, 0.89% 30.36%, 1.99% 28.32%, 3.54% 26.46%,
  26.46% 3.54%,
  28.32% 1.99%, 30.36% 0.89%, 32.59% 0.22%
)`

/**
 * Gender → shape mapping. Discriminated union so callers can branch between a
 * plain border-radius CSS value (m / unknown / f) and a clip-path string
 * (other). The shape spectrum encodes how committed the gender info is:
 *
 *   m       → rounded-square (~18%)   — known, sharp-ish corners
 *   unknown → squircle      (~34%)   — geometric midpoint, signals "unset"
 *   f       → circle         (50%)   — known, fully rounded
 *   other   → soft octagon          — off-axis, distinctive identity
 *
 * Spec: docs/superpowers/specs/2026-06-02-gender-shape-system-remap-design.md
 */
export type GenderShape =
  | { kind: 'radius'; borderRadius: string }
  | { kind: 'clip-path'; clipPath: string }

export function shapeCssForGender(
  gender: 'm' | 'f' | 'other' | 'unknown' | undefined,
  px: number,
): GenderShape {
  switch (gender) {
    case 'm':
      return { kind: 'radius', borderRadius: `${Math.round(px * 0.18)}px` }
    case 'unknown':
      return { kind: 'radius', borderRadius: `${Math.round(px * 0.34)}px` }
    case 'f':
      return { kind: 'radius', borderRadius: '50%' }
    case 'other':
      return { kind: 'clip-path', clipPath: SOFT_OCTAGON_CLIP_PATH }
    case undefined:
    default:
      return { kind: 'radius', borderRadius: '50%' }
  }
}

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
  /** Gender shape: 'm' → rounded-square, 'other' → squircle, 'f' / 'unknown' → circle. */
  gender?: 'm' | 'f' | 'other' | 'unknown'
  /** Deceased: avatar desaturates (saturate 0.55 + opacity 0.82) + † badge at size >= 36. */
  deceased?: boolean
  className?: string
}

const SIZE_MAP: Record<Exclude<Size, number>, number> = {
  sm: 40,
  md: 56,
  lg: 80,
}

/** First letter of the first word + first letter of the last word, uppercased. */
export function computeInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0][0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : ''
  return (first + last).toUpperCase() || '?'
}

/**
 * Maps a gender value to a CSS border-radius string.
 * 'm'       → rounded-square (~18% of px)
 * 'other'   → squircle (~34% of px)
 * 'f'       → circle (50%)
 * 'unknown' → circle (50%)
 * undefined → circle (50%)
 */
export function borderRadiusForGender(
  gender: 'm' | 'f' | 'other' | 'unknown' | undefined,
  px: number,
): string {
  switch (gender) {
    case 'm':
      return `${Math.round(px * 0.18)}px`
    case 'other':
      return `${Math.round(px * 0.34)}px`
    case 'f':
      return '50%'
    case 'unknown':
      return '50%'
    default:
      return '50%'
  }
}

export function Avatar({
  fullName,
  initials,
  photoUrl,
  tone,
  size = 'md',
  ring = false,
  gender = 'unknown',
  deceased = false,
  className,
}: Props) {
  const px = typeof size === 'number' ? size : SIZE_MAP[size]
  const text = initials ?? computeInitials(fullName)

  // Initials sit at ~34% of the avatar diameter (matches the Kintree prototype).
  const fontSize = Math.round(px * 0.34)
  const borderRadius = borderRadiusForGender(gender, px)

  // The inner container clips the photo / background to the correct border-radius.
  // It must NOT be position:relative — that role is taken by the outer wrapper so
  // the deceased badge (position:absolute) escapes overflow:hidden clipping.
  const innerStyle: React.CSSProperties = {
    width: px,
    height: px,
    borderRadius,
    // Ring is drawn as an outline so it doesn't change layout dimensions.
    outline: ring ? `2px solid var(--tone-${tone}-ring)` : undefined,
    outlineOffset: ring ? 2 : undefined,
    // Deceased: aggressive desaturation + small grayscale so the effect
    // lands on PHOTO avatars too (a low-saturation portrait at saturate(0.55)
    // alone is visually indistinguishable from a living one).
    filter: deceased ? 'saturate(0.4) grayscale(0.3)' : undefined,
    opacity: deceased ? 0.78 : undefined,
  }

  const innerClass = [
    'inline-flex items-center justify-center overflow-hidden shrink-0 select-none',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  // Outer wrapper: position:relative (NO overflow:hidden) so the deceased badge
  // (position:absolute) is not clipped by the inner container's border-radius.
  const outerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-flex',
    width: px,
    height: px,
  }

  // Deceased † badge — top-right corner; only rendered when size >= 36
  // because below that the badge is illegible.
  // Corner choice: top:0 right:0 — 8b-3's ↑ duplicate badge will sit at
  // top:-6px left:-6px so the two badges don't collide.
  const deceasedBadge =
    deceased && px >= 36 ? (
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: Math.round(px * 0.26),
          height: Math.round(px * 0.26),
          borderRadius: '50%',
          background: 'var(--card)',
          color: 'var(--muted-foreground)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-serif)',
          fontSize: Math.round(px * 0.2),
          lineHeight: 1,
          border: '1px solid var(--border)',
        }}
      >
        †
      </span>
    ) : null

  if (photoUrl) {
    return (
      <span style={outerStyle}>
        <span className={innerClass} style={innerStyle}>
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
        {deceasedBadge}
      </span>
    )
  }

  return (
    <span style={outerStyle}>
      <span
        className={innerClass}
        style={{
          ...innerStyle,
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
      {deceasedBadge}
    </span>
  )
}
