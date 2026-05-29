import { formatDistanceToNow } from 'date-fns'
import { LinkProgress } from '@/components/ui/LinkProgress'
import { Sparkle } from '@/components/icons/Sparkle'
import { isRecent } from '@/lib/dates/isRecent'

export type TreeRow = {
  id: string
  name: string
  description: string | null
  owner_id: string
  created_at: string
  updated_at: string
}

type Props = {
  tree: TreeRow
  role: 'owner' | 'editor'
  /** Owner-only "…" menu — passed in Sub-task 3. Null until then. */
  actions?: React.ReactNode
}

export function TreeCard({ tree, role, actions }: Props) {
  const isNew = isRecent(tree.created_at, 7)
  return (
    <div className="relative border border-border rounded-lg p-4 bg-card flex flex-col gap-3 transition-colors hover:bg-card/70 focus-within:ring-2 focus-within:ring-ring/40">
      {/* Stretched Link covers the card surface but sits BEHIND the actions
          slot (z-0 vs z-10 below). The DropdownMenu's own event handling
          stops propagation, but layering also guarantees clicks land on the
          intended target without relying on Base UI's stopPropagation alone. */}
      <LinkProgress
        href={`/tree/${tree.id}`}
        className="absolute inset-0 z-0 rounded-lg"
        aria-label={`Open ${tree.name}`}
      />

      <div className="relative z-10 flex items-start justify-between gap-2 pointer-events-none">
        <h2 className="font-serif text-lg text-foreground leading-tight flex items-center gap-1.5">
          {tree.name}
          {isNew && (
            <span
              role="img"
              aria-label="Recently created"
              className="text-accent shrink-0"
            >
              <Sparkle size={14} />
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2 shrink-0 pointer-events-auto">
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              role === 'owner'
                ? 'bg-primary/10 text-primary'
                : 'bg-foreground/10 text-foreground/60'
            }`}
          >
            {role}
          </span>
          {actions}
        </div>
      </div>
      {tree.description && (
        <p className="relative z-10 text-sm text-foreground/60 line-clamp-2 pointer-events-none">
          {tree.description}
        </p>
      )}
      <p className="relative z-10 text-xs text-foreground/40 mt-auto pointer-events-none">
        Updated{' '}
        {formatDistanceToNow(new Date(tree.updated_at), { addSuffix: true })}
      </p>
    </div>
  )
}
