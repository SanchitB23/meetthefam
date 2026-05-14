'use server'

import { createClient } from '@/lib/supabase/server'
import { sendInviteEmail } from '@/lib/email/inviteEmail'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { randomBytes } from 'crypto'

// ---------------------------------------------------------------------------
// baseUrl helper — mirrors `getOrigin()` in `src/app/login/actions.ts` so
// invite URLs are constructed with the same request-derived origin.  Falls
// back to localhost for `pnpm test` environments that never have an HTTP
// request in flight.
// ---------------------------------------------------------------------------
async function getBaseUrl(): Promise<string> {
  const headersList = await headers()
  return headersList.get('origin') ?? 'http://localhost:3000'
}

// ---------------------------------------------------------------------------
// Token helper — Node 18+ `crypto.randomBytes(32).toString('base64url')`
// returns 43 URL-safe chars with no `=`, `+`, or `/` to strip.  The
// `base64url` encoding variant is built into Node and avoids the
// SQL-side `encode(gen_random_bytes(32), 'base64')` + character-strip
// approach mentioned in earlier notes.
// ---------------------------------------------------------------------------
function mintToken(): string {
  return randomBytes(32).toString('base64url')
}

// ---------------------------------------------------------------------------
// RFC-5322-shaped email validation — permissive but blocks obvious garbage.
// The DB trigger will lowercase regardless; this guard runs before the insert.
// ---------------------------------------------------------------------------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email)
}

// ============================================================================
// inviteEditor
// ============================================================================

export type InviteEditorResult =
  | { ok: true; inviteId: string; inviteUrl: string; error?: never }
  | { ok: false; error: string; inviteUrl?: string; inviteId?: never }

/**
 * Owner-only. Validates the email, mints a 32-byte URL-safe token, inserts a
 * `tree_invites` row, and fires the flag-gated `sendInviteEmail` stub.
 *
 * On a `23505` unique-index violation (`tree_invites_open_per_email`) the
 * action looks up the existing OPEN invite for that (tree, email) and returns
 * `{ ok: false, error: 'already_invited', inviteUrl }` so the owner can
 * copy-paste the existing link rather than generating a dead second one.
 */
export async function inviteEditor(
  treeId: string,
  email: string,
): Promise<InviteEditorResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'not_signed_in' }

  const trimmedEmail = email.trim()
  if (!isValidEmail(trimmedEmail)) {
    return { ok: false, error: 'invalid_email' }
  }

  // Lowercase before the duplicate-check fetch so we match the partial unique
  // index's `lower(email)` expression byte-for-byte.
  const lowerEmail = trimmedEmail.toLowerCase()

  const token = mintToken()
  const baseUrl = await getBaseUrl()
  const inviteUrl = `${baseUrl}/invite/${token}`

  // Fetch tree name + inviter display name for the email stub (real values so
  // the call site is correct when the MEETTHEFAM_EMAIL_INVITES_ENABLED flag
  // is flipped on later).
  const [{ data: tree }, { data: profile }] = await Promise.all([
    supabase.from('trees').select('name').eq('id', treeId).single(),
    supabase
      .from('profiles')
      .select('display_name, email')
      .eq('id', user.id)
      .single(),
  ])

  const treeName = tree?.name ?? 'your family tree'
  const invitedByName =
    (profile as { display_name: string | null; email: string | null } | null)
      ?.display_name ??
    (profile as { display_name: string | null; email: string | null } | null)
      ?.email ??
    user.email ??
    'the tree owner'

  const { data: invite, error: insertError } = await supabase
    .from('tree_invites')
    .insert({
      tree_id: treeId,
      email: lowerEmail, // trigger will lowercase again; no harm
      token,
      invited_by: user.id,
    })
    .select('id')
    .single()

  if (insertError) {
    // Postgres unique-index violation on `tree_invites_open_per_email`.
    if (insertError.code === '23505') {
      // Look up the existing open invite for this (tree, email) so the owner
      // can copy-paste the pre-existing URL.
      const { data: existing } = await supabase
        .from('tree_invites')
        .select('token')
        .eq('tree_id', treeId)
        .eq('email', lowerEmail)
        .is('accepted_at', null)
        .is('revoked_at', null)
        .single()

      const existingUrl = existing?.token
        ? `${baseUrl}/invite/${existing.token}`
        : undefined

      return { ok: false, error: 'already_invited', inviteUrl: existingUrl }
    }

    console.error('inviteEditor: insert failed', insertError)
    return { ok: false, error: 'unknown' }
  }

  // Fire the flag-gated email stub (no-op in v0.2.0).
  await sendInviteEmail({
    email: lowerEmail,
    inviteUrl,
    treeName,
    invitedByName,
  })

  revalidatePath('/tree/' + treeId)
  return { ok: true, inviteId: invite.id, inviteUrl }
}

