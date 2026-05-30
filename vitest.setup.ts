import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// `@testing-library/react` only auto-registers its `afterEach(cleanup)` hook
// when Vitest runs with `globals: true`. Our tests import `describe`/`it`/
// `expect` explicitly (no globals), so that auto-registration never fires and
// we register cleanup here instead.
//
// Without this, rendered components accumulate in `document.body` across tests
// in the same file, and `screen.getByRole` / `screen.queryByRole` then match
// multiple stale elements (see #133: <ErrorAlert> dismiss-button + LoginPage
// alert-rendering failures). `cleanup()` is a no-op in `node`-environment
// suites (nothing is ever mounted there), so this is safe to run globally.
afterEach(() => {
  cleanup()
})
