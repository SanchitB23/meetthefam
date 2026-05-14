'use client'

import { useState, useTransition } from 'react'
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
import { MembersSheet, type MemberRow, type PendingInviteRow } from '@/app/tree/[id]/_components/MembersSheet'
import {
  getMembersAndInvites,
  type GetMembersAndInvitesResult,
} from '@/app/tree/[id]/members/actions'
import type { TreeRow } from './TreeCard'

type Props = { tree: TreeRow }

type MembersData = {
  currentUserId: string
  currentUserRole: 'owner' | 'editor'
  members: MemberRow[]
  pendingInvites: PendingInviteRow[]
}

export function TreeCardMenu({ tree }: Props) {
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [managing, setManaging] = useState(false)
  const [data, setData] = useState<MembersData | null>(null)
  const [, startTransition] = useTransition()

  // Open the MembersSheet IN the dashboard — no navigation to /tree/<id>.
  // The Server Action fetches members + pendingInvites lazily; the sheet
  // opens immediately with a loading skeleton, then swaps to real data
  // once the action returns. Single source of truth still lives in
  // `<MembersSheet>` — this is just a second mount point.
  const handleManageMembers = () => {
    setManaging(true)
    setData(null)
    startTransition(async () => {
      const res = (await getMembersAndInvites(tree.id)) as GetMembersAndInvitesResult
      if (res.ok) {
        setData({
          currentUserId: res.currentUserId,
          currentUserRole: res.currentUserRole,
          members: res.members,
          pendingInvites: res.pendingInvites,
        })
      } else {
        // Surface as a closed sheet with a TODO comment — Phase 8 polish
        // could render an inline error card. For now, RLS / not-signed-in
        // are unreachable from this code path (menu is owner-gated).
        setManaging(false)
      }
    })
  }

  const loading = managing && data === null

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
          <DropdownMenuItem onClick={handleManageMembers}>
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
      {/* Controlled-mode MembersSheet — no internal trigger; the
          parent (this component) owns open-state. The TreeCardMenu
          itself is owner-only-gated by the dashboard (m.role === 'owner'),
          so the role passed here is always 'owner' once data lands.
          During loading we pass owner + empty arrays as placeholders;
          the `loading` prop swaps the body to a spinner skeleton. */}
      <MembersSheet
        treeId={tree.id}
        currentUserId={data?.currentUserId ?? ''}
        currentUserRole={data?.currentUserRole ?? 'owner'}
        members={data?.members ?? []}
        pendingInvites={data?.pendingInvites ?? []}
        open={managing}
        onOpenChange={(next) => {
          setManaging(next)
          if (!next) setData(null)
        }}
        loading={loading}
      />
    </>
  )
}
