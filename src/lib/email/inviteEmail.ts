type InvitePayload = {
  email: string
  inviteUrl: string
  treeName: string
  invitedByName: string
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
  // TODO(issue-25): wire to custom SMTP (Resend/SendGrid) post-v1.0
  throw new Error('Email delivery not yet implemented')
}
