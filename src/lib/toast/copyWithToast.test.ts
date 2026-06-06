import { describe, it, expect, vi, beforeEach } from 'vitest'

const writeText = vi.fn().mockResolvedValue(undefined)
const { success } = vi.hoisted(() => ({ success: vi.fn() }))
vi.mock('./notify', () => ({ notify: { success } }))
import { copyWithToast } from './copyWithToast'

describe('copyWithToast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(navigator, { clipboard: { writeText } })
  })
  it('writes to clipboard and toasts', async () => {
    await copyWithToast('https://x.test')
    expect(writeText).toHaveBeenCalledWith('https://x.test')
    expect(success).toHaveBeenCalledWith('Copied to clipboard')
  })
})
