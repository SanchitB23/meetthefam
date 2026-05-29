import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'
import { colors, fonts } from '../theme'

export interface AuthEmailProps {
  previewText: string
  headline: string
  framing: string
  ctaLabel: string
  confirmationUrl: string
}

export function AuthEmailLayout({
  previewText,
  headline,
  framing,
  ctaLabel,
  confirmationUrl,
}: AuthEmailProps) {
  return (
    <Html lang="en">
      <Head>
        {/* Signal support for both schemes; we rely on the client's auto dark
            mode rather than manual overrides — inline styles win over any
            <style> block, so class-based dark overrides cannot apply. */}
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
      </Head>
      <Preview>{previewText}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={wordmarkRow}>
            <Text style={wordmark}>meetthefam</Text>
          </Section>

          <Section style={card}>
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
          </Section>

          <Section style={footer}>
            <Hr style={footerRule} />
            <Text style={footerMark}>meetthefam</Text>
            <Text style={footerContact}>
              <Link href="https://meetthefam.com" style={footerLink}>
                meetthefam.com
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// ---- styles (px values from docs/ux/auth-email-wireframe.html) ----
const body: React.CSSProperties = {
  backgroundColor: colors.bg,
  margin: 0,
  padding: '32px 12px 40px',
  fontFamily: fonts.sans,
  color: colors.ink,
}
const container: React.CSSProperties = { maxWidth: '560px', margin: '0 auto' }
const wordmarkRow: React.CSSProperties = { textAlign: 'center', marginBottom: '18px' }
const wordmark: React.CSSProperties = {
  fontFamily: fonts.serif,
  fontWeight: 600,
  fontSize: '30px',
  color: colors.green,
  margin: 0,
}
const card: React.CSSProperties = {
  backgroundColor: colors.paper,
  border: `1px solid ${colors.hairline}`,
  borderRadius: '16px',
  padding: '44px 40px 40px',
}
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
const footer: React.CSSProperties = { padding: '0 8px', marginTop: '28px' }
const footerRule: React.CSSProperties = {
  borderColor: colors.terracotta,
  borderStyle: 'solid',
  borderWidth: '2px 0 0',
  width: '44px',
  margin: '0 auto 18px',
}
const footerMark: React.CSSProperties = {
  fontFamily: fonts.serif,
  fontWeight: 600,
  fontSize: '17px',
  color: colors.green,
  textAlign: 'center',
  margin: '0 0 6px',
}
const footerContact: React.CSSProperties = {
  fontSize: '12px',
  lineHeight: '1.6',
  color: colors.muted,
  textAlign: 'center',
  margin: 0,
}
const footerLink: React.CSSProperties = { color: colors.muted, textDecoration: 'underline' }
