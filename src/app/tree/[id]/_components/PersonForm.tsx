'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Controller, useForm, type SubmitHandler } from 'react-hook-form'
import { Trash2 } from 'lucide-react'

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
import { useIsDesktop } from '@/components/ui/use-is-desktop'

import { createPerson, updatePerson, type PersonInput } from '../actions'
import { DeletePersonDialog } from './DeletePersonDialog'
import type { PersonRow } from './PersonCard'
import type { Tone } from '@/components/ui/avatar'

// Form-state strategy decision (Phase 3 sub-task 2): **react-hook-form**.
//
// Why not `useActionState` + FormData (Phase 2's `CreateTreeModal` pattern):
//   - This form has 10+ fields with a conditional sub-field (`death_year`
//     hidden until `deceased` is true). Hooking conditional rendering off a
//     controlled boolean is trivial in RHF (`watch('deceased')`) — with
//     FormData you'd lift the bool into a separate `useState` *and* still
//     submit via FormData, which fractures the source of truth.
//   - Sub-task 3 adds a tone-swatch radio (5 options) inside the same form
//     (now wired below via `Controller`). Sub-task 5 adds a "How is this
//     person related?" radio with discriminated sub-fields. Both are vastly
//     easier with RHF.
//   - The Server Action below takes a typed `PersonInput` object, not a raw
//     `FormData`. RHF gives us that object cleanly.
//
// We still call the Server Action directly (not via `form action={...}`) and
// dismiss the surface on `{ ok: true }`. Errors render inline; no Sonner /
// Toast in sub-task 3 (per the scope brief).

/** Form values mirror PersonInput but with form-friendly empty strings. */
export type PersonFormValues = {
  full_name: string
  nickname: string
  bio: string
  gender: 'm' | 'f' | 'other' | 'unknown'
  birth_year: string // <input type="number"> still produces a string in RHF
  birth_date: string
  location: string
  occupation: string
  deceased: boolean
  death_year: string
  /** Edit-mode-only override; create mode lets the DB trigger pick. */
  tone: Tone
}

const TONES: readonly Tone[] = ['sage', 'rose', 'indigo', 'amber', 'green']

const DEFAULT_VALUES: PersonFormValues = {
  full_name: '',
  nickname: '',
  bio: '',
  gender: 'unknown',
  birth_year: '',
  birth_date: '',
  location: '',
  occupation: '',
  deceased: false,
  death_year: '',
  // Placeholder; in edit mode we overwrite via `reset(...)` on open.
  // In create mode this value is never read — we omit `tone` from the
  // payload entirely so the DB trigger picks.
  tone: 'sage',
}

function valuesFromPerson(person: PersonRow): PersonFormValues {
  return {
    full_name: person.full_name,
    nickname: person.nickname ?? '',
    bio: person.bio ?? '',
    gender: person.gender,
    birth_year: person.birth_year != null ? String(person.birth_year) : '',
    // PersonRow doesn't carry birth_date today (sub-task 1's SELECT omitted
    // it). Leaving blank preserves the DB value because update() builds a
    // sparse patch and we only set fields that change — see below.
    birth_date: '',
    location: person.location ?? '',
    occupation: person.occupation ?? '',
    deceased: person.deceased,
    death_year: person.death_year != null ? String(person.death_year) : '',
    tone: person.tone,
  }
}

// Designed for growth: sub-task 5 will add `linkSpec` (create-mode only).
type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  treeId: string
  /** `'create'` (default) opens with empty defaults; `'edit'` prefills from `person`. */
  mode?: 'create' | 'edit'
  /** Required when `mode === 'edit'`. */
  person?: PersonRow
  /** Fired after a successful create OR edit save. */
  onSaved?: (personId: string) => void
}

// Tailwind classes shared with Phase 2's CreateTreeModal (keep these in
// lockstep so the heirloom-form chrome stays consistent across the app).
const inputClass =
  'border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary'

// `useIsDesktop` lives in `@/components/ui/use-is-desktop` so the same
// responsive Sheet/Dialog swap is available to PersonPicker + SetParentsDialog
// (Phase 3 sub-task 4) without duplicating the snapshot logic.

