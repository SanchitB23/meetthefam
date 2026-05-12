'use client'

import { useState } from 'react'
import { Ellipsis } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { RenameTreeModal } from './RenameTreeModal'
import { DeleteTreeDialog } from './DeleteTreeDialog'
import type { TreeRow } from './TreeCard'

type Props = { tree: TreeRow }

export function TreeCardMenu({ tree }: Props) {
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  return (
    <>
      <DropdownMenu>
        {/* Base UI Menu.Trigger uses `render`, not `asChild`. */}
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Tree actions"
            >
              <Ellipsis className="h-4 w-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          {/* Base UI MenuItem uses `onClick` (not `onSelect`). The menu
              auto-closes on click by default (`closeOnClick` defaults true). */}
          <DropdownMenuItem onClick={() => setRenaming(true)}>
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleting(true)}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RenameTreeModal
        treeId={tree.id}
        currentName={tree.name}
        open={renaming}
        onClose={() => setRenaming(false)}
      />
      <DeleteTreeDialog
        treeId={tree.id}
        treeName={tree.name}
        open={deleting}
        onClose={() => setDeleting(false)}
      />
    </>
  )
}
