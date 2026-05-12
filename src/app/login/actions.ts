'use server'

import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

async function getOrigin() {
  const headersList = await headers()
  return headersList.get('origin') ?? 'http://localhost:3000'
}

export async function signInWithMagicLink(formData: FormData) {
  const email = formData.get('email')
  if (!email || typeof email !== 'string') {
    redirect('/login?error=Email+required')
  }

  const supabase = await createClient()
  const origin = await getOrigin()

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  })

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  redirect(`/login?sent=true&email=${encodeURIComponent(email)}`)
}

export async function signInWithGoogle() {
  const supabase = await createClient()
  const origin = await getOrigin()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${origin}/auth/callback` },
  })

  if (error || !data?.url) {
    redirect(
      `/login?error=${encodeURIComponent(error?.message ?? 'Google sign-in failed')}`
    )
  }

  redirect(data.url)
}