// ============================================================================
// revokeInvite
// ============================================================================

export type RevokeInviteResult =
  | { ok: true; error?: never }
  | { ok: false; error: string }

/**
 * Owner-only. Sets `revoked_at = now()` on the invite row.  The RLS UPDATE
 * policy `tree_invites_update_owner` ensures only the tree's owner can mutate.
 * If 0 rows were updated the invite was not found or already revoked.
 */
export async function revokeInvite(
  inviteId: string,
): Promise<RevokeInviteResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'not_signed_in' }

  // We need the tree_id to call revalidatePath; fetch it alongside the update.
  const { data: updated, error } = await supabase
    .from('tree_invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', inviteId)
    .is('revoked_at', null) // idempotency guard: don't re-revoke
    .select('tree_id')

  if (error) {
    console.error('revokeInvite: update failed', error)
    return { ok: false, error: 'unknown' }
  }

  if (!updated || updated.length === 0) {
    return { ok: false, error: 'not_found_or_revoked' }
  }

  revalidatePath('/tree/' + updated[0].tree_id)
  return { ok: true }
}

// ============================================================================
// resendInvite
// ============================================================================

export type ResendInviteResult =
  | { ok: true; inviteUrl: string; error?: never }
  | { ok: false; error: string; inviteUrl?: never }

/**
 * Owner-only. Regenerates the token IN PLACE (kills the old link immediately,
 * per locked decision 4), resets `expires_at` to 7 days from now, and clears
 * `accepted_at` / `accepted_by` / `revoked_at` so a revoked or expired invite
 * becomes "open" again.  Re-fires `sendInviteEmail` (still flag-gated).
 */
export async function resendInvite(
  inviteId: string,
): Promise<ResendInviteResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'not_signed_in' }

  const newToken = mintToken()
  const baseUrl = await getBaseUrl()
  const newInviteUrl = `${baseUrl}/invite/${newToken}`

  // Compute `now() + 7 days` in the application layer (matches the DB default
  // `now() + interval '7 days'` but lets us return the exact value easily).
  const newExpiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString()

  const { data: updated, error } = await supabase
    .from('tree_invites')
    .update({
      token: newToken,
      expires_at: newExpiresAt,
      accepted_at: null,
      accepted_by: null,
      revoked_at: null,
    })
    .eq('id', inviteId)
    .select('tree_id, email')

  if (error) {
    console.error('resendInvite: update failed', error)
    return { ok: false, error: 'unknown' }
  }

  if (!updated || updated.length === 0) {
    return { ok: false, error: 'not_found' }
  }

  const { tree_id: treeId, email } = updated[0] as {
    tree_id: string
    email: string
  }

  // Fetch tree name + inviter display name for the email stub.
  const [{ data: tree }, { data: profile }] = await Promise.all([
    supabase.from('trees').select('name').eq('id', treeId).single(),
    supabase
      .from('profiles')
      .select('display_name, email')
      .eq('id', user.id)
      .single(),
  ])

  const treeName = tree?.name ?? 'your family tree'
  const invitedByName =
    (profile as { display_name: string | null; email: string | null } | null)
      ?.display_name ??
    (profile as { display_name: string | null; email: string | null } | null)
      ?.email ??
    user.email ??
    'the tree owner'

  await sendInviteEmail({
    email,
    inviteUrl: newInviteUrl,
    treeName,
    invitedByName,
  })

  revalidatePath('/tree/' + treeId)
  return { ok: true, inviteUrl: newInviteUrl }
}

