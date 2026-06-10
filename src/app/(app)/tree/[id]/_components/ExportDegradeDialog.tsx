'use client'
// Degrade-warning dialog for full-tree export (#225, spec §7). Shown by the
// preflight gate when the tree exceeds the canvas ceiling, measurement failed,
// or the device is mobile-like. Continue proceeds with a best-effort export;
// Cancel aborts with nothing mutated. Escape / overlay-click count as Cancel.
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
  onContinue: () => void
  onCancel: () => void
}

export function ExportDegradeDialog({ open, onContinue, onCancel }: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onCancel()
      }}
    >
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Large tree export</DialogTitle>
          <DialogDescription>
            This tree is large — the full export may be reduced quality. Continue
            anyway, or open on a desktop browser for the best result.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={onContinue}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
