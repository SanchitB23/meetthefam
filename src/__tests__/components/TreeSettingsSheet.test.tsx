// src/__tests__/components/TreeSettingsSheet.test.tsx
/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TreeSettingsSheet } from '@/app/(app)/tree/[id]/_components/TreeSettingsSheet'

// Force desktop layout so the Dialog (not the Sheet) renders — both render
// the same Tabs body, but Dialog has a stable DOM order easier to assert on.
vi.mock('@/components/ui/use-is-desktop', () => ({
  useIsDesktop: () => true,
}))

const baseProps = {
  treeId: 't1',
  treeName: 'Smith Family',
  currentUserId: 'u1',
  members: [
    {
      user_id: 'u1',
      display_name: 'You',
      avatar_url: null,
      role: 'owner' as const,
      joined_at: new Date().toISOString(),
    },
  ],
  pendingInvites: [],
  shareToken: null,
  baseUrl: 'https://example.com',
}

describe('TreeSettingsSheet', () => {
  it('owner sees all three tabs (General, Members, Visitors)', () => {
    render(
      <TreeSettingsSheet
        {...baseProps}
        currentUserRole="owner"
        open
        onOpenChange={() => {}}
      />,
    )
    expect(screen.getByRole('tab', { name: /general/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /members/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /visitors/i })).toBeTruthy()
  })

  it('owner opens to General by default', () => {
    render(
      <TreeSettingsSheet
        {...baseProps}
        currentUserRole="owner"
        open
        onOpenChange={() => {}}
      />,
    )
    const general = screen.getByRole('tab', { name: /general/i })
    expect(general.getAttribute('aria-selected')).toBe('true')
  })

  it('editor sees only Members and Visitors — no General, no Rename, no Delete', () => {
    render(
      <TreeSettingsSheet
        {...baseProps}
        currentUserRole="editor"
        open
        onOpenChange={() => {}}
      />,
    )
    expect(screen.queryByRole('tab', { name: /general/i })).toBeNull()
    expect(screen.getByRole('tab', { name: /members/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /visitors/i })).toBeTruthy()
    // Belt-and-braces: no controls labelled Rename or Delete anywhere.
    expect(screen.queryByRole('button', { name: /rename/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull()
  })

  it('editor opens to Members by default', () => {
    render(
      <TreeSettingsSheet
        {...baseProps}
        currentUserRole="editor"
        open
        onOpenChange={() => {}}
      />,
    )
    const members = screen.getByRole('tab', { name: /members/i })
    expect(members.getAttribute('aria-selected')).toBe('true')
  })

  it('controlled mode invokes onOpenChange(false) when the dialog requests close', () => {
    const onOpenChange = vi.fn()
    render(
      <TreeSettingsSheet
        {...baseProps}
        currentUserRole="owner"
        open
        onOpenChange={onOpenChange}
      />,
    )
    // Base UI Dialog close button has aria-label "Close" by default; we keep
    // that conventional. If our wrapper renames it, adjust here.
    const closeBtn = screen.getByRole('button', { name: /close/i })
    closeBtn.click()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
