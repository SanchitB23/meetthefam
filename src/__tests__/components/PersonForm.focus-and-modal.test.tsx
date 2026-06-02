/**
 * @vitest-environment jsdom
 *
 * #182 + #183 — add-person focus flow tests.
 *
 * Covers:
 *   1. (#182) Full Name input does NOT have the autoFocus attribute.
 *   2. (#182) Link-to picker trigger receives focus when the form opens in
 *      create mode with candidate people (showLinkingBlock = true), via the
 *      requestAnimationFrame scheduled in the open useEffect.
 *   3. (#183) Standalone-confirm modal: Cancel is the primary (filled/bg-primary)
 *      button, "Add as Standalone" is the secondary (outline/border-border) button.
 *   4. (#183) Button text reads "Add as Standalone" not "Add anyway".
 *   5. (#183) Cancel click closes the confirm modal and returns focus to the
 *      Link-to picker trigger.
 *
 * Strategy:
 *   - Render PersonForm in create mode with a non-empty peopleForPicker list.
 *   - Mock useIsDesktop → true (stable desktop Dialog surface).
 *   - Mock all Server Actions and image/resize utilities.
 *   - For tests involving the standalone-confirm Dialog, mock Dialog + Sheet
 *     so their content renders inline (no portal), bypassing @base-ui/react's
 *     jsdom-incompatible portal/animation stack. The mock preserves the `open`
 *     prop gate so confirm buttons only appear after the form submit triggers
 *     setConfirmStandaloneOpen(true).
 *   - The standalone-confirm Dialog is the second Dialog rendered in the tree
 *     (after the main form surface Dialog). Tests select it by index.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import type { PersonRow } from '@/app/(app)/tree/[id]/_lib/types'

// ---- Module stubs ----------------------------------------------------------

// Stub next/cache so Server Actions can import without the Next.js runtime.
vi.mock('next/cache', () => ({
  refresh: vi.fn(),
  revalidatePath: vi.fn(),
}))

// Stub Server Actions.
const mockCreatePerson = vi.fn()
vi.mock('@/app/(app)/tree/[id]/actions', () => ({
  createPerson: (...args: unknown[]) => mockCreatePerson(...args),
  updatePerson: vi.fn(),
  uploadPersonPhoto: vi.fn(),
  removePersonPhoto: vi.fn(),
}))

// Stub useIsDesktop → true for a stable Dialog surface.
vi.mock('@/components/ui/use-is-desktop', () => ({
  useIsDesktop: () => true,
}))

// Stub image resize.
vi.mock('@/lib/image/resize', () => ({
  resizeToJpeg: vi.fn(async (file: File) => ({
    blob: new Blob([await file.arrayBuffer()], { type: 'image/jpeg' }),
  })),
  ImageDecodeError: class ImageDecodeError extends Error {},
}))

// Stub Dialog + Sheet so content renders inline without portals/animations.
// Each Dialog renders its children inside a div gated on `open`, and appends a
// `data-dialog-index` attribute (incremented across renders via a counter)
// so tests can select the main-form Dialog vs the standalone-confirm Dialog.
let dialogCounter = 0
vi.mock('@/components/ui/dialog', () => {
  return {
    Dialog: ({
      open,
      children,
    }: {
      open?: boolean
      children?: React.ReactNode
      onOpenChange?: (v: boolean) => void
    }) => {
      // Each Dialog instance gets a stable index from the render order.
      const idxRef = React.useRef<number | null>(null)
      if (idxRef.current === null) {
        idxRef.current = dialogCounter++
      }
      return open
        ? React.createElement(
            'div',
            { 'data-testid': 'dialog', 'data-dialog-index': idxRef.current },
            children,
          )
        : null
    },
    DialogContent: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', { 'data-testid': 'dialog-content' }, children),
    DialogHeader: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    DialogTitle: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('h2', null, children),
    DialogDescription: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('p', null, children),
  }
})

vi.mock('@/components/ui/sheet', () => {
  return {
    Sheet: ({
      open,
      children,
    }: {
      open?: boolean
      children?: React.ReactNode
      onOpenChange?: (v: boolean) => void
    }) =>
      open
        ? React.createElement('div', { 'data-testid': 'sheet', 'data-open': 'true' }, children)
        : null,
    SheetContent: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    SheetHeader: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    SheetTitle: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('h2', null, children),
    SheetDescription: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('p', null, children),
  }
})

// ---- Subject under test  ---------------------------------------------------
import { PersonForm } from '@/app/(app)/tree/[id]/_components/PersonForm'

// ---- Fixtures --------------------------------------------------------------

const TREE_ID = 'tree-bbb'

const ALICE: PersonRow = {
  id: 'person-alice',
  tree_id: TREE_ID,
  full_name: 'Alice Smith',
  nickname: null,
  bio: null,
  gender: 'f',
  birth_year: null,
  birth_date: null,
  photo_url: null,
  location: null,
  occupation: null,
  deceased: false,
  death_year: null,
  father_id: null,
  mother_id: null,
  spouse_id: null,
  tone: 'rose',
}

const BOB: PersonRow = {
  id: 'person-bob',
  tree_id: TREE_ID,
  full_name: 'Bob Smith',
  nickname: null,
  bio: null,
  gender: 'm',
  birth_year: null,
  birth_date: null,
  photo_url: null,
  location: null,
  occupation: null,
  deceased: false,
  death_year: null,
  father_id: null,
  mother_id: null,
  spouse_id: null,
  tone: 'sage',
}

const PEOPLE: PersonRow[] = [ALICE, BOB]

// ---- Helpers ---------------------------------------------------------------

function renderCreateForm() {
  dialogCounter = 0
  const onOpenChange = vi.fn<(open: boolean) => void>()
  const utils = render(
    <PersonForm
      open={true}
      onOpenChange={onOpenChange}
      treeId={TREE_ID}
      mode="create"
      peopleForPicker={PEOPLE}
    />,
  )
  return { ...utils, onOpenChange }
}

/**
 * Trigger the standalone-confirm Dialog by typing a name then clicking "Add
 * person" without selecting a Link-to target.
 */
