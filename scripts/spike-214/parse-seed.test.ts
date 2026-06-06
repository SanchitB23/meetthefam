import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseSeed } from './parse-seed.ts'

const SEED = readFileSync(join(import.meta.dirname, '../../supabase/seed.sql'), 'utf8')

test('parses all 55 seed people', () => {
  const people = parseSeed(SEED)
  assert.equal(people.length, 55)
})

test('extracts parent links from the INSERT column order', () => {
  const people = parseSeed(SEED)
  const withParents = people.filter((p) => p.fatherId || p.motherId)
  assert.ok(withParents.length > 0, 'some people should have parents')
})

test('extracts bidirectional spouse links from UPDATE statements', () => {
  const people = parseSeed(SEED)
  const george = people.find((p) => p.id === '22222222-0000-0000-0000-000000000001')
  assert.equal(george?.spouseId, '22222222-0000-0000-0000-000000000002')
})

test('every parent/spouse id resolves to a known person (no dangling refs)', () => {
  const people = parseSeed(SEED)
  const ids = new Set(people.map((p) => p.id))
  for (const p of people) {
    for (const ref of [p.fatherId, p.motherId, p.spouseId]) {
      if (ref) assert.ok(ids.has(ref), `dangling ref ${ref} from ${p.id}`)
    }
  }
})
