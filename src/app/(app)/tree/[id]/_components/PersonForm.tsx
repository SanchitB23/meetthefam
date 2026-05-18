'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Controller, useForm, type SubmitHandler } from 'react-hook-form'
import { Trash2, Heart, UserRound, Baby, type LucideIcon } from 'lucide-react'

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

import {
  createPerson,
  removePersonPhoto,
  updatePerson,
  uploadPersonPhoto,
  type LinkSpecInput,
  type PersonInput,
} from '../actions'
import { DeletePersonDialog } from './DeletePersonDialog'
import type { PersonRow } from '../_lib/types'
import { Avatar, type Tone } from '@/components/ui/avatar'
import { ImageDecodeError, resizeToJpeg } from '@/lib/image/resize'

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
  /**
   * Sub-task 5: only present when create-mode is invoked with a `linkSpec`.
   * The 4-option radio sets the new person's relation to the focus person.
   */
  relation: LinkRelation
}

/**
 * The 4 relation choices the at-creation radio exposes. The plan considered
 * a 3-option radio with a "father / mother" sub-question for the parent
 * case, but splitting into 4 explicit options sidesteps the gender-default
 * logic (which is fragile when the new person's gender hasn't been picked
 * yet) and is less ambiguous for the user.
 */
export type LinkRelation = 'spouse' | 'father' | 'mother' | 'child'

/** Optional create-mode prop wiring the focus person + default selection. */
export type LinkSpec = {
  focusPersonId: string
  focusPersonName: string
  /** When set, pre-selects the corresponding radio. */
  defaultRelation?: LinkRelation
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
  // Only consulted when `linkSpec` is set on the form. The "Add relative"
  // entry point defaults this to 'child' (the most common direction for
  // tree expansion); the in-form radio lets the user override.
  relation: 'child',
}

