import { Button, Heading, Hr, Link, Text } from '@react-email/components'
import * as React from 'react'
import { colors, fonts } from '../theme'
import { EmailLayout } from './EmailLayout'

export interface AuthEmailProps {
  previewText: string
  headline: string
  framing: string
  ctaLabel: string
  confirmationUrl: string
}

/**
 * Auth-specific email layout (magic-link, confirm-signup).
 * Wraps the shared `EmailLayout` shell and fills in the standard
 * headline / framing / CTA / fallback link / security-notice pattern.
 */
export function AuthEmailLayout({
  previewText,
  headline,
  framing,
  ctaLabel,
  confirmationUrl,
}: AuthEmailProps) {
  return (
    <EmailLayout previewText={previewText}>
      <Heading as="h1" style={headlineStyle}>
        {headline}
      </Heading>
      <Text style={greeting}>Hi there,</Text>
      <Text style={framingStyle}>{framing}</Text>

      <Button href={confirmationUrl} style={cta}>
        {ctaLabel}
      </Button>

      <Text style={fallback}>
        Or paste this link into your browser:
        <br />
        <Link href={confirmationUrl} style={fallbackLink}>
          {confirmationUrl}
        </Link>
      </Text>

      <Hr style={dividerSoft} />

      <Text style={security}>
        This link expires in 60 minutes and can only be used once. If you didn&apos;t
        request it, you can safely ignore this email.
      </Text>
    </EmailLayout>
  )
}

// ---- styles (px values from docs/ux/auth-email-wireframe.html) ----
const headlineStyle: React.CSSProperties = {
  fontFamily: fonts.serif,
  fontWeight: 600,
  fontSize: '38px',
  lineHeight: '1.08',
  color: colors.green,
  margin: '0 0 18px',
}
const greeting: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 500,
  lineHeight: '1.6',
  color: colors.ink,
  margin: '0 0 10px',
}
const framingStyle: React.CSSProperties = {
  fontSize: '16px',
  lineHeight: '1.62',
  color: colors.ink,
  margin: '0 0 30px',
}
const cta: React.CSSProperties = {
  display: 'block',
  backgroundColor: colors.green,
  color: colors.onDark,
  textDecoration: 'none',
  textAlign: 'center',
  fontFamily: fonts.sans,
  fontWeight: 600,
  fontSize: '16px',
  padding: '16px 24px',
  borderRadius: '12px',
  lineHeight: '20px', // 16 + 16 + 20 = 52px tall
}
const fallback: React.CSSProperties = {
  fontSize: '13px',
  lineHeight: '1.55',
  color: colors.muted,
  margin: '22px 0 0',
}
const fallbackLink: React.CSSProperties = {
  color: colors.green,
  wordBreak: 'break-all',
  textDecoration: 'underline',
}
const dividerSoft: React.CSSProperties = {
  borderColor: colors.hairline,
  borderStyle: 'solid',
  borderWidth: '1px 0 0',
  margin: '30px 0 22px',
}
const security: React.CSSProperties = {
  fontSize: '13px',
  lineHeight: '1.6',
  color: colors.muted,
  margin: 0,
}
