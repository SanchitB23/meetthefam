'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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

  // Object-URL derived from `file` — no intermediate state to avoid
  // triggering react-hooks/set-state-in-effect. URL is memoized so it
  // only changes when `file` identity changes (parent mounts a new File).
  const imageUrl = useMemo(() => URL.createObjectURL(file), [file])

  // Revoke the object URL when the component unmounts or `file` changes.
  useEffect(() => {
    return () => URL.revokeObjectURL(imageUrl)
  }, [imageUrl])

  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [areaPixels, setAreaPixels] = useState<CropRect | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onCancel()}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={confirm}
          disabled={busy || !areaPixels}
        >
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
