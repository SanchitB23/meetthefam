'use client'

import { useActionState } from 'react'
import { deleteTree, type DeleteTreeState } from '../actions'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

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
          <p className="text-sm text-destructive">{state.error}</p>
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
