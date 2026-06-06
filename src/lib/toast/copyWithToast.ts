'use client'

import { notify } from './notify'

// Copies text to the clipboard and fires a success toast. Returns the
// promise so callers can still flip their local "copied" icon state.
export async function copyWithToast(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
  notify.success('Copied to clipboard')
}
