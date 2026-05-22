import { vi, describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'

// Simulate a shallow clone: all git() calls return empty string.
vi.mock('node:child_process', () => ({
  execSync: () => Buffer.from(''),
}))

const SHA = 'abc1234567890abcdef1234567890abcdef1234'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mod: any

beforeAll(async () => {
  mod = await import('../../../scripts/derive-version.mjs')
})

describe('derive-version', () => {
  beforeEach(() => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', SHA)
    vi.stubEnv('VERCEL_GIT_COMMIT_REF', 'main')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('emits bare X.Y.Z when latest tag commit SHA matches HEAD', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => [{ tag_name: 'v1.2.3' }] })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ object: { sha: SHA, type: 'commit' } }),
        }),
    )

    expect(await mod.deriveVersion()).toBe('1.2.3')
  })

  it('falls through to dev format when tag SHA differs from HEAD', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => [{ tag_name: 'v1.2.3' }] })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ object: { sha: 'deadbeefdeadbeefdeadbeef', type: 'commit' } }),
        }),
    )

    expect(await mod.deriveVersion()).toMatch(/^1\.2\.3-dev\.[a-f0-9]{7}$/)
  })

  it('tagPointsAtSha returns false on network failure and deriveVersion falls through', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('network error')))
    expect(await mod.tagPointsAtSha('v1.2.3', SHA)).toBe(false)

    // deriveVersion: releases fetch succeeds, tagPointsAtSha fetch throws →
    // no uncaught error, output is dev format
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => [{ tag_name: 'v1.2.3' }] })
        .mockRejectedValueOnce(new Error('network error')),
    )
    expect(await mod.deriveVersion()).toMatch(/^1\.2\.3-dev\.[a-f0-9]{7}$/)
  })

  it('dereferences annotated tags via a second fetch and uses the inner commit SHA', async () => {
    const TAG_OBJ_URL = 'https://api.github.com/repos/SanchitB23/meetthefam/git/tags/abc123'
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ tag_name: 'v1.2.3' }] })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ object: { type: 'tag', url: TAG_OBJ_URL } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ object: { sha: SHA } }),
      })
    vi.stubGlobal('fetch', fetchMock)

    expect(await mod.deriveVersion()).toBe('1.2.3')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock).toHaveBeenNthCalledWith(3, TAG_OBJ_URL, expect.any(Object))
  })
})
