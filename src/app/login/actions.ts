'use server'

import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

async function getOrigin() {
  const headersList = await headers()
  return headersList.get('origin') ?? 'http://localhost:3000'
}

// Sanitize the `next` param so we only allow same-origin relative paths
// starting with `/` (and not protocol-relative `//evil.com`).
function safeNextPath(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string' || value.length === 0) return null
  if (!value.startsWith('/') || value.startsWith('//')) return null
  return value
}

function buildCallbackUrl(origin: string, next: string | null): string {
  const base = `${origin}/auth/callback`
  return next ? `${base}?next=${encodeURIComponent(next)}` : base
}

export async function signInWithMagicLink(formData: FormData) {
  const email = formData.get('email')
  if (!email || typeof email !== 'string') {
    redirect('/login?error=email_required')
  }

  const next = safeNextPath(formData.get('next'))
  const supabase = await createClient()
  const origin = await getOrigin()

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: buildCallbackUrl(origin, next) },
  })

  if (error) {
    let tag: string
    const status = 'status' in error ? (error as { status?: number }).status : undefined
    if (error.message.includes('rate limit')) {
      tag = 'email_rate_limit'
    } else if (error.message.includes('invalid') || status === 422) {
      tag = 'email_invalid'
    } else {
      console.error('[login] OTP failed:', error)
      tag = 'unknown'
    }
    redirect(`/login?error=${tag}`)
  }

  const sentParams = new URLSearchParams({ sent: 'true', email })
  if (next) sentParams.set('next', next)
  redirect(`/login?${sentParams.toString()}`)
}

export async function signInWithGoogle(formData: FormData) {
  const next = safeNextPath(formData.get('next'))
  const supabase = await createClient()
  const origin = await getOrigin()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: buildCallbackUrl(origin, next) },
  })

  if (error || !data?.url) {
    console.error('[login] OAuth failed:', error)
    redirect('/login?error=unknown')
  }

  redirect(data.url)
}
