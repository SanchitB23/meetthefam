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

import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'

import { PersonForm } from './PersonForm'
import type { PersonRow } from '../_lib/types'

const EMPTY_MAP = new Map<string, PersonRow>()

type Props = {
  treeId: string
  /** When non-null, the form opens in "Add a relative" mode pre-seeded as Child. */
  focusPerson: PersonRow | null
  /**
   * Full people map, needed to look up the person targeted by the in-card "+"
   * button (CustomEvent 'mtf-add-relative'). Optional — defaults to an empty
   * map for the empty-state variant where no people exist yet.
   */
  peopleById?: Map<string, PersonRow>
  variant?: 'fab' | 'empty-state'
}

export function AddRelativeFab({
  treeId,
  focusPerson,
  peopleById = EMPTY_MAP,
  variant = 'fab',
}: Props) {
  const [open, setOpen] = useState(false)
  // 8b polish FIX 1 — person targeted by the in-card "+" button.
  // When non-null, overrides focusPerson for the linkSpec (the button sits on
  // a specific card, not necessarily the currently-centred person).
  const [cardPlusPerson, setCardPlusPerson] = useState<PersonRow | null>(null)

  // peopleById ref so the event handler always sees the latest map without
  // being re-registered on every render.
  const peopleByIdRef = useRef(peopleById)
  useEffect(() => {
    peopleByIdRef.current = peopleById
  }, [peopleById])

  useEffect(() => {
    const handler = (e: Event) => {
      const personId = (e as CustomEvent<{ personId: string }>).detail?.personId
      if (!personId) return
      const person = peopleByIdRef.current.get(personId) ?? null
      if (!person) return
      setCardPlusPerson(person)
      setOpen(true)
    }
    window.addEventListener('mtf-add-relative', handler)
    return () => window.removeEventListener('mtf-add-relative', handler)
  }, [])

  // Clear the card-plus override when the form closes so the FAB reverts to
  // its normal focusPerson-based linkSpec on the next open.
  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) setCardPlusPerson(null)
  }

  // The effective link target: card-plus person (specific card "+" clicked) takes
  // precedence over the FAB's current focus person.
  const effectiveLinkPerson = cardPlusPerson ?? focusPerson
  const linked = effectiveLinkPerson != null
  const fabLabel = focusPerson != null
    ? `Add a relative to ${focusPerson.full_name}`
    : 'Add a person'

  // #71 — the always-on Link-to picker inside PersonForm needs the full
  // candidate list. We feed it from peopleById, sorted by full_name. Empty-
  // state callers pass no peopleById → EMPTY_MAP default → empty list →
  // PersonForm hides the linking block entirely (first-person path).
  const peopleForPicker = useMemo(
    () =>
      Array.from(peopleById.values()).sort((a, b) =>
        a.full_name.localeCompare(b.full_name),
      ),
    [peopleById],
  )

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
        onOpenChange={handleOpenChange}
        treeId={treeId}
        peopleForPicker={peopleForPicker}
        linkSpec={
          linked
            ? {
                focusPersonId: effectiveLinkPerson!.id,
                defaultRelation: 'child',
              }
            : undefined
        }
      />
    </>
  )
}
