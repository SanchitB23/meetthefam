# Photo crop-before-upload — design (issue #236)

- **Date:** 2026-06-13
- **Issue:** [#236](https://github.com/SanchitB23/meetthefam/issues/236)
- **Status:** Approved via brainstorming session (visual companion used for placement choice)
- **Branch:** `feat/236-photo-crop`

## Problem

The photo-upload flow has no crop step. A picked file goes straight through `resizeToJpeg()` (`src/lib/image/resize.ts`) and uploads; avatars and tree nodes then display a CSS-centered crop (`object-cover` + clip shapes). For group shots or off-center portraits the subject can land outside the visible avatar frame, and the user has no way to fix it.

## Locked decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | What we store | **Destructive crop** — only the cropped square JPEG uploads; the original never leaves the browser | Zero schema/Storage/RLS changes; avatars are the photo's only consumer; YAGNI |
| 2 | Cropper placement | **Nested crop dialog** — picking a file opens a second Dialog (desktop) / Sheet (mobile) over the person form | Maximum stage area for touch gestures; reuses the existing `useIsDesktop` Dialog/Sheet pattern; form state untouched until confirm |
| 3 | Crop engine | **`react-easy-crop@6`** (MIT, peer `react >= 16.4`, controlled component) | Battle-tested pinch/zoom/pan gesture math; output is just a pixel rect — we keep ownership of canvas + encode; hand-rolled gesture math and cropperjs both rejected |
| 4 | Crop geometry | 1:1 aspect, round mask preview, pre-centered max square as initial state | Matches circular avatar display; octagon tree-node clip inscribes the same square; confirming without adjusting reproduces today's behavior |
| 5 | Rotation UI | None | EXIF orientation already normalized; YAGNI |
| 6 | When the cropper shows | Always, after every pick (create + edit modes) | One extra tap worst-case; consistent flow |
| 7 | Pipeline downstream of crop | Unchanged | Same ≤1024 px cap, JPEG q0.85, `photos` bucket (`image/jpeg`, ≤512 KB lid), `uploadPersonPhoto` / `pendingBlob` branches |

## Flow

```
file pick → PersonForm stashes File + opens PhotoCropDialog
         → user pinch/drag/zooms (slider for keyboard/desktop)
         → "Use photo": crop rect + File → cropAndResizeToJpeg() → Blob
            → edit mode:  upload immediately (existing optimistic preview + toast)
            → create mode: stash Blob in pendingPhotoRef (existing)
         → "Cancel": discard File, reset <input>, form untouched
```

## Components

### `PhotoCropDialog.tsx` (new — `src/app/(app)/tree/[id]/_components/`)

`'use client'`. Renders Dialog on desktop / Sheet on mobile via `useIsDesktop`, mounted as a **sibling** of the person form's own Dialog/Sheet. Contains:

- `<Cropper aspect={1} cropShape="round" showGrid={false} />` from `react-easy-crop`, imported via `next/dynamic` so it loads only when a photo is picked
- Zoom slider (accessibility path for keyboard/non-touch users; pinch is not the only way to zoom)
- Cancel / Use photo actions
- Owns the object-URL lifecycle (`URL.createObjectURL` on open, `revokeObjectURL` on close)

Props: `file: File | null` (open when non-null), `onConfirm(blob: Blob)`, `onCancel()`.

The dialog runs `cropAndResizeToJpeg` itself on "Use photo" and hands the finished Blob to `onConfirm` — `PersonForm` never sees crop coordinates.

### `src/lib/image/resize.ts` (extend, don't fork)

Add `cropAndResizeToJpeg(file: File, crop: {x, y, width, height}): Promise<ResizeResult>` — passes a source rect to the existing `drawImage` call so one draw does crop + downscale (≤1024 px) + JPEG q0.85 encode. Shares `drawAndEncode` and `ImageDecodeError` with `resizeToJpeg`.

**EXIF correctness:** the cropper displays the image via `<img>` (browsers orient via EXIF by default) and our canvas path uses `createImageBitmap(file, { imageOrientation: 'from-image' })` — both operate on the oriented image, so crop coordinates line up. No new EXIF handling needed.

### `PersonForm.tsx` (surgical edit)

`onPickPhoto` shrinks to: validate file exists → stash `File` in state → dialog opens. The existing upload (edit) / `pendingBlob` stash (create) branches move into the `onConfirm(blob)` callback the form passes to the dialog — they receive a finished Blob, exactly as they receive `resized.blob` today. `Remove photo`, the #185 success notification, and error display are unchanged.

## Error handling

- **Undecodable file** (HEIC on Chrome, corrupt): cropper's image fails to load → close dialog, surface existing `photoError` "Please choose a JPEG or PNG photo." (same UX, different detection point).
- **Canvas/encode failure on confirm:** dialog stays open with inline "Couldn't process the photo. Try a different one."
- **Upload failure:** unchanged — existing optimistic-preview revert.
- **Risk to verify first:** nested Dialog-over-Sheet stacking on Base UI mobile. **Fallback:** render the cropper as a swap-in view inside the existing Sheet (inline placement, fallback only).

## Out of scope

- Re-cropping an already-uploaded photo (would require storing originals — rejected, decision 1)
- Rotation, flip, filters
- HEIC decode support (deferred since Phase 5, unchanged)
- Tree-node octagon rendering, Storage paths, RLS

## Testing

- **Unit:** crop-rect math + `cropAndResizeToJpeg` source-rect handling (canvas mocked — same pattern as existing `@/lib/image/resize` mock in `src/__tests__/components/PersonForm.photo-upload.test.tsx`).
- **Component:** extend `PersonForm.photo-upload.test.tsx` — pick → dialog opens → confirm calls `uploadPersonPhoto` with cropped blob; cancel resets input + state. `react-easy-crop` mocked to a stub reporting a fixed crop rect.
- **Manual QA (preview):** mobile-viewport pinch/zoom, EXIF portrait photo, oversized photo, HEIC rejection, create-mode stash + flush after `createPerson`.
