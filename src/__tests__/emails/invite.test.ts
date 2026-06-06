import * as React from 'react'
import { describe, expect, it } from 'vitest'
import { InviteEmail } from '../../../emails/invite'
import { INVITE_TEMPLATE, renderTemplate } from '../../../scripts/build-emails'

describe('invite email template', () => {
  it('contains the inviter name in the rendered HTML', async () => {
    const html = await renderTemplate(
      INVITE_TEMPLATE.element({ inviterName: 'Jane Smith', treeName: 'The Smiths' }),
    )
    expect(html).toContain('Jane Smith')
  })

  it('contains the tree name in the rendered HTML', async () => {
    const html = await renderTemplate(
      INVITE_TEMPLATE.element({ treeName: 'The Bhatnagarrr Family' }),
    )
    expect(html).toContain('The Bhatnagarrr Family')
  })

  it('contains the invite URL in the CTA button and fallback link', async () => {
    const url = 'https://meetthefam.com/invite/tok_abc123'
    const html = await renderTemplate(INVITE_TEMPLATE.element({ inviteUrl: url }))
    // URL appears at least twice — CTA href + fallback link text
    const occurrences = html.split(url).length - 1
    expect(occurrences).toBeGreaterThanOrEqual(2)
  })

  it('contains the recipient email when provided', async () => {
    const html = await renderTemplate(
      INVITE_TEMPLATE.element({ recipientEmail: 'cousin@example.com' }),
    )
    expect(html).toContain('cousin@example.com')
  })

  it('escapes HTML-significant characters in inviterName (XSS guard)', async () => {
    const html = await renderTemplate(
      React.createElement(InviteEmail, { inviterName: '<script>alert(1)</script>' }),
    )
    expect(html).not.toContain('<script>')
    // React encodes < as &lt; (or &#x3C; depending on renderer version)
    expect(html).toMatch(/&lt;script&gt;|&#x3C;script&#x3E;/)
  })

  it('escapes HTML-significant characters in treeName (XSS guard)', async () => {
    const html = await renderTemplate(
      React.createElement(InviteEmail, { treeName: 'Smith & <Sons>' }),
    )
    expect(html).not.toContain('<Sons>')
    // & must be encoded
    expect(html).toMatch(/Smith\s*(&amp;|&#x26;)\s*/)
  })

  it('renders the branded meetthefam wordmark', async () => {
    const html = await renderTemplate(INVITE_TEMPLATE.element())
    expect(html).toContain('meetthefam')
  })

  it('renders the terracotta-rule footer section', async () => {
    const html = await renderTemplate(INVITE_TEMPLATE.element())
    // Footer rule uses the terracotta color token (#C77B5C)
    expect(html).toContain('#C77B5C')
    expect(html).toContain('meetthefam.com')
  })

  it('renders the Accept invitation CTA', async () => {
    const html = await renderTemplate(INVITE_TEMPLATE.element())
    expect(html).toContain('Accept invitation')
  })

  it('renders the plaintext fallback link paragraph', async () => {
    const html = await renderTemplate(
      INVITE_TEMPLATE.element({ inviteUrl: 'https://meetthefam.com/invite/tok_xyz' }),
    )
    expect(html).toContain('Or paste this link into your browser')
    expect(html).toContain('https://meetthefam.com/invite/tok_xyz')
  })

  it('renders expiry notice copy', async () => {
    const html = await renderTemplate(INVITE_TEMPLATE.element())
    expect(html).toContain('7 days')
  })
})
