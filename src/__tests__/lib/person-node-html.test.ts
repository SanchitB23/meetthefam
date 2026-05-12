// Regression test for the v0.0.5 visual-QA bug where personNodeHtml
// crashed at runtime because the function treated `d.data` (the Datum
// family-chart wraps in its d3-hierarchy node) as the payload, when in
// fact the payload lives at `d.data.data`.
//
// These tests fabricate a TreeDatum the same shape the library produces
// at render time, then assert the rendered HTML actually contains the
// rendered fields. Unit-coverage parity with what we ship to the chart.

import { describe, expect, test } from 'vitest'

import type { TreeDatum } from 'family-chart'

import { personNodeHtml } from '@/app/tree/[id]/_lib/person-node-html'
import type { FamilyChartDatum } from '@/app/tree/[id]/_lib/family-chart-data'

function datum(overrides: Partial<FamilyChartDatum['data']> = {}): FamilyChartDatum {
  return {
    id: 'p-1',
    data: {
      gender: 'F',
      full_name: 'Jane Smith',
      first_name: 'Jane',
      last_name: 'Smith',
      nickname: null,
      photo_url: null,
      birth_year: 1972,
      death_year: null,
      deceased: false,
      location: null,
      occupation: null,
      bio: null,
      tone: 'sage',
      gender_raw: 'f',
      ...overrides,
    },
    rels: { parents: [], spouses: [], children: [] },
  }
}

/**
 * Fabricate a `TreeDatum` the same way family-chart's layout step does:
 * the d3 hierarchy wrapping nests our shipped Datum under `node.data`.
 * The real `TreeDatum` has 20+ d3-layout fields (`parents`, `spouses`,
 * `_x`, `psx`, etc.) we never reach during rendering — `unknown as
 * TreeDatum` keeps the lint rule happy without a runtime weight.
 */
function treeNode(d: FamilyChartDatum): TreeDatum {
  return { data: d, x: 0, y: 0, depth: 0, tid: `${d.id}-tid` } as unknown as TreeDatum
}

describe('personNodeHtml', () => {
  test('renders the full name', () => {
    const html = personNodeHtml(treeNode(datum({ full_name: 'Jane Smith' })))
    expect(html).toContain('Jane Smith')
  })

  test('renders `b. YYYY` for a living person with a birth year', () => {
    const html = personNodeHtml(
      treeNode(datum({ birth_year: 1972, deceased: false })),
    )
    expect(html).toContain('b. 1972')
    expect(html).not.toContain('d. ')
  })

  test('renders `b. YYYY – d. YYYY` for a deceased person', () => {
    const html = personNodeHtml(
      treeNode(
        datum({ birth_year: 1900, death_year: 1975, deceased: true }),
      ),
    )
    expect(html).toContain('b. 1900')
    expect(html).toContain('d. 1975')
  })

  test('omits the date line when both years are null', () => {
    const html = personNodeHtml(
      treeNode(datum({ birth_year: null, death_year: null, deceased: false })),
    )
    expect(html).not.toContain('b. ')
    expect(html).not.toContain('d. ')
  })

  test('embeds data-person-id on the wrapper for the press hook', () => {
    const html = personNodeHtml(treeNode(datum({})))
    // Two `data-person-id` attributes appear in the rendered HTML: one on
    // the .mtf-node wrapper, one on the [data-action-trigger] button.
    const matches = html.match(/data-person-id="p-1"/g) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  test('embeds [data-action-trigger] button for the three-dot fallback', () => {
    const html = personNodeHtml(treeNode(datum({})))
    expect(html).toContain('data-action-trigger')
    // 44×44 hit area per docs/ux/mobile-gestures.md
    expect(html).toMatch(/width:44px;\s*height:44px/)
  })

  test('photo branch renders an <img> with object-fit:cover', () => {
    const html = personNodeHtml(
      treeNode(datum({ photo_url: 'https://example.com/p.jpg' })),
    )
    expect(html).toContain('<img')
    expect(html).toContain('https://example.com/p.jpg')
    expect(html).toContain('object-fit:cover')
  })

  test('initials branch tints by the person\'s tone token', () => {
    const html = personNodeHtml(treeNode(datum({ tone: 'rose' })))
    expect(html).toContain('var(--tone-rose-bg)')
    expect(html).toContain('var(--tone-rose-ink)')
    // Initials computed from full_name = 'Jane Smith' → 'JS'.
    expect(html).toContain('JS')
  })

  test('avatar wrapper is a circle with flex-centered content (both branches)', () => {
    // Regression for the v0.0.5 screenshot bug — square block + top-left
    // initials. Without these wrapper styles the avatar reads as a flat
    // tinted box.
    const initialsHtml = personNodeHtml(treeNode(datum({ photo_url: null })))
    expect(initialsHtml).toContain('border-radius:50%')
    expect(initialsHtml).toContain('display:inline-flex')
    expect(initialsHtml).toContain('align-items:center')
    expect(initialsHtml).toContain('justify-content:center')

    const photoHtml = personNodeHtml(
      treeNode(datum({ photo_url: 'https://example.com/p.jpg' })),
    )
    expect(photoHtml).toContain('border-radius:50%')
    expect(photoHtml).toContain('overflow:hidden')
  })

  test('escapes HTML-unsafe characters in name + photo url', () => {
    const html = personNodeHtml(
      treeNode(
        datum({
          full_name: 'O\'Brien <script>',
          photo_url: 'https://a/?q="x"&y=1',
        }),
      ),
    )
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&#39;')
    expect(html).toContain('&quot;')
    expect(html).toContain('&amp;')
  })

  test('regression: does not crash on a real-shape TreeDatum', () => {
    // The v0.0.5 visual-QA bug — the renderer treated d.data as the
    // payload directly; this assertion is the smoke test for that.
    expect(() =>
      personNodeHtml(treeNode(datum({ full_name: 'Anon' }))),
    ).not.toThrow()
  })
})
