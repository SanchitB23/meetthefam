import { Resend } from 'resend'

type InvitePayload = {
  email: string
  inviteUrl: string
  treeName: string
  invitedByName: string
}

/** Escape the five HTML-significant characters for safe interpolation into the body. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Minimal, table-based invite body. Deliberately plain — a brand-aligned
 * template (heirloom palette, like the auth emails) is deferred to follow-up
 * issue #154. All user-supplied fields are HTML-escaped.
 */
function buildInviteHtml(invite: InvitePayload): string {
  const treeName = escapeHtml(invite.treeName)
  const invitedByName = escapeHtml(invite.invitedByName)
  const inviteUrl = escapeHtml(invite.inviteUrl)
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; color: #2E2A24; background-color: #F5EFE3; margin: 0; padding: 32px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width: 560px;">
            <tr>
              <td style="background-color: #FFFCF5; border: 1px solid #E3DBCB; border-radius: 16px; padding: 40px;">
                <h1 style="color: #2D4A3E; font-size: 24px; margin: 0 0 16px;">You're invited to a family tree</h1>
                <p style="font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                  ${invitedByName} invited you to help build <strong>${treeName}</strong> on meetthefam.
                </p>
                <a href="${inviteUrl}" style="display: inline-block; background-color: #2D4A3E; color: #FFFCF5; text-decoration: none; font-weight: 600; font-size: 16px; padding: 14px 24px; border-radius: 12px;">
                  Accept invitation
                </a>
                <p style="font-size: 13px; line-height: 1.55; color: #6B6358; margin: 24px 0 0;">
                  Or paste this link into your browser:<br />
                  <a href="${inviteUrl}" style="color: #2D4A3E; word-break: break-all;">${inviteUrl}</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export async function sendInviteEmail(invite: InvitePayload): Promise<void> {
  if (process.env.MEETTHEFAM_EMAIL_INVITES_ENABLED !== 'true') {
    console.log(
      '[invite-email] disabled by flag; would have sent to',
      invite.email,
      invite.inviteUrl,
    )
    return
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: invite.email,
      subject: `${invite.invitedByName} invited you to their family tree on meetthefam`,
      html: buildInviteHtml(invite),
    })
    if (error) {
      // Resend reports API-level failures (bad key, rate limit, unverified
      // domain) as a returned error, not a thrown one.
      console.error('[invite-email] send rejected for', invite.email, error)
    }
  } catch (err) {
    // Unexpected throw (e.g. network layer). The invite row already exists
    // upstream; a delivery failure must not roll back invite creation.
    console.error('[invite-email] send threw for', invite.email, err)
  }
}
