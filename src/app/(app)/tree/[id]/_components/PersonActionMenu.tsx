'use client'

// Phase 4 sub-task 4 — long-press / "…" → action menu.
//
// Port of the Phase 3 `PersonCardMenu` with three changes:
//   1. No own trigger. Open is controlled by parent via `anchor` — when
//      non-null, the menu renders at those viewport coords. This lets the
//      canvas-rendered HTML cards (whose DOM isn't React-managed) open the
//      menu via long-press or three-dot tap, both of which feed coordinates
//      from `FamilyTree.tsx`.
//   2. A new "Re-center here" item at the top — re-centering moved off the
//      tap path in sub-task 3, so it lives in the menu now.
//   3. Subordinate dialogs (PersonPicker, SetParentsDialog, PersonForm,
//      DeletePersonDialog) own their own state and outlive the menu's open
//      state so picking a menu item that opens a dialog doesn't close the
//      whole thing.
//
// Positioning: Base UI's `Menu.Positioner` anchors to the Trigger element.
// We render a 1×1 invisible `<button>` Trigger that's `position: fixed` at
// the desired viewport coords. The popup naturally anchors next to it.

import { useMemo, useState, useTransition } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { clearSpouse, setSpouse } from '../actions'
import { ErrorAlert } from '@/components/ui/error-alert'
import { mapErrorCode } from '@/lib/errors'
import {
  collectAncestors,
  collectDescendants,
} from '../_lib/relations'
import { DeletePersonDialog } from './DeletePersonDialog'
import { PersonForm } from './PersonForm'
import { PersonPicker } from './PersonPicker'
import { SetParentsDialog } from './SetParentsDialog'
import type { PersonRow } from '../_lib/types'

export type ActionAnchor = {
  personId: string
  /** Viewport coords where the menu should appear. */
  x: number
  y: number
}

type Props = {
  anchor: ActionAnchor | null
  treeId: string
  people: PersonRow[]
  peopleById: Map<string, PersonRow>
  /** Fired when the menu closes (item click, outside press, escape). */
  onClose: () => void
  /** Fired when the user picks "Re-center here". */
  onRecenter: (personId: string) => void
}