// ============================================================================
// acceptInvite
// ============================================================================

export type AcceptInviteResult =
  | { ok: true; treeId: string; error?: never }
  | {
      ok: false
      error:
        | 'not_found'
        | 'revoked'
        | 'expired'
        | 'email_mismatch'
        | 'already_accepted'
        | 'not_signed_in'
        | 'unknown'
      treeId?: never
    }

// The RPC raises P0001 for all five error states; the message IS the tag.
const INVITE_RPC_ERROR_TAGS = new Set([
  'not_found',
  'revoked',
  'expired',
  'email_mismatch',
  'already_accepted',
] as const)
type InviteRpcErrorTag = (typeof INVITE_RPC_ERROR_TAGS extends Set<infer T>
  ? T
  : never)

function isInviteRpcErrorTag(msg: string): msg is InviteRpcErrorTag {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return INVITE_RPC_ERROR_TAGS.has(msg as any)
}

/**
 * Any authenticated user.  Wraps the `accept_invite` SECURITY DEFINER RPC.
 *
 * The RPC raises `P0001` with the error tag as the message text for all five
 * failure states.  We pattern-match on `error.message` (NOT `error.code` —
 * code is `P0001` for every case).
 *
 * On success the RPC returns `{ tree_id }`.  We call
 *   revalidatePath('/dashboard')         — so the new tree appears in the list
 *   revalidatePath('/tree/' + treeId)    — so the tree page re-fetches membership
 */
export async function acceptInvite(token: string): Promise<AcceptInviteResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'not_signed_in' }

  const { data, error } = await supabase.rpc('accept_invite', {
    p_token: token,
  })

  if (error) {
    const msg = error.message ?? ''
    if (isInviteRpcErrorTag(msg)) {
      return { ok: false, error: msg }
    }
    console.error('acceptInvite: unexpected RPC error', error)
    return { ok: false, error: 'unknown' }
  }

  // The RPC returns a single row `{ tree_id }`.
  const treeId = (data as { tree_id: string } | null)?.tree_id
  if (!treeId) {
    console.error('acceptInvite: RPC returned no tree_id', data)
    return { ok: false, error: 'unknown' }
  }

  revalidatePath('/dashboard')
  revalidatePath('/tree/' + treeId)
  return { ok: true, treeId }
}

// ============================================================================
// revokeMember
// ============================================================================

export type RevokeMemberResult =
  | { ok: true; error?: never }
  | { ok: false; error: string }

/**
 * Owner-only. Removes an editor from `tree_members`.  The `role = 'editor'`
 * filter prevents accidentally revoking the owner row.  RLS policy
 * `tree_members_delete_owner_or_self` handles the owner-only gate at the DB
 * layer; the filter here is defence-in-depth.
 */
export async function revokeMember(
  treeId: string,
  userId: string,
): Promise<RevokeMemberResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'not_signed_in' }

  const { data: deleted, error } = await supabase
    .from('tree_members')
    .delete()
    .eq('tree_id', treeId)
    .eq('user_id', userId)
    .eq('role', 'editor') // prevents revoking the owner row
    .select('user_id')

  if (error) {
    console.error('revokeMember: delete failed', error)
    return { ok: false, error: 'unknown' }
  }

  if (!deleted || deleted.length === 0) {
    return { ok: false, error: 'not_found_or_not_editor' }
  }

  revalidatePath('/tree/' + treeId)
  return { ok: true }
}
