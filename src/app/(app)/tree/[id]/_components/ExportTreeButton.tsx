'use client'
// Header trigger for tree export (#217). A dumb dispatcher: it never touches
// the tree DOM. Clicking fires `mtf-export-tree`; FamilyTree (via
// useExportTrigger) does the work and round-trips `mtf-export-pending` so this
// button can disable + spinner while a capture runs. #218 adds a PNG/PDF
// chooser; for now it dispatches a default png.
import { Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import { dispatchExportTree, onExportPending } from '../_lib/export-events'

export function ExportTreeButton({ treeName }: { treeName: string }) {
  const [pending, setPending] = useState(false)

  useEffect(() => onExportPending(({ pending }) => setPending(pending)), [])

  return (
    <button
      type="button"
      aria-label={pending ? 'Exporting tree…' : 'Export tree'}
      title={pending ? 'Exporting tree…' : 'Export tree'}
      disabled={pending}
      onClick={() => dispatchExportTree({ format: 'png', treeName })}
      className="inline-flex items-center justify-center h-10 w-10 rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? (
        <svg
          className="animate-spin h-5 w-5 text-primary"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      ) : (
        <Download className="h-5 w-5" aria-hidden="true" />
      )}
    </button>
  )
}
