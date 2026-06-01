import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { render } from '@react-email/render'
import * as React from 'react'
import { ConfirmSignupEmail } from '../emails/confirm-signup'
import { InviteEmail } from '../emails/invite'
import { MagicLinkEmail } from '../emails/magic-link'
import { CONFIRMATION_URL_SENTINEL } from '../emails/theme'

const SUPABASE_TOKEN = '{{ .ConfirmationURL }}'
const OUT_DIR = join(process.cwd(), 'supabase', 'templates')

/**
 * Supabase auth templates — these are rendered to committed static HTML files
 * under `supabase/templates/` and wired into `supabase/config.toml`.
 * The URL sentinel is replaced with the Supabase Go-template token at build time.
 */
export const TEMPLATES = [
  { file: 'magic_link.html', element: () => React.createElement(MagicLinkEmail) },
  { file: 'confirm_signup.html', element: () => React.createElement(ConfirmSignupEmail) },
] as const

/**
 * Invite template — rendered on-demand at send time (see `src/lib/email/inviteEmail.ts`).
 * Not written to `supabase/templates/` (it is not a Supabase auth template and has no
 * Go-template sentinel). Exported here so test files can import the render helper
 * without pulling in build dependencies directly.
 */
export const INVITE_TEMPLATE = {
  element: (props?: Parameters<typeof InviteEmail>[0]) =>
    React.createElement(InviteEmail, props),
}

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
    console.log('wrote', join('supabase/templates', t.file))
  }
}

// Only build when executed directly (not when imported by the test).
if (process.argv[1]?.endsWith('build-emails.ts')) {
  buildAll()
}
