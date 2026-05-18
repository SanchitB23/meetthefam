'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { randomBytes } from 'crypto'

// ---------------------------------------------------------------------------
// Helpers (mirror `src/app/tree/[id]/members/actions.ts`).
// ---------------------------------------------------------------------------

async function getBaseUrl(): Promise<string> {
  const headersList = await headers()
  return headersList.get('origin') ?? 'http://localhost:3000'
}

function mintToken(): string {
  return randomBytes(32).toString('base64url')
}

// ---------------------------------------------------------------------------
// Shared result type
// ---------------------------------------------------------------------------

export type ShareLinkResult =
  | { ok: true; shareToken: string | null; shareUrl: string | null; error?: never }
  | { ok: false; error: 'not_signed_in' | 'forbidden' | 'not_found' | 'unknown'; shareToken?: never; shareUrl?: never }

// ---------------------------------------------------------------------------
// enableShareLink
// ---------------------------------------------------------------------------
//
// Mints a 32-byte URL-safe token and writes it to `trees.share_token`.
// RLS (`trees_update_owner`) ensures only the owner can mutate.  If the
// link is already enabled, this rotates the token (matches Phase 6
// `resendInvite`'s "rotate in place" semantics — the old URL stops
// working immediately, which is the safer default).

export async function enableShareLink(treeId: string): Promise<ShareLinkResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'not_signed_in' }

  const token = mintToken()
  const baseUrl = await getBaseUrl()

  const { data: updated, error } = await supabase
    .from('trees')
    .update({ share_token: token })
    .eq('id', treeId)
    .select('id')

  if (error) {
    console.error('enableShareLink: update failed', error)
    return { ok: false, error: 'unknown' }
  }

  // RLS USING-clause filter for non-owners drops the row from the result
  // set without raising an error — we treat that as forbidden.
  if (!updated || updated.length === 0) {
    return { ok: false, error: 'forbidden' }
  }

  revalidatePath('/tree/' + treeId)
  return {
    ok: true,
    shareToken: token,
    shareUrl: `${baseUrl}/share/${token}`,
  }
}

// ---------------------------------------------------------------------------
// regenerateShareToken
// ---------------------------------------------------------------------------
//
// Same code path as `enableShareLink` — both rotate the token IN PLACE.
// The two actions exist as separate exports so the UI can distinguish
// "first-time enable" copy from "rotate" copy without inspecting the
// current state on the client.

export async function regenerateShareToken(
  treeId: string,
): Promise<ShareLinkResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'not_signed_in' }

  const token = mintToken()
  const baseUrl = await getBaseUrl()

  const { data: updated, error } = await supabase
    .from('trees')
    .update({ share_token: token })
    .eq('id', treeId)
    .select('id')

  if (error) {
    console.error('regenerateShareToken: update failed', error)
    return { ok: false, error: 'unknown' }
  }

  if (!updated || updated.length === 0) {
    return { ok: false, error: 'forbidden' }
  }

  revalidatePath('/tree/' + treeId)
  return {
    ok: true,
    shareToken: token,
    shareUrl: `${baseUrl}/share/${token}`,
  }
}

// ---------------------------------------------------------------------------
// disableShareLink
// ---------------------------------------------------------------------------
//
// Clears `share_token` to null.  Idempotent — calling it twice in a row
// returns ok the second time too (the result set will still contain the
// row because the owner-only RLS USING clause matches).

export async function disableShareLink(
  treeId: string,
): Promise<ShareLinkResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'not_signed_in' }

  const { data: updated, error } = await supabase
    .from('trees')
    .update({ share_token: null })
    .eq('id', treeId)
    .select('id')

  if (error) {
    console.error('disableShareLink: update failed', error)
    return { ok: false, error: 'unknown' }
  }

  if (!updated || updated.length === 0) {
    return { ok: false, error: 'forbidden' }
  }

  revalidatePath('/tree/' + treeId)
  return { ok: true, shareToken: null, shareUrl: null }
}