export function PersonActionMenu({
  anchor,
  treeId,
  people,
  peopleById,
  onClose,
  onRecenter,
}: Props) {
  // Subordinate-dialog state. Each is the id of the person being operated
  // on, captured at menu-item click time so the dialog outlives the menu
  // open state.
  const [spousePickerForId, setSpousePickerForId] = useState<string | null>(null)
  const [parentsDialogForId, setParentsDialogForId] = useState<string | null>(null)
  const [addRelativeForId, setAddRelativeForId] = useState<string | null>(null)
  const [editForId, setEditForId] = useState<string | null>(null)
  const [deleteForId, setDeleteForId] = useState<string | null>(null)

  const [spouseError, setSpouseError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const person = anchor ? peopleById.get(anchor.personId) ?? null : null
  const spousePickerPerson = spousePickerForId
    ? peopleById.get(spousePickerForId) ?? null
    : null
  const parentsDialogPerson = parentsDialogForId
    ? peopleById.get(parentsDialogForId) ?? null
    : null
  const addRelativePerson = addRelativeForId
    ? peopleById.get(addRelativeForId) ?? null
    : null
  const editPerson = editForId ? peopleById.get(editForId) ?? null : null
  const deletePerson = deleteForId ? peopleById.get(deleteForId) ?? null : null

  // #71 — alphabetised people list for PersonForm's always-on Link-to picker.
  const peopleForPicker = useMemo(
    () => [...people].sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [people],
  )

  // Excludes for the spouse picker — self + ancestors + descendants.
  const spouseExcludes = useMemo(() => {
    if (!spousePickerPerson) return new Set<string>()
    const set = new Set<string>([spousePickerPerson.id])
    for (const a of collectAncestors(spousePickerPerson.id, peopleById)) set.add(a)
    for (const d of collectDescendants(spousePickerPerson.id, peopleById)) set.add(d)
    return set
  }, [spousePickerPerson, peopleById])

  const handleSelectSpouse = (otherId: string) => {
    if (!spousePickerPerson) return
    setSpouseError(null)
    const fromId = spousePickerPerson.id
    startTransition(async () => {
      const result = await setSpouse(fromId, otherId, treeId)
      if (!result.ok) {
        setSpouseError(result.error)
        return
      }
      setSpousePickerForId(null)
    })
  }

  const handleClearSpouse = () => {
    if (!person) return
    const id = person.id
    startTransition(() => {
      void clearSpouse(id, treeId)
    })
  }

  // Trigger is a 1×1 invisible button positioned at the anchor coords.
  // Base UI's Positioner anchors the menu popup next to its rect.
  const triggerStyle: React.CSSProperties = anchor
    ? {
        position: 'fixed',
        top: anchor.y,
        left: anchor.x,
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: 'none',
      }
    : { display: 'none' }

  return (
    <>
      <DropdownMenu
        open={anchor != null}
        onOpenChange={(next) => {
          if (!next) onClose()
        }}
      >
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-hidden="true"
              tabIndex={-1}
              style={triggerStyle}
            />
          }
        />
        <DropdownMenuContent align="start" side="bottom">
          {person && (
            <>
              <DropdownMenuItem
                onClick={() => {
                  onRecenter(person.id)
                  onClose()
                }}
              >
                Re-center here
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setSpouseError(null)
                  setSpousePickerForId(person.id)
                }}
              >
                Set spouse
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setParentsDialogForId(person.id)}
              >
                Set parents
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setAddRelativeForId(person.id)}
              >
                Add relative…
              </DropdownMenuItem>
              {person.spouse_id && (
                <DropdownMenuItem onClick={handleClearSpouse}>
                  Clear spouse
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setEditForId(person.id)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteForId(person.id)}
              >
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {spousePickerPerson && (
        <PersonPicker
          open={spousePickerForId != null}
          onOpenChange={(v) => {
            if (!v) {
              setSpousePickerForId(null)
              setSpouseError(null)
            }
          }}
          people={people}
          excludeIds={spouseExcludes}
          title={`Set spouse of ${spousePickerPerson.full_name}`}
          description="Pick a person to link as their spouse. The bond saves on both sides."
          onSelect={handleSelectSpouse}
          footer={
            spouseError ? (
              <ErrorAlert size="sm" message={mapErrorCode(spouseError, spouseError)} />
            ) : undefined
          }
        />
      )}

      {parentsDialogPerson && (
        <SetParentsDialog
          open={parentsDialogForId != null}
          onOpenChange={(v) => {
            if (!v) setParentsDialogForId(null)
          }}
          treeId={treeId}
          person={parentsDialogPerson}
          people={people}
          peopleById={peopleById}
        />
      )}

      {addRelativePerson && (
        <PersonForm
          mode="create"
          open={addRelativeForId != null}
          onOpenChange={(v) => {
            if (!v) setAddRelativeForId(null)
          }}
          treeId={treeId}
          peopleForPicker={peopleForPicker}
          linkSpec={{
            focusPersonId: addRelativePerson.id,
            defaultRelation: 'child',
          }}
        />
      )}

      {editPerson && (
        <PersonForm
          mode="edit"
          open={editForId != null}
          onOpenChange={(v) => {
            if (!v) setEditForId(null)
          }}
          treeId={treeId}
          person={editPerson}
        />
      )}

      {deletePerson && (
        <DeletePersonDialog
          personId={deletePerson.id}
          personName={deletePerson.full_name}
          treeId={treeId}
          open={deleteForId != null}
          onClose={() => setDeleteForId(null)}
        />
      )}
    </>
  )
}
