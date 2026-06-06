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
  return (
    <Dialog open={open} onOpenChange={() => { /* locked while exporting */ }}>
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
