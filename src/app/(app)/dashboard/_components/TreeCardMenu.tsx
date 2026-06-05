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
import {
  getMembersAndInvites,
  type GetMembersAndInvitesResult,
} from '@/app/(app)/tree/[id]/members/actions'
import {
  TreeSettingsSheet,
  type MemberRow,
  type PendingInviteRow,
} from '@/app/(app)/tree/[id]/_components/TreeSettingsSheet'
import type { TreeRow } from './TreeCard'

type Props = { tree: TreeRow; baseUrl: string }

type MembersData = {
  currentUserId: string
  currentUserRole: 'owner' | 'editor'
  members: MemberRow[]
  pendingInvites: PendingInviteRow[]
}

export function TreeCardMenu({ tree, baseUrl }: Props) {
  const [open, setOpenState] = useState(false)
  const [data, setData] = useState<MembersData | null>(null)
  const [, startTransition] = useTransition()

  const handleOpen = () => {
    setOpenState(true)
    setData(null)
    startTransition(async () => {
      const res = (await getMembersAndInvites(
        tree.id,
      )) as GetMembersAndInvitesResult
      if (res.ok) {
        setData({
          currentUserId: res.currentUserId,
          currentUserRole: res.currentUserRole,
          members: res.members,
          pendingInvites: res.pendingInvites,
        })
      } else {
        setOpenState(false)
      }
    })
  }

  const loading = open && data === null

  return (
    <>
      <DropdownMenu>
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
          <DropdownMenuItem onClick={handleOpen}>Tree settings</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/*
        key={tree.id} is REQUIRED on the component boundary so all internal
        state (active tab, internal-open, form state) resets cleanly when
        the user switches between trees while the sheet is open. The
        component's JSDoc documents this contract.
      */}
      <TreeSettingsSheet
        key={tree.id}
        treeId={tree.id}
        treeName={tree.name}
        currentUserId={data?.currentUserId ?? ''}
        currentUserRole={data?.currentUserRole ?? 'owner'}
        members={data?.members ?? []}
        pendingInvites={data?.pendingInvites ?? []}
        shareToken={tree.share_token}
        baseUrl={baseUrl}
        open={open}
        onOpenChange={(next) => {
          setOpenState(next)
          if (!next) setData(null)
        }}
        loading={loading}
      />
    </>
  )
}
