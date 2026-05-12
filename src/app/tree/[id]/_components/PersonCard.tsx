// No `'server-only'`: starting in sub-task 3, PersonCard renders inside the
// client component `PersonList` (which owns the "edit-target" state). The
// card itself stays presentational — no hooks, no effects, no client APIs —
// so it works equally well in server contexts; we just can't lock it down.
import { Avatar, type Tone } from '@/components/ui/avatar'

// Fields needed across Phase 3 sub-tasks. Mirrors the columns selected in
// `/tree/[id]/page.tsx`. Reused from PersonList + future PersonForm callsites,
// so it lives here next to its primary consumer (same pattern as TreeRow).
export type PersonRow = {
  id: string
  tree_id: string
  full_name: string
  nickname: string | null
  gender: 'm' | 'f' | 'other' | 'unknown'
  photo_url: string | null
  bio: string | null
  birth_year: number | null
  location: string | null
  occupation: string | null
  deceased: boolean
  death_year: number | null
  father_id: string | null
  mother_id: string | null
  spouse_id: string | null
  tone: Tone
}

type Props = {
  person: PersonRow
  /** Resolves spouse/parent names without re-querying the DB. */
  peopleById: Map<string, PersonRow>
}

function buildRelations(person: PersonRow, peopleById: Map<string, PersonRow>) {
  const lines: string[] = []

  const spouse = person.spouse_id ? peopleById.get(person.spouse_id) : null
  if (spouse) lines.push(`Spouse of ${spouse.full_name}`)

  const father = person.father_id ? peopleById.get(person.father_id) : null
  const mother = person.mother_id ? peopleById.get(person.mother_id) : null
  if (father && mother) {
    lines.push(`Child of ${father.full_name} & ${mother.full_name}`)
  } else if (father) {
    lines.push(`Child of ${father.full_name}`)
  } else if (mother) {
    lines.push(`Child of ${mother.full_name}`)
  }

  return lines
}

export function PersonCard({ person, peopleById }: Props) {
  const relations = buildRelations(person, peopleById)

  return (
    <div className="h-full border border-border rounded-lg p-4 pr-10 bg-card flex gap-3">
      <Avatar
        fullName={person.full_name}
        photoUrl={person.photo_url}
        tone={person.tone}
        size="md"
      />
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <div className="flex flex-col">
          <h2 className="font-serif text-lg text-foreground leading-tight truncate">
            {person.full_name}
          </h2>
          {person.nickname && (
            <p className="text-sm italic text-foreground/60 truncate">
              “{person.nickname}”
            </p>
          )}
        </div>

        {relations.length > 0 && (
          <ul className="text-xs text-foreground/60 space-y-0.5 mt-1">
            {relations.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}

        {person.birth_year && (
          <p className="text-xs text-foreground/40 mt-auto">
            b. {person.birth_year}
            {person.deceased && person.death_year ? ` – ${person.death_year}` : ''}
          </p>
        )}
      </div>
    </div>
  )
}