async function openStandaloneModal() {
  const helpers = renderCreateForm()

  const nameInput = document.querySelector<HTMLInputElement>('#pf-full-name')
  expect(nameInput).not.toBeNull()
  await act(async () => {
    fireEvent.change(nameInput!, { target: { value: 'Charlie' } })
  })

  const submitBtn = screen.getByRole('button', { name: /add person/i })
  await act(async () => {
    fireEvent.click(submitBtn)
  })

  return helpers
}

/**
 * Return the standalone-confirm dialog element. It is the second Dialog in
 * document order (the first is the main form surface).
 */
function getConfirmDialog(): HTMLElement | null {
  const dialogs = document.querySelectorAll('[data-testid="dialog"]')
  // The standalone confirm is rendered after the main form Dialog.
  return (dialogs[1] as HTMLElement) ?? null
}

// ---- Tests -----------------------------------------------------------------

describe('PersonForm — #182 Link-to auto-focus on open', () => {
  beforeEach(() => {
    mockCreatePerson.mockReset()
  })

  it('Full Name input does NOT have the autoFocus attribute', () => {
    renderCreateForm()
    const nameInput = document.querySelector<HTMLInputElement>('#pf-full-name')
    expect(nameInput).not.toBeNull()
    expect(nameInput?.hasAttribute('autofocus')).toBe(false)
  })

  it('Link-to picker trigger is accessible by aria-label when the form opens', async () => {
    renderCreateForm()
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /pick someone to link to/i }),
      ).toBeTruthy()
    })
  })

  it('Link-to picker trigger receives focus via requestAnimationFrame on open', async () => {
    vi.useFakeTimers()

    renderCreateForm()

    // Flush the requestAnimationFrame scheduled by the open useEffect.
    await act(async () => {
      vi.runAllTimers()
    })

    const trigger = screen.getByRole('button', { name: /pick someone to link to/i })
    expect(document.activeElement).toBe(trigger)

    vi.useRealTimers()
  })
})

describe('PersonForm — #183 standalone-confirm modal button variants', () => {
  beforeEach(() => {
    mockCreatePerson.mockReset()
  })

  it('standalone-confirm shows "Add as Standalone" button (not "Add anyway")', async () => {
    await openStandaloneModal()

    await waitFor(() => {
      // Confirm modal must have appeared.
      const confirm = getConfirmDialog()
      expect(confirm).not.toBeNull()
    })

    expect(screen.getAllByRole('button', { name: /add as standalone/i }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /add anyway/i })).toBeNull()
  })

  it('Cancel button in the standalone-confirm dialog has the primary (bg-primary) variant', async () => {
    await openStandaloneModal()

    await waitFor(() => {
      expect(getConfirmDialog()).not.toBeNull()
    })

    const confirm = getConfirmDialog()!
    const cancelBtn = Array.from(confirm.querySelectorAll('button')).find(
      (b) => /^cancel$/i.test(b.textContent?.trim() ?? ''),
    )
    expect(cancelBtn).not.toBeNull()
    // `default` variant → bg-primary class via CVA in button.tsx
    expect(cancelBtn?.className).toContain('bg-primary')
  })

  it('"Add as Standalone" button in the standalone-confirm dialog has the outline (border-border) variant', async () => {
    await openStandaloneModal()

    await waitFor(() => {
      expect(getConfirmDialog()).not.toBeNull()
    })

    const confirm = getConfirmDialog()!
    const addBtn = Array.from(confirm.querySelectorAll('button')).find(
      (b) => /add as standalone/i.test(b.textContent ?? ''),
    )
    expect(addBtn).not.toBeNull()
    // `outline` variant → border-border class via CVA in button.tsx
    expect(addBtn?.className).toContain('border-border')
  })

  it('Cancel click closes the confirm modal and returns focus to the Link-to picker trigger', async () => {
    // Open the standalone confirm (uses real timers here so waitFor works).
    await openStandaloneModal()

    await waitFor(() => {
      expect(getConfirmDialog()).not.toBeNull()
    })

    const confirm = getConfirmDialog()!
    const cancelBtn = Array.from(confirm.querySelectorAll('button')).find(
      (b) => /^cancel$/i.test(b.textContent?.trim() ?? ''),
    )
    expect(cancelBtn).not.toBeNull()

    // Switch to fake timers only for the rAF-dependent focus-return step.
    vi.useFakeTimers()

    await act(async () => {
      fireEvent.click(cancelBtn!)
      // Flush the requestAnimationFrame scheduled inside the Cancel handler.
      vi.runAllTimers()
    })

    vi.useRealTimers()

    // After Cancel + rAF flush, the standalone confirm Dialog must be gone.
    expect(getConfirmDialog()).toBeNull()

    // The Link-to picker trigger must have received focus.
    const trigger = screen.getByRole('button', { name: /pick someone to link to/i })
    expect(document.activeElement).toBe(trigger)
  })
})
