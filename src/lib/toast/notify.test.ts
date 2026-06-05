import { describe, it, expect, vi, beforeEach } from 'vitest'

const { success, info, warning, error } = vi.hoisted(() => ({
  success: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { success, info, warning, error },
}))

import { notify } from './notify'

describe('notify', () => {
  beforeEach(() => vi.clearAllMocks())

  it('success: 2s auto-dismiss', () => {
    notify.success('Added Jane')
    expect(success).toHaveBeenCalledWith('Added Jane', expect.objectContaining({ duration: 2000 }))
  })

  it('warning: 6s + passes the action through', () => {
    const action = { label: 'Link now', onClick: () => {} }
    notify.warning('Not linked', { action })
    expect(warning).toHaveBeenCalledWith('Not linked', expect.objectContaining({ duration: 6000, action }))
  })

  it('error: sticky (Infinity duration)', () => {
    notify.error('Boom')
    expect(error).toHaveBeenCalledWith('Boom', expect.objectContaining({ duration: Infinity }))
  })

  it('info: 4s auto-dismiss', () => {
    notify.info('Heads up')
    expect(info).toHaveBeenCalledWith('Heads up', expect.objectContaining({ duration: 4000 }))
  })
})
