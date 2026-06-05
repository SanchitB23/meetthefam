'use client'

// Phase 7 sub-task 2 — share-link toggle UI.
//
// Mirrors MembersSheet's structure:
//   - Sheet (bottom) on mobile, Dialog on desktop via `useIsDesktop`.
//   - Owner sees the full toggle/rotate/disable surface.
//   - Editor sees a read-only banner (sharing's enabled state is shared
//     information by design — transparency for editors).
//
// Two-click confirm pattern for Regenerate + Disable matches MembersSheet's
// MemberListRow.handleRevoke — `confirm*` state flips on first click; second
// click within ~3s commits. No timer-driven reset; the user clicks Cancel
// (or X) or re-clicks elsewhere on the form to dismiss.

import { useState, useTransition } from 'react'
import {
  Copy,
  Check,
  Share2,
  RefreshCw,
  X,
  LoaderCircle,
} from 'lucide-react'

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
import { Button } from '@/components/ui/button'
import { useIsDesktop } from '@/components/ui/use-is-desktop'
import { ErrorAlert } from '@/components/ui/error-alert'
import { mapErrorCode } from '@/lib/errors'

import {
  enableShareLink,
  regenerateShareToken,
  disableShareLink,
} from '../share/actions'
import { notify } from '@/lib/toast/notify'
import { copyWithToast } from '@/lib/toast/copyWithToast'

// Same Tailwind chrome MembersSheet uses for read-only URL inputs.
const inputClass =
  'border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary'

type Props = {
  treeId: string
  currentUserRole: 'owner' | 'editor'
  /** Current share_token from the tree row. Null = sharing disabled. */
  shareToken: string | null
  /** Origin to prepend to /share/<token> when building the copyable URL. */
  baseUrl: string
  /** Optional click target. When omitted, parent controls open via `open`/`onOpenChange`. */
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  defaultOpen?: boolean
}

export function ShareLinkSheet({
  treeId,
  currentUserRole,
  shareToken,
  baseUrl,
  trigger,
  open: openProp,
  onOpenChange,
  defaultOpen = false,
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
  const isEnabled = shareToken != null

  // Local mirror of the token so we can show the freshly-minted URL
  // optimistically without waiting for the revalidatePath round-trip.
  const [localToken, setLocalToken] = useState<string | null>(shareToken)
  const currentToken = localToken ?? shareToken
  const currentUrl = currentToken ? `${baseUrl}/share/${currentToken}` : null

  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmRegen, setConfirmRegen] = useState(false)
  const [confirmDisable, setConfirmDisable] = useState(false)

  const copyToClipboard = (url: string) => {
    copyWithToast(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleEnable = () => {
    setError(null)
    startTransition(async () => {
      const res = await enableShareLink(treeId)
      if (res.ok) {
        setLocalToken(res.shareToken)
        notify.success('Share link enabled')
      } else {
        if (res.error === 'forbidden') {
          window.dispatchEvent(new CustomEvent('mtf-access-lost'))
        } else {
          setError('Could not update sharing. Please try again.')
        }
      }
    })
  }

  const handleRegenerate = () => {
    if (!confirmRegen) {
      setConfirmRegen(true)
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await regenerateShareToken(treeId)
      if (res.ok) {
        setLocalToken(res.shareToken)
        setConfirmRegen(false)
        notify.warning('New link created — the old link no longer works')
      } else {
        setConfirmRegen(false)
        if (res.error === 'forbidden') {
          window.dispatchEvent(new CustomEvent('mtf-access-lost'))
        } else {
          setError('Could not update sharing. Please try again.')
        }
      }
    })
  }

  const handleDisable = () => {
    if (!confirmDisable) {
      setConfirmDisable(true)
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await disableShareLink(treeId)
      if (res.ok) {
        setLocalToken(null)
        setConfirmDisable(false)
        notify.success('Share link disabled')
      } else {
        setConfirmDisable(false)
        if (res.error === 'forbidden') {
          window.dispatchEvent(new CustomEvent('mtf-access-lost'))
        } else {
          setError('Could not update sharing. Please try again.')
        }
      }
    })
  }

  // ---- Body for each state ----
  const body = (
    <div className="flex flex-col gap-4 px-4 pb-4 sm:px-0 sm:pb-0 sm:mt-2">
      {!isOwner && (
        <p className="text-sm text-foreground/70">
          {isEnabled
            ? 'This tree is shared via a read-only link. Only the owner can manage the link.'
            : 'This tree is not shared. Only the owner can enable sharing.'}
        </p>
      )}

      {isOwner && !isEnabled && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-foreground/80">
            Generate a read-only URL anyone can open to see this tree. You can rotate or disable it at any time.
          </p>
          <Button
            type="button"
            disabled={isPending}
            onClick={handleEnable}
          >
            {isPending ? (
              <span className="inline-flex items-center gap-1.5">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Enabling…
              </span>
            ) : (
              'Enable read-only share link'
            )}
          </Button>
        </div>
      )}

      {isOwner && isEnabled && currentUrl && (
        <>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-foreground">
              Share this URL with anyone you want to view the tree:
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={currentUrl}
                className={`${inputClass} flex-1 min-w-0 cursor-text`}
                onFocus={(e) => e.target.select()}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(currentUrl)}
                aria-label="Copy share link"
              >
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-3 border-t border-border">
            <h3 className="text-sm font-semibold text-foreground">Manage</h3>

            {/* Regenerate */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                {confirmRegen ? (
                  <>
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      disabled={isPending}
                      onClick={handleRegenerate}
                      className="text-xs h-7"
                    >
                      {isPending ? 'Rotating…' : 'Confirm regenerate'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={isPending}
                      onClick={() => setConfirmRegen(false)}
                      aria-label="Cancel regenerate"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                    <p className="text-xs text-foreground/60">
                      This will break the current URL immediately.
                    </p>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={handleRegenerate}
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Regenerate
                  </Button>
                )}
              </div>
            </div>

            {/* Disable */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                {confirmDisable ? (
                  <>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={isPending}
                      onClick={handleDisable}
                      className="text-xs h-7"
                    >
                      {isPending ? 'Disabling…' : 'Confirm disable'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={isPending}
                      onClick={() => setConfirmDisable(false)}
                      aria-label="Cancel disable"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                    <p className="text-xs text-foreground/60">
                      The URL will stop working immediately.
                    </p>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={handleDisable}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    Disable sharing
                  </Button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {error && (
        <ErrorAlert size="sm" message={mapErrorCode(error, error)} />
      )}
    </div>
  )

  const title = 'Share link'
  const description = isOwner
    ? 'Generate or manage a read-only public URL for this tree.'
    : 'View whether this tree is shared publicly.'

  const surface = desktop ? (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl flex items-center gap-2">
            <Share2 className="h-5 w-5" />
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
            <Share2 className="h-5 w-5" />
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
          aria-label="Share link"
          className="contents"
        >
          {trigger}
        </span>
      )}
      {surface}
    </>
  )
}
