'use client'

import { useMemo, useState } from 'react'
import { PersonCard, type PersonRow } from './PersonCard'
import { PersonForm } from './PersonForm'

type Props = {
  treeId: string
  people: PersonRow[]
}

/**
 * PersonList owns the "which row is being edited" state for the whole grid
 * and renders a single shared `<PersonForm mode="edit">`. Each card is
 * wrapped in a `<button>` whose click sets that state, opening the form.
 *
 * Tappability design choice (Phase 3 sub-task 3, option chosen from the
 * three offered):
 *
 *   The plan offered three options:
 *     (a) convert `PersonCard` itself to `'use client'` + take an onClick prop
 *     (b) introduce a new `EditPersonControls` wrapper
 *     (c) lift state into `PersonList` and have it own the open-state +
 *         edit-target + edit form
 *
 *   We went with (c). Rationale:
 *     - The cards live in a grid that already needs to share one piece of
 *       state (which row to edit). Hoisting that to the list is the natural
 *       home — no fan-out via context, no separate wrapper component.
 *     - PersonCard stays purely presentational, so sub-task 4 can drop in
 *       a `PersonCardMenu` (a separate client component) without touching
 *       this file's interactive seam.
 *     - The card-tap → edit behavior remains the default, exactly as
 *       sub-task 4 expects to inherit ("card body itself opens the edit
 *       form on click; sub-task 4 will move Edit + Delete into the menu
 *       and keep card-tap → edit as the default").
 *
 * Sub-task 4 will likely add a wrapping div per card so the menu trigger
 * can sit outside the tappable area. For now the whole card is the tap
 * surface, which is also fine because there's no menu yet to conflict.
 */
export function PersonList({ treeId, people }: Props) {
  // Build the lookup map once per render so each PersonCard can resolve
  // spouse/parent names in O(1) without re-querying.
  const peopleById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people],
  )

  const [editId, setEditId] = useState<string | null>(null)
  const editTarget = editId ? (peopleById.get(editId) ?? null) : null

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {people.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setEditId(p.id)}
            aria-label={`Edit ${p.full_name}`}
            // text-left + display:block so the inner card lays out normally.
            // focus-visible ring uses the heirloom primary token. The card
            // itself already exceeds the 44px hit-area minimum (p-4 + avatar
            // md = 56px), so no extra padding shim is needed.
            className="text-left block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:bg-foreground/[0.02] transition-colors"
          >
            <PersonCard person={p} peopleById={peopleById} />
          </button>
        ))}
      </div>

      {/*
       * Single shared edit form for the whole list. Keeping `open` derived
       * from `editTarget` avoids the "stale row flashes through during the
       * close transition" problem you'd get from a per-card form.
       */}
      {editTarget && (
        <PersonForm
          mode="edit"
          open={editId !== null}
          onOpenChange={(v) => {
            if (!v) setEditId(null)
          }}
          treeId={treeId}
          person={editTarget}
        />
      )}
    </>
  )
}