export function PersonForm({
  open,
  onOpenChange,
  treeId,
  mode = 'create',
  person,
  onSaved,
}: Props) {
  const desktop = useIsDesktop()
  const isEdit = mode === 'edit'

  // Build the defaults once per `person` identity. In create mode we always
  // start from DEFAULT_VALUES; in edit mode we seed from the row.
  const formDefaults = useMemo<PersonFormValues>(
    () => (isEdit && person ? valuesFromPerson(person) : DEFAULT_VALUES),
    [isEdit, person],
  )

  const {
    register,
    handleSubmit,
    watch,
    reset,
    control,
    formState: { errors },
  } = useForm<PersonFormValues>({ defaultValues: formDefaults })

  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const deceased = watch('deceased')

  // Reset the form whenever the surface (re)opens, or the target row
  // changes — keeps stale field values from leaking between sessions.
  useEffect(() => {
    if (open) {
      reset(formDefaults)
      setSubmitError(null)
    }
  }, [open, reset, formDefaults])

  const onSubmit: SubmitHandler<PersonFormValues> = (values) => {
    setSubmitError(null)
    const payload: PersonInput = {
      full_name: values.full_name,
      nickname: values.nickname || null,
      bio: values.bio || null,
      gender: values.gender,
      birth_year: values.birth_year ? Number(values.birth_year) : null,
      birth_date: values.birth_date || null,
      location: values.location || null,
      occupation: values.occupation || null,
      deceased: values.deceased,
      death_year:
        values.deceased && values.death_year ? Number(values.death_year) : null,
    }

    startTransition(async () => {
      if (isEdit && person) {
        // Include the tone override only in edit mode. In create mode we
        // intentionally omit it so the DB trigger picks the swatch.
        const editPayload: Partial<PersonInput> = {
          ...payload,
          tone: values.tone,
        }
        // birth_date isn't carried by PersonRow today, so the form field is
        // blank on open. Don't overwrite the DB column with that blank —
        // strip it from the patch unless the user actually typed a value.
        if (!values.birth_date) delete editPayload.birth_date
        const result = await updatePerson(person.id, treeId, editPayload)
        if (!result.ok) {
          setSubmitError(result.error)
          return
        }
        onSaved?.(person.id)
        onOpenChange(false)
        return
      }

      const result = await createPerson(treeId, payload)
      if (!result.ok) {
        setSubmitError(result.error)
        return
      }
      onSaved?.(result.personId)
      onOpenChange(false)
    })
  }

  const title = isEdit ? 'Edit person' : 'Add a person'
  const description = isEdit
    ? 'Update the details below. Changes save when you submit.'
    : 'Add a relative to this family tree. Only the name is required.'
  const submitLabel = isEdit
    ? isPending
      ? 'Saving…'
      : 'Save changes'
    : isPending
      ? 'Adding…'
      : 'Add person'

  const body = (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4 px-4 pb-4 sm:px-0 sm:pb-0 sm:mt-2"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="pf-full-name" className="text-sm font-medium text-foreground">
          Full name <span className="text-destructive">*</span>
        </label>
        <input
          id="pf-full-name"
          type="text"
          autoFocus
          maxLength={80}
          placeholder="Jane Smith"
          aria-invalid={errors.full_name ? true : undefined}
          className={inputClass}
          {...register('full_name', {
            required: 'Full name is required',
            maxLength: { value: 80, message: 'Must be 80 characters or fewer' },
            validate: (v) => v.trim().length > 0 || 'Full name is required',
          })}
        />
        {errors.full_name && (
          <p className="text-xs text-destructive">{errors.full_name.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="pf-nickname" className="text-sm font-medium text-foreground">
          Nickname <span className="text-foreground/40 font-normal">(optional)</span>
        </label>
        <input
          id="pf-nickname"
          type="text"
          maxLength={40}
          placeholder="Janie"
          className={inputClass}
          {...register('nickname', {
            maxLength: { value: 40, message: 'Must be 40 characters or fewer' },
          })}
        />
        {errors.nickname && (
          <p className="text-xs text-destructive">{errors.nickname.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="pf-bio" className="text-sm font-medium text-foreground">
          Bio <span className="text-foreground/40 font-normal">(optional)</span>
        </label>
        <textarea
          id="pf-bio"
          rows={3}
          maxLength={500}
          placeholder="A short note about this person"
          className={`${inputClass} resize-none`}
          {...register('bio', {
            maxLength: { value: 500, message: 'Must be 500 characters or fewer' },
          })}
        />
        {errors.bio && (
          <p className="text-xs text-destructive">{errors.bio.message}</p>
        )}
      </div>

      {/*
       * Tone-override swatch — edit mode only.
       *
       * Recommendation in the plan: omit in create mode, because the DB's
       * deterministic name-hash assignment is the right default and users
       * rarely want to override on first creation. The tone column is still
       * editable via the swatch right here in the same form.
       *
       * Accessibility: role="radiogroup" + role="radio" + aria-checked,
       * plus arrow-key handling deferred to a follow-up — the 5 buttons
       * each receive tab focus on their own which is acceptable for v0.1.
       */}
      {isEdit && (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">
            Tone{' '}
            <span className="text-foreground/40 font-normal">
              (avatar color)
            </span>
          </span>
          <Controller
            control={control}
            name="tone"
            render={({ field }) => (
              <div
                role="radiogroup"
                aria-label="Avatar tone"
                className="flex items-center gap-2 py-1"
              >
                {TONES.map((t) => {
                  const selected = field.value === t
                  return (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={t}
                      onClick={() => field.onChange(t)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-105 focus:outline-none"
                      style={{
                        background: `var(--tone-${t}-bg)`,
                        outline: selected
                          ? `2px solid var(--tone-${t}-ring)`
                          : undefined,
                        outlineOffset: selected ? 2 : undefined,
                      }}
                    />
                  )
                })}
              </div>
            )}
          />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="pf-gender" className="text-sm font-medium text-foreground">
          Gender{' '}
          <span className="text-foreground/40 font-normal">(visual styling only)</span>
        </label>
        <select id="pf-gender" className={inputClass} {...register('gender')}>
          <option value="unknown">Unknown</option>
          <option value="f">Female</option>
          <option value="m">Male</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="pf-birth-year" className="text-sm font-medium text-foreground">
            Birth year
          </label>
          <input
            id="pf-birth-year"
            type="number"
            inputMode="numeric"
            placeholder="1955"
            className={inputClass}
            {...register('birth_year')}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="pf-birth-date" className="text-sm font-medium text-foreground">
            Birth date
          </label>
          <input
            id="pf-birth-date"
            type="date"
            className={inputClass}
            {...register('birth_date')}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="pf-location" className="text-sm font-medium text-foreground">
          Location <span className="text-foreground/40 font-normal">(optional)</span>
        </label>
        <input
          id="pf-location"
          type="text"
          placeholder="Brooklyn, NY"
          className={inputClass}
          {...register('location')}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="pf-occupation" className="text-sm font-medium text-foreground">
          Occupation <span className="text-foreground/40 font-normal">(optional)</span>
        </label>
        <input
          id="pf-occupation"
          type="text"
          placeholder="Teacher"
          className={inputClass}
          {...register('occupation')}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border accent-primary"
            {...register('deceased')}
          />
          Deceased
        </label>
        {deceased && (
          <div className="flex flex-col gap-1 pl-6">
            <label
              htmlFor="pf-death-year"
              className="text-sm font-medium text-foreground"
            >
              Death year
            </label>
            <input
              id="pf-death-year"
              type="number"
              inputMode="numeric"
              placeholder="2020"
              className={inputClass}
              {...register('death_year')}
            />
          </div>
        )}
      </div>

      {submitError && (
        <p className="text-sm text-destructive" role="alert">
          {submitError}
        </p>
      )}

      {/*
       * Footer layout:
       *   - Create mode: [Cancel] [Add person]            (right-aligned)
       *   - Edit mode:   [Delete] ……… [Cancel] [Save]    (delete left, save right)
       *
       * Sub-task 4 will move "Delete" into the PersonCardMenu; this footer
       * button is the in-form fallback (and the canonical entry today).
       */}
      <div className="flex items-center gap-2 mt-2">
        {isEdit && person && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setDeleteOpen(true)}
            disabled={isPending}
            className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        )}
        <div className="flex flex-1 justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  )

  const surface = desktop ? (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  ) : (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[90vh] overflow-y-auto rounded-t-xl"
      >
        <SheetHeader>
          <SheetTitle className="font-serif text-xl">{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {body}
      </SheetContent>
    </Sheet>
  )

  return (
    <>
      {surface}
      {isEdit && person && (
        <DeletePersonDialog
          personId={person.id}
          personName={person.full_name}
          treeId={treeId}
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => {
            // Dismiss the parent form too — the row is gone.
            setDeleteOpen(false)
            onOpenChange(false)
          }}
        />
      )}
    </>
  )
}
