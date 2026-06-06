'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import {
  RotateCcw,
  Trash2,
  X,
  Copy,
  Check,
  LoaderCircle,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { ErrorAlert } from '@/components/ui/error-alert'
import { mapErrorCode } from '@/lib/errors'

import {
  inviteEditor,
  revokeInvite,
  resendInvite,
  revokeMember,
} from '../members/actions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MemberRow = {
  user_id: string
  display_name: string | null
  avatar_url: string | null
  role: 'owner' | 'editor'
  joined_at: string
}

export type PendingInviteRow = {
  id: string
  email: string
  created_at: string
  expires_at: string
  token: string
}

// ---------------------------------------------------------------------------
// Relative time helper — no extra deps; built on Intl.RelativeTimeFormat
// ---------------------------------------------------------------------------

function relativeTime(isoString: string): string {
  const now = Date.now()
  const then = new Date(isoString).getTime()
  const diffMs = then - now
  const diffSecs = Math.round(diffMs / 1000)
  const diffMins = Math.round(diffSecs / 60)
  const diffHrs = Math.round(diffMins / 60)
  const diffDays = Math.round(diffHrs / 24)
  const diffWeeks = Math.round(diffDays / 7)
  const diffMonths = Math.round(diffDays / 30)
  const diffYears = Math.round(diffDays / 365)

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

  const absSeconds = Math.abs(diffSecs)
  if (absSeconds < 60) return rtf.format(diffSecs, 'second')
  const absMins = Math.abs(diffMins)
  if (absMins < 60) return rtf.format(diffMins, 'minute')
  const absHrs = Math.abs(diffHrs)
  if (absHrs < 24) return rtf.format(diffHrs, 'hour')
  const absDays = Math.abs(diffDays)
  if (absDays < 7) return rtf.format(diffDays, 'day')
  const absWeeks = Math.abs(diffWeeks)
  if (absWeeks < 5) return rtf.format(diffWeeks, 'week')
  const absMonths = Math.abs(diffMonths)
  if (absMonths < 12) return rtf.format(diffMonths, 'month')
  return rtf.format(diffYears, 'year')
}

