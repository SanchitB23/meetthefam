'use client'
// Minimal progress shell for the export seam (#217). Modal, no close affordance
// while a capture runs. #218 may extend it with progress detail / cancel.
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function ExportProgressDialog({ open }: { open: boolean }) {
  // Controlled dialog: Base UI requests close via onOpenChange; silently
  // ignoring the request keeps the modal open during capture (Escape/overlay
  // can't dismiss it). #218: when real capture has duration, add an
  // aria-live/aria-busy progress affordance + a cancel path, and cover the
  // no-close behavior with a test (the #217 stub closes within a tick).
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-xs" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Preparing export…</DialogTitle>
          <DialogDescription>
            Capturing your family tree. This can take a few seconds.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}
