import type { ReactNode } from 'react'

/**
 * Prose — heirloom-styled wrapper for long-form text (legal pages).
 *
 * Styles descendant elements via Tailwind arbitrary-variant selectors against
 * the heirloom tokens, so we avoid pulling in @tailwindcss/typography (whose
 * cool-gray defaults fight the cream/forest palette). Wrap a page's body in
 * <Prose> for consistent headings, paragraphs, lists, and links.
 */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div
      className="
        [&_h1]:font-serif [&_h1]:text-4xl [&_h1]:text-foreground [&_h1]:mb-2
        [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:text-foreground [&_h2]:mt-10 [&_h2]:mb-3
        [&_h3]:font-serif [&_h3]:text-xl [&_h3]:text-foreground [&_h3]:mt-6 [&_h3]:mb-2
        [&_p]:text-muted-foreground [&_p]:leading-relaxed [&_p]:mb-4
        [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ul]:space-y-1 [&_ul]:text-muted-foreground
        [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4 [&_ol]:space-y-1 [&_ol]:text-muted-foreground
        [&_a]:text-accent [&_a]:underline hover:[&_a]:text-foreground
        [&_strong]:text-foreground [&_strong]:font-semibold
      "
    >
      {children}
    </div>
  )
}
