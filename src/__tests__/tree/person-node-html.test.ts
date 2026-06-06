import { describe, expect, it } from 'vitest'

import { personNodeHtml } from '@/app/(app)/tree/[id]/_lib/person-node-html'

// personNodeHtml takes a TreeDatum (d3 hierarchy node shape) where the
// renderable payload lives at d.data.data — one level deeper than the library's
// typed surface. We mirror that double-nesting in the fixture.
function makeNode(
  genderRaw: 'm' | 'f' | 'other' | 'unknown',
  overrides: Record<string, unknown> = {},
) {
  return {
    data: {
      id: 'p1',
      data: {
        id: 'p1',
        full_name: 'Test Person',
        first_name: 'Test',
        last_name: 'Person',
        nickname: null,
        gender: 'M' as const,
        gender_raw: genderRaw,
        tone: 'sage' as const,
        deceased: false,
        photo_url: null,
        birth_year: null,
        death_year: null,
        location: null,
        occupation: null,
        bio: null,
        ...overrides,
      },
      rels: { parents: [], spouses: [], children: [] },
    },
    duplicate: undefined,
  }
}

describe('personNodeHtml avatar shape', () => {
  it("emits border-radius for gender_raw 'm'", () => {
    const html = personNodeHtml(makeNode('m') as unknown as Parameters<typeof personNodeHtml>[0])
    expect(html).toMatch(/border-radius:\s*9px/)
    expect(html).not.toMatch(/clip-path:\s*polygon/)
  })

  it("emits squircle border-radius for gender_raw 'unknown'", () => {
    const html = personNodeHtml(makeNode('unknown') as unknown as Parameters<typeof personNodeHtml>[0])
    expect(html).toMatch(/border-radius:\s*16px/)
    expect(html).not.toMatch(/clip-path:\s*polygon/)
  })

  it("emits border-radius 50% for gender_raw 'f'", () => {
    const html = personNodeHtml(makeNode('f') as unknown as Parameters<typeof personNodeHtml>[0])
    expect(html).toMatch(/border-radius:\s*50%/)
    expect(html).not.toMatch(/clip-path:\s*polygon/)
  })

  it("emits clip-path: polygon for gender_raw 'other'", () => {
    const html = personNodeHtml(makeNode('other') as unknown as Parameters<typeof personNodeHtml>[0])
    expect(html).toMatch(/clip-path:\s*polygon\(/)
    expect(html).toMatch(/border-radius:\s*0/)
  })
})
