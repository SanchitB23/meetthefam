import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the resend module BEFORE importing the unit under test.
const sendMock = vi.fn()
vi.mock('resend', () => {
  // Vitest 4 requires a real constructor (function, not arrow) when the module
  // is used with `new`. Using a class satisfies that constraint.
  class ResendMock {
    emails = { send: sendMock }
  }
  return { Resend: ResendMock }
})

import { sendInviteEmail } from '@/lib/email/inviteEmail'

const PAYLOAD = {
  email: 'editor@example.com',
  inviteUrl: 'https://meetthefam.com/invite/tok_abc123',
  treeName: 'The Smith Family',
  invitedByName: 'Jane Smith',
}

beforeEach(() => {
  sendMock.mockReset()
  sendMock.mockResolvedValue({ data: { id: 'eml_1' }, error: null })
  vi.stubEnv('RESEND_API_KEY', 're_test_key')
  vi.stubEnv('RESEND_FROM_EMAIL', 'noreply-mtf@sanchitb23.in')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('sendInviteEmail', () => {
  it('does NOT send when the flag is unset', async () => {
    vi.stubEnv('MEETTHEFAM_EMAIL_INVITES_ENABLED', '')
    await sendInviteEmail(PAYLOAD)
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('sends via Resend with the right envelope when the flag is on', async () => {
    vi.stubEnv('MEETTHEFAM_EMAIL_INVITES_ENABLED', 'true')
    await sendInviteEmail(PAYLOAD)

    expect(sendMock).toHaveBeenCalledTimes(1)
    const arg = sendMock.mock.calls[0][0]
    expect(arg.from).toBe('noreply-mtf@sanchitb23.in')
    expect(arg.to).toBe('editor@example.com')
    expect(arg.subject).toContain('Jane Smith')
    expect(arg.html).toContain('https://meetthefam.com/invite/tok_abc123')
    expect(arg.html).toContain('The Smith Family')
    expect(arg.html).toContain('Jane Smith')
  })

  it('escapes HTML-significant characters in user-supplied fields', async () => {
    vi.stubEnv('MEETTHEFAM_EMAIL_INVITES_ENABLED', 'true')
    await sendInviteEmail({
      ...PAYLOAD,
      treeName: 'Smith & <Sons>',
      invitedByName: 'Bobby "Tables"',
    })
    const html = sendMock.mock.calls[0][0].html as string
    expect(html).toContain('Smith &amp; &lt;Sons&gt;')
    expect(html).toContain('Bobby &quot;Tables&quot;')
    expect(html).not.toContain('<Sons>')
  })

  it('swallows send failures (does not reject) so invite creation is not rolled back', async () => {
    vi.stubEnv('MEETTHEFAM_EMAIL_INVITES_ENABLED', 'true')
    sendMock.mockRejectedValueOnce(new Error('Resend down'))
    await expect(sendInviteEmail(PAYLOAD)).resolves.toBeUndefined()
  })

  it('swallows a returned API error (Resend reports failure without throwing)', async () => {
    vi.stubEnv('MEETTHEFAM_EMAIL_INVITES_ENABLED', 'true')
    sendMock.mockResolvedValueOnce({
      data: null,
      error: { name: 'rate_limit_exceeded', message: 'Too many requests' },
    })
    await expect(sendInviteEmail(PAYLOAD)).resolves.toBeUndefined()
  })
})
