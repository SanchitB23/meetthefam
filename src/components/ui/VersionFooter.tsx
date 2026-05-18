import { APP_VERSION } from '@/lib/generated/version'

/**
 * Phase 8c-7 — first consumer of APP_VERSION (post-ADR 0009 Amendment 4).
 * Renders a muted micro-version in the bottom-right corner globally.
 * pointer-events: none so it never blocks the FAB on /tree/[id].
 */
export function VersionFooter() {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 8,
        right: 12,
        fontSize: 11,
        fontFamily: 'var(--font-sans)',
        color: 'var(--muted-foreground)',
        opacity: 0.4,
        pointerEvents: 'none',
        zIndex: 1,
        letterSpacing: '0.02em',
      }}
    >
      v{APP_VERSION}
    </div>
  )
}
