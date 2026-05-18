'use client'

import { useMemo, useState, useTransition } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { useIsDesktop } from '@/components/ui/use-is-desktop'

import { setParents } from '../actions'
import { collectDescendants } from '../_lib/relations'
import { PersonPicker } from './PersonPicker'
import type { PersonRow } from '../_lib/types'

// Phase 3 sub-task 4 — Set Parents dialog.
//
// Owns the two-picker "father + mother" flow. The plan calls this out as
// the recommended approach (vs. opening two sequential PersonPickers from
// PersonCardMenu) because:
//   - Saving needs both choices at once; sequential pickers can't show a
//     joint "Save" CTA.
//   - Sub-task 5's "Add relative" flow can reuse this same surface for
//     the "Parent of <focus>" branch.
//
// Exclusion set passed into each sub-picker: self + descendants of the
// focus person. This is decision #6's UI guard for the cycle case: even
// though the DB will reject "make grandpa my son", we don't want the user
// to encounter that surface at all.

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  treeId: string
  person: PersonRow
  /** All people in the tree — passed through to the sub-pickers. */
  people: PersonRow[]
  /** Lookup map shared with PersonList — saves rebuilding inside the dialog. */
  peopleById: Map<string, PersonRow>
}

export function SetParentsDialog({
  open,
  onOpenChange,
  treeId,
  person,
  people,
  peopleById,
}: Props) {
  const desktop = useIsDesktop()

  const [fatherId, setFatherId] = useState<string | null>(person.father_id)
  const [motherId, setMotherId] = useState<string | null>(person.mother_id)
  const [pickerOpen, setPickerOpen] = useState<null | 'father' | 'mother'>(
    null,
  )
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Reset working state whenever the dialog (re)opens against a row.
  // Tracks the "session id" — open AND person identity together. When that
  // changes we reset during render (React allows this for store-derived
  // state) instead of an effect, which the eslint rule
  // `react-hooks/set-state-in-effect` disallows. See
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const sessionKey = open ? `${person.id}:${person.father_id}:${person.mother_id}` : null
  const [lastSessionKey, setLastSessionKey] = useState<string | null>(sessionKey)
  if (sessionKey !== lastSessionKey) {
    setLastSessionKey(sessionKey)
    if (open) {
      setFatherId(person.father_id)
      setMotherId(person.mother_id)
      setSubmitError(null)
    }
  }

  // Build the exclusion set once — descendants don't change while the
  // dialog is open (the dialog blocks other mutations).
  const excludeBase = useMemo(() => {
    const set = new Set<string>([person.id])
    for (const d of collectDescendants(person.id, peopleById)) set.add(d)
    return set
  }, [person.id, peopleById])

  // When picking the father, also exclude whoever is currently selected
  // as the mother (the same person can't fill both slots — neither side
  // of `set_parents_atomic` would tolerate it). Same for mother.
  const fatherExcludes = useMemo(() => {
    const set = new Set(excludeBase)
    if (motherId) set.add(motherId)
    return set
  }, [excludeBase, motherId])

  const motherExcludes = useMemo(() => {
    const set = new Set(excludeBase)
    if (fatherId) set.add(fatherId)
    return set
  }, [excludeBase, fatherId])

  // Phase 3 polish — gender filter on parent pickers.
  //
  // The Father picker hides people explicitly marked `gender === 'f'`;
  // the Mother picker hides `gender === 'm'`. `other` and `unknown`
  // show in BOTH — per the form's helper text the gender field is
  // visual styling only, so we only hide the explicit mismatch and
  // don't over-gate. Kept separate from `excludeIds` (which is for
  // tree-relationship walks: self + descendants + already-picked-other-
  // parent) so the two concerns stay independent.
  const fatherCandidates = useMemo(
    () => people.filter((p) => p.gender !== 'f'),
    [people],
  )
  const motherCandidates = useMemo(
    () => people.filter((p) => p.gender !== 'm'),
    [people],
  )

  const father = fatherId ? peopleById.get(fatherId) : null
  const mother = motherId ? peopleById.get(motherId) : null

  const handleSave = () => {
    setSubmitError(null)
    startTransition(async () => {
      const result = await setParents(person.id, fatherId, motherId, treeId)
      if (!result.ok) {
        setSubmitError(result.error)
        return
      }
      onOpenChange(false)
    })
  }

  const body = (
    <div className="flex flex-col gap-4 px-4 pb-4 sm:px-0 sm:pb-0">
      <ParentSlot
        label="Father"
        person={father}
        onChoose={() => setPickerOpen('father')}
        onClear={() => setFatherId(null)}
      />
      <ParentSlot
        label="Mother"
        person={mother}
        onChoose={() => setPickerOpen('mother')}
        onClear={() => setMotherId(null)}
      />

      {submitError && (
        <p className="text-sm text-destructive" role="alert">
          {submitError}
        </p>
      )}

      <div className="flex justify-end gap-2 mt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="button" onClick={handleSave} disabled={isPending}>
          {isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  )

  const title = `Set parents of ${person.full_name}`
  const description =
    'Choose a father and/or a mother. Clearing both removes the link.'

  const surface = desktop ? (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="font-serif text-xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">{body}</div>
      </DialogContent>
    </Dialog>
  ) : (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[90vh] flex flex-col rounded-t-xl"
      >
        <SheetHeader className="shrink-0">
          <SheetTitle className="font-serif text-xl">{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">{body}</div>
      </SheetContent>
    </Sheet>
  )

  return (
    <>
      {surface}
      <PersonPicker
        open={pickerOpen === 'father'}
        onOpenChange={(v) => {
          if (!v) setPickerOpen(null)
        }}
        people={fatherCandidates}
        excludeIds={fatherExcludes}
        title="Choose father"
        onSelect={(id) => {
          setFatherId(id)
          setPickerOpen(null)
        }}
      />
      <PersonPicker
        open={pickerOpen === 'mother'}
        onOpenChange={(v) => {
          if (!v) setPickerOpen(null)
        }}
        people={motherCandidates}
        excludeIds={motherExcludes}
        title="Choose mother"
        onSelect={(id) => {
          setMotherId(id)
          setPickerOpen(null)
        }}
      />
    </>
  )
}

function ParentSlot({
  label,
  person,
  onChoose,
  onClear,
}: {
  label: string
  person: PersonRow | null | undefined
  onChoose: () => void
  onClear: () => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {person ? (
        <div className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2">
          <Avatar
            fullName={person.full_name}
            photoUrl={person.photo_url}
            tone={person.tone}
            size="sm"
          />
          <div className="flex flex-1 flex-col min-w-0">
            <span className="truncate text-sm text-foreground">
              {person.full_name}
            </span>
            {person.birth_year && (
              <span className="text-xs text-foreground/50">
                b. {person.birth_year}
              </span>
            )}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onChoose}>
            Change
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            Clear
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={onChoose}
          className="justify-start"
        >
          Choose {label.toLowerCase()}…
        </Button>
      )}
    </div>
  )
}
