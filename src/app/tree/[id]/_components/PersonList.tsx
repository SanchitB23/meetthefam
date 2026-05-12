'use client'

import { useMemo, useState } from 'react'
import { PersonCard, type PersonRow } from './PersonCard'
import { PersonCardMenu } from './PersonCardMenu'
import { PersonForm } from './PersonForm'

type Props = {
  treeId: string
  people: PersonRow[]
}

/**
 * PersonList owns the "which row is being edited" state for the whole grid
 * and renders a single shared `<PersonForm mode="edit">`.
 *
 * Sub-task 4 layout: stretched-button pattern (matches `<TreeCard>`).
 *
 *   Outer  : `relative` wrapper
 *   z-0    : absolute `<button>` covering the card → tap-to-edit
 *   z-10   : `<PersonCard>` content with `pointer-events-none` so the
 *            button below receives clicks
 *   z-10   : `<PersonCardMenu>` floats in the top-right with
 *            `pointer-events-auto` so its dropdown trigger wins clicks
 *            over the underlying edit-button
 *
 * This preserves tap-to-edit AND lets the menu live inside the card chrome
 * without nesting a button inside a button (invalid HTML the previous
 * sub-task 3 implementation was getting away with only because the inner
 * menu didn't yet exist).
 */
export function PersonList({ treeId, people }: Props) {
  // Build the lookup map once per render so each PersonCard and
  // PersonCardMenu can resolve spouse/parent names + relation walks in
  // O(1) without re-querying.
  const peopleById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people],
  )

  const [editId, setEditId] = useState<string | null>(null)
  const editTarget = editId ? (peopleById.get(editId) ?? null) : null

  return (
    <>
      <div className="grid gap-4 auto-rows-fr sm:grid-cols-2 lg:grid-cols-3">
        {people.map((p) => (
          <div
            key={p.id}
            className="relative h-full rounded-lg transition-colors hover:bg-foreground/[0.02] focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:ring-offset-background"
          >
            {/* z-0 absolute button — the tap-to-edit surface. Mirrors
                <TreeCard>'s stretched-Link pattern. aria-label gives
                screen readers a meaningful target name; visible focus
                ring lives on the outer wrapper via focus-within. */}
            <button
              type="button"
              onClick={() => setEditId(p.id)}
              aria-label={`Edit ${p.full_name}`}
              className="absolute inset-0 z-0 rounded-lg focus:outline-none"
            />

            {/* z-10 card content with pointer-events-none so clicks fall
                through to the underlying button. The menu (next sibling)
                re-enables pointer events on its own subtree only. */}
            <div className="pointer-events-none relative z-10">
              <PersonCard person={p} peopleById={peopleById} />
            </div>

            {/* z-10 menu in the top-right. pointer-events-auto re-enables
                the dropdown trigger; the menu's own portal handles the
                rest. min h/w 44px keeps the hit-area at the Apple HIG
                floor on mobile. */}
            <div className="absolute top-2 right-2 z-10 pointer-events-auto">
              <PersonCardMenu
                person={p}
                treeId={treeId}
                people={people}
                peopleById={peopleById}
                onEdit={(id) => setEditId(id)}
              />
            </div>
          </div>
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
