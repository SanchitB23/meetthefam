'use client'

import { useState } from 'react'

import { AddPersonFab } from './AddPersonFab'
import { PersonForm } from './PersonForm'

type Props = {
  treeId: string
  /**
   * When true (parent's `people.length === 0`), render the inline
   * empty-state CTA button as well. The FAB is always rendered.
   */
  showEmptyStateCta?: boolean
}

/**
 * Wraps the FAB + the optional empty-state CTA + the shared `PersonForm`
 * so they all push/pop the same `open` flag. Lives at page-level (rendered
 * from the Server Component `page.tsx`) so the FAB stays visible even when
 * the people list is empty — `PersonList` doesn't own it.
 */
export function AddPersonControls({ treeId, showEmptyStateCta }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {showEmptyStateCta && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          + Add the first person
        </button>
      )}

      <AddPersonFab onClick={() => setOpen(true)} />

      <PersonForm open={open} onOpenChange={setOpen} treeId={treeId} />
    </>
  )
}
