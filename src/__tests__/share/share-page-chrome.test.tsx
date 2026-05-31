/** @vitest-environment jsdom */
/**
 * share-page-chrome — asserts that /share/[token] renders PublicHeader +
 * SiteFooter public chrome alongside the tree content.
 *
 * The chrome test is separate from share-page.test.ts (which is a DB-level
 * integration test). This file is a jsdom unit test focused purely on the
 * rendered HTML structure — no real Supabase connection needed.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// SiteFooter embeds <AuthFooterLink />, which calls the browser Supabase
// client on mount and embeds the signOut server action. Mock both so jsdom
// stays inert.
import { mockSupabaseClient } from '@/__tests__/helpers/supabaseClientMock'
mockSupabaseClient()

// Mock the service-role client — the share page uses it to resolve the token.
// We return a chainable query builder stub matching the actual usage shape:
//   .from('trees').select(...).eq(...).maybeSingle()
//   .from('people').select(...).eq(...).order(...).returns()
const MOCK_TREE = {
  id: 'tree-abc',
  name: 'The Smith Family',
  description: 'Our shared tree.',
}

const MOCK_PEOPLE = [
  {
    id: 'p-1',
    tree_id: 'tree-abc',
    full_name: 'Alice Smith',
    nickname: null,
    gender: 'female',
    photo_url: null,
    bio: null,
    birth_year: null,
    location: null,
    occupation: null,
    deceased: false,
    death_year: null,
    father_id: null,
    mother_id: null,
    spouse_id: null,
    tone: null,
  },
]

vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => {
    const makeChain = (resolvedValue: unknown) => ({
      select: () => makeChain(resolvedValue),
      eq: () => makeChain(resolvedValue),
      order: () => makeChain(resolvedValue),
      maybeSingle: async () => ({ data: resolvedValue, error: null }),
      returns: async () => ({ data: resolvedValue, error: null }),
    })
    return {
      from: (table: string) => {
        if (table === 'trees') return makeChain(MOCK_TREE)
        if (table === 'people') return makeChain(MOCK_PEOPLE)
        return makeChain(null)
      },
    }
  },
}))

// FamilyTree is a client-side D3 component — stub it so jsdom doesn't need
// to exercise the canvas/SVG rendering pipeline in this chrome-only test.
vi.mock('@/app/(app)/tree/[id]/_components/FamilyTree', () => ({
  FamilyTree: ({ treeId }: { treeId: string }) => (
    <div data-testid="family-tree" data-tree-id={treeId} />
  ),
}))

import SharePage from '@/app/share/[token]/page'

async function renderPage(token = 'valid-token') {
  const props = { params: Promise.resolve({ token }) }
  const jsx = await SharePage(props)
  return render(jsx)
}

describe('/share/[token] public chrome', () => {
  it('renders the PublicHeader logo link back to /', async () => {
    const { container } = await renderPage()
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) =>
      a.getAttribute('href'),
    )
    // PublicHeader wraps the logo in a Link to "/"
    expect(hrefs).toContain('/')
  })

  it('renders the meetthefam wordmark in the header', async () => {
    await renderPage()
    expect(screen.getByText('meetthefam')).toBeTruthy()
  })

  it('renders the SiteFooter with legal navigation links', async () => {
    const { container } = await renderPage()
    // Wait for AuthFooterLink to resolve (it's an async client island)
    await screen.findByRole('link', { name: /sign in/i })
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) =>
      a.getAttribute('href'),
    )
    expect(hrefs).toContain('/privacy')
    expect(hrefs).toContain('/terms')
    expect(hrefs).toContain('/contact')
    expect(hrefs).toContain('/about')
  })

  it('shows "Sign in" in the footer for an anonymous viewer', async () => {
    await renderPage()
    const link = await screen.findByRole('link', { name: /sign in/i })
    expect(link).toHaveAttribute('href', '/login')
  })

  it('renders the tree name as a heading', async () => {
    await renderPage()
    expect(screen.getByText('The Smith Family')).toBeTruthy()
  })

  it('renders the FamilyTree component with the correct treeId', async () => {
    const { container } = await renderPage()
    const treeEl = container.querySelector('[data-testid="family-tree"]')
    expect(treeEl).not.toBeNull()
    expect(treeEl?.getAttribute('data-tree-id')).toBe('tree-abc')
  })

  it('renders the ShareBanner "viewing a shared family tree" notice', async () => {
    await renderPage()
    expect(
      screen.getByText(/viewing a shared family tree/i),
    ).toBeTruthy()
  })
})
