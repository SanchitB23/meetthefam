import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LandingHero } from '@/components/landing/LandingHero'
import { LandingFeatures } from '@/components/landing/LandingFeatures'
import { SiteFooter } from '@/components/layout/SiteFooter'

/**
 * Phase 8c-2 — heirloom landing page. Replaces the create-next-app
 * scaffold. Authed users redirect to /dashboard immediately (closes #44).
 */
export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingHero />
      <LandingFeatures />
      <SiteFooter />
    </div>
  )
}
