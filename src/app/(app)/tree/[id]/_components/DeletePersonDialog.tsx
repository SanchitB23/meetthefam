'use client'

import { useState, useTransition } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/error-alert'
import { mapErrorCode } from '@/lib/errors'
import { notify } from '@/lib/toast/notify'

import { deletePerson } from '../actions'

// Mirrors `src/app/dashboard/_components/DeleteTreeDialog.tsx` but the
// underlying action returns an `{ ok, error }` discriminated union (matching
// `createPerson` / `updatePerson`) rather than the Phase-2 `useActionState`
// shape. We therefore use `useTransition` + manual error state instead of
// `useActionState` — same pattern PersonForm itself uses for its submit.

type Props = {
  personId: string
  personName: string
  treeId: string
  open: boolean
  onClose: () => void
  /** Fired after a successful delete; the parent form dismisses itself. */
  onDeleted?: () => void
}

export function DeletePersonDialog({
  personId,
  personName,
  treeId,
  open,
  onClose,
  onDeleted,
}: Props) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    setError(null)
    startTransition(async () => {
      const result = await deletePerson(personId, treeId)
      if (!result.ok) {
        setError(result.error)
        return
      }
      notify.success(`Deleted ${personName}`)
      onDeleted?.()
      onClose()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !isPending) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            Delete &ldquo;{personName}&rdquo;?
          </DialogTitle>
          <DialogDescription>
            This will remove them from the family tree. Any relatives linked
            to them will be unlinked.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <ErrorAlert size="sm" message={mapErrorCode(error, error)} />
        )}
        <div className="flex justify-end gap-2 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
