import { Button, Heading, Link, Text } from '@react-email/components'
import * as React from 'react'
import { colors, fonts } from './theme'
import { EmailLayout } from './components/EmailLayout'

export interface InviteEmailProps {
  inviterName?: string
  treeName?: string
  inviteUrl?: string
  recipientEmail?: string
}

/**
 * Branded collaboration-invite email.
 *
 * Prop naming mirrors the `buildInviteHtml` call signature in
 * `src/lib/email/inviteEmail.ts` (InvitePayload):
 *   invitedByName → inviterName
 *   treeName      → treeName
 *   inviteUrl     → inviteUrl
 *   email         → recipientEmail
 *
 * React Email escapes all prop interpolations at render time, so explicit
 * HTML-escaping (the manual `escapeHtml` in the old buildInviteHtml) is not
 * needed here — JSX text content and attribute values are always entity-encoded
 * by React's reconciler.
 */
export function InviteEmail({
  inviterName = 'A family member',
  treeName = 'Family Tree',
  inviteUrl = 'https://meetthefam.com',
  recipientEmail,
}: InviteEmailProps) {
  const previewText = `${inviterName} invited you to help build ${treeName} on meetthefam.`

  return (
    <EmailLayout previewText={previewText}>
      <Heading as="h1" style={headlineStyle}>
        You&rsquo;re invited to a family tree
      </Heading>

      {recipientEmail ? <Text style={greeting}>Hi {recipientEmail},</Text> : null}

      <Text style={framingStyle}>
        <strong style={inviterStyle}>{inviterName}</strong> has invited you to help build{' '}
        <strong style={treeNameStyle}>{treeName}</strong> on meetthefam.
      </Text>

      <Text style={subFramingStyle}>
        meetthefam is a private, mobile-first family tree for names, photos, and stories. Once you
        accept, you&rsquo;ll be able to add and edit people in the tree.
      </Text>

      <Button href={inviteUrl} style={cta}>
        Accept invitation
      </Button>

      <Text style={fallback}>
        Or paste this link into your browser:
        <br />
        <Link href={inviteUrl} style={fallbackLink}>
          {inviteUrl}
        </Link>
      </Text>

      <Text style={expiry}>
        This invitation link expires in 7 days. If you weren&apos;t expecting this, you can safely
        ignore this email.
      </Text>
    </EmailLayout>
  )
}

export default InviteEmail

// ---- styles (visual rhythm matches AuthEmailLayout) ----
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
  margin: '0 0 14px',
}
const inviterStyle: React.CSSProperties = {
  color: colors.green,
  fontWeight: 600,
}
const treeNameStyle: React.CSSProperties = {
  color: colors.green,
  fontWeight: 600,
}
const subFramingStyle: React.CSSProperties = {
  fontSize: '15px',
  lineHeight: '1.62',
  color: colors.muted,
  margin: '0 0 30px',
}
const cta: React.CSSProperties = {
  display: 'block',
  backgroundColor: colors.terracotta,
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
const expiry: React.CSSProperties = {
  fontSize: '13px',
  lineHeight: '1.6',
  color: colors.muted,
  margin: '22px 0 0',
}
