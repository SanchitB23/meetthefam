'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()
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
          {/* Routes into the tree page with ?openMembers=1; the tree
              page reads the searchParam and passes `defaultOpen` to
              MembersSheet, which auto-opens + cleans the URL on mount.
              Single source of truth for member management lives on the
              tree page (your earlier brainstorm decision); this is just
              a deep-link convenience from the dashboard. */}
          <DropdownMenuItem onClick={() => router.push(`/tree/${tree.id}?openMembers=1`)}>
            Manage members
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
