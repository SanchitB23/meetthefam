'use client'

import { useState, useTransition } from 'react'
import {
  Copy,
  Check,
  RefreshCw,
  X,
  LoaderCircle,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/error-alert'
import { mapErrorCode } from '@/lib/errors'

import {
  enableShareLink,
  regenerateShareToken,
  disableShareLink,
} from '../share/actions'

// Same Tailwind chrome ShareLinkSheet uses for read-only URL inputs.
const inputClass =
  'border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary'

type Props = {
  treeId: string
  currentUserRole: 'owner' | 'editor'
  shareToken: string | null
  baseUrl: string
}

export function TreeSettingsVisitorsPanel({
  treeId,
  currentUserRole,
  shareToken,
  baseUrl,
}: Props) {
  const isOwner = currentUserRole === 'owner'

  // Local mirror of the token so we can show the freshly-minted URL
  // optimistically without waiting for the revalidatePath round-trip.
  const [localToken, setLocalToken] = useState<string | null>(shareToken)
  const currentToken = localToken ?? shareToken
  const currentUrl = currentToken ? `${baseUrl}/share/${currentToken}` : null
  // `isEnabled` derives from currentToken (not the raw prop) so that after
  // handleEnable mints a token into localToken, the manage UI renders
  // without waiting for the parent to re-fetch and pass a fresh shareToken.
  // The source ShareLinkSheet had the same `shareToken != null` check but
  // masked the staleness with its close/reopen lifecycle; the always-mounted
  // panel exposes it.
  const isEnabled = currentToken != null

  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmRegen, setConfirmRegen] = useState(false)
  const [confirmDisable, setConfirmDisable] = useState(false)

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
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
      } else {
        setError('Could not enable sharing. Please try again.')
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
      } else {
        setError('Could not regenerate token. Please try again.')
        setConfirmRegen(false)
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
      } else {
        setError('Could not disable sharing. Please try again.')
        setConfirmDisable(false)
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/*
        Outer container — note: deliberately drops the px-4 pb-4 spacing
        classes that ShareLinkSheet carried on this same div, for the same
        reason as TreeSettingsMembersPanel: the parent TreeSettingsSheet
        provides the inset.
      */}

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
}
