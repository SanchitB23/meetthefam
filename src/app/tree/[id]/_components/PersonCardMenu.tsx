'use client'

import { useMemo, useState, useTransition } from 'react'
import { EllipsisVertical } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

import { clearSpouse, setSpouse } from '../actions'
import { collectAncestors, collectDescendants } from '../_lib/relations'
import { DeletePersonDialog } from './DeletePersonDialog'
import { PersonForm } from './PersonForm'
import { PersonPicker } from './PersonPicker'
import { SetParentsDialog } from './SetParentsDialog'
import type { PersonRow } from './PersonCard'

// Phase 3 sub-task 4 + 5 — per-card "..." menu.
//
// Owns the exclusion-set computation for each picker surface (so
// PersonPicker stays dumb / reusable). The flows:
//
//   Set spouse — excludes self + ancestors + descendants (UI guard for
//     decision #6: the DB only rejects ancestor cycles; everything else
//     is intuitively wrong and shouldn't even be picker-visible).
//   Set parents — opens `SetParentsDialog`, which owns its own
//     descendant-excluding pickers for father + mother.
//   Add relative — sub-task 5. Single menu item (rather than separate
//     "Add child" / "Add spouse" / "Add parent" entries) keeping the
//     menu compact. Opens <PersonForm> in create mode with a `linkSpec`
//     pre-selecting "Child of <X>" — the most common direction for
//     tree expansion. The in-form radio lets the user switch to spouse
//     / father / mother before submitting.
//   Clear spouse — fires directly. Per the brief: no inline error slot
//     for this path; the user notices via the (unchanged) row if the
//     RPC rejects. Errors only surface where the user is inside a
//     picker / dialog.
//   Edit — opens the same shared <PersonForm> that the card-body tap
//     opens. PersonList owns that state; we accept `onEdit` to bubble
//     up so the menu route and the tap route share one form instance.
//   Delete — opens <DeletePersonDialog> directly. (The in-form
//     Delete button still works as a fallback inside PersonForm.)

type Props = {
  person: PersonRow
  treeId: string
  people: PersonRow[]
  peopleById: Map<string, PersonRow>
  /** Bubble up to PersonList so the shared <PersonForm> opens for this row. */
  onEdit: (personId: string) => void
}

export function PersonCardMenu({
  person,
  treeId,
  people,
  peopleById,
  onEdit,
}: Props) {
  const [spousePickerOpen, setSpousePickerOpen] = useState(false)
  const [parentsDialogOpen, setParentsDialogOpen] = useState(false)
  const [addRelativeOpen, setAddRelativeOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [spouseError, setSpouseError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // Spouse picker excludes: self + ancestors + descendants.
  const spouseExcludes = useMemo(() => {
    const set = new Set<string>([person.id])
    for (const a of collectAncestors(person.id, peopleById)) set.add(a)
    for (const d of collectDescendants(person.id, peopleById)) set.add(d)
    return set
  }, [person.id, peopleById])

  const handleSelectSpouse = (otherId: string) => {
    setSpouseError(null)
    startTransition(async () => {
      const result = await setSpouse(person.id, otherId, treeId)
      if (!result.ok) {
        setSpouseError(result.error)
        return
      }
      setSpousePickerOpen(false)
    })
  }

  const handleClearSpouse = () => {
    // Per the brief: no inline error slot for this path.
    // `revalidatePath` refreshes the list on success; failures are silent.
    startTransition(() => {
      void clearSpouse(person.id, treeId)
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={`Actions for ${person.full_name}`}
            >
              <EllipsisVertical className="h-4 w-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              setSpouseError(null)
              setSpousePickerOpen(true)
            }}
          >
            Set spouse
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setParentsDialogOpen(true)}>
            Set parents
          </DropdownMenuItem>
          {/*
           * Sub-task 5: opens <PersonForm mode="create"> with a `linkSpec`
           * pre-selecting "Child of <X>". The form's radio lets the user
           * pick spouse / father / mother instead before submitting.
           */}
          <DropdownMenuItem onClick={() => setAddRelativeOpen(true)}>
            Add relative…
          </DropdownMenuItem>
          {person.spouse_id && (
            <DropdownMenuItem onClick={handleClearSpouse}>
              Clear spouse
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onEdit(person.id)}>
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <PersonPicker
        open={spousePickerOpen}
        onOpenChange={(v) => {
          if (!v) {
            setSpousePickerOpen(false)
            setSpouseError(null)
          }
        }}
        people={people}
        excludeIds={spouseExcludes}
        title={`Set spouse of ${person.full_name}`}
        description="Pick a person to link as their spouse. The bond saves on both sides."
        onSelect={handleSelectSpouse}
        footer={
          spouseError ? (
            <p className="text-sm text-destructive" role="alert">
              {spouseError}
            </p>
          ) : undefined
        }
      />

      <SetParentsDialog
        open={parentsDialogOpen}
        onOpenChange={setParentsDialogOpen}
        treeId={treeId}
        person={person}
        people={people}
        peopleById={peopleById}
      />

      <PersonForm
        mode="create"
        open={addRelativeOpen}
        onOpenChange={setAddRelativeOpen}
        treeId={treeId}
        linkSpec={{
          focusPersonId: person.id,
          focusPersonName: person.full_name,
          defaultRelation: 'child',
        }}
      />

      <DeletePersonDialog
        personId={person.id}
        personName={person.full_name}
        treeId={treeId}
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  )
}
