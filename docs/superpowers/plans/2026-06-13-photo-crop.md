# Photo Crop-Before-Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users crop their photo (1:1, round mask) between picking a file and uploading, per issue #236 and the approved spec `docs/superpowers/specs/2026-06-13-photo-crop-design.md`.

**Architecture:** A new `PhotoCropDialog` client component (Dialog on desktop / bottom Sheet on mobile, sibling of the person form's surface) hosts `react-easy-crop`; it produces a finished JPEG Blob via a new `cropAndResizeToJpeg()` in the existing image lib, and hands it to `PersonForm`'s unchanged upload (edit) / stash (create) branches. Destructive crop — no schema, Storage, or RLS changes.

**Tech Stack:** Next.js 16, React 19, `react-easy-crop@6`, Base UI Dialog/Sheet wrappers (`src/components/ui/dialog.tsx`, `sheet.tsx`), Vitest + Testing Library (jsdom).

**Context:** Today `onPickPhoto` in `PersonForm.tsx` pipes the picked file straight through `resizeToJpeg()` (`src/lib/image/resize.ts`) and uploads; the avatar's visible crop is CSS-centered, so off-center subjects get cut off with no recourse. Decisions locked in the spec: destructive crop, nested dialog placement, `react-easy-crop`, 1:1 round mask, downstream pipeline unchanged.

**Worktree:** already set up — `feat/236-photo-crop` at `.claude/worktrees/feat+236-photo-crop`, based on `origin/qa`, deps installed, baseline green (508 tests). **Run all commands with Node 24:** `export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"` (shell defaults to Node 20, which breaks Supabase-touching tests).

---

### Task 1: Add the `react-easy-crop` dependency

**Files:**
- Modify: `package.json` (+ lockfile)

- [ ] **Step 1: Install**

```bash
pnpm add react-easy-crop
```

Expected: `react-easy-crop ^6.x` lands in `dependencies`. It's pure JS — **no postinstall script**, so no `pnpm.onlyBuiltDependencies` change is needed.

- [ ] **Step 2: Sanity-check the import surface**

```bash
node -e "const m = require('./node_modules/react-easy-crop/package.json'); console.log(m.version, m.peerDependencies)"
```

Expected: version `6.x`, peers `react >= 16.4`.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(#236): add react-easy-crop for avatar cropping

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: `clampCropRect` + `cropAndResizeToJpeg` in the image lib (TDD)

**Files:**
- Modify: `src/lib/image/resize.ts`
- Test: `src/__tests__/lib/image/resize-crop.test.ts` (new)

The crop rect from `react-easy-crop` (`croppedAreaPixels`) can have fractional values and ±1px overshoot at image edges. `clampCropRect` is the pure, unit-testable safety net; `cropAndResizeToJpeg` is a thin orchestration over the existing `drawAndEncode` (which gains an optional source-rect param). Canvas APIs don't exist in jsdom, so unit tests cover the pure helper only — `cropAndResizeToJpeg` itself is covered by the component tests (mocked) and manual QA (real).

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/lib/image/resize-crop.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 *
 * Unit tests for the pure crop-rect clamping helper that guards
 * cropAndResizeToJpeg against fractional / out-of-bounds rects coming
 * from react-easy-crop's croppedAreaPixels.
 */
import { describe, it, expect } from 'vitest'
import { clampCropRect } from '@/lib/image/resize'

describe('clampCropRect', () => {
  it('passes through an in-bounds integer rect unchanged', () => {
    expect(clampCropRect({ x: 10, y: 20, width: 100, height: 100 }, 200, 200))
      .toEqual({ x: 10, y: 20, width: 100, height: 100 })
  })

  it('rounds fractional values to integers', () => {
    expect(clampCropRect({ x: 9.6, y: 19.4, width: 100.5, height: 99.5 }, 200, 200))
      .toEqual({ x: 10, y: 19, width: 101, height: 100 })
  })

  it('clamps negative origin to 0', () => {
    expect(clampCropRect({ x: -3, y: -1, width: 100, height: 100 }, 200, 200))
      .toEqual({ x: 0, y: 0, width: 100, height: 100 })
  })

  it('shrinks width/height that overshoot the source bounds', () => {
    expect(clampCropRect({ x: 150, y: 150, width: 100, height: 100 }, 200, 200))
      .toEqual({ x: 150, y: 150, width: 50, height: 50 })
  })

  it('never returns a rect smaller than 1x1', () => {
    expect(clampCropRect({ x: 199.9, y: 199.9, width: 0.05, height: 0.05 }, 200, 200))
      .toEqual({ x: 199, y: 199, width: 1, height: 1 })
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

```bash
pnpm test -- run src/__tests__/lib/image/resize-crop.test.ts
```

Expected: FAIL — `clampCropRect` is not exported.

- [ ] **Step 3: Implement in `src/lib/image/resize.ts`**

Add after the `ResizeResult` type:

```ts
/** Pixel rect from react-easy-crop's croppedAreaPixels. */
export type CropRect = {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Snap a crop rect to integers and clamp it inside the source bitmap.
 * react-easy-crop emits fractional values and can overshoot the image
 * edge by a sub-pixel; drawImage tolerates that, but clamping keeps the
 * output dimensions honest. Always returns at least a 1x1 rect.
 */
export function clampCropRect(
  crop: CropRect,
  srcW: number,
  srcH: number,
): CropRect {
  const x = Math.min(Math.max(Math.round(crop.x), 0), srcW - 1)
  const y = Math.min(Math.max(Math.round(crop.y), 0), srcH - 1)
  const width = Math.max(1, Math.min(Math.round(crop.width), srcW - x))
  const height = Math.max(1, Math.min(Math.round(crop.height), srcH - y))
  return { x, y, width, height }
}

/**
 * Crop an image File to `crop` (source-image pixel coordinates, already
 * EXIF-oriented) and re-encode as JPEG, downscaling so the longest side
 * is at most 1024 px. Same error contract as resizeToJpeg.
 */
export async function cropAndResizeToJpeg(
  file: File,
  crop: CropRect,
): Promise<ResizeResult> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch (err) {
    throw new ImageDecodeError(
      'Could not decode the image. Please choose a JPEG or PNG photo.',
      { cause: err },
    )
  }

  const rect = clampCropRect(crop, bitmap.width, bitmap.height)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(rect.width, rect.height))
  const dstW = Math.max(1, Math.round(rect.width * scale))
  const dstH = Math.max(1, Math.round(rect.height * scale))

  const blob = await drawAndEncode(bitmap, dstW, dstH, rect)
  bitmap.close()

  return { blob, width: dstW, height: dstH }
}
```

Extend `drawAndEncode` with an optional source rect (both canvas paths):

```ts
async function drawAndEncode(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  src?: CropRect,
): Promise<Blob> {
  // ...existing OffscreenCanvas branch, with the drawImage call becoming:
  if (src) ctx.drawImage(bitmap, src.x, src.y, src.width, src.height, 0, 0, width, height)
  else ctx.drawImage(bitmap, 0, 0, width, height)
  // ...same change in the detached-<canvas> fallback branch.
}
```

(`resizeToJpeg` keeps calling `drawAndEncode(bitmap, dstW, dstH)` — behavior unchanged.)

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- run src/__tests__/lib/image/resize-crop.test.ts
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/image/resize.ts src/__tests__/lib/image/resize-crop.test.ts
git commit -m "feat(#236): add cropAndResizeToJpeg + clampCropRect to image lib

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: `PhotoCropDialog` component (TDD)

**Files:**
- Create: `src/app/(app)/tree/[id]/_components/PhotoCropDialog.tsx`
- Test: `src/__tests__/components/PhotoCropDialog.test.tsx` (new)

Responsive surface mirrors `PersonForm`'s `surface` block (`PersonForm.tsx:1264-1287`): `Dialog`/`DialogContent` on desktop, `Sheet`/`SheetContent side="bottom"` on mobile, switched by `useIsDesktop`. The component imports `react-easy-crop` directly — lazy-loading happens one level up (Task 4) by `next/dynamic`-importing this whole component.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/components/PhotoCropDialog.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 *
 * PhotoCropDialog behavior tests. react-easy-crop is stubbed: it
 * reports a fixed croppedAreaPixels on mount (mimicking the library's
 * initial onCropComplete fire) and renders a placeholder div. The
 * image lib is mocked — no real canvas in jsdom.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const FIXED_AREA = { x: 10, y: 20, width: 100, height: 100 }

vi.mock('react-easy-crop', async () => {
  const { useEffect } = await import('react')
  return {
    default: ({ onCropComplete }: {
      onCropComplete: (a: unknown, b: typeof FIXED_AREA) => void
    }) => {
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
```

- [ ] **Step 2: Run it to make sure it fails**

```bash
pnpm test -- run src/__tests__/components/PhotoCropDialog.test.tsx
```

Expected: FAIL — module `PhotoCropDialog` doesn't exist.

- [ ] **Step 3: Implement `PhotoCropDialog.tsx`**

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import Cropper from 'react-easy-crop'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useIsDesktop } from '@/components/ui/use-is-desktop'
import {
  cropAndResizeToJpeg,
  ImageDecodeError,
  type CropRect,
} from '@/lib/image/resize'

type Props = {
  /** The freshly-picked file. Parent renders this component only while non-null. */
  file: File
  /** Receives the finished cropped+encoded JPEG Blob. */
  onConfirm: (blob: Blob) => void
  /** User backed out (Cancel button, overlay click, Esc) OR the file was undecodable. */
  onCancel: (reason?: 'decode-error') => void
}

/**
 * #236 — nested crop step between file pick and upload. Spec:
 * docs/superpowers/specs/2026-06-13-photo-crop-design.md.
 *
 * 1:1 round-mask cropper (react-easy-crop) in a Dialog (desktop) /
 * bottom Sheet (mobile), mounted as a sibling of PersonForm's own
 * surface. Owns the object-URL lifecycle and runs cropAndResizeToJpeg
 * itself — the parent only ever sees a finished Blob.
 */
export function PhotoCropDialog({ file, onConfirm, onCancel }: Props) {
  const desktop = useIsDesktop()

  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [areaPixels, setAreaPixels] = useState<CropRect | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Object-URL lifecycle: one URL per `file`, revoked on swap/unmount.
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setImageUrl(url)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setAreaPixels(null)
    setError(null)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const onCropComplete = useCallback(
    (_area: unknown, croppedAreaPixels: CropRect) => {
      setAreaPixels(croppedAreaPixels)
    },
    [],
  )

  const confirm = async () => {
    if (!areaPixels) return
    setBusy(true)
    setError(null)
    try {
      const result = await cropAndResizeToJpeg(file, areaPixels)
      onConfirm(result.blob)
    } catch (err) {
      setError(
        err instanceof ImageDecodeError
          ? err.message
          : "Couldn't process the photo. Try a different one.",
      )
    } finally {
      setBusy(false)
    }
  }

  const body = (
    <div className="flex flex-col gap-3">
      <div className="relative h-64 sm:h-80 rounded-lg overflow-hidden bg-foreground/90">
        {imageUrl && (
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            mediaProps={{
              // Undecodable file (HEIC on Chrome, corrupt download):
              // bail out to the parent, which surfaces photoError.
              onError: () => onCancel('decode-error'),
            }}
          />
        )}
      </div>
      <label className="flex items-center gap-3 text-sm text-foreground/70">
        Zoom
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="flex-1 accent-primary"
          aria-label="Zoom"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onCancel()} disabled={busy}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={confirm} disabled={busy || !areaPixels}>
          {busy ? 'Processing…' : 'Use photo'}
        </Button>
      </div>
    </div>
  )

  const title = 'Crop photo'
  const description = 'Drag to reposition. Pinch or use the slider to zoom.'
  const handleOpenChange = (open: boolean) => {
    if (!open) onCancel()
  }

  return desktop ? (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  ) : (
    <Sheet open onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="rounded-t-xl">
        <SheetHeader>
          <SheetTitle className="font-serif text-xl">{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {body}
      </SheetContent>
    </Sheet>
  )
}
```

Implementation notes:
- `open` is always true — the **parent** controls visibility by mounting/unmounting (mirrors how `DeletePersonDialog` is conditionally rendered at `PersonForm.tsx:1297`). This keeps all open-state in one place.
- `onCancel('decode-error')` distinguishes the HEIC/corrupt path so the parent can show the "Please choose a JPEG or PNG photo." message instead of silently closing.
- The test's `file` prop is non-nullable; the spec's `file: File | null` shape is realized at the parent as conditional mounting.

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- run src/__tests__/components/PhotoCropDialog.test.tsx
```

Expected: 5 passed. If the Dialog chrome trips jsdom (Base UI portal/focus internals), follow the precedent in `PersonForm.photo-upload.test.tsx` (which renders fine with `useIsDesktop → true`); if a blocker remains, mock `@/components/ui/dialog` to pass-through divs — assert on body content only.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/tree/[id]/_components/PhotoCropDialog.tsx" src/__tests__/components/PhotoCropDialog.test.tsx
git commit -m "feat(#236): PhotoCropDialog — 1:1 round-mask crop step (react-easy-crop)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Wire the cropper into `PersonForm` (TDD)

**Files:**
- Modify: `src/app/(app)/tree/[id]/_components/PersonForm.tsx`
- Modify: `src/__tests__/components/PersonForm.photo-upload.test.tsx`

- [ ] **Step 1: Update the existing test to the new flow (failing first)**

In `src/__tests__/components/PersonForm.photo-upload.test.tsx`:

(a) Replace the `@/lib/image/resize` mock (it's no longer called by PersonForm):

```ts
// PersonForm no longer resizes directly — the crop dialog hands it a
// finished Blob. Keep ImageDecodeError exported for PersonForm's import.
vi.mock('@/lib/image/resize', () => ({
  cropAndResizeToJpeg: vi.fn(),
  resizeToJpeg: vi.fn(),
  ImageDecodeError: class ImageDecodeError extends Error {},
}))
```

(b) Stub `next/dynamic` so the lazy `PhotoCropDialog` resolves synchronously to a controllable stub:

```tsx
// The crop dialog stub: renders confirm/cancel hooks so tests can drive
// the new pick → crop → upload flow without react-easy-crop or canvas.
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
```

(c) In every existing test that simulates a file pick and then asserts on upload, add the crop-confirm step between pick and assertion:

```ts
// after: fireEvent.change(fileInput, { target: { files: [file] } })
const cropDialog = await screen.findByTestId('crop-dialog-stub')
fireEvent.click(within(cropDialog).getByRole('button', { name: /use photo/i }))
// existing waitFor(...) assertions on mockUploadPersonPhoto stay as-is
```

(d) Add two new tests:

```ts
it('opens the crop dialog after picking a file (no immediate upload)', async () => {
  // render edit-mode form, pick a file
  expect(await screen.findByTestId('crop-dialog-stub')).toBeInTheDocument()
  expect(mockUploadPersonPhoto).not.toHaveBeenCalled()
})

it('cancelling the crop discards the pick and uploads nothing', async () => {
  // render edit-mode form, pick a file
  const cropDialog = await screen.findByTestId('crop-dialog-stub')
  fireEvent.click(within(cropDialog).getByRole('button', { name: /cancel crop/i }))
  await waitFor(() =>
    expect(screen.queryByTestId('crop-dialog-stub')).not.toBeInTheDocument(),
  )
  expect(mockUploadPersonPhoto).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run to verify the new/updated tests fail**

```bash
pnpm test -- run src/__tests__/components/PersonForm.photo-upload.test.tsx
```

Expected: FAIL — no crop dialog renders; uploads still fire straight from pick.

- [ ] **Step 3: Implement the PersonForm changes**

(a) Imports — drop `resizeToJpeg`, keep `ImageDecodeError` out (no longer needed in PersonForm), add the lazy dialog:

```tsx
import dynamic from 'next/dynamic'

// #236 — react-easy-crop only loads when a photo is actually picked.
const PhotoCropDialog = dynamic(
  () => import('./PhotoCropDialog').then((m) => m.PhotoCropDialog),
  { ssr: false },
)
```

(b) New state next to the existing photo state block (`PersonForm.tsx:329-336`):

```tsx
// #236 — the freshly-picked file awaiting crop confirmation. Non-null
// while the PhotoCropDialog is up; cleared on confirm/cancel.
const [cropFile, setCropFile] = useState<File | null>(null)
```

(c) `onPickPhoto` (currently `PersonForm.tsx:498-545`) shrinks to a sync handler:

```tsx
// onPick now just stages the file for cropping. Decode validation moved
// into the crop dialog (its <img> onError) — see PhotoCropDialog.
const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (!file) return
  setPhotoError(null)
  setCropFile(file)
  // Reset so the same file can be picked twice in a row.
  if (fileInputRef.current) fileInputRef.current.value = ''
}
```

(d) The former resize-then-branch body becomes the confirm handler — identical edit/create branches, with `resized.blob` replaced by the `blob` argument:

```tsx
// #236 — receives the finished cropped JPEG from PhotoCropDialog.
const onCropConfirm = (blob: Blob) => {
  setCropFile(null)
  if (isEdit && person) {
    setPendingBlob(blob)
    startTransition(async () => {
      const fd = new FormData()
      fd.append('file', blob, 'avatar.jpg')
      const result = await uploadPersonPhoto(treeId, person.id, fd)
      if (result.ok) {
        clearPendingBlob()
        setLocalPhotoUrl(result.photoUrl)
        showPhotoSuccess()
      } else {
        clearPendingBlob()
        setPhotoError(result.error)
      }
    })
  } else {
    // Create mode: hold the Blob in memory until createPerson lands.
    setPendingBlob(blob)
  }
}

const onCropCancel = (reason?: 'decode-error') => {
  setCropFile(null)
  if (reason === 'decode-error') {
    setPhotoError('Please choose a JPEG or PNG photo.')
  }
}
```

(The create-mode submit flush at `PersonForm.tsx:669-685` and `onRemovePhoto` are untouched.)

(e) Mount the dialog as a sibling, in the final fragment next to `DeletePersonDialog` (`PersonForm.tsx:1295+`):

```tsx
{cropFile && (
  <PhotoCropDialog
    file={cropFile}
    onConfirm={onCropConfirm}
    onCancel={onCropCancel}
  />
)}
```

- [ ] **Step 4: Run the photo tests, then the full PersonForm suite**

```bash
pnpm test -- run src/__tests__/components/PersonForm.photo-upload.test.tsx
pnpm test -- run src/__tests__/components/
```

Expected: all pass (pending-state + focus-and-modal suites must stay green — they don't touch the photo path, but they render the same component).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/tree/[id]/_components/PersonForm.tsx" src/__tests__/components/PersonForm.photo-upload.test.tsx
git commit -m "feat(#236): route photo picks through the crop dialog in PersonForm

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Full gates + manual QA on the preview

**Files:** none (verification only)

- [ ] **Step 1: Run all gates**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Expected: 0 type errors, 0 lint errors, full suite green (baseline was 508 tests; now ~518). If `pnpm lint` reports phantom errors from `.claude/worktrees/`, check `git worktree list` for stale agent worktrees (known issue — see CLAUDE.md memory).

- [ ] **Step 2: Manual QA via the preview server** (per `<verification_workflow>`)

Start the dev server (preview_start), then on a tree page:

1. **Edit mode happy path:** open Edit Person → Change photo → pick a large off-center JPEG → crop dialog opens, round mask, pre-centered → drag + zoom (slider) → Use photo → avatar preview updates, in-modal success notification (#185) appears, modal stays open.
2. **Mobile viewport (preview_resize ~390×844):** same flow — crop UI renders inside a bottom Sheet over the form's Sheet; verify stacking (this is the spec's flagged risk — if the nested Sheet misbehaves, STOP and consult the spec's fallback: swap-in view inside the existing Sheet).
3. **Create mode:** Add person → pick photo → crop → confirm → preview shows cropped image → Save → person created with photo (flush path).
4. **Cancel:** pick → Cancel → no upload, no preview change; re-pick the same file works (input reset).
5. **EXIF portrait photo:** a phone portrait shot crops the area you actually framed (orientation consistent between cropper display and output).
6. **HEIC rejection (Chrome):** picking a `.heic` file closes the cropper and shows "Please choose a JPEG or PNG photo." next to the avatar (the `onCancel('decode-error')` path).
7. **Console check:** preview_console_logs — no errors; network tab shows a single `uploadPersonPhoto` POST per confirm.

- [ ] **Step 3: Capture proof** — preview_screenshot of the crop dialog (desktop + mobile viewport) for the PR.

---

### Task 6: Finish the branch

- [ ] **Step 1: Invoke `superpowers:finishing-a-development-branch`**

Outcome per repo convention: push `feat/236-photo-crop`, open a **draft PR** against `qa` following `.github/pull_request_template.md` end-to-end (pre-tick local gates; leave manual-checklist boxes for the human), body carries a `## Closes` section with bare `Closes #236`, milestone left unset (the issue has none). Attach the QA screenshots from Task 5.

---

## Verification summary

- Unit: `clampCropRect` rounding/clamping (`resize-crop.test.ts`)
- Component: `PhotoCropDialog` confirm/cancel/error/URL-lifecycle; `PersonForm` pick → crop → upload/stash rewiring (existing #185 regressions preserved)
- Gates: `pnpm typecheck && pnpm lint && pnpm test` all green under Node 24
- Manual: 7-point preview QA above, including the nested-Sheet stacking risk check on mobile viewport
