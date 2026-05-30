/** @vitest-environment jsdom */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ChildrensPrivacyPage from '@/app/(legal)/childrens-privacy/page'

describe('<ChildrensPrivacyPage>', () => {
  it('renders the Children’s Privacy heading', () => {
    const { getByRole } = render(<ChildrensPrivacyPage />)
    expect(
      getByRole('heading', { level: 1, name: /children.s privacy/i }),
    ).toBeTruthy()
  })

  it('links back to the Privacy Policy', () => {
    const { getByRole } = render(<ChildrensPrivacyPage />)
    const link = getByRole('link', { name: /privacy policy/i })
    expect(link.getAttribute('href')).toBe('/privacy')
  })

  it('states the delete-on-request contact path', () => {
    const { getAllByRole } = render(<ChildrensPrivacyPage />)
    const mailto = getAllByRole('link').filter((a) =>
      a.getAttribute('href')?.startsWith('mailto:hello.mtf@sanchitb23.in'),
    )
    expect(mailto.length).toBeGreaterThan(0)
  })
})
