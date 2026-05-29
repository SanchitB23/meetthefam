import * as React from 'react'
import { AuthEmailLayout } from './components/AuthEmailLayout'
import { CONFIRMATION_URL_SENTINEL } from './theme'

export function ConfirmSignupEmail({
  confirmationUrl = CONFIRMATION_URL_SENTINEL,
}: { confirmationUrl?: string } = {}) {
  return (
    <AuthEmailLayout
      previewText="Confirm your email to start your family tree."
      headline="Welcome to meetthefam"
      framing="We're so glad you're here. Confirm your email below and we'll get you into your family tree."
      ctaLabel="Confirm your email"
      confirmationUrl={confirmationUrl}
    />
  )
}

export default ConfirmSignupEmail
