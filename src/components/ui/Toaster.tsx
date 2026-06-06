'use client'

import { Toaster as SonnerToaster } from 'sonner'
import { useIsDesktop } from '@/components/ui/use-is-desktop'

// Single app-wide toast surface (#70). Position clears the FAB
// (fixed bottom-6 right-6 at all breakpoints): top-center on mobile,
// top-right on desktop. Visuals are themed to heirloom tokens via the
// `[data-sonner-toast]` block in globals.css + the classNames below.
export function Toaster() {
  const isDesktop = useIsDesktop()
  return (
    <SonnerToaster
      position={isDesktop ? 'top-right' : 'top-center'}
      offset={isDesktop ? 16 : 12}
      gap={8}
      toastOptions={{
        classNames: {
          toast: 'font-sans rounded-md border border-border bg-card text-foreground shadow-lg',
          title: 'text-sm leading-snug',
          description: 'text-xs text-muted-foreground',
          actionButton: 'text-xs font-medium',
        },
      }}
    />
  )
}