/** Remaining calendar days until `expires_at` (floored, minimum 0). */
function daysUntil(isoString: string): number {
  const diff = new Date(isoString).getTime() - Date.now()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

// ---------------------------------------------------------------------------
// Input style mirrors PersonForm / SetParentsDialog chrome
// ---------------------------------------------------------------------------

const inputClass =
  'border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary'

// ---------------------------------------------------------------------------
// InviteForm — owner-only bottom section
// ---------------------------------------------------------------------------

type InviteFormValues = { email: string }

type InviteResult =
  | { status: 'success'; inviteUrl: string }
  | { status: 'already_invited'; inviteUrl?: string }
  | { status: 'error'; message: string }

function InviteForm({ treeId }: { treeId: string }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteFormValues>({ defaultValues: { email: '' } })

  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<InviteResult | null>(null)
  const [copied, setCopied] = useState(false)

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const onSubmit = (values: InviteFormValues) => {
    setResult(null)
    setCopied(false)
    startTransition(async () => {
      const res = await inviteEditor(treeId, values.email)
      if (res.ok) {
        setResult({ status: 'success', inviteUrl: res.inviteUrl })
        reset()
      } else if (res.error === 'already_invited') {
        setResult({ status: 'already_invited', inviteUrl: res.inviteUrl })
      } else if (res.error === 'invalid_email') {
        setResult({ status: 'error', message: 'Please enter a valid email address.' })
      } else if (res.error === 'not_signed_in') {
        setResult({ status: 'error', message: 'You must be signed in to invite editors.' })
      } else {
        setResult({ status: 'error', message: 'Something went wrong. Please try again.' })
      }
    })
  }

  return (
    <div className="flex flex-col gap-3 pt-4 border-t border-border">
      <h3 className="text-sm font-semibold text-foreground">Invite an editor</h3>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="email"
            placeholder="editor@example.com"
            aria-invalid={errors.email ? true : undefined}
            className={`${inputClass} flex-1 min-w-0`}
            {...register('email', {
              required: 'Email is required',
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Please enter a valid email address',
              },
            })}
          />
          <Button type="submit" disabled={isPending} size="default">
            {isPending ? 'Sending…' : 'Invite'}
          </Button>
        </div>
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </form>

      {result?.status === 'success' && (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/50 p-3">
          <p className="text-sm text-foreground">
            Invite created! Share this link with the person:
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={result.inviteUrl}
              className={`${inputClass} flex-1 min-w-0 cursor-text`}
              onFocus={(e) => e.target.select()}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(result.inviteUrl)}
              aria-label="Copy invite link"
            >
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      {result?.status === 'already_invited' && (
        <div className="flex flex-col gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-800">
            This email already has a pending invite.
          </p>
          {result.inviteUrl && (
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={result.inviteUrl}
                className={`${inputClass} flex-1 min-w-0 cursor-text`}
                onFocus={(e) => e.target.select()}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(result.inviteUrl!)}
                aria-label="Copy invite link"
              >
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </div>
      )}

      {result?.status === 'error' && (
        <ErrorAlert size="sm" message={mapErrorCode(result.message, result.message)} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// MemberRow component
// ---------------------------------------------------------------------------

function MemberListRow({
  member,
  treeId,
  currentUserId,
  isOwner,
}: {
  member: MemberRow
  treeId: string
  currentUserId: string
  isOwner: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSelf = member.user_id === currentUserId
  const canRevoke = isOwner && !isSelf && member.role === 'editor'

  const handleRevoke = () => {
    if (!confirmRevoke) {
      setConfirmRevoke(true)
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await revokeMember(treeId, member.user_id)
      if (!res.ok) {
        setError('Could not revoke member. Please try again.')
        setConfirmRevoke(false)
      }
      // On success: revalidatePath in the action will refresh the page data,
      // which will re-render the Server Component and pass fresh members.
    })
  }

  const displayName = member.display_name ?? member.user_id.slice(0, 8)

  return (
    <div className="py-2">
      <div className="flex items-center gap-3">
      <Avatar
        fullName={displayName}
        photoUrl={member.avatar_url}
        tone="sage"
        size={36}
      />
      <div className="flex flex-1 flex-col min-w-0">
        <span className="truncate text-sm text-foreground font-medium">
          {displayName}
          {isSelf && (
            <span className="ml-1.5 text-xs text-foreground/50 font-normal">(you)</span>
          )}
        </span>
        <span className="text-xs text-foreground/50">
          Joined {relativeTime(member.joined_at)}
        </span>
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
          member.role === 'owner'
            ? 'bg-primary/10 text-primary'
            : 'bg-muted text-foreground/70'
        }`}
      >
        {member.role}
      </span>
      {canRevoke && (
        <div className="flex items-center gap-1">
          {confirmRevoke ? (
            <>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={isPending}
                onClick={handleRevoke}
                className="text-xs h-7"
              >
                {isPending ? 'Revoking…' : 'Confirm'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={isPending}
                onClick={() => setConfirmRevoke(false)}
                aria-label="Cancel revoke"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={isPending}
              onClick={handleRevoke}
              aria-label={`Remove ${displayName}`}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
      </div>
      {confirmRevoke && (
        <p className="mt-2 text-sm text-muted-foreground">
          {displayName} will lose access. The people they added stay in your tree.
        </p>
      )}
      {error && (
        <ErrorAlert size="sm" message={mapErrorCode(error, error)} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PendingInviteRow component
// ---------------------------------------------------------------------------

function PendingInviteListRow({
  invite,
}: {
  invite: PendingInviteRow
}) {
  const [isPending, startTransition] = useTransition()
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [revoked, setRevoked] = useState(false)
  const [resendUrl, setResendUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleResend = () => {
    setError(null)
    startTransition(async () => {
      const res = await resendInvite(invite.id)
      if (res.ok) {
        setResendUrl(res.inviteUrl)
      } else {
        setError('Could not resend invite. Please try again.')
      }
    })
  }

  const handleRevoke = () => {
    if (!confirmRevoke) {
      setConfirmRevoke(true)
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await revokeInvite(invite.id)
      if (res.ok) {
        setRevoked(true)
      } else {
        setError('Could not revoke invite. Please try again.')
        setConfirmRevoke(false)
      }
    })
  }

  if (revoked) return null

  const expiresInDays = daysUntil(invite.expires_at)

  return (
    <div className="flex flex-col gap-1 py-2">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 flex-col min-w-0">
          <span className="truncate text-sm text-foreground">{invite.email}</span>
          <span className="text-xs text-foreground/50">
            Sent {relativeTime(invite.created_at)} ·{' '}
            {expiresInDays === 0
              ? 'Expires today'
              : `Expires in ${expiresInDays} day${expiresInDays === 1 ? '' : 's'}`}
          </span>
        </div>
        {/* Resend button */}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={isPending}
          onClick={handleResend}
          aria-label={`Resend invite to ${invite.email}`}
          title="Resend (generates a new link)"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
        {/* Revoke button / confirm */}
        {confirmRevoke ? (
          <>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isPending}
              onClick={handleRevoke}
              className="text-xs h-7"
            >
              {isPending ? 'Revoking…' : 'Confirm'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={isPending}
              onClick={() => setConfirmRevoke(false)}
              aria-label="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={isPending}
            onClick={handleRevoke}
            aria-label={`Revoke invite to ${invite.email}`}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* After resend: show new URL inline */}
      {resendUrl && (
        <div className="flex gap-2 mt-1">
          <input
            type="text"
            readOnly
            value={resendUrl}
            className={`${inputClass} flex-1 min-w-0 cursor-text text-xs py-1`}
            onFocus={(e) => e.target.select()}
          />
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => copyToClipboard(resendUrl)}
            aria-label="Copy new invite link"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      )}

      {error && (
        <ErrorAlert size="sm" message={mapErrorCode(error, error)} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TreeSettingsMembersPanel (main export)
// ---------------------------------------------------------------------------

type Props = {
  treeId: string
  currentUserId: string
  currentUserRole: 'owner' | 'editor'
  members: MemberRow[]
  pendingInvites: PendingInviteRow[]
  loading?: boolean
}

export function TreeSettingsMembersPanel({
  treeId,
  currentUserId,
  currentUserRole,
  members,
  pendingInvites,
  loading = false,
}: Props) {
  const isOwner = currentUserRole === 'owner'

  if (loading) {
    return (
      <>
        {/*
          Loading skeleton — same note as the non-loading branch below: the outer
          px-4/pb-4 spacing classes from MembersSheet are intentionally dropped
          because the parent sheet provides the inset.
        */}
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-foreground/50">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading members…
        </div>
      </>
    )
  }

  return (
    <>
      {/*
        Outer container — note: deliberately drops the px-4 pb-4 sm:px-0 sm:pb-0 sm:mt-2
        classes that MembersSheet carried on this same div. Those existed to absorb
        the inner-Dialog/Sheet chrome padding; here the parent TreeSettingsSheet
        provides the inset, so the panel stays padding-free.
      */}
      <div className="flex flex-col gap-4 overflow-y-auto">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-semibold text-foreground">Members</h3>
        <div className="divide-y divide-border">
          {members.map((m) => (
            <MemberListRow
              key={m.user_id}
              member={m}
              treeId={treeId}
              currentUserId={currentUserId}
              isOwner={isOwner}
            />
          ))}
        </div>
      </div>

      {isOwner && pendingInvites.length > 0 && (
        <div className="flex flex-col gap-0.5 pt-3 border-t border-border">
          <h3 className="text-sm font-semibold text-foreground">Pending invites</h3>
          <div className="divide-y divide-border">
            {pendingInvites.map((inv) => (
              <PendingInviteListRow key={inv.id} invite={inv} />
            ))}
          </div>
        </div>
      )}

      {isOwner && <InviteForm treeId={treeId} />}
    </div>
    </>
  )
}
