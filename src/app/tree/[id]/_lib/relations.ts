import type { PersonRow } from './types'

// Phase 3 sub-task 4 — relation-walk helpers.
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
