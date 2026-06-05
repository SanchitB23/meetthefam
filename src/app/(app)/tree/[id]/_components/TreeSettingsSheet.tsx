'use client'

import { useState } from 'react'
import { Settings } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useIsDesktop } from '@/components/ui/use-is-desktop'
import { TreeSettingsGeneralPanel } from './TreeSettingsGeneralPanel'
import { TreeSettingsMembersPanel, type MemberRow, type PendingInviteRow } from './TreeSettingsMembersPanel'
import { TreeSettingsVisitorsPanel } from './TreeSettingsVisitorsPanel'

type Role = 'owner' | 'editor'
type TabId = 'general' | 'members' | 'visitors'

type Props = {
  treeId: string
  treeName: string
  currentUserId: string
  currentUserRole: Role
  members: MemberRow[]
  pendingInvites: PendingInviteRow[]
  shareToken: string | null
  baseUrl: string
  /** Optional trigger for uncontrolled mode (tree-page mount). */
  trigger?: React.ReactNode
  /** Controlled-mode open state (dashboard mount). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  defaultOpen?: boolean
  /** Lazy-load skeleton flag, mirrors MembersSheet — dashboard fetch in flight. */
  loading?: boolean
}

/**
 * Unified Tree settings affordance — Rename / Members / Delete / Visitors,
 * dual-mounted on the dashboard 3-dots and the tree-page top bar.
 *
 * **Call-site contract:** mount this component with `key={treeId}` so all
 * internal state (active tab, form state, internal-open) resets cleanly
 * when the user switches between trees while the sheet is open:
 *
 * ```tsx
 * <TreeSettingsSheet key={tree.id} treeId={tree.id} … />
 * ```
 *
 * Without the call-site key, switching from tree A (owner) to tree B
 * (editor) without closing the sheet would leave `activeTab='general'`
 * even though editors don't have a General tab.
 */
export function TreeSettingsSheet({
  treeId,
  treeName,
  currentUserId,
  currentUserRole,
  members,
  pendingInvites,
  shareToken,
  baseUrl,
  trigger,
  open: openProp,
  onOpenChange,
  defaultOpen = false,
  loading = false,
}: Props) {
  const desktop = useIsDesktop()
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : internalOpen
  const setOpen = (next: boolean) => {
    if (isControlled) onOpenChange?.(next)
    else setInternalOpen(next)
  }

  const isOwner = currentUserRole === 'owner'
  const defaultTab: TabId = isOwner ? 'general' : 'members'
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab)

  const title = 'Tree settings'
  const description = isOwner
    ? `Manage ${treeName}.`
    : `Settings for ${treeName}.`

  const body = (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as TabId)}
      className="flex flex-col gap-4"
    >
      <TabsList>
        {isOwner && <TabsTrigger value="general">General</TabsTrigger>}
        <TabsTrigger value="members">Members</TabsTrigger>
        <TabsTrigger value="visitors">Visitors</TabsTrigger>
      </TabsList>

      {isOwner && (
        <TabsContent value="general">
          <TreeSettingsGeneralPanel
            treeId={treeId}
            treeName={treeName}
            onAfterDelete={() => setOpen(false)}
          />
        </TabsContent>
      )}
      <TabsContent value="members">
        <TreeSettingsMembersPanel
          treeId={treeId}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          members={members}
          pendingInvites={pendingInvites}
          loading={loading}
        />
      </TabsContent>
      <TabsContent value="visitors">
        <TreeSettingsVisitorsPanel
          treeId={treeId}
          currentUserRole={currentUserRole}
          shareToken={shareToken}
          baseUrl={baseUrl}
        />
      </TabsContent>
    </Tabs>
  )

  const surface = desktop ? (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          {body}
        </div>
      </DialogContent>
    </Dialog>
  ) : (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="bottom"
        className="max-h-[90vh] overflow-y-auto rounded-t-xl"
      >
        <SheetHeader>
          <SheetTitle className="font-serif text-xl flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {title}
          </SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {body}
      </SheetContent>
    </Sheet>
  )

  return (
    <>
      {trigger && (
        <span
          role="button"
          tabIndex={0}
          onClick={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setOpen(true)
            }
          }}
          aria-label="Tree settings"
          className="contents"
        >
          {trigger}
        </span>
      )}
      {surface}
    </>
  )
}
