'use client'

import { useEffect, useState, useSyncExternalStore, useTransition } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'

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

import { createPerson, type PersonInput } from '../actions'

// Form-state strategy decision (Phase 3 sub-task 2): **react-hook-form**.
//
// Why not `useActionState` + FormData (Phase 2's `CreateTreeModal` pattern):
//   - This form has 10+ fields with a conditional sub-field (`death_year`
//     hidden until `deceased` is true). Hooking conditional rendering off a
//     controlled boolean is trivial in RHF (`watch('deceased')`) — with
//     FormData you'd lift the bool into a separate `useState` *and* still
//     submit via FormData, which fractures the source of truth.
//   - Sub-task 3 adds a tone-swatch radio (5 options) inside the same form.
//     Sub-task 5 adds a "How is this person related?" radio with discriminated
//     sub-fields. Both are vastly easier with RHF's `register` + `watch`.
//   - The Server Action below takes a typed `PersonInput` object, not a raw
//     `FormData`. RHF gives us that object cleanly.
//
// We still call the Server Action directly (not via `form action={...}`) and
// dismiss the surface on `{ ok: true }`. Errors render inline; no Sonner /
// Toast in sub-task 2 (per the scope brief).

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
}

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
}

// Designed for growth: sub-task 3 adds `mode: 'edit'` + `person`, sub-task 5
// adds `linkSpec`. Keeping props flat + optional is simpler than a
// discriminated union when the additions are also optional.
type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  treeId: string
  /** Fired after a successful create; the parent uses this to refresh state. */
  onCreated?: (personId: string) => void
}

// Tailwind classes shared with Phase 2's CreateTreeModal (keep these in
// lockstep so the heirloom-form chrome stays consistent across the app).
const inputClass =
  'border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary'

const DESKTOP_QUERY = '(min-width: 640px)'

function subscribeToMedia(callback: () => void): () => void {
  const mql = window.matchMedia(DESKTOP_QUERY)
  mql.addEventListener('change', callback)
  return () => mql.removeEventListener('change', callback)
}

function getDesktopSnapshot(): boolean {
  return window.matchMedia(DESKTOP_QUERY).matches
}

function getServerSnapshot(): boolean {
  // Render the mobile surface during SSR + first client paint. Both
  // surfaces stay `open=false` on first paint anyway — the swap is
  // invisible to the user.
  return false
}

/**
 * Hydration-safe media-query hook via `useSyncExternalStore` — the
 * idiomatic React 19 path for external sources. Avoids the
 * `react-hooks/set-state-in-effect` lint we'd hit with the naive
 * `useState + useEffect` shape.
 */
function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribeToMedia,
    getDesktopSnapshot,
    getServerSnapshot,
  )
}

export function PersonForm({ open, onOpenChange, treeId, onCreated }: Props) {
  const desktop = useIsDesktop()

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<PersonFormValues>({ defaultValues: DEFAULT_VALUES })

  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const deceased = watch('deceased')

  // Reset the form whenever the surface (re)opens — keeps stale field values
  // from leaking between create sessions, and gives the parent a clean slate
  // after a successful submit.
  useEffect(() => {
    if (open) {
      reset(DEFAULT_VALUES)
      setSubmitError(null)
    }
  }, [open, reset])

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
      const result = await createPerson(treeId, payload)
      if (!result.ok) {
        setSubmitError(result.error)
        return
      }
      onCreated?.(result.personId)
      onOpenChange(false)
    })
  }

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

      <div className="flex justify-end gap-2 mt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Adding…' : 'Add person'}
        </Button>
      </div>
    </form>
  )

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Add a person</DialogTitle>
            <DialogDescription>
              Add a relative to this family tree. Only the name is required.
            </DialogDescription>
          </DialogHeader>
          {body}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[90vh] overflow-y-auto rounded-t-xl"
      >
        <SheetHeader>
          <SheetTitle className="font-serif text-xl">Add a person</SheetTitle>
          <SheetDescription>
            Add a relative to this family tree. Only the name is required.
          </SheetDescription>
        </SheetHeader>
        {body}
      </SheetContent>
    </Sheet>
  )
}
