'use client'

// Phase 4 sub-task 5 — context-aware add-person entry point.
//
// Replaces Phase 3's `AddPersonControls` + `AddPersonFab`. When a focus
// person is set (the tree has a currently-centered person — set by initial
// SSR `?p=<id>` mirror, by a hash, or by the action menu's "Re-center
// here"), the FAB primes the form with a `linkSpec` so the new row links
// off the focus person by default. When no focus is set, it falls back to
// the bare "Add a person" path.
//
// Two render variants:
//   - `variant="fab"` — floating bottom-right button, used inside
//     `<FamilyTree>` once the tree has people.
//   - `variant="empty-state"` — inline pill button, used by the
//     empty-state branch in `page.tsx`. Same form, different chrome.

import { useState } from 'react'
import { Plus } from 'lucide-react'

import { PersonForm } from './PersonForm'
import type { PersonRow } from '../_lib/types'

type Props = {
  treeId: string
  /** When non-null, the form opens in "Add a relative" mode pre-seeded as Child. */
  focusPerson: PersonRow | null
  variant?: 'fab' | 'empty-state'
}

export function AddRelativeFab({
  treeId,
  focusPerson,
  variant = 'fab',
}: Props) {
  const [open, setOpen] = useState(false)

  const linked = focusPerson != null
  const fabLabel = linked
    ? `Add a relative to ${focusPerson!.full_name}`
    : 'Add a person'

  return (
    <>
      {variant === 'fab' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={fabLabel}
          title={fabLabel}
          className="fixed bottom-6 right-6 z-40 inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors"
        >
          <Plus className="h-6 w-6" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          + Add the first person
        </button>
      )}

      <PersonForm
        mode="create"
        open={open}
        onOpenChange={setOpen}
        treeId={treeId}
        linkSpec={
          linked
            ? {
                focusPersonId: focusPerson!.id,
                focusPersonName: focusPerson!.full_name,
                defaultRelation: 'child',
              }
            : undefined
        }
      />
    </>
  )
}
