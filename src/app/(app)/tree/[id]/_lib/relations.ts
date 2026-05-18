import type { PersonRow } from './types'

// Phase 3 sub-task 4 — relation-walk helpers.
// Phase 4 sub-task 3 — adds `buildRelations`, hoisted from the deleted
// `_components/PersonCard.tsx` (sub-task 1) so `PersonDetailSheet` can
// render the same human-readable summary without depending on card chrome.
//
// Per decision #6 in the Phase 3 plan, ancestor-cycle detection is the
// only DB-enforced integrity check. The other "obviously wrong" cases
// (spouse-of-self, spouse-of-ancestor, spouse-of-descendant, picking
// a descendant as a parent) are surfaced as UI guards via
// `PersonPicker`'s `excludeIds` — we never give the user the option in
// the first place, so the DB doesn't have to reject it.
//
// Both walks use a visited-set so they terminate on any pathological
// cycles already present in the data (defensive — the DB shouldn't
// allow them, but the UI shouldn't infinite-loop if it does).

/**
 * Human-readable one-line summaries of `person`'s direct relations
 * (spouse + parents). Returns an empty array when the person has no
 * resolvable links. Hoisted unchanged from the pre-Phase-4 PersonCard.
 */
export function buildRelations(
  person: PersonRow,
  peopleById: Map<string, PersonRow>,
): string[] {
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

/** All ancestors of `personId` via `father_id` / `mother_id` (excludes the person itself). */
export function collectAncestors(
  personId: string,
  peopleById: Map<string, PersonRow>,
): Set<string> {
  const ancestors = new Set<string>()
  const stack: string[] = [personId]
  const visited = new Set<string>([personId])

  while (stack.length > 0) {
    const id = stack.pop()!
    const person = peopleById.get(id)
    if (!person) continue
    for (const parentId of [person.father_id, person.mother_id]) {
      if (parentId && !visited.has(parentId)) {
        visited.add(parentId)
        ancestors.add(parentId)
        stack.push(parentId)
      }
    }
  }

  return ancestors
}

/** All descendants of `personId` (rows where they appear as `father_id`/`mother_id`, recursively). */
export function collectDescendants(
  personId: string,
  peopleById: Map<string, PersonRow>,
): Set<string> {
  // Build a parent → children index once. With ≤200 people per tree this
  // is cheap; the caller is expected to memoize the Map at the call site
  // if they invoke this twice in a render.
  const childrenByParent = new Map<string, string[]>()
  for (const person of peopleById.values()) {
    for (const parentId of [person.father_id, person.mother_id]) {
      if (!parentId) continue
      const arr = childrenByParent.get(parentId)
      if (arr) arr.push(person.id)
      else childrenByParent.set(parentId, [person.id])
    }
  }

  const descendants = new Set<string>()
  const stack: string[] = [personId]
  const visited = new Set<string>([personId])

  while (stack.length > 0) {
    const id = stack.pop()!
    const kids = childrenByParent.get(id) ?? []
    for (const childId of kids) {
      if (visited.has(childId)) continue
      visited.add(childId)
      descendants.add(childId)
      stack.push(childId)
    }
  }

  return descendants
}
