import 'server-only'
import { PersonCard, type PersonRow } from './PersonCard'

type Props = { people: PersonRow[] }

export function PersonList({ people }: Props) {
  // Build the lookup map once at render-time so each PersonCard can resolve
  // spouse/parent names in O(1) without re-querying.
  const peopleById = new Map(people.map((p) => [p.id, p]))

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {people.map((p) => (
        <PersonCard key={p.id} person={p} peopleById={peopleById} />
      ))}
    </div>
  )
}
