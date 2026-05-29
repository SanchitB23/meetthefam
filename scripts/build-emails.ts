import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { render } from '@react-email/render'
import * as React from 'react'
import { ConfirmSignupEmail } from '../emails/confirm-signup'
import { MagicLinkEmail } from '../emails/magic-link'
import { CONFIRMATION_URL_SENTINEL } from '../emails/theme'

const SUPABASE_TOKEN = '{{ .ConfirmationURL }}'
const OUT_DIR = join(process.cwd(), 'supabase', 'templates')

export const TEMPLATES = [
  { file: 'magic_link.html', element: () => React.createElement(MagicLinkEmail) },
  { file: 'confirm_signup.html', element: () => React.createElement(ConfirmSignupEmail) },
] as const

/** Render a template and swap the URL sentinel for the Supabase Go-template token. */
export async function renderTemplate(element: React.ReactElement): Promise<string> {
  const html = await render(element, { pretty: true })
  return html.split(CONFIRMATION_URL_SENTINEL).join(SUPABASE_TOKEN)
}

export async function buildAll(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true })
  for (const t of TEMPLATES) {
    const html = await renderTemplate(t.element())
    writeFileSync(join(OUT_DIR, t.file), html)
    // eslint-disable-next-line no-console
    console.log('wrote', join('supabase/templates', t.file))
  }
}

// Only build when executed directly (not when imported by the test).
if (process.argv[1]?.endsWith('build-emails.ts')) {
  buildAll()
}
