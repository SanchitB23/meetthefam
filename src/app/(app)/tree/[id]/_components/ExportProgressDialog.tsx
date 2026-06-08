'use client'
// Progress dialog for tree export (#217/#218). Modal while a capture runs.
// #218: adds Cancel (soft-cancel — the raster may finish in the background
// but the result is discarded and no download fires).
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type Props = {
  open: boolean
  /** Called when the user clicks Cancel. Soft-cancel: skips the download. */
  onCancel?: () => void
}

export function ExportProgressDialog({ open, onCancel }: Props) {
  // Controlled dialog: onOpenChange silently ignores close requests so
  // Escape / overlay-click can't dismiss it. The only dismissal path is
  // the Cancel button (which lets the raster finish in the background
  // and just skips the download).
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-xs" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Preparing export…</DialogTitle>
          <DialogDescription>
            Capturing your family tree. This can take a few seconds.
          </DialogDescription>
        </DialogHeader>
        {onCancel && (
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
            >
              Cancel
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
