import { formatDistanceToNow } from 'date-fns'

export type TreeRow = {
  id: string
  name: string
  description: string | null
  owner_id: string
  updated_at: string
}

type Props = {
  tree: TreeRow
  role: 'owner' | 'editor'
  /** Owner-only "…" menu — passed in Sub-task 3. Null until then. */
  actions?: React.ReactNode
}

export function TreeCard({ tree, role, actions }: Props) {
  return (
    <div className="border border-border rounded-lg p-4 bg-card flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-serif text-lg text-foreground leading-tight">
          {tree.name}
        </h2>
        <div className="flex items-center gap-2 shrink-0">
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
        <p className="text-sm text-foreground/60 line-clamp-2">
          {tree.description}
        </p>
      )}
      <p className="text-xs text-foreground/40 mt-auto">
        Updated{' '}
        {formatDistanceToNow(new Date(tree.updated_at), { addSuffix: true })}
      </p>
    </div>
  )
}
