'use client'

// Phase 4 sub-task 3 — person detail surface.
//
// Opens when the user taps a node in `<FamilyTree>` (the chart's default
// click-to-recenter is overridden by sub-task 3's `setOnCardClick`).
//
// Layout: Sheet (bottom) on mobile, Sheet (right) on desktop — matches the
// pattern docs/ux/mobile-gestures.md sketches. We use the same `useIsDesktop`
// snapshot hook PersonForm + PersonPicker already share, so the swap is
// hydration-safe and avoids the `react-hooks/set-state-in-effect` warning.
//
// "Edit" closes this sheet and opens `<PersonForm mode="edit">` next to it.
// Two stacked sheets on mobile is awkward UX, so we sequence them instead
// of stacking. Sub-task 4 will add an action menu (re-center / set spouse /
// etc.) as a third entry-point; this sub-task is detail-view-only.

import { useState } from 'react'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Memoriam } from '@/components/ui/memoriam'
import { useIsDesktop } from '@/components/ui/use-is-desktop'

import { PersonForm } from './PersonForm'
import { buildRelations } from '../_lib/relations'
import type { PersonRow } from '../_lib/types'

type Props = {
  /** When non-null, the sheet is open and shows this person. */
  person: PersonRow | null
  /** Resolves spouse/parent names without re-querying the DB. */
  peopleById: Map<string, PersonRow>
  treeId: string
  /** When true, hides the Edit footer button. Used by the public share view. */
  readOnly?: boolean
  /** Called with `null` when the user closes the sheet. */
  onOpenChange: (person: PersonRow | null) => void
}

function formatDateLine(person: PersonRow): string | null {
  const { birth_year, death_year, deceased } = person
  if (birth_year == null && death_year == null) return null
  if (deceased && (birth_year != null || death_year != null)) {
    return `b. ${birth_year ?? '?'} – d. ${death_year ?? '?'}`
  }
  if (birth_year != null) return `b. ${birth_year}`
  return `d. ${death_year}`
}

export function PersonDetailSheet({
  person,
  peopleById,
  treeId,
  readOnly = false,
  onOpenChange,
}: Props) {
  const desktop = useIsDesktop()
  // Track the person the edit form should bind to separately so closing the
  // detail sheet (which sets `person` to null) doesn't unmount the form
  // mid-transition. Cleared once the form closes.
  const [editPerson, setEditPerson] = useState<PersonRow | null>(null)
  const editOpen = editPerson != null

  const open = person != null
  const relations = person ? buildRelations(person, peopleById) : []
  const dateLine = person ? formatDateLine(person) : null

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => !next && onOpenChange(null)}>
        <SheetContent
          // Bottom on mobile; right on desktop — same swap PersonForm uses.
          side={desktop ? 'right' : 'bottom'}
          className={
            desktop
              ? 'flex flex-col'
              : 'max-h-[90vh] flex flex-col rounded-t-xl'
          }
        >
          {person && (
            <>
              <SheetHeader className="items-center text-center shrink-0">
                <div className="mx-auto mt-2">
                  <Avatar
                    fullName={person.full_name}
                    photoUrl={person.photo_url}
                    tone={person.tone}
                    size="lg"
                    gender={person.gender}
                    deceased={person.deceased}
                  />
                </div>
                <SheetTitle className="font-serif text-2xl mt-3">
                  {person.deceased ? (
                    <Memoriam name={person.full_name} />
                  ) : (
                    person.full_name
                  )}
                </SheetTitle>
                {person.nickname && (
                  <SheetDescription className="italic font-serif text-base text-foreground/70">
                    “{person.nickname}”
                  </SheetDescription>
                )}
              </SheetHeader>

              <div className="flex-1 overflow-y-auto flex flex-col gap-4 px-4 pb-4">
                {person.bio && (
                  <p className="text-sm text-foreground/80 whitespace-pre-line">
                    {person.bio}
                  </p>
                )}

                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
                  {dateLine && (
                    <>
                      <dt className="text-foreground/50">Dates</dt>
                      <dd className="text-foreground">{dateLine}</dd>
                    </>
                  )}
                  {person.location && (
                    <>
                      <dt className="text-foreground/50">Location</dt>
                      <dd className="text-foreground">{person.location}</dd>
                    </>
                  )}
                  {person.occupation && (
                    <>
                      <dt className="text-foreground/50">Occupation</dt>
                      <dd className="text-foreground">{person.occupation}</dd>
                    </>
                  )}
                </dl>

                {relations.length > 0 && (
                  <div className="border-t border-border pt-3">
                    <h3 className="text-xs uppercase tracking-wide text-foreground/50 mb-1.5">
                      Relations
                    </h3>
                    <ul className="text-sm text-foreground space-y-0.5">
                      {relations.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {!readOnly && (
                  <div className="flex justify-end pt-2">
                    <Button
                      type="button"
                      onClick={() => {
                        // Sequence: capture the person for the edit form,
                        // then close this sheet. The form mounts independently
                        // of the detail-sheet `person` prop, so closing here
                        // doesn't unmount it.
                        setEditPerson(person)
                        onOpenChange(null)
                      }}
                    >
                      Edit
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {editPerson && (
        <PersonForm
          open={editOpen}
          onOpenChange={(next) => {
            if (!next) setEditPerson(null)
          }}
          treeId={treeId}
          mode="edit"
          person={editPerson}
        />
      )}
    </>
  )
}
