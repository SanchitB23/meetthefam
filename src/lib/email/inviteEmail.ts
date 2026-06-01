import { render } from '@react-email/render'
import * as React from 'react'
import { Resend } from 'resend'
import { InviteEmail } from '../../../emails/invite'

type InvitePayload = {
  email: string
  inviteUrl: string
  treeName: string
  invitedByName: string
}

/**
 * Render the branded invite email HTML via React Email.
 *
 * HTML escaping: React Email (via React's reconciler) escapes all JSX text
 * content and attribute values at render time — `<`, `>`, `&`, `"` and `'` in
 * prop strings are automatically entity-encoded. The previous inline
 * `buildInviteHtml` manually called `escapeHtml()` for each field; React Email
 * provides the same guarantee without the boilerplate. The rendered HTML is
 * therefore safe for injection into the Resend `html` field.
 */
async function buildInviteHtml(invite: InvitePayload): Promise<string> {
  return render(
    React.createElement(InviteEmail, {
      inviterName: invite.invitedByName,
      treeName: invite.treeName,
      inviteUrl: invite.inviteUrl,
      recipientEmail: invite.email,
    }),
  )
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
      html: await buildInviteHtml(invite),
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
