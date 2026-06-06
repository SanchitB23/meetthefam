'use client'

import { useState, useActionState } from 'react'
import { Check, X } from 'lucide-react'

import {
  renameTree,
  type RenameTreeState,
  deleteTree,
  type DeleteTreeState,
} from '@/app/(app)/dashboard/actions'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/error-alert'
import { mapErrorCode } from '@/lib/errors'

type Props = {
  treeId: string
  treeName: string
  onAfterDelete?: () => void
}

export function TreeSettingsGeneralPanel({
  treeId,
  treeName,
  onAfterDelete,
}: Props) {
  // -- Rename ---------------------------------------------------------------
  async function renameAction(
    prev: RenameTreeState,
    formData: FormData,
  ): Promise<RenameTreeState> {
    return renameTree(prev, formData)
  }
  const [renameState, renameFormAction, renamePending] = useActionState(
    renameAction,
    null,
  )

  // -- Delete (two-step confirm mirrors MemberListRow.handleRevoke) ---------
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function deleteAction(
    prev: DeleteTreeState,
    formData: FormData,
  ): Promise<DeleteTreeState> {
    const result = await deleteTree(prev, formData)
    if (result?.success) onAfterDelete?.()
    return result
  }
  const [deleteState, deleteFormAction, deletePending] = useActionState(
    deleteAction,
    null,
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Rename ------------------------------------------------------ */}
      <form action={renameFormAction} className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">Name</h3>
        <input type="hidden" name="treeId" value={treeId} />
        <div className="flex flex-col gap-1">
          <label
            htmlFor="rename-name"
            className="text-sm font-medium text-foreground"
          >
            Display name <span className="text-destructive">*</span>
          </label>
          <input
            id="rename-name"
            name="name"
            type="text"
            required
            maxLength={80}
            defaultValue={treeName}
            className="border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        {renameState?.error && (
          <ErrorAlert
            size="sm"
            message={mapErrorCode(renameState.error, 'Something went wrong.')}
          />
        )}
        {renameState?.success && (
          <p className="text-xs text-foreground/70 flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-green-600" />
            Tree name saved.
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={renamePending}>
            {renamePending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>

      {/* Danger zone -------------------------------------------------- */}
      <div className="flex flex-col gap-3 pt-4 border-t border-destructive/30">
        <h3 className="text-sm font-semibold text-destructive">Danger zone</h3>
        <p className="text-sm text-muted-foreground">
          Deleting &ldquo;{treeName}&rdquo; cannot be undone. All members will
          lose access and all data will be permanently removed.
        </p>
        {deleteState?.error && (
          <ErrorAlert
            size="sm"
            message={mapErrorCode(deleteState.error, 'Something went wrong.')}
          />
        )}
        {confirmDelete && (
          <p className="text-sm text-muted-foreground">
            This action is permanent. Are you sure?
          </p>
        )}
        <form action={deleteFormAction} className="flex justify-end gap-2">
          <input type="hidden" name="treeId" value={treeId} />
          {confirmDelete ? (
            <>
              <Button
                type="submit"
                variant="destructive"
                disabled={deletePending}
              >
                {deletePending ? 'Deleting…' : 'Confirm'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={deletePending}
                onClick={() => setConfirmDelete(false)}
                aria-label="Cancel delete"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled={deletePending}
              className="border-destructive text-destructive hover:bg-destructive/10"
              onClick={() => setConfirmDelete(true)}
            >
              Delete tree
            </Button>
          )}
        </form>
      </div>
    </div>
  )
}
