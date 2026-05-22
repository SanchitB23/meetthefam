const ERROR_MAP: Record<string, string> = {
  auth_error: 'Sign-in failed. Please try again.',
  auth_callback_failed: 'Authentication could not be completed. Try signing in again.',
  email_required: 'Please enter your email address.',
  email_invalid: 'That email address does not look right. Check for typos.',
  email_rate_limit: 'Too many sign-in attempts. Wait a few minutes and try again.',
  not_signed_in: 'Sign in to continue.',
  forbidden: 'You do not have permission to do that.',
  not_found: 'That page or resource could not be found.',
  not_found_or_revoked: 'That link is no longer active or could not be found.',
  self_spouse: 'A person cannot be their own spouse.',
  cross_tree: 'That relationship spans two different family trees.',
  ancestor_cycle: 'Adding that relationship would create a cycle in the family tree.',
  unknown: 'Something went wrong.',
}

export function mapErrorCode(code: string, fallback?: string): string {
  return ERROR_MAP[code] ?? fallback ?? 'Something went wrong.'
}
