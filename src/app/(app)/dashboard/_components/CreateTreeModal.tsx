'use client'

import { useActionState, useState } from 'react'
import { createTree, type CreateTreeState } from '../actions'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export function CreateTreeModal() {
  const [open, setOpen] = useState(false)

  // Wrap the action so we can close the dialog the same tick the
  // success state lands — avoids the "setState inside useEffect"
  // cascading-render anti-pattern that ESLint's react-hooks rule flags.
  async function action(
    prev: CreateTreeState,
    formData: FormData,
  ): Promise<CreateTreeState> {
    const result = await createTree(prev, formData)
    if (result?.success) setOpen(false)
    return result
  }

  const [state, formAction, isPending] = useActionState(action, null)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">+ New tree</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            Create a new tree
          </DialogTitle>
          <DialogDescription>
            Trees are private until you invite editors or share a read-only link.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="create-name"
              className="text-sm font-medium text-foreground"
            >
              Name <span className="text-destructive">*</span>
            </label>
            <input
              id="create-name"
              name="name"
              type="text"
              required
              maxLength={80}
              placeholder="Smith Family"
              className="border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="create-description"
              className="text-sm font-medium text-foreground"
            >
              Description{' '}
              <span className="text-foreground/40 font-normal">(optional)</span>
            </label>
            <textarea
              id="create-description"
              name="description"
              maxLength={500}
              rows={3}
              placeholder="Our family tree, four generations"
              className="border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>
          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <div className="flex justify-end gap-2 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating…' : 'Create tree'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
