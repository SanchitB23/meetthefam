'use client'

import { useActionState } from 'react'
import { renameTree, type RenameTreeState } from '../actions'
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
  currentName: string
  open: boolean
  onClose: () => void
}

export function RenameTreeModal({ treeId, currentName, open, onClose }: Props) {
  // Wrapper-action pattern (see CreateTreeModal). Closing the dialog inside
  // the action transition on success avoids a useEffect(setState) cascade.
  async function action(
    prev: RenameTreeState,
    formData: FormData,
  ): Promise<RenameTreeState> {
    const result = await renameTree(prev, formData)
    if (result?.success) onClose()
    return result
  }

  const [state, formAction, isPending] = useActionState(action, null)

  return (
    // key={treeId} remounts the dialog (and resets `state` + defaultValue)
    // whenever the menu is opened for a different tree.
    <Dialog key={treeId} open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Rename tree</DialogTitle>
          <DialogDescription>
            Pick a new display name. Members will see it the next time they
            refresh.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4 mt-2">
          <input type="hidden" name="treeId" value={treeId} />
          <div className="flex flex-col gap-1">
            <label
              htmlFor="rename-name"
              className="text-sm font-medium text-foreground"
            >
              New name <span className="text-destructive">*</span>
            </label>
            <input
              id="rename-name"
              name="name"
              type="text"
              required
              maxLength={80}
              defaultValue={currentName}
              className="border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <div className="flex justify-end gap-2 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
