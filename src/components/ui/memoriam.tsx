// <Memoriam> — Renders a deceased person's name prefixed with a † glyph.
//
// The glyph is muted-foreground + aria-hidden so screen readers read only
// the name. Use wherever a deceased person's name appears in serif type
// (PersonPicker, PersonDetailSheet, share view, etc.).
//
// "IN LOVING MEMORY" letterspaced uppercase tagline: explicitly declined
// during the 2026-05-12 Claude Design brainstorm. The † prefix + softened
// card chrome carry the signal without that line.

type Props = {
  name: string
  className?: string
}

/**
 * Renders a name prefixed with † for deceased people. Glyph is muted-foreground;
 * the name itself keeps its surrounding context's color. Use anywhere a
 * deceased person's name appears in serif type (PersonPicker, detail sheet, share view, etc.).
 */
export function Memoriam({ name, className }: Props) {
  return (
    <span className={className}>
      <span
        data-memoriam-glyph
        aria-hidden="true"
        style={{
          color: 'var(--muted-foreground)',
          opacity: 0.6,
          fontWeight: 400,
          marginRight: '0.32em',
        }}
      >
        †
      </span>
      {name}
    </span>
  )
}
