import {
  Body,
  Container,
  Head,
  Html,
  Hr,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'
import { colors, fonts } from '../theme'

export interface EmailLayoutProps {
  previewText: string
  children: React.ReactNode
}

/**
 * Shared outer shell for all meetthefam transactional emails.
 *
 * Renders:
 *   - the cream <Body> + centered <Container>
 *   - the serif wordmark header
 *   - a cream card with a subtle hairline border (children go inside)
 *   - the terracotta-rule footer
 *
 * Consumers own the card body content entirely — pass it as `children`.
 * Auth emails route through `AuthEmailLayout` which wraps this with the
 * standard headline / framing / CTA / security-notice pattern.
 * Non-auth emails (e.g. invite) compose `EmailLayout` directly.
 */
export function EmailLayout({ previewText, children }: EmailLayoutProps) {
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

          <Section style={card}>{children}</Section>

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
export const wordmark: React.CSSProperties = {
  fontFamily: fonts.serif,
  fontWeight: 600,
  fontSize: '30px',
  color: colors.green,
  margin: 0,
}
export const card: React.CSSProperties = {
  backgroundColor: colors.paper,
  border: `1px solid ${colors.hairline}`,
  borderRadius: '16px',
  padding: '44px 40px 40px',
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
