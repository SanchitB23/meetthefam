/** @vitest-environment jsdom */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Prose } from '@/components/ui/Prose'

describe('<Prose>', () => {
  it('renders its children', () => {
    const { getByText } = render(
      <Prose>
        <h2>Section heading</h2>
        <p>Body text.</p>
      </Prose>,
    )
    expect(getByText('Section heading')).toBeTruthy()
    expect(getByText('Body text.')).toBeTruthy()
  })
})
