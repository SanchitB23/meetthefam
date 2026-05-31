import * as React from 'react'
import { AuthEmailLayout } from './components/AuthEmailLayout'
import { CONFIRMATION_URL_SENTINEL } from './theme'

export function MagicLinkEmail({
  confirmationUrl = CONFIRMATION_URL_SENTINEL,
}: { confirmationUrl?: string } = {}) {
  return (
    <AuthEmailLayout
      previewText="Your secure sign-in link — expires in 60 minutes."
      headline="Your sign-in link"
      framing="Welcome back. Click below to get straight into your family tree — no password needed."
      ctaLabel="Sign in to meetthefam"
      confirmationUrl={confirmationUrl}
    />
  )
}

export default MagicLinkEmail
