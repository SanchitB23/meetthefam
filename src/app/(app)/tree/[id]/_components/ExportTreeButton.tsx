'use client'
// Header trigger for tree export (#217/#219). A PNG/PDF dropdown that never
// touches the tree DOM: picking a format fires `mtf-export-tree`; FamilyTree
// (via useExportTrigger) does the capture and round-trips `mtf-export-pending`
// so this trigger can disable + spinner while a capture runs.
import { Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { dispatchExportTree, onExportPending } from '../_lib/export-events'

export function ExportTreeButton({ treeName }: { treeName: string }) {
  const [pending, setPending] = useState(false)

  useEffect(() => onExportPending(({ pending }) => setPending(pending)), [])

  return (
    <DropdownMenu>
      {/* disabled here gates Base UI's open handlers (click/keyboard); the inner
          button's disabled is the visual/native state — both are needed. */}
      <DropdownMenuTrigger
        disabled={pending}
        render={
          <button
            type="button"
            aria-label={pending ? 'Exporting tree…' : 'Export tree'}
            title={pending ? 'Exporting tree…' : 'Export tree'}
            disabled={pending}
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
        }
      />
      <DropdownMenuContent align="end" side="bottom">
        <DropdownMenuItem onClick={() => dispatchExportTree({ format: 'png', treeName })}>
          Download as PNG
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => dispatchExportTree({ format: 'pdf', treeName })}>
          Download as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
