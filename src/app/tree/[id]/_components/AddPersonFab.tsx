'use client'

import { Plus } from 'lucide-react'

type Props = {
  onClick: () => void
}

/**
 * Floating action button — bottom-right, mobile-thumb reachable. The
 * outer wrapper provides the >= 44 x 44 hit area (Apple HIG); the inner
 * pill is visually 48 x 48 (`h-12 w-12`) so already exceeds that, but the
 * touch-target padding stays explicit for any future size tweaks.
 *
 * State lives in the parent (`AddPersonControls`) so the empty-state CTA
 * and the FAB share a single source of truth and open the same
 * `<PersonForm>`.
 */
export function AddPersonFab({ onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Add a person"
      className="fixed bottom-6 right-6 z-40 inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors"
    >
      <Plus className="h-6 w-6" />
    </button>
  )
}
