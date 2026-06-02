/**
 * @vitest-environment jsdom
 *
 * #181 regression tests — PersonForm pending-state UX.
 *
 * Guards two acceptance criteria:
 *   1. The submit button shows a Loader2 spinner + "Adding…" copy while the
 *      Server Action is in-flight (create mode).
 *   2. The submit button shows "Saving…" copy while in-flight (edit mode).
 *
 * Strategy: render PersonForm with mode="create" or mode="edit" in a controlled
 * wrapper. Mock `createPerson` / `updatePerson` to return a never-resolving
 * promise so we can assert the pending state mid-flight. We do NOT exercise the
 * full Dialog/Sheet chrome — instead we render with open=true and assert on the
 * DOM, consistent with the photo-upload.test.tsx pattern.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PersonRow } from '@/app/(app)/tree/[id]/_lib/types'

// ---- Module stubs ----------------------------------------------------------

vi.mock('next/cache', () => ({
  refresh: vi.fn(),
  revalidatePath: vi.fn(),
}))

// createPerson is set to a never-resolving promise in each test that needs it.
const mockCreatePerson = vi.fn()
const mockUpdatePerson = vi.fn()
vi.mock('@/app/(app)/tree/[id]/actions', () => ({
  createPerson: (...args: unknown[]) => mockCreatePerson(...args),
  updatePerson: (...args: unknown[]) => mockUpdatePerson(...args),
  uploadPersonPhoto: vi.fn(),
  removePersonPhoto: vi.fn(),
}))

vi.mock('@/components/ui/use-is-desktop', () => ({
  useIsDesktop: () => true,
}))

vi.mock('@/lib/image/resize', () => ({
  resizeToJpeg: vi.fn(),
  ImageDecodeError: class ImageDecodeError extends Error {},
}))

// Subject under test — import AFTER mocks.
import { PersonForm } from '@/app/(app)/tree/[id]/_components/PersonForm'

// ---- Fixtures --------------------------------------------------------------

const TREE_ID = 'tree-bbb'
const PERSON_ROW: PersonRow = {
  id: 'person-222',
  tree_id: TREE_ID,
  full_name: 'Grace Hopper',
  nickname: null,
  bio: null,
  gender: 'f',
  birth_year: 1906,
  birth_date: null,
  photo_url: null,
  location: null,
  occupation: null,
  deceased: false,
  death_year: null,
  father_id: null,
  mother_id: null,
  spouse_id: null,
  tone: 'indigo',
}

// ---- Tests -----------------------------------------------------------------

describe('PersonForm — submit pending state (#181)', () => {
  beforeEach(() => {
    mockCreatePerson.mockReset()
    mockUpdatePerson.mockReset()
  })

  it('shows spinner + "Adding…" on the submit button while create action is in-flight', async () => {
    // Never resolves — keeps isPending true throughout the test.
    mockCreatePerson.mockReturnValue(new Promise(() => {}))

    const onOpenChange = vi.fn()
    render(
      <PersonForm
        open={true}
        onOpenChange={onOpenChange}
        treeId={TREE_ID}
        mode="create"
        // No peopleForPicker → first-person path; link block hidden.
        peopleForPicker={[]}
      />,
    )

    // Before submit: button shows normal label.
    const submitBtn = screen.getByRole('button', { name: 'Add person' })
    expect(submitBtn).not.toBeDisabled()

    // Fill in required full_name field.
    const nameInput = screen.getByLabelText(/full name/i)
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'New Person' } })
    })

    // Submit the form.
    await act(async () => {
      fireEvent.click(submitBtn)
    })

    // After submit: button is disabled and shows "Adding…".
    await waitFor(() => {
      const pendingBtn = screen.getByRole('button', { name: /adding…/i })
      expect(pendingBtn).toBeDisabled()
    })
  })

  it('shows "Saving…" on the submit button while update action is in-flight', async () => {
    // Never resolves — keeps isPending true throughout the test.
    mockUpdatePerson.mockReturnValue(new Promise(() => {}))

    const onOpenChange = vi.fn()
    render(
      <PersonForm
        open={true}
        onOpenChange={onOpenChange}
        treeId={TREE_ID}
        mode="edit"
        person={PERSON_ROW}
      />,
    )

    // Before submit: button shows normal label.
    const submitBtn = screen.getByRole('button', { name: 'Save changes' })
    expect(submitBtn).not.toBeDisabled()

    // Submit the form (name is already pre-filled from PERSON_ROW).
    await act(async () => {
      fireEvent.click(submitBtn)
    })

    // After submit: button is disabled and shows "Saving…".
    await waitFor(() => {
      const pendingBtn = screen.getByRole('button', { name: /saving…/i })
      expect(pendingBtn).toBeDisabled()
    })
  })
})
