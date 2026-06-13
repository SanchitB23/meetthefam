/**
 * @vitest-environment jsdom
 *
 * PhotoCropDialog behavior tests. react-easy-crop is stubbed: it
 * reports a fixed croppedAreaPixels on mount (mimicking the library's
 * initial onCropComplete fire) and renders a placeholder div. The
 * image lib is mocked — no real canvas in jsdom.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const FIXED_AREA = { x: 10, y: 20, width: 100, height: 100 }

vi.mock('react-easy-crop', async () => {
  const { useEffect } = await import('react')
  return {
    default: function CropperStub({ onCropComplete }: {
      onCropComplete: (a: unknown, b: typeof FIXED_AREA) => void
    }) {
      // Fire once on mount like the real library does after media load.
      useEffect(() => {
        onCropComplete({ x: 0, y: 0, width: 100, height: 100 }, FIXED_AREA)
      }, [onCropComplete])
      return <div data-testid="cropper-stub" />
    },
  }
})

const mockCropAndResize = vi.fn()
vi.mock('@/lib/image/resize', () => ({
  cropAndResizeToJpeg: (...args: unknown[]) => mockCropAndResize(...args),
  ImageDecodeError: class ImageDecodeError extends Error {},
}))

vi.mock('@/components/ui/use-is-desktop', () => ({
  useIsDesktop: () => true,
}))

import { PhotoCropDialog } from '@/app/(app)/tree/[id]/_components/PhotoCropDialog'

const makeFile = () => new File(['x'], 'photo.jpg', { type: 'image/jpeg' })

describe('PhotoCropDialog', () => {
  beforeEach(() => {
    mockCropAndResize.mockReset()
    // jsdom has no createObjectURL.
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock')
    globalThis.URL.revokeObjectURL = vi.fn()
  })

  it('renders the crop stage when given a file', () => {
    render(
      <PhotoCropDialog file={makeFile()} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(screen.getByTestId('cropper-stub')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /use photo/i })).toBeInTheDocument()
  })

  it('confirms with the encoded blob from cropAndResizeToJpeg', async () => {
    const blob = new Blob(['jpeg'], { type: 'image/jpeg' })
    mockCropAndResize.mockResolvedValue({ blob, width: 100, height: 100 })
    const onConfirm = vi.fn()
    const file = makeFile()

    render(<PhotoCropDialog file={file} onConfirm={onConfirm} onCancel={vi.fn()} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /use photo/i }))
    })

    expect(mockCropAndResize).toHaveBeenCalledWith(file, FIXED_AREA)
    expect(onConfirm).toHaveBeenCalledWith(blob)
  })

  it('shows an inline error and keeps the dialog open when encoding fails', async () => {
    mockCropAndResize.mockRejectedValue(new Error('canvas exploded'))
    const onConfirm = vi.fn()

    render(<PhotoCropDialog file={makeFile()} onConfirm={onConfirm} onCancel={vi.fn()} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /use photo/i }))
    })

    expect(onConfirm).not.toHaveBeenCalled()
    expect(
      screen.getByText(/couldn't process the photo/i),
    ).toBeInTheDocument()
  })

  it('calls onCancel from the Cancel button', () => {
    const onCancel = vi.fn()
    render(<PhotoCropDialog file={makeFile()} onConfirm={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('revokes the object URL on unmount', () => {
    const { unmount } = render(
      <PhotoCropDialog file={makeFile()} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock')
  })
})
