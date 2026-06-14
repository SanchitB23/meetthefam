/**
 * @vitest-environment jsdom
 *
 * #185 regression tests — Edit Person modal photo upload.
 *
 * Guards two acceptance criteria from the issue:
 *   1. Uploading a photo in edit mode shows an in-modal success notification.
 *   2. The modal stays open after the upload (onOpenChange(false) is NOT called).
 *
 * Strategy: render PersonForm with mode="edit" in a controlled wrapper, mock
 * `uploadPersonPhoto` to return { ok: true, photoUrl: '...' }, simulate a file
 * pick via the hidden <input type="file">, and assert the notification appears
 * without the modal being dismissed.
 *
 * We do NOT exercise the Dialog/Sheet chrome (too many @base-ui/react internals
 * to mock) — instead we extract just the "form body" by rendering PersonForm
 * with open=true and asserting on the DOM. The modal close signal is captured
 * via the onOpenChange spy: it must NOT be called with false during/after upload.
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { PersonRow } from '@/app/(app)/tree/[id]/_lib/types'

// ---- Module stubs ----------------------------------------------------------

// Stub next/cache so the Server Action can import without the Next.js runtime.
vi.mock('next/cache', () => ({
  refresh: vi.fn(),
  revalidatePath: vi.fn(),
}))

// Stub the Server Actions. uploadPersonPhoto is the only one we exercise here.
const mockUploadPersonPhoto = vi.fn()
vi.mock('@/app/(app)/tree/[id]/actions', () => ({
  uploadPersonPhoto: (...args: unknown[]) => mockUploadPersonPhoto(...args),
  // Provide no-op stubs for other actions imported by PersonForm.
  createPerson: vi.fn(),
  updatePerson: vi.fn(),
  removePersonPhoto: vi.fn(),
}))

// Stub useIsDesktop to always return true (desktop Dialog) so we get a stable
// surface without needing jsdom to implement matchMedia fully.
vi.mock('@/components/ui/use-is-desktop', () => ({
  useIsDesktop: () => true,
}))

// Stub the image resize utility — PersonForm no longer calls resizeToJpeg
// directly (cropping moved into PhotoCropDialog), but we keep both stubs
// so modules that import either symbol don't blow up.
vi.mock('@/lib/image/resize', () => ({
  cropAndResizeToJpeg: vi.fn(),
  resizeToJpeg: vi.fn(),
  ImageDecodeError: class ImageDecodeError extends Error {},
}))

// Stub next/dynamic so the lazily-loaded PhotoCropDialog resolves
// synchronously to a controllable stub.
// NOTE: react-hooks/rules-of-hooks requires the returned component to be a
// NAMED function, not an anonymous arrow.
vi.mock('next/dynamic', () => ({
  default: () =>
    function PhotoCropDialogStub({
      onConfirm,
      onCancel,
    }: {
      onConfirm: (blob: Blob) => void
      onCancel: (reason?: string) => void
    }) {
      return (
        <div data-testid="crop-dialog-stub">
          <button
            type="button"
            onClick={() => onConfirm(new Blob(['cropped'], { type: 'image/jpeg' }))}
          >
            Use photo
          </button>
          <button type="button" onClick={() => onCancel()}>
            Cancel crop
          </button>
        </div>
      )
    },
}))

// ---- Subject under test  ---------------------------------------------------
// Import AFTER the mocks are registered (Vitest hoists vi.mock to the top).
import { PersonForm } from '@/app/(app)/tree/[id]/_components/PersonForm'

// ---- Fixtures --------------------------------------------------------------

const TREE_ID = 'tree-aaa'
const PERSON_ROW: PersonRow = {
  id: 'person-111',
  tree_id: TREE_ID,
  full_name: 'Ada Lovelace',
  nickname: null,
  bio: null,
  gender: 'f',
  birth_year: 1815,
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

// ---- Helpers ---------------------------------------------------------------

/** Minimal JPEG magic bytes to satisfy basic type checks. */
function makeJpegFile(name = 'avatar.jpg'): File {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
  return new File([bytes], name, { type: 'image/jpeg' })
}

// ---- Tests -----------------------------------------------------------------

