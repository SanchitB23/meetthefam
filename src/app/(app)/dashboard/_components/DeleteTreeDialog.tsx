'use client'

import { useActionState, useMemo } from 'react'
import { deleteTree, type DeleteTreeState } from '../actions'
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
import { useToastOnResult } from '@/lib/toast/useToastOnResult'

type Props = {
  treeId: string
  treeName: string
  open: boolean
  onClose: () => void
}

export function DeleteTreeDialog({ treeId, treeName, open, onClose }: Props) {
  async function action(
    prev: DeleteTreeState,
    formData: FormData,
  ): Promise<DeleteTreeState> {
    const result = await deleteTree(prev, formData)
    if (result?.success) onClose()
    return result
  }

  const [state, formAction, isPending] = useActionState(action, null)

  const toastMessages = useMemo(() => ({ success: `Deleted "${treeName}"` }), [treeName])
  useToastOnResult(state, toastMessages)

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            Delete &ldquo;{treeName}&rdquo;?
          </DialogTitle>
          <DialogDescription>
            This cannot be undone. All members will lose access and all data
            will be permanently removed.
          </DialogDescription>
        </DialogHeader>
        {state?.error && (
          <ErrorAlert size="sm" message={mapErrorCode(state.error, 'Something went wrong.')} />
        )}
        <form action={formAction} className="flex justify-end gap-2 mt-4">
          <input type="hidden" name="treeId" value={treeId} />
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
