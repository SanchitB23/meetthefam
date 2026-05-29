import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as React from 'react'
import { describe, expect, it } from 'vitest'
import { ConfirmSignupEmail } from '../../../emails/confirm-signup'
import { MagicLinkEmail } from '../../../emails/magic-link'
import { renderTemplate, TEMPLATES } from '../../../scripts/build-emails'

describe('auth email templates', () => {
  it.each(TEMPLATES)(
    'committed $file matches a fresh render (run `pnpm emails:build`)',
    async (t) => {
      const fresh = await renderTemplate(t.element())
      const committed = readFileSync(join(process.cwd(), 'supabase/templates', t.file), 'utf8')
      expect(committed).toBe(fresh)
    },
  )

  it('magic_link carries the token, CTA, fallback, security copy, footer', async () => {
    const html = await renderTemplate(React.createElement(MagicLinkEmail))
    expect(html).toContain('{{ .ConfirmationURL }}')
    expect(html).toContain('Sign in to meetthefam')
    expect(html).toContain('expires in 60 minutes')
    expect(html).toContain('meetthefam.com')
  })

  it('confirm_signup carries the token, CTA, welcome copy', async () => {
    const html = await renderTemplate(React.createElement(ConfirmSignupEmail))
    expect(html).toContain('{{ .ConfirmationURL }}')
    expect(html).toContain('Confirm your email')
    expect(html).toContain('Welcome to meetthefam')
  })
})