describe('PersonForm — photo upload in edit mode (#185)', () => {
  let onOpenChange: ReturnType<typeof vi.fn<(open: boolean) => void>>

  beforeEach(() => {
    onOpenChange = vi.fn<(open: boolean) => void>()
    mockUploadPersonPhoto.mockReset()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  it('shows "Photo uploaded" success notification after a successful upload', async () => {
    mockUploadPersonPhoto.mockResolvedValue({
      ok: true,
      photoUrl: 'https://example.com/avatar.jpg',
    })

    render(
      <PersonForm
        open={true}
        onOpenChange={onOpenChange}
        treeId={TREE_ID}
        mode="edit"
        person={PERSON_ROW}
      />,
    )

    // Locate the hidden file input via aria-hidden attribute.
    const fileInput = document.querySelector<HTMLInputElement>(
      'input[type="file"][aria-hidden="true"]',
    )
    expect(fileInput).not.toBeNull()

    // Simulate the user picking a photo.
    await act(async () => {
      fireEvent.change(fileInput!, {
        target: { files: [makeJpegFile()] },
      })
    })

    // Confirm the crop — the upload fires after this step.
    const cropDialog = await screen.findByTestId('crop-dialog-stub')
    fireEvent.click(within(cropDialog).getByRole('button', { name: /use photo/i, hidden: true }))

    // Wait for the upload to complete and the notification to appear.
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeTruthy()
    })
    expect(screen.getByText('Photo uploaded')).toBeTruthy()
  })

  it('does NOT call onOpenChange(false) during or after a successful photo upload', async () => {
    mockUploadPersonPhoto.mockResolvedValue({
      ok: true,
      photoUrl: 'https://example.com/avatar.jpg',
    })

    render(
      <PersonForm
        open={true}
        onOpenChange={onOpenChange}
        treeId={TREE_ID}
        mode="edit"
        person={PERSON_ROW}
      />,
    )

    const fileInput = document.querySelector<HTMLInputElement>(
      'input[type="file"][aria-hidden="true"]',
    )
    expect(fileInput).not.toBeNull()

    await act(async () => {
      fireEvent.change(fileInput!, {
        target: { files: [makeJpegFile()] },
      })
    })

    // Confirm the crop — the upload fires after this step.
    const cropDialog = await screen.findByTestId('crop-dialog-stub')
    fireEvent.click(within(cropDialog).getByRole('button', { name: /use photo/i, hidden: true }))

    // Upload resolves — notification should be visible.
    await waitFor(() => {
      expect(screen.queryByText('Photo uploaded')).toBeTruthy()
    })

    // The modal must remain open: onOpenChange should NOT have been called with false.
    const closeCalls = onOpenChange.mock.calls.filter(([v]) => v === false)
    expect(closeCalls).toHaveLength(0)
  })

  it('does NOT call onOpenChange(false) when a new PersonRow reference arrives via refresh()', async () => {
    // This guards against the core #185 regression: `refresh()` causes the
    // parent to pass a new PersonRow object (same data, new JS reference),
    // which previously triggered the reset-on-open useEffect and could
    // trigger a close via the form machinery.
    mockUploadPersonPhoto.mockResolvedValue({
      ok: true,
      photoUrl: 'https://example.com/avatar.jpg',
    })

    const { rerender } = render(
      <PersonForm
        open={true}
        onOpenChange={onOpenChange}
        treeId={TREE_ID}
        mode="edit"
        person={PERSON_ROW}
      />,
    )

    const fileInput = document.querySelector<HTMLInputElement>(
      'input[type="file"][aria-hidden="true"]',
    )
    await act(async () => {
      fireEvent.change(fileInput!, {
        target: { files: [makeJpegFile()] },
      })
    })

    // Confirm the crop — the upload fires after this step.
    const cropDialog = await screen.findByTestId('crop-dialog-stub')
    fireEvent.click(within(cropDialog).getByRole('button', { name: /use photo/i, hidden: true }))

    await waitFor(() => {
      expect(screen.queryByText('Photo uploaded')).toBeTruthy()
    })

    // Simulate refresh(): parent delivers a new PersonRow object with the
    // same values but a different JS reference (new photo_url from server).
    const refreshedPerson: PersonRow = {
      ...PERSON_ROW,
      photo_url: 'https://example.com/avatar.jpg',
    }
    await act(async () => {
      rerender(
        <PersonForm
          open={true}
          onOpenChange={onOpenChange}
          treeId={TREE_ID}
          mode="edit"
          person={refreshedPerson}
        />,
      )
    })

    // Modal must still be open — no false call on onOpenChange.
    const closeCalls = onOpenChange.mock.calls.filter(([v]) => v === false)
    expect(closeCalls).toHaveLength(0)

    // Full name field must retain its value (form not reset mid-session).
    const nameInput = document.querySelector<HTMLInputElement>('#pf-full-name')
    expect(nameInput?.value).toBe('Ada Lovelace')
  })

  it('opens the crop dialog after picking a file (no immediate upload)', async () => {
    mockUploadPersonPhoto.mockResolvedValue({
      ok: true,
      photoUrl: 'https://example.com/avatar.jpg',
    })

    render(
      <PersonForm
        open={true}
        onOpenChange={onOpenChange}
        treeId={TREE_ID}
        mode="edit"
        person={PERSON_ROW}
      />,
    )

    const fileInput = document.querySelector<HTMLInputElement>(
      'input[type="file"][aria-hidden="true"]',
    )
    expect(fileInput).not.toBeNull()

    await act(async () => {
      fireEvent.change(fileInput!, {
        target: { files: [makeJpegFile()] },
      })
    })

    // Crop dialog should appear immediately after picking.
    expect(await screen.findByTestId('crop-dialog-stub')).toBeInTheDocument()
    // Upload must NOT have fired yet — only happens after crop confirm.
    expect(mockUploadPersonPhoto).not.toHaveBeenCalled()
  })

  it('cancelling the crop discards the pick and uploads nothing', async () => {
    mockUploadPersonPhoto.mockResolvedValue({
      ok: true,
      photoUrl: 'https://example.com/avatar.jpg',
    })

    render(
      <PersonForm
        open={true}
        onOpenChange={onOpenChange}
        treeId={TREE_ID}
        mode="edit"
        person={PERSON_ROW}
      />,
    )

    const fileInput = document.querySelector<HTMLInputElement>(
      'input[type="file"][aria-hidden="true"]',
    )
    expect(fileInput).not.toBeNull()

    await act(async () => {
      fireEvent.change(fileInput!, {
        target: { files: [makeJpegFile()] },
      })
    })

    const cropDialog = await screen.findByTestId('crop-dialog-stub')
    fireEvent.click(within(cropDialog).getByRole('button', { name: /cancel crop/i, hidden: true }))

    await waitFor(() =>
      expect(screen.queryByTestId('crop-dialog-stub')).not.toBeInTheDocument(),
    )
    expect(mockUploadPersonPhoto).not.toHaveBeenCalled()
  })
})