// 8b polish — icon-card layout (matches the Anthropic Family Tree
// prototype: docs/ux/inspiration/meetmyfamily/shared.jsx). Labels are
// short ("Spouse", "Father", …); the focus person is named in the
// surface title and the section header, so repeating "of <name>" on
// each button was just noise. Father + Mother share the UserRound
// icon — the label disambiguates them, gender-glyph icons looked busy
// at small sizes.
const RELATION_OPTIONS: ReadonlyArray<{
  value: LinkRelation
  label: string
  icon: LucideIcon
}> = [
  { value: 'spouse', label: 'Spouse', icon: Heart },
  { value: 'father', label: 'Father', icon: UserRound },
  { value: 'mother', label: 'Mother', icon: UserRound },
  { value: 'child', label: 'Child', icon: Baby },
]

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
    // `relation` is never read in edit mode; placeholder keeps the type
    // happy without leaking a meaningful default.
    relation: 'child',
  }
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  treeId: string
  /** `'create'` (default) opens with empty defaults; `'edit'` prefills from `person`. */
  mode?: 'create' | 'edit'
  /** Required when `mode === 'edit'`. */
  person?: PersonRow
  /**
   * Sub-task 5 — at-creation linking. Only meaningful in create mode.
   * When set, the form renders a "How is this person related?" radio
   * above the name field and on submit the Server Action runs the
   * matching `set_*_atomic` RPC after the insert.
   */
  linkSpec?: LinkSpec
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
  linkSpec,
  onSaved,
}: Props) {
  const desktop = useIsDesktop()
  const isEdit = mode === 'edit'
  // The link picker only renders in create mode with an explicit linkSpec.
  // The bare "+" FAB path stays radio-free (sub-task 2 behaviour).
  const showLinkPicker = !isEdit && Boolean(linkSpec)

  // Build the defaults once per `person` / `linkSpec` identity. In create
  // mode we start from DEFAULT_VALUES and override `relation` if the
  // caller pre-selected one; in edit mode we seed from the row.
  const formDefaults = useMemo<PersonFormValues>(() => {
    if (isEdit && person) return valuesFromPerson(person)
    return {
      ...DEFAULT_VALUES,
      relation: linkSpec?.defaultRelation ?? DEFAULT_VALUES.relation,
    }
  }, [isEdit, person, linkSpec?.defaultRelation])

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
  const birthYear = watch('birth_year')
  const fullNameWatch = watch('full_name')

  // ---- Phase 5 sub-task 3: photo-picker state ----
  //
  // Locked decision in the plan: photo state lives OUTSIDE react-hook-form
  // so the rest of the form's `isDirty` tracking isn't perturbed by photo
  // changes. We juggle three pieces of state:
  //
  //   pendingPhotoRef         — Blob held in memory during create flow,
  //                             flushed to Storage after createPerson
  //                             returns the new personId.
  //   pendingPhotoBlobUrlRef  — object URL string for the Blob above,
  //                             tracked separately so the cleanup effect
  //                             and the setPendingBlob helper can revoke
  //                             the previous URL without re-reading from
  //                             pendingPhotoRef.
  //   previewObjectUrl        — same value as pendingPhotoBlobUrlRef but
  //                             held in state so the avatar re-renders.
  //   localPhotoUrl           — edit-mode override for the row's photo_url
  //                             once the immediate upload / remove
  //                             succeeds. Set to a string after upload,
  //                             null after remove, undefined to fall back
  //                             to person.photo_url.
  //   photoError              — inline error rendered next to the avatar.
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const pendingPhotoRef = useRef<Blob | null>(null)
  const pendingPhotoBlobUrlRef = useRef<string | null>(null)
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null)
  const [localPhotoUrl, setLocalPhotoUrl] = useState<string | null | undefined>(
    undefined,
  )
  const [photoError, setPhotoError] = useState<string | null>(null)

  // Stash a new Blob, revoking the previous object URL (if any). Pass null
  // to clear. Centralises the URL.revokeObjectURL bookkeeping so onPick /
  // onRemove / Clear / submit-handler-flush all funnel through one path.
  const setPendingBlob = (blob: Blob | null) => {
    if (pendingPhotoBlobUrlRef.current) {
      URL.revokeObjectURL(pendingPhotoBlobUrlRef.current)
      pendingPhotoBlobUrlRef.current = null
    }
    pendingPhotoRef.current = blob
    if (blob) {
      const url = URL.createObjectURL(blob)
      pendingPhotoBlobUrlRef.current = url
      setPreviewObjectUrl(url)
    } else {
      setPreviewObjectUrl(null)
    }
  }
  const clearPendingBlob = () => setPendingBlob(null)

  // ---- Resolve the avatar's photoUrl + tone ----
  //
  // Priority: local object URL (just-picked blob) → edit-mode local override
  // (post-upload / post-remove) → row's persisted photo_url → null (Avatar
  // shows initials). Create mode has no row, so the chain falls through to
  // the object URL or null.
  const previewUrl: string | null = previewObjectUrl
    ?? (localPhotoUrl !== undefined ? localPhotoUrl : (person?.photo_url ?? null))
  // Tone is purely cosmetic for the avatar background; in create mode the
  // DB trigger picks the real tone after insert. 'sage' is the neutral
  // default that matches DEFAULT_VALUES.tone.
  const previewTone: Tone = person?.tone ?? 'sage'
  // The Avatar's `fullName` only feeds the initials fallback when there's
  // no photo, but we still want it to track the typed name in real time so
  // create-mode users see their initials before picking a photo.
  const previewName =
    (fullNameWatch && fullNameWatch.trim()) || person?.full_name || '—'

  // Temporal-field clamps (Fix 3 — block future dates and impossible
  // birth_year < death_year combos). The `max` HTML attrs give mobile
  // pickers + native validation a hint; the RHF `validate` rules below
  // are the actual gate. The server action validates these too — defense
  // in depth — see actions.ts.
  const currentYear = new Date().getFullYear()
  const todayISO = new Date().toISOString().slice(0, 10)

  // Reset the form whenever the surface (re)opens, or the target row
  // changes — keeps stale field values from leaking between sessions.
  useEffect(() => {
    if (open) {
      reset(formDefaults)
      setSubmitError(null)
      // Photo state lives outside RHF so reset() doesn't touch it. Reset
      // by hand on (re)open so a closed-without-save create session
      // doesn't leak a pending Blob into the next session.
      setPhotoError(null)
      setLocalPhotoUrl(undefined)
      // setPendingBlob(null) handles the URL.revokeObjectURL bookkeeping.
      setPendingBlob(null)
    }
    // setPendingBlob / setLocalPhotoUrl / setPhotoError are stable
    // per-render but identity-unstable across renders. We deliberately
    // only re-run this effect when `open` flips — including them in the
    // dep list would re-run on every keystroke and reset the form.
  }, [open, reset, formDefaults])

  // Revoke any lingering object URL on unmount. Belt-and-braces — the
  // reset-on-open path above already revokes when the form is reused for
  // a different person, but the component might unmount while a Blob is
  // still held (e.g. the parent removes the dialog from the tree).
  useEffect(() => {
    return () => {
      if (pendingPhotoBlobUrlRef.current) {
        URL.revokeObjectURL(pendingPhotoBlobUrlRef.current)
        pendingPhotoBlobUrlRef.current = null
      }
    }
  }, [])

  // ---- Photo picker handlers ----
  //
  // onPick handles both modes:
  //   - Edit: resize → uploadPersonPhoto immediately. On success, switch
  //     the preview to the returned server URL and drop the local Blob.
  //   - Create: resize → stash the Blob in pendingPhotoRef. The submit
  //     handler flushes it after createPerson returns the new personId.
  //
  // Resetting fileInputRef.current.value to '' lets the user pick the same
  // file twice in a row (the native input dedupes by file path otherwise).
  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoError(null)

    let resized
    try {
      resized = await resizeToJpeg(file)
    } catch (err) {
      if (err instanceof ImageDecodeError) {
        setPhotoError('Please choose a JPEG or PNG photo.')
      } else {
        setPhotoError("Couldn't process the photo. Try a different one.")
      }
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    if (isEdit && person) {
      // Show the local preview immediately so the user sees feedback
      // while the upload is in-flight; we'll swap to the server URL on
      // success (or revert on failure).
      setPendingBlob(resized.blob)
      startTransition(async () => {
        const fd = new FormData()
        fd.append('file', resized.blob, 'avatar.jpg')
        const result = await uploadPersonPhoto(treeId, person.id, fd)
        if (result.ok) {
          // Server has the file + photo_url is updated. Drop the local
          // Blob and switch the preview to the server URL — this also
          // wins over person.photo_url for the rest of the form's life
          // (server `refresh()` will eventually update the prop too).
          clearPendingBlob()
          setLocalPhotoUrl(result.photoUrl)
        } else {
          // Revert the optimistic preview.
          clearPendingBlob()
          setPhotoError(result.error)
        }
      })
    } else {
      // Create mode: hold the Blob in memory until createPerson lands.
      setPendingBlob(resized.blob)
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Edit-mode "Remove photo" — clears the row's photo_url and deletes the
  // Storage file. Only renders when the row currently has a photo (i.e.
  // localPhotoUrl is a string OR person.photo_url is set and not yet
  // overridden by localPhotoUrl).
  const onRemovePhoto = () => {
    if (!isEdit || !person) return
    setPhotoError(null)
    startTransition(async () => {
      const result = await removePersonPhoto(treeId, person.id)
      if (result.ok) {
        // Override to null so the Avatar falls back to initials. The
        // server `refresh()` will also clear person.photo_url shortly.
        setLocalPhotoUrl(null)
        // Belt and braces — should already be null in edit mode.
        clearPendingBlob()
      } else {
        setPhotoError(result.error)
      }
    })
  }

  // Create-mode "Clear" — discard the in-memory Blob without contacting
  // the server (no person row exists yet).
  const onClearPendingPhoto = () => {
    setPhotoError(null)
    clearPendingBlob()
  }

  // Which photo controls to render. In edit mode "Remove" appears when a
  // photo is in play; in create mode "Clear" appears only while a Blob is
  // stashed.
  const editHasPhoto =
    isEdit && (localPhotoUrl !== undefined ? localPhotoUrl != null : Boolean(person?.photo_url))
  const createHasPending = !isEdit && previewObjectUrl != null

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

      const linkPayload: LinkSpecInput | undefined =
        showLinkPicker && linkSpec
          ? {
              relation: values.relation,
              focusPersonId: linkSpec.focusPersonId,
            }
          : undefined

      const result = await createPerson(treeId, payload, linkPayload)
      if (!result.ok) {
        setSubmitError(result.error)
        return
      }

      // Two-step create-then-photo flow. The row exists; if the photo
      // upload fails we surface an inline error but keep the row (the
      // user can re-attach via edit mode). Don't auto-delete — mirrors
      // the Phase 3 sub-task 5 "orphan-on-link-failure" ergonomics.
      if (pendingPhotoRef.current) {
        const fd = new FormData()
        fd.append('file', pendingPhotoRef.current, 'avatar.jpg')
        const photoResult = await uploadPersonPhoto(
          treeId,
          result.personId,
          fd,
        )
        clearPendingBlob()
        if (!photoResult.ok) {
          setSubmitError(
            `Person saved, but the photo didn't upload: ${photoResult.error}. Try editing this person to attach it.`,
          )
          // The row exists — still fire onSaved + dismiss so the parent
          // sees the new person on the tree.
          onSaved?.(result.personId)
          onOpenChange(false)
          return
        }
      }

      onSaved?.(result.personId)
      onOpenChange(false)
    })
  }

  const title = isEdit
    ? 'Edit person'
    : showLinkPicker && linkSpec
      ? `Add a relative of ${linkSpec.focusPersonName}`
      : 'Add a person'
  const description = isEdit
    ? 'Update the details below. Changes save when you submit.'
    : showLinkPicker
      ? 'Pick the relationship and fill in the new person’s details. The link saves with the person.'
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
      {/*
       * Sub-task 5 — relation radio. Render-gated by `showLinkPicker` so the
       * bare "+" FAB flow (no focus person) stays radio-free.
       *
       * Accessibility mirrors the tone-swatch below: role="radiogroup" on
       * the wrapper + role="radio" + aria-checked on each option. Each
       * button is independently tab-focusable; arrow-key handling is left
       * to a later polish pass (same trade-off the tone swatch makes).
       */}
      {showLinkPicker && linkSpec && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-foreground/50">
            Relationship
          </span>
          <Controller
            control={control}
            name="relation"
            render={({ field }) => (
              <div
                role="radiogroup"
                aria-label={`Relationship to ${linkSpec.focusPersonName}`}
                className="grid grid-cols-2 sm:grid-cols-4 gap-2"
              >
                {RELATION_OPTIONS.map((opt) => {
                  const selected = field.value === opt.value
                  const Icon = opt.icon
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => field.onChange(opt.value)}
                      className={`flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl border text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background ${
                        selected
                          ? 'border-primary bg-foreground/[0.04] text-foreground'
                          : 'border-border bg-card text-foreground hover:bg-foreground/[0.02]'
                      }`}
                    >
                      <Icon
                        aria-hidden="true"
                        className={`h-5 w-5 ${
                          selected ? 'text-foreground' : 'text-foreground/60'
                        }`}
                      />
                      <span>{opt.label}</span>
                    </button>
                  )
                })}
              </div>
            )}
          />
        </div>
      )}

      {/*
       * Phase 5 sub-task 3 — photo picker.
       *
       * Layout: 96-px circular avatar on the left, buttons stacked on the
       * right. Mirrors the heirloom-form chrome (border-border, rounded
       * buttons) without claiming any of the Phase 8 visual-polish budget
       * — sub-task 3 is functional only.
       *
       * Photo state lives outside react-hook-form by design (see hook
       * comments above). The hidden file input is the canonical way to
       * trigger the OS picker via a styled button; accept="" restricts to
       * JPEG/PNG (HEIC support deferred — locked decision 6 in the plan).
       */}
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">
          Photo <span className="text-foreground/40 font-normal">(optional)</span>
        </span>
        <div className="flex items-center gap-3 mt-1">
          <Avatar
            fullName={previewName}
            tone={previewTone}
            photoUrl={previewUrl}
            size={96}
          />
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={onPickPhoto}
              aria-hidden="true"
              tabIndex={-1}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isPending}
            >
              {previewUrl ? 'Change photo' : 'Add photo'}
            </Button>
            {editHasPhoto && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRemovePhoto}
                disabled={isPending}
                className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
              >
                Remove photo
              </Button>
            )}
            {createHasPending && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClearPendingPhoto}
                disabled={isPending}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
        {photoError && (
          <p className="text-xs text-destructive mt-1">{photoError}</p>
        )}
      </div>

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
            min={1000}
            max={currentYear}
            aria-invalid={errors.birth_year ? true : undefined}
            className={inputClass}
            {...register('birth_year', {
              validate: (v) => {
                if (!v) return true
                const n = Number(v)
                if (!Number.isFinite(n)) return 'Please enter a valid year.'
                if (n > currentYear) return 'Birth year cannot be in the future.'
                if (n < 1000) return 'Please enter a valid year.'
                return true
              },
            })}
          />
          {errors.birth_year && (
            <p className="text-xs text-destructive">{errors.birth_year.message}</p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="pf-birth-date" className="text-sm font-medium text-foreground">
            Birth date
          </label>
          <input
            id="pf-birth-date"
            type="date"
            max={todayISO}
            aria-invalid={errors.birth_date ? true : undefined}
            className={inputClass}
            {...register('birth_date', {
              validate: (v) => {
                if (!v) return true
                // ISO 'YYYY-MM-DD' strings compare lexically the same way
                // they compare chronologically, so a string compare is safe.
                if (v > todayISO) return 'Birth date cannot be in the future.'
                return true
              },
            })}
          />
          {errors.birth_date && (
            <p className="text-xs text-destructive">{errors.birth_date.message}</p>
          )}
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
              min={1000}
              max={currentYear}
              aria-invalid={errors.death_year ? true : undefined}
              className={inputClass}
              {...register('death_year', {
                validate: (v) => {
                  if (!v) return true
                  const n = Number(v)
                  if (!Number.isFinite(n)) return 'Please enter a valid year.'
                  if (n > currentYear) return 'Death year cannot be in the future.'
                  if (n < 1000) return 'Please enter a valid year.'
                  if (birthYear) {
                    const b = Number(birthYear)
                    if (Number.isFinite(b) && n < b) {
                      return 'Death year cannot be before birth year.'
                    }
                  }
                  return true
                },
              })}
            />
            {errors.death_year && (
              <p className="text-xs text-destructive">{errors.death_year.message}</p>
            )}
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
