/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ErrorAlert } from '@/components/ui/error-alert'

describe('<ErrorAlert>', () => {
  it('renders the message text', () => {
    render(<ErrorAlert message="Something went wrong." />)
    expect(screen.getByText('Something went wrong.')).toBeTruthy()
  })

  it('has role="alert" and aria-live="polite" for screen-reader announcement', () => {
    const { container } = render(<ErrorAlert message="Test error" />)
    const el = container.querySelector('[role="alert"]')
    expect(el).not.toBeNull()
    expect(el?.getAttribute('aria-live')).toBe('polite')
  })

  it('renders the AlertCircle icon for the default inline variant', () => {
    const { container } = render(<ErrorAlert message="Test" />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
  })

  it('renders a dismiss button when dismissible=true', () => {
    render(<ErrorAlert message="Dismiss me" dismissible />)
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeTruthy()
  })

  it('hides the alert after clicking the dismiss button', () => {
    const { container } = render(<ErrorAlert message="Dismiss me" dismissible />)
    const btn = screen.getByRole('button', { name: /dismiss/i })
    fireEvent.click(btn)
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })

  it('renders the action slot when provided', () => {
    render(
      <ErrorAlert
        message="Retry error"
        action={<button type="button">Retry</button>}
      />,
    )
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy()
  })

  it('renders smaller padding/text with size="sm"', () => {
    const { container } = render(<ErrorAlert message="Small" size="sm" />)
    const alert = container.querySelector('[role="alert"]')
    expect(alert?.className).toContain('px-3')
  })

  it('does not render a dismiss button when dismissible is not set', () => {
    render(<ErrorAlert message="No dismiss" />)
    expect(screen.queryByRole('button', { name: /dismiss/i })).toBeNull()
  })
})
